// Achterbahn-Rummel: Schienen (mechanics.ts: Rail, PULSE_KICK; sim.ts: Schienenmodus; ai.ts).

import { afterAll, describe, expect, it } from 'vitest';
import { AI_EASY, AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import { KICK_TICKS, PULSE_KICK, RAIL_VMAX, pulseCycle } from '../../src/game/mechanics';
import { BTN_BRAKE, BTN_GAS, BTN_ITEM, EV_FALL, EV_PAD, EV_USE_BOOST, EV_WALL, FLAG_AIR, ITEM_BOOST, ITEM_NONE, ITEM_SPRING, V_MAX, gridState, stepKart, type KartState } from '../../src/game/sim';
import { EDGE_GAP, EDGE_RAIL, TRACK, TRACK_COUNT, addProgress, getTrack, proj, progDelta, projectOnTrack, railOf, rightX, rightZ, setTrack, trackHeading } from '../../src/game/track';

const RUMMEL = 16;

afterAll(() => {
  setTrack(0);
});

function at(seg: number, lat = 0, speed = 0, up = 0): KartState {
  const t = TRACK;
  const s = gridState(0);
  s.seg = seg;
  s.x = t.px[seg] + rightX(t, seg) * lat;
  s.z = t.pz[seg] + rightZ(t, seg) * lat;
  s.y = t.py[seg] + lat * t.bank[seg] + up;
  s.heading = trackHeading(t, seg);
  s.vx = Math.sin(s.heading) * speed;
  s.vz = Math.cos(s.heading) * speed;
  s.vy = 0;
  s.flags = 0;
  return s;
}

const lat = (s: KartState): number => {
  projectOnTrack(TRACK, s.x, s.z, s.seg);
  return proj.lat;
};
const speed = (s: KartState): number => Math.hypot(s.vx, s.vz);

describe('Schienen', () => {
  it('nur der Rummel hat Schienen: ein Stück mit zwei Schienen, Kettenlift und Bremsstrecke, ohne Lücke und ohne Looping', () => {
    for (let i = 0; i < TRACK_COUNT; i++) {
      const t = getTrack(i);
      if (i !== RUMMEL) {
        expect(t.rails.length).toBe(0);
        expect(t.pulses.some((p) => p.kind === PULSE_KICK)).toBe(false);
        for (let k = 0; k < t.total; k++) expect(t.edge[k] & EDGE_RAIL).toBe(0);
        continue;
      }
      expect(t.rails.length).toBe(1);
      const r = t.rails[0];
      expect(r.lanes).toEqual([-2, 2]);
      expect(r.lifts.length).toBe(1);
      expect(r.brakes.length).toBe(1);
      expect(r.count * t.step).toBeGreaterThan(550);
      let steep = 0;
      let high = -Infinity;
      let low = Infinity;
      for (let k = 0; k < r.count; k++) {
        const seg = r.first + k;
        expect(t.edge[seg] & EDGE_RAIL).not.toBe(0);
        expect(t.edge[seg] & EDGE_GAP).toBe(0);
        expect(railOf(t, seg)).toBe(r);
        // Schienen und Schubmagnete liegen auf der Fahrbahn
        expect(t.rh[seg]).toBeGreaterThan(2 + 1.2);
        steep = Math.max(steep, Math.abs(t.py[t.next[seg]] - t.py[seg]) / t.step);
        high = Math.max(high, t.py[seg]);
        low = Math.min(low, t.py[seg]);
      }
      // Hügel und Täler, aber nichts Senkrechtes: höchstens gut 35° – und nirgends über Kopf.
      expect(steep).toBeGreaterThan(0.35);
      expect(steep).toBeLessThan(0.75);
      expect(high - low).toBeGreaterThan(24);
      // Wer abstürzt (gibt es auf Schienen nicht) oder neu aufgesetzt wird, steht nicht auf dem Steilstück
      const kicks = t.pulses.filter((p) => p.kind === PULSE_KICK);
      expect(kicks.length).toBe(12);
      for (const p of kicks) {
        expect(t.edge[p.seg] & EDGE_RAIL).not.toBe(0);
        expect(Math.abs(p.lat)).toBe(2);
        // an jeder Stelle ziehen die beiden Magnete abwechselnd – nie beide zugleich
        const twin = kicks.find((q) => q.seg === p.seg && q !== p)!;
        let both = 0;
        let either = 0;
        for (let time = 0; time < p.period; time++) {
          const a = pulseCycle(p, time) < p.on;
          const b = pulseCycle(twin, time) < twin.on;
          if (a && b) both++;
          if (a || b) either++;
        }
        expect(both).toBe(0);
        expect(either).toBe(2 * p.on);
      }
    }
  });

  it('das Kart sitzt auf der Schiene: es rollt in der Spur, fällt nicht herunter und kommt ohne Gas über die ganze Bahn', () => {
    const t = setTrack(RUMMEL);
    const r = t.rails[0];
    // Aus dem Bahnhof, ohne Gas und ohne Lenken, einmal über die ganze Achterbahn.
    const s = at(r.first + 2, 0.4, 6);
    let top = 0;
    let slow = Infinity;
    let off = 0;
    let tick = 1;
    const note: string[] = [];
    for (; tick < 60 * 120 && (t.edge[s.seg] & EDGE_RAIL) !== 0; tick++) {
      const ev = stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: tick });
      expect(ev & EV_FALL).toBe(0);
      expect(s.flags & FLAG_AIR).toBe(0);
      const v = speed(s);
      top = Math.max(top, v);
      // (im flachen Bahnhof rollt es ohne Gas nur aus – gemessen wird ab dem Lifthügel)
      if (s.seg >= r.lifts[0][0] + 12) slow = Math.min(slow, v);
      if (tick > 60) off = Math.max(off, Math.min(Math.abs(lat(s) + 2), Math.abs(lat(s) - 2)));
      if (tick % 120 === 0) note.push(`${((s.seg - r.first) * t.step).toFixed(0)} m: ${v.toFixed(0)} m/s`);
    }
    console.log(`Achterbahn ohne Gas: ${(tick / 60).toFixed(1)} s, schnellste Stelle ${top.toFixed(1)} m/s, langsamste ${slow.toFixed(1)} m/s · ${note.join(' · ')}`);
    // am Ende der Schienen wieder auf der Straße
    expect(t.edge[s.seg] & EDGE_RAIL).toBe(0);
    expect(off).toBeLessThan(0.05);
    // die Kette zieht mit 12 m/s; die große Abfahrt bringt mehr als jede Straße, aber nie mehr als die Grenze
    expect(slow).toBeGreaterThan(8);
    expect(top).toBeGreaterThan(V_MAX + 4);
    expect(top).toBeLessThanOrEqual(RAIL_VMAX + 1e-6);
    // die Bremsstrecke entlässt mit höchstens 27 m/s
    expect(speed(s)).toBeLessThanOrEqual(27.5);
  });

  it('Lenken wechselt die Schiene; Bremsen hält nie an (kein Zurückrollen)', () => {
    const t = setTrack(RUMMEL);
    const r = t.rails[0];
    const s = at(r.first + 40, -2, 12);
    for (let tick = 1; tick <= 30; tick++) stepKart(s, { steer: 0, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: tick });
    expect(lat(s)).toBeCloseTo(-2, 1);
    // rechts lenken: nach gut einer halben Sekunde auf der rechten Schiene
    let tick = 31;
    for (; tick <= 31 + 45; tick++) stepKart(s, { steer: 127, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: tick });
    expect(lat(s)).toBeCloseTo(2, 1);
    // weiter rechts lenken ändert nichts mehr (keine dritte Schiene, kein Absturz)
    for (; tick <= 150; tick++) expect(stepKart(s, { steer: 127, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: tick }) & (EV_FALL | EV_WALL)).toBe(0);
    expect(lat(s)).toBeCloseTo(2, 1);
    // nur kurz antippen: zurück auf die nächste Schiene
    for (let k = 0; k < 6; k++, tick++) stepKart(s, { steer: -127, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: tick });
    for (let k = 0; k < 60; k++, tick++) stepKart(s, { steer: 0, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: tick });
    expect(lat(s)).toBeCloseTo(2, 1);
    // auf dem Lifthügel voll bremsen: Die Kette zieht trotzdem
    const up = at(r.lifts[0][0] + 30, 2, 12);
    for (let k = 1; k <= 180; k++) stepKart(up, { steer: 0, buttons: BTN_BRAKE }, { canDrive: true, speedFactor: 1, time: k });
    expect(speed(up)).toBeGreaterThan(2.5);
    expect(up.seg).toBeGreaterThan(r.lifts[0][0] + 30);
  });

  it('Items gehen auch auf der Schiene: der Schub wirkt, die Sprungfeder bleibt aufgehoben', () => {
    const t = setTrack(RUMMEL);
    const r = t.rails[0];
    const s = at(r.first + 30, -2, 12);
    s.item = ITEM_BOOST;
    expect(stepKart(s, { steer: 0, buttons: BTN_ITEM }, { canDrive: true, speedFactor: 1, time: 1 }) & EV_USE_BOOST).not.toBe(0);
    expect(s.item).toBe(ITEM_NONE);
    expect(s.boost).toBeGreaterThan(0);
    const f = at(r.first + 30, -2, 12);
    f.item = ITEM_SPRING;
    stepKart(f, { steer: 0, buttons: BTN_ITEM }, { canDrive: true, speedFactor: 1, time: 1 });
    expect(f.item).toBe(ITEM_SPRING);
    expect(f.flags & FLAG_AIR).toBe(0);
  });

  it('Schubmagnet: zieht er gerade und liegt er auf der eigenen Schiene, schiebt er an – sonst nicht', () => {
    const t = setTrack(RUMMEL);
    const kicks = t.pulses.filter((p) => p.kind === PULSE_KICK);
    const p = kicks[0];
    const twin = kicks.find((q) => q.seg === p.seg && q !== p)!;
    const run = (laneLat: number, time0: number): { boost: number; ev: number; v: number } => {
      const s = at(p.seg - 14, laneLat, 12);
      let ev = 0;
      let boost = 0;
      for (let k = 0; k < 100; k++) {
        ev |= stepKart(s, { steer: 0, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: time0 + k });
        boost = Math.max(boost, s.boost);
      }
      return { boost, ev, v: speed(s) };
    };
    // Zeit so wählen, dass p zieht, wenn das Kart ihn erreicht (nach knapp einer Sekunde) – der Zwilling ruht dann
    const live = ((p.period - p.phase) % p.period) + 10 - 55;
    expect(pulseCycle(p, live + 55)).toBeLessThan(p.on - 30);
    expect(pulseCycle(twin, live + 55)).toBeGreaterThan(twin.on);
    const hit = run(p.lat, live);
    const miss = run(twin.lat, live);
    expect(hit.ev & EV_PAD).not.toBe(0);
    expect(hit.boost).toBe(KICK_TICKS);
    expect(miss.ev & EV_PAD).toBe(0);
    expect(miss.boost).toBe(0);
    expect(hit.v).toBeGreaterThan(miss.v + 3);
  });

  it('die KI fährt die Achterbahn: niemand stürzt, die gute erwischt die Schubmagnete viel öfter', () => {
    const t = setTrack(RUMMEL);
    const kicked = [0, 0, 0];
    const time = [0, 0, 0];
    let falls = 0;
    for (let slot = 0; slot < 4; slot++) {
      for (const level of [AI_EASY, AI_MEDIUM, AI_HARD]) {
        const s = gridState(slot);
        const brain = newBrain(slot + level * 4, level);
        let progress = progDelta(t, 0, s.seg);
        let tick = 1;
        for (; tick < 60 * 300 && progress < 3 * t.n; tick++) {
          const before = s.seg;
          const onRail = (t.edge[s.seg] & EDGE_RAIL) !== 0;
          const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
          const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
          if (ev & EV_FALL) falls++;
          if (onRail && ev & EV_PAD) kicked[level]++;
          progress = addProgress(t, progress, before, s.seg);
        }
        expect(progress).toBeGreaterThanOrEqual(3 * t.n);
        time[level] += tick / 60 / 3;
      }
    }
    console.log(
      `Achterbahn-Rummel, KI in je 12 Runden: Schubmagnete erwischt leicht/mittel/schwer ${kicked.join('/')} (von 72 Stellen), Stürze ${falls}; Rundenzeit ${time.map((x) => (x / 4).toFixed(1)).join('/')} s`,
    );
    expect(falls).toBe(0);
    // sechs Stellen je Runde, zwölf Runden: Die gute nimmt die meisten, die vorsichtige nur, was ihr zufällt.
    expect(kicked[2]).toBeGreaterThan(50);
    expect(kicked[2]).toBeGreaterThan(kicked[0] + 15);
    expect(time[2]).toBeLessThan(time[0]);
  }, 120000);
});

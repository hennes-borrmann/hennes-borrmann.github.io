// Zeitriss-Ruine: zwei Zeitalter im Wechsel (mechanics.ts: Era), daran hängende Bruchstellen und Tore.

import { afterAll, describe, expect, it } from 'vitest';
import { AI_EASY, AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { ERA_WARN, eraAt, eraSince, eraUntil, planActive, type Era } from '../../src/game/mechanics';
import { EV_FALL, FLAG_AIR, KART_RADIUS, gridState, stepKart, type KartState } from '../../src/game/sim';
import { EDGE_GAP, NO_GROUND, TRACK, TRACK_COUNT, gateAt, getTrack, groundAt, groundNow, holeAt, proj, projectOnTrack, rightX, rightZ, setTrack, trackHeading } from '../../src/game/track';

const RUINE = 10;
const KAMMER = 0;
const AQUAEDUKT = 1;

afterAll(() => {
  setTrack(0);
});

function at(seg: number, lat = 0, speed = 0): KartState {
  const t = TRACK;
  const s = gridState(0);
  s.seg = seg;
  s.x = t.px[seg] + rightX(t, seg) * lat;
  s.z = t.pz[seg] + rightZ(t, seg) * lat;
  s.y = t.py[seg] + lat * t.bank[seg];
  s.heading = trackHeading(t, seg);
  s.vx = Math.sin(s.heading) * speed;
  s.vz = Math.cos(s.heading) * speed;
  s.vy = 0;
  s.flags = 0;
  return s;
}

describe('Zeitalter', () => {
  const e: Era = { period: 2040, split: 1020, names: ['Einst', 'Jetzt'], notes: ['', ''] };

  it('die Uhr springt im Takt zwischen beiden und zählt richtig herunter', () => {
    expect(eraAt(e, 0)).toBe(0);
    expect(eraAt(e, 1019)).toBe(0);
    expect(eraAt(e, 1020)).toBe(1);
    expect(eraAt(e, 2039)).toBe(1);
    expect(eraAt(e, 2040)).toBe(0);
    expect(eraUntil(e, 0)).toBe(1020);
    expect(eraUntil(e, 1000)).toBe(20);
    expect(eraUntil(e, 1020)).toBe(1020);
    expect(eraUntil(e, 2039)).toBe(1);
    expect(eraSince(e, 1020)).toBe(0);
    expect(eraSince(e, 1500)).toBe(480);
    expect(eraSince(e, 5 * 2040 + 7)).toBe(7);
    expect(ERA_WARN).toBeLessThan(e.split);
  });

  it('vor dem Start steht die Uhr: es gilt das Zeitalter, mit dem das Rennen beginnt', () => {
    for (const time of [-600, -345, -1, 0]) {
      expect(eraAt(e, time)).toBe(0);
      expect(eraUntil(e, time)).toBe(e.split);
    }
    // … und was am Zeitalter hängt, steht genauso still.
    const t = setTrack(RUINE);
    for (const h of t.holes) expect(planActive(h.plan, -300)).toBe(planActive(h.plan, 0));
    for (const g of t.gates) expect(planActive(g.plan, -300)).toBe(planActive(g.plan, 0));
  });
});

describe('Zeitriss-Ruine', () => {
  it('nur sie hat Zeitalter', () => {
    for (let i = 0; i < TRACK_COUNT; i++) {
      const t = getTrack(i);
      if (i === RUINE) {
        expect(t.def.name).toBe('Zeitriss-Ruine');
        expect(t.era).not.toBeNull();
        expect(t.era!.period).toBe(36 * 60);
        expect(t.era!.split).toBe(18 * 60);
        expect(t.holes.length).toBeGreaterThanOrEqual(8);
        expect(t.gates.length).toBe(2);
      } else expect(t.era).toBeNull();
    }
  });

  it('Einst trägt die Halle überall; Jetzt fehlen Platten – aber eine Spur bleibt', () => {
    const t = setTrack(RUINE);
    const e = t.era!;
    const hall = t.holes.filter((h) => t.branchOf[h.first] < 0);
    expect(hall.length).toBeGreaterThanOrEqual(4);
    for (const lap of [0, 1, 3]) {
      const einst = lap * e.period + 60;
      const jetzt = lap * e.period + e.split + 60;
      for (const h of hall) {
        const mid = h.first + Math.floor(h.count / 2);
        const lat = (Math.max(h.lat0, -t.wh[mid]) + Math.min(h.lat1, t.wh[mid])) / 2;
        expect(holeAt(t, mid, lat, einst)).toBe(false);
        expect(groundNow(t, mid, 0, lat, einst)).toBeCloseTo(groundAt(t, mid, 0, lat), 9);
        expect(holeAt(t, mid, lat, jetzt)).toBe(true);
        expect(groundNow(t, mid, 0, lat, jetzt)).toBe(NO_GROUND);
      }
    }
    // Jetzt: auf der Hauptstrecke bleibt überall eine Spur, auf die ein Kart bequem passt.
    let narrowest = Infinity;
    for (let seg = 0; seg < t.n; seg++) {
      if (t.edge[seg] & EDGE_GAP) continue;
      let run = 0;
      let best = 0;
      for (let lat = -t.wh[seg]; lat <= t.wh[seg] + 1e-9; lat += 0.1) {
        if (holeAt(t, seg, lat, e.split + 600)) run = 0;
        else {
          run += 0.1;
          best = Math.max(best, run);
        }
      }
      narrowest = Math.min(narrowest, best);
    }
    expect(narrowest).toBeGreaterThan(KART_RADIUS * 2 + 4);
    // Die Löcher liegen abwechselnd rechts und links: ein Slalom.
    const sides = hall.sort((a, b) => a.first - b.first).map((h) => Math.sign(h.lat0 + h.lat1));
    for (let i = 1; i < sides.length; i++) expect(sides[i]).toBe(-sides[i - 1]);
  });

  it('in jedem Zeitalter ist genau eine der beiden Abkürzungen offen', () => {
    const t = setTrack(RUINE);
    const e = t.era!;
    const kammer = t.gates.find((g) => t.branchOf[g.first] === KAMMER)!;
    const aqu = t.gates.find((g) => t.branchOf[g.first] === AQUAEDUKT)!;
    for (let time = 0; time < e.period * 3; time += 30) {
      const era = eraAt(e, time);
      // Einst: die Schatzkammer ist zugemauert, das Aquädukt steht. Jetzt: umgekehrt.
      expect(gateAt(t, kammer.first, time)).toBe(era === 0);
      expect(gateAt(t, aqu.first, time)).toBe(era === 1);
    }
    // Die Hauptstrecke ist nie gesperrt.
    for (let seg = 0; seg < t.n; seg++) expect(gateAt(t, seg, 60) || gateAt(t, seg, e.split + 60)).toBe(false);
  });

  it('wer auf einer Hallenplatte steht, wenn die Zeit reißt, stürzt – und wird auf festen Boden zurückgesetzt', () => {
    const t = setTrack(RUINE);
    const e = t.era!;
    for (const h of t.holes) {
      if (t.branchOf[h.first] >= 0) continue;
      const mid = h.first + Math.floor(h.count / 2);
      const lat = (Math.max(h.lat0, -t.wh[mid]) + Math.min(h.lat1, t.wh[mid])) / 2;
      const s = at(mid, lat);
      let fellAt = -1;
      let landed = -1;
      const time0 = e.period + e.split - 40;
      for (let i = 0; i < 60 * 8; i++) {
        const time = time0 + i;
        const ev = stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time });
        if (ev & EV_FALL && fellAt < 0) fellAt = time;
        if (fellAt >= 0 && time > fellAt && !(s.flags & FLAG_AIR) && s.respawn === 0) {
          landed = time;
          break;
        }
      }
      expect(fellAt).toBeGreaterThanOrEqual(e.period + e.split);
      expect(landed).toBeGreaterThan(fellAt);
      projectOnTrack(t, s.x, s.z, s.seg);
      for (const d of [-KART_RADIUS, 0, KART_RADIUS]) expect(holeAt(t, proj.seg, proj.lat + d, landed)).toBe(false);
    }
  });

  it('das Aquädukt stürzt Jetzt von vorn nach hinten ein – wer im letzten Augenblick auffährt, schafft es – und steht Einst wieder', () => {
    const t = setTrack(RUINE);
    const e = t.era!;
    const b = t.branches[AQUAEDUKT];
    const gate = t.gates.find((g) => t.branchOf[g.first] === AQUAEDUKT)!;
    const pieces = t.holes.filter((h) => t.branchOf[h.first] === AQUAEDUKT).sort((x, y) => x.first - y.first);
    expect(pieces.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < pieces.length; i++) {
      expect(pieces[i].lat0).toBeLessThanOrEqual(-t.wh[pieces[i].first]);
      expect(pieces[i].lat1).toBeGreaterThanOrEqual(t.wh[pieces[i].first]);
      // jedes Stück bricht erst nach dem Sprung der Zeit, das nächste später als das vorige
      expect(pieces[i].plan.spans[0]).toBeGreaterThan(e.split + 30);
      if (i > 0) expect(pieces[i].plan.spans[0]).toBeGreaterThan(pieces[i - 1].plan.spans[0]);
      // … und Einst ist es wieder da.
      const mid = pieces[i].first + Math.floor(pieces[i].count / 2);
      expect(holeAt(t, mid, 0, e.period + 10)).toBe(false);
      expect(holeAt(t, mid, 0, e.period - 10)).toBe(true);
    }
    for (const level of [AI_HARD, AI_EASY]) {
      const s = gridState(0);
      Object.assign(s, at(gate.first + gate.count + 1, 0, 20));
      const brain = newBrain(0, level);
      brain.route = 1 << AQUAEDUKT;
      brain.routeLock = true;
      let falls = 0;
      let across = false;
      for (let i = 0; i < 60 * 12 && !across; i++) {
        const time = e.split + i;
        const cmd = botCmd(s, brain, [], true, { tick: time, time, place: 1, smoke: false });
        const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time });
        if (ev & EV_FALL) falls++;
        if (t.branchOf[s.seg] < 0 && s.seg >= b.to) across = true;
      }
      expect(falls).toBe(0);
      expect(across).toBe(true);
    }
  });

  it('die KI fährt drei Runden durch beide Zeitalter – fast ohne Sturz, und nie durch ein geschlossenes Tor', () => {
    const t = setTrack(RUINE);
    let falls = 0;
    const used = [0, 0];
    const wrong = [0, 0];
    const gates = [KAMMER, AQUAEDUKT].map((k) => t.gates.find((g) => t.branchOf[g.first] === k)!);
    for (let slot = 0; slot < 4; slot++) {
      for (const level of [AI_HARD, AI_EASY]) {
        const s = gridState(slot);
        const brain = newBrain(slot + (level === AI_HARD ? 0 : 4), level);
        // Die Karts stehen hinter der Linie: die erste Überfahrt ist der Start, nicht das Ende einer Runde.
        let laps = -1;
        let before = s.seg;
        const was = [false, false];
        for (let tick = 1; tick < 60 * 260 && laps < 3; tick++) {
          const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
          const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
          if (ev & EV_FALL) falls++;
          for (const k of [KAMMER, AQUAEDUKT]) {
            const inside = t.branchOf[s.seg] === k && t.twin[s.seg] < 0;
            // gezählt wird der Augenblick, in dem das Kart die Mündung hinter sich lässt
            if (inside && !was[k]) {
              used[k]++;
              if (planActive(gates[k].plan, tick)) wrong[k]++;
            }
            was[k] = inside;
          }
          if (t.branchOf[s.seg] < 0 && t.branchOf[before] < 0 && before > t.n - 40 && s.seg < 40) laps++;
          before = s.seg;
        }
        expect(laps).toBe(3);
      }
    }
    console.log(`Zeitriss-Ruine, KI in 24 Runden: Schatzkammer ${used[KAMMER]}-mal, Aquädukt ${used[AQUAEDUKT]}-mal, Stürze ${falls}`);
    expect(wrong).toEqual([0, 0]);
    expect(used[KAMMER]).toBeGreaterThan(2);
    expect(used[AQUAEDUKT]).toBeGreaterThan(2);
    expect(falls).toBeLessThanOrEqual(5);
  });
});

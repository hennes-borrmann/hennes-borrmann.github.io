// Sturmhafen: Böen und Pontons (mechanics.ts, sim.ts).

import { afterAll, describe, expect, it } from 'vitest';
import { AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { PONTOON_LINK, WIND_RISE, gustStrength, gustWarning, pontoonLift } from '../../src/game/mechanics';
import { BTN_GAS, EV_FALL, EV_TAKEOFF, EV_WIND, FLAG_AIR, gridState, stepKart, windPush, type KartState } from '../../src/game/sim';
import { EDGE_FLOAT, TRACK, TRACK_COUNT, getTrack, groundAt, groundNow, heaveAt, proj, projectOnTrack, rightX, rightZ, setTrack, trackHeading } from '../../src/game/track';

const HAFEN = 8;

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

/** Rennzeit, zu der die Böe w gerade mit voller Stärke weht. */
function fullGust(w: { period: number; phase: number; on: number }): number {
  return w.period - w.phase + Math.round(w.on / 2);
}

describe('Sturmhafen: Böen', () => {
  it('nur der Sturmhafen hat Wind und Pontons', () => {
    for (let i = 0; i < TRACK_COUNT; i++) {
      const t = getTrack(i);
      if (i === HAFEN) {
        expect(t.def.name).toBe('Sturmhafen');
        expect(t.winds.length).toBeGreaterThanOrEqual(4);
        expect(t.pontoons.length).toBeGreaterThanOrEqual(5);
      } else {
        expect(t.winds.length).toBe(0);
        expect(t.pontoons.length).toBe(0);
        for (let k = 0; k < t.total; k++) expect(t.edge[k] & EDGE_FLOAT).toBe(0);
      }
    }
  });

  it('eine Böe schwillt an und ab – nie ein Sprung – und kündigt sich an', () => {
    const t = setTrack(HAFEN);
    for (const w of t.winds) {
      let before = gustStrength(w, 0);
      let peak = 0;
      let warned = 0;
      for (let time = 1; time <= w.period * 2; time++) {
        const k = gustStrength(w, time);
        expect(Math.abs(k - before)).toBeLessThanOrEqual(1 / WIND_RISE + 1e-9);
        before = k;
        peak = Math.max(peak, k);
        if (gustWarning(w, time) > 0) {
          warned++;
          // Während der Ankündigung weht sie noch nicht.
          expect(k).toBe(0);
        }
      }
      expect(peak).toBe(1);
      expect(warned).toBeGreaterThanOrEqual(2 * 30);
      // Zwischen den Böen ist es eine Weile ruhig.
      expect(w.period - w.on).toBeGreaterThanOrEqual(60);
    }
  });

  it('in der Böe wird ein stehendes Kart zur Seite geschoben, in der Flaute nicht', () => {
    const t = setTrack(HAFEN);
    const w = t.winds[1];
    const seg = w.first + Math.floor(w.count / 2);
    const time = fullGust(w);
    expect(gustStrength(w, time)).toBe(1);
    expect(windPush(t, seg, 0, 0, time)).toBeCloseTo(w.push, 6);
    // 30 Ticks volle Böe: Schub × halbe Sekunde
    const s = at(seg);
    let ev = 0;
    for (let i = 0; i < 30; i++) ev |= stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: time - 15 + i });
    projectOnTrack(t, s.x, s.z, s.seg);
    expect(proj.lat).toBeGreaterThan(Math.abs(w.push) * 0.5 * 0.85 * Math.sign(w.push) - 0.01);
    expect(Math.abs(proj.lat)).toBeLessThan(Math.abs(w.push) * 0.5 * 1.05);
    expect(ev & EV_WIND).toBeTruthy();
    // Flaute
    const calm = at(seg);
    const quiet = w.period - w.phase + w.on + 20;
    expect(gustStrength(w, quiet)).toBe(0);
    for (let i = 0; i < 30; i++) stepKart(calm, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: quiet + i });
    projectOnTrack(t, calm.x, calm.z, calm.seg);
    expect(Math.abs(proj.lat)).toBeLessThan(0.01);
    // Vor dem Start und nach dem Ziel bläst nichts vom Fleck.
    const parked = at(seg);
    for (let i = 0; i < 30; i++) stepKart(parked, { steer: 0, buttons: 0 }, { canDrive: false, speedFactor: 1, time: time - 15 + i });
    projectOnTrack(t, parked.x, parked.z, parked.seg);
    expect(Math.abs(proj.lat)).toBeLessThan(0.01);
  });

  it('im Windschatten der Container kommt die Böe nicht an; an seinem Rand läuft sie stetig aus', () => {
    const t = setTrack(HAFEN);
    const w = t.winds.find((x) => x.lee.length > 0)!;
    const lee = w.lee[0];
    const time = fullGust(w);
    const mid = Math.round((lee.first + lee.last) / 2);
    const inside = (lee.lat0 + lee.lat1) / 2;
    expect(windPush(t, mid, 0, inside, time)).toBe(0);
    expect(windPush(t, mid, 0, lee.lat1 + 3, time)).toBeCloseTo(w.push, 6);
    // quer über die Kante des Schattens: nirgends ein Sprung
    let before = windPush(t, mid, 0, lee.lat1 - 3, time);
    for (let lat = lee.lat1 - 3; lat <= lee.lat1 + 3; lat += 0.05) {
      const now = windPush(t, mid, 0, lat, time);
      expect(Math.abs(now - before)).toBeLessThan(Math.abs(w.push) * 0.06);
      before = now;
    }
    // längs durch die ganze Böe samt Windschatten: nirgends ein Sprung von Abschnitt zu Abschnitt
    before = windPush(t, w.first - 2 < 0 ? 0 : w.first - 2, 0, inside, time);
    for (let seg = w.first - 2; seg < w.first + w.count + 2; seg++) {
      const now = windPush(t, seg, 0, inside, time);
      expect(Math.abs(now - before)).toBeLessThan(Math.abs(w.push) * 0.3);
      before = now;
    }
  });
});

describe('Sturmhafen: Pontons', () => {
  it('ein Ponton hebt und senkt sich um seinen Ausschlag; die Übergänge sind stetig', () => {
    const t = setTrack(HAFEN);
    for (const p of t.pontoons) {
      const mid = p.first + Math.floor(p.count / 2);
      let lo = Infinity;
      let hi = -Infinity;
      for (let time = 0; time < p.period; time++) {
        const h = heaveAt(t, mid, 0, time);
        expect(h).toBeCloseTo(pontoonLift(p, time), 6);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
        expect(groundNow(t, mid, 0, 0, time)).toBeCloseTo(groundAt(t, mid, 0, 0) + h, 9);
      }
      expect(hi).toBeGreaterThan(p.amp * 0.99);
      expect(lo).toBeLessThan(-p.amp * 0.99);
    }
    // Entlang jedes Wegs, zu vielen Zeiten: von Abschnitt zu Abschnitt höchstens die Steigung eines Übergangs.
    const steepest = (2 * Math.max(...t.pontoons.map((p) => p.amp))) / PONTOON_LINK;
    for (let time = 0; time < 600; time += 7) {
      for (let seg = 0; seg < t.total; seg++) {
        if ((t.edge[seg] & EDGE_FLOAT) === 0 && (t.edge[t.next[seg]] & EDGE_FLOAT) === 0) {
          expect(heaveAt(t, seg, 0, time)).toBe(0);
          continue;
        }
        const d = Math.abs(heaveAt(t, t.next[seg], 0, time) - heaveAt(t, seg, 0, time));
        expect(d).toBeLessThanOrEqual(steepest * t.step * 1.15);
      }
    }
  });

  it('ein stehendes Kart macht den Seegang mit, ohne abzuheben oder einzusinken', () => {
    const t = setTrack(HAFEN);
    const p = t.pontoons[0];
    const seg = p.first + Math.floor(p.count / 2);
    const s = at(seg);
    let air = 0;
    for (let time = 0; time < p.period * 2; time++) {
      stepKart(s, { steer: 0, buttons: 0 }, { canDrive: false, speedFactor: 1, time });
      if (time > 5) {
        if (s.flags & FLAG_AIR) air++;
        projectOnTrack(t, s.x, s.z, s.seg);
        expect(Math.abs(s.y - groundNow(t, s.seg, proj.along, proj.lat, time))).toBeLessThan(0.12);
      }
    }
    // Am oberen Umkehrpunkt löst es sich höchstens für Augenblicke.
    expect(air).toBeLessThan(p.period * 2 * 0.15);
  });

  it('wer mit Tempo über die Kette fährt, hebt an den Kämmen ab – und die KI kommt trotzdem fast immer hinüber', () => {
    const t = setTrack(HAFEN);
    let jumps = 0;
    let runs = 0;
    let falls = 0;
    // Zu acht verschiedenen Zeiten losfahren: jedes Mal steht der Seegang anders.
    for (let start = 0; start < 8; start++) {
      const s = gridState(0);
      const brain = newBrain(0, AI_HARD);
      brain.route = 1;
      brain.routeLock = true;
      let onChain = 0;
      for (let tick = 1; tick < 60 * 60 && onChain < 2; tick++) {
        const time = tick + start * 37;
        const cmd = botCmd(s, brain, [], true, { tick, time, place: 1, smoke: false });
        const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time });
        if (ev & EV_FALL) falls++;
        const float = t.branchOf[s.seg] === 0 && (t.edge[s.seg] & EDGE_FLOAT) !== 0;
        if (float) {
          onChain = 1;
          if (ev & EV_TAKEOFF) jumps++;
        } else if (onChain === 1) onChain = 2;
      }
      expect(onChain).toBe(2);
      runs++;
    }
    console.log(`Pontonkette: ${jumps} Abheber und ${falls} Stürze in ${runs} Überfahrten`);
    expect(jumps).toBeGreaterThanOrEqual(runs);
    // Die Kette ist die riskante Abkürzung: ein Sturz kommt vor, aber nicht bei jeder zweiten Überfahrt.
    expect(falls).toBeLessThanOrEqual(1);
  });

  it('Gas geben auf dem schwankenden Ponton: das Kart bleibt in der Spur und fällt nicht durch', () => {
    const t = setTrack(HAFEN);
    const p = t.pontoons[t.pontoons.length - 1];
    const s = at(p.first + 2, 0, 12);
    for (let time = 0; time < 50; time++) {
      const ev = stepKart(s, { steer: 0, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: time + 400 });
      expect(ev & EV_FALL).toBe(0);
      projectOnTrack(t, s.x, s.z, s.seg);
      expect(s.y).toBeGreaterThan(groundNow(t, s.seg, proj.along, proj.lat, time + 400) - 0.05);
    }
  });
});

// Magnetwerk: Magnettrommel (mechanics.ts: Drum, DRUM_SAG, DRUM_GRIP; track.ts: roll, drumPoint; sim.ts) und
// Deckenplatten, die im Takt abschalten (Bruchstellen mit wiederkehrendem Plan).

import { afterAll, describe, expect, it } from 'vitest';
import { AI_EASY, AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import { planActive } from '../../src/game/mechanics';
import { EV_FALL, FLAG_AIR, gridState, stepKart, type KartState } from '../../src/game/sim';
import { EDGE_DRUM, TRACK, TRACK_COUNT, addProgress, drumPoint, getTrack, proj, progDelta, projectOnTrack, rightX, rightZ, setTrack, trackHeading } from '../../src/game/track';

const MAGNET = 17;

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

const lat = (s: KartState): number => {
  projectOnTrack(TRACK, s.x, s.z, s.seg);
  return proj.lat;
};

describe('Magnettrommel', () => {
  it('nur das Magnetwerk hat eine Trommel: die Bahn schraubt sich einmal ganz herum – Wand, Decke, Wand', () => {
    for (let i = 0; i < TRACK_COUNT; i++) {
      const t = getTrack(i);
      if (i !== MAGNET) {
        expect(t.drums.length).toBe(0);
        for (let k = 0; k < t.total; k++) expect(t.roll[k]).toBe(0);
        continue;
      }
      expect(t.drums.length).toBe(1);
      const d = t.drums[0];
      const r = (k: number): number => t.roll[d.first + k];
      expect(r(0)).toBeCloseTo(0, 5);
      expect(r(d.count - 1)).toBeCloseTo(2 * Math.PI, 5);
      let wallR = 0;
      let ceiling = 0;
      let wallL = 0;
      let jump = 0;
      for (let k = 0; k < d.count; k++) {
        expect(t.edge[d.first + k] & EDGE_DRUM).not.toBe(0);
        if (Math.abs(r(k) - Math.PI / 2) < 0.1) wallR++;
        if (Math.abs(r(k) - Math.PI) < 0.01) ceiling++;
        if (Math.abs(r(k) - 1.5 * Math.PI) < 0.1) wallL++;
        if (k > 0) jump = Math.max(jump, Math.abs(r(k) - r(k - 1)));
        // stetig und nie rückwärts
        if (k > 0) expect(r(k)).toBeGreaterThanOrEqual(r(k - 1) - 1e-9);
      }
      expect(wallR).toBeGreaterThan(8);
      expect(wallL).toBeGreaterThan(8);
      expect(ceiling * t.step).toBeGreaterThan(80);
      // höchstens gut 2,5° je Meter: in einer Sekunde Fahrt dreht sich die Welt um eine Vierteldrehung, nicht mehr
      expect(jump).toBeLessThan(0.05);
      // drumPoint: der Punkt der Halle unter dem Winkel der Bahn liegt auf der Bahn, der gegenüber 2 R darüber
      const P = { x: 0, y: 0, z: 0 };
      const seg = d.first + Math.round(d.count / 3);
      drumPoint(t, seg, t.roll[seg], d.radius, d.radius, P);
      expect(Math.hypot(P.x - t.px[seg], P.y - t.py[seg], P.z - t.pz[seg])).toBeLessThan(1e-6);
      drumPoint(t, seg, t.roll[seg] + Math.PI, d.radius, d.radius, P);
      expect(P.y - t.py[seg]).toBeCloseTo(2 * d.radius, 6);
    }
  });

  it('an der rechten Wand sackt man nach links ab, an der linken nach rechts – unten und an der Decke nicht', () => {
    const t = setTrack(MAGNET);
    const d = t.drums[0];
    const find = (want: number): number => {
      let best = d.first;
      for (let k = 0; k < d.count; k++) if (Math.abs(t.roll[d.first + k] - want) < Math.abs(t.roll[best] - want)) best = d.first + k;
      return best;
    };
    const drift = (seg: number): number => {
      const s = at(seg, 0, 18);
      const l0 = lat(s);
      for (let k = 1; k <= 60; k++) stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: 4000 + k });
      return lat(s) - l0;
    };
    const right = drift(find(Math.PI / 2));
    const left = drift(find(1.5 * Math.PI));
    const top = drift(find(Math.PI));
    console.log(`Magnettrommel, eine Sekunde ohne Lenken: rechte Wand ${right.toFixed(2)} m, Decke ${top.toFixed(2)} m, linke Wand ${left.toFixed(2)} m`);
    expect(right).toBeLessThan(-2);
    expect(left).toBeGreaterThan(2);
    expect(Math.abs(top)).toBeLessThan(0.5);
  });

  it('Deckenplatten schalten im Takt ab – links und rechts nie zugleich; wer auf einer abgeschalteten steht, fällt', () => {
    const t = setTrack(MAGNET);
    const plates = t.holes.filter((h) => (t.edge[h.first] & EDGE_DRUM) !== 0);
    expect(plates.length).toBe(6);
    for (const h of plates) {
      // an der Decke
      expect(Math.abs(t.roll[h.first] - Math.PI)).toBeLessThan(0.01);
      const twin = plates.find((g) => g !== h && g.first === h.first)!;
      let off = 0;
      for (let time = 0; time < 360; time++) {
        expect(planActive(h.plan, time) && planActive(twin.plan, time)).toBe(false);
        if (planActive(h.plan, time)) off++;
      }
      expect(off).toBe(120);
    }
    // Wer durch eine Platte fällt, wird vor allen Platten aufgesetzt – nie auf einer anderen
    const firstPlate = Math.min(...plates.map((h) => h.first));
    for (const h of plates) for (let k = 0; k < h.count; k++) expect(t.respawn[h.first + k]).toBeLessThan(firstPlate);
    // Anna steht mitten auf einer Platte, die gleich abschaltet: Sie fällt
    const h = plates[0];
    let time = 1;
    while (planActive(h.plan, time) || !planActive(h.plan, time + 30)) time++;
    const s = at(h.first + Math.floor(h.count / 2), (Math.max(h.lat0, -6) + h.lat1) / 2, 0);
    let fell = false;
    for (let k = 0; k < 90 && !fell; k++) if (stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: time + k }) & EV_FALL) fell = true;
    expect(fell).toBe(true);
  });

  it('die KI fährt durch die Trommel: alle schaffen drei Runden, die gute fällt kaum je durch eine Platte', () => {
    const t = setTrack(MAGNET);
    const falls = [0, 0, 0];
    const time = [0, 0, 0];
    for (let slot = 0; slot < 4; slot++) {
      for (const level of [AI_EASY, AI_MEDIUM, AI_HARD]) {
        const s = gridState(slot);
        const brain = newBrain(slot + level * 4, level);
        let progress = progDelta(t, 0, s.seg);
        let tick = 1;
        for (; tick < 60 * 300 && progress < 3 * t.n; tick++) {
          const before = s.seg;
          const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
          const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
          if (ev & EV_FALL && (t.edge[before] & EDGE_DRUM) !== 0) falls[level]++;
          progress = addProgress(t, progress, before, s.seg);
          expect(Number.isFinite(s.x) && !(s.flags & FLAG_AIR && s.y > 200)).toBe(true);
        }
        expect(progress).toBeGreaterThanOrEqual(3 * t.n);
        time[level] += tick / 60 / 3;
      }
    }
    console.log(`Magnetwerk, KI in je 12 Runden: Stürze in der Trommel leicht/mittel/schwer ${falls.join('/')}; Rundenzeit ${time.map((x) => (x / 4).toFixed(1)).join('/')} s`);
    expect(falls[2]).toBeLessThanOrEqual(2);
    expect(falls[0]).toBeLessThanOrEqual(8);
  }, 120000);
});

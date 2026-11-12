// Dschungel-Fluss: Flöße als treibender Boden (mechanics.ts: River, RaftLane; track.ts: raftLane, groundNow; sim.ts; ai.ts).

import { afterAll, describe, expect, it } from 'vitest';
import { AI_EASY, AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { raftAt, raftDrift, type RaftLane } from '../../src/game/mechanics';
import { EV_FALL, FLAG_AIR, gridState, stepKart, type KartState } from '../../src/game/sim';
import { EDGE_DECK, EDGE_OPEN_L, EDGE_OPEN_R, EDGE_RIVER, NO_GROUND, TRACK, TRACK_COUNT, getTrack, groundAt, groundNow, proj, projectOnTrack, raftLane, rightX, rightZ, riverOf, setTrack, trackHeading } from '../../src/game/track';
import { withoutMechanics } from './helpers';

const FLUSS = 12;

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

/** Meter ab Flussanfang, an denen in der Bahn l zur Zeit time ein Floß beginnt (das erste ab a0). */
function raftStart(l: RaftLane, a0: number, time: number): number {
  const pitch = l.length + l.gap;
  const base = l.phase + raftDrift(l, time);
  return base + Math.ceil((a0 - base) / pitch) * pitch;
}

describe('Flöße', () => {
  const l: RaftLane = { lat0: 2, lat1: 8, length: 30, gap: 12, speed: 6, phase: 5 };

  it('eine Bahn ist ein Muster aus Floß und Lücke, das mit der Strömung treibt', () => {
    // zur Zeit 0: Flöße bei 5 … 35, 47 … 77, …
    expect(raftAt(l, 5, 0)).toBe(true);
    expect(raftAt(l, 34.9, 0)).toBe(true);
    expect(raftAt(l, 35.1, 0)).toBe(false);
    expect(raftAt(l, 46.9, 0)).toBe(false);
    expect(raftAt(l, 47.1, 0)).toBe(true);
    expect(raftAt(l, 4.9, 0)).toBe(false);
    // nach einer Sekunde ist alles 6 m weiter
    expect(raftDrift(l, 60)).toBe(6);
    for (const a of [0, 5, 20, 35.1, 46, 60, 100]) expect(raftAt(l, a + 6, 60)).toBe(raftAt(l, a, 0));
    // vor dem Start liegen die Flöße still
    for (const a of [0, 20, 40]) expect(raftAt(l, a, -300)).toBe(raftAt(l, a, 0));
    // eine Kette ohne Lücke trägt immer
    const chain: RaftLane = { ...l, gap: 0 };
    for (const a of [-3, 0, 17, 999]) expect(raftAt(chain, a, 1234)).toBe(true);
  });
});

describe('Dschungel-Fluss', () => {
  it('nur er hat einen Fluss: offen, ohne Bande, und wer hineinfällt, wird davor aufgesetzt', () => {
    for (let i = 0; i < TRACK_COUNT; i++) {
      const t = getTrack(i);
      if (i !== FLUSS) {
        expect(t.rivers.length).toBe(0);
        for (let k = 0; k < t.total; k++) expect(t.edge[k] & EDGE_RIVER).toBe(0);
        continue;
      }
      expect(t.def.name).toBe('Dschungel-Fluss');
      expect(t.rivers.length).toBe(1);
      const r = t.rivers[0];
      expect(r.count * t.step).toBeGreaterThan(140);
      expect(r.lanes.length).toBe(3);
      for (let k = 0; k < t.total; k++) {
        const on = k >= r.first && k < r.first + r.count;
        expect((t.edge[k] & EDGE_RIVER) !== 0).toBe(on);
        if (!on) continue;
        expect(riverOf(t, k)).toBe(r);
        expect(t.edge[k] & EDGE_OPEN_L).toBeTruthy();
        expect(t.edge[k] & EDGE_OPEN_R).toBeTruthy();
        expect(t.edge[k] & EDGE_DECK).toBeTruthy();
        // Aufsetzpunkt: festes Land vor dem Fluss
        expect(t.respawn[k]).toBeLessThan(r.first);
        expect(t.edge[t.respawn[k]] & EDGE_RIVER).toBe(0);
      }
      // Die Bahnen liegen lückenlos nebeneinander über die ganze Breite; die mittlere ist eine Kette.
      const lanes = [...r.lanes].sort((a, b) => a.lat0 - b.lat0);
      expect(lanes[0].lat0).toBeCloseTo(-t.wh[r.first + 5], 1);
      expect(lanes[2].lat1).toBeCloseTo(t.wh[r.first + 5], 1);
      for (let n = 1; n < lanes.length; n++) expect(lanes[n].lat0).toBeCloseTo(lanes[n - 1].lat1, 6);
      expect(lanes[1].gap).toBe(0);
      // Außen ist die Strömung deutlich schneller als in der Mitte.
      expect(Math.min(lanes[0].speed, lanes[2].speed)).toBeGreaterThan(lanes[1].speed * 1.6);
    }
  });

  it('Boden ist genau dort, wo ein Floß liegt', () => {
    const t = setTrack(FLUSS);
    const r = t.rivers[0];
    for (const time of [0, 137, 2000, 9000]) {
      for (let seg = r.first; seg < r.first + r.count; seg += 3) {
        const a = (seg - r.first) * t.step;
        for (const l of r.lanes) {
          const lat = (l.lat0 + l.lat1) / 2;
          const raft = raftAt(l, a, time);
          expect(raftLane(t, seg, 0, lat, time)).toBe(raft ? l : null);
          if (raft) expect(groundNow(t, seg, 0, lat, time)).toBeCloseTo(groundAt(t, seg, 0, lat), 9);
          else expect(groundNow(t, seg, 0, lat, time)).toBe(NO_GROUND);
        }
        // die Kette in der Mitte trägt immer
        expect(groundNow(t, seg, 0, 0, time)).not.toBe(NO_GROUND);
        // neben dem Fluss ist nichts
        expect(groundNow(t, seg, 0, t.wh[seg] + 1, time)).toBe(NO_GROUND);
      }
    }
    // Ohne Mechanik (so messen die Tests den bloßen Verlauf) trägt die ganze Fläche.
    withoutMechanics(() => {
      for (let seg = r.first; seg < r.first + r.count; seg += 5) for (const lat of [-6, 0, 6]) expect(groundNow(t, seg, 0, lat, 500)).not.toBe(NO_GROUND);
    });
  });

  it('ein Floß nimmt mit, was auf ihm steht – flussab, mit dem Tempo seiner Bahn', () => {
    const t = setTrack(FLUSS);
    const r = t.rivers[0];
    const time0 = 600;
    for (const l of r.lanes) {
      const lat = (l.lat0 + l.lat1) / 2;
      // mitten auf ein Floß im vorderen Teil des Flusses
      const a = l.gap > 0 ? raftStart(l, 20, time0) + l.length / 2 : 30;
      const seg = r.first + Math.round(a / t.step);
      expect(raftLane(t, seg, 0, lat, time0)).toBe(l);
      const s = at(seg, lat);
      const x0 = s.x;
      const z0 = s.z;
      let air = 0;
      for (let i = 0; i < 120; i++) {
        const ev = stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: time0 + i });
        expect(ev & EV_FALL).toBe(0);
        if (s.flags & FLAG_AIR) air++;
      }
      // zwei Sekunden: 2 × Tempo der Bahn (der Fluss ist leicht gebogen – gemessen wird die Strecke)
      const moved = Math.hypot(s.x - x0, s.z - z0);
      expect(moved).toBeGreaterThan(l.speed * 2 * 0.93);
      expect(moved).toBeLessThan(l.speed * 2 * 1.05);
      // und es steht noch auf demselben Floß
      projectOnTrack(t, s.x, s.z, s.seg);
      expect(raftLane(t, proj.seg, proj.along, proj.lat, time0 + 120)).toBe(l);
      expect(air).toBeLessThan(10);
    }
  });

  it('wer in eine Lücke gerät, geht unter und wird vor dem Fluss wieder aufgesetzt', () => {
    const t = setTrack(FLUSS);
    const r = t.rivers[0];
    const time0 = 900;
    for (const l of r.lanes) {
      if (l.gap <= 0) continue;
      const a = raftStart(l, 30, time0) - l.gap / 2;
      const seg = r.first + Math.round(a / t.step);
      const lat = (l.lat0 + l.lat1) / 2;
      expect(raftLane(t, seg, 0, lat, time0)).toBeNull();
      const s = at(seg, lat);
      let fell = false;
      let landed = -1;
      for (let i = 0; i < 60 * 8; i++) {
        const ev = stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: time0 + i });
        if (ev & EV_FALL) fell = true;
        if (fell && !(s.flags & FLAG_AIR) && s.respawn === 0) {
          landed = i;
          break;
        }
      }
      expect(fell).toBe(true);
      expect(landed).toBeGreaterThan(0);
      projectOnTrack(t, s.x, s.z, s.seg);
      expect(t.edge[proj.seg] & EDGE_RIVER).toBe(0);
      expect(proj.seg).toBeLessThan(r.first);
    }
  });

  it('die KI kommt über den Fluss: die vorsichtige bleibt auf der Kette, die gute nutzt die schnelle Strömung', () => {
    const t = setTrack(FLUSS);
    const r = t.rivers[0];
    const side = [0, 0];
    const ticks = [0, 0];
    let falls = 0;
    for (let slot = 0; slot < 4; slot++) {
      for (const level of [AI_HARD, AI_EASY]) {
        const n = level === AI_HARD ? 0 : 1;
        const s = gridState(slot);
        const brain = newBrain(slot + n * 4, level);
        let laps = -1;
        let before = s.seg;
        for (let tick = 1; tick < 60 * 280 && laps < 3; tick++) {
          const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
          const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
          if (ev & EV_FALL) falls++;
          if (s.seg >= r.first && s.seg < r.first + r.count && !(s.flags & FLAG_AIR)) {
            projectOnTrack(t, s.x, s.z, s.seg);
            ticks[n]++;
            if (Math.abs(proj.lat) > 2.6) side[n]++;
          }
          if (t.branchOf[s.seg] < 0 && t.branchOf[before] < 0 && before > t.n - 40 && s.seg < 40) laps++;
          before = s.seg;
        }
        expect(laps).toBe(3);
      }
    }
    console.log(`Dschungel-Fluss, KI in 24 Runden: ${falls} Stürze; Anteil der Flusszeit auf den schnellen Außenbahnen: schwer ${((side[0] / ticks[0]) * 100).toFixed(0)} %, leicht ${((side[1] / ticks[1]) * 100).toFixed(0)} %`);
    expect(falls).toBeLessThanOrEqual(3);
    // Die leichte KI bleibt in der Mitte, die schwere fährt einen guten Teil außen.
    expect(side[1] / ticks[1]).toBeLessThan(0.15);
    expect(side[0] / ticks[0]).toBeGreaterThan(0.3);
  });
});

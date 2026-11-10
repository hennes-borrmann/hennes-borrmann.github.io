import { afterAll, describe, expect, it } from 'vitest';
import { AI_EASY, AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import {
  EV_FALL,
  EV_LAND,
  EV_PAD,
  EV_TAKEOFF,
  EV_TURBO,
  EV_WALL,
  FLAG_AIR,
  FLAG_OFFROAD,
  gridState,
  stepKart,
} from '../../src/game/sim';
import { EDGE_GAP, EDGE_OPEN_L, EDGE_OPEN_R, NO_GROUND, TRACK, TRACK_COUNT, getTrack, groundAt, segDelta, setTrack } from '../../src/game/track';

afterAll(() => {
  setTrack(0);
});

/** Ein KI-Fahrer allein auf der aktiven Strecke. */
function soloRun(slot: number, laps: number, level: number) {
  const s = gridState(slot);
  const brain = newBrain(slot, level);
  let progress = segDelta(TRACK, 0, s.seg);
  const lapTimes: number[] = [];
  let lapStart = 0;
  let tick = 0;
  let falls = 0;
  let wallHits = 0;
  let jumps = 0;
  let landings = 0;
  let airTicks = 0;
  let offroad = 0;
  let turbos = 0;
  let pads = 0;
  let maxSpeed = 0;
  const limit = laps * 90 * 60;
  while (lapTimes.length < laps && tick < limit) {
    tick++;
    const cmd = botCmd(s, brain, [], true, { tick, place: 1, smoke: false });
    const before = s.seg;
    const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill });
    progress += segDelta(TRACK, before, s.seg);
    if (ev & EV_FALL) falls++;
    if (ev & EV_WALL) wallHits++;
    if (ev & EV_TAKEOFF) jumps++;
    if (ev & EV_LAND) landings++;
    if (ev & EV_TURBO) turbos++;
    if (ev & EV_PAD) pads++;
    if (s.flags & FLAG_AIR) airTicks++;
    if (s.flags & FLAG_OFFROAD) offroad++;
    maxSpeed = Math.max(maxSpeed, Math.hypot(s.vx, s.vz));
    expect(Number.isFinite(s.x + s.y + s.z + s.vx + s.vy + s.vz + s.heading)).toBe(true);
    if (progress >= (lapTimes.length + 1) * TRACK.n) {
      lapTimes.push((tick - lapStart) / 60);
      lapStart = tick;
    }
  }
  return { lapTimes, falls, wallHits, jumps, landings, air: airTicks / 60, offroad: offroad / 60, turbos, pads, maxSpeed };
}

describe('Alle Strecken', () => {
  for (let ti = 0; ti < TRACK_COUNT; ti++) {
    const name = getTrack(ti).def.name;

    it(`${name}: geschlossen, Höhen stetig, Start auf festem Boden`, () => {
      const t = setTrack(ti);
      expect(t.index).toBe(ti);
      expect(t.n).toBeGreaterThan(500);
      expect(t.boxes.length).toBeLessThanOrEqual(32);
      for (let i = 0; i < t.n; i++) {
        const j = (i + 1) % t.n;
        expect(Math.abs(Math.hypot(t.px[j] - t.px[i], t.pz[j] - t.pz[i]) - t.step)).toBeLessThan(0.05);
        expect(t.wh[i]).toBeGreaterThan(t.rh[i]);
        // Wo ein abgestürztes Kart aufgesetzt wird, muss Fahrbahn sein.
        expect(t.edge[t.respawn[i]] & EDGE_GAP).toBe(0);
      }
      for (let slot = 0; slot < 4; slot++) {
        const g = gridState(slot);
        expect(groundAt(t, g.seg, 0, 0)).not.toBe(NO_GROUND);
        expect(t.edge[g.seg] & (EDGE_GAP | EDGE_OPEN_L | EDGE_OPEN_R)).toBe(0);
      }
      for (const b of t.boxes) expect(t.edge[b.seg] & EDGE_GAP).toBe(0);
    });

    for (const level of [AI_EASY, AI_MEDIUM, AI_HARD]) {
      it(`${name}: alle vier KI-Fahrer schaffen drei Runden (Stärke ${level})`, () => {
        setTrack(ti);
        const lines: string[] = [];
        for (let slot = 0; slot < 4; slot++) {
          const r = soloRun(slot, 3, level);
          lines.push(
            `  Fahrer ${slot + 1}: ${r.lapTimes.map((x) => x.toFixed(1)).join(' / ')} s · Stürze ${r.falls} · Bande ${r.wallHits} · Sprünge ${r.jumps} (${r.air.toFixed(1)} s Luft) · Grün ${r.offroad.toFixed(1)} s · Turbos ${r.turbos} · Felder ${r.pads} · Spitze ${r.maxSpeed.toFixed(0)} m/s`,
          );
          expect(r.lapTimes.length).toBe(3);
          for (const lap of r.lapTimes) expect(lap).toBeLessThan(70);
          // Die KI darf nicht in jeder Runde abstürzen oder dauernd anecken.
          expect(r.falls).toBeLessThanOrEqual(1);
          expect(r.wallHits).toBeLessThanOrEqual(4);
        }
        console.log(`${name}, Stärke ${level}\n${lines.join('\n')}`);
      });
    }
  }
});

import { afterAll, describe, expect, it } from 'vitest';
import { AI_EASY, AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import {
  EV_FALL,
  EV_FLAT,
  EV_HIT,
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
import { withoutMechanics } from './helpers';

afterAll(() => {
  setTrack(0);
});

/** Ein KI-Fahrer allein auf der aktiven Strecke. */
function soloRun(slot: number, laps: number, level: number, route = -1) {
  const s = gridState(slot);
  const brain = newBrain(slot, level);
  if (route >= 0) {
    brain.route = route;
    brain.routeLock = true;
  }
  const onBranch = [0, 0];
  let progress = segDelta(TRACK, 0, s.seg);
  const lapTimes: number[] = [];
  let lapStart = 0;
  let tick = 0;
  let falls = 0;
  let hits = 0;
  let flats = 0;
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
    const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
    const before = s.seg;
    const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
    progress += segDelta(TRACK, before, s.seg);
    if (ev & EV_FALL) falls++;
    if (ev & EV_HIT) hits++;
    if (ev & EV_FLAT) flats++;
    if (ev & EV_WALL) wallHits++;
    if (ev & EV_TAKEOFF) jumps++;
    if (ev & EV_LAND) landings++;
    if (ev & EV_TURBO) turbos++;
    if (ev & EV_PAD) pads++;
    if (s.flags & FLAG_AIR) airTicks++;
    if (s.flags & FLAG_OFFROAD) offroad++;
    // Nur wo die Abzweigung schon eine eigene Fahrbahn ist – an Gabelung und Einmündung liegen beide Wege ineinander.
    if (TRACK.branchOf[s.seg] >= 0 && TRACK.twin[s.seg] < 0) onBranch[TRACK.branchOf[s.seg]]++;
    maxSpeed = Math.max(maxSpeed, Math.hypot(s.vx, s.vz));
    expect(Number.isFinite(s.x + s.y + s.z + s.vx + s.vy + s.vz + s.heading)).toBe(true);
    if (progress >= (lapTimes.length + 1) * TRACK.n) {
      lapTimes.push((tick - lapStart) / 60);
      lapStart = tick;
    }
  }
  return { lapTimes, falls, hits, flats, wallHits, jumps, landings, air: airTicks / 60, offroad: offroad / 60, turbos, pads, maxSpeed, onBranch };
}

describe('Alle Strecken', () => {
  for (let ti = 0; ti < TRACK_COUNT; ti++) {
    const name = getTrack(ti).def.name;

    it(`${name}: geschlossen, Höhen stetig, Start auf festem Boden`, () => {
      const t = setTrack(ti);
      expect(t.index).toBe(ti);
      expect(t.n).toBeGreaterThan(500);
      expect(t.boxes.length).toBeLessThanOrEqual(32);
      for (let i = 0; i < t.total; i++) {
        const j = t.next[i];
        // Abzweigungen haben ihre eigene, minimal andere Schrittlänge.
        expect(Math.abs(Math.hypot(t.px[j] - t.px[i], t.pz[j] - t.pz[i]) - t.step)).toBeLessThan(t.branchOf[i] >= 0 ? 0.12 : 0.05);
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
            `  Fahrer ${slot + 1}: ${r.lapTimes.map((x) => x.toFixed(1)).join(' / ')} s · Stürze ${r.falls} · Treffer ${r.hits} · geplättet ${r.flats} · Bande ${r.wallHits} · Sprünge ${r.jumps} (${r.air.toFixed(1)} s Luft) · Grün ${r.offroad.toFixed(1)} s · Turbos ${r.turbos} · Felder ${r.pads} · Spitze ${r.maxSpeed.toFixed(0)} m/s`,
          );
          expect(r.lapTimes.length).toBe(3);
          // Selbst die langsamste KI schafft im Schnitt gut 17 m/s.
          for (const lap of r.lapTimes) expect(lap).toBeLessThan(TRACK.length / 17);
          // Die KI darf nicht in jeder Runde abstürzen oder dauernd anecken –
          // im Verkehr streift sie öfter (auch ein gestreiftes Fahrzeug zählt als Bande).
          expect(r.falls).toBeLessThanOrEqual(1);
          expect(r.wallHits).toBeLessThanOrEqual(TRACK.vehicles.length > 0 ? 9 : 4);
          // Verkehr, Geysire und Lavabomben erwischen sie höchstens einmal pro Runde.
          expect(r.hits).toBeLessThanOrEqual(3);
          // Auch die Stampfpressen: zwei Reihen je Runde, höchstens einmal pro Runde geplättet.
          expect(r.flats).toBeLessThanOrEqual(3);
        }
        console.log(`${name}, Stärke ${level}\n${lines.join('\n')}`);
      });
    }

    if (getTrack(ti).branches.length > 0) {
      it(`${name}: jeder Weg ist fahrbar, und keiner ist deutlich schneller`, () => {
        const t = setTrack(ti);
        const routes = 1 << t.branches.length;
        const lines: string[] = [];
        const best: number[] = [];
        for (let route = 0; route < routes; route++) {
          let sum = 0;
          for (let slot = 0; slot < 4; slot++) {
            // Verglichen wird der Verlauf der Wege – ohne Verkehr und Lava, die den einen Weg treffen und den anderen nicht.
            const r = withoutMechanics(() => soloRun(slot, 2, AI_HARD, route));
            expect(r.lapTimes.length).toBe(2);
            expect(r.falls).toBeLessThanOrEqual(1);
            expect(r.wallHits).toBeLessThanOrEqual(4);
            // Der Fahrer war wirklich auf den gewählten Abzweigungen – und nur dort.
            t.branches.forEach((_, k) => (route >> k) & 1 ? expect(r.onBranch[k]).toBeGreaterThan(60) : expect(r.onBranch[k]).toBe(0));
            sum += r.lapTimes[1];
            lines.push(`  Weg ${route.toString(2).padStart(t.branches.length, '0')} Fahrer ${slot + 1}: ${r.lapTimes.map((x) => x.toFixed(1)).join(' / ')} s · Stürze ${r.falls} · Bande ${r.wallHits} · Grün ${r.offroad.toFixed(1)} s`);
          }
          best.push(sum / 4);
        }
        console.log(`${name}: Rundenzeit je Weg (Mittel der vier Fahrer, zweite Runde): ${best.map((x, r) => `${r.toString(2).padStart(t.branches.length, '0')} = ${x.toFixed(1)} s`).join(' · ')}\n${lines.join('\n')}`);
        // Beide Wege sollen sich lohnen: höchstens zwei Sekunden Unterschied.
        expect(Math.max(...best) - Math.min(...best)).toBeLessThan(2);
      });
    }
  }
});

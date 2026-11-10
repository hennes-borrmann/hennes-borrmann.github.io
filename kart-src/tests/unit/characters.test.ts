import { afterAll, describe, expect, it } from 'vitest';
import { AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import { CHARACTERS, EV_FALL, forwardSpeed, gridState, stepKart, turboStage } from '../../src/game/sim';
import { TRACK, TRACK_COUNT, getTrack, rightX, rightZ, segDelta, setTrack } from '../../src/game/track';

afterAll(() => {
  setTrack(0);
});

/**
 * Beste fliegende Runde einer Figur auf der aktiven Strecke. Gefahren wird von
 * derselben KI ohne Tempo-Abschlag, damit nur die Figur den Unterschied macht.
 * @param drifter true = driftet in jeder Kurve, false = fährt alles ohne Drift
 */
function bestLap(char: number, drifter: boolean): number {
  const s = gridState(0, char);
  const brain = drifter ? newBrain(0, AI_HARD) : newBrain(3, AI_MEDIUM);
  brain.skill = 1;
  let progress = segDelta(TRACK, 0, s.seg);
  let lapStart = 0;
  let laps = 0;
  let best = Infinity;
  for (let tick = 1; tick < 4 * 90 * 60 && laps < 4; tick++) {
    const before = s.seg;
    const ev = stepKart(s, botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false }), { canDrive: true, speedFactor: 1, time: tick });
    expect(ev & EV_FALL).toBe(0);
    progress += segDelta(TRACK, before, s.seg);
    if (progress >= (laps + 1) * TRACK.n) {
      // Die erste Runde beginnt aus dem Stand und zählt nicht.
      if (laps > 0) best = Math.min(best, (tick - lapStart) / 60);
      lapStart = tick;
      laps++;
    }
  }
  expect(laps).toBe(4);
  return best;
}

describe('Figuren', () => {
  it('haben gültige, nur leicht verschiedene Werte', () => {
    expect(CHARACTERS.length).toBe(4);
    for (const c of CHARACTERS) {
      for (const f of [c.vmax, c.grip]) expect(Math.abs(f - 1)).toBeLessThan(0.061);
      expect(Math.abs(c.accel - 1)).toBeLessThanOrEqual(0.15);
      expect(c.bars.every((b) => b >= 1 && b <= 5)).toBe(true);
    }
  });

  it('jede Stärke ist messbar: Antritt, Tempo, Grünstreifen, Drift', () => {
    setTrack(0);
    const gas = { steer: 0, buttons: 1 };
    const env = { canDrive: true, speedFactor: 1, time: 0 };
    const sprint: number[] = [];
    const top: number[] = [];
    const green: number[] = [];
    CHARACTERS.forEach((_, c) => {
      const s = gridState(0, c);
      let to20 = 0;
      let v = 0;
      for (let i = 1; i <= 170; i++) {
        stepKart(s, gas, env);
        // Höchstwert merken – am Ende der Geraden wartet die erste Kurve.
        v = Math.max(v, forwardSpeed(s));
        if (to20 === 0 && v >= 20) to20 = i / 60;
      }
      sprint.push(to20);
      top.push(v);
      // Neben der Fahrbahn: gleiche Fahrt, aber im Grünstreifen
      const g = gridState(0, c);
      const lat = TRACK.rh[g.seg] + 1.6;
      g.x = TRACK.px[g.seg] + rightX(TRACK, g.seg) * lat;
      g.z = TRACK.pz[g.seg] + rightZ(TRACK, g.seg) * lat;
      let vg = 0;
      for (let i = 0; i < 150; i++) {
        stepKart(g, gas, env);
        vg = Math.max(vg, forwardSpeed(g));
      }
      green.push(vg);
    });
    console.log(
      `0–20 m/s in s: ${sprint.map((x) => x.toFixed(2)).join(' / ')} · Spitze m/s: ${top.map((x) => x.toFixed(2)).join(' / ')} · im Grünen m/s: ${green.map((x) => x.toFixed(1)).join(' / ')}`,
    );
    // Vera hat den besten Antritt, Kalle den schlechtesten – und die höchste Spitze.
    expect(sprint[1]).toBe(Math.min(...sprint));
    expect(sprint[0]).toBe(Math.max(...sprint));
    expect(top[0]).toBe(Math.max(...top));
    // Bert ist im Grünen klar schneller als alle anderen.
    expect(green[2]).toBeGreaterThan(Math.max(green[0], green[1], green[3]) + 2);
    // Zoe erreicht jede Turbo-Stufe früher.
    expect(turboStage(46, 3)).toBe(1);
    expect(turboStage(46, 0)).toBe(0);
  });

  it('sind ausgeglichen: Rundenzeiten liegen auf jeder Strecke dicht beieinander', () => {
    const lines: string[] = [];
    const sum = [0, 0, 0, 0];
    let worst = 0;
    for (let ti = 0; ti < TRACK_COUNT; ti++) {
      setTrack(ti);
      for (const drifter of [true, false]) {
        const laps = CHARACTERS.map((_, c) => bestLap(c, drifter));
        const fastest = Math.min(...laps);
        const spread = (Math.max(...laps) - fastest) / fastest;
        laps.forEach((l, c) => (sum[c] += l / fastest));
        lines.push(
          `${getTrack(ti).def.name.padEnd(13)} ${drifter ? 'mit Drift ' : 'ohne Drift'}  ${laps.map((l) => l.toFixed(2)).join('  ')}  Abstand ${(spread * 100).toFixed(2)} %`,
        );
        worst = Math.max(worst, spread);
      }
    }
    const avg = sum.map((x) => x / (TRACK_COUNT * 2));
    lines.push(`im Mittel (1 = jeweils Schnellste)   ${avg.map((a) => a.toFixed(4)).join('  ')}`);
    console.log(`Beste Runde in s: ${CHARACTERS.map((c) => c.name.split(/[ -]/).pop()).join(' / ')}\n${lines.join('\n')}`);
    // Auf keiner Strecke und mit keinem Fahrstil liegen Schnellste und Langsamste mehr als 1,6 % auseinander.
    expect(worst).toBeLessThan(0.016);
    // Über alle Strecken gemittelt ist keine Figur mehr als 0,8 % langsamer als die beste.
    expect(Math.max(...avg) - Math.min(...avg)).toBeLessThan(0.008);
  });
});

import { describe, expect, it } from 'vitest';
import { withoutMechanics } from './helpers';
import { AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import {
  BTN_DRIFT,
  BTN_GAS,
  EV_PAD,
  EV_TURBO,
  EV_WALL,
  FLAG_OFFROAD,
  FLAG_WALL,
  V_MAX,
  forwardSpeed,
  gridState,
  stepKart,
  turboStage,
  type Cmd,
  type StepEnv,
} from '../../src/game/sim';
import { TRACK, addProgress, progDelta } from '../../src/game/track';

const ENV: StepEnv = { canDrive: true, speedFactor: 1, time: 0 };

describe('Fahrphysik', () => {
  it('beschleunigt zügig: 0 auf 20 m/s in etwa einer Sekunde', () => {
    const s = gridState(0);
    let t20 = -1;
    let t95 = -1;
    for (let i = 0; i < 400; i++) {
      stepKart(s, { steer: 0, buttons: BTN_GAS }, ENV);
      const v = forwardSpeed(s);
      if (t20 < 0 && v >= 20) t20 = i / 60;
      if (t95 < 0 && v >= V_MAX * 0.95) t95 = i / 60;
    }
    console.log(`0→20 m/s in ${t20.toFixed(2)} s, 95 % Höchsttempo nach ${t95.toFixed(2)} s`);
    expect(t20).toBeGreaterThan(0.6);
    expect(t20).toBeLessThan(1.4);
  });

  it('verliert in Kurven kein Tempo und rutscht ohne Drift kaum', () => {
    const s = gridState(0);
    s.vx = Math.sin(s.heading) * V_MAX;
    s.vz = Math.cos(s.heading) * V_MAX;
    let minSpeed = 99;
    let maxSlip = 0;
    for (let i = 0; i < 45; i++) {
      stepKart(s, { steer: 127, buttons: BTN_GAS }, ENV);
      if ((s.flags & FLAG_WALL) !== 0) break;
      const speed = Math.hypot(s.vx, s.vz);
      minSpeed = Math.min(minSpeed, speed);
      maxSlip = Math.max(maxSlip, Math.abs(Math.atan2(s.vx, s.vz) - s.heading));
    }
    console.log(`volle Lenkung bei Höchsttempo: Tempo bleibt ≥ ${minSpeed.toFixed(1)} m/s, Schräglauf bis ${((maxSlip * 180) / Math.PI).toFixed(1)}°`);
    expect(minSpeed).toBeGreaterThan(V_MAX - 0.5);
    expect(maxSlip).toBeLessThan(0.15);
  });

  it('Drift: Heck rutscht, Ladung erreicht drei Stufen, Loslassen gibt Schub', () => {
    const s = gridState(0);
    s.vx = Math.sin(s.heading) * V_MAX;
    s.vz = Math.cos(s.heading) * V_MAX;
    // Der Test fährt im Kreis; die Bande würde stören, also Position festhalten.
    const hold = { x: s.x, z: s.z, seg: s.seg };
    const stages: number[] = [];
    let maxSlip = 0;
    for (let i = 0; i < 150; i++) {
      stepKart(s, { steer: 127, buttons: BTN_GAS | BTN_DRIFT }, ENV);
      s.x = hold.x;
      s.z = hold.z;
      s.seg = hold.seg;
      const st = turboStage(s.driftCharge);
      if (stages.length < st) stages.push(i / 60);
      let slip = Math.atan2(s.vx, s.vz) - s.heading;
      if (slip > Math.PI) slip -= 2 * Math.PI;
      if (slip < -Math.PI) slip += 2 * Math.PI;
      maxSlip = Math.max(maxSlip, Math.abs(slip));
    }
    console.log(`Drift eng: Stufen nach ${stages.map((x) => x.toFixed(2)).join(' / ')} s, Driftwinkel bis ${((maxSlip * 180) / Math.PI).toFixed(0)}°`);
    expect(s.driftDir).toBe(1);
    expect(stages.length).toBe(3);
    expect(maxSlip).toBeGreaterThan(0.2);
    const ev = stepKart(s, { steer: 0, buttons: BTN_GAS }, ENV);
    expect(ev & EV_TURBO).toBe(EV_TURBO);
    expect(s.boost).toBeGreaterThan(60);
    expect(s.driftDir).toBe(0);
  });

  it('bleibt im Countdown stehen', () => {
    const s = gridState(1);
    const x = s.x;
    for (let i = 0; i < 60; i++) stepKart(s, { steer: 50, buttons: BTN_GAS }, { canDrive: false, speedFactor: 1, time: 0 });
    expect(s.x).toBe(x);
    expect(Math.hypot(s.vx, s.vz)).toBe(0);
  });
});

/** Lässt einen KI-Fahrer allein fahren und zählt, was passiert. */
function soloRun(slot: number, laps: number, cmdFilter?: (c: Cmd) => Cmd, level?: number, route = -1) {
  const s = gridState(slot);
  const brain = level === undefined ? newBrain(slot) : newBrain(slot, level);
  if (route >= 0) {
    brain.route = route;
    brain.routeLock = true;
  }
  let progress = progDelta(TRACK, 0, s.seg);
  const lapTimes: number[] = [];
  let lapStart = 0;
  let wallHits = 0;
  let wallTicks = 0;
  let offroad = 0;
  let turbos = 0;
  let pads = 0;
  let tick = 0;
  const limit = laps * 80 * 60;
  while (lapTimes.length < laps && tick < limit) {
    tick++;
    let cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
    if (cmdFilter) cmd = cmdFilter(cmd);
    const before = s.seg;
    const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
    progress = addProgress(TRACK, progress, before, s.seg);
    if (ev & EV_WALL) wallHits++;
    if (ev & EV_TURBO) turbos++;
    if (ev & EV_PAD) pads++;
    if (s.flags & FLAG_WALL) wallTicks++;
    if (s.flags & FLAG_OFFROAD) offroad++;
    if (progress >= (lapTimes.length + 1) * TRACK.n) {
      lapTimes.push((tick - lapStart) / 60);
      lapStart = tick;
    }
  }
  return { lapTimes, wallHits, wallTicks, offroad: offroad / 60, turbos, pads, ticks: tick };
}

describe('KI-Fahrer auf der Strecke', () => {
  for (let slot = 0; slot < 4; slot++) {
    it(`Fahrer ${slot + 1} schafft drei Runden sauber`, () => {
      const r = soloRun(slot, 3);
      console.log(
        `Fahrer ${slot + 1}: Runden ${r.lapTimes.map((x) => x.toFixed(1)).join(' / ')} s, harte Bandenkontakte ${r.wallHits}, an der Bande ${(r.wallTicks / 60).toFixed(1)} s, im Grünstreifen ${r.offroad.toFixed(1)} s, Mini-Turbos ${r.turbos}, Boost-Felder ${r.pads}`,
      );
      expect(r.lapTimes.length).toBe(3);
      for (const lap of r.lapTimes) {
        expect(lap).toBeGreaterThan(20);
        // Auch der langsamste Fahrer schafft im Schnitt gut 20 m/s.
        expect(lap).toBeLessThan(TRACK.length / 20);
      }
      expect(r.wallHits).toBeLessThanOrEqual(2);
      // Nur Fahrer 1 driftet in jeder engeren Kurve; die anderen seltener oder nie.
      if (slot === 0) expect(r.turbos).toBeGreaterThanOrEqual(3);
    });
  }

  it('ohne Drift ist man messbar langsamer – Driften lohnt sich', () => {
    // Derselbe starke Fahrer auf demselben Weg, ohne Maschinen (die träfen den einen Lauf und den anderen nicht):
    // einmal mit Drift, einmal mit gesperrter Drift-Taste.
    const withDrift = withoutMechanics(() => soloRun(0, 2, undefined, AI_HARD, 3));
    const without = withoutMechanics(() => soloRun(0, 2, (c) => ({ steer: c.steer, buttons: c.buttons & ~BTN_DRIFT }), AI_HARD, 3));
    const a = withDrift.lapTimes[1];
    const b = without.lapTimes[1];
    console.log(`fliegende Runde mit Drift ${a.toFixed(2)} s (${withDrift.turbos} Mini-Turbos), ohne ${b.toFixed(2)} s`);
    expect(without.lapTimes.length).toBe(2);
    expect(without.turbos).toBe(0);
    // (Zwei Runden; manche Drifts löst die KI früh, wenn sie sonst in den Innenrand gezogen würde.)
    expect(withDrift.turbos).toBeGreaterThanOrEqual(4);
    // Mindestens drei Zehntel pro Runde.
    expect(b).toBeGreaterThan(a + 0.3);
  });
});

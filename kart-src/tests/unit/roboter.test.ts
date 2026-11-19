// Roboter (ersetzt die Sprungfeder): Das Kart verwandelt sich in einen laufenden Roboter, der ein paar Schritte rennt, einen
// Satz nach vorn macht und im Sprung wieder zum Kart wird – ein kleiner Schub (deutlich weniger als ein Zisch).
// (sim.ts: ITEM_ROBOT, KartState.robot, ROBOT_*; ai.ts; protocol.ts.)

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { botCmd, newBrain } from '../../src/game/ai';
import {
  BTN_GAS,
  EV_TAKEOFF,
  EV_USE_ROBOT,
  FLAG_AIR,
  ITEM_BOOST,
  ITEM_NONE,
  ITEM_OIL,
  ITEM_ROBOT,
  NEUTRAL,
  ROBOT_LEAP_AT,
  ROBOT_MORPH_TICKS,
  ROBOT_TICKS,
  V_MAX,
  copyState,
  forwardSpeed,
  gridState,
  hitKart,
  newState,
  stepKart,
  type Cmd,
  type KartState,
} from '../../src/game/sim';
import { TRACK, buildTrack, proj, projectOnTrack, rightX, rightZ, setTrack, trackHeading, useTrack, type Track } from '../../src/game/track';
import { RACE_RUNNING, THING_OIL, decodeSnapshot, encodeSnapshot } from '../../src/net/protocol';
import { HostGame } from '../../src/game/hostGame';
import { withoutMechanics } from './helpers';

const GAS: Cmd = { steer: 0, buttons: BTN_GAS };
const PRESS: Cmd = { steer: 0, buttons: BTN_GAS | 8 };
const ENV = { canDrive: true, speedFactor: 1, time: 0 };

afterAll(() => {
  setTrack(0);
});

function placeAt(s: KartState, seg: number, lat = 0, v = 0): void {
  const t = TRACK;
  s.seg = seg;
  s.x = t.px[seg] + rightX(t, seg) * lat;
  s.z = t.pz[seg] + rightZ(t, seg) * lat;
  s.y = t.py[seg] + lat * t.bank[seg];
  s.heading = trackHeading(t, seg);
  s.vx = Math.sin(s.heading) * v;
  s.vz = Math.cos(s.heading) * v;
  s.vy = 0;
  s.flags = 0;
}

/** Prüfstrecke: flaches Oval mit zwei 300 m langen Geraden. */
function oval(): Track {
  return buildTrack({
    id: 'oval',
    name: 'Prüfoval',
    theme: 'werkshof',
    blurb: '',
    grade: 1,
    points: [
      [0, 0, 0],
      [0, 150, 0],
      [0, 300, 0],
      [40, 345, 0],
      [80, 300, 0],
      [80, 150, 0],
      [80, 0, 0],
      [40, -45, 0],
    ],
    roadHalf: 6,
    shoulder: 3,
    startAt: 0,
    laps: 1,
    surface: 'asphalt',
    pads: [],
    boxRows: [],
  });
}

const STRAIGHT = 15;

/** Strecke entlang der Mittellinie (Meter) seit dem Anfang der Runde. */
function along(s: KartState): number {
  projectOnTrack(TRACK, s.x, s.z, s.seg);
  return proj.seg * TRACK.step + proj.along;
}

/** Fährt mit Vollgas die Gerade entlang; mit item wird es im ersten Schritt ausgelöst. Liefert die Strecke nach ticks. */
function drive(item: number, ticks: number, v = V_MAX, log?: (i: number, s: KartState) => void): { way: number; s: KartState } {
  const s = gridState(0);
  placeAt(s, STRAIGHT, 0, v);
  s.item = item;
  const from = along(s);
  for (let i = 0; i < ticks; i++) {
    projectOnTrack(TRACK, s.x, s.z, s.seg);
    const steer = Math.round(Math.max(-1, Math.min(1, -proj.lat * 0.25)) * 127);
    stepKart(s, { steer, buttons: BTN_GAS | (i === 0 && item !== ITEM_NONE ? 8 : 0) }, ENV);
    log?.(i, s);
  }
  return { way: along(s) - from, s };
}

describe('Roboter', () => {
  beforeEach(() => {
    setTrack(0);
  });

  it('Ablauf: verwandeln (0,5 s), laufen, Satz nach vorn, im Sprung zurück – landet als Kart', () => {
    useTrack(oval());
    const air: number[] = [];
    let leapSpeed = 0;
    let landed = -1;
    let peak = 0;
    const { s } = drive(ITEM_ROBOT, 150, V_MAX, (i, k) => {
      if (k.flags & FLAG_AIR) air.push(i);
      if (i + 1 === ROBOT_LEAP_AT) leapSpeed = forwardSpeed(k);
      peak = Math.max(peak, k.y);
      if (landed < 0 && air.length > 0 && !(k.flags & FLAG_AIR)) landed = i;
    });
    expect(s.item).toBe(ITEM_NONE);
    expect(s.robot).toBe(0);
    // Erst nach Verwandeln und Laufen in der Luft, dann gut 0,7 s
    expect(air[0]).toBe(ROBOT_LEAP_AT - 1);
    expect(air.length).toBeGreaterThan(36);
    expect(air.length).toBeLessThan(50);
    expect(peak).toBeGreaterThan(1.6);
    expect(leapSpeed).toBeGreaterThan(V_MAX + 6);
    console.log(`Roboter: Satz mit ${leapSpeed.toFixed(1)} m/s, ${peak.toFixed(2)} m hoch, ${(air.length / 60).toFixed(2)} s in der Luft, Landung nach ${((landed + 1) / 60).toFixed(2)} s`);
  });

  it('Zeitgewinn auf der Geraden: gut 0,3–0,5 s – deutlich weniger als ein Zisch', () => {
    useTrack(oval());
    const plain = drive(ITEM_NONE, 240).way;
    const robot = drive(ITEM_ROBOT, 240).way;
    const zisch = drive(ITEM_BOOST, 240).way;
    const gain = (robot - plain) / V_MAX;
    const gainZ = (zisch - plain) / V_MAX;
    console.log(`Zeitgewinn: Roboter ${gain.toFixed(2)} s, Zisch ${gainZ.toFixed(2)} s (in 4 s auf der Geraden)`);
    expect(gain).toBeGreaterThan(0.3);
    expect(gain).toBeLessThan(0.5);
    expect(gain).toBeLessThan(gainZ * 0.7);
  });

  it('deterministisch: aus jedem Zwischenstand rechnet jedes Gerät dasselbe weiter (auch über den Snapshot)', () => {
    useTrack(oval());
    const a = gridState(0);
    placeAt(a, STRAIGHT, 0, V_MAX);
    a.item = ITEM_ROBOT;
    const cmds: Cmd[] = [];
    for (let i = 0; i < 160; i++) cmds.push({ steer: Math.round(Math.sin(i * 0.05) * 40), buttons: BTN_GAS | (i === 3 ? 8 : 0) });
    let b: KartState | null = null;
    for (let i = 0; i < cmds.length; i++) {
      if (i === 40) {
        expect(a.robot).toBeGreaterThan(ROBOT_MORPH_TICKS);
        // Ein zweites Gerät übernimmt den Stand mitten im Laufen – aus einem Snapshot (wie ein Mitspieler).
        const snap = decodeSnapshot(
          new DataView(
            encodeSnapshot({ tick: 1, raceId: 1, phase: RACE_RUNNING, goTick: 0, laps: 1, boxes: 0, track: 0, karts: [{ slot: 0, bot: false, ptick: i, ack: i, state: a, lap: 1, place: 1, finished: false, finishTicks: 0 }], things: [] }),
          ),
        )!;
        b = snap.karts[0].state;
        expect(b.robot).toBe(a.robot);
        // (Ab hier beide aus genau demselben – float32-gerundeten – Stand.)
        copyState(a, b);
      }
      stepKart(a, cmds[i], ENV);
      if (b) stepKart(b, cmds[i], ENV);
    }
    expect(b).not.toBeNull();
    expect(b).toEqual(a);
    expect(a.robot).toBe(0);
  });

  it('nur am Boden, nur einer zur Zeit; ein Treffer lässt den Roboter zusammenfallen', () => {
    useTrack(oval());
    const s = gridState(0);
    placeAt(s, STRAIGHT, 0, 20);
    s.y += 1;
    s.flags = FLAG_AIR;
    s.item = ITEM_ROBOT;
    stepKart(s, PRESS, ENV);
    expect(s.item).toBe(ITEM_ROBOT);
    expect(s.robot).toBe(0);
    const r = gridState(0);
    placeAt(r, STRAIGHT, 0, 20);
    r.item = ITEM_ROBOT;
    expect(stepKart(r, PRESS, ENV) & EV_USE_ROBOT).toBeTruthy();
    expect(r.robot).toBe(1);
    for (let i = 0; i < 10; i++) stepKart(r, GAS, ENV);
    r.item = ITEM_ROBOT;
    stepKart(r, PRESS, ENV);
    expect(r.item).toBe(ITEM_ROBOT);
    // Treffer: schleudern, wieder ein Kart, kein Satz mehr.
    hitKart(r);
    expect(r.robot).toBe(0);
    let air = 0;
    for (let i = 0; i < 80; i++) if (stepKart(r, GAS, ENV) & EV_TAKEOFF) air++;
    expect(air).toBe(0);
    // Abgelaufen ist er spätestens nach ROBOT_TICKS, auch wenn er (über einer Kuppe) nicht landet.
    const t = gridState(0);
    t.robot = ROBOT_TICKS;
    stepKart(t, NEUTRAL, ENV);
    expect(t.robot).toBe(0);
  });

  it('der Satz trägt über einen Ölfleck hinweg (ohne Roboter schleudert man darin)', () => {
    useTrack(oval());
    // Wo ist das Kart mitten im Satz? (Trockenlauf)
    let mid = 0;
    let midLat = 0;
    drive(ITEM_ROBOT, ROBOT_LEAP_AT + 22, V_MAX, (i, k) => {
      if (i === ROBOT_LEAP_AT + 20) {
        expect(k.flags & FLAG_AIR).toBeTruthy();
        mid = along(k);
        projectOnTrack(TRACK, k.x, k.z, k.seg);
        midLat = proj.lat;
      }
    });
    const run = (item: number): { spin: number; oil: boolean } => {
      const host = new HostGame(0);
      host.setRoster([0, 1], false);
      host.newRace();
      while (host.phase !== RACE_RUNNING) host.step(NEUTRAL);
      // Kart 1 lässt genau dort einen Ölfleck fallen (2,8 m hinter sich) und fährt dann weit weg.
      host.debugPlace(0, 2);
      host.debugPlace(1, mid + 2.8, midLat);
      host.giveItem(1, ITEM_OIL);
      host.receiveCmds(1, 1, [{ steer: 0, buttons: 8 }]);
      host.step(NEUTRAL);
      expect(host.things().some((t) => t.kind === THING_OIL)).toBe(true);
      host.debugPlace(1, 280);
      host.debugPlace(0, STRAIGHT * TRACK.step);
      const s = host.authoritative(0)!;
      placeAt(s, STRAIGHT, 0, V_MAX);
      s.item = item;
      let spin = 0;
      for (let i = 0; i < ROBOT_LEAP_AT + 70; i++) {
        projectOnTrack(TRACK, s.x, s.z, s.seg);
        const steer = Math.round(Math.max(-1, Math.min(1, -proj.lat * 0.25)) * 127);
        host.step({ steer, buttons: BTN_GAS | (i === 0 ? 8 : 0) });
        spin = Math.max(spin, s.spin);
      }
      return { spin, oil: host.things().some((t) => t.kind === THING_OIL) };
    };
    const plain = run(ITEM_NONE);
    expect(plain.spin).toBeGreaterThan(0);
    expect(plain.oil).toBe(false);
    const robot = run(ITEM_ROBOT);
    expect(robot.spin).toBe(0);
    expect(robot.oil).toBe(true);
  });

  it('KI: zündet ihn auf gerader Strecke mit Bande – und kommt damit sicher weiter', () => {
    withoutMechanics(() => {
      const s = gridState(0);
      for (let i = 0; i < 60; i++) stepKart(s, GAS, ENV);
      s.item = ITEM_ROBOT;
      const brain = newBrain(0);
      let used = -1;
      for (let i = 0; i < 1200 && s.item !== ITEM_NONE; i++) {
        const cmd = botCmd(s, brain, [], true, { tick: i, time: i, place: 1, smoke: false });
        if (stepKart(s, cmd, ENV) & EV_USE_ROBOT) used = i;
      }
      expect(used).toBeGreaterThanOrEqual(40);
      // Danach: laufen, springen, landen – ohne Absturz.
      for (let i = 0; i < 140; i++) {
        const cmd = botCmd(s, brain, [], true, { tick: 2000 + i, time: 2000 + i, place: 1, smoke: false });
        stepKart(s, cmd, ENV);
        expect(s.respawn).toBe(0);
      }
      expect(s.robot).toBe(0);
      expect(forwardSpeed(s)).toBeGreaterThan(15);
    });
  });

  it('Snapshot und Kopie tragen den Roboter mit', () => {
    const s = gridState(0);
    s.robot = 61;
    expect(copyState(newState(), s).robot).toBe(61);
  });
});

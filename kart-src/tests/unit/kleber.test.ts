// Kleber: Hinten klappt eine Klebepistole aus und schießt einen Klumpen auf den Fahrer direkt hinter dir (bis 25 m) – ihm klebt
// vier Sekunden lang Kleber auf dem Bildschirm, ohne dass er langsamer wird. Der Stoßfänger fängt ihn ab, Get Gold ist immun.
// (sim.ts: ITEM_GLUE, KartState.glue/glueShot/glueAim, glueKart; hostGame.ts: aimGlue, glueHit, Auslosung; ai.ts; protocol.ts.)

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { botCmd, newBrain } from '../../src/game/ai';
import { HostGame } from '../../src/game/hostGame';
import {
  BTN_GAS,
  GLUE_FIRE,
  GLUE_HIT,
  GLUE_RANGE,
  GLUE_SHOT_TICKS,
  GLUE_TICKS,
  GOLD_TICKS,
  GUARD_TICKS,
  HIT_BLOCKED,
  HIT_NONE,
  HIT_SPIN,
  ITEM_GLUE,
  ITEM_NONE,
  NEUTRAL,
  V_MAX,
  copyState,
  forwardSpeed,
  glueKart,
  gridState,
  newState,
  stepKart,
  type Cmd,
} from '../../src/game/sim';
import { TRACK, segDelta, setTrack } from '../../src/game/track';
import { RACE_RUNNING, decodeSnapshot } from '../../src/net/protocol';
import { withoutMechanics } from './helpers';

const GAS: Cmd = { steer: 0, buttons: BTN_GAS };
const FIRE: Cmd = { steer: 0, buttons: BTN_GAS | 8 };
const ENV = { canDrive: true, speedFactor: 1, time: 0 };

afterAll(() => {
  setTrack(0);
});

function runningHost(humans: number[]): HostGame {
  const host = new HostGame(0);
  host.setRoster(humans, false);
  host.newRace();
  while (host.phase !== RACE_RUNNING) host.step(NEUTRAL);
  return host;
}

/** Host mit Schütze 0 bei 120 m; die anderen stehen dort, wo places sagt (Meter ab Start). */
function lineUp(places: number[]): { host: HostGame; fx: string[] } {
  const host = runningHost([0, ...places.map((_, i) => i + 1)]);
  const fx: string[] = [];
  host.onFx = (slot, kind) => fx.push(`${slot}:${kind}`);
  host.debugPlace(0, 120);
  places.forEach((m, i) => host.debugPlace(i + 1, m, i % 2 === 0 ? 2 : -2));
  host.step(NEUTRAL);
  return { host, fx };
}

/** Schuss auslösen und so lange weiterrechnen, bis die Pistole wieder eingeklappt ist. */
function shoot(host: HostGame): number[] {
  host.giveItem(0, ITEM_GLUE);
  host.step(FIRE);
  const glue: number[] = [];
  for (let i = 1; i < GLUE_SHOT_TICKS + 4; i++) {
    host.step(NEUTRAL);
    if (i === GLUE_HIT) for (let s = 1; s < 4; s++) glue[s] = host.authoritative(s)?.glue ?? 0;
  }
  return glue;
}

describe('Kleber', () => {
  beforeEach(() => {
    setTrack(0);
  });

  it('Pistole: ausklappen, bei GLUE_FIRE schießen, bei GLUE_HIT trifft es, dann wieder einklappen; keine zweite, solange sie draußen ist', () => {
    withoutMechanics(() => {
      const s = gridState(0);
      s.item = ITEM_GLUE;
      stepKart(s, FIRE, ENV);
      expect(s.item).toBe(ITEM_NONE);
      expect(s.glueShot).toBe(1);
      expect(s.glueAim).toBe(-1);
      s.item = ITEM_GLUE;
      stepKart(s, NEUTRAL, ENV);
      stepKart(s, FIRE, ENV);
      expect(s.item).toBe(ITEM_GLUE);
      let n = 3;
      while (s.glueShot > 0 && n < 200) {
        stepKart(s, NEUTRAL, ENV);
        n++;
      }
      expect(n).toBe(GLUE_SHOT_TICKS + 1);
      expect(GLUE_FIRE).toBeLessThan(GLUE_HIT);
      expect(GLUE_HIT).toBeLessThan(GLUE_SHOT_TICKS);
    });
  });

  it('trifft nur den Fahrer direkt dahinter – und nur bis 25 m', () => {
    // 1 ist 14 m dahinter, 2 gut 30 m dahinter, 3 fährt vorn: nur 1 bekommt Kleber.
    {
      const { host, fx } = lineUp([106, 89, 150]);
      const glue = shoot(host);
      expect(glue[1]).toBeGreaterThan(GLUE_TICKS - 3);
      expect(glue[2]).toBe(0);
      expect(glue[3]).toBe(0);
      expect(fx).toContain('1:glue');
      expect(host.authoritative(0)!.glue).toBe(0);
    }
    // Direkt dahinter ist nur der Nächste: auch wenn ein Zweiter ebenfalls in Reichweite wäre.
    {
      const { host } = lineUp([110, 101]);
      const glue = shoot(host);
      expect(glue[1]).toBeGreaterThan(0);
      expect(glue[2]).toBe(0);
    }
    // Der Nächste ist weiter als 25 m weg: niemand wird getroffen, der Klumpen klatscht auf die Fahrbahn.
    {
      const { host } = lineUp([120 - GLUE_RANGE - 4, 40]);
      host.giveItem(0, ITEM_GLUE);
      host.step(FIRE);
      expect(host.authoritative(0)!.glueAim).toBe(-1);
      const glue = shoot(host);
      expect(glue[1]).toBe(0);
      expect(glue[2]).toBe(0);
    }
  });

  it('Ziel steht ab dem Schuss im Snapshot (für die Flugbahn auf allen Bildschirmen)', () => {
    const { host } = lineUp([108]);
    host.giveItem(0, ITEM_GLUE);
    host.step(FIRE);
    const snap = decodeSnapshot(new DataView(host.snapshot()))!;
    const me = snap.karts.find((k) => k.slot === 0)!.state;
    expect(me.glueShot).toBe(1);
    expect(me.glueAim).toBe(1);
    for (let i = 0; i < GLUE_HIT; i++) host.step(NEUTRAL);
    const after = decodeSnapshot(new DataView(host.snapshot()))!;
    expect(after.karts.find((k) => k.slot === 1)!.state.glue).toBeGreaterThan(GLUE_TICKS - 3);
  });

  it('klebt genau 4 s', () => {
    const s = gridState(0);
    expect(glueKart(s)).toBe(HIT_SPIN);
    expect(s.glue).toBe(GLUE_TICKS);
    expect(GLUE_TICKS).toBe(240);
    let n = 0;
    while (s.glue > 0 && n < 400) {
      stepKart(s, NEUTRAL, ENV);
      n++;
    }
    expect(n).toBe(240);
  });

  it('kein Tempoverlust: mit Kleber fährt das Kart genau wie ohne', () => {
    withoutMechanics(() => {
      const a = gridState(0);
      const b = copyState(newState(), a);
      glueKart(b);
      for (let i = 0; i < 200; i++) {
        stepKart(a, GAS, ENV);
        stepKart(b, GAS, ENV);
      }
      expect(b.glue).toBe(GLUE_TICKS - 200);
      expect(b.x).toBe(a.x);
      expect(b.z).toBe(a.z);
      expect(forwardSpeed(b)).toBe(forwardSpeed(a));
      expect(forwardSpeed(b)).toBeGreaterThan(V_MAX * 0.9);
    });
  });

  it('der Stoßfänger fängt ihn ab, Get Gold ist immun', () => {
    const s = gridState(0);
    s.guard = GUARD_TICKS;
    expect(glueKart(s)).toBe(HIT_BLOCKED);
    expect(s.guard).toBe(0);
    expect(s.glue).toBe(0);
    const g = gridState(0);
    g.gold = GOLD_TICKS;
    expect(glueKart(g)).toBe(HIT_NONE);
    expect(g.glue).toBe(0);
    // Im Rennen: der Getroffene mit Stoßfänger meldet „block“, behält aber freie Sicht.
    const { host, fx } = lineUp([105]);
    host.authoritative(1)!.guard = GUARD_TICKS;
    const glue = shoot(host);
    expect(glue[1]).toBe(0);
    expect(host.authoritative(1)!.guard).toBe(0);
    expect(fx).toContain('1:block');
    expect(fx).not.toContain('1:glue');
  });

  it('wird eher vorn und in der Mitte gezogen, hinten selten, allein nie', () => {
    const host = runningHost([0, 1, 2, 3]);
    const pick = (host as unknown as { pickItem(place: number, count: number, behind?: number): number }).pickItem.bind(host);
    const share = (place: number, count: number): number => {
      let n = 0;
      for (let i = 0; i < 6000; i++) if (pick(place, count, 0) === ITEM_GLUE) n++;
      return n / 6000;
    };
    const first = share(1, 4);
    const mid = share(2, 4);
    const last = share(4, 4);
    console.log(`Kleber je Platz: vorn ${(first * 100).toFixed(1)} %, Mitte ${(mid * 100).toFixed(1)} %, hinten ${(last * 100).toFixed(1)} %`);
    expect(first).toBeGreaterThan(0.06);
    expect(mid).toBeGreaterThan(0.045);
    expect(last).toBeLessThan(0.035);
    expect(last).toBeLessThan(mid);
    expect(share(1, 1)).toBe(0);
  });

  it('KI: schießt, wenn jemand dicht dahinter fährt – und schlingert mit Kleber, ohne langsamer zu werden', () => {
    withoutMechanics(() => {
      const me = gridState(0);
      for (let i = 0; i < 100; i++) stepKart(me, GAS, ENV);
      me.item = ITEM_GLUE;
      const other = gridState(1);
      for (let i = 0; i < 80; i++) stepKart(other, GAS, ENV);
      const gap = segDelta(TRACK, other.seg, me.seg) * TRACK.step;
      expect(gap).toBeGreaterThan(3);
      expect(gap).toBeLessThan(GLUE_RANGE - 6);
      const brain = newBrain(0);
      let fired = -1;
      for (let i = 0; i < 80 && fired < 0; i++) {
        const cmd = botCmd(me, brain, [other], true, { tick: i, time: i, place: 1, smoke: false });
        if (cmd.buttons & 8) fired = i;
        stepKart(me, cmd, ENV);
        stepKart(other, GAS, ENV);
      }
      expect(fired).toBeGreaterThan(20);
      expect(me.glueShot).toBeGreaterThan(0);
      // Mit Kleber lenkt die KI unruhiger.
      const calm = gridState(0);
      const glued = gridState(0);
      for (let i = 0; i < 90; i++) {
        stepKart(calm, GAS, ENV);
        stepKart(glued, GAS, ENV);
      }
      glued.glue = GLUE_TICKS;
      const a = newBrain(0);
      const b = newBrain(0);
      let diff = 0;
      for (let i = 0; i < 60; i++) {
        const ca = botCmd(calm, a, [], true, { tick: i, time: i, place: 1, smoke: false });
        const cb = botCmd(glued, b, [], true, { tick: i, time: i, place: 1, smoke: false });
        diff = Math.max(diff, Math.abs(ca.steer - cb.steer));
        expect(cb.buttons & 2).toBe(ca.buttons & 2);
        stepKart(calm, ca, ENV);
        stepKart(glued, cb, ENV);
      }
      expect(diff).toBeGreaterThan(10);
    });
  });
});

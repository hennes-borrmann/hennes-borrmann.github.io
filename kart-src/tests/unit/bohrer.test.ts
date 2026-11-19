// Bohrer: einstecken, unter der Erde zum Führenden, direkt vor ihm durchbrechen und explodieren.
// (sim.ts: ITEM_DRILL, KartState.plant, DRILL_*; hostGame.ts: Auslosung, spawnDrill, stepDrill, surfaceDrill; ai.ts; protocol.ts.)

import { afterAll, describe, expect, it } from 'vitest';
import { botCmd, newBrain } from '../../src/game/ai';
import { HostGame } from '../../src/game/hostGame';
import {
  BTN_GAS,
  BTN_ITEM,
  DRILL_ARRIVE_MAX,
  DRILL_DIG_TICKS,
  DRILL_FORE,
  DRILL_PLANT_TICKS,
  DRILL_RISE_TICKS,
  DRILL_SIDE,
  FLAG_AIR,
  GOLD_TICKS,
  GUARD_TICKS,
  ITEM_BOOST,
  ITEM_COUNT,
  ITEM_DRILL,
  ITEM_GOLD,
  ITEM_NONE,
  ITEM_ROCKET,
  ITEM_TOP,
  NEUTRAL,
  SPIN_TICKS,
  forwardSpeed,
  gridState,
  stepKart,
  type Cmd,
  type KartState,
} from '../../src/game/sim';
import { TRACK, TRACK_COUNT, rightX, rightZ, setTrack, trackHeading } from '../../src/game/track';
import { RACE_RUNNING, THING_DRILL, decodeSnapshot, type SnapshotThing } from '../../src/net/protocol';

const GAS: Cmd = { steer: 0, buttons: BTN_GAS };
const PRESS: Cmd = { steer: 0, buttons: BTN_GAS | BTN_ITEM };

afterAll(() => {
  setTrack(0);
});

function runningHost(humans: number[], bots = false): HostGame {
  const host = new HostGame(0);
  host.setRoster(humans, bots);
  host.newRace();
  while (host.phase !== RACE_RUNNING) host.step(NEUTRAL);
  return host;
}

const progressOf = (host: HostGame, slot: number): number =>
  (host as unknown as { karts: Map<number, { progress: number }> }).karts.get(slot)!.progress;

/** Ein Kart an eine Stelle setzen – in Schritten, damit der Rennfortschritt mitzählt (ein Sprung über eine halbe Runde zählte rückwärts). */
function place(host: HostGame, slot: number, meters: number, lat = 0): void {
  const from = progressOf(host, slot) * TRACK.step;
  const n = Math.max(1, Math.ceil(Math.abs(meters - from) / 250));
  for (let i = 1; i <= n; i++) host.debugPlace(slot, from + ((meters - from) * i) / n, lat);
}

const drillOf = (host: HostGame): SnapshotThing | undefined => host.things().find((t) => t.kind === THING_DRILL);

/** Ohne fremde Items (sonst sähe ein Treffer durch sie aus wie einer durch den Bohrer). */
function noItems(host: HostGame): void {
  for (const s of [1, 2, 3]) host.giveItem(s, ITEM_NONE);
}

interface DrillRun {
  /** Alter des Bohrers (Ticks seit dem Einstecken), als er durchbrach bzw. explodierte. */
  surface: number;
  boom: number;
  /** Wen er zuletzt suchte, wer je gesucht wurde, ob das Ziel bei der Explosion umgehauen wurde, Abstand dabei. */
  target: number;
  targets: Set<number>;
  hit: boolean;
  dist: number;
  /** Hat der Werfer je geschleudert? */
  ownerSpun: boolean;
  fx: string[];
}

/**
 * Anna (0, Mensch) steckt den Bohrer ein, die KI fährt. hooks.each läuft vor jedem Schritt (mit dem Bohrer, falls es
 * ihn gibt). Liefert, was geschah.
 */
function drillRun(host: HostGame, hooks: { each?: (d: SnapshotThing | undefined) => void } = {}): DrillRun {
  const fx: string[] = [];
  host.onFx = (slot, kind) => fx.push(`${slot}:${kind}`);
  host.giveItem(0, ITEM_DRILL);
  host.step(PRESS);
  const r: DrillRun = { surface: -1, boom: -1, target: -1, targets: new Set(), hit: false, dist: Infinity, ownerSpun: false, fx };
  let last: SnapshotThing | null = null;
  for (let i = 0; i < DRILL_PLANT_TICKS + 700; i++) {
    noItems(host);
    hooks.each?.(drillOf(host));
    const spins = [0, 1, 2, 3].map((s) => host.authoritative(s)?.spin ?? 0);
    host.step(GAS);
    const d = drillOf(host);
    if (host.authoritative(0)!.spin > 0) r.ownerSpun = true;
    if (d) {
      if (d.stage > 0 && r.surface < 0) r.surface = d.age;
      r.targets.add(d.target);
      last = { ...d };
    } else if (last) {
      r.boom = last.age + 1;
      r.target = last.target;
      const o = r.target >= 0 ? host.authoritative(r.target) : null;
      if (o) {
        r.hit = spins[r.target] === 0 && o.spin === SPIN_TICKS;
        r.dist = Math.hypot(o.x - last.x, o.z - last.z);
      }
      break;
    }
  }
  return r;
}

/** Rennen mit KI auf Strecke ti: Anna bei base, die anderen davor bzw. dahinter (Meter). */
function race(ahead: number, base = 200): HostGame {
  const host = runningHost([0], true);
  for (let i = 0; i < 60; i++) {
    noItems(host);
    host.step(GAS);
  }
  place(host, 0, base);
  place(host, 1, base + ahead);
  place(host, 2, base - 50, -2);
  place(host, 3, base - 80, 2);
  host.step(GAS);
  return host;
}

describe('Bohrer', () => {
  it('Auslosung: nie auf Platz 1, ab Platz 2 selten, je weiter hinten desto häufiger – hinten deutlich, aber nicht vorherrschend', () => {
    const host = runningHost([0, 1, 2, 3]);
    const pick = (host as unknown as { pickItem(place: number, count: number, behind?: number): number }).pickItem.bind(host);
    const N = 8000;
    const counts = (place: number, count: number, behind = 0): number[] => {
      const n = new Array<number>(ITEM_COUNT).fill(0);
      for (let i = 0; i < N; i++) n[pick(place, count, behind)]++;
      return n;
    };
    const share = (place: number, count: number, behind = 0): number => counts(place, count, behind)[ITEM_DRILL] / N;
    for (const count of [1, 2, 3, 4]) expect(share(1, count)).toBe(0);
    const [p2, p3, p4] = [share(2, 4), share(3, 4), share(4, 4)];
    console.log(`Bohrer je Platz (vier Fahrer): 0 / ${[p2, p3, p4].map((x) => (x * 100).toFixed(1) + ' %').join(' / ')}`);
    expect(p2).toBeGreaterThan(0.008);
    expect(p2).toBeLessThan(0.035);
    expect(p3).toBeGreaterThan(0.04);
    expect(p3).toBeLessThan(0.075);
    expect(p4).toBeGreaterThan(0.09);
    expect(p4).toBeLessThan(0.13);
    expect(p2).toBeLessThan(p3);
    expect(p3).toBeLessThan(p4);
    // zu zweit ist Platz 2 der letzte; zu dritt liegt Platz 2 dazwischen
    expect(share(2, 2)).toBeGreaterThan(0.09);
    expect(share(2, 3)).toBeGreaterThan(0.02);
    expect(share(2, 3)).toBeLessThan(share(3, 3));
    // Hinten bleiben alle anderen Items spürbar: keins verschwindet, keins (auch nicht der Bohrer) liegt über 20 %.
    const last = counts(4, 4, 20);
    for (const item of [ITEM_BOOST, 2, ITEM_TOP, 5, 6, 8, ITEM_ROCKET, 11, ITEM_GOLD]) expect(last[item] / N).toBeGreaterThan(0.04);
    for (let item = 1; item < ITEM_COUNT; item++) expect(last[item] / N).toBeLessThan(0.2);
  });

  it('Einstecken: 0,6 s, das Kart fährt dabei weiter; erst dann steckt er rechts neben dem Kart im Boden – ein zweiter bleibt solange in der Hand', () => {
    setTrack(0);
    const host = runningHost([0, 1]);
    host.debugPlace(0, 60);
    host.debugPlace(1, 400);
    for (let i = 0; i < 90; i++) host.step(GAS);
    const a = host.authoritative(0)!;
    const v0 = forwardSpeed(a);
    expect(v0).toBeGreaterThan(15);
    host.giveItem(0, ITEM_DRILL);
    host.step(PRESS);
    expect(a.item).toBe(ITEM_NONE);
    expect(a.plant).toBe(DRILL_PLANT_TICKS);
    // Ein zweiter Bohrer bleibt beim Einstecken in der Hand.
    host.giveItem(0, ITEM_DRILL);
    host.step(GAS);
    host.step(PRESS);
    expect(a.item).toBe(ITEM_DRILL);
    let steps = 3;
    while (a.plant > 0) {
      expect(drillOf(host)).toBeUndefined();
      host.step(GAS);
      steps++;
    }
    expect(steps - 1).toBe(DRILL_PLANT_TICKS);
    const d = drillOf(host)!;
    expect(d).toBeDefined();
    expect(d.age).toBe(1);
    expect(d.stage).toBe(0);
    expect(d.target).toBe(1);
    // rechts neben dem Kart (rechts = (−cos, sin) der Blickrichtung), ein Stück vor der Mitte
    const rx = d.x - a.x;
    const rz = d.z - a.z;
    const right = rx * -Math.cos(a.heading) + rz * Math.sin(a.heading);
    const fwd = rx * Math.sin(a.heading) + rz * Math.cos(a.heading);
    expect(right).toBeGreaterThan(DRILL_SIDE - 0.4);
    expect(right).toBeLessThan(DRILL_SIDE + 0.4);
    expect(fwd).toBeGreaterThan(DRILL_FORE - 0.8);
    expect(fwd).toBeLessThan(DRILL_FORE + 0.5);
    // Das Kart wurde nicht gebremst.
    expect(forwardSpeed(a)).toBeGreaterThan(v0 * 0.95);
    // Erst dreht er sich an der Stelle ein …
    const at = { x: d.x, z: d.z };
    for (let i = 0; i < DRILL_DIG_TICKS - 2; i++) host.step(GAS);
    const dig = drillOf(host)!;
    expect(Math.hypot(dig.x - at.x, dig.z - at.z)).toBeLessThan(0.01);
    // … dann fährt er los, erst langsam, dann immer schneller.
    const speeds: number[] = [];
    for (let i = 0; i < 90; i++) {
      host.step(GAS);
      const t = drillOf(host);
      if (t && t.stage === 0) speeds.push(Math.hypot(t.vx, t.vz));
    }
    expect(speeds[2]).toBeLessThan(12);
    expect(speeds[60]).toBeGreaterThan(speeds[20]);
    expect(speeds[85]).toBeGreaterThan(speeds[60]);
    // Jetzt geht der zweite.
    host.step(PRESS);
    expect(a.item).toBe(ITEM_NONE);
    expect(a.plant).toBe(DRILL_PLANT_TICKS);
  });

  it('erreicht auf allen 25 Strecken den Führenden in höchstens 10 s, bricht direkt vor ihm durch und haut ihn um wie ein Kreisel – nie den Werfer', () => {
    const rows: string[] = [];
    let worst = 0;
    for (let ti = 0; ti < TRACK_COUNT; ti++) {
      setTrack(ti);
      for (const ahead of [60, 320]) {
        const r = drillRun(race(ahead));
        rows.push(`${TRACK.def.name.padEnd(19)} ${String(ahead).padStart(3)} m: durch nach ${(r.surface / 60).toFixed(2)} s, Explosion nach ${(r.boom / 60).toFixed(2)} s, Abstand ${r.dist.toFixed(1)} m`);
        worst = Math.max(worst, r.boom);
        expect(r.surface, `${TRACK.def.name} ${ahead} m`).toBeGreaterThan(DRILL_DIG_TICKS);
        expect(r.surface, `${TRACK.def.name} ${ahead} m`).toBeLessThanOrEqual(DRILL_ARRIVE_MAX);
        expect(r.boom, `${TRACK.def.name} ${ahead} m`).toBeLessThanOrEqual(600);
        expect(r.target).toBe(1);
        expect([...r.targets]).toEqual([1]);
        expect(r.hit, `${TRACK.def.name} ${ahead} m: Treffer`).toBe(true);
        expect(r.dist).toBeLessThan(9);
        expect(r.ownerSpun).toBe(false);
      }
    }
    console.log(rows.join('\n'));
    console.log(`längste Zeit bis zur Explosion: ${(worst / 60).toFixed(2)} s`);
  }, 300000);

  it('fast eine halbe Runde Vorsprung: spätestens nach 10 s da – auch auf den langen Strecken', () => {
    const rows: string[] = [];
    for (let ti = 0; ti < TRACK_COUNT; ti++) {
      setTrack(ti);
      const r = drillRun(race(Math.round(TRACK.length * 0.45)));
      rows.push(`${TRACK.def.name.padEnd(19)} ${Math.round(TRACK.length * 0.45)} m: durch nach ${(r.surface / 60).toFixed(2)} s, Explosion nach ${(r.boom / 60).toFixed(2)} s, ${r.hit ? 'Treffer' : 'kein Treffer'}`);
      expect(r.surface).toBeLessThanOrEqual(DRILL_ARRIVE_MAX);
      expect(r.boom).toBeLessThanOrEqual(600);
      expect(r.targets.has(0)).toBe(false);
      expect(r.ownerSpun).toBe(false);
    }
    console.log(rows.join('\n'));
  }, 300000);

  it('Abzweigungen: fährt das Ziel durch eine Abzweigung, findet er es dort', () => {
    let tested = 0;
    const rows: string[] = [];
    for (let ti = 0; ti < TRACK_COUNT; ti++) {
      setTrack(ti);
      const t = TRACK;
      // eine Abzweigung, die für alle offen ist, ohne Größentor
      const k = t.branches.findIndex((b, i) => t.branchOnly[i] === 0 && b.count > 80);
      if (k < 0) continue;
      const br = t.branches[k];
      const host = race(300, Math.max(30, (br.from - 150) * t.step));
      host.debugPlace(1, 40, 0, k);
      host.step(GAS);
      const r = drillRun(host);
      const o = host.authoritative(1)!;
      const flying = (o.flags & FLAG_AIR) !== 0;
      rows.push(`${t.def.name.padEnd(19)} Abzweigung ${k}: Explosion nach ${(r.boom / 60).toFixed(2)} s, ${r.hit ? `Treffer (${r.dist.toFixed(1)} m)` : flying ? 'Ziel war in der Luft' : 'kein Treffer'}`);
      expect(r.boom, t.def.name).toBeLessThanOrEqual(600);
      expect(r.targets.has(0)).toBe(false);
      // (Wer bei Ablauf der 9,2 s noch fliegt – Sprung durch den hohlen Baumriesen –, dem geht er nicht in die Luft nach.)
      if (flying) expect(r.surface).toBe(DRILL_ARRIVE_MAX);
      else expect(r.hit, `${t.def.name}: Treffer`).toBe(true);
      tested++;
    }
    console.log(rows.join('\n'));
    expect(tested).toBeGreaterThan(5);
  }, 120000);

  it('liegt der Werfer selbst vorn, sucht er den Zweiten; wechselt die Führung, sucht er den neuen Führenden', () => {
    setTrack(0);
    let host = race(-150, 400);
    // Anna führt, Kart 2 (350 m) ist Zweiter vor Kart 3 (320 m) und Kart 1 (250 m).
    let r = drillRun(host);
    expect([...r.targets]).toEqual([2]);
    expect(r.hit).toBe(true);
    expect(r.ownerSpun).toBe(false);
    // Führungswechsel unterwegs: Kart 3 setzt sich vor Kart 1.
    host = race(300);
    let moved = false;
    r = drillRun(host, {
      each: (d) => {
        if (!moved && d && d.age > 150) {
          moved = true;
          place(host, 3, progressOf(host, 1) * TRACK.step + 60);
        }
      },
    });
    expect(moved).toBe(true);
    expect(r.targets.has(1)).toBe(true);
    expect(r.target).toBe(3);
    expect(r.hit).toBe(true);
    expect(r.boom).toBeLessThanOrEqual(600);
  });

  it('Stoßfänger fängt die Explosion ab, Get Gold lässt sie abprallen', () => {
    setTrack(0);
    let host = race(200);
    const b = host.authoritative(1)!;
    b.guard = GUARD_TICKS;
    let r = drillRun(host);
    expect(r.target).toBe(1);
    expect(r.hit).toBe(false);
    expect(b.spin).toBe(0);
    expect(b.guard).toBe(0);
    host = race(200);
    const g = host.authoritative(1)!;
    r = drillRun(host, {
      each: () => {
        g.gold = GOLD_TICKS;
      },
    });
    expect(r.target).toBe(1);
    expect(g.spin).toBe(0);
    expect(g.gold).toBeGreaterThan(0);
  });

  it('ein Ziel in der Luft: er fährt unter ihm mit und bricht durch, wenn es wieder Boden hat', () => {
    setTrack(0);
    const host = race(200);
    let lifted = -1;
    const r = drillRun(host, {
      each: (d) => {
        // kurz vor dem geplanten Durchbruch: Kart 1 hoch in die Luft (es fällt gut 1,5 s)
        if (lifted < 0 && d && d.stage === 0 && d.age > DRILL_DIG_TICKS && d.ttl * 60 - DRILL_RISE_TICKS < 8) {
          lifted = d.age;
          const o = host.authoritative(1)!;
          const p = progressOf(host, 1) * TRACK.step;
          host.debugPlace(1, p, 0, -1, 12);
          o.vx = Math.sin(o.heading) * 20;
          o.vz = Math.cos(o.heading) * 20;
        }
      },
    });
    expect(lifted).toBeGreaterThan(0);
    expect(r.surface - lifted).toBeGreaterThan(40);
    expect(r.surface).toBeLessThanOrEqual(DRILL_ARRIVE_MAX);
    expect(r.hit).toBe(true);
  });

  it('steht im Snapshot (Alter, Abschnitt, Stufe, Ziel); das Einstecken sagt der Mitspieler selbst voraus', () => {
    setTrack(0);
    const host = race(200);
    host.giveItem(0, ITEM_DRILL);
    host.step(PRESS);
    for (let i = 0; i < DRILL_PLANT_TICKS + 120; i++) {
      noItems(host);
      host.step(GAS);
    }
    const d = drillOf(host)!;
    const snap = decodeSnapshot(new DataView(host.snapshot()))!;
    const s = snap.things.find((t) => t.kind === THING_DRILL)!;
    expect([s.id, s.age, s.seg, s.stage, s.target]).toEqual([d.id, d.age, d.seg, d.stage, d.target]);
    expect(s.x).toBeCloseTo(d.x, 3);
    expect(Math.hypot(s.vx, s.vz)).toBeGreaterThan(5);
    // Einstecken: dieselbe Rechnung auf beiden Seiten (stepKart)
    const k: KartState = gridState(0);
    const seg = 40;
    k.seg = seg;
    k.x = TRACK.px[seg];
    k.z = TRACK.pz[seg];
    k.y = TRACK.py[seg];
    k.heading = trackHeading(TRACK, seg);
    k.item = ITEM_DRILL;
    const env = { canDrive: true, speedFactor: 1, time: 0 };
    stepKart(k, PRESS, env);
    expect(k.plant).toBe(DRILL_PLANT_TICKS);
    for (let i = 0; i < DRILL_PLANT_TICKS; i++) stepKart(k, GAS, env);
    expect(k.plant).toBe(0);
    expect(Math.abs(rightX(TRACK, seg)) + Math.abs(rightZ(TRACK, seg))).toBeGreaterThan(0.5);
  });

  it('die KI setzt ihn ein, wenn sie nicht vorn liegt – als Führende hebt sie ihn auf, gegen einen geschützten Führenden wartet sie', () => {
    setTrack(0);
    const presses = (place: number, leaderSafe: boolean, ticks: number): number => {
      const s = gridState(0);
      const seg = 60;
      s.seg = seg;
      s.x = TRACK.px[seg];
      s.z = TRACK.pz[seg];
      s.y = TRACK.py[seg];
      s.heading = trackHeading(TRACK, seg);
      s.item = ITEM_DRILL;
      const brain = newBrain(1);
      for (let tick = 0; tick < ticks; tick++) {
        const cmd = botCmd(s, brain, [], true, { tick, time: tick, place, smoke: false, leaderSafe });
        if (cmd.buttons & BTN_ITEM) return tick;
      }
      return -1;
    };
    expect(presses(1, false, 900)).toBe(-1);
    const t2 = presses(2, false, 200);
    expect(t2).toBeGreaterThan(40);
    expect(t2).toBeLessThan(80);
    expect(presses(4, false, 200)).toBeGreaterThan(40);
    // geschützt: erst wenn die Geduld reißt
    expect(presses(2, true, 140)).toBe(-1);
    expect(presses(2, true, 900)).toBeGreaterThan(140);
  });
});

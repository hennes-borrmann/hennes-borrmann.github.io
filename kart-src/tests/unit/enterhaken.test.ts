// Enterhaken: Die Figur schwingt ihn zwei Sekunden wie ein Lasso, wirft ihn in hohem Bogen auf den Fahrer vor ihr und zieht
// sich Zug um Zug an ihn heran – der Gezogene fährt unverändert weiter. Direkt hinter ihm lässt sie von selbst los: aufgeholt,
// nicht überholt. Ohne Ziel in Reichweite krallt er sich voraus in die Fahrbahn (ein kleiner Zeitgewinn). Am häufigsten auf
// Platz 2, dann 3 und 4, nie auf Platz 1.
// (sim.ts: ITEM_HOOK, KartState.hook/hookAim, stepHook, hookTarget; hostGame.ts: aimHook, Auslosung; ai.ts; protocol.ts.)

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import { ClientGame } from '../../src/game/clientGame';
import { HostGame } from '../../src/game/hostGame';
import {
  BTN_GAS,
  BTN_ITEM,
  CHARACTERS,
  FLAG_AIR,
  HOOK_ANCHOR,
  HOOK_FLY_TICKS,
  HOOK_LATCH,
  HOOK_MIN,
  HOOK_PULL_MAX,
  HOOK_RANGE,
  HOOK_REACH,
  HOOK_STOP,
  HOOK_SWING_TICKS,
  ITEM_COUNT,
  ITEM_HOOK,
  ITEM_KITE,
  ITEM_NONE,
  ITEM_ROCKET,
  NEUTRAL,
  V_MAX,
  forwardSpeed,
  gridState,
  hookTarget,
  newState,
  stepKart,
  type Cmd,
  type KartState,
} from '../../src/game/sim';
import { TRACK, TRACK_COUNT, groundNow, NO_GROUND, proj, projectOnTrack, segDelta, setTrack } from '../../src/game/track';
import { PROTOCOL_VERSION, RACE_RUNNING, decodeCmds, decodeSnapshot, encodeSnapshot } from '../../src/net/protocol';
import { withoutMechanics } from './helpers';

const FIRE: Cmd = { steer: 0, buttons: BTN_GAS | BTN_ITEM };
const GAS: Cmd = { steer: 0, buttons: BTN_GAS };
const ENV = { canDrive: true, speedFactor: 1, time: 0 };
/** Tick, in dem die Taste gedrückt wird (bis dahin sind alle auf Tempo). */
const FIRE_AT = 150;

afterAll(() => {
  setTrack(0);
});

/** Abstand auf der Strecke von a nach b in Metern (positiv: b liegt voraus). */
function gapOf(a: KartState, b: KartState): number {
  return segDelta(TRACK, a.seg, b.seg) * TRACK.step;
}

interface Verlauf {
  host: HostGame;
  /** Ziel beim Wurf (−1 = Fahrbahn), −9 = es kam nie zum Wurf. */
  aim: number;
  /** Ticks am Seil. */
  pulled: number;
  /** Abstand zu Platz 1 beim Wurf, als der Haken saß, kleinster im Zug, beim Loslassen, eine Sekunde danach. */
  gapThrow: number;
  gapLatch: number;
  gapMin: number;
  gapEnd: number;
  gapLater: number;
  /** Tempo beim Loslassen. */
  vEnd: number;
  /** Stürze des Auslösers im Zug und bis zwei Sekunden danach. */
  fell: number;
  /** Tick des Loslassens (−1 = nie). */
  released: number;
  /** Fortschritt (Meter ab dem Auslösen) nach `ticks` Schritten. */
  way: number;
}

/**
 * Ein Rennen auf der Strecke track: Der Auslöser (Platz 0, ein Mensch, gelenkt wie die KI mit vollem Können) steht bei start
 * Metern, Platz 1 (KI) gap Meter davor, die beiden anderen weit dahinter. Niemand sonst bekommt Items. Nach FIRE_AT Ticks
 * drückt der Auslöser die Taste (mit hook = false nicht – der Vergleichslauf). each läuft nach jedem Schritt.
 */
function lauf(track: number, start: number, gap: number, hook = true, ticks = 700, each?: (host: HostGame, i: number) => void): Verlauf {
  setTrack(track);
  const host = new HostGame(0);
  host.setRoster([0], true);
  host.newRace();
  while (host.phase !== RACE_RUNNING) host.step(NEUTRAL);
  const brain = newBrain(0, AI_MEDIUM);
  brain.skill = 1;
  host.debugPlace(0, start);
  host.debugPlace(1, start + gap, 1.2);
  host.debugPlace(2, start - 70);
  host.debugPlace(3, start - 90);
  const ctx = { tick: 0, time: 0, place: 2, smoke: false };
  const r: Verlauf = { host, aim: -9, pulled: 0, gapThrow: 0, gapLatch: 0, gapMin: Infinity, gapEnd: 0, gapLater: 0, vEnd: 0, fell: 0, released: -1, way: 0 };
  const progress = (): number => (host as unknown as { karts: Map<number, { progress: number }> }).karts.get(0)!.progress * TRACK.step;
  let from = 0;
  for (let i = 0; i < ticks; i++) {
    for (let s = 0; s < 4; s++) host.giveItem(s, ITEM_NONE);
    const a = host.authoritative(0)!;
    const others = [host.authoritative(1)!, host.authoritative(2)!, host.authoritative(3)!];
    ctx.tick = host.tick;
    ctx.time = host.tick - host.goTick;
    const cmd = botCmd(a, brain, others, true, ctx);
    cmd.buttons &= ~BTN_ITEM;
    if (i === FIRE_AT) {
      from = progress();
      if (hook) {
        host.giveItem(0, ITEM_HOOK);
        cmd.buttons |= BTN_ITEM;
      }
    }
    const before = a.hook;
    const down = a.respawn;
    host.step(cmd);
    each?.(host, i);
    const s = host.authoritative(0)!;
    const g = gapOf(s, host.authoritative(1)!);
    if (before > 0 && before <= HOOK_SWING_TICKS && s.hook > HOOK_SWING_TICKS) {
      r.aim = s.hookAim;
      r.gapThrow = g;
    }
    if (before > 0 && before <= HOOK_LATCH && s.hook > HOOK_LATCH) r.gapLatch = g;
    if (s.hook > HOOK_LATCH) {
      r.pulled++;
      r.gapMin = Math.min(r.gapMin, g);
    }
    if (before > 0 && s.hook === 0 && r.released < 0) {
      r.released = i;
      r.gapEnd = g;
      r.vEnd = forwardSpeed(s);
    }
    if (r.released >= 0 && i === r.released + 60) r.gapLater = g;
    const watch = i >= FIRE_AT + HOOK_LATCH - 1 && (hook ? r.released < 0 || i < r.released + 120 : i < FIRE_AT + HOOK_LATCH + 300);
    if (watch && down === 0 && s.respawn > 0) r.fell++;
  }
  r.way = progress() - from;
  return r;
}

describe('Enterhaken', () => {
  beforeEach(() => {
    setTrack(0);
  });

  it('Auslösen: zwei Sekunden schwingen, eine halbe fliegt er – das Kart fährt dabei normal weiter; ein zweiter bleibt solange in der Hand', () => {
    withoutMechanics(() => {
      const s = gridState(0);
      const frei = gridState(0);
      for (let i = 0; i < 90; i++) {
        stepKart(s, GAS, ENV);
        stepKart(frei, GAS, ENV);
      }
      s.item = ITEM_HOOK;
      stepKart(s, FIRE, ENV);
      stepKart(frei, GAS, ENV);
      expect(s.item).toBe(ITEM_NONE);
      expect(s.hook).toBe(1);
      expect(s.hookAim).toBe(-1);
      // Ein zweiter Haken, solange der erste unterwegs ist, bleibt aufgehoben.
      s.item = ITEM_HOOK;
      stepKart(s, GAS, ENV);
      stepKart(s, FIRE, ENV);
      stepKart(frei, GAS, ENV);
      stepKart(frei, GAS, ENV);
      expect(s.item).toBe(ITEM_HOOK);
      s.item = ITEM_NONE;
      // Bis zum Wurf und während des Flugs fährt das Kart genau so wie ohne Haken.
      let n = 3;
      while (s.hook > 0 && s.hook < HOOK_LATCH) {
        stepKart(s, GAS, ENV);
        stepKart(frei, GAS, ENV);
        n++;
        expect(s.x).toBe(frei.x);
        expect(s.z).toBe(frei.z);
        expect(s.vx).toBe(frei.vx);
      }
      expect(n).toBe(HOOK_LATCH);
      expect(HOOK_SWING_TICKS).toBe(120);
      expect(HOOK_LATCH).toBe(HOOK_SWING_TICKS + HOOK_FLY_TICKS);
      // Ohne Host hat er kein Ziel (es gilt die Stelle des Auslösens, die längst hinter dem Kart liegt): Er ist sofort wieder los.
      stepKart(s, GAS, ENV);
      expect(s.hook).toBe(0);
      expect(s.respawn).toBe(0);
    });
  });

  it('Wen er trifft: den Nächsten voraus zwischen HOOK_MIN und der Reichweite – nicht, wer neu aufgesetzt wird oder als Rakete fliegt', () => {
    const t = TRACK;
    const at = (meters: number): KartState => {
      const s = newState();
      s.seg = Math.round(meters / t.step);
      s.x = t.px[s.seg];
      s.z = t.pz[s.seg];
      s.y = t.py[s.seg];
      return s;
    };
    const me = at(100);
    const nah = at(100 + HOOK_MIN - 2);
    const mitte = at(125);
    const weit = at(100 + HOOK_RANGE - 3);
    const fern = at(100 + HOOK_REACH + 6);
    const hinten = at(80);
    expect(hookTarget(t, me, [hinten, fern], HOOK_RANGE)).toBe(-1);
    expect(hookTarget(t, me, [hinten, nah], HOOK_RANGE)).toBe(-1);
    expect(hookTarget(t, me, [me, hinten, weit, mitte, fern], HOOK_RANGE)).toBe(3);
    expect(hookTarget(t, me, [weit, fern], HOOK_RANGE)).toBe(0);
    // Beim Wurf reicht er etwas weiter als das Fadenkreuz.
    const knapp = at(100 + HOOK_RANGE + 5);
    expect(hookTarget(t, me, [knapp], HOOK_RANGE)).toBe(-1);
    expect(hookTarget(t, me, [knapp], HOOK_REACH)).toBe(0);
    mitte.respawn = 20;
    expect(hookTarget(t, me, [mitte, weit], HOOK_RANGE)).toBe(1);
    mitte.respawn = 0;
    mitte.rocket = 5;
    expect(hookTarget(t, me, [mitte, weit], HOOK_RANGE)).toBe(1);
    expect(HOOK_REACH).toBeGreaterThan(HOOK_RANGE);
  });

  it('zieht den Auslöser an den Fahrer vor ihm heran und lässt direkt dahinter los: aufgeholt, nicht überholt', () => {
    const r = lauf(0, 100, 55);
    console.log(
      `Enterhaken mit Ziel: Wurf bei ${r.gapThrow.toFixed(1)} m, sitzt bei ${r.gapLatch.toFixed(1)} m, ${r.pulled} Ticks Zug, los bei ${r.gapEnd.toFixed(1)} m mit ${r.vEnd.toFixed(1)} m/s, 1 s später ${r.gapLater.toFixed(1)} m`,
    );
    expect(r.aim).toBe(1);
    expect(r.gapLatch).toBeGreaterThan(15);
    expect(r.pulled).toBeGreaterThan(40);
    expect(r.pulled).toBeLessThan(HOOK_PULL_MAX);
    // Direkt dahinter: näher als fünf Meter, aber nie auf gleicher Höhe oder vorbei – auch eine Sekunde später nicht.
    expect(r.gapEnd).toBeLessThanOrEqual(HOOK_STOP + 1.2);
    expect(r.gapEnd).toBeGreaterThan(1.5);
    expect(r.gapMin).toBeGreaterThan(1.5);
    expect(r.gapLater).toBeGreaterThan(0.9);
    expect(r.gapLater).toBeLessThan(12);
    // Losgelassen wird mit dem gewöhnlichen Höchsttempo, nicht mit dem der Leine.
    expect(r.vEnd).toBeLessThanOrEqual(V_MAX * CHARACTERS[0].vmax + 1);
    expect(r.fell).toBe(0);
  });

  it('der Gezogene fährt unverändert weiter: Er merkt von Haken und Leine nichts', () => {
    // Zwei Rennen mit denselben Eingaben für den Gezogenen (Platz 1, ein Mitspieler, der fährt, als wäre er allein) – einmal
    // hängt sich Platz 0 an ihn, einmal nicht. Bis der Auslöser bei ihm ankommt, ist Platz 1 Tick für Tick gleich.
    const spur = (hook: boolean): { x: number[]; z: number[]; v: number[]; latch: number; released: number; aim: number } => {
      setTrack(0);
      const host = new HostGame(0);
      host.setRoster([0, 1], false);
      host.newRace();
      while (host.phase !== RACE_RUNNING) host.step(NEUTRAL);
      host.debugPlace(0, 100);
      host.debugPlace(1, 140, 1.2);
      const mine = newBrain(0, AI_MEDIUM);
      mine.skill = 1;
      const theirs = newBrain(1, AI_MEDIUM);
      const out = { x: [] as number[], z: [] as number[], v: [] as number[], latch: -1, released: -1, aim: -9 };
      for (let i = 0; i < 520; i++) {
        host.giveItem(0, ITEM_NONE);
        host.giveItem(1, ITEM_NONE);
        const time = host.tick - host.goTick;
        const o = host.authoritative(1)!;
        const their = botCmd(o, theirs, [], true, { tick: host.tick, time, place: 1, smoke: false });
        their.buttons &= ~BTN_ITEM;
        host.receiveCmds(1, i + 1, [their], [time + 1], host.raceId);
        const a = host.authoritative(0)!;
        const cmd = botCmd(a, mine, [o], true, { tick: host.tick, time, place: 2, smoke: false });
        cmd.buttons &= ~BTN_ITEM;
        if (i === FIRE_AT && hook) {
          host.giveItem(0, ITEM_HOOK);
          cmd.buttons |= BTN_ITEM;
        }
        const before = a.hook;
        host.step(cmd);
        if (before <= HOOK_SWING_TICKS && a.hook > HOOK_SWING_TICKS) out.aim = a.hookAim;
        if (before <= HOOK_LATCH && a.hook > HOOK_LATCH) out.latch = i;
        if (before > 0 && a.hook === 0 && out.released < 0) out.released = i;
        out.x.push(o.x);
        out.z.push(o.z);
        out.v.push(forwardSpeed(o));
      }
      return out;
    };
    const mit = spur(true);
    const ohne = spur(false);
    expect(mit.aim).toBe(1);
    expect(mit.released).toBeGreaterThan(mit.latch + 30);
    // (Bis kurz vor dem Loslassen: Danach fahren zwei Karts dicht hintereinander, da kann es rempeln.)
    const bis = mit.released - 5;
    for (let i = 0; i < bis; i++) {
      expect(mit.x[i]).toBe(ohne.x[i]);
      expect(mit.z[i]).toBe(ohne.z[i]);
      expect(mit.v[i]).toBe(ohne.v[i]);
    }
    // … und er ist dabei wirklich gefahren.
    expect(mit.v[bis - 1]).toBeGreaterThan(15);
  });

  it('ohne Ziel in Reichweite: Der Haken krallt sich voraus in die Fahrbahn – ein kurzer Zug nach vorn, ein kleiner Zeitgewinn', () => {
    let aimAt: { x: number; y: number; z: number; seg: number } | null = null;
    let own: { seg: number } | null = null;
    const mit = lauf(0, 100, 400, true, 520, (host) => {
      const s = host.authoritative(0)!;
      if (s.hook === HOOK_SWING_TICKS + 1) {
        aimAt = { x: s.aimX, y: s.aimY, z: s.aimZ, seg: s.aimSeg };
        own = { seg: s.seg };
      }
    });
    const ohne = lauf(0, 100, 400, false, 520);
    expect(mit.aim).toBe(-1);
    expect(aimAt).not.toBeNull();
    // Der Ankerpunkt liegt HOOK_ANCHOR Meter voraus auf der Fahrbahn.
    const a = aimAt!;
    expect(segDelta(TRACK, own!.seg, a.seg) * TRACK.step).toBeGreaterThan(HOOK_ANCHOR - 3);
    expect(segDelta(TRACK, own!.seg, a.seg) * TRACK.step).toBeLessThan(HOOK_ANCHOR + 3);
    projectOnTrack(TRACK, a.x, a.z, a.seg);
    expect(Math.abs(proj.lat)).toBeLessThan(TRACK.rh[proj.seg]);
    const g = groundNow(TRACK, proj.seg, proj.along, proj.lat, 0);
    expect(g).not.toBe(NO_GROUND);
    expect(Math.abs(a.y - g)).toBeLessThan(0.3);
    // Der Zug ist kurz (unter anderthalb Sekunden) und bringt ein paar Meter – weniger als ein Zisch, mehr als nichts.
    expect(mit.pulled).toBeGreaterThan(20);
    expect(mit.pulled).toBeLessThan(90);
    const gewinn = mit.way - ohne.way;
    console.log(`Enterhaken ohne Ziel: ${mit.pulled} Ticks Zug, Gewinn ${gewinn.toFixed(1)} m (${(gewinn / V_MAX).toFixed(2)} s)`);
    expect(gewinn).toBeGreaterThan(4);
    expect(gewinn).toBeLessThan(17);
    expect(mit.fell).toBe(0);
  });

  it('wer zu nah dran ist, ist kein Ziel mehr: Dann zieht der Haken an der Fahrbahn vorbei', () => {
    const r = lauf(0, 100, HOOK_MIN + 2);
    expect(r.gapThrow).toBeLessThan(HOOK_MIN);
    expect(r.aim).toBe(-1);
  });

  it('ein Treffer nimmt den Haken: im Schwung fällt er aus der Hand, im Zug reißt die Leine', () => {
    for (const wann of [FIRE_AT + 60, FIRE_AT + HOOK_LATCH + 20]) {
      let hit = -1;
      const r = lauf(0, 100, 55, true, 420, (host, i) => {
        if (i !== wann) return;
        expect(host.authoritative(0)!.hook).toBeGreaterThan(0);
        host.debugHit(0);
        hit = host.authoritative(0)!.hook;
        expect(host.authoritative(0)!.spin).toBeGreaterThan(0);
      });
      expect(hit).toBe(0);
      expect(r.released).toBe(wann);
      if (wann < FIRE_AT + HOOK_SWING_TICKS) expect(r.aim).toBe(-9);
    }
  });

  it('ist der Gezogene nicht mehr zu halten (abgestürzt, als Rakete davon, im Ziel), ist der Haken los', () => {
    const r = lauf(0, 100, 55, true, 420, (host, i) => {
      if (i === FIRE_AT + HOOK_LATCH + 12) host.authoritative(1)!.respawn = 40;
    });
    expect(r.aim).toBe(1);
    expect(r.released).toBe(FIRE_AT + HOOK_LATCH + 13);
    expect(r.gapEnd).toBeGreaterThan(8);
    expect(r.fell).toBe(0);
  });

  it('Drache und Rakete lösen ihn ab; wer nicht mehr fahren darf, lässt ihn fallen', () => {
    withoutMechanics(() => {
      for (const item of [ITEM_KITE, ITEM_ROCKET]) {
        const s = gridState(0);
        for (let i = 0; i < 60; i++) stepKart(s, GAS, ENV);
        s.item = ITEM_HOOK;
        stepKart(s, FIRE, ENV);
        for (let i = 0; i < 30; i++) stepKart(s, GAS, ENV);
        expect(s.hook).toBe(31);
        s.item = item;
        stepKart(s, FIRE, ENV);
        expect(s.hook).toBe(0);
        expect(item === ITEM_KITE ? s.tow : s.rocket).toBeGreaterThan(0);
      }
      const s = gridState(0);
      s.item = ITEM_HOOK;
      stepKart(s, FIRE, ENV);
      stepKart(s, GAS, ENV);
      expect(s.hook).toBe(2);
      stepKart(s, GAS, { canDrive: false, speedFactor: 1, time: 0 });
      expect(s.hook).toBe(0);
    });
  });

  it('Auslosung: nie auf Platz 1 (und nie allein), am häufigsten auf Platz 2, dann 3, dann 4', () => {
    const host = new HostGame(0);
    host.setRoster([0, 1, 2, 3], false);
    const pick = (host as unknown as { pickItem(place: number, count: number, behind?: number): number }).pickItem.bind(host);
    const N = 12000;
    const share = (place: number, count: number, behind = 0): number => {
      let n = 0;
      for (let i = 0; i < N; i++) if (pick(place, count, behind) === ITEM_HOOK) n++;
      return n / N;
    };
    for (const count of [1, 2, 3, 4]) expect(share(1, count)).toBe(0);
    const [p2, p3, p4] = [share(2, 4), share(3, 4), share(4, 4)];
    console.log(`Enterhaken je Platz (vier Fahrer): 0 / ${[p2, p3, p4].map((x) => (x * 100).toFixed(1) + ' %').join(' / ')}`);
    expect(p2).toBeGreaterThan(0.12);
    expect(p2).toBeLessThan(0.18);
    expect(p3).toBeGreaterThan(0.075);
    expect(p3).toBeLessThan(0.12);
    expect(p4).toBeGreaterThan(0.05);
    expect(p4).toBeLessThan(0.095);
    expect(p2).toBeGreaterThan(p3 + 0.02);
    expect(p3).toBeGreaterThan(p4 + 0.008);
    // Auch zu zweit und zu dritt bekommt ihn der Zweite am häufigsten; mit großem Rückstand (Drache in der Auslosung) bleibt er drin.
    expect(share(2, 2)).toBeGreaterThan(0.11);
    expect(share(2, 3)).toBeGreaterThan(share(3, 3) + 0.02);
    expect(share(4, 4, 200)).toBeGreaterThan(0.04);
    // Jedes Item hat weiter seinen Platz in der Tabelle: Der Haken passt in vier Bit (Snapshot), und die Zählung stimmt.
    expect(ITEM_HOOK).toBe(15);
    expect(ITEM_COUNT).toBe(16);
  });

  it('Snapshot: Zähler (über 255 hinaus), Ziel und Ankerpunkt kommen an; das Protokoll hat eine neue Nummer', () => {
    const s = gridState(1);
    s.item = ITEM_HOOK;
    s.nextItem = ITEM_HOOK;
    s.hook = HOOK_LATCH + HOOK_PULL_MAX + 1;
    s.hookAim = 3;
    s.aimX = 12.5;
    s.aimY = -3.25;
    s.aimZ = 801.75;
    s.aimSeg = 1234;
    s.aimV = 27.5;
    const snap = decodeSnapshot(
      new DataView(
        encodeSnapshot({
          tick: 5,
          raceId: 1,
          phase: RACE_RUNNING,
          goTick: 0,
          laps: 3,
          boxes: 0,
          track: 0,
          karts: [
            { slot: 1, bot: false, ptick: 1, ack: 1, state: s, lap: 1, place: 2, finished: false, finishTicks: 0 },
            { slot: 2, bot: true, ptick: 1, ack: 0, state: { ...s, hook: 0, hookAim: -1, aimV: 0 }, lap: 1, place: 3, finished: false, finishTicks: 0 },
          ],
          things: [],
        }),
      ),
    )!;
    const d = snap.karts[0].state;
    expect(d.item).toBe(ITEM_HOOK);
    expect(d.nextItem).toBe(ITEM_HOOK);
    expect(d.hook).toBe(HOOK_LATCH + HOOK_PULL_MAX + 1);
    expect(d.hook).toBeGreaterThan(255);
    expect(d.hookAim).toBe(3);
    expect([d.aimX, d.aimY, d.aimZ, d.aimSeg, d.aimV]).toEqual([12.5, -3.25, 801.75, 1234, 27.5]);
    expect(snap.karts[1].state.hookAim).toBe(-1);
    expect(snap.karts[1].lap).toBe(1);
    expect(snap.karts[1].place).toBe(3);
    expect(PROTOCOL_VERSION).toBeGreaterThanOrEqual(30);
  });

  it('Mitspieler über die Leitung: Vorhersage und Host bleiben beim Zug beieinander', () => {
    // Host (Platz 0, KI-gelenkt) fährt voraus, der Mitspieler (Platz 1) hängt sich mit 60 ms Laufzeit je Richtung an ihn.
    setTrack(0);
    const LAG = 60;
    const host = new HostGame(0);
    host.setRoster([0, 1], false);
    host.newRace();
    const client = new ClientGame(1, () => LAG * 2);
    const brainHost = newBrain(0, AI_MEDIUM);
    const brainClient = newBrain(1, AI_MEDIUM);
    brainClient.skill = 1;
    const up: { at: number; data: ArrayBuffer }[] = [];
    const down: { at: number; data: ArrayBuffer }[] = [];
    const stepMs = 1000 / 60;
    let hostAcc = 0;
    let clientAcc = 5;
    let placed = false;
    let fireIn = -1;
    let peak = 0;
    let pulledHost = 0;
    let pulledClient = 0;
    let done = -1;
    let endGap = 0;
    let minGap = Infinity;
    for (let now = 0; now < 20000 && (done < 0 || now < done + 1500); now++) {
      for (let i = up.length - 1; i >= 0; i--) {
        if (up[i].at > now) continue;
        const c = decodeCmds(new DataView(up[i].data))!;
        host.receiveCmds(1, c.newestSeq, c.cmds, c.times, c.raceId);
        up.splice(i, 1);
      }
      for (let i = down.length - 1; i >= 0; i--) {
        if (down[i].at > now) continue;
        client.onSnapshot(decodeSnapshot(new DataView(down[i].data))!, now / 1000);
        if (client.predictedState().hook > 0) peak = Math.max(peak, client.stats.lastCorrection);
        down.splice(i, 1);
      }
      hostAcc += 1;
      while (hostAcc >= stepMs) {
        hostAcc -= stepMs;
        host.giveItem(0, ITEM_NONE);
        if (host.phase === RACE_RUNNING && !placed && host.tick - host.goTick > 150) {
          // Beide rollen schon: der Mitspieler 40 m hinter den Host setzen und gleich auslösen lassen.
          placed = true;
          host.debugPlace(1, 200);
          host.debugPlace(0, 240, 1);
          host.giveItem(1, ITEM_HOOK);
          fireIn = 50;
        }
        const a = host.authoritative(0)!;
        const hostTime = host.tick - host.goTick;
        host.step(botCmd(a, brainHost, [], host.localCanDrive(), { tick: host.tick, time: hostTime, place: 1, smoke: false }));
        const s = host.authoritative(1)!;
        if (s.hook > HOOK_LATCH) {
          pulledHost++;
          minGap = Math.min(minGap, gapOf(s, host.authoritative(0)!));
        }
        if (placed && fireIn < -200 && s.hook === 0 && done < 0) {
          done = now;
          endGap = gapOf(s, host.authoritative(0)!);
        }
        if (host.tick % 2 === 0) down.push({ at: now + LAG, data: host.snapshot() });
      }
      clientAcc += 1;
      while (clientAcc >= stepMs) {
        clientAcc -= stepMs;
        const t = now / 1000;
        const time = Math.floor(client.race(t).time);
        const cmd = client.ready ? botCmd(client.predictedState(), brainClient, [], client.localCanDrive(t), { tick: time, time, place: 2, smoke: false }) : { ...NEUTRAL };
        cmd.buttons &= ~BTN_ITEM;
        if (fireIn >= 0 && fireIn-- === 0) cmd.buttons |= BTN_ITEM;
        else if (fireIn < 0 && placed) fireIn--;
        if (client.predictedState().hook > HOOK_LATCH) pulledClient++;
        const pkt = client.tick(cmd, t);
        if (pkt) up.push({ at: now + LAG, data: pkt });
      }
    }
    console.log(`Enterhaken über die Leitung: Host ${pulledHost} Ticks Zug, Vorhersage ${pulledClient}, größte Korrektur ${peak.toFixed(2)} m, los bei ${endGap.toFixed(1)} m`);
    expect(done).toBeGreaterThan(0);
    expect(pulledHost).toBeGreaterThan(30);
    // Die Vorhersage zieht (fast) genauso lange wie der Host – und springt dabei nie: Korrekturen bleiben klein.
    expect(Math.abs(pulledClient - pulledHost)).toBeLessThan(12);
    expect(peak).toBeLessThan(1.5);
    expect(endGap).toBeLessThanOrEqual(HOOK_STOP + 1.5);
    expect(minGap).toBeGreaterThan(1.2);
    expect(client.predictedState().hook).toBe(0);
  });

  it('KI: holt aus, sobald jemand in Reichweite vor ihr fährt – und sonst nach einer Weile auf gut Glück', () => {
    for (const gap of [28, 400]) {
      setTrack(0);
      const host = new HostGame(0);
      host.setRoster([0], true);
      host.newRace();
      while (host.phase !== RACE_RUNNING) host.step(NEUTRAL);
      host.debugPlace(0, 30);
      host.debugPlace(2, 200);
      host.debugPlace(1, 200 + gap, 1.2);
      host.debugPlace(3, 60);
      let used = -1;
      let aim = -9;
      for (let i = 0; i < 1500 && aim === -9; i++) {
        for (const s of [0, 1, 3]) host.giveItem(s, ITEM_NONE);
        const b = host.authoritative(2)!;
        if (i >= 100 && used < 0 && b.hook === 0) host.giveItem(2, ITEM_HOOK);
        else if (b.item !== ITEM_HOOK) host.giveItem(2, ITEM_NONE);
        host.step(NEUTRAL);
        if (used < 0 && b.hook > 0) used = i;
        if (b.hook === HOOK_SWING_TICKS + 1) aim = b.hookAim;
      }
      expect(used).toBeGreaterThan(100);
      if (gap < HOOK_RANGE) {
        // In Reichweite: bald – und der Haken trifft den Fahrer davor.
        expect(used).toBeLessThan(100 + 90);
        expect(aim).toBe(1);
      } else {
        expect(used).toBeGreaterThan(100 + 90);
        expect(aim).toBe(-1);
      }
    }
  });
});

describe('Enterhaken auf allen Strecken', () => {
  it('niemand stürzt am Haken ab oder bleibt hängen – mit Ziel wie ohne, an acht Stellen jeder Strecke', () => {
    const odd: string[] = [];
    let total = 0;
    let caught = 0;
    for (let tr = 0; tr < TRACK_COUNT; tr++) {
      setTrack(tr);
      const len = TRACK.n * TRACK.step;
      const name = TRACK.def.name;
      for (let k = 0; k < 8; k++) {
        const start = 40 + (k / 8) * (len - 80);
        for (const gap of [30, 400]) {
          const r = lauf(tr, start, gap, true, 640);
          total++;
          if (r.aim >= 0 && r.gapEnd > 0 && r.gapEnd <= HOOK_STOP + 2) caught++;
          // Abgestürzt (und zwar nur mit Haken)? Länger am Seil als erlaubt?
          if (r.fell > 0 && lauf(tr, start, gap, false, 640).fell === 0) odd.push(`${name} @${start.toFixed(0)} +${gap}: am Haken abgestürzt`);
          if (r.pulled > HOOK_PULL_MAX + 90) odd.push(`${name} @${start.toFixed(0)} +${gap}: ${r.pulled} Ticks am Seil`);
          if (r.aim !== -9 && r.released < 0) odd.push(`${name} @${start.toFixed(0)} +${gap}: nie losgelassen`);
          // Mit Ziel nie daran vorbei: Der kleinste Abstand im Zug bleibt (bis auf einen Rempler) vor dem Auslöser.
          if (r.aim === 1 && r.pulled > 0 && r.gapMin < -3.5) odd.push(`${name} @${start.toFixed(0)} +${gap}: am Ziel vorbeigezogen (${r.gapMin.toFixed(1)} m)`);
        }
      }
    }
    console.log(`Enterhaken auf allen Strecken: ${total} Läufe, ${caught} davon bis direkt hinter das Ziel gezogen`);
    expect(odd).toEqual([]);
    // In gut der Hälfte der Läufe mit Ziel kommt man wirklich bis hinter den anderen (sonst: Flugstrecke, Verkehr, Treffer).
    expect(caught).toBeGreaterThan(total / 4);
    setTrack(0);
  }, 240000);

  it('im Flug über eine Lücke eingehakt: Die Leine trägt hinüber und setzt erst auf festem Boden ab', () => {
    // Suche auf allen Strecken eine Lücke ohne Flugstrecke und hake kurz davor ein.
    let tested = 0;
    for (let tr = 0; tr < TRACK_COUNT && tested < 3; tr++) {
      setTrack(tr);
      const t = TRACK;
      let first = -1;
      for (let i = 60; i < t.n - 120 && first < 0; i++) if ((t.edge[i] & 4) !== 0 && (t.edge[i] & 256) === 0 && (t.edge[i - 1] & 4) === 0 && t.branchOf[i] < 0) first = i;
      if (first < 0) continue;
      // Keine Flugstrecke in der Nähe (sonst fasst der Haken gar nicht erst).
      let glide = false;
      for (let i = first - 40; i < first + 120; i++) if ((t.edge[i] & 256) !== 0) glide = true;
      if (glide) continue;
      tested++;
      withoutMechanics(() => {
        const s = gridState(0);
        const seg = first - 10;
        s.seg = seg;
        s.x = t.px[seg];
        s.z = t.pz[seg];
        s.y = t.py[seg];
        s.heading = Math.atan2(t.tx[seg], t.tz[seg]);
        s.vx = t.tx[seg] * 24;
        s.vz = t.tz[seg] * 24;
        // Der Haken sitzt 70 m voraus in der Fahrbahn (hinter der Lücke).
        const aim = first + 70;
        s.hook = HOOK_LATCH;
        s.hookAim = -1;
        s.aimSeg = aim;
        s.aimX = t.px[aim];
        s.aimY = t.py[aim];
        s.aimZ = t.pz[aim];
        let overGap = 0;
        let fell = false;
        let n = 0;
        for (; n < 400 && s.hook > 0; n++) {
          stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: n });
          if (s.respawn > 0) fell = true;
          if ((t.edge[s.seg] & 4) !== 0) {
            overGap++;
            expect(s.flags & FLAG_AIR).toBe(FLAG_AIR);
          }
        }
        expect(fell).toBe(false);
        expect(overGap).toBeGreaterThan(0);
        expect(s.hook).toBe(0);
        // Losgelassen auf festem Boden, hinter der Lücke.
        expect(t.edge[s.seg] & 4).toBe(0);
        projectOnTrack(t, s.x, s.z, s.seg);
        expect(groundNow(t, proj.seg, proj.along, proj.lat, n)).not.toBe(NO_GROUND);
        for (let i = 0; i < 90; i++) {
          stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: n + i });
          if (s.respawn > 0) fell = true;
        }
        expect(fell).toBe(false);
      });
    }
    expect(tested).toBeGreaterThan(0);
    setTrack(0);
  });
});

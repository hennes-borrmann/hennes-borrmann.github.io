// Get Gold: goldene Flasche austrinken – sieben Sekunden gold, groß, schneller, unverwundbar, umfährt andere.
// (sim.ts: ITEM_GOLD, KartState.gold, goldOn; hostGame.ts: Auslosung, goldRam; ai.ts; protocol.ts.)

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import { HostGame } from '../../src/game/hostGame';
import { SIZE_TICKS } from '../../src/game/mechanics';
import {
  BTN_GAS,
  CHARACTERS,
  EV_FALL,
  EV_RESPAWNED,
  FLAG_OFFROAD,
  GOLD_ALL,
  GOLD_DRINK_TICKS,
  GOLD_TICKS,
  GUARD_TICKS,
  HIT_NONE,
  ITEM_EMP,
  ITEM_GOLD,
  ITEM_NONE,
  ITEM_OIL,
  ITEM_ROCKET,
  ITEM_TOP,
  NEUTRAL,
  ROCKET_TICKS,
  V_MAX,
  copyState,
  flattenKart,
  forwardSpeed,
  goldOn,
  gridState,
  hitKart,
  newState,
  stallKart,
  stepKart,
  type Cmd,
  type KartState,
} from '../../src/game/sim';
import { EDGE_GAP, TRACK, buildTrack, gateShut, proj, projectOnTrack, rightX, rightZ, setTrack, trackHeading, useTrack, type Track } from '../../src/game/track';
import { RACE_RUNNING, THING_OIL, THING_TOP, decodeSnapshot } from '../../src/net/protocol';
import { withoutMechanics } from './helpers';

const GAS: Cmd = { steer: 0, buttons: BTN_GAS };
const PRESS: Cmd = { steer: 0, buttons: BTN_GAS | 8 };
const ENV = { canDrive: true, speedFactor: 1, time: 0 };
const ZIMMER = 15;

afterAll(() => {
  setTrack(0);
});

/** Setzt ein Kart auf Abschnitt seg (seitlich lat), in Fahrtrichtung, mit Tempo v. */
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

function runningHost(humans: number[]): HostGame {
  const host = new HostGame(0);
  host.setRoster(humans, false);
  host.newRace();
  while (host.phase !== RACE_RUNNING) host.step(NEUTRAL);
  return host;
}

/** Prüfstrecke: flaches Oval mit zwei 300 m langen Geraden, 6 m Fahrbahn, 3 m Seitenstreifen, Untergrund nach Wahl. */
function oval(surface: 'asphalt' | 'meadow' | 'sand' = 'asphalt'): Track {
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
    surface,
    pads: [],
    boxRows: [],
  });
}

/** Der Abschnitt der ersten Geraden, 30 m hinter dem Start. */
const STRAIGHT = 15;

/** Fährt mit Vollgas geradeaus (die Spur lat wird gehalten) und liefert das höchste Tempo und den Anteil im Gelände. */
function run(s: KartState, ticks: number, lat = 0): { top: number; off: number } {
  const t = TRACK;
  let top = 0;
  let off = 0;
  for (let i = 0; i < ticks; i++) {
    projectOnTrack(t, s.x, s.z, s.seg);
    const steer = Math.round(Math.max(-1, Math.min(1, (lat - proj.lat) * 0.25)) * 127);
    stepKart(s, { steer, buttons: BTN_GAS }, ENV);
    top = Math.max(top, forwardSpeed(s));
    if (s.flags & FLAG_OFFROAD) off++;
  }
  return { top, off: off / ticks };
}

describe('Get Gold', () => {
  beforeEach(() => {
    setTrack(0);
  });

  it('gibt es auf jedem Platz, hinten deutlich häufiger (vorn 2–3, Mitte 6–7, hinten 10 von gut 100)', () => {
    const host = runningHost([0, 1, 2, 3]);
    const pick = (host as unknown as { pickItem(place: number, count: number, behind?: number): number }).pickItem.bind(host);
    const share = (place: number, count: number, behind = 0): number => {
      let n = 0;
      for (let i = 0; i < 8000; i++) if (pick(place, count, behind) === ITEM_GOLD) n++;
      return n / 8000;
    };
    const first = share(1, 4);
    const mid = share(2, 4);
    const third = share(3, 4);
    const last = share(4, 4);
    console.log(`Get Gold je Platz: ${[first, mid, third, last].map((x) => (x * 100).toFixed(1) + ' %').join(' / ')}`);
    expect(first).toBeGreaterThan(0.015);
    expect(first).toBeLessThan(0.045);
    for (const m of [mid, third]) {
      expect(m).toBeGreaterThan(0.045);
      expect(m).toBeLessThan(0.085);
    }
    expect(last).toBeGreaterThan(0.08);
    expect(last).toBeLessThan(0.125);
    expect(first).toBeLessThan(mid);
    expect(mid).toBeLessThan(last);
    // allein und zu zweit (dort ist Platz 2 der letzte)
    expect(share(1, 1)).toBeGreaterThan(0.02);
    expect(share(2, 2)).toBeGreaterThan(0.08);
    // Mit Drache (großer Rückstand) bleibt es dabei, nur etwas seltener.
    expect(share(4, 4, 200)).toBeGreaterThan(0.06);
  });

  it('Austrinken dauert 0,8 s, danach genau 7 s (420 Ticks) Gold; unverwundbar ab dem ersten Schluck; kein zweites, solange es läuft', () => {
    withoutMechanics(() => {
      const s = gridState(0);
      placeAt(s, 30, 0, 20);
      s.item = ITEM_GOLD;
      stepKart(s, PRESS, ENV);
      expect(s.item).toBe(ITEM_NONE);
      expect(s.gold).toBe(GOLD_ALL);
      expect(goldOn(s)).toBe(false);
      // Beim Trinken prallt schon alles ab – und das Kart fährt weiter.
      const probe = copyState(newState(), s);
      expect(hitKart(probe)).toBe(HIT_NONE);
      let drink = 0;
      while (!goldOn(s) && drink < 200) {
        stepKart(s, GAS, ENV);
        drink++;
      }
      expect(drink).toBe(GOLD_DRINK_TICKS);
      expect(forwardSpeed(s)).toBeGreaterThan(20);
      // Ein zweites Gold bleibt in der Hand.
      s.item = ITEM_GOLD;
      stepKart(s, NEUTRAL, ENV);
      stepKart(s, PRESS, ENV);
      expect(s.item).toBe(ITEM_GOLD);
      s.item = ITEM_NONE;
      let on = 2;
      while (goldOn(s)) {
        stepKart(s, GAS, ENV);
        on++;
      }
      expect(on).toBe(GOLD_TICKS);
      expect(s.gold).toBe(0);
      expect(hitKart(s)).not.toBe(HIT_NONE);
    });
  });

  it('etwas schneller (rund 11 %) – und nach dem Ende wieder normal', () => {
    useTrack(oval());
    const plain = gridState(0);
    placeAt(plain, STRAIGHT, 0, V_MAX);
    const normal = run(plain, 300).top;
    const s = gridState(0);
    placeAt(s, STRAIGHT, 0, V_MAX);
    s.gold = GOLD_TICKS;
    const gold = run(s, 300).top;
    console.log(`Höchsttempo ${normal.toFixed(2)} m/s, mit Get Gold ${gold.toFixed(2)} m/s (+${((gold / normal - 1) * 100).toFixed(1)} %)`);
    expect(normal).toBeLessThan(V_MAX * 1.01);
    expect(gold).toBeGreaterThan(normal * 1.08);
    expect(gold).toBeLessThan(normal * 1.14);
    // Abgelaufen: wieder Normaltempo.
    run(s, GOLD_TICKS);
    expect(s.gold).toBe(0);
    placeAt(s, STRAIGHT, 0, V_MAX);
    expect(run(s, 200).top).toBeLessThan(V_MAX * 1.01);
    setTrack(0);
  });

  it('neben der Fahrbahn und auf langsamem Grund (hohes Gras, Sand) bremst nichts', () => {
    useTrack(oval());
    const t = TRACK;
    const lat = t.rh[STRAIGHT] + 1.3;
    for (const gold of [0, GOLD_TICKS]) {
      const s = gridState(2);
      placeAt(s, STRAIGHT, lat, V_MAX);
      s.gold = gold;
      const r = run(s, 240, lat);
      console.log(`Seitenstreifen ${gold ? 'mit' : 'ohne'} Gold: ${r.top.toFixed(1)} m/s am Ende, ${(r.off * 100).toFixed(0)} % im Gelände`);
      expect(r.off).toBeGreaterThan(0.9);
      if (gold) expect(forwardSpeed(s)).toBeGreaterThan(V_MAX * 1.05);
      else expect(forwardSpeed(s)).toBeLessThan(V_MAX * 0.75);
    }
    for (const ground of ['meadow', 'sand'] as const) {
      useTrack(oval(ground));
      for (const gold of [0, GOLD_TICKS]) {
        const s = gridState(0);
        placeAt(s, STRAIGHT, 0, V_MAX * 0.5);
        s.gold = gold;
        run(s, 300);
        const v = forwardSpeed(s);
        if (gold) expect(v).toBeGreaterThan(V_MAX * 1.05);
        else expect(v).toBeLessThan(V_MAX * (ground === 'meadow' ? 0.6 : 0.95));
      }
    }
    setTrack(0);
  });

  it('die Bande bleibt Bande, Lücken bleiben Lücken (das Gold läuft im Sturz weiter)', () => {
    withoutMechanics(() => {
      const t = TRACK;
      for (const steer of [127, -127]) {
        const s = gridState(0);
        placeAt(s, 40, 0, V_MAX);
        s.gold = GOLD_TICKS;
        let worst = 0;
        for (let i = 0; i < 240; i++) {
          stepKart(s, { steer, buttons: BTN_GAS }, ENV);
          projectOnTrack(t, s.x, s.z, s.seg);
          worst = Math.max(worst, Math.abs(proj.lat) - t.wh[proj.seg]);
        }
        expect(worst).toBeLessThan(0.05);
      }
    });
    const t = setTrack(1);
    let gap = -1;
    for (let i = 0; i < t.n; i++) if (t.edge[i] & EDGE_GAP && gap < 0) gap = i;
    const s = gridState(0);
    placeAt(s, gap + 2, 0, 3);
    s.gold = GOLD_TICKS;
    let ev = 0;
    for (let i = 0; i < 200 && !(ev & EV_RESPAWNED); i++) ev |= stepKart(s, NEUTRAL, ENV);
    expect(ev & EV_FALL).toBeTruthy();
    expect(ev & EV_RESPAWNED).toBeTruthy();
    expect(goldOn(s)).toBe(true);
  });

  it('wen das Gold-Kart berührt, den haut es um wie ein Kreisel – das Gold-Kart wird nicht langsamer; der Stoßfänger fängt es ab', () => {
    for (const guard of [false, true]) {
      const host = runningHost([0, 1]);
      const fx: string[] = [];
      host.onFx = (slot, kind) => fx.push(`${slot}:${kind}`);
      host.debugPlace(0, 60, 0);
      host.debugPlace(1, 75, 0.6);
      const a = host.authoritative(0)!;
      const b = host.authoritative(1)!;
      a.vx = Math.sin(a.heading) * V_MAX;
      a.vz = Math.cos(a.heading) * V_MAX;
      a.gold = GOLD_TICKS;
      if (guard) b.guard = GUARD_TICKS;
      let slowest = Infinity;
      let touched = -1;
      for (let i = 0; i < 90; i++) {
        host.step(GAS);
        if (touched < 0 && Math.hypot(a.x - b.x, a.z - b.z) < 3.2) touched = i;
        if (touched >= 0) slowest = Math.min(slowest, forwardSpeed(a));
      }
      expect(touched).toBeGreaterThanOrEqual(0);
      expect(a.spin).toBe(0);
      // Das Gold-Kart fährt ungebremst hindurch (es zieht weiter an).
      expect(slowest).toBeGreaterThan(V_MAX * 0.97);
      if (guard) {
        expect(b.spin).toBe(0);
        expect(b.guard).toBe(0);
        expect(fx).toContain('1:block');
      } else {
        expect(fx).toContain('1:hit');
        expect(b.shield).toBeGreaterThan(0);
        // weggeworfen: zur Seite, das Gold-Kart ist vorbei
        projectOnTrack(TRACK, a.x, a.z, a.seg);
        const aheadA = proj.seg;
        projectOnTrack(TRACK, b.x, b.z, b.seg);
        expect(aheadA).toBeGreaterThan(proj.seg);
      }
      expect(fx).toContain('0:bump');
    }
  });

  it('zwei Gold-Karts rempeln sich nur, keins wird umgehauen', () => {
    const host = runningHost([0, 1]);
    host.debugPlace(0, 60, 0);
    host.debugPlace(1, 72, 0.4);
    const a = host.authoritative(0)!;
    const b = host.authoritative(1)!;
    a.vx = Math.sin(a.heading) * V_MAX;
    a.vz = Math.cos(a.heading) * V_MAX;
    a.gold = GOLD_TICKS;
    b.gold = GOLD_TICKS;
    for (let i = 0; i < 60; i++) host.step(GAS);
    expect(a.spin + b.spin).toBe(0);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(2.2);
  });

  it('unverwundbar: Treffer, Presse und Kurzschluss prallen ab – beim Trinken und als Gold', () => {
    for (const gold of [GOLD_ALL - 3, GOLD_TICKS - 5, 2]) {
      const s = gridState(0);
      s.gold = gold;
      s.guard = GUARD_TICKS;
      expect(hitKart(s)).toBe(HIT_NONE);
      expect(flattenKart(s)).toBe(HIT_NONE);
      expect(stallKart(s)).toBe(HIT_NONE);
      // Der Stoßfänger bleibt dabei unverbraucht.
      expect(s.guard).toBe(GUARD_TICKS);
      expect(s.spin + s.flat + s.stall).toBe(0);
    }
  });

  it('unverwundbar: Brummkreisel und Ölfleck prallen am Gold-Kart ab (und sind weg)', () => {
    // Kreisel: Anna (hinten) wirft, Ben (vorn) ist gold.
    const host = runningHost([0, 1]);
    const a = host.authoritative(0)!;
    const b = host.authoritative(1)!;
    host.debugPlace(0, 20, -2);
    host.debugPlace(1, 75, 3);
    host.step(NEUTRAL);
    b.gold = GOLD_TICKS;
    host.giveItem(0, ITEM_TOP);
    host.step({ steer: 0, buttons: 8 });
    expect(host.things().some((t) => t.kind === THING_TOP)).toBe(true);
    for (let i = 0; i < 240 && host.things().some((t) => t.kind === THING_TOP); i++) host.step(NEUTRAL);
    expect(host.things().some((t) => t.kind === THING_TOP)).toBe(false);
    expect(b.spin).toBe(0);
    expect(a.spin).toBe(0);
    // Ölfleck: Anna legt ihn, fährt später als Gold-Kart selbst hindurch.
    host.debugPlace(0, 200, 0);
    host.debugPlace(1, 400, 0);
    host.step(NEUTRAL);
    host.giveItem(0, ITEM_OIL);
    host.step({ steer: 0, buttons: 8 });
    const oil = host.things().find((t) => t.kind === THING_OIL)!;
    expect(oil).toBeTruthy();
    for (let i = 0; i < 60; i++) host.step(NEUTRAL);
    host.debugPlace(0, 180, 0);
    a.gold = GOLD_TICKS;
    for (let i = 0; i < 150; i++) host.step(GAS);
    expect(host.things().some((t) => t.kind === THING_OIL)).toBe(false);
    expect(a.spin).toBe(0);
    projectOnTrack(TRACK, a.x, a.z, a.seg);
    expect(proj.seg * TRACK.step).toBeGreaterThan(205);
  });

  it('unverwundbar: die Rakete schlägt ein, das Gold-Kart schleudert nicht; der Kurzschluss trifft nur die anderen', () => {
    const host = runningHost([0, 1, 2, 3]);
    host.debugPlace(0, 30);
    host.debugPlace(1, 160, 2);
    host.debugPlace(2, 230, -2);
    host.debugPlace(3, 300);
    host.step(NEUTRAL);
    const b = host.authoritative(1)!;
    host.giveItem(0, ITEM_ROCKET);
    host.step({ steer: 0, buttons: 8 });
    expect(host.authoritative(0)!.aimSlot).toBe(1);
    for (let i = 0; i < ROCKET_TICKS - 20; i++) host.step(NEUTRAL);
    b.gold = GOLD_TICKS;
    for (let i = 0; i < 40; i++) host.step(NEUTRAL);
    expect(host.authoritative(0)!.rocket).toBe(0);
    expect(b.spin).toBe(0);
    // Kurzschluss vom Letzten: Ben (gold) bleibt verschont, die anderen vorn werden gedrosselt.
    const host2 = runningHost([0, 1, 2]);
    host2.debugPlace(0, 30);
    host2.debugPlace(1, 120);
    host2.debugPlace(2, 90);
    host2.step(NEUTRAL);
    host2.authoritative(1)!.gold = GOLD_TICKS;
    host2.giveItem(0, ITEM_EMP);
    host2.step({ steer: 0, buttons: 8 });
    expect(host2.authoritative(1)!.stall).toBe(0);
    expect(host2.authoritative(2)!.stall).toBeGreaterThan(0);
  });

  it('Größe: Gold hat Vorrang – eine Ring-Größe endet mit dem letzten Schluck, kein Ring wirkt, kein Größentor lässt durch, im Mauseloch bleibt die Flasche zu', () => {
    const t = setTrack(ZIMMER);
    // Riesig getrunken: beim Trinken noch riesig, danach gold (Größe 0).
    const s = gridState(0);
    placeAt(s, 20, 0, 15);
    s.size = SIZE_TICKS;
    s.item = ITEM_GOLD;
    stepKart(s, PRESS, ENV);
    for (let i = 0; i < GOLD_DRINK_TICKS - 1; i++) stepKart(s, GAS, ENV);
    expect(s.size).toBeGreaterThan(0);
    expect(goldOn(s)).toBe(false);
    stepKart(s, GAS, ENV);
    expect(goldOn(s)).toBe(true);
    expect(s.size).toBe(0);
    // Durch den Wachsring: nichts.
    const grow = t.sizers.find((z) => z.grow)!;
    const r = gridState(0);
    placeAt(r, grow.seg - 5, (grow.lat0 + grow.lat1) / 2, 22);
    r.gold = GOLD_TICKS;
    for (let i = 0; i < 50; i++) stepKart(r, NEUTRAL, { canDrive: true, speedFactor: 1, time: 600 + i });
    expect(r.size).toBe(0);
    // Größentor: zu für jeden, der Gold trinkt oder gold ist – auch mit passender Ring-Größe.
    for (let k = 0; k < 2; k++) {
      const b = t.branches[k];
      const need = t.branchOnly[k];
      expect(gateShut(t, b.first + 3, 1234, need * 600)).toBe(false);
      let from = b.from;
      for (let n = 0; n < 70; n++) from = t.prev[from];
      const g = gridState(0);
      placeAt(g, from, 0, 20);
      const brain = newBrain(1, AI_HARD);
      brain.route = 1 << k;
      brain.routeLock = true;
      let on = 0;
      for (let i = 0; i < 60 * 9; i++) {
        g.size = need * 600;
        g.gold = 300;
        stepKart(g, botCmd(g, brain, [], true, { tick: i, time: 600 + i, place: 1, smoke: false }), { canDrive: true, speedFactor: 1, time: 600 + i });
        if (t.branchOf[g.seg] === k && t.twin[g.seg] < 0) on++;
      }
      expect(on).toBe(0);
    }
    // In einer Größen-Abkürzung bleibt die Flasche zu.
    const k = t.branchOnly.indexOf(-1);
    const br = t.branches[k];
    const m = gridState(0);
    placeAt(m, br.first + Math.floor(br.count / 2), 0, 10);
    expect(t.branchOf[m.seg]).toBe(k);
    m.size = -SIZE_TICKS;
    m.item = ITEM_GOLD;
    stepKart(m, PRESS, ENV);
    expect(m.item).toBe(ITEM_GOLD);
    expect(m.gold).toBe(0);
    setTrack(0);
  });

  it('die Rakete beendet Get Gold', () => {
    const s = gridState(0);
    placeAt(s, 30, 0, 10);
    s.gold = GOLD_TICKS;
    s.item = ITEM_ROCKET;
    stepKart(s, PRESS, ENV);
    expect(s.rocket).toBeGreaterThan(0);
    expect(s.gold).toBe(0);
  });

  it('Restzeit steht im Snapshot; der Mitspieler sagt das Gold selbst voraus', () => {
    const host = runningHost([0, 1]);
    host.giveItem(0, ITEM_GOLD);
    host.step({ steer: 0, buttons: 1 | 8 });
    for (let i = 0; i < 70; i++) host.step(GAS);
    const snap = decodeSnapshot(new DataView(host.snapshot()))!;
    const k = snap.karts.find((k) => k.slot === 0)!.state;
    const a = host.authoritative(0)!;
    expect(k.gold).toBe(a.gold);
    expect(goldOn(k)).toBe(true);
    // Vorhersage: eine Kopie, die nur mit stepKart weiterrechnet, bleibt beim Host.
    const pred = copyState(newState(), a);
    for (let i = 0; i < 120; i++) {
      stepKart(pred, GAS, { canDrive: true, speedFactor: 1, time: host.tick - host.goTick + 1 });
      host.step(GAS);
    }
    expect(pred.gold).toBe(a.gold);
    expect(Math.hypot(pred.x - a.x, pred.z - a.z)).toBeLessThan(0.05);
  });

  it('die KI zündet Get Gold hinten bald und weicht einem Gold-Kart aus', () => {
    withoutMechanics(() => {
      const s = gridState(1);
      placeAt(s, 40, 0, 22);
      const brain = newBrain(1, AI_MEDIUM);
      s.item = ITEM_GOLD;
      let used = -1;
      for (let tick = 1; tick <= 120 && used < 0; tick++) {
        stepKart(s, botCmd(s, brain, [gridState(0), gridState(2), gridState(3)], true, { tick, time: tick, place: 4, smoke: false }), ENV);
        if (s.gold > 0) used = tick;
      }
      expect(used).toBeGreaterThan(0);
      expect(used).toBeLessThan(60);

      // Ausweichen: ein Gold-Kart kommt von hinten auf derselben Spur heran – wie weit liegt die KI seitlich daneben, wenn
      // es vorbeizieht? (Zum Vergleich: dieselbe KI, die das andere Kart nicht kennt. Gerempelt wird hier nicht.)
      const t = TRACK;
      const dodge = (seen: boolean): number => {
        const gold = true;
        const me = gridState(1);
        placeAt(me, 60, 0, 17);
        const other = gridState(0);
        placeAt(other, 60 - 26, 0, 28);
        other.gold = gold ? GOLD_TICKS : 0;
        const b = newBrain(1, AI_MEDIUM);
        let apart = 0;
        for (let tick = 1; tick <= 240; tick++) {
          // (Die KI ist hier gedrosselt – sie wird eingeholt.)
          stepKart(me, botCmd(me, b, seen ? [other] : [], true, { tick, time: tick, place: 1, smoke: false }), { canDrive: true, speedFactor: 0.65, time: 0 });
          // Das andere Kart fährt stur geradeaus auf der Mittellinie (schnell genug, um aufzuholen).
          projectOnTrack(t, other.x, other.z, other.seg);
          const steer = Math.round(Math.max(-1, Math.min(1, -proj.lat * 0.25)) * 127);
          stepKart(other, { steer, buttons: BTN_GAS }, ENV);
          if (!gold) other.vx = Math.sin(other.heading) * 28;
          if (!gold) other.vz = Math.cos(other.heading) * 28;
          projectOnTrack(t, other.x, other.z, other.seg);
          const lo = proj.lat;
          const so = proj.seg;
          projectOnTrack(t, me.x, me.z, me.seg);
          // im Augenblick des Vorbeiziehens (gleichauf, ±3 m)
          if (Math.abs(so - proj.seg) * t.step < 3) apart = Math.max(apart, Math.abs(proj.lat - lo));
        }
        return apart;
      };
      const blind = dodge(false);
      const away = dodge(true);
      console.log(`KI seitlich, wenn ein Gold-Kart vorbeizieht: ${away.toFixed(1)} m (ohne hinzusehen ${blind.toFixed(1)} m)`);
      // Gold-Kart (Maßstab 1,4) und Kart berühren sich unter 2,4 m Abstand.
      expect(away).toBeGreaterThan(2.7);
      expect(blind).toBeLessThan(2);
      // Und selbst gold: hält auf den Gegner voraus zu.
      const me = gridState(1);
      placeAt(me, 40, -3, 26);
      me.gold = GOLD_TICKS;
      const prey = gridState(0);
      placeAt(prey, 52, 2.5, 18);
      const b = newBrain(1, AI_MEDIUM);
      let closest = Infinity;
      for (let tick = 1; tick <= 70; tick++) {
        stepKart(me, botCmd(me, b, [prey], true, { tick, time: tick, place: 2, smoke: false }), ENV);
        stepKart(prey, NEUTRAL, ENV);
        closest = Math.min(closest, Math.hypot(me.x - prey.x, me.z - prey.z));
      }
      expect(closest).toBeLessThan(2.9);
    });
  });

  it('Kart-Werte bleiben Faktoren: jede Figur ist mit Gold schneller als ohne', () => {
    useTrack(oval());
    for (let c = 0; c < CHARACTERS.length; c++) {
      const tops: number[] = [];
      for (const gold of [0, GOLD_TICKS]) {
        const s = gridState(0, c);
        placeAt(s, STRAIGHT, 0, V_MAX);
        s.gold = gold;
        tops.push(run(s, 260).top);
      }
      expect(tops[1]).toBeGreaterThan(tops[0] * 1.08);
    }
    setTrack(0);
  });
});

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HostGame } from '../../src/game/hostGame';
import {
  EV_FALL,
  EV_LAND,
  EV_RESPAWNED,
  EV_TAKEOFF,
  FLAG_AIR,
  GUARD_TICKS,
  ITEM_EMP,
  ITEM_GUARD,
  ITEM_NONE,
  ITEM_SMOKE,
  ITEM_SPRING,
  ITEM_TIRE,
  ITEM_TOP,
  NEUTRAL,
  STALL_TICKS,
  V_MAX,
  forwardSpeed,
  gridState,
  hitKart,
  stepKart,
  type Cmd,
  type KartState,
} from '../../src/game/sim';
import { EDGE_GAP, EDGE_OPEN_L, TRACK, buildTrack, hazardLat, rightX, rightZ, setTrack, trackHeading, useTrack } from '../../src/game/track';
import { RACE_RUNNING, THING_SMOKE, THING_TIRE, THING_TOP, decodeSnapshot } from '../../src/net/protocol';

const GAS: Cmd = { steer: 0, buttons: 1 };
const PRESS: Cmd = { steer: 0, buttons: 1 | 8 };
const ENV = { canDrive: true, speedFactor: 1 };

afterAll(() => {
  setTrack(0);
});

/** Setzt ein Kart auf die Mitte der Fahrbahn bei Abschnitt seg, in Fahrtrichtung, mit Tempo v. */
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

function runningHost(humans: number[], bots = false): HostGame {
  const host = new HostGame(0);
  host.setRoster(humans, bots);
  host.newRace();
  while (host.phase !== RACE_RUNNING) host.step(NEUTRAL);
  return host;
}

describe('Höhen, Sprünge und Abstürze', () => {
  it('Sprungschanze mit Lücke: mit Anlauf fliegt das Kart hinüber und landet', () => {
    setTrack(1); // Möwenklippe
    const t = TRACK;
    let gap = -1;
    for (let i = 0; i < t.n; i++) if (t.edge[i] & EDGE_GAP && gap < 0) gap = i;
    expect(gap).toBeGreaterThan(0);
    const s = gridState(0);
    placeAt(s, gap - 40, 0, V_MAX);
    let ev = 0;
    let maxAbove = 0;
    for (let i = 0; i < 240; i++) {
      ev |= stepKart(s, GAS, ENV);
      if (s.flags & FLAG_AIR) maxAbove = Math.max(maxAbove, s.y - t.py[s.seg]);
    }
    expect(ev & EV_TAKEOFF).toBeTruthy();
    expect(ev & EV_LAND).toBeTruthy();
    expect(ev & EV_FALL).toBe(0);
    expect(maxAbove).toBeGreaterThan(0.8);
    expect(s.flags & FLAG_AIR).toBe(0);
    console.log(`Sprung über die Bucht: höchster Punkt ${maxAbove.toFixed(1)} m über der Fahrbahn`);
  });

  it('wer in der Lücke landet, stürzt ab und wird davor wieder aufgesetzt', () => {
    setTrack(1);
    const t = TRACK;
    let gap = -1;
    for (let i = 0; i < t.n; i++) if (t.edge[i] & EDGE_GAP && gap < 0) gap = i;
    const s = gridState(0);
    // Mitten in der Lücke, auf Höhe der Fahrbahn, fast ohne Tempo: da ist kein Boden.
    placeAt(s, gap + 2, 0, 3);
    let ev = 0;
    let fellAt = -1;
    for (let i = 0; i < 400 && !(ev & EV_RESPAWNED); i++) {
      const e = stepKart(s, NEUTRAL, ENV);
      if (e & EV_FALL) fellAt = i;
      ev |= e;
    }
    expect(fellAt).toBeGreaterThan(0);
    expect(ev & EV_RESPAWNED).toBeTruthy();
    // Wieder auf festem Boden, vor der Lücke, mit Anlauf.
    expect(t.edge[s.seg] & EDGE_GAP).toBe(0);
    expect(gap - s.seg).toBeGreaterThan(15);
    expect(Math.hypot(s.vx, s.vz)).toBeLessThan(0.5);

    // Von dort reicht einfaches Gasgeben für den Sprung.
    let ev2 = 0;
    for (let i = 0; i < 200; i++) ev2 |= stepKart(s, GAS, ENV);
    expect(ev2 & EV_FALL).toBe(0);
    expect(s.seg).toBeGreaterThan(gap + 5);
  });

  it('Steg ohne Geländer: seitlich hinaus heißt Absturz und Zurücksetzen auf die Mitte', () => {
    setTrack(1);
    const t = TRACK;
    let open = -1;
    for (let i = 0; i < t.n; i++) if ((t.edge[i] & (EDGE_OPEN_L | EDGE_GAP)) === EDGE_OPEN_L && open < 0) open = i + 8;
    const s = gridState(0);
    placeAt(s, open, 0, 12);
    s.heading += 1.1; // nach links hinaus
    s.vx = Math.sin(s.heading) * 12;
    s.vz = Math.cos(s.heading) * 12;
    let ev = 0;
    for (let i = 0; i < 300 && !(ev & EV_RESPAWNED); i++) ev |= stepKart(s, GAS, ENV);
    expect(ev & EV_FALL).toBeTruthy();
    expect(ev & EV_RESPAWNED).toBeTruthy();
    expect(Math.abs(s.x - t.px[s.seg]) + Math.abs(s.z - t.pz[s.seg])).toBeLessThan(0.01);
    expect(s.respawn).toBe(0);
  });

  it('bergab ist die Höchstgeschwindigkeit höher als bergauf', () => {
    // Eigene Prüfstrecke: lange Gerade mit 10 % Steigung, Kehre, dieselbe Gerade wieder hinunter.
    const hill = buildTrack({
      id: 'hang',
      name: 'Prüfhang',
      theme: 'werkshof',
      blurb: '',
      grade: 1,
      points: [
        [0, 0, 0],
        [0, 100, 10],
        [0, 200, 20],
        [0, 300, 30],
        [30, 340, 30],
        [60, 300, 30],
        [60, 200, 20],
        [60, 100, 10],
        [60, 0, 0],
        [30, -40, 0],
      ],
      roadHalf: 6,
      shoulder: 3,
      startAt: 0,
      laps: 1,
      pads: [],
      boxRows: [],
    });
    useTrack(hill);
    const topSpeed = (seg: number): number => {
      const s = gridState(0);
      placeAt(s, seg, 0, V_MAX);
      let v = 0;
      for (let i = 0; i < 120; i++) {
        stepKart(s, GAS, ENV);
        if (i > 60) v = Math.max(v, forwardSpeed(s));
      }
      expect(s.flags & FLAG_AIR).toBe(0);
      return v;
    };
    const up = topSpeed(60);
    // Die Gerade bergab liegt auf der anderen Seite: dort suchen, wo die Höhe fällt.
    let downSeg = -1;
    for (let i = 0; i < hill.n - 100 && downSeg < 0; i++) if (hill.py[i] > 26 && hill.py[i + 40] < hill.py[i] - 3.5) downSeg = i;
    const down = topSpeed(downSeg);
    console.log(`Tempo bergauf ${up.toFixed(1)} m/s, bergab ${down.toFixed(1)} m/s (eben ${V_MAX})`);
    expect(up).toBeLessThan(V_MAX - 1);
    expect(down).toBeGreaterThan(V_MAX + 1);
  });
});

describe('Neue Items', () => {
  beforeEach(() => {
    setTrack(0);
  });

  it('Sprungfeder: Hüpfer aus der Fahrt, in der Luft kein zweiter', () => {
    const s = gridState(0);
    placeAt(s, 30, 0, 20);
    s.item = ITEM_SPRING;
    let ev = stepKart(s, PRESS, ENV);
    expect(ev & EV_TAKEOFF).toBeTruthy();
    expect(s.item).toBe(ITEM_NONE);
    let peak = 0;
    let airTicks = 0;
    s.item = ITEM_SPRING;
    for (let i = 0; i < 90; i++) {
      // Taste loslassen und in der Luft erneut drücken: nichts passiert, das Item bleibt.
      ev = stepKart(s, i === 10 ? PRESS : GAS, ENV);
      if (s.flags & FLAG_AIR) {
        airTicks++;
        peak = Math.max(peak, s.y - TRACK.py[s.seg]);
      }
    }
    expect(s.item).toBe(ITEM_SPRING);
    expect(peak).toBeGreaterThan(1.2);
    expect(airTicks).toBeGreaterThan(25);
    expect(airTicks).toBeLessThan(70);
    console.log(`Sprungfeder: ${peak.toFixed(1)} m hoch, ${(airTicks / 60).toFixed(2)} s in der Luft`);
  });

  it('Stoßfänger fängt genau einen Treffer ab', () => {
    const s = gridState(0);
    s.item = ITEM_GUARD;
    stepKart(s, { steer: 0, buttons: 8 }, ENV);
    expect(s.guard).toBe(GUARD_TICKS);
    expect(hitKart(s)).toBe(2);
    expect(s.guard).toBe(0);
    expect(s.spin).toBe(0);
    s.shield = 0;
    expect(hitKart(s)).toBe(1);
    expect(s.spin).toBeGreaterThan(0);
  });

  it('Brummkreisel holt das Kart davor ein und trifft es', () => {
    const host = runningHost([0, 1]);
    const fx: string[] = [];
    host.onFx = (slot, kind) => fx.push(`${slot}:${kind}`);
    const a = host.authoritative(0)!;
    const b = host.authoritative(1)!;
    placeAt(a, 20, -2);
    host.debugPlace(1, 75, 3);
    host.step(NEUTRAL);
    host.giveItem(0, ITEM_TOP);
    host.step({ steer: 0, buttons: 8 });
    const top = host.things().find((t) => t.kind === THING_TOP)!;
    expect(top).toBeTruthy();
    let hitAfter = -1;
    for (let i = 0; i < 240 && hitAfter < 0; i++) {
      host.step(NEUTRAL);
      if (b.spin > 0) hitAfter = i;
    }
    expect(hitAfter).toBeGreaterThan(10);
    expect(fx).toContain('1:hit');
    expect(host.things().some((t) => t.kind === THING_TOP)).toBe(false);
    expect(a.spin).toBe(0);
  });

  it('Kurzschluss bremst nur, wer vorn liegt – und der Stoßfänger schützt', () => {
    const host = runningHost([0, 1, 2]);
    const fx: string[] = [];
    host.onFx = (slot, kind) => fx.push(`${slot}:${kind}`);
    // Reihenfolge herstellen: 1 vorn, 2 in der Mitte, 0 hinten
    host.debugPlace(1, 120);
    host.debugPlace(2, 80);
    host.debugPlace(0, 30);
    host.step(NEUTRAL);
    host.giveItem(1, ITEM_GUARD);
    host.authoritative(1)!.guard = GUARD_TICKS;
    host.giveItem(0, ITEM_EMP);
    host.step({ steer: 0, buttons: 8 });
    expect(host.authoritative(2)!.stall).toBeGreaterThanOrEqual(STALL_TICKS - 1);
    expect(host.authoritative(1)!.stall).toBe(0);
    expect(host.authoritative(1)!.guard).toBe(0);
    expect(host.authoritative(0)!.stall).toBe(0);
    expect(fx).toContain('2:stall');
    expect(fx).toContain('1:block');

    // Gedrosselt kommt man klar langsamer voran.
    const c = host.authoritative(2)!;
    for (let i = 0; i < 100; i++) stepKart(c, GAS, ENV);
    expect(forwardSpeed(c)).toBeLessThan(V_MAX * 0.6);
  });

  it('Nebelkerze hinterlässt eine Wolke, die im Snapshot steht und von selbst vergeht', () => {
    const host = runningHost([0, 1]);
    host.giveItem(0, ITEM_SMOKE);
    host.step({ steer: 0, buttons: 8 });
    expect(host.things().filter((t) => t.kind === THING_SMOKE).length).toBe(1);
    const snap = decodeSnapshot(new DataView(host.snapshot()))!;
    const cloud = snap.things.find((t) => t.kind === THING_SMOKE)!;
    expect(cloud.ttl).toBeGreaterThan(8);
    expect(snap.track).toBe(0);
    for (let i = 0; i < 9 * 60 + 5; i++) host.step(NEUTRAL);
    expect(host.things().some((t) => t.kind === THING_SMOKE)).toBe(false);
  });

  it('wer hochspringt, wird von einem Rollreifen am Boden nicht getroffen', () => {
    const host = runningHost([0, 1]);
    const a = host.authoritative(0)!;
    const b = host.authoritative(1)!;
    placeAt(a, 20, 0);
    placeAt(b, 34, 0);
    host.giveItem(0, ITEM_TIRE);
    host.giveItem(1, ITEM_SPRING);
    // Kart 1 hat keine Eingaben (kein Mitspieler verbunden) – den Hüpfer direkt auslösen.
    b.item = ITEM_NONE;
    b.vy = 10.5;
    b.y += 0.3;
    b.flags |= FLAG_AIR;
    host.step({ steer: 0, buttons: 8 });
    for (let i = 0; i < 30; i++) host.step(NEUTRAL);
    expect(b.spin).toBe(0);
    expect(host.things().some((t) => t.kind === THING_TIRE)).toBe(true);
  });

  it('pendelndes Hindernis trifft, wer hineinfährt', () => {
    const host = runningHost([0]);
    const t = TRACK;
    const h = t.hazards[0];
    expect(h).toBeTruthy();
    const fx: string[] = [];
    host.onFx = (slot, kind) => fx.push(`${slot}:${kind}`);
    const a = host.authoritative(0)!;
    let hit = false;
    for (let i = 0; i < 400 && !hit; i++) {
      // Das Kart steht immer genau dort, wo das Hindernis gerade ist.
      placeAt(a, h.seg, hazardLat(h, host.tick + 1));
      a.shield = 0;
      host.step(NEUTRAL);
      hit = a.spin > 0;
    }
    expect(hit).toBe(true);
    expect(fx).toContain('0:hit');
  });

  it('Item-Verteilung: Führender bekommt Abwehr, Letzter Aufholhilfen', () => {
    const host = runningHost([0, 1, 2, 3]);
    const pick = (host as unknown as { pickItem(place: number, count: number): number }).pickItem.bind(host);
    const count = (place: number): number[] => {
      const n = new Array<number>(9).fill(0);
      for (let i = 0; i < 4000; i++) n[pick(place, 4)]++;
      return n;
    };
    const first = count(1);
    const last = count(4);
    // Vorn: weder Brummkreisel noch Kurzschluss; hinten: keine Ölflecken und Nebelkerzen.
    expect(first[ITEM_TOP]).toBe(0);
    expect(first[ITEM_EMP]).toBe(0);
    expect(last[3]).toBe(0);
    expect(last[ITEM_SMOKE]).toBe(0);
    expect(last[ITEM_TOP]).toBeGreaterThan(600);
    for (let item = 1; item <= 8; item++) expect(first[item] + last[item] + count(2)[item]).toBeGreaterThan(0);
  });
});

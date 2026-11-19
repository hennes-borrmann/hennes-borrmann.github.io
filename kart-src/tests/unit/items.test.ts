import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { botCmd, newBrain } from '../../src/game/ai';
import { HostGame } from '../../src/game/hostGame';
import {
  EV_FALL,
  EV_LAND,
  EV_TOW_END,
  EV_USE_KITE,
  EV_USE_ROCKET,
  EV_RESPAWNED,
  EV_TAKEOFF,
  FLAG_AIR,
  GUARD_TICKS,
  ITEM_EMP,
  ITEM_GUARD,
  ITEM_KITE,
  ITEM_NONE,
  ITEM_COUNT,
  ITEM_ROCKET,
  ITEM_SMOKE,
  ITEM_TIRE,
  ITEM_TOP,
  ITEM_WING,
  FLAG_GLIDE,
  WING_TICKS,
  NEUTRAL,
  ROCKET_FLY_TICKS,
  ROCKET_MORPH_TICKS,
  ROCKET_TICKS,
  ROBOT_JUMP,
  SPIN_TICKS,
  STALL_TICKS,
  TOW_TICKS,
  V_MAX,
  V_TOW,
  forwardSpeed,
  gridState,
  hitKart,
  stepKart,
  type Cmd,
  type KartState,
} from '../../src/game/sim';
import {
  EDGE_GAP,
  EDGE_OPEN_L,
  TRACK,
  TRACK_COUNT,
  buildTrack,
  hazardLat,
  proj,
  projectOnTrack,
  rightX,
  rightZ,
  setTrack,
  trackHeading,
  useTrack,
} from '../../src/game/track';
import { RACE_RUNNING, THING_SMOKE, THING_TIRE, THING_TOP, decodeSnapshot } from '../../src/net/protocol';

const GAS: Cmd = { steer: 0, buttons: 1 };
const PRESS: Cmd = { steer: 0, buttons: 1 | 8 };
const ENV = { canDrive: true, speedFactor: 1, time: 0 };

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
    // Kart 1 hat keine Eingaben (kein Mitspieler verbunden) – den Hüpfer (wie den Satz des Roboters) direkt auslösen.
    b.vy = ROBOT_JUMP;
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

  it('Abschleppdrache: zieht von selbst durch Kurven und über die Lücke, niemand stürzt', () => {
    for (let ti = 0; ti < TRACK_COUNT; ti++) {
      setTrack(ti);
      const t = TRACK;
      // Von jeder zehnten Stelle der Strecke aus einmal ziehen lassen – auch direkt vor Sprüngen und auf Stegen.
      for (let start = 0; start < t.n; start += 10) {
        if (t.edge[start] & EDGE_GAP) continue;
        const s = gridState(0);
        placeAt(s, start, 2, 20);
        s.item = ITEM_KITE;
        let ev = stepKart(s, PRESS, ENV);
        expect(ev & EV_USE_KITE).toBeTruthy();
        expect(s.tow).toBe(TOW_TICKS);
        let dist = 0;
        let top = 0;
        // Lässt der Drache kurz vor einer Absprungkante los, fliegt das Kart danach selbst – dann lenkt ein Fahrer
        // (sonst flöge es geradeaus aus dem Korridor). Über einer Flugstrecke lässt der Drache erst hinter der
        // Landung los – deshalb die großzügige Frist. (In der Magnettrommel des Magnetwerks hält er bis zu ihrem Ende fest,
        // gut 330 m – er setzt dort nicht über einer Deckenplatte ab.)
        const pilot = newBrain(0);
        for (let i = 0; i < TOW_TICKS + 900 && (s.tow > 0 || s.flags & FLAG_AIR); i++) {
          const x = s.x;
          const z = s.z;
          ev |= stepKart(s, s.tow > 0 ? NEUTRAL : botCmd(s, pilot, [], true, { tick: i, time: 0, place: 1, smoke: false }), ENV);
          if (s.tow > 0) {
            dist += Math.hypot(s.x - x, s.z - z);
            top = Math.max(top, Math.hypot(s.vx, s.vz));
            // Bleibt über der Fahrbahn, auch in Kurven.
            projectOnTrack(t, s.x, s.z, s.seg);
            expect(Math.abs(proj.lat)).toBeLessThan(t.wh[s.seg]);
          }
        }
        expect(ev & EV_FALL).toBe(0);
        expect(ev & EV_TOW_END).toBeTruthy();
        expect(top).toBeCloseTo(V_TOW, 0);
        expect(dist).toBeGreaterThan(140);
        // Danach wieder am Boden, auf festem Untergrund.
        expect(s.flags & FLAG_AIR).toBe(0);
        expect(t.edge[s.seg] & EDGE_GAP).toBe(0);
      }
    }
    setTrack(0);
  });

  it('Abschleppdrache: Bremse kappt, Treffer prallen ab, andere werden beiseitegeschoben', () => {
    const host = runningHost([0, 1]);
    const fx: string[] = [];
    host.onFx = (slot, kind) => fx.push(`${slot}:${kind}`);
    const a = host.authoritative(0)!;
    const b = host.authoritative(1)!;
    placeAt(a, 10, 0, 20);
    placeAt(b, 26, 0.4, 5);
    host.giveItem(0, ITEM_KITE);
    host.step({ steer: 0, buttons: 8 });
    expect(a.tow).toBeGreaterThan(200);
    expect(hitKart(a)).toBe(0);
    let latB = 0;
    for (let i = 0; i < 60; i++) {
      host.step(NEUTRAL);
      projectOnTrack(TRACK, b.x, b.z, b.seg);
      latB = Math.max(latB, Math.abs(proj.lat));
    }
    // Kart 1 stand im Weg: zur Seite geschoben, aber nicht aus der Bahn geworfen.
    expect(latB).toBeGreaterThan(1.5);
    expect(b.spin).toBe(0);
    expect(fx).toContain('1:bump');
    expect(a.tow).toBeGreaterThan(0);
    // Bremsen kappt den Drachen sofort.
    host.step({ steer: 0, buttons: 2 });
    expect(a.tow).toBe(0);
    expect(a.boost).toBeGreaterThan(0);
  });

  it('KI nutzt den Abschleppdrachen und lässt sich die volle Zeit ziehen', () => {
    setTrack(2);
    const s = gridState(1);
    placeAt(s, 40, 0, 22);
    const brain = newBrain(1, 1);
    s.item = ITEM_KITE;
    let towed = 0;
    let ev = 0;
    for (let tick = 1; tick <= 420; tick++) {
      ev |= stepKart(s, botCmd(s, brain, [], true, { tick, time: tick, place: 4, smoke: false }), ENV);
      if (s.tow > 0) towed++;
    }
    expect(ev & EV_USE_KITE).toBeTruthy();
    expect(towed).toBeGreaterThanOrEqual(TOW_TICKS - 1);
    expect(ev & EV_FALL).toBe(0);
    setTrack(0);
  });

  it('Abschleppdrache gibt es nur für Abgehängte', () => {
    const host = runningHost([0, 1, 2, 3]);
    const pick = (host as unknown as { pickItem(place: number, count: number, behind?: number): number }).pickItem.bind(host);
    const share = (place: number, behind: number): number => {
      let n = 0;
      for (let i = 0; i < 4000; i++) if (pick(place, 4, behind) === ITEM_KITE) n++;
      return n / 4000;
    };
    expect(share(4, 20)).toBe(0);
    expect(share(1, 200)).toBe(0);
    expect(share(2, 200)).toBe(0);
    expect(share(3, 200)).toBeGreaterThan(0.02);
    expect(share(3, 200)).toBeLessThan(0.15);
    expect(share(4, 200)).toBeGreaterThan(0.12);
    expect(share(4, 200)).toBeLessThan(0.3);
  });

  it('Item-Verteilung: Führender bekommt Abwehr, Letzter Aufholhilfen', () => {
    const host = runningHost([0, 1, 2, 3]);
    const pick = (host as unknown as { pickItem(place: number, count: number): number }).pickItem.bind(host);
    const count = (place: number): number[] => {
      const n = new Array<number>(ITEM_COUNT).fill(0);
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

  it('Rakete gibt es nur auf dem letzten Platz, etwa jede zehnte Kiste – der Drache bleibt daneben', () => {
    const host = runningHost([0, 1, 2, 3]);
    const pick = (host as unknown as { pickItem(place: number, count: number, behind?: number): number }).pickItem.bind(host);
    const share = (place: number, count: number, behind: number, item: number): number => {
      let n = 0;
      for (let i = 0; i < 6000; i++) if (pick(place, count, behind) === item) n++;
      return n / 6000;
    };
    for (const place of [1, 2, 3]) expect(share(place, 4, 200, ITEM_ROCKET)).toBe(0);
    expect(share(1, 1, 0, ITEM_ROCKET)).toBe(0);
    expect(share(1, 2, 0, ITEM_ROCKET)).toBe(0);
    expect(share(4, 4, 20, ITEM_ROCKET)).toBeGreaterThan(0.08);
    expect(share(4, 4, 20, ITEM_ROCKET)).toBeLessThan(0.13);
    expect(share(4, 4, 200, ITEM_ROCKET)).toBeGreaterThan(0.06);
    expect(share(4, 4, 200, ITEM_ROCKET)).toBeLessThan(0.11);
    expect(share(4, 4, 200, ITEM_KITE)).toBeGreaterThan(0.12);
    expect(share(2, 2, 10, ITEM_ROCKET)).toBeGreaterThan(0.06);
  });

  const progressOf = (host: HostGame, slot: number): number =>
    (host as unknown as { karts: Map<number, { progress: number }> }).karts.get(slot)!.progress;

  /** Host mit vier Karts: Anna (0) hinten, davor 1, 2, 3 (stehend). */
  function rocketRace(): { host: HostGame; fx: string[] } {
    const host = runningHost([0, 1, 2, 3]);
    const fx: string[] = [];
    host.onFx = (slot, kind) => fx.push(`${slot}:${kind}`);
    host.debugPlace(0, 30);
    host.debugPlace(1, 160, 2);
    host.debugPlace(2, 230, -2);
    host.debugPlace(3, 300);
    host.step(NEUTRAL);
    return { host, fx };
  }

  it('Rakete: verwandeln, fliegen, beim Fahrer davor landen; er schleudert wie nach einem Kreisel, Anna nicht', () => {
    const { host, fx } = rocketRace();
    const a = host.authoritative(0)!;
    const from = { x: a.x, z: a.z, progress: progressOf(host, 0) };
    host.giveItem(0, ITEM_ROCKET);
    host.step({ steer: 0, buttons: 8 });
    expect(a.item).toBe(ITEM_NONE);
    expect(a.rocket).toBeGreaterThan(0);
    // Ziel ist der Fahrer einen Platz weiter vorn: Kart 1.
    expect(a.aimSlot).toBe(1);
    // Verwandlung: Anna bleibt praktisch stehen und ist unverwundbar.
    for (let i = 0; i < ROCKET_MORPH_TICKS - 2; i++) host.step(NEUTRAL);
    expect(Math.hypot(a.x - from.x, a.z - from.z)).toBeLessThan(3);
    expect(hitKart(a)).toBe(0);
    // Flug: hoch hinauf …
    let top = a.y;
    let flew = 0;
    for (let i = 0; i < ROCKET_FLY_TICKS - 4; i++) {
      host.step(NEUTRAL);
      top = Math.max(top, a.y);
      if (a.rocket > 0) flew++;
    }
    expect(top - TRACK.py[a.seg]).toBeGreaterThan(40);
    expect(flew).toBeGreaterThan(ROCKET_FLY_TICKS - 10);
    // … und Landung knapp vor Kart 1.
    for (let i = 0; i < 10 && a.rocket > 0; i++) host.step(NEUTRAL);
    expect(a.rocket).toBe(0);
    const b = host.authoritative(1)!;
    expect(b.spin).toBeGreaterThan(SPIN_TICKS - 10);
    expect(b.spin).toBeLessThanOrEqual(SPIN_TICKS);
    expect(fx).toContain('1:hit');
    expect(host.authoritative(2)!.spin).toBe(0);
    expect(host.authoritative(3)!.spin).toBe(0);
    expect(a.spin).toBe(0);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(9);
    // Der Rennfortschritt springt mit – Anna liegt jetzt vor Kart 1.
    expect(progressOf(host, 0)).toBeGreaterThan(from.progress + 100);
    expect(progressOf(host, 0)).toBeGreaterThan(progressOf(host, 1));
    const st = host.standings();
    expect(st.find((s) => s.slot === 0)!.place).toBeLessThan(st.find((s) => s.slot === 1)!.place);
    // Danach fährt Anna normal weiter: ohne Absturz, mit Gas wieder schnell.
    for (let i = 0; i < 60; i++) host.step(GAS);
    expect(a.respawn).toBe(0);
    expect(forwardSpeed(a)).toBeGreaterThan(15);
  });

  it('Rakete: Ziel bewegt sich – der Landepunkt wandert mit; der Stoßfänger fängt den Treffer ab', () => {
    const { host, fx } = rocketRace();
    const b = host.authoritative(1)!;
    host.giveItem(0, ITEM_ROCKET);
    host.step({ steer: 0, buttons: 8 });
    for (let i = 0; i < ROCKET_TICKS - 30; i++) host.step(NEUTRAL);
    // Kart 1 ist inzwischen 40 m weiter (kurz vor der Landung versetzt).
    host.debugPlace(1, 200, 0);
    b.guard = GUARD_TICKS;
    for (let i = 0; i < 40; i++) host.step(NEUTRAL);
    const a = host.authoritative(0)!;
    expect(a.rocket).toBe(0);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(12);
    expect(b.spin).toBe(0);
    expect(b.guard).toBe(0);
    expect(fx).toContain('1:block');
  });

  it('Rakete: landet nie über einer Lücke', () => {
    setTrack(1); // Möwenklippe mit Sprung über eine Lücke
    const t = TRACK;
    let gap = -1;
    for (let i = 0; i < t.n; i++) if (t.edge[i] & EDGE_GAP && gap < 0) gap = i;
    const host = runningHost([0, 1]);
    host.debugPlace(0, (gap - 200) * t.step);
    host.debugPlace(1, (gap - 2) * t.step);
    host.step(NEUTRAL);
    host.giveItem(0, ITEM_ROCKET);
    host.step({ steer: 0, buttons: 8 });
    const a = host.authoritative(0)!;
    expect(t.edge[a.aimSeg] & EDGE_GAP).toBe(0);
    expect(t.respawn[a.aimSeg]).toBe(a.aimSeg);
    for (let i = 0; i < ROCKET_TICKS + 60; i++) host.step(NEUTRAL);
    expect(a.rocket).toBe(0);
    expect(a.respawn).toBe(0);
    setTrack(0);
  });

  it('Rakete: ein neues Rennen beendet eine, die noch fliegt', () => {
    const { host } = rocketRace();
    host.giveItem(0, ITEM_ROCKET);
    host.step({ steer: 0, buttons: 8 });
    for (let i = 0; i < ROCKET_MORPH_TICKS + 20; i++) host.step(NEUTRAL);
    host.newRace();
    expect(host.authoritative(0)!.rocket).toBe(0);
  });

  it('Rakete im Snapshot: Flug, Landepunkt und Ziel kommen beim Mitspieler an', () => {
    const { host } = rocketRace();
    host.giveItem(0, ITEM_ROCKET);
    host.step({ steer: 0, buttons: 8 });
    for (let i = 0; i < ROCKET_MORPH_TICKS + 40; i++) host.step(NEUTRAL);
    const snap = decodeSnapshot(new DataView(host.snapshot()))!;
    const k = snap.karts.find((k) => k.slot === 0)!.state;
    const a = host.authoritative(0)!;
    expect(k.rocket).toBe(a.rocket);
    expect(k.aimSlot).toBe(1);
    expect(k.aimSeg).toBe(a.aimSeg);
    expect(k.aimX).toBeCloseTo(a.aimX, 3);
    expect(k.aimY).toBeCloseTo(a.aimY, 3);
    expect(k.aimZ).toBeCloseTo(a.aimZ, 3);
    expect(k.y).toBeCloseTo(a.y, 3);
  });

  it('Rakete: der Mitspieler sagt seinen Flug selbst voraus und landet dort, wo der Host ihn landen lässt', () => {
    const { host } = rocketRace();
    host.giveItem(0, ITEM_ROCKET);
    host.step({ steer: 0, buttons: 8 });
    host.step(NEUTRAL);
    // Mitspieler-Sicht: eine Kopie des Zustands, die nur mit stepKart weiterrechnet (Landepunkt vom Host übernommen).
    const pred: KartState = gridState(0);
    let maxErr = 0;
    for (let i = 0; i < ROCKET_TICKS + 5; i++) {
      Object.assign(pred, host.authoritative(0)!);
      stepKart(pred, NEUTRAL, { canDrive: true, speedFactor: 1, time: 0 });
      host.step(NEUTRAL);
      const a = host.authoritative(0)!;
      maxErr = Math.max(maxErr, Math.hypot(pred.x - a.x, pred.y - a.y, pred.z - a.z));
    }
    expect(maxErr).toBeLessThan(1);
  });

  it('KI zündet die Rakete bald nach dem Aufnehmen', () => {
    const s = gridState(1);
    placeAt(s, 40, 0, 22);
    const brain = newBrain(1, 1);
    s.item = ITEM_ROCKET;
    let ev = 0;
    for (let tick = 1; tick <= 120; tick++) ev |= stepKart(s, botCmd(s, brain, [], true, { tick, time: tick, place: 4, smoke: false }), ENV);
    expect(ev & EV_USE_ROCKET).toBeTruthy();
    expect(s.item).toBe(ITEM_NONE);
  });
});

describe('Gleiter', () => {
  beforeEach(() => {
    setTrack(0);
  });

  /** Ein Abschnitt, hinter dem es len Meter fast geradeaus geht – mit Bande, ohne Lücke. */
  function straightAt(len: number): number {
    const t = TRACK;
    const n = Math.round(len / t.step);
    let best = -1;
    let bestTurn = Infinity;
    for (let i = 0; i + n < t.n; i += 5) {
      let turn = 0;
      let bad = false;
      for (let k = 0; k <= n && !bad; k++) {
        const j = i + k;
        if (t.edge[j] & (EDGE_GAP | EDGE_OPEN_L)) bad = true;
        turn = Math.max(turn, Math.abs(wrap(trackHeading(t, j) - trackHeading(t, i))));
      }
      if (!bad && turn < bestTurn) {
        bestTurn = turn;
        best = i;
      }
    }
    return best;
  }
  const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

  it('springt gut 6 m hoch, gleitet mit Flügeln schneller als das Höchsttempo und landet nach gut 4 s', () => {
    const t = TRACK;
    const seg = straightAt(160);
    const s = gridState(0);
    placeAt(s, seg, 0, V_MAX);
    s.item = ITEM_WING;
    let ev = stepKart(s, PRESS, ENV);
    expect(ev & EV_TAKEOFF).toBeTruthy();
    expect(s.item).toBe(ITEM_NONE);
    expect(s.wing).toBe(WING_TICKS);
    let top = 0;
    let glide = 0;
    let fast = 0;
    let air = 0;
    for (let i = 0; i < 400; i++) {
      ev |= stepKart(s, GAS, ENV);
      top = Math.max(top, s.y - t.py[s.seg]);
      if (s.flags & FLAG_GLIDE) glide++;
      if (s.flags & FLAG_AIR) air++;
      fast = Math.max(fast, forwardSpeed(s));
      if (!(s.flags & FLAG_AIR) && i > 30) break;
    }
    expect(top).toBeGreaterThan(5);
    expect(top).toBeLessThan(8);
    expect(glide).toBeGreaterThan(150);
    // In der Luft bis kurz nach Ablauf der Flügel (gut 4 s), nicht ewig.
    expect(air).toBeGreaterThan(WING_TICKS - 40);
    expect(air).toBeLessThan(WING_TICKS + 60);
    expect(fast).toBeGreaterThan(V_MAX * 1.1);
    expect(fast).toBeLessThan(V_MAX * 1.25);
    expect(s.wing).toBe(0);
    expect(ev & EV_FALL).toBe(0);
  });

  it('trägt über die Lücke der Möwenklippe – auch mit wenig Anlauf', () => {
    setTrack(1);
    const t = TRACK;
    let gap = -1;
    for (let i = 0; i < t.n; i++) if (t.edge[i] & EDGE_GAP && gap < 0) gap = i;
    const s = gridState(0);
    placeAt(s, gap - 30, 0, 12);
    s.item = ITEM_WING;
    let ev = stepKart(s, PRESS, ENV);
    for (let i = 0; i < 500; i++) ev |= stepKart(s, GAS, ENV);
    expect(ev & EV_FALL).toBe(0);
    expect(s.seg).toBeGreaterThan(gap + 30);
  });

  it('bleibt zwischen den Banden – auch wer die ganze Zeit einlenkt', () => {
    const t = TRACK;
    const seg = straightAt(160);
    for (const steer of [127, -127]) {
      const s = gridState(0);
      placeAt(s, seg, 0, V_MAX);
      s.item = ITEM_WING;
      stepKart(s, PRESS, ENV);
      let worst = 0;
      for (let i = 0; i < WING_TICKS + 30; i++) {
        stepKart(s, { steer, buttons: 1 }, ENV);
        projectOnTrack(t, s.x, s.z, s.seg);
        worst = Math.max(worst, Math.abs(proj.lat) - t.wh[proj.seg]);
      }
      expect(worst).toBeLessThan(0.1);
    }
  });

  it('ein Treffer klappt die Flügel zu', () => {
    const s = gridState(0);
    placeAt(s, straightAt(160), 0, V_MAX);
    s.item = ITEM_WING;
    stepKart(s, PRESS, ENV);
    for (let i = 0; i < 60; i++) stepKart(s, GAS, ENV);
    expect(s.wing).toBeGreaterThan(0);
    hitKart(s);
    expect(s.wing).toBe(0);
    for (let i = 0; i < 10; i++) stepKart(s, GAS, ENV);
    expect(s.flags & FLAG_GLIDE).toBe(0);
  });

  it('jeder kann ihn bekommen, wer vorn liegt etwas seltener', () => {
    const host = runningHost([0, 1, 2, 3]);
    const pick = (host as unknown as { pickItem(place: number, count: number, behind?: number): number }).pickItem.bind(host);
    const share = (place: number, count: number): number => {
      let n = 0;
      for (let i = 0; i < 6000; i++) if (pick(place, count, 0) === ITEM_WING) n++;
      return n / 6000;
    };
    for (const place of [1, 2, 3, 4]) expect(share(place, 4)).toBeGreaterThan(0.05);
    expect(share(1, 4)).toBeLessThan(share(2, 4));
    expect(share(1, 1)).toBeGreaterThan(0.05);
  });

  it('Flügelzeit steht im Snapshot', () => {
    const host = runningHost([0, 1]);
    host.giveItem(0, ITEM_WING);
    host.step({ steer: 0, buttons: 1 | 8 });
    for (let i = 0; i < 20; i++) host.step(GAS);
    const snap = decodeSnapshot(new DataView(host.snapshot()))!;
    const k = snap.karts.find((k) => k.slot === 0)!.state;
    expect(k.wing).toBe(host.authoritative(0)!.wing);
    expect(k.wing).toBeGreaterThan(0);
  });
});

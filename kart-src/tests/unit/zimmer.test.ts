// Riesenkinderzimmer: Schrumpfen und Wachsen (mechanics.ts: Sizer, sizeClass; track.ts: gateShut; sim.ts; ai.ts).

import { afterAll, describe, expect, it } from 'vitest';
import { AI_EASY, AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import { BIG_VMAX, SIZE_TICKS, SIZE_WARN, SMALL_VMAX, sizeClass, sizeScale, type Sizer } from '../../src/game/mechanics';
import { HostGame } from '../../src/game/hostGame';
import { BTN_GAS, EV_FALL, EV_HIT, EV_WALL, gridState, stepKart, type Cmd, type KartState } from '../../src/game/sim';
import { RACE_RUNNING } from '../../src/net/protocol';
import { TRACK, TRACK_COUNT, addProgress, gateAt, gateShut, getTrack, proj, progDelta, projectOnTrack, rightX, rightZ, segDelta, setTrack, trackHeading } from '../../src/game/track';

const ZIMMER = 15;

afterAll(() => {
  setTrack(0);
});

function at(seg: number, lat = 0, speed = 0): KartState {
  const t = TRACK;
  const s = gridState(0);
  s.seg = seg;
  s.x = t.px[seg] + rightX(t, seg) * lat;
  s.z = t.pz[seg] + rightZ(t, seg) * lat;
  s.y = t.py[seg] + lat * t.bank[seg];
  s.heading = trackHeading(t, seg);
  s.vx = Math.sin(s.heading) * speed;
  s.vz = Math.cos(s.heading) * speed;
  s.vy = 0;
  s.flags = 0;
  return s;
}

/** Fährt von 5 m vor dem Ring geradeaus hindurch (seitlich lat) und liefert die Größe danach. */
function through(z: Sizer, lat: number, back = false): number {
  const t = TRACK;
  const s = at(z.seg + (back ? 5 : -5), lat, 22);
  if (back) {
    s.heading += Math.PI;
    s.vx = -s.vx;
    s.vz = -s.vz;
  }
  for (let i = 0; i < 50; i++) stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: 600 + i });
  expect(Math.abs(progDelta(t, z.seg, s.seg))).toBeGreaterThan(3);
  return s.size;
}

/** Höchsttempo und Zeit bis 15 m/s auf der Startgeraden (aus dem Stand, Vollgas) bei fester Größe. */
function drag(size: number): { top: number; to15: number } {
  const t = TRACK;
  const s = at(20, 0, 0);
  let to15 = -1;
  let top = 0;
  for (let i = 0; i < 60 * 7; i++) {
    s.size = size;
    projectOnTrack(t, s.x, s.z, s.seg);
    const steer = Math.round(Math.max(-1, Math.min(1, -proj.lat * 0.2)) * 127);
    stepKart(s, { steer, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: 600 + i });
    const v = Math.hypot(s.vx, s.vz);
    if (to15 < 0 && v >= 15) to15 = i;
    top = Math.max(top, v);
  }
  return { top, to15 };
}

describe('Größe', () => {
  it('Klassen und Maßstab', () => {
    expect([sizeClass(-5), sizeClass(0), sizeClass(400)]).toEqual([-1, 0, 1]);
    expect(sizeScale(-1)).toBeLessThan(0.75);
    expect(sizeScale(0)).toBe(1);
    expect(sizeScale(1)).toBeGreaterThan(1.3);
    // lang genug für eine Abkürzung, und das Ende kündigt sich an
    expect(SIZE_TICKS).toBeGreaterThanOrEqual(9 * 60);
    expect(SIZE_WARN).toBeGreaterThanOrEqual(90);
    expect(SIZE_TICKS).toBeLessThan(32767);
  });
});

describe('Riesenkinderzimmer', () => {
  it('nur hier stehen Größenringe und Größentore: je ein Ring gut 75 m vor seiner Abkürzung, auf deren Seite', () => {
    for (let i = 0; i < TRACK_COUNT; i++) {
      const t = getTrack(i);
      if (i !== ZIMMER) {
        expect(t.sizers.length).toBe(0);
        expect(t.gates.every((g) => g.only === 0)).toBe(true);
        continue;
      }
      expect(t.def.name).toBe('Riesenkinderzimmer');
      expect(t.sizers.length).toBe(2);
      expect(t.branches.length).toBe(2);
      expect(t.gates.length).toBe(2);
      for (let k = 0; k < 2; k++) {
        const gate = t.gates.find((g) => t.branchOf[g.first] === k)!;
        expect(gate).toBeDefined();
        // Abzweigung 0 (Mauseloch) nur winzig, Abzweigung 1 (Bauklotz-Burg) nur riesig
        expect(gate.only).toBe(k === 0 ? -1 : 1);
        // Ein Größentor hat keinen Zeitplan
        for (const time of [0, 600, 6000]) expect(gateAt(t, gate.first + 2, time)).toBe(false);
        const ring = t.sizers.find((z) => z.grow === (k === 1))!;
        expect(ring).toBeDefined();
        expect(t.branchOf[ring.seg]).toBeLessThan(0);
        // weit genug vor der Gabelung, dass man sich danach noch einordnen kann – aber nicht so weit, dass die Größe nicht reicht
        const lead = segDelta(t, ring.seg, t.branches[k].from) * t.step;
        expect(lead).toBeGreaterThan(75);
        expect(lead).toBeLessThan(110);
        // auf der Seite, auf der die Abzweigung abgeht
        const b = t.branches[k];
        const out = b.first + 45;
        const side = (t.px[out] - t.px[walk40(t, b.from)]) * rightX(t, walk40(t, b.from)) + (t.pz[out] - t.pz[walk40(t, b.from)]) * rightZ(t, walk40(t, b.from));
        expect(Math.sign((ring.lat0 + ring.lat1) / 2)).toBe(Math.sign(side));
        // in der Fahrbahn, breit genug, und daneben bleibt Platz, um ihn zu meiden
        expect(ring.lat1 - ring.lat0).toBeGreaterThan(4);
        expect(Math.max(Math.abs(ring.lat0), Math.abs(ring.lat1))).toBeLessThan(t.rh[ring.seg]);
        expect(Math.min(Math.abs(ring.lat0), Math.abs(ring.lat1))).toBeGreaterThan(0.5);
        // Die Größe hält vom Ring bis zur Mündung mit Reserve (in der Abkürzung selbst steht die Uhr still)
        expect((lead / 18) * 60).toBeLessThan(SIZE_TICKS - 120);
        expect(t.branchOnly[k]).toBe(gate.only);
      }
    }
  });

  it('wer durch einen Ring fährt, schrumpft bzw. wächst – daneben und rückwärts geschieht nichts, und die Größe läuft ab', () => {
    const t = setTrack(ZIMMER);
    for (const z of t.sizers) {
      const mid = (z.lat0 + z.lat1) / 2;
      expect(through(z, mid)).toBeCloseTo((z.grow ? 1 : -1) * SIZE_TICKS, -2);
      expect(sizeClass(through(z, mid))).toBe(z.grow ? 1 : -1);
      // knapp innerhalb beider Ränder
      expect(sizeClass(through(z, z.lat0 + 0.8))).toBe(z.grow ? 1 : -1);
      expect(sizeClass(through(z, z.lat1 - 0.8))).toBe(z.grow ? 1 : -1);
      // daneben vorbei
      expect(through(z, z.lat0 > 0 ? z.lat0 - 1.5 : z.lat1 + 1.5)).toBe(0);
      // rückwärts hindurch
      expect(through(z, mid, true)).toBe(0);
      // abgelaufen nach SIZE_TICKS
      const s = at(z.seg + 12, 0, 0);
      expect(t.branchOf[s.seg]).toBeLessThan(0);
      s.size = z.grow ? SIZE_TICKS : -SIZE_TICKS;
      for (let i = 0; i < SIZE_TICKS - 1; i++) stepKart(s, { steer: 0, buttons: 0 }, { canDrive: false, speedFactor: 1, time: i });
      expect(Math.abs(s.size)).toBe(1);
      stepKart(s, { steer: 0, buttons: 0 }, { canDrive: false, speedFactor: 1, time: SIZE_TICKS });
      expect(s.size).toBe(0);
      stepKart(s, { steer: 0, buttons: 0 }, { canDrive: false, speedFactor: 1, time: SIZE_TICKS + 1 });
      expect(s.size).toBe(0);
    }
  });

  it('winzig zieht schneller an und ist langsamer, riesig ist schneller und träger', () => {
    setTrack(ZIMMER);
    const small = drag(-500);
    const normal = drag(0);
    const big = drag(500);
    expect(small.top / normal.top).toBeCloseTo(SMALL_VMAX, 1);
    expect(big.top / normal.top).toBeCloseTo(BIG_VMAX, 1);
    expect(small.top).toBeLessThan(normal.top - 1);
    expect(big.top).toBeGreaterThan(normal.top + 1);
    expect(small.to15).toBeLessThan(normal.to15 - 5);
    expect(big.to15).toBeGreaterThan(normal.to15 + 5);
  });

  it('das Mauseloch lässt nur winzige Karts ein, die Bauklotz-Burg nur riesige – für alle anderen läuft die Bande durch', () => {
    const t = setTrack(ZIMMER);
    for (let k = 0; k < 2; k++) {
      const need = k === 0 ? -1 : 1;
      const b = t.branches[k];
      for (const size of [-600, 0, 600]) {
        // an der Mündung: Tor zu oder offen?
        expect(gateShut(t, b.first + 3, 1234, size)).toBe(sizeClass(size) !== need);
        // gefahren: mit fest gewähltem Weg auf die Abzweigung zu
        const s = at(walkBack(t, b.from, 70), 0, 20);
        const brain = newBrain(1, AI_HARD);
        brain.route = 1 << k;
        brain.routeLock = true;
        let on = 0;
        let walls = 0;
        let bad = 0;
        for (let i = 0; i < 60 * 9; i++) {
          s.size = size;
          const ev = stepKart(s, botCmd(s, brain, [], true, { tick: i, time: 600 + i, place: 1, smoke: false }), { canDrive: true, speedFactor: 1, time: 600 + i });
          if (ev & (EV_HIT | EV_FALL)) bad++;
          if (ev & EV_WALL) walls++;
          if (t.branchOf[s.seg] === k && t.twin[s.seg] < 0) on++;
        }
        expect(bad).toBe(0);
        if (sizeClass(size) === need) {
          // hinein und hindurch, ohne anzuecken
          expect(on).toBeGreaterThan(60);
          expect(walls).toBeLessThanOrEqual(1);
        } else {
          // kein einziger Schritt auf dem eigenen Stück der Abzweigung
          expect(on).toBe(0);
        }
      }
    }
  });

  it('die KI fährt die Strecke: die gute holt sich die Größe und nimmt die Abkürzungen, niemand bleibt vor einem Tor hängen', () => {
    const t = setTrack(ZIMMER);
    const used = [
      [0, 0],
      [0, 0],
      [0, 0],
    ];
    const walls = [0, 0, 0];
    const time = [0, 0, 0];
    let falls = 0;
    let hits = 0;
    for (let slot = 0; slot < 4; slot++) {
      for (const level of [AI_EASY, AI_MEDIUM, AI_HARD]) {
        const s = gridState(slot);
        const brain = newBrain(slot + level * 4, level);
        let progress = progDelta(t, 0, s.seg);
        let was = -1;
        let tick = 1;
        for (; tick < 60 * 300 && progress < 3 * t.n; tick++) {
          const before = s.seg;
          const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
          const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
          if (ev & EV_FALL) falls++;
          if (ev & EV_HIT) hits++;
          if (ev & EV_WALL) walls[level]++;
          const on = t.twin[s.seg] < 0 ? t.branchOf[s.seg] : -1;
          if (on >= 0 && on !== was) used[level][on]++;
          was = on;
          progress = addProgress(t, progress, before, s.seg);
        }
        expect(progress).toBeGreaterThanOrEqual(3 * t.n);
        time[level] += tick / 60 / 3;
      }
    }
    console.log(
      `Riesenkinderzimmer, KI in je 12 Runden: Mauseloch/Burg leicht ${used[0].join('/')}, mittel ${used[1].join('/')}, schwer ${used[2].join('/')}; Bandenstöße ${walls.join('/')}, Stürze ${falls}, Treffer ${hits}; Rundenzeit ${time.map((x) => (x / 4).toFixed(1)).join(' / ')} s`,
    );
    expect(falls).toBeLessThanOrEqual(1);
    expect(hits).toBe(0);
    for (const n of walls) expect(n).toBeLessThanOrEqual(6);
    // schwer: beide Abkürzungen in den meisten Runden; leicht: selten
    expect(used[AI_HARD][0]).toBeGreaterThanOrEqual(8);
    expect(used[AI_HARD][1]).toBeGreaterThanOrEqual(8);
    expect(used[AI_EASY][0] + used[AI_EASY][1]).toBeLessThan(used[AI_HARD][0] + used[AI_HARD][1]);
  });
});

describe('Rempeln nach Größe', () => {
  /** Kart 0 fährt mit Vollgas von hinten auf das stehende Kart 1 auf; Größen fest. Liefert Tempo beider danach und ob 1 geplättet wurde. */
  function ram(size0: number, size1: number): { v0: number; v1: number; flat: number; gap: number } {
    setTrack(ZIMMER);
    const host = new HostGame(0);
    host.setRoster([0, 1], false);
    host.newRace();
    const NEUTRAL: Cmd = { steer: 0, buttons: 0 };
    while (host.phase !== RACE_RUNNING) host.step(NEUTRAL);
    host.debugPlace(1, 150, 0);
    host.debugPlace(0, 120, 0);
    const a = host.authoritative(0)!;
    const b = host.authoritative(1)!;
    let v0 = 0;
    let v1 = 0;
    let flat = 0;
    let touched = -1;
    for (let i = 0; i < 60 * 4; i++) {
      a.size = size0;
      b.size = size1;
      const before = Math.hypot(b.vx, b.vz);
      host.step({ steer: 0, buttons: BTN_GAS });
      flat = Math.max(flat, b.flat);
      if (touched < 0 && Math.hypot(b.vx, b.vz) > before + 0.5) touched = i;
      if (touched >= 0 && i === touched + 2) {
        v0 = Math.hypot(a.vx, a.vz);
        v1 = Math.hypot(b.vx, b.vz);
      }
    }
    expect(touched).toBeGreaterThan(0);
    return { v0, v1, flat, gap: Math.hypot(a.x - b.x, a.z - b.z) };
  }

  it('gleich große teilen sich den Stoß; ein riesiges schiebt ein winziges fast ungebremst weg und plättet es; ein winziges prallt an einem riesigen ab', () => {
    const same = ram(0, 0);
    const bigOnSmall = ram(500, -500);
    const smallOnBig = ram(-500, 500);
    // gleich groß: der Gerammte nimmt Fahrt auf, der Rammer verliert deutlich, niemand wird geplättet
    expect(same.v1).toBeGreaterThan(4);
    expect(same.flat).toBe(0);
    // riesig auf winzig: der Winzige wird viel schneller weggeschleudert und ist platt; der Riese behält mehr Tempo
    expect(bigOnSmall.flat).toBeGreaterThan(0);
    expect(bigOnSmall.v1).toBeGreaterThan(same.v1 * 1.3);
    expect(bigOnSmall.v0).toBeGreaterThan(same.v0 + 1);
    // winzig auf riesig: der Riese rührt sich kaum, niemand wird geplättet (der Winzige ist ja der Rammer)
    expect(smallOnBig.v1).toBeLessThan(same.v1 * 0.5);
    expect(smallOnBig.flat).toBe(0);
  });
});

/** 40 Abschnitte hinter seg auf der Hauptstrecke. */
function walk40(t: typeof TRACK, seg: number): number {
  let i = seg;
  for (let k = 0; k < 40; k++) i = t.next[i];
  return i;
}

/** n Abschnitte vor seg auf der Hauptstrecke. */
function walkBack(t: typeof TRACK, seg: number, n: number): number {
  let i = seg;
  for (let k = 0; k < n; k++) i = t.prev[i];
  return i;
}

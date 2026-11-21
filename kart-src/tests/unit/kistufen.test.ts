import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { withoutMechanics } from './helpers';
import {
  AI_EASY,
  AI_HARD,
  AI_LEVEL_COUNT,
  AI_LEVEL_NAMES,
  AI_MEDIUM,
  AI_PRO,
  AI_VERY_EASY,
  PRO_ROUTE,
  botCmd,
  botSpeed,
  cleanAiLevel,
  newBrain,
  racingLine,
  rubberBand,
} from '../../src/game/ai';
import { EV_FALL, ITEM_NONE, ITEM_OIL, gridState, stepKart, type KartState } from '../../src/game/sim';
import { EDGE_GAP, TRACK, TRACK_COUNT, addProgress, progDelta, rightX, rightZ, setTrack, trackHeading } from '../../src/game/track';
import { HostLobby } from '../../src/lobby/hostLobby';

// Die Lobby braucht nur die Zeitgeber des Browsers.
beforeAll(() => {
  (globalThis as unknown as { window: unknown }).window ??= globalThis;
});
const open: HostLobby[] = [];
afterEach(() => {
  for (const l of open.splice(0)) l.close();
});
afterAll(() => {
  setTrack(0);
});

/** Drei Runden allein (mit Streckenmechanik); Zeit ab „Los“ und Zahl der Stürze. */
function race(level: number, slot: number, route = -1): { time: number; falls: number } {
  const s = gridState(0, slot);
  const brain = newBrain(slot, level);
  if (route >= 0) {
    brain.route = route;
    brain.routeLock = true;
  }
  let progress = progDelta(TRACK, 0, s.seg);
  let falls = 0;
  for (let tick = 1; tick < 3 * 150 * 60; tick++) {
    const before = s.seg;
    const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
    if (stepKart(s, cmd, { canDrive: true, speedFactor: botSpeed(brain, brain.skill), time: tick }) & EV_FALL) falls++;
    progress = addProgress(TRACK, progress, before, s.seg);
    if (progress >= 3 * TRACK.n) return { time: tick / 60, falls };
  }
  return { time: Infinity, falls };
}

describe('KI-Stufen', () => {
  it('fünf Stufen; alte Speicherstände der Lobby (drei Stufen) werden umgerechnet', () => {
    expect(AI_LEVEL_NAMES).toEqual(['Sehr leicht', 'Leicht', 'Mittel', 'Schwer', 'Profi']);
    expect(AI_LEVEL_COUNT).toBe(5);
    expect([AI_VERY_EASY, AI_EASY, AI_MEDIUM, AI_HARD, AI_PRO]).toEqual([0, 1, 2, 3, 4]);
    expect([cleanAiLevel(-3), cleanAiLevel(9), cleanAiLevel(Number.NaN), cleanAiLevel(2.6)]).toEqual([0, 4, 0, 3]);
    const lobby = (saved?: ConstructorParameters<typeof HostLobby>[3]): HostLobby => {
      const l = new HostLobby('ABCD', 'token-host', 'Anna', saved);
      open.push(l);
      return l;
    };
    expect(lobby().aiLevel).toBe(AI_MEDIUM);
    // Früher: 0 leicht, 1 mittel, 2 schwer.
    const old = (aiLevel: number) => lobby({ code: 'ABCD', seats: [], aiLevel }).aiLevel;
    expect([old(0), old(1), old(2)]).toEqual([AI_EASY, AI_MEDIUM, AI_HARD]);
    expect(lobby({ code: 'ABCD', seats: [], aiStufe: AI_PRO }).aiLevel).toBe(AI_PRO);
    const l = lobby();
    l.setAiLevel(AI_PRO);
    expect(l.toSave().aiStufe).toBe(AI_PRO);
    l.setAiLevel(AI_VERY_EASY);
    expect(l.state().aiLevel).toBe(AI_VERY_EASY);
  });

  it('Grundtempo und Gummiband: der Profi fährt mit vollem Tempo und bremst in Führung nicht', () => {
    for (let slot = 0; slot < 4; slot++) {
      expect(newBrain(slot, AI_PRO).skill).toBe(1);
      expect(newBrain(slot, AI_VERY_EASY).skill).toBeLessThan(newBrain(slot, AI_EASY).skill);
      expect(newBrain(slot, AI_HARD).skill).toBeLessThanOrEqual(1.01);
    }
    expect(rubberBand(80, AI_PRO)).toBe(1);
    expect(rubberBand(-80, AI_PRO)).toBeLessThan(rubberBand(-80, AI_HARD));
    expect(rubberBand(80, AI_VERY_EASY)).toBeLessThan(rubberBand(80, AI_EASY));
  });

  it('die Ideallinie bleibt auf der Fahrbahn und läuft über Lücken in der Mitte', () => {
    for (let ti = 0; ti < TRACK_COUNT; ti++) {
      const t = setTrack(ti);
      const line = racingLine(t);
      expect(line.length).toBe(t.total);
      let worst = 0;
      let used = 0;
      for (let i = 0; i < t.total; i++) {
        expect(Number.isFinite(line[i])).toBe(true);
        worst = Math.max(worst, Math.abs(line[i]) - (t.rh[i] - 1.5));
        if ((t.edge[i] & EDGE_GAP) !== 0) expect(line[i]).toBe(0);
        used = Math.max(used, Math.abs(line[i]));
      }
      // Höchstens bis 1,5 m an den Fahrbahnrand (das Kart ist 2 m breit) – und sie nutzt die Breite auch.
      expect(worst, t.def.name).toBeLessThanOrEqual(1e-9);
      expect(used, t.def.name).toBeGreaterThan(2.5);
    }
  });

  it('jede Stufe ist schneller als die darunter – auf allen Strecken, mit Streckenmechanik', () => {
    const sum = [0, 0, 0, 0, 0];
    const falls = [0, 0, 0, 0, 0];
    const rows: string[] = [];
    for (let ti = 0; ti < TRACK_COUNT; ti++) {
      setTrack(ti);
      const row: string[] = [];
      for (let level = 0; level < AI_LEVEL_COUNT; level++) {
        let time = 0;
        for (const slot of [0, 2]) {
          const r = race(level, slot);
          expect(r.time, `${TRACK.def.name}, ${AI_LEVEL_NAMES[level]}, Platz ${slot}`).toBeLessThan(Infinity);
          time += r.time / 2;
          falls[level] += r.falls;
        }
        sum[level] += time;
        row.push(time.toFixed(1));
      }
      rows.push(`${TRACK.def.name.padEnd(19)} ${row.join(' / ')} s`);
      // Auch auf jeder einzelnen Strecke ist der Profi vorn und die sehr leichte KI hinten.
      expect(Number(row[AI_PRO]), TRACK.def.name).toBeLessThan(Number(row[AI_HARD]) + 1);
      expect(Number(row[AI_VERY_EASY]), TRACK.def.name).toBeGreaterThan(Number(row[AI_EASY]));
    }
    rows.push(`Summe ${sum.map((x) => x.toFixed(0)).join(' / ')} s · Stürze ${falls.join(' / ')}`);
    console.log(`Drei Runden allein, sehr leicht / leicht / mittel / schwer / Profi:\n${rows.join('\n')}`);
    for (let level = 1; level < AI_LEVEL_COUNT; level++) expect(sum[level]).toBeLessThan(sum[level - 1]);
    // Gemessen beim Einbau (Plätze 0 und 2 – dort fährt die schwere KI mit ihrem höchsten Grundtempo): Profi 3,4 %
    // schneller als schwer (über alle vier Plätze 5,4 %), sehr leicht 9 % langsamer als leicht.
    expect(sum[AI_PRO]).toBeLessThan(sum[AI_HARD] * 0.975);
    expect(sum[AI_VERY_EASY]).toBeGreaterThan(sum[AI_EASY] * 1.06);
    expect(falls[AI_PRO]).toBeLessThanOrEqual(1);
    expect(falls[AI_VERY_EASY]).toBeLessThanOrEqual(1);
  }, 300000);

  it('der Profi kennt den schnelleren Weg (PRO_ROUTE stimmt noch)', () => {
    const rows: string[] = [];
    for (let ti = 0; ti < TRACK_COUNT; ti++) {
      setTrack(ti);
      const branches = TRACK.def.branches ?? [];
      if (branches.length === 0) {
        expect(PRO_ROUTE[TRACK.def.id], TRACK.def.id).toBeUndefined();
        continue;
      }
      // (Abkürzungen über ein Zugdach gibt es nur mit Zug – ohne Mechanik sind sie ein Graben.)
      const train = branches.reduce((m, b, k) => (b.shortcut === 'train' ? m | (1 << k) : m), 0);
      const times = new Map<number, number>();
      for (let route = 0; route < 1 << branches.length; route++) {
        if (route & train) continue;
        times.set(route, withoutMechanics(() => (race(AI_PRO, 0, route).time + race(AI_PRO, 2, route).time) / 2));
      }
      const best = Math.min(...times.values());
      const chosen = PRO_ROUTE[TRACK.def.id];
      expect(chosen, TRACK.def.id).toBeDefined();
      rows.push(`${TRACK.def.id.padEnd(10)} gewählt ${chosen}: ${times.get(chosen)!.toFixed(1)} s, bester ${best.toFixed(1)} s`);
      // Der eingetragene Weg ist (bis auf eine Sekunde in drei Runden) der schnellste.
      expect(times.get(chosen)!, TRACK.def.id).toBeLessThanOrEqual(best + 1);
    }
    console.log(rows.join('\n'));
  }, 300000);

  it('der Profi hält in Führung ein Abwehr-Item, bis jemand dicht dahinter ist – die schwere KI wirft es aus Ungeduld', () => {
    const t = setTrack(0);
    const start = 60;
    const place = (s: KartState, seg: number): void => {
      s.seg = seg;
      s.x = t.px[seg];
      s.z = t.pz[seg];
      s.y = t.py[seg];
      s.heading = trackHeading(t, seg);
    };
    const run = (level: number, chaser: boolean): number => {
      const s = gridState(1);
      place(s, start);
      s.item = ITEM_OIL;
      const brain = newBrain(1, level);
      const behind = gridState(2);
      for (let tick = 1; tick <= 1500; tick++) {
        // Der Verfolger fährt (wenn es ihn gibt) 8 m dahinter mit.
        const others: KartState[] = [];
        if (chaser && tick > 900) {
          const seg = (s.seg - Math.round(8 / t.step) + t.n) % t.n;
          place(behind, seg);
          behind.x += rightX(t, seg) * 0.01;
          behind.z += rightZ(t, seg) * 0.01;
          others.push(behind);
        }
        stepKart(s, botCmd(s, brain, others, true, { tick, time: tick, place: 1, smoke: false }), { canDrive: true, speedFactor: 1, time: tick });
        if (s.item === ITEM_NONE) return tick;
      }
      return -1;
    };
    // Allein vorn: der Profi behält es, die schwere KI wirft es nach spätestens 480 · 0,7 Schritten weg.
    expect(run(AI_PRO, false)).toBe(-1);
    expect(run(AI_HARD, false)).toBeGreaterThan(0);
    // Kommt jemand dicht heran, legt der Profi es ihm vor die Räder.
    expect(run(AI_PRO, true)).toBeGreaterThan(900);
  });
});

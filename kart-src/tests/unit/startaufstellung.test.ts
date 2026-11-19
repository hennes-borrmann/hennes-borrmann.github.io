// Startaufstellung: Im Einzelrennen und im ersten Turnierrennen gelost, danach gespiegelt – der Letzte des Vorrennens
// startet ganz vorn, der Sieger ganz hinten (lobby/cup.ts: gridOrder; hostGame.ts: setGrid).

import { describe, expect, it } from 'vitest';
import { gridOrder } from '../../src/lobby/cup';
import { HostGame } from '../../src/game/hostGame';
import { TRACK, progDelta } from '../../src/game/track';
import { seeded } from '../../src/render/build';

const places = (order: number[]): { slot: number; place: number }[] => order.map((slot, i) => ({ slot, place: i + 1 }));

describe('Startaufstellung', () => {
  it('ohne Vorrennen gelost: jede Reihenfolge kommt vor, jeder Platz startet gleich oft vorn', () => {
    const rnd = seeded(7);
    const front = [0, 0, 0, 0];
    const seen = new Set<string>();
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const o = gridOrder([0, 1, 2, 3], null, rnd);
      expect([...o].sort()).toEqual([0, 1, 2, 3]);
      front[o[0]]++;
      seen.add(o.join());
    }
    expect(seen.size).toBe(24);
    for (const f of front) expect(Math.abs(f / N - 0.25)).toBeLessThan(0.03);
  });

  it('mit Vorrennen gespiegelt: Letzter vorn, Dritter auf 2, Zweiter auf 3, Sieger hinten', () => {
    // Vorrennen: Platz 2 gewinnt, dann 0, 3, 1.
    const prev = places([2, 0, 3, 1]);
    for (let s = 1; s < 20; s++) expect(gridOrder([0, 1, 2, 3], prev, seeded(s))).toEqual([1, 3, 0, 2]);
  });

  it('wer im Vorrennen fehlte, startet vorn; Fehlende im Vorrennen stören nicht', () => {
    // Nur 0 und 1 sind im Vorrennen gefahren (0 gewann); 2 und 3 sind neu – sie stehen vorn, untereinander gelost.
    const prev = places([0, 1]);
    const firsts = new Set<number>();
    for (let s = 1; s < 40; s++) {
      const o = gridOrder([0, 1, 2, 3], prev, seeded(s));
      expect(o.slice(2)).toEqual([1, 0]);
      expect([...o.slice(0, 2)].sort()).toEqual([2, 3]);
      firsts.add(o[0]);
    }
    expect(firsts.size).toBe(2);
    // Wer im Vorrennen fuhr, jetzt aber nicht dabei ist, kommt in der Aufstellung nicht vor.
    expect(gridOrder([1, 3], places([3, 0, 1, 2]), seeded(3))).toEqual([1, 3]);
  });

  it('der Host stellt die Karts nach der Aufstellung auf (vorn = weiter vorn auf der Strecke, Lücken zählen nicht)', () => {
    const host = new HostGame(0);
    host.setRoster([0, 1], true);
    host.setGrid([3, 1, 0, 2]);
    host.newRace();
    const ahead = (slot: number): number => progDelta(TRACK, host.authoritative(slot)!.seg, 0);
    // Weniger Weg bis zur Linie = weiter vorn.
    const byFront = [0, 1, 2, 3].sort((a, b) => ahead(a) - ahead(b));
    expect(byFront).toEqual([3, 1, 0, 2]);
    // Ohne Angabe: nach Platznummer (wie bisher).
    const plain = new HostGame(0);
    plain.setRoster([0, 1], true);
    plain.newRace();
    expect([0, 1, 2, 3].sort((a, b) => progDelta(TRACK, plain.authoritative(a)!.seg, 0) - progDelta(TRACK, plain.authoritative(b)!.seg, 0))).toEqual([0, 1, 2, 3]);
    // Fährt nur ein Teil mit, rücken die Startplätze auf: zwei Karts stehen auf Startplatz 0 und 1.
    const two = new HostGame(0);
    two.setRoster([0, 2], false);
    two.setGrid([3, 2, 1, 0]);
    two.newRace();
    const s2 = two.authoritative(2)!;
    const s0 = two.authoritative(0)!;
    expect(progDelta(TRACK, s2.seg, 0)).toBeLessThan(progDelta(TRACK, s0.seg, 0));
    // (Startplatz 1 liegt 9,5 m hinter der Linie, nicht 18,5 m wie Startplatz 3.)
    expect(progDelta(TRACK, s0.seg, 0)).toBeLessThanOrEqual(Math.round(9.5 / TRACK.step) + 1);
  });
});

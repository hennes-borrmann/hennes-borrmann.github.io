// Turnier: Auslosung, Sterne, Rangfolge (lobby/cup.ts).

import { describe, expect, it } from 'vitest';
import { CUP_SIZES, STRIP_LENGTH, STRIP_STOP, cleanCupRaces, cupOver, cupRanking, makeDraw, newCup, pickTrack, resetSlot, scoreRace, starsFor } from '../../src/lobby/cup';
import { seeded } from '../../src/render/build';

const places = (order: number[]): { slot: number; place: number }[] => order.map((slot, i) => ({ slot, place: i + 1 }));

describe('Turnier: Sterne', () => {
  it('ein Stern für jedes Kart, das man hinter sich lässt', () => {
    expect([1, 2, 3, 4].map((p) => starsFor(p, 4))).toEqual([3, 2, 1, 0]);
    expect([1, 2].map((p) => starsFor(p, 2))).toEqual([1, 0]);
    expect(starsFor(1, 1)).toBe(0);
  });

  it('wertet Rennen, zählt Siege und endet nach der gewählten Zahl', () => {
    let cup = newCup(3);
    cup = scoreRace(cup, 2, places([1, 0, 3, 2]));
    expect(cup.stars).toEqual([2, 3, 0, 1]);
    expect(cup.last).toEqual([2, 3, 0, 1]);
    expect(cup.wins).toEqual([0, 1, 0, 0]);
    cup = scoreRace(cup, 5, places([0, 1, 2, 3]));
    cup = scoreRace(cup, 0, places([0, 3, 1, 2]));
    expect(cup.done).toBe(3);
    expect(cupOver(cup)).toBe(true);
    expect(cup.stars).toEqual([8, 6, 1, 3]);
    expect(cup.played).toEqual([2, 5, 0]);
    // Ein viertes Rennen ändert nichts mehr.
    expect(scoreRace(cup, 1, places([3, 2, 1, 0]))).toBe(cup);
  });

  it('Rangfolge: Sterne, dann Siege, dann das bessere letzte Rennen; echter Gleichstand teilt den Rang', () => {
    let cup = newCup(5);
    cup = scoreRace(cup, 0, places([0, 1, 2, 3])); // 3 2 1 0
    cup = scoreRace(cup, 1, places([1, 0, 3, 2])); // 2 3 0 1  → 5 5 1 1, je ein Sieg für 0 und 1
    const r = cupRanking(cup, [0, 1, 2, 3]);
    // 0 und 1: gleich viele Sterne und Siege – Platz 1 im letzten Rennen entscheidet.
    expect(r.map((x) => x.slot)).toEqual([1, 0, 3, 2]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3, 4]);
    const even = cupRanking(newCup(3), [0, 2]);
    expect(even.map((x) => x.rank)).toEqual([1, 1]);
  });

  it('ein Platz, der den Besitzer wechselt, beginnt bei null', () => {
    const cup = resetSlot(scoreRace(newCup(3), 0, places([2, 0, 1, 3])), 2);
    expect(cup.stars).toEqual([2, 1, 0, 0]);
    expect(cup.wins).toEqual([0, 0, 0, 0]);
  });

  it('nur 3, 5 oder 10 Rennen sind ein Turnier', () => {
    expect(CUP_SIZES.map(cleanCupRaces)).toEqual([3, 5, 10]);
    expect([0, 1, 4, 11, NaN, '5', null].map(cleanCupRaces)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('Turnier: Auslosung', () => {
  it('jede Strecke kommt dran, bevor sich eine wiederholt – und nie dieselbe zweimal hintereinander', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rnd = seeded(seed);
      let cup = newCup(10);
      const offered = 8;
      for (let race = 0; race < 24; race++) {
        const t = pickTrack(cup, offered, rnd);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(offered);
        if (cup.played.length > 0) expect(t).not.toBe(cup.played[cup.played.length - 1]);
        cup = { ...cup, played: [...cup.played, t] };
      }
      // Die ersten acht und die zweiten acht sind je einmal alle Strecken.
      expect([...cup.played.slice(0, 8)].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect([...cup.played.slice(8, 16)].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    }
  });

  it('über viele Turniere ist jede Strecke etwa gleich oft die erste', () => {
    const rnd = seeded(7);
    const first = new Array<number>(8).fill(0);
    for (let i = 0; i < 4000; i++) first[pickTrack(newCup(3), 8, rnd)]++;
    for (const n of first) expect(Math.abs(n - 500)).toBeLessThan(90);
  });

  it('der Streifen hält auf der ausgelosten Strecke und zeigt nie zwei gleiche Karten nebeneinander', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rnd = seeded(seed);
      const cup = { ...newCup(5), played: [3, 1] };
      const d = makeDraw(cup, 8, rnd, seed);
      expect(d.strip.length).toBe(STRIP_LENGTH);
      expect(d.stop).toBe(STRIP_STOP);
      expect(d.id).toBe(seed);
      expect([3, 1]).not.toContain(d.strip[d.stop]);
      expect(Math.abs(d.nudge)).toBeLessThanOrEqual(0.28);
      for (let i = 1; i < d.strip.length; i++) expect(d.strip[i]).not.toBe(d.strip[i - 1]);
      for (const t of d.strip) expect(t >= 0 && t < 8).toBe(true);
    }
  });

  it('kommt auch mit einer oder zwei Strecken zurecht', () => {
    const rnd = seeded(3);
    expect(makeDraw(newCup(3), 1, rnd, 1).strip.every((t) => t === 0)).toBe(true);
    const two = makeDraw(newCup(3), 2, rnd, 2);
    for (let i = 1; i < two.strip.length; i++) expect(two.strip[i]).not.toBe(two.strip[i - 1]);
  });
});

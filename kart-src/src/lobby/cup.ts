// Turnier: mehrere Rennen hintereinander, die Strecke wird jedes Mal ausgelost.
// Je Rennen gibt es Sterne nach Platz, am Ende gewinnt, wer die meisten hat.
//
// Hier steht nur die Rechnung (würfeln, werten, Rangfolge) – ohne Netz und ohne
// Anzeige, damit sie sich für sich prüfen lässt. Die Lobby des Hosts hält den Stand
// (hostLobby.ts) und verteilt ihn an alle Bildschirme.

import type { CupDraw, CupState } from '../net/protocol';

/** Wählbare Längen eines Turniers (Rennen). */
export const CUP_SIZES: readonly number[] = [3, 5, 10];
/** Plätze, für die Sterne geführt werden (so viele Karts fahren höchstens). */
const SLOTS = 4;
/** Karten im Streifen der Auslosung und die Stelle, an der er stehen bleibt. */
export const STRIP_LENGTH = 34;
export const STRIP_STOP = 28;

/** 0 (Einzelrennen) oder eine der wählbaren Turnierlängen; alles andere wird 0. */
export function cleanCupRaces(n: unknown): number {
  return typeof n === 'number' && CUP_SIZES.includes(n) ? n : 0;
}

export function newCup(races: number): CupState {
  const zero = (): number[] => new Array<number>(SLOTS).fill(0);
  return { races, done: 0, stars: zero(), wins: zero(), last: zero(), played: [], draw: null };
}

export function cupOver(cup: CupState): boolean {
  return cup.done >= cup.races;
}

/** Sterne für einen Platz: einer für jedes Kart, das man hinter sich lässt. */
export function starsFor(place: number, karts: number): number {
  return Math.max(0, Math.min(SLOTS - 1, karts - place));
}

/**
 * Wertet ein Rennen: standings nennt je Kart seinen Platz (1 = Sieger). Liefert den neuen Stand;
 * ein schon beendetes Turnier bleibt, wie es ist.
 */
export function scoreRace(cup: CupState, track: number, standings: { slot: number; place: number }[]): CupState {
  if (cupOver(cup)) return cup;
  const stars = cup.stars.slice();
  const wins = cup.wins.slice();
  const last = new Array<number>(SLOTS).fill(0);
  for (const s of standings) {
    if (s.slot < 0 || s.slot >= SLOTS) continue;
    const got = starsFor(s.place, standings.length);
    stars[s.slot] += got;
    last[s.slot] = got;
    if (s.place === 1) wins[s.slot]++;
  }
  return { ...cup, done: cup.done + 1, stars, wins, last, played: [...cup.played, track], draw: null };
}

/** Ein Platz wechselt den Besitzer (Spieler geht, anderer kommt): seine Sterne beginnen bei null. */
export function resetSlot(cup: CupState, slot: number): CupState {
  if (slot < 0 || slot >= SLOTS) return cup;
  const wipe = (a: number[]): number[] => a.map((v, i) => (i === slot ? 0 : v));
  return { ...cup, stars: wipe(cup.stars), wins: wipe(cup.wins), last: wipe(cup.last) };
}

/**
 * Würfelt die nächste Strecke: keine zweimal, bevor nicht alle dran waren, und nie dieselbe
 * zweimal hintereinander (sofern es mehr als eine gibt).
 * @param offered so viele Strecken (0 … offered−1) stehen zur Wahl
 * @param rnd     Zufall 0 ≤ x < 1
 */
export function pickTrack(cup: CupState, offered: number, rnd: () => number): number {
  const n = Math.max(1, Math.floor(offered));
  const valid = cup.played.filter((t) => t >= 0 && t < n);
  // Was im laufenden Durchgang durch alle Strecken schon dran war
  const round = valid.slice(Math.floor(valid.length / n) * n);
  let pool: number[] = [];
  for (let t = 0; t < n; t++) if (!round.includes(t)) pool.push(t);
  const before = valid[valid.length - 1];
  if (pool.length > 1) pool = pool.filter((t) => t !== before);
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}

/**
 * Baut die Auslosung: einen Streifen aus zufälligen Strecken, in dem nie zwei gleiche
 * nebeneinanderliegen, mit der ausgelosten an der Haltestelle.
 */
export function makeDraw(cup: CupState, offered: number, rnd: () => number, id: number): CupDraw {
  const n = Math.max(1, Math.floor(offered));
  const pick = pickTrack(cup, n, rnd);
  const strip = new Array<number>(STRIP_LENGTH).fill(pick);
  const other = (a: number, b: number): number => {
    if (n === 1) return 0;
    for (let tries = 0; tries < 40; tries++) {
      const t = Math.min(n - 1, Math.floor(rnd() * n));
      if (t !== a && (t !== b || n === 2)) return t;
    }
    for (let t = 0; t < n; t++) if (t !== a && t !== b) return t;
    return (a + 1) % n;
  };
  // Von der Haltestelle aus nach beiden Seiten füllen: so stimmen ihre Nachbarn auf jeden Fall.
  for (let i = STRIP_STOP - 1; i >= 0; i--) strip[i] = other(strip[i + 1], -1);
  for (let i = STRIP_STOP + 1; i < STRIP_LENGTH; i++) strip[i] = other(strip[i - 1], -1);
  return { id, strip, stop: STRIP_STOP, nudge: (rnd() - 0.5) * 0.56 };
}

export interface CupRank {
  slot: number;
  /** Rang im Turnier, 1 = vorn; gleich bei völligem Gleichstand. */
  rank: number;
  stars: number;
  wins: number;
  /** Sterne aus dem letzten gewerteten Rennen. */
  last: number;
}

/**
 * Rangfolge der genannten Plätze: mehr Sterne, dann mehr Siege, dann das bessere letzte Rennen.
 * Wer danach noch gleichauf liegt, teilt sich den Rang.
 */
export function cupRanking(cup: CupState, slots: number[]): CupRank[] {
  const rows = slots
    .filter((s) => s >= 0 && s < SLOTS)
    .map((slot) => ({ slot, rank: 0, stars: cup.stars[slot] ?? 0, wins: cup.wins[slot] ?? 0, last: cup.last[slot] ?? 0 }));
  const cmp = (a: CupRank, b: CupRank): number => b.stars - a.stars || b.wins - a.wins || b.last - a.last;
  rows.sort((a, b) => cmp(a, b) || a.slot - b.slot);
  rows.forEach((r, i) => (r.rank = i > 0 && cmp(rows[i - 1], r) === 0 ? rows[i - 1].rank : i + 1));
  return rows;
}

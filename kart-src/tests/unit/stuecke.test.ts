import { describe, expect, it } from 'vitest';
import { SONGS, compileSong, type Song, type SongDef } from '../../src/audio/songs';
import { NEUE_STUECKE } from '../../src/audio/songs-neu';
import { GEWITTER_STUECK } from '../../src/audio/stuecke/gewitter';
import { HAFEN_STUECK } from '../../src/audio/stuecke/hafen';
import type { MusicId } from '../../src/audio/types';

// Jedes Stück aus src/audio/stuecke/ steht hier mit seinem Schlüssel in SONGS.
// Ein neues Stück muss nur in diese Liste eingetragen werden.
const STUECKE: { schluessel: MusicId; def: SongDef }[] = [
  { schluessel: 'hafen', def: HAFEN_STUECK },
  { schluessel: 'gewitter', def: GEWITTER_STUECK },
];

// Maßstab sind die vier ursprünglichen Rennstücke (in songs.ts) – weder die aus songs-neu.ts
// noch die aus stuecke/; jede Definition nur einmal (ein Platzhalter kann ein Stück doppelt eintragen).
const nichtUrspruenglich = new Set<SongDef>([...Object.values(NEUE_STUECKE), ...STUECKE.map((s) => s.def)]);
const urspruenglich = [...new Map(Object.entries(SONGS).filter(([, d]) => d.race && !nichtUrspruenglich.has(d)).map(([n, d]) => [d, n])).entries()].map(
  ([d, n]) => compileSong(d, n),
);
const kuerzestes = Math.min(...urspruenglich.map((s) => s.steps));
const pegel = urspruenglich.map((s) => s.def.level);
type Stimme = 'lead' | 'bass' | 'comp';

function toene(stueck: Song, stimme: Stimme): number[] {
  return stimme === 'comp' ? stueck.comp.flatMap((ton) => ton?.midis ?? []) : stueck[stimme].flatMap((ton) => (ton ? [ton.midi] : []));
}

/** Ein einzelner Abschnitt, für sich übersetzt. */
function abschnitt(def: SongDef, key: string, name: string): Song {
  return compileSong({ ...def, order: key }, `${name}/${key}`);
}

/** Melodie bzw. Bass eines Abschnitts als [Ton, Länge] je Schritt – genau und relativ zum ersten Ton. */
function linie(s: Song, stimme: 'lead' | 'bass', relativ: boolean): string {
  const erster = toene(s, stimme)[0] ?? 0;
  return JSON.stringify(s[stimme].map((t) => (t ? [t.midi - (relativ ? erster : 0), t.steps] : null)));
}

describe('Stücke aus audio/stuecke/', () => {
  it('Maßstab: die vier ursprünglichen Rennstücke', () => {
    expect(urspruenglich.length).toBe(4);
  });

  for (const { schluessel, def } of STUECKE) {
    it(`${schluessel}: ist in SONGS unter seinem Schlüssel eingetragen`, () => {
      expect(SONGS[schluessel]).toBe(def);
    });

    it(`${schluessel}: übersetzt alle Abschnitte in vollständige, spielbare Stimmen`, () => {
      // compileSong wirft bei ungültigen Noten, Akkorden oder Taktlängen.
      const stueck = compileSong(def, schluessel);
      expect(def.race).toBe(true);
      expect(stueck.steps).toBeGreaterThanOrEqual(kuerzestes);
      expect(stueck.steps % 16).toBe(0);
      expect(new Set(def.order).size).toBeGreaterThanOrEqual(2);
      expect(Object.keys(def.sections).sort()).toEqual([...new Set(def.order)].sort());
      expect(def.bpm).toBeGreaterThanOrEqual(Math.min(...urspruenglich.map((s) => s.def.bpm)));
      expect(def.bpm).toBeLessThanOrEqual(Math.max(...urspruenglich.map((s) => s.def.bpm)));
      for (const stimme of ['lead', 'bass', 'comp', 'kick', 'snare', 'hat', 'perc'] as const) {
        expect(stueck[stimme]).toHaveLength(stueck.steps);
        expect(stueck[stimme].some((ereignis) => !!ereignis)).toBe(true);
      }
      for (const stimme of ['lead', 'bass'] as const) {
        stueck[stimme].forEach((ton, schritt) => {
          if (!ton) return;
          expect(ton.steps).toBeGreaterThan(0);
          // Auch gebundene Töne müssen vor dem Schleifenende ausklingen können.
          expect(schritt + ton.steps).toBeLessThanOrEqual(stueck.steps);
        });
      }
      // Unbekannte Musterzeichen würden vom Übersetzer still als Pause behandelt.
      for (const a of Object.values(def.sections)) {
        expect(a.comp.replace(/\s|\|/g, '')).toMatch(/^[.\-xXo0-9]+$/);
        for (const schlagzeug of [a.kick, a.snare, a.hat, a.perc ?? '']) expect(schlagzeug.replace(/\s|\|/g, '')).toMatch(/^[.\-xXgo]*$/);
      }
    });

    it(`${schluessel}: hält Tonumfang und Gesamtpegel im Bereich der ursprünglichen Rennstücke`, () => {
      const stueck = compileSong(def, schluessel);
      for (const stimme of ['lead', 'bass', 'comp'] as const) {
        const bestand = urspruenglich.flatMap((s) => toene(s, stimme));
        const neu = toene(stueck, stimme);
        expect(neu.length).toBeGreaterThan(0);
        expect(neu.every(Number.isFinite)).toBe(true);
        expect(Math.min(...neu)).toBeGreaterThanOrEqual(Math.min(...bestand));
        expect(Math.max(...neu)).toBeLessThanOrEqual(Math.max(...bestand));
      }
      expect(Number.isFinite(def.level)).toBe(true);
      expect(def.level).toBeGreaterThanOrEqual(Math.min(...pegel));
      expect(def.level).toBeLessThanOrEqual(Math.max(...pegel));
    });

    it(`${schluessel}: kein Abschnitt gleicht Note für Note (auch nicht verschoben) einem Abschnitt eines anderen Stücks`, () => {
      const andere = new Map<SongDef, string>();
      for (const [n, d] of Object.entries(SONGS)) if (d !== def) andere.set(d, n);
      for (const [n, d] of Object.entries(NEUE_STUECKE)) if (d !== def) andere.set(d, n);
      for (const s of STUECKE) if (s.def !== def) andere.set(s.def, s.schluessel);
      expect(andere.size).toBeGreaterThanOrEqual(10);
      for (const key of Object.keys(def.sections)) {
        const mein = abschnitt(def, key, schluessel);
        for (const [d, n] of andere) {
          for (const k2 of Object.keys(d.sections)) {
            const fremd = abschnitt(d, k2, n);
            for (const stimme of ['lead', 'bass'] as const) {
              expect(linie(mein, stimme, false), `${schluessel}/${key} ${stimme} = ${n}/${k2}`).not.toBe(linie(fremd, stimme, false));
              expect(linie(mein, stimme, true), `${schluessel}/${key} ${stimme} ~ ${n}/${k2} (verschoben)`).not.toBe(linie(fremd, stimme, true));
            }
          }
        }
      }
      // Ein Vergleich mit fremden Werken oder eine Hörprüfung ist dies nicht.
    });
  }
});

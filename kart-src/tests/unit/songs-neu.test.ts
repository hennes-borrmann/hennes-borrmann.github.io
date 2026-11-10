import { describe, expect, it } from 'vitest';
import { SONGS, compileSong, type Song } from '../../src/audio/songs';
import { NEUE_STUECKE } from '../../src/audio/songs-neu';

const rennstuecke = Object.entries(SONGS)
  .filter(([, stueck]) => stueck.race)
  .map(([name, stueck]) => compileSong(stueck, name));
const kuerzestes = Math.min(...rennstuecke.map((stueck) => stueck.steps));
const pegel = rennstuecke.map((stueck) => stueck.def.level);
type Stimme = 'lead' | 'bass' | 'comp';

function toene(stueck: Song, stimme: Stimme): number[] {
  return stimme === 'comp'
    ? stueck.comp.flatMap((ton) => ton?.midis ?? [])
    : stueck[stimme].flatMap((ton) => (ton ? [ton.midi] : []));
}

describe('Neue Rennmusik', () => {
  it('stellt genau die vier beauftragten Welten bereit', () => {
    expect(Object.keys(NEUE_STUECKE).sort()).toEqual(['eis', 'mond', 'riff', 'wolken']);
    expect(rennstuecke.length).toBeGreaterThan(0);
  });

  for (const [name, definition] of Object.entries(NEUE_STUECKE)) {
    it(`${name}: übersetzt alle Abschnitte in vollständige, spielbare Stimmen`, () => {
      // compileSong wirft bei ungültigen Noten, Akkorden oder Taktlängen.
      const stueck = compileSong(definition, name);
      expect(definition.race).toBe(true);
      expect(stueck.steps).toBeGreaterThanOrEqual(kuerzestes);
      expect(stueck.steps % 16).toBe(0);
      expect(new Set(definition.order).size).toBeGreaterThanOrEqual(2);
      expect(Object.keys(definition.sections).sort()).toEqual([...new Set(definition.order)].sort());
      expect(definition.bpm).toBeGreaterThanOrEqual(Math.min(...rennstuecke.map((s) => s.def.bpm)));
      expect(definition.bpm).toBeLessThanOrEqual(Math.max(...rennstuecke.map((s) => s.def.bpm)));
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
      for (const abschnitt of Object.values(definition.sections)) {
        expect(abschnitt.comp.replace(/\s|\|/g, '')).toMatch(/^[.\-xXo0-9]+$/);
        for (const schlagzeug of [abschnitt.kick, abschnitt.snare, abschnitt.hat, abschnitt.perc ?? '']) {
          expect(schlagzeug.replace(/\s|\|/g, '')).toMatch(/^[.\-xXgo]*$/);
        }
      }
    });

    it(`${name}: hält Tonumfang und Gesamtpegel im Bereich der vorhandenen Rennstücke`, () => {
      const stueck = compileSong(definition, name);
      for (const stimme of ['lead', 'bass', 'comp'] as const) {
        const bestand = rennstuecke.flatMap((s) => toene(s, stimme));
        const neu = toene(stueck, stimme);
        expect(neu.length).toBeGreaterThan(0);
        expect(neu.every(Number.isFinite)).toBe(true);
        expect(Math.min(...neu)).toBeGreaterThanOrEqual(Math.min(...bestand));
        expect(Math.max(...neu)).toBeLessThanOrEqual(Math.max(...bestand));
      }
      expect(Number.isFinite(definition.level)).toBe(true);
      expect(definition.level).toBeGreaterThanOrEqual(Math.min(...pegel));
      expect(definition.level).toBeLessThanOrEqual(Math.max(...pegel));
    });
  }

  it('verwendet eigenständige Melodie- und Basslinien statt transponierter Bestandslinien', () => {
    const neue = Object.values(NEUE_STUECKE).map((s) => compileSong(s));
    const kontur = (stueck: Song, stimme: 'lead' | 'bass'): unknown[] => {
      const grundton = toene(stueck, stimme)[0];
      return stueck[stimme].map((ton) => (ton ? [ton.midi - grundton, ton.steps] : null));
    };
    for (let i = 0; i < neue.length; i++) {
      for (const anderes of [...rennstuecke, ...neue.slice(0, i)]) {
        for (const stimme of ['lead', 'bass'] as const) expect(kontur(neue[i], stimme)).not.toEqual(kontur(anderes, stimme));
      }
    }
    // Ein Vergleich mit fremden Werken oder eine Hörprüfung ist dies nicht.
  });
});

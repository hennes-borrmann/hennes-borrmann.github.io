// Rennstück für das Spiegelkabinett. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'spiegel' ein.
import type { SongDef } from '../songs';

/**
 * Spiegelkabinett: E-Dur, lydisch gefärbt (Ais statt A), 136 BPM, leichter Shuffle. Hell und
 * verspielt: eine glockige Leitstimme (Dreieck, zwei leicht verstimmte Stimmen, kurz
 * angeschlagen, viel Echo) über perlenden Sechzehntel-Arpeggien, die in jedem Takt hinauf- und
 * spiegelbildlich wieder hinablaufen („0123432112343210"). Der Bass federt in einer Figur, die
 * selbst ein Spiegelbild ist – Rhythmus 2-1-2-3 | 3-2-1-2, Grundton, Oktave, Quinte, Terz und
 * dasselbe rückwärts. Die Bassdrum schlägt im Abstand punktierter Viertel (0, 6, 12): ein
 * tänzerischer Dreier gegen den geraden Takt, der Shaker ebenso.
 * A: Jedes Motiv wird im nächsten Takt von seiner Umkehrung beantwortet (gleicher Rhythmus,
 * die Tonschritte in der Leiter gespiegelt), über E – Fis – Gism7 – Fis: das Fis-Dur der
 * lydischen Stufe hält es in der Schwebe.
 * B: der ganze A-Teil als Krebs – Melodie und Akkorde Takt für Takt rückwärts, jeder Ton
 * bleibt über seinem Akkord; der Bass ist in sich gespiegelt und darum unverändert. Das
 * Schlagzeug treibt hier etwas mehr.
 * C: es kippt ins Geheimnisvolle – cis-Moll, ausgedünnt (lange Bässe, einzelne Arpeggiotöne,
 * nur noch die Eins in der Bassdrum), die Rufe der Leitstimme werden von ihrem Krebs
 * beantwortet; im letzten Takt läuft die lydische Leiter hinauf, ein Wirbel, und es funkelt
 * wieder von vorn.
 */
export const SPIEGEL_STUECK: SongDef = {
  bpm: 136,
  swing: 0.16,
  race: true,
  level: 1,
  lead: { wave: 'triangle', cutoff: 4800, gain: 0.25, detune: 5, vibrato: 0, send: 0.42, gate: 0.45 },
  bass: { wave: 'pulse25', cutoff: 420, pluck: 1500, q: 6, gain: 0.3, gate: 0.5 },
  comp: { wave: 'triangle', cutoff: 3200, gain: 0.13, gate: 0.45, send: 0.4, low: 58, pan: -0.22 },
  drums: { kick: 0.62, snare: 0.22, hat: 0.06, perc: 'shaker', percGain: 0.06 },
  order: 'ABC',
  sections: {
    A: {
      bars: 8,
      melody: `e5 g#5 a#5 b5:4 d#6 b5:4 | c#6 a#5 g#5 f#5:4 d#5 f#5:4
             | d#5:3 f#5:1 g#5 b5:4 a#5 g#5:4 | g#5:4 a#5 b5:4 g#5 f#5:1 d#5:3
             | g#5 b5 c#6 d#6:4 e6 d#6:4 | c#6 a#5 g#5 f#5:4 e5 f#5:4
             | e5:3 g#5:1 c#6 b5 a#5:3 c#6:1 d#6:4 | e6:4 d#6 b5 f#5 a#5 b5:4`,
      bass: `e2 e3:1 b2 g#2:3 g#2:3 b2 e3:1 e2 | f#2 f#3:1 c#3 a#2:3 a#2:3 c#3 f#3:1 f#2
           | g#2 g#3:1 d#3 b2:3 b2:3 d#3 g#3:1 g#2 | f#2 f#3:1 c#3 a#2:3 a#2:3 c#3 f#3:1 f#2
           | e2 e3:1 b2 g#2:3 g#2:3 b2 e3:1 e2 | f#2 f#3:1 c#3 a#2:3 a#2:3 c#3 f#3:1 f#2
           | c#2 c#3:1 g#2 e2:3 f#2:3 a#2 d#3:1 d#2 | b1 b2:1 f#2 e2:3 d#2:3 f#2 b2:1 b1`,
      chords: 'Emaj7 | F# | G#m7 | F# | Emaj7 | F# | C#m7 D#m7 | Bsus4 B',
      comp: '0123432112343210',
      kick: 'x.....x.....x...|x.....x.....x.x.',
      snare: '....x.......x...|....x.....g.x...',
      hat: 'x.x.x.g.x.x.x.g.|x.x.x.g.x.x.o...',
      perc: '..g..g..g..g..g.',
    },
    B: {
      bars: 8,
      melody: `b5:4 a#5 f#5 b5 d#6 e6:4 | d#6:4 c#6:1 a#5:3 b5 c#6 g#5:1 e5:3
             | f#5:4 e5 f#5:4 g#5 a#5 c#6 | d#6:4 e6 d#6:4 c#6 b5 g#5
             | d#5:3 f#5:1 g#5 b5:4 a#5 g#5:4 | g#5:4 a#5 b5:4 g#5 f#5:1 d#5:3
             | f#5:4 d#5 f#5:4 g#5 a#5 c#6 | b5:4 d#6 b5:4 a#5 g#5 e5`,
      bass: `b1 b2:1 f#2 d#2:3 e2:3 f#2 b2:1 b1 | d#2 d#3:1 a#2 f#2:3 e2:3 g#2 c#3:1 c#2
           | f#2 f#3:1 c#3 a#2:3 a#2:3 c#3 f#3:1 f#2 | e2 e3:1 b2 g#2:3 g#2:3 b2 e3:1 e2
           | f#2 f#3:1 c#3 a#2:3 a#2:3 c#3 f#3:1 f#2 | g#2 g#3:1 d#3 b2:3 b2:3 d#3 g#3:1 g#2
           | f#2 f#3:1 c#3 a#2:3 a#2:3 c#3 f#3:1 f#2 | e2 e3:1 b2 g#2:3 g#2:3 b2 e3:1 e2`,
      chords: 'B Bsus4 | D#m7 C#m7 | F# | Emaj7 | F# | G#m7 | F# | Emaj7',
      comp: '0.2.4.2.x..x.3.4',
      kick: 'x.....x...x.x...|x.....x.....x.x.',
      snare: '....x.......x...|....x.......x.g.',
      hat: 'x.o.x.g.x.o.x.g.',
      perc: '..g..g..g..g..g.|..g..g..g..gg.g.',
    },
    C: {
      bars: 8,
      melody: `-:4 c#5 e5 g#5:6 -:2 | -:4 c#6 a5 e5:6 -:2
             | -:4 f#5 a5 c#6:4 b5 g#5 | c#6:8 c6:8
             | -:4 g#5 e5 c#5:6 -:2 | -:4 e5 a5 c#6:6 -:2
             | a5:4 g#5:4 f#5:4 e5:4 | d#5 f#5 g#5 a#5 b5 c#6 d#6 e6`,
      bass: `c#2:6 g#2:2 c#3:4 g#2:4 | a1:6 e2:2 a2:4 e2:4
           | f#2:6 c#3:2 f#3:4 c#3:4 | g#2:6 d#3:2 g#2:4 c3:4
           | c#2:6 g#2:2 c#3:4 g#2:4 | a1:6 e2:2 a2:4 e2:4
           | f#2:6 c#3:2 f#2:4 a2:4 | b1 b2:1 f#2 e2:3 d#2:3 f#2 b2:1 b1`,
      chords: 'C#m9 | Amaj7 | F#m9 | G#sus4 G# | C#m9 | Amaj7 | F#m9 | Bsus4 B',
      comp: 'o.....2...4...2.|o.....4...2...0.',
      kick: `x...............|x...............|x...............|x.......x.......
           | x...............|x...............|x.......x.......|x.....x.....x.x.`,
      snare: `................|................|................|............g...
            | ................|................|................|....g.g.x.x.xxXX`,
      hat: `g...x...g...x...|g...x...g...x...|g...x...g...x...|g...x...g...x...
          | g...x...g...x...|g...x...g...x...|g...x...g...x...|x.x.x.x.x.x.x.o.`,
      perc: `................|................|................|................
           | ................|................|................|..g..g..g..g..g.`,
    },
  },
};

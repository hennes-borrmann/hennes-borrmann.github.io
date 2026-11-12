// Rennstück für das Riesenkinderzimmer. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'zimmer' ein.
import type { SongDef } from '../songs';

/**
 * Riesenkinderzimmer: B-Dur, 144 BPM, gerade. Das Spielzeug wird lebendig – verspielt,
 * frech, ein bisschen tollpatschig. Klangbild aus der Spielzeugkiste: Die Leitstimme ist ein
 * Spielzeugklavier (schmaler Puls, kurz angeschlagen, zwei um 17 Cent verstimmte Stimmen,
 * kein Vibrato), die Begleitung eine Spieluhr (Sinus, hoch, kurz, perlende Arpeggien), der
 * Bass eine tapsige Tuba (dumpf gefilterter Sägezahn, weich angeblasen, kurz). Dazu
 * Blechtrommel (Snare) und Rassel (Shaker, in Gruppen 3-3-2).
 * Die Tuba stapft in der Figur 2-(2)-2-(2)-3-1-2-2 (Grundton, Pause, Quinte, Pause,
 * Grundton lang, Quinte kurz, dann zwei Achtel, deren letzte chromatisch in den nächsten
 * Grundton stolpert).
 * Das Motiv „klein und groß“: f-b-d-b-c-a-b (Dreiklang hinauf, zurück, Nachbarton-Stolperer,
 * Landung) – im A-Teil hoch und flink in Sechzehnteln (winzig), im B-Teil von der Tuba drei
 * Oktaven tiefer in doppelten Notenwerten (riesig; ein ganzer Takt).
 * A: Toben – das Motiv und seine Antworten über B – Cm7 F – B – Es F – B – D7 – Gm C7 – F7
 * (D7 als freche Zwischendominante). B: Riese und Zwerg – in den ungeraden Takten singt die
 * Tuba das Motiv breit (über B, Es, B, C7), die Leitstimme piepst nur am Taktende; in den
 * geraden antwortet sie mit dem Motiv in Sechzehnteln, während die Tuba stapft; Schlagzeug im
 * halben Tempo. A noch einmal, dann C: auf Zehenspitzen unter dem Bett – einzelne, gezupfte
 * Töne mit Pausen, Tuba und Spieluhr nur gezupft, Bassdrum und Hi-Hat ganz leise, keine
 * Snare, nach g-Moll gefärbt (Gm – Es – Gm – D7 …); im letzten Takt rennt die Leitstimme die
 * Leiter hinauf, die Blechtrommel wirbelt, und es tobt wieder von vorn los. Abfolge A B A C.
 */
export const ZIMMER_STUECK: SongDef = {
  bpm: 144,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'pulse12', cutoff: 3200, gain: 0.23, detune: 17, vibrato: 0, send: 0.2, gate: 0.42 },
  bass: { wave: 'sawtooth', cutoff: 260, pluck: 380, q: 1.1, gain: 0.42, gate: 0.55 },
  comp: { wave: 'sine', cutoff: 5000, gain: 0.15, gate: 0.35, send: 0.32, low: 62, pan: 0.25 },
  drums: { kick: 0.68, snare: 0.28, hat: 0.06, perc: 'shaker', percGain: 0.07 },
  order: 'ABAC',
  sections: {
    A: {
      bars: 8,
      melody: `f5:1 bb5:1 d6:1 bb5:1 c6:1 a5:1 bb5:2 -:2 d5 f5:4
             | g5:1 c6:1 eb6:1 c6:1 d6:1 b5:1 c6:2 -:2 bb5 a5:1 g5:1 f5:2
             | d6:3 bb5:1 f5:2 d5:2 eb5:1 e5:1 f5:2 -:2 f5:1 g5:1
             | g5:3 eb5:1 bb4:2 g5:2 a5:3 f5:1 c5:2 a5:2
             | f5:1 bb5:1 d6:1 bb5:1 c6:1 a5:1 bb5:2 -:2 f6:1 d6:1 bb5:2 f5:2
             | f#5:1 a5:1 c6:1 a5:1 d6:2 c6:1 a5:1 f#5:2 d5:2 -:2 d5:1 e5:1
             | g5:2 bb5:1 d6:1 g5:2 -:2 e5:2 g5:1 bb5:1 c6:2 bb5:2
             | a5:3 g5:1 f5:2 eb5:2 c5:2 a4:2 c5 eb5`,
      bass: `bb1:2 -:2 f2:2 -:2 bb1:3 f2:1 d2 b1
           | c2:2 -:2 g2:2 -:2 f2:3 c3:1 a2 a1
           | bb1:2 -:2 f2:2 -:2 bb1:3 f2:1 d2 d2
           | eb2:2 -:2 bb2:2 -:2 f2:3 c3:1 a2 a1
           | bb1:2 -:2 f2:2 -:2 bb1:3 f2:1 d2 c#2
           | d2:2 -:2 a2:2 -:2 d2:3 a2:1 c3 f#2
           | g2:2 -:2 d3:2 -:2 c2:3 g2:1 bb2 e2
           | f2:2 -:2 c3:2 -:2 f2:1 f2:1 eb2:1 -:1 c2 a1`,
      chords: 'Bb | Cm7 F | Bb | Eb F | Bb | D7 | Gm C7 | F7',
      comp: '0.2.4.2.1.3.4.3.|0.2.4.2.3.1.2.4.',
      kick: 'x.x...x...x.....|x.x...x...x...x.',
      snare: '....x.......x...|....x.....g.x.gg',
      hat: '..x...x...x...x.|..x...x...x.x.o.',
      perc: 'x..g..x.x..g..x.',
    },
    B: {
      bars: 8,
      melody: `-:12 f6:1 d6:1 bb5:2
             | d5:1 g5:1 bb5:1 g5:1 a5:1 f#5:1 g5:2 -:2 d6:1 c6:1 bb5:1 a5:1 g5:2
             | -:12 bb5:1 g5:1 eb5:2
             | bb4:1 eb5:1 g5:1 eb5:1 f5:1 d5:1 eb5:2 -:2 g5:1 bb5:1 eb6:2 -:2
             | -:10 f5:1 bb5:1 d6:1 f6:1 d6:2
             | g5:1 bb5:1 d6:1 bb5:1 c6:1 a5:1 bb5:2 g5:4 -:4
             | -:12 e6:1 c6:1 g5:2
             | f5:1 a5:1 c6:1 a5:1 bb5:1 g5:1 a5:2 c6:2 eb6:2 c6 a5`,
      bass: `f2:2 bb2:2 d3:2 bb2:2 c3:2 a2:2 bb2:4
           | g2:3 -:1 d2:3 -:1 g2:3 -:1 bb2:2 a2:2
           | bb2:2 eb3:2 g3:2 eb3:2 f3:2 d3:2 eb3:4
           | eb2:3 -:1 bb1:3 -:1 eb2:3 -:1 g2:2 e2:2
           | f2:2 bb2:2 d3:2 bb2:2 c3:2 a2:2 bb2:4
           | g2:3 -:1 d2:3 -:1 g2:3 -:1 d2:2 f#2:2
           | g2:2 c3:2 e3:2 c3:2 d3:2 b2:2 c3:4
           | f2:3 -:1 c2:3 -:1 f2:1 -:1 a2:1 -:1 c3 a1`,
      chords: 'Bb | Gm | Eb | Eb | Bb | Gm | C7 | F7',
      comp: 'o.......0.2.4...|o.......4.2.0...',
      kick: 'x.......x.......|x.......x.....x.',
      snare: '........X.......|........X.....gg',
      hat: 'x...x...x...x...|x...x...x...x.o.',
      perc: '....x.......x...|....x.......x.gx',
    },
    C: {
      bars: 8,
      melody: `g5:1 -:2 a5:1 -:2 bb5:1 -:3 d6:1 -:5
             | g5:1 -:2 f5:1 -:2 eb5:1 -:3 bb4:1 -:5
             | d5:1 -:2 eb5:1 -:2 d5:1 -:3 g5:1 -:3 a5:1 bb5:1
             | a5:1 -:2 f#5:1 -:2 d5:1 -:3 c6:1 -:2 a5:1 -:2
             | bb5:1 -:2 c6:1 -:2 d6:1 -:3 f6:1 -:5
             | eb6:1 -:2 d6:1 -:2 bb5:1 -:3 g5:1 -:5
             | c6:1 -:2 bb5:1 -:2 g5:1 -:3 eb5:1 -:3 d5:1 c5:1
             | c5:1 d5:1 eb5:1 f5:1 g5:1 a5:1 bb5:1 c6:1 d6:2 eb6:2 f6:4`,
      bass: `g2:1 -:3 d2:1 -:3 g2:1 -:3 d2:1 -:3
           | eb2:1 -:3 bb1:1 -:3 eb2:1 -:3 bb1:1 -:3
           | g2:1 -:3 d2:1 -:3 g2:1 -:3 d2:1 -:3
           | d2:1 -:3 a1:1 -:3 d2:1 -:3 f#2:1 -:3
           | g2:1 -:3 d2:1 -:3 g2:1 -:3 bb2:1 -:3
           | eb2:1 -:3 bb1:1 -:3 eb2:1 -:3 g2:1 -:3
           | c2:1 -:3 g2:1 -:3 c2:1 -:3 g2:1 -:3
           | f2:1 -:1 f2:1 -:1 a2:1 -:1 c3:1 -:1 eb3:1 -:1 c3:1 -:1 a2:1 f2:1 c2`,
      chords: 'Gm | Eb | Gm | D7 | Gm | Eb | Cm7 | F7',
      comp: '0...2..1....3...',
      kick: 'g.......g.......|g.......g.......|g.......g.......|g.......g.......|g.......g.......|g.......g.......|g.......g.......|x...x...x...x...',
      snare: '................|................|................|................|................|................|................|....x...x.x.xxXX',
      hat: '..g...g...g...g.',
      perc: '..........g.....|..g.......g.....',
    },
  },
};

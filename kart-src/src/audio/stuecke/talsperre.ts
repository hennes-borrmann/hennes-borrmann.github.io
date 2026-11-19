// Rennstück für die Talsperre. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'talsperre' ein.
import type { SongDef } from '../songs';

/**
 * Talsperre: d-Moll, 138 BPM, gerade. Abend in der Schlucht, die große Mauer, das Wasser – weit, ein wenig
 * feierlich, aber mit Rennmotor darunter. Die Leitstimme ist ein Horn (Sägezahn hinter einem weichen Filter, zwei
 * leicht verstimmte Stimmen, Vibrato und Echo von den Felswänden), die Begleitung rieselt als Arpeggio in
 * Sechzehnteln wie Wasser über die Wehrkrone, der Bass läuft in Oktaven, die Toms sind die Turbinen.
 * A: Mauerkrone – das Hornthema in breiten Bögen über Dm – B – F – C – Dm – B – Gm – A7, der Bass treibt in
 * Achteln zwischen Grundton und Oktave, das Arpeggio rieselt. B: Ufer und Tauchgang – alles wird weich und hoch:
 * lange Basstöne, gehaltene Akkorde mit einzelnen glitzernden Tönen, Schlagzeug im halben Tempo, die Melodie
 * schwebt über F – C – Dm – B – F – C – Gm – A. A noch einmal (an der Mauer entlang), dann C: das Krafthaus und
 * die Kehren hinauf – das Horn stößt kurze Rufe in Sechzehnteln, der Bass hämmert wie die Maschinensätze
 * (zwei kurze Schläge, ein langer), die Toms laufen synkopisch dazwischen, ein Wirbel auf A7 führt zurück auf
 * die Krone. Abfolge A B A C.
 */
export const TALSPERRE_STUECK: SongDef = {
  bpm: 138,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'sawtooth', cutoff: 2300, gain: 0.2, detune: 8, vibrato: 12, send: 0.32, gate: 0.9 },
  bass: { wave: 'square', cutoff: 420, pluck: 620, q: 2, gain: 0.33, gate: 0.55 },
  comp: { wave: 'triangle', cutoff: 2600, gain: 0.09, gate: 0.45, send: 0.24, low: 57, pan: 0.2 },
  drums: { kick: 0.7, snare: 0.27, hat: 0.06, perc: 'tom', percGain: 0.12 },
  order: 'ABAC',
  sections: {
    A: {
      bars: 8,
      melody: `a4:4 d5:4 e5:2 f5:6
             | g5:6 f5:2 d5:8
             | c5:4 f5:4 a5:4 c6:4
             | bb5:6 a5:2 g5:4 e5:4
             | a5:4 d6:6 c6:2 a5:4
             | bb5:4 a5:2 g5:2 f5:4 d5:4
             | g5:2 a5:2 bb5:4 d6:4 c6:2 bb5:2
             | a5:8 c#6:4 e6:4`,
      bass: `d2 d3 d2 d3 d2 d3 a2 d3
           | bb1 bb2 bb1 bb2 bb1 bb2 f2 bb2
           | f2 f3 f2 f3 f2 f3 c3 f3
           | c2 c3 c2 c3 c2 c3 g2 e2
           | d2 d3 d2 d3 a2 d3 a2 d3
           | bb1 bb2 bb1 bb2 f2 bb2 d2 f2
           | g2 g3 g2 g3 g2 g3 d3 bb2
           | a1 a2 a1 a2 c#2 e2 g2 a2`,
      chords: 'Dm | Bb | F | C | Dm | Bb | Gm | A7',
      comp: '0123212301232123',
      kick: 'x...x...x...x...|x...x...x..xx...',
      snare: '....x.......x...|....x.......x.gg',
      hat: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.o.',
      perc: '...............x|.......x.....x.x',
    },
    B: {
      bars: 8,
      melody: `f5:2 a5:2 c6:4 a5:2 c6:2 f6:4
             | e6:6 d6:2 c6:4 g5:4
             | a5:2 d6:2 f6:4 e6:2 d6:2 a5:4
             | bb5:8 d6:4 f5:4
             | c6:2 a5:2 f5:4 a5:2 c6:2 e6:4
             | d6:2 e6:2 c6:4 g5:8
             | bb5:4 a5:2 g5:2 d6:4 bb5:4
             | c#6:4 e6:4 a5:8`,
      bass: `f2:8 c3:8
           | c2:8 g2:8
           | d2:8 a2:8
           | bb1:8 f2:8
           | f2:8 a2:8
           | c2:8 e2:8
           | g2:8 d2:8
           | a1:8 e2:8`,
      chords: 'F | C | Dm | Bb | F | C | Gm | A',
      comp: 'o.2.4.2.0.2.4.2.',
      kick: 'x.......x.......|x.......x.....x.',
      snare: '........x.......|........x.......',
      hat: '..o...o...o...o.|..o...o...o.o.o.',
      perc: 'x...............|........x.......',
    },
    C: {
      bars: 8,
      melody: `g5:1 g5:1 bb5:2 d6:2 g5:1 g5:1 bb5:2 d6:2 c6:2 bb5:2
             | a5:1 a5:1 d6:2 f6:2 a5:1 a5:1 d6:2 e6:2 d6:2 a5:2
             | bb5:1 bb5:1 d6:2 f6:2 d6:2 bb5:2 f5:2 d5:4
             | c#6:4 e6:4 a5:4 e5:4
             | d6:6 c6:2 bb5:4 g5:4
             | f5:4 a5:4 d6:4 f6:4
             | eb6:6 d6:2 c6:4 bb5:4
             | a5:2 c#6:2 e6:4 c#6:2 a5:2 e5:4`,
      bass: `g2:1 g2:1 g3:2 g2:1 g2:1 g3:2 g2:1 g2:1 g3:2 d3:2 bb2:2
           | d2:1 d2:1 d3:2 d2:1 d2:1 d3:2 d2:1 d2:1 d3:2 a2:2 f2:2
           | bb1:1 bb1:1 bb2:2 bb1:1 bb1:1 bb2:2 bb1:1 bb1:1 bb2:2 f2:2 d2:2
           | a1:1 a1:1 a2:2 a1:1 a1:1 a2:2 c#2:2 e2:2 g2:2 a2:2
           | g2:1 g2:1 g3:2 g2:1 g2:1 g3:2 d3:2 bb2:2 g2:2 d2:2
           | d2:1 d2:1 d3:2 d2:1 d2:1 d3:2 a2:2 f2:2 d2:2 a1:2
           | eb2:1 eb2:1 eb3:2 eb2:1 eb2:1 eb3:2 bb2:2 g2:2 eb2:2 bb1:2
           | a1:1 a1:1 a2:2 c#3:2 e3:2 g3:2 e3:2 c#3:2 a2:2`,
      chords: 'Gm | Dm | Bb | A | Gm | Dm | Eb | A7',
      comp: '..x...x...x...x.|..x...x...x.x.x.',
      kick: 'x..x..x.x..x..x.|x..x..x.x..x..x.',
      snare: '....x.......x...|....x.......x...',
      hat: `xgxgxgxgxgxgxgxg|xgxgxgxgxgxgxgxg|xgxgxgxgxgxgxgxg|xgxgxgxgxgxgxgxo
          | xgxgxgxgxgxgxgxg|xgxgxgxgxgxgxgxg|xgxgxgxgxgxgxgxg|xxxxxxxxxxxxxxxx`,
      perc: `x..x..x...x..x..|x..x..x...x..x..|x..x..x...x..x..|x...x...x.x.x.x.
           | x..x..x...x..x..|x..x..x...x..x..|x..x..x...x..x..|x.x.x.x.xxxxxxxx`,
    },
  },
};

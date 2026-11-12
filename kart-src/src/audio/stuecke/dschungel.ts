// Rennstück für den Dschungel-Fluss. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'dschungel' ein.
import type { SongDef } from '../songs';

/**
 * Dschungel-Fluss: A-Dur, 130 BPM, deutlich geswingt (0,16 – das federndste Rennstück).
 * Warm und verspielt, viel Holz: Die Begleitung ist ein Marimba-artiges Gerüst aus kurzen
 * Dreieckstönen, die ineinandergreifend um den Akkord springen; Handtrommeln (deren Ton im
 * Takt fällt) und ein Shaker aus leisen Hi-Hat-Sechzehnteln laufen darüber. Die Bassdrum
 * hüpft im 3-3-4-Raster („x..x..x...x"), der Bass federt mit Pausen und Sechzehntel-Sprüngen
 * (Grundton, Quinte, Oktave). Die Leitstimme ist eine Pfeife: ein heller Dreieckston mit
 * lebhaftem Vibrato, pentatonisch, mit kurzen frechen Tonwiederholungen.
 * A: der Pfad – Pfeifenrufe über A – G D – A – E7 (mit der kleinen Septime G als Farbe).
 * B: Ruf und Antwort – zwei kurze, gleiche Töne oben, dann ein Sprung; die Stimme antwortet
 * eine Lage tiefer, das Schlagwerk wird dichter. C: aufs Wasser – die Akkorde wechseln nur
 * alle zwei Takte (Dmaj7, C#m7, F#m, Bm7, Esus4), lange, gleitende Töne, der Bass hält,
 * Bassdrum nur auf der Eins, keine Snare; im letzten Takt rollen die Handtrommeln an,
 * und es springt wieder los. Abfolge A B A C.
 */
export const DSCHUNGEL_STUECK: SongDef = {
  bpm: 130,
  swing: 0.16,
  race: true,
  level: 1,
  lead: { wave: 'triangle', cutoff: 4200, gain: 0.21, detune: 3, vibrato: 12, send: 0.3, gate: 0.72 },
  bass: { wave: 'triangle', cutoff: 620, pluck: 900, q: 2, gain: 0.42, gate: 0.5 },
  comp: { wave: 'triangle', cutoff: 2600, gain: 0.15, gate: 0.32, send: 0.22, low: 57, pan: 0.3 },
  drums: { kick: 0.64, snare: 0.24, hat: 0.07, perc: 'tom', percGain: 0.2 },
  order: 'ABAC',
  sections: {
    A: {
      bars: 8,
      melody: `e5:1 f#5:1 a5 - c#6:3 a5:1 b5 a5 e5 | d5 g5:3 b5:1 a5 - f#5 d5 e5
             | e5:1 f#5:1 a5 - c#6:3 e6:1 c#6 a5 b5 | b5:6 g#5 e5 d5 e5:4
             | c#6:1 c#6:1 a5 f#5 - e5 f#5 a5:4 | d6:3 c#6:1 a5 f#5 d5:4 e5 f#5
             | b5:3 a5:1 f#5 d5 g#5:3 b5:1 e6:4 | c#6 a5 e5 c#5 a4:6 -:2`,
      bass: `a2 - a2:1 e3:1 - a3 e3:1 -:1 c#3 e3 | g2 - g2:1 d3:1 - d2 a2:1 -:1 f#2 a2
           | a2 - a2:1 e3:1 - a3 e3:1 -:1 c#3 e3 | e2 - e2:1 b2:1 - e3 d3:1 -:1 b2 g#2
           | f#2 - f#2:1 c#3:1 - f#3 c#3:1 -:1 a2 c#3 | d2 - d2:1 a2:1 - d3 a2:1 -:1 f#2 a2
           | b1 - b1:1 f#2:1 - e2 b2:1 -:1 g#2 e2 | a2 - a2:1 e3:1 - e2 g#2 b2 c#3`,
      chords: 'A | G D | A | E7 | F#m | D | Bm7 E7 | A',
      comp: '0.2.13.2.0.21.3.|0.2.13.2.4.3.2.1',
      kick: 'x..x..x...x.....|x..x..x...x..x..',
      snare: '....x.......x...|....x..g....x.gg',
      hat: 'g.x.gxx.g.x.gxx.',
      perc: '..gx..x...gx.x..|..gx..x...gx.xgx',
    },
    B: {
      bars: 8,
      melody: `a5:1 a5:1 f#5 a5:1 a5:1 d6 -:4 f#5:1 e5:1 d5 | e5 g#5 b5:4 c#6:1 b5:1 g#5 e5:4
             | f#5:1 f#5:1 d5 f#5:1 f#5:1 b5 -:4 a5:1 f#5:1 d5 | e5:3 g#5:1 b5:4 g#5 b5 e6 -
             | c#6:1 c#6:1 a5 c#6:1 c#6:1 e6 -:4 d6:1 c#6:1 a5 | b5 g#5 e5:4 g#5:1 b5:1 c#6 e6:4
             | c#6:3 a5:1 f#5 c#5 d5:3 f#5:1 a5 d6 | b5:4 g#5 e5 d5 b4 g#4 b4`,
      bass: `d2:3 a2:3 d3 - d2 c#3 a2 | c#2:3 g#2:3 c#3 - c#2 b2 g#2
           | b1:3 f#2:3 b2 - b1 a2 f#2 | e2:3 b2:3 e3 - e2 g#2 b2
           | d2:3 a2:3 d3 - d2 c#3 a2 | c#2:3 g#2:3 c#3 - c#2 b2 g#2
           | f#2:3 c#3:3 f#2 d2:3 a2:3 d3 | e2:3 b2:3 e3 d3 b2 g#2 e2`,
      chords: 'Dmaj7 | C#m7 | Bm7 | E | Dmaj7 | C#m7 | F#m D | E7',
      comp: 'x.21.x.2.13.x.4.',
      kick: 'x.....x.x..x....|x.....x.x..x..x.',
      snare: '....x..g.g..x...|....x..g.g..x.gx',
      hat: 'gxgxgxgxgxgxgxgx|gxgxgxgxgxgxgxo.',
      perc: '..gx.gx...gx.gx.|..gx.gx...gxxgxx',
    },
    C: {
      bars: 8,
      melody: `f#5:8 a5:4 c#6:4 | e6:12 d6:2 c#6:2
             | b5:8 g#5:4 e5:4 | c#6:6 a5:2 f#5:8
             | d6:8 c#6:4 b5:4 | a5:6 f#5:2 d5:8
             | e5:4 a5:4 b5:8 | b5:6 d6:2 e6:4 g#5:2 b5:2`,
      bass: `d2:6 a2:2 d3:8 | d2:6 a2:2 c#3:8
           | c#2:6 g#2:2 e2:8 | f#2:6 c#3:2 a2:8
           | b1:6 f#2:2 b2:8 | b1:6 f#2:2 a2:8
           | e2:6 b2:2 a2:8 | e2:4 e2:2 e2:2 g#2 b2 d3 e3`,
      chords: 'Dmaj7 | Dmaj7 | C#m7 | F#m | Bm7 | Bm7 | Esus4 | E7',
      comp: 'o.......1.2.3.2.|o.......3.2.1.0.',
      kick: 'x...............|x.......x.......',
      snare: `................|................|................|................
            | ................|................|................|........g.g.x.XX`,
      hat: '....g.......g...|....g.......g.o.',
      perc: `........g.......|................|........g.......|................
           | ........g.......|................|........g.......|x.x.x.x.xxxxxxxx`,
    },
  },
};

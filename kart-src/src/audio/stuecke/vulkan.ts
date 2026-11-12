// Rennstück für die Vulkaninsel. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'vulkan' ein.
import type { SongDef } from '../songs';

/**
 * Vulkaninsel: g-Moll mit phrygischer Färbung (As statt A über g, die kleine Sekunde
 * Gm – Ab als Schaukel) und D7 als Dominante, deren Leiter (D Es Fis G A B C) mit der
 * übermäßigen Sekunde Es–Fis den südlichen Einschlag gibt. 142 BPM, kaum Swing.
 * Die Bassdrum schlägt wie ein Herz – „lub-dub“ (zwei Schläge im Abstand einer
 * punktierten Achtel) –, erst zweimal je Takt (A), dann dreimal und dichter (B), im
 * hellen Teil nur einmal (C), und im letzten Abschnitt jagt es von Takt zu Takt
 * schneller bis zum Wirbel (D). Handtrommeln (Tom) spielen versetzt dazwischen.
 * Der Bass rollt in einer Wellenfigur (3-1-1-1-2-2-1-1-2-2: Grundton, Quinte, hinauf
 * zur Septime und zurück), in B als „ta-ta-TAM“ (zwei Sechzehntel, Achtel mit Oktave).
 * A: die Leitstimme, ein näselndes Rohrblatt (schmaler Puls, weites Vibrato), singt
 * kurze Bögen mit Doppelschlag-Verzierungen über Gm – Ab. B: der Druck wächst –
 * Tonwiederholungen als Rufe, eine Oktave höher, über Eb – D7 – Cm – Gm. C: es wird
 * hell – das Dorf und das Meer: B-Dur, lange Töne, perlendes Arpeggio, halbes Tempo im
 * Schlagzeug. D: der Berg grollt wieder – tiefe Stimme, Bass zittert in Sechzehnteln
 * auf dem Grundton, Herzschlag und Trommeln verdichten sich bis zum Wirbel, und es
 * geht von vorn los.
 */
export const VULKAN_STUECK: SongDef = {
  bpm: 142,
  swing: 0.04,
  race: true,
  level: 1,
  lead: { wave: 'pulse12', cutoff: 2300, gain: 0.19, detune: 6, vibrato: 12, send: 0.28, gate: 0.88 },
  bass: { wave: 'sawtooth', cutoff: 380, pluck: 1100, q: 2.6, gain: 0.34, gate: 0.66 },
  comp: { wave: 'triangle', cutoff: 2200, gain: 0.12, gate: 0.5, send: 0.3, low: 55, pan: 0.22 },
  drums: { kick: 0.7, snare: 0.27, hat: 0.06, perc: 'tom', percGain: 0.22 },
  order: 'ABCD',
  sections: {
    A: {
      bars: 8,
      melody: `d5:3 eb5:1 d5 g4 bb4:3 c5:1 d5:4 | eb5:3 f5:1 eb5 c5 ab4:4 -:4
             | d5:3 eb5:1 d5 g5 f5:3 eb5:1 d5:4 | c5:3 eb5:1 ab5:4 g5:1 ab5:1 g5 eb5:4
             | g5:3 g5:1 c6:4 bb5 g5 eb5 g5 | f5:3 d5:1 bb4 d5 f5:4 bb5:4
             | ab5:3 g5:1 f5 eb5 c5:3 eb5:1 ab5:4 | a5:1 bb5:1 a5 f#5:4 eb5 d5 c5 a4`,
      bass: `g2:3 d3:1 g2:1 bb2:1 c3 d3 g2:1 g2:1 f3 d3 | ab2:3 eb3:1 ab2:1 c3:1 bb2 ab2 ab2:1 ab2:1 eb3 c3
           | g2:3 d3:1 g2:1 bb2:1 c3 d3 g2:1 g2:1 f3 d3 | ab2:3 eb3:1 ab2:1 c3:1 bb2 ab2 ab2:1 ab2:1 eb3 c3
           | c3:3 g3:1 c3:1 eb3:1 f3 g3 c3:1 c3:1 bb2 g2 | bb1:3 f2:1 bb1:1 d2:1 eb2 f2 bb1:1 bb1:1 ab2 f2
           | ab2:3 eb3:1 ab2:1 c3:1 bb2 ab2 ab2:1 ab2:1 eb3 c3 | d2:3 a2:1 d2:1 f#2:1 g2 a2 d2:1 d2:1 c3 a2`,
      chords: 'Gm | Ab | Gm | Ab | Cm | Bb | Ab | D7',
      comp: '..x..x...x...x..|..x..x...x..x.x.',
      kick: 'x..x....x..x....|x..x....x..x..x.',
      snare: '....x.....g...x.|....x..g......x.',
      hat: 'x.xgx.x.xgx.x.x.|x.xgx.x.xgx.x.o.',
      perc: '......g.....x...|......g...x...x.',
    },
    B: {
      bars: 8,
      melody: `g5 g5:1 g5:1 bb5:4 eb6:3 d6:1 bb5:4 | a5 a5:1 a5:1 c6:4 f#5:3 g5:1 a5:4
             | g5 g5:1 g5:1 eb5:4 c6:3 bb5:1 g5:4 | bb5:3 a5:1 g5 d5 g5:8
             | bb5 bb5:1 bb5:1 eb6:4 f6:3 eb6:1 d6:4 | c6 c6:1 c6:1 a5:4 f#5:3 a5:1 d6:4
             | eb6:3 d6:1 c6 ab5 eb5:3 f5:1 ab5:4 | g5:1 a5:1 g5 f#5 eb5 d5:4 -:4`,
      bass: `eb2:1 eb2:1 eb3 eb2:1 bb2:1 eb3 eb2:1 eb2:1 bb2 d3 eb3 | d2:1 d2:1 d3 d2:1 a2:1 d3 d2:1 d2:1 a2 c3 f#2
           | c2:1 c2:1 c3 c2:1 g2:1 c3 c2:1 c2:1 g2 bb2 c3 | g2:1 g2:1 g3 g2:1 d3:1 g3 g2:1 g2:1 d3 f3 g3
           | eb2:1 eb2:1 eb3 eb2:1 bb2:1 eb3 eb2:1 eb2:1 bb2 d3 eb3 | d2:1 d2:1 d3 d2:1 a2:1 d3 d2:1 d2:1 a2 c3 f#2
           | ab2:1 ab2:1 ab3 ab2:1 eb3:1 ab3 ab2:1 ab2:1 eb3 c3 ab2 | d2:1 d2:1 d3 d2:1 a2:1 d3 c3:1 c3:1 a2:1 a2:1 f#2 d2`,
      chords: 'Eb | D7 | Cm | Gm | Eb | D7 | Ab | D7',
      comp: 'X..x...x..x...x.',
      kick: 'x..x..x.x..x..x.|x..x..x.x..x.xx.',
      snare: '....X..g....X...|....X..g....X.gg',
      hat: 'xg.xxg.xxg.xxg.x',
      perc: '..x..x....x..x..|..x..x....x.xxx.',
    },
    C: {
      bars: 8,
      melody: `d6:6 c6 bb5:4 f5:4 | a5:6 c6 f5:8
             | bb5:4 a5 g5 d5:4 f5:4 | g5:6 f5 eb5:4 bb5:4
             | d6:6 eb6 f6:4 d6:4 | c6:6 a5 f5:4 a5:4
             | bb5:4 g5:4 eb6:4 d6:4 | c6:8 a5 f5 eb5:4`,
      bass: `bb1:6 f2 bb2:6 f2 | f2:6 c3 f3:6 c3
           | g2:6 d3 g3:6 d3 | eb2:6 bb2 eb3:6 bb2
           | bb1:6 f2 bb2:6 f2 | d2:6 a2 d3:6 a2
           | eb2:6 bb2 eb3:6 bb2 | f2:4 f2 c3 eb3:4 a2 c3`,
      chords: 'Bb | F | Gm7 | Ebmaj7 | Bb | Dm7 | Ebmaj7 | F7',
      comp: '0.2.1.3.2.4.3.1.',
      kick: 'x..x............|x..x........x...',
      snare: '........x.......',
      hat: '..x...x...x...x.|..x...x...x...o.',
      perc: '................|..........g.....',
    },
    D: {
      bars: 4,
      melody: `g4:4 ab4 g4 -:4 d5 eb5 | c5:4 eb5 c5 -:4 ab4 g4
             | g4:4 bb4 d5 g5:4 f5 eb5 | d5:1 eb5:1 f#5:1 g5:1 a5 c6 bb5 a5 f#5 a5`,
      bass: `g2:1 g2:1 g2:1 g2:1 g2:1 g2:1 d3:1 g2:1 g2:1 g2:1 g2:1 g2:1 bb2 a2
           | ab2:1 ab2:1 ab2:1 ab2:1 ab2:1 ab2:1 eb3:1 ab2:1 ab2:1 ab2:1 ab2:1 ab2:1 g2 ab2
           | g2:1 g2:1 g2:1 g2:1 g2:1 g2:1 d3:1 g2:1 g2:1 g2:1 g2:1 g2:1 bb2 a2
           | d2:1 d2:1 d2:1 d2:1 d3 d2:1 d2:1 d3 c3 a2 f#2`,
      chords: 'Gm | Ab | Gm | D7',
      comp: 'o...........x.x.|o...........x.x.|o.......x...x.x.|X...x...x.x.x.x.',
      kick: 'x..x....x..x....|x..x..x.x..x..x.|x.x.x.x.x.x.x.x.|x.x.x.x.xxxxxxxx',
      snare: '....x.......x...|....x.......x...|....x...x...x...|x.x.x.x.xxxxXXXX',
      hat: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|xxxxxxxxxxxxxxxx|xxxxxxxxxxxxxxxo',
      perc: '................|..........x.x...|......x...x.x.x.|x.x.x.x.x.x.x.x.',
    },
  },
};

// Rennstück für den Baumkronenpfad. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'baum' ein.
import type { SongDef } from '../songs';

/**
 * Baumkronenpfad: G-Dur mit Abstechern nach e-Moll, 136 BPM, ganz leicht geschwungen. Ein goldener Herbstnachmittag
 * im Wald – verspielt und warm, mit Rennmotor darunter. Klangbild einer kleinen Waldkapelle: Die Leitstimme ist eine
 * Holzflöte (Rechteck hinter einem weichen Filter, eine Spur verstimmt, Vibrato auf langen Tönen, Echo zwischen den
 * Stämmen), die Begleitung zupft wie eine Gitarre gebrochene Akkorde, der Bass (Dreieck, kurz gezupft) springt wie ein
 * Eichhörnchen zwischen Grundton und Quinte, und der Schüttler raschelt wie trockenes Laub.
 * A: Waldweg und die Rampe um den Riesenstamm hinauf – ein hüpfendes Motiv, das den Dreiklang hinaufklettert und oben
 * kurz verweilt (g–h–d–g), über G – D – Em – C – G – D – C – D; der Bass in Achteln, die Gitarre im Wechselschlag.
 * B: die Hängebrücken – alles schaukelt: lange Melodiebögen, gehaltene Akkorde, Schlagzeug im halben Tempo, der Bass
 * liegt; Em – C – G – D – Em – C – Am – D. A noch einmal (von Krone zu Krone), dann C: Gleitflug, Wasserfall und
 * Teich – die Flöte stürzt in Sechzehnteln abwärts wie das Wasser über die Felsstufe, der Bass treibt in kurzen
 * Doppelschlägen, die Hi-Hat rauscht, ein H7 am Ende zieht zurück auf den Waldweg. Abfolge A B A C.
 */
export const BAUM_STUECK: SongDef = {
  bpm: 136,
  swing: 0.08,
  race: true,
  level: 1,
  lead: { wave: 'square', cutoff: 1900, gain: 0.17, detune: 5, vibrato: 14, send: 0.3, gate: 0.82 },
  bass: { wave: 'triangle', cutoff: 700, pluck: 520, q: 1.6, gain: 0.42, gate: 0.6 },
  comp: { wave: 'triangle', cutoff: 3000, gain: 0.1, gate: 0.4, send: 0.22, low: 55, pan: -0.2 },
  drums: { kick: 0.66, snare: 0.24, hat: 0.06, perc: 'shaker', percGain: 0.13 },
  order: 'ABAC',
  sections: {
    A: {
      bars: 8,
      melody: `g4:2 b4:2 d5:4 b4:2 d5:2 g5:4
             | f#5:3 e5:1 d5:4 a4:4 -:4
             | e5:2 g5:2 b5:4 a5:2 g5:2 e5:4
             | c5:3 d5:1 e5:4 g5:4 e5:4
             | d5:2 g5:2 b5:3 a5:1 g5:4 d5:4
             | a5:3 b5:1 a5:2 f#5:2 d5:8
             | c6:3 b5:1 a5:2 g5:2 e5:4 g5:4
             | f#5:4 a5:4 d6:8`,
      bass: `g2 d3 g2 d3 g2 d3 b2 d3
           | d2 a2 d2 a2 d2 a2 f#2 a2
           | e2 b2 e2 b2 e2 b2 g2 b2
           | c2 g2 c2 g2 c2 g2 e2 g2
           | g2 d3 g2 d3 b2 d3 g2 d3
           | d2 a2 d2 a2 f#2 a2 d2 a2
           | c2 g2 c2 g2 e2 g2 c3 g2
           | d2 a2 d2 a2 f#2 a2 c3 a2`,
      chords: 'G | D | Em | C | G | D | C | D',
      comp: '0.21.2.30.21.2.3',
      kick: 'x.....x.x.......|x.....x.x...x...',
      snare: '....x.......x...|....x.......x..g',
      hat: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.xo',
      perc: '..x...x...x...x.|..x...x...x.x.x.',
    },
    B: {
      bars: 8,
      melody: `b4:4 e5:4 g5:6 f#5:2
             | e5:4 c5:4 g4:8
             | d5:2 g5:2 b5:4 a5:4 g5:4
             | f#5:8 a5:4 d5:4
             | e5:2 g5:2 b5:4 e6:6 d6:2
             | c6:4 b5:2 a5:2 g5:8
             | a5:4 c6:4 e6:4 c6:4
             | d6:4 c6:2 a5:2 f#5:8`,
      bass: `e2:8 b2:8
           | c2:8 g2:8
           | g2:8 d3:8
           | d2:8 a2:8
           | e2:8 b2:8
           | c2:8 e2:8
           | a1:8 e2:8
           | d2:8 f#2:8`,
      chords: 'Em | C | G | D | Em | C | Am | D',
      comp: 'o.......2...4...',
      kick: 'x.......x.......|x.......x...x...',
      snare: '........x.......|........x.....g.',
      hat: '..o...o...o...o.|..o...o...o.o.o.',
      perc: '........x.......',
    },
    C: {
      bars: 8,
      melody: `e5:1 g5:1 c6:2 g5:2 e5:2 g5:2 c6:2 e6:4
             | d6:2 a5:2 f#5:2 a5:2 d6:4 c6:2 a5:2
             | b5:2 f#5:2 d5:2 f#5:2 b5:4 a5:2 f#5:2
             | g5:4 e5:4 b4:4 e5:4
             | c6:3 b5:1 c6:2 e6:2 g5:4 e5:4
             | d6:3 c6:1 b5:2 a5:2 f#5:4 d5:4
             | c6:2 a5:2 e5:2 a5:2 c6:2 e6:2 d6:2 c6:2
             | b5:4 d#6:4 f#5:4 b4:4`,
      bass: `c2:1 c2:1 c3:2 c2:1 c2:1 c3:2 g2:2 c3:2 g2:2 e2:2
           | d2:1 d2:1 d3:2 d2:1 d2:1 d3:2 a2:2 d3:2 a2:2 f#2:2
           | b1:1 b1:1 b2:2 b1:1 b1:1 b2:2 f#2:2 b2:2 f#2:2 d2:2
           | e2:1 e2:1 e3:2 e2:1 e2:1 e3:2 b2:2 e3:2 b2:2 g2:2
           | c2:1 c2:1 c3:2 c2:1 c2:1 c3:2 g2:2 c3:2 e2:2 g2:2
           | d2:1 d2:1 d3:2 d2:1 d2:1 d3:2 a2:2 f#2:2 d2:2 a1:2
           | a1:1 a1:1 a2:2 a1:1 a1:1 a2:2 e2:2 a2:2 c3:2 a2:2
           | b1:1 b1:1 b2:2 d#2:2 f#2:2 a2:2 f#2:2 d#2:2 b1:2`,
      chords: 'C | D | Bm | Em | C | D | Am | B7',
      comp: '..x...x...x...x.|..x...x...x.x.x.',
      kick: 'x...x..xx...x...|x...x..xx...x.x.',
      snare: '....x.......x...|....x.......x.xx',
      hat: 'xgxgxgxgxgxgxgxg|xgxgxgxgxgxgxgxo',
      perc: '..x..x....x..x..|..x..x....x.x.x.',
    },
  },
};

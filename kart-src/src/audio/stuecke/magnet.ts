// Rennstück für das Magnetwerk. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'magnet' ein.
import type { SongDef } from '../songs';

/**
 * Magnetwerk: a-Moll, 137 BPM, gerade. Fabrik bei Nacht, Strom liegt in der Luft – treibend, kühl, ein bisschen
 * gefährlich, aber verspielt. Klangbild: Der Bass ist ein Sägezahn mit steilem, resonantem Filter, der bei jedem
 * Anschlag aufschnappt; er pulsiert in Sechzehnteln wie ein Relais, das anzieht und abfällt („tak-tak-TAK –“: zwei
 * Grundtöne, dann die Oktave oder Quinte, dann eine Lücke). Die Begleitung ist ein Arpeggio aus gefiltertem
 * Sägezahn, das in Dreiergruppen durch die Akkordtöne läuft – drei gegen vier, wie Spulen, die gegen den Takt
 * umlaufen. Die Leitstimme ist ein klares Rechteck ohne Schwebung (nur 3 Cent Verstimmung). Schlagzeug wie eine
 * Stanze: Die Bassdrum schlägt auf 1, 2, „2-e-und-a“ … – keine gleichmäßigen Viertel –, dazu das metallische
 * 'clank' als Amboss und Schütz zwischen den Schlägen.
 * Das Motiv „Funke“: ein Ton, eine Quarte hinab und wieder hinauf, dann ein Sprung zur Terz, ein Schritt zurück,
 * und ein Satz um eine Quinte nach oben (a-e-a-c-h-a-e) – kurz, kurz, lang, wie ein überspringender Funke.
 * A: Werkhalle – der Funke über Am – Am – B – Am (der Halbton b–a als phrygischer, bedrohlicher Schatten), dann
 * F – G – Dm7 – E7. B: Hochspannung – lange, steigende Dreiklangsbögen über Fmaj7 – G – Em7 – Am7 – Dm7 – G – Bmaj7
 * (mit der übermäßigen Quarte e darüber) – E7; der Bass pumpt synkopisch zwischen den Schlägen, die Spulen laufen
 * in Vierergruppen. A noch einmal, dann C: die Trommel. Takt 1–4 steigt die Spannung: der Bass klettert
 * chromatisch a – b – h – c, die Leitstimme pendelt immer schneller und höher bis zum f³, die Snare wirbelt.
 * Takt 5–6 steht alles kopf: Die Tonart kippt um einen Tritonus nach es-Moll – auf dem Quintenzirkel genau
 * gegenüber, die halbe Umdrehung –, das Funke-Motiv erklingt in Umkehrung (jeder Sprung in die Gegenrichtung) und
 * in der tiefsten Lage der Leitstimme, der Bass dagegen in seiner höchsten; Bassdrum und Snare tauschen die
 * Plätze (Snare auf 1 und 3, Bassdrum auf 2 und 4), die Spulen stehen still (gehaltene Akkorde). Takt 7–8 dreht es
 * zurück: B7 ist die Dominante von es-Moll und hat denselben Tritonus (d–as) wie E7, die Dominante von a-Moll –
 * über diesen Drehpunkt löst sich die Spannung, und auf E7 geht es von vorn los. Abfolge A B A C.
 */
export const MAGNET_STUECK: SongDef = {
  bpm: 137,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'square', cutoff: 2400, gain: 0.15, detune: 3, vibrato: 5, send: 0.28, gate: 0.72 },
  bass: { wave: 'sawtooth', cutoff: 380, pluck: 2200, q: 6, gain: 0.3, gate: 0.5 },
  comp: { wave: 'sawtooth', cutoff: 2200, gain: 0.07, gate: 0.35, send: 0.3, low: 57, pan: 0.25 },
  drums: { kick: 0.7, snare: 0.27, hat: 0.07, perc: 'clank', percGain: 0.11 },
  order: 'ABAC',
  sections: {
    A: {
      bars: 8,
      melody: `a5:2 -:1 e5:1 a5:2 c6:3 b5:1 a5:2 e6:4
             | d6:1 c6:1 b5:2 a5:2 g5:2 a5:6 -:2
             | bb5:2 -:1 f5:1 bb5:2 d6:3 c6:1 bb5:2 f6:4
             | e6:1 d6:1 c6:2 b5:2 a5:2 e5:6 -:2
             | f5:2 a5:2 c6:2 f6:3 e6:1 c6:2 a5:4
             | g5:2 b5:2 d6:2 f6:3 e6:1 d6:2 b5:4
             | c6:3 a5:3 f5:2 d6:3 c6:3 a5:2
             | g#5:4 b5:2 d6:2 e6:6 -:2`,
      bass: `a2:1 a2:1 a3:1 -:1 a2:1 a2:1 e3:1 -:1 a2:1 a2:1 a3:1 -:1 a2:1 a2:1 e3:1 -:1
           | a2:1 a2:1 a3:1 -:1 a2:1 a2:1 e3:1 -:1 a2:1 a2:1 a3:1 -:1 g2:1 g2:1 g3:1 -:1
           | bb2:1 bb2:1 bb3:1 -:1 bb2:1 bb2:1 f3:1 -:1 bb2:1 bb2:1 bb3:1 -:1 bb2:1 bb2:1 f3:1 -:1
           | a2:1 a2:1 a3:1 -:1 a2:1 a2:1 e3:1 -:1 a2:1 a2:1 a3:1 -:1 c3:1 c3:1 b2:1 -:1
           | f2:1 f2:1 f3:1 -:1 f2:1 f2:1 c3:1 -:1 f2:1 f2:1 f3:1 -:1 f2:1 f2:1 c3:1 -:1
           | g2:1 g2:1 g3:1 -:1 g2:1 g2:1 d3:1 -:1 g2:1 g2:1 g3:1 -:1 g2:1 g2:1 b2:1 -:1
           | d2:1 d2:1 d3:1 -:1 d2:1 d2:1 a2:1 -:1 d2:1 d2:1 d3:1 -:1 d2:1 d2:1 c3:1 -:1
           | e2:1 e2:1 e3:1 -:1 e2:1 e2:1 b2:1 -:1 e2:1 e2:1 e3:1 -:1 g#2:1 g#2:1 b2:1 d3:1`,
      chords: 'Am | Am | Bb | Am | F | G | Dm7 | E7',
      comp: '0120120120120120',
      kick: 'x...x..x..x.x...|x...x..x..x...xx',
      snare: '....x..g....x...|....x..g....x.g.',
      hat: 'x.x.x.xxx.x.x.xo',
      perc: '..x.....x..x....|..x.....x..x..x.',
    },
    B: {
      bars: 8,
      melody: `a5:6 c6:2 e6:6 -:2
             | d6:3 b5:3 g5:2 d6:4 b5:4
             | g5:6 b5:2 d6:6 -:2
             | c6:3 a5:3 e5:2 c6:2 b5:2 a5:4
             | f5:6 a5:2 c6:6 -:2
             | b5:3 d6:3 f6:2 e6:2 d6:2 b5:4
             | d6:4 f6:4 e6:2 d6:2 bb5:4
             | b5:2 g#5:2 e5:2 g#5:2 b5:2 d6:2 e6:4`,
      bass: `-:1 f2:1 f2:1 -:1 -:1 f3:1 f2:1 -:1 -:1 f2:1 f2:1 -:1 -:1 c3:1 f3:1 -:1
           | -:1 g2:1 g2:1 -:1 -:1 g3:1 g2:1 -:1 -:1 g2:1 g2:1 -:1 -:1 d3:1 g3:1 -:1
           | -:1 e2:1 e2:1 -:1 -:1 e3:1 e2:1 -:1 -:1 e2:1 e2:1 -:1 -:1 b2:1 e3:1 -:1
           | -:1 a2:1 a2:1 -:1 -:1 a3:1 a2:1 -:1 -:1 a2:1 a2:1 -:1 -:1 e3:1 g3:1 -:1
           | -:1 d2:1 d2:1 -:1 -:1 d3:1 d2:1 -:1 -:1 d2:1 d2:1 -:1 -:1 a2:1 d3:1 -:1
           | -:1 g2:1 g2:1 -:1 -:1 g3:1 g2:1 -:1 -:1 g2:1 g2:1 -:1 -:1 d3:1 f3:1 -:1
           | -:1 bb2:1 bb2:1 -:1 -:1 bb3:1 bb2:1 -:1 -:1 bb2:1 bb2:1 -:1 -:1 f3:1 a3:1 -:1
           | -:1 e2:1 e2:1 -:1 -:1 e3:1 e2:1 -:1 e2:1 e2:1 g#2:1 g#2:1 b2:1 b2:1 d3:1 d3:1`,
      chords: 'Fmaj7 | G | Em7 | Am7 | Dm7 | G | Bbmaj7 | E7',
      comp: '0123012301230123',
      kick: 'x..x...x..x.....|x..x...x..x...x.',
      snare: '....x.......x...|....x.......x.gg',
      hat: 'xgxgxoxgxgxgxoxg',
      perc: '...x...x...x...x',
    },
    C: {
      bars: 8,
      melody: `e5:2 a5:2 e5:2 b5:2 e5:2 c6:2 e5:2 b5:2
             | f5:2 bb5:2 f5:2 c6:2 f5:2 d6:2 f5:2 c6:2
             | f5:1 b5:1 d6:1 b5:1 f5:1 b5:1 d6:1 f6:1 d6:1 b5:1 d6:1 f6:1 b5:1 d6:1 f6:2
             | e6:1 c6:1 g5:1 c6:1 e6:1 c6:1 g5:1 c6:1 f6:6 -:2
             | eb5:2 -:1 ab5:1 eb5:2 c5:3 db5:1 eb5:2 ab4:4
             | ab4:1 bb4:1 b4:2 db5:2 eb5:2 db5:6 -:2
             | d5:1 f5:1 ab5:1 bb5:1 d6:1 f6:1 d6:1 bb5:1 ab5:2 f5:2 d5:4
             | e5:1 g#5:1 b5:1 d6:1 e6:4 d6:2 b5:2 g#5:4`,
      bass: `a2:1 a2:1 a2:1 a3:1 a2:1 a2:1 a2:1 a3:1 a2:1 a2:1 a2:1 a3:1 a2:1 a2:1 a2:1 a3:1
           | bb2:1 bb2:1 bb2:1 bb3:1 bb2:1 bb2:1 bb2:1 bb3:1 bb2:1 bb2:1 bb2:1 bb3:1 bb2:1 bb2:1 bb2:1 bb3:1
           | b2:1 b2:1 b2:1 b3:1 b2:1 b2:1 b2:1 b3:1 b2:1 b2:1 b2:1 b3:1 b2:1 b2:1 b2:1 b3:1
           | c3:1 c3:1 c3:1 c3:1 c3:1 c3:1 c3:1 c3:1 c3:6 -:2
           | eb3:2 bb3:2 gb3:2 eb3:2 bb3:2 gb3:2 eb3:4
           | ab3:2 eb3:2 b3:2 ab3:2 eb3:2 b2:2 ab2:4
           | bb2:1 bb2:1 bb3:1 -:1 bb2:1 bb2:1 f3:1 -:1 bb2:1 bb2:1 ab3:1 -:1 bb2:1 bb2:1 d3:1 -:1
           | e2:1 e2:1 e3:1 -:1 e2:1 e2:1 b2:1 -:1 e2:1 e2:1 d3:1 -:1 g#2:1 g#2:1 b2:1 d3:1`,
      chords: 'Am | Bb | Bdim | C | Ebm | Abm | Bb7 | E7',
      comp: `0120120120120120|0120120120120120|0123450123450123|0123450123450123
           | o.......o.......|o.......o.......|0123012301230123|0123012301230123`,
      kick: `x...x...x...x...|x...x...x...x...|x...x...x...x...|x...x...x.......
           | ....x.......x...|....x.......x...|x...x..x..x.x...|x...x..x..x.....`,
      snare: `....x.......x...|....x.......x.x.|..g.x.g.x.g.x.xx|g.g.x.x.xxxxXXXX
            | x.......x.......|x.......x.......|....x..g....x...|....x.......xxXX`,
      hat: `x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|xxxxxxxxxxxxxxxx|xxxxxxxxxxxxxxxx
          | o...o...o...o...|o...o...o...o...|x.x.x.xxx.x.x.xx|x.x.x.xxx.x.x.xo`,
      perc: `..x.....x..x....|..x.....x..x....|..x.....x..x....|..x.x...x.x.x...
           | ........x.......|........x.....x.|..x.....x..x....|..x.....x..x..x.`,
    },
  },
};

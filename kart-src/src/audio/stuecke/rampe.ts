// Rennstück für die Startrampe. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'rampe' ein.
import type { SongDef } from '../songs';

/**
 * Startrampe: D-Dur mit einem Abstecher nach h-Moll, 140 BPM, gerade. Ein Raketenstartplatz am Meer an einem
 * Nachmittag mit großem Himmel – feierlich und vorwärtsdrängend zugleich. Klangbild einer kleinen Startkapelle: Die
 * Leitstimme ist ein heller Bläsersatz (Sägezahn, zwei leicht verstimmte Stimmen, etwas Echo), die Begleitung schlägt
 * Akkorde im 3-3-2-Rhythmus (Rechteckpuls), der Bass (Rechteck, gezupft) treibt in Oktaven, die Tom-Toms rollen wie
 * fernes Triebwerksgrollen.
 * A: Startgerade und Schleife um den Sockel – eine Fanfare, die in Quarten und Quinten aufsteigt (d–a–d–fis–a) und auf
 * der Quinte stehen bleibt, über D – A – G – A – D – C – D – A; der Bass springt in Oktaven, das Schlagzeug geht gerade.
 * B: der Countdown – die Melodie zählt in kurzen Tönen mit Pausen abwärts (h–a–g–fis …), Bass und Akkorde liegen lang,
 * das Schlagzeug im halben Tempo; zur zweiten Hälfte verdoppeln sich die Töne, die Melodie steigt chromatisch an und
 * zündet auf dem hohen d: Hm – A – G – D – Hm – Em – A – D. A noch einmal (Wendel und Magnetring), dann C: der Aufstieg –
 * Sechzehntel-Dreiklänge jagen nach oben, der Bass treibt in punktierten Figuren, die Hi-Hat zischt; D – G – Hm – A –
 * D – G – Em – A, das A zieht zurück zur Fanfare. Abfolge A B A C.
 */
export const RAMPE_STUECK: SongDef = {
  bpm: 140,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'sawtooth', cutoff: 2300, gain: 0.15, detune: 8, vibrato: 10, send: 0.24, gate: 0.84 },
  bass: { wave: 'square', cutoff: 420, pluck: 800, q: 2, gain: 0.3, gate: 0.6 },
  comp: { wave: 'pulse25', cutoff: 3200, gain: 0.09, gate: 0.5, send: 0.3, low: 55, pan: 0.15 },
  drums: { kick: 0.72, snare: 0.26, hat: 0.06, perc: 'tom', percGain: 0.14 },
  order: 'ABAC',
  sections: {
    A: {
      bars: 8,
      melody: `d5:2 a4:2 d5:2 f#5:2 a5:6 g5:2
             | f#5:2 e5:2 d5:2 e5:2 f#5:4 a4:4
             | b4:2 d5:2 g5:4 f#5:2 e5:2 d5:4
             | e5:3 f#5:1 g5:2 a5:2 b5:4 a5:4
             | d5:2 a4:2 d5:2 f#5:2 a5:6 b5:2
             | c6:4 b5:2 a5:2 g5:4 e5:4
             | f#5:2 a5:2 d6:4 c#6:2 b5:2 a5:4
             | g5:2 e5:2 c#5:2 e5:2 a5:8`,
      bass: `d2 d3 d2 d3 a2 d3 d2 a2
           | a1 a2 a1 a2 e2 a2 c#3 a2
           | g2 d3 g2 d3 b2 d3 g2 d3
           | a1 a2 a1 a2 e2 a2 e2 c#2
           | d2 d3 d2 d3 a2 d3 f#2 a2
           | c2 c3 c2 c3 g2 c3 e2 g2
           | d2 d3 d2 a2 f#2 a2 d3 a2
           | a1 a2 c#2 e2 a2 e2 c#2 a1`,
      chords: 'D | A | G | A | D | C | D | A',
      comp: 'X..x..x.X..x..x.',
      kick: 'x...x...x...x...|x...x...x...x..x',
      snare: '....x.......x...|....x.......x.xx',
      hat: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.xo',
      perc: '................|............x.xx',
    },
    B: {
      bars: 8,
      melody: `b5:2 -:2 a5:2 -:2 g5:2 -:2 f#5:2 -:2
             | e5:2 -:2 d5:2 -:2 c#5:4 e5:4
             | a5:2 -:2 g5:2 -:2 f#5:2 -:2 e5:2 -:2
             | d5:2 -:2 c#5:2 -:2 b4:4 d5:4
             | b5:2 b5:2 a5:2 a5:2 g5:2 g5:2 f#5:2 f#5:2
             | e5:2 e5:2 d5:2 d5:2 c#5:2 e5:2 g5:2 b5:2
             | a5:2 b5:2 c#6:2 d6:2 a5:2 b5:2 c#6:2 d6:2
             | d6:12 -:4`,
      bass: `b1:4 b2:4 b1:4 b2:4
           | a1:4 a2:4 a1:4 a2:4
           | g2:4 d3:4 g2:4 d3:4
           | d2:4 a2:4 d2:4 a2:4
           | b1:2 b2:2 b1:2 b2:2 b1:2 b2:2 b1:2 b2:2
           | e2:2 e3:2 e2:2 e3:2 e2:2 e3:2 e2:2 e3:2
           | a1:2 a2:2 a1:2 a2:2 b1:2 b2:2 c#2:2 c#3:2
           | d2:2 d2:2 d2:2 d2:2 d2:2 d2:2 d2:2 d2:2`,
      chords: 'Bm | A | G | D | Bm | Em | A | D',
      comp: 'o.......x.x.x.x.',
      kick: 'x.......x.......|x.......x.......|x.......x.......|x...x...x...x...',
      snare: '................|........x.......|................|....x...x...xxxx',
      hat: 'x...x...x...x...',
      perc: '................|................|................|x.x.x.x.x.x.x.x.',
    },
    C: {
      bars: 8,
      melody: `d5:1 f#5:1 a5:1 d6:1 a5:1 f#5:1 d5:1 f#5:1 a5:2 d6:2 c#6:2 a5:2
             | b4:1 d5:1 g5:1 b5:1 g5:1 d5:1 b4:1 d5:1 g5:2 b5:2 a5:2 g5:2
             | b4:1 d5:1 f#5:1 b5:1 f#5:1 d5:1 b4:1 d5:1 f#5:2 b5:2 a5:2 f#5:2
             | a4:1 c#5:1 e5:1 a5:1 e5:1 c#5:1 a4:1 c#5:1 e5:4 a5:4
             | d6:4 c#6:2 b5:2 a5:4 f#5:4
             | g5:4 a5:2 b5:2 d6:4 b5:4
             | e5:2 g5:2 b5:2 e6:2 d6:2 b5:2 g5:2 e5:2
             | a5:2 c#6:2 e6:4 a5:8`,
      bass: `d2:2 d3:1 d3:1 a2:2 d2:2 d3:2 a2:2 f#2:2 d2:2
           | g2:2 g2:1 g2:1 d3:2 g2:2 b2:2 d3:2 b2:2 g2:2
           | b1:2 b2:1 b2:1 f#2:2 b1:2 d2:2 f#2:2 b2:2 f#2:2
           | a1:2 a2:1 a2:1 e2:2 a1:2 c#2:2 e2:2 a2:2 e2:2
           | d2:2 d3:1 d3:1 a2:2 d2:2 f#2:2 a2:2 d3:2 a2:2
           | g2:2 g2:1 g2:1 d3:2 g2:2 b2:2 d3:2 g2:2 d3:2
           | e2:2 e3:1 e3:1 b2:2 e2:2 g2:2 b2:2 e3:2 b2:2
           | a1:2 a2:1 a2:1 e2:2 a1:2 c#2:2 e2:2 a2:2 c#3:2`,
      chords: 'D | G | Bm | A | D | G | Em | A',
      comp: 'x.xx.xx.x.xx.xx.',
      kick: 'x...x...x...x...|x...x...x...x.xx',
      snare: '....x.......x...|....x.......x.xx',
      hat: 'x.xox.xox.xox.xo',
      perc: '..x...x...x...x.',
    },
  },
};

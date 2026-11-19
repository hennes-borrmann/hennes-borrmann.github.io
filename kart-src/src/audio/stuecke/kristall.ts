// Rennstück für die Kristallmine. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'kristall' ein.
import type { SongDef } from '../songs';

/**
 * Kristallmine: e-Moll, 138 BPM, gerade. Eine Zeche bei Nacht und das Bergwerk darunter – dunkel, treibend, mit
 * Funkeln. Klangbild einer Bergmannskapelle, die in die Grube eingefahren ist: Die Leitstimme ist ein heiseres Horn
 * (Pulswelle 25 %, zwei Stimmen 5 Cent auseinander, wenig Vibrato), der Bass eine gezupfte Tuba (Rechteck, kurzer
 * Filterstoß), die Begleitung glitzert als Dreieck mit viel Echo – das sind die Kristalle an den Stollenwänden. Das
 * metallische 'clank' sind Schlägel und Eisen: der Hammer auf dem Bohreisen.
 * Zwei Motive: der „Gruß“ – eine Quarte hinauf (h–e), dann zweimal derselbe Ton geschlagen, wie „Glück – auf, auf!“, und
 * das „Funkeln“ – ein langer hoher Ton, der kurz zum Nachbarton nippt und wieder zurückspringt, bevor er tief fällt.
 * A: Lorenbahn – der Gruß über Em – Em – C – D – Em – Am – H7 – H7 (das dis im H7 ist das Licht am Ende des Stollens);
 * der Bass marschiert im Wechselschritt Grundton – Oktave – Quinte, die Begleitung schlägt nach, der Hammer schlägt auf
 * die Drei und kurz vor der Eins. B: Grubensee und Geode – schwebend: Das Funkeln wandert über Cmaj7 – Hm7 – Am7 – Hm7 –
 * Cmaj7 – D7 – Em7 – H7, die Begleitung läuft in Sechzehntel-Arpeggien auf und ab, Schlagzeug im halben Tempo, nur ein
 * einzelner Hammerschlag tropft wie Wasser von der Firste. A noch einmal, dann C: Takt 1–2 die Sprengung – die
 * Zündschnur tickt in Sechzehnteln, der Bass pocht, die Snare wird dichter; Takt 3 der Knall (ein Schlag, dann Stille
 * mit dem hohen e liegend); Takt 4–8 die Auffahrt im Wetterschacht – der Gruß wird zur Fanfare (C – D – Hm – C D),
 * der Bass steigt in Vierteln, und über H7 geht es zurück in die Lorenbahn. Abfolge A B A C.
 */
export const KRISTALL_STUECK: SongDef = {
  bpm: 138,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'pulse25', cutoff: 2400, gain: 0.26, detune: 5, vibrato: 6, send: 0.26, gate: 0.86 },
  bass: { wave: 'square', cutoff: 300, pluck: 900, q: 2.2, gain: 0.3, gate: 0.55 },
  comp: { wave: 'triangle', cutoff: 3600, gain: 0.1, gate: 0.55, send: 0.42, low: 53, pan: 0.2 },
  drums: { kick: 0.7, snare: 0.25, hat: 0.06, perc: 'clank', percGain: 0.1 },
  order: 'ABAC',
  sections: {
    A: {
      bars: 8,
      melody: `b4:2 e5:4 e5:1 e5:1 g5:2 f#5:2 e5:4
             | d5:2 e5:2 g5:2 b5:6 a5:2 g5:2
             | e5:2 g5:4 g5:1 g5:1 c6:2 b5:2 g5:4
             | a5:2 f#5:2 d5:2 a5:6 g5:2 f#5:2
             | b4:2 e5:4 e5:1 e5:1 b5:2 a5:2 g5:4
             | c6:3 b5:3 a5:2 e5:6 c5:2
             | d#5:2 f#5:2 a5:2 c6:6 b5:2 a5:2
             | b5:8 -:4 b4:2 d#5:2`,
      bass: `e2:2 -:2 e3:2 -:2 b2:2 -:2 e3:2 -:2
           | e2:2 -:2 e3:2 -:2 b2:2 -:2 g2:2 b2:2
           | c2:2 -:2 c3:2 -:2 g2:2 -:2 c3:2 -:2
           | d2:2 -:2 d3:2 -:2 a2:2 -:2 f#2:2 d2:2
           | e2:2 -:2 e3:2 -:2 b2:2 -:2 e3:2 -:2
           | a2:2 -:2 e2:2 -:2 c3:2 -:2 a2:2 -:2
           | b1:2 -:2 b2:2 -:2 f#2:2 -:2 a2:2 -:2
           | b1:2 b1:2 b2:2 b1:2 d#2:2 f#2:2 a2:2 b2:2`,
      chords: 'Em | Em | C | D | Em | Am | B7 | B7',
      comp: '..x...x...x...x.|..x...x...x.0123',
      kick: 'x...x...x...x...|x...x...x...x...|x...x...x...x...|x...x...x...x.x.',
      snare: '....x.......x...|....x.......x..g',
      hat: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.xo',
      perc: '........x.....x.',
    },
    B: {
      bars: 8,
      melody: `e6:6 d6:1 e6:1 b5:8
             | d6:6 c6:1 d6:1 f#5:8
             | c6:6 b5:1 c6:1 e5:6 a5:2
             | b5:4 a5:4 f#5:4 d5:4
             | e6:6 d6:1 e6:1 b5:4 c6:4
             | d6:6 c6:1 d6:1 a5:8
             | b5:6 a5:1 g5:1 e5:6 g5:2
             | f#5:4 a5:4 d#5:4 -:2 b4:2`,
      bass: `c2:12 g2:4
           | b1:12 f#2:4
           | a2:12 e2:4
           | b1:12 d2:4
           | c2:12 g2:4
           | d2:12 a2:4
           | e2:12 b2:4
           | b1:8 f#2:4 b2:4`,
      chords: 'Cmaj7 | Bm7 | Am7 | Bm7 | Cmaj7 | D7 | Em7 | B7',
      comp: '0123456776543210',
      kick: 'x.........x.....|x.........x.....|x.........x.....|x.........x...x.',
      snare: '........x.......|........x.....g.',
      hat: 'g.g.g.g.g.g.g.g.|g.g.g.g.g.g.o...',
      perc: '..............x.|................',
    },
    C: {
      bars: 8,
      melody: `e5:1 -:1 e5:1 -:1 e5:1 -:1 e5:1 -:1 f5:1 -:1 f5:1 -:1 f5:1 -:1 f5:1 -:1
             | d#5:1 -:1 d#5:1 -:1 f#5:1 -:1 f#5:1 -:1 a5:1 a5:1 b5:1 b5:1 c6:1 c6:1 d#6:1 d#6:1
             | e6:8 -:4 b4:2 e5:2
             | g5:4 e5:2 g5:2 c6:8
             | a5:4 f#5:2 a5:2 d6:8
             | b5:4 d6:2 b5:2 f#5:6 b4:2
             | c6:4 b5:2 a5:2 d6:4 c6:2 a5:2
             | b5:6 a5:2 f#5:2 d#5:2 -:2 b4:2`,
      bass: `a2:1 -:1 a2:1 -:1 a2:1 -:1 a2:1 -:1 a2:1 -:1 a2:1 -:1 a2:1 -:1 a2:1 -:1
           | b1:1 -:1 b1:1 -:1 b1:1 -:1 b1:1 -:1 b1:1 b1:1 b1:1 b1:1 b1:1 b1:1 b1:1 b1:1
           | e2:12 b1:4
           | c2:4 g2:4 c3:4 g2:4
           | d2:4 a2:4 d3:4 a2:4
           | b1:4 f#2:4 b2:4 f#2:4
           | c2:4 g2:4 d2:4 a2:4
           | b1:4 d#2:4 f#2:4 a2:4`,
      chords: 'Am | B7 | Em | C | D | Bm | C D | B7',
      comp: `o.......o.......|x.x.x.x.xxxxxxxx|X...............|..x...x...x...x.
           | ..x...x...x...x.|..x...x...x...x.|..x...x...x.x.x.|..x...x...0123..`,
      kick: `................|................|X...............|x...x...x...x...
           | x...x...x...x...|x...x...x...x...|x...x...x...x...|x...x...x...x.xx`,
      snare: `................|....g.g.g.g.gggg|X...............|....x.......x...
            | ....x.......x...|....x.......x...|....x.......x...|....x...x.x.xXXX`,
      hat: `x.x.x.x.x.x.x.x.|xxxxxxxxxxxxxxxx|o...............|x.x.x.x.x.x.x.x.
          | x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.xxxxxxxx`,
      perc: `x.......x.......|x...x...x...x...|................|......x.......x.
           | ......x.......x.|......x.......x.|......x.......x.|......x...x...x.`,
    },
  },
};

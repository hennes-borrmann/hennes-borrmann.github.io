// Vier neue Eigenkompositionen im Datenformat von songs.ts.
// Die Einbindung in MusicId und den Sequenzer übernimmt die Hauptentwicklung.
import type { SongDef } from './songs';

/** Wolkenwerft: G-lydisch, 132 BPM. Aufwärts springende Rufe und federnde Basspausen;
 *  im zweiten Acht-Takt-Abschnitt antwortet die Melodie aus einer höheren Lage. */
const WOLKEN: SongDef = {
  bpm: 132,
  swing: 0.06,
  race: true,
  level: 1,
  lead: { wave: 'triangle', cutoff: 3400, gain: 0.2, detune: 4, vibrato: 5, send: 0.32, gate: 0.78 },
  bass: { wave: 'triangle', cutoff: 680, pluck: 650, q: 1.2, gain: 0.34, gate: 0.65 },
  comp: { wave: 'pulse12', cutoff: 2400, gain: 0.085, gate: 0.38, send: 0.28, low: 60, pan: 0.28 },
  drums: { kick: 0.66, snare: 0.25, hat: 0.065, perc: 'shaker', percGain: 0.065 },
  order: 'AB',
  sections: {
    A: {
      bars: 8,
      melody: `d5 g5 a5:4 f#5 b5 a5 - | b5:3 a5:1 f#5 d5 e5:4 - a5
             | f#5 b5 c#6:4 a5 f#5 d5 - | g5:4 d5 b4 c#5:4 d5 g5
             | b4 e5 g5:4 f#5 b5 g5 - | e5:3 c#5:1 e5 a5 b5:4 - c#6
             | a5 f#5 c#5:4 e5 f#5 a5 - | f#5:4 e5 d5 a5:4 g5 f#5`,
      bass: `g2:4 - d3 g2:4 b2 - | a2:4 - e3 a2:4 c#3 -
           | b2:4 - f#3 b2:4 a2 - | g2:4 - d3 g2:4 f#2 -
           | e2:4 - b2 e3:4 g2 - | a2:4 - e3 a2:4 b2 -
           | f#2:4 - c#3 f#2:4 a2 - | d2:4 - a2 d3:4 f#2 a2`,
      chords: 'Gmaj7 | A | Bm7 | Gmaj7 | Em7 | A | F#m7 | Dmaj7',
      comp: '..x...x..x....x.|..x...x....x..x.',
      kick: 'x......x..x.....|x.....x....x..x.',
      snare: '....x.......x.g.|....x......gx...',
      hat: '..x.x...g.x.x...|..x.x.g...x.x.o.',
      perc: 'g..g..g...g..g..|..g...g..g...g..',
    },
    B: {
      bars: 8,
      melody: `g5:3 b5:1 e6:4 d6 b5 g5:4 | a5:3 g5:1 d6:4 b5 f#5 g5:4
             | c#6:3 b5:1 a5:4 e5 f#5 a5:4 | d6:4 c#6 a5 f#5:4 b5 -
             | e6:3 d6:1 a5:4 f#5 e5 d5:4 | c#6:4 a5 e5 b5:4 a5 -
             | g5:3 f#5:1 e5:4 b4 d5 g5:4 | b5:4 a5 f#5 g5:6 -`,
      bass: `e2 - b2 e3 - g2 b2:4 | g2 - d3 g3 - b2 d3:4
           | a2 - e3 a3 - c#3 e3:4 | b2 - f#3 b3 - a2 f#2:4
           | d2 - a2 d3 - f#2 a2:4 | a2 - e3 a3 - b2 c#3:4
           | e2 - b2 e3 - g2 a2:4 | g2:4 d3 b2 g2:4 - d3`,
      chords: 'Em7 | Gmaj7 | A | Bm7 | Dmaj7 | A | Em7 | Gmaj7',
      comp: '.x....x...x..x..|...x..x..x....x.',
      kick: 'x..x....x....x..|x......xx.....x.',
      snare: '....x.....g.x...|....x.......x.gx',
      hat: '..x.x.x...x.x.g.|..x.x.o...x.x.o.',
      perc: '...g..g..g..g...|.g....g....g..g.',
    },
  },
};

/** Tiefseeriff: cis-Dorisch, 126 BPM. Weiche Sinusmelodie über versetzten Arpeggien;
 *  acht suchende Takte gehen in acht weit ausschwingende Antworttakte über. */
const RIFF: SongDef = {
  bpm: 126,
  swing: 0.03,
  race: true,
  level: 1,
  lead: { wave: 'sine', cutoff: 2900, gain: 0.2, detune: 0, vibrato: 8, send: 0.4, gate: 0.94 },
  bass: { wave: 'triangle', cutoff: 540, pluck: 480, q: 1, gain: 0.36, gate: 0.84 },
  comp: { wave: 'triangle', cutoff: 2600, gain: 0.14, gate: 0.7, send: 0.38, low: 59, pan: -0.3 },
  drums: { kick: 0.66, snare: 0.22, hat: 0.06, perc: 'shaker', percGain: 0.065 },
  order: 'AB',
  sections: {
    A: {
      bars: 8,
      melody: `g#4:4 d#5 e5:6 c#5 - | a#4:4 e5 f#5:6 d#5 -
             | g#5:4 f#5 d#5:6 b4 - | a#4:4 c#5 f#5:6 e5 d#5
             | g#4:4 d#5 e5:4 g#5:4 - | f#5:6 d#5 c#5:4 a#4 b4
             | a#5:4 g#5 e5:4 f#5:4 - | d#5:6 b4 g#4:4 b4 d#5`,
      bass: `c#2:6 g#2 c#3:4 b2:4 | f#2:6 c#3 f#2:4 a#2:4
           | e2:6 b2 e3:4 d#3:4 | d#2:6 a#2 d#3:4 c#3:4
           | c#2:6 g#2 e3:4 c#3:4 | b1:6 f#2 b2:4 a#2:4
           | f#2:6 c#3 a#2:4 e3:4 | g#2:6 d#3 b2:4 g#2:4`,
      chords: 'C#m9 | F#7 | Emaj7 | D#m7 | C#m9 | Bmaj7 | F#7 | G#m7',
      comp: '.0..2.1...3..1.2|..1.0..2.3..2.0.',
      kick: 'x.........x..x..|x......x..x.....',
      snare: '......g.....x...|....x.........g.',
      hat: '.g...x...g...x..|...x...g...x...o',
      perc: '..g....g.g....g.|.g....g....g.g..',
    },
    B: {
      bars: 8,
      melody: `b5:6 g#5 f#5 d#5 e5:4 | a#5:6 f#5 e5 c#5 d#5:4
             | c#6:4 a#5 g#5 e5:4 f#5 - | b5:4 g#5 e5 d#5:4 c#5 -
             | f#5:4 b5 a#5 f#5:4 d#5 - | e5:6 a#5 g#5 f#5 e5:4
             | d#5:4 f#5 g#5 b5:4 a#5 g#5 | e5:4 d#5 c#5 g#4:4 -:4`,
      bass: `e2:4 b2 - g#2:4 b2 d#3 | d#2:4 a#2 - f#2:4 a#2 c#3
           | f#2:4 c#3 - a#2:4 c#3 e3 | c#2:4 g#2 - e3:4 d#3 c#3
           | b1:4 f#2 - d#3:4 c#3 b2 | f#2:4 c#3 - a#2:4 c#3 e3
           | g#2:4 d#3 - b2:4 a#2 g#2 | c#2:8 g#2:4 c#3:4`,
      chords: 'Emaj7 | D#m7 | F#7 | C#m9 | Bmaj7 | F#7 | G#m7 | C#m9',
      comp: '0..2.3...1..2.1.|.2..1.0...3..2.1',
      kick: 'x.....x...x....x|x........xx.....',
      snare: '....x.......x...|......g.....x..g',
      hat: '.x...g.x...x...g|...x.g...x...o..',
      perc: '..g.g....g...g..|.g...g..g....g..',
    },
  },
};

/** Eiszapfen-Pass: h-Moll mit Fis-Dur-Dominante, 146 BPM. Kurze kristalline
 *  Tonpaare im ersten Abschnitt, größere Sprünge und dichte Antworten im zweiten. */
const EIS: SongDef = {
  bpm: 146,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'triangle', cutoff: 3800, gain: 0.19, detune: 0, vibrato: 3, send: 0.27, gate: 0.56 },
  bass: { wave: 'pulse12', cutoff: 440, pluck: 1100, q: 2.4, gain: 0.34, gate: 0.56 },
  comp: { wave: 'sine', cutoff: 3600, gain: 0.15, gate: 0.45, send: 0.34, low: 61, pan: 0.23 },
  drums: { kick: 0.71, snare: 0.28, hat: 0.065, perc: 'clank', percGain: 0.085 },
  order: 'AB',
  sections: {
    A: {
      bars: 8,
      melody: `b4:1 f#5:1 d5 - b4:1 f#5:1 a5 f#5:4 d5 | e5:1 b5:1 g5 - e5:1 b5:1 a5 g5:4 e5
             | d5:1 b5:1 a5 - g5:1 d6:1 b5 a5:4 g5 | f#5:1 a5:1 d6 - c#6:1 a5:1 f#5 e5:4 d5
             | c#5:1 g5:1 e5 - c#5:1 g5:1 b5 g5:4 e5 | b4:1 e5:1 g5 - b5:1 g5:1 e5 d5:4 b4
             | a#4:1 c#5:1 f#5 - a#5:1 c#6:1 e6 c#6:4 a#5 | b5:4 f#5 d5 c#5 b4 -:4`,
      bass: `b1 b2 - b1 f#2 b2 - f#2 | e2 e3 - e2 b2 e3 - b2
           | g2 g3 - g2 d3 g3 - d3 | d2 d3 - d2 a2 d3 - a2
           | c#2 c#3 - c#2 g2 c#3 - g2 | e2 e3 - e2 b2 e3 - b2
           | f#2 f#3 - f#2 c#3 f#3 - a#2 | b1 b2 - f#2 b2 a2 f#2 d2`,
      chords: 'Bm | Em7 | Gmaj7 | D | C#dim | Em7 | F#7 | Bm',
      comp: '0...2.1...0...2.|..2...0.1...2.0.',
      kick: 'x.x.....x.x.....|x.x.....x....x.x',
      snare: '....x.......X...|....x..g....X...',
      hat: 'x.g.x.g.x.g.x.g.|x.g.x.g.x.g.x.og',
      perc: '.......x.......x|...x.......x....',
    },
    B: {
      bars: 8,
      melody: `e6:2 b5:1 g5:1 e5:4 g5 b5 d6:4 | c#6:2 a5:1 f#5:1 d5:4 a5 f#5 e5:4
             | b5:2 g5:1 d5:1 b4:4 d5 g5 a5:4 | c#6:2 e6:1 c#6:1 a5:4 e5 a5 b5:4
             | d6:2 b5:1 f#5:1 d5:4 f#5 b5 a5:4 | g5:2 e5:1 b4:1 g4:4 b4 e5 g5:4
             | a#5:2 f#5:1 e5:1 c#5:4 f#5 a#5 c#6:4 | d6:2 b5:1 a5:1 f#5:4 d5 c#5 b4:4`,
      bass: `e2:2 b2:1 e3:1 - e2 g2:2 b2:1 e3:1 - b2 | d2:2 a2:1 d3:1 - d2 f#2:2 a2:1 d3:1 - a2
           | g2:2 d3:1 g3:1 - g2 b2:2 d3:1 g3:1 - d3 | a2:2 e3:1 a3:1 - a2 c#3:2 e3:1 a3:1 - e3
           | b1:2 f#2:1 b2:1 - b1 d2:2 f#2:1 b2:1 - f#2 | e2:2 b2:1 e3:1 - e2 g2:2 b2:1 e3:1 - b2
           | f#2:2 c#3:1 f#3:1 - f#2 a#2:2 c#3:1 f#3:1 - c#3 | b1:4 f#2 b2 d3:4 c#3 b2`,
      chords: 'Em7 | Dmaj7 | Gmaj7 | A | Bm | Em7 | F#7 | Bm',
      comp: '2.0...1.2...0.1.|0.2...1.0...2.1.',
      kick: 'x.x.....x..x..x.|x.x...x.x.....x.',
      snare: '....X.......x...|....X.......x.gx',
      hat: 'x.gx..g.x.gx..g.|x.gx..g.x.gx..o.',
      perc: '...x.......x....|.......x.....x.x',
    },
  },
};

/** Mondbasis: fis-Moll mit dorischer Aufhellung im B-Teil, 140 BPM. Meist zwei
 *  Takte je Harmonie tragen lange Melodiebögen über einen schnellen Basspuls. */
const MOND: SongDef = {
  bpm: 140,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'pulse25', cutoff: 1900, gain: 0.16, detune: 11, vibrato: 9, send: 0.43, gate: 0.92 },
  bass: { wave: 'sawtooth', cutoff: 350, pluck: 950, q: 2.2, gain: 0.35, gate: 0.58 },
  comp: { wave: 'pulse12', cutoff: 2100, gain: 0.08, gate: 0.78, send: 0.42, low: 56, pan: -0.2 },
  drums: { kick: 0.7, snare: 0.24, hat: 0.06, perc: 'tom', percGain: 0.16 },
  order: 'AB',
  sections: {
    A: {
      bars: 8,
      melody: `c#5:8 g#5:4 a5:4 | ~:4 e5:4 f#5:6 -
             | a5:8 e6:4 d6:4 | ~:4 a5:4 f#5:6 -
             | f#5:8 c#6:4 d6:4 | ~:4 a5:4 b5:6 -
             | g#5:6 f#5 c#5:6 g#4 | b4:4 e#5:4 g#5:4 c#6:4`,
      bass: `f#2:1 -:1 c#3 f#2:1 -:1 c#3 f#2:1 -:1 a2 c#3 -
           | f#2:1 -:1 c#3 f#2:1 -:1 a2 e3:1 -:1 c#3 a2 -
           | d2:1 -:1 a2 d2:1 -:1 a2 d2:1 -:1 f#2 a2 -
           | d2:1 -:1 a2 d2:1 -:1 f#2 c#3:1 -:1 a2 f#2 -
           | b1:1 -:1 f#2 b1:1 -:1 f#2 b1:1 -:1 d2 f#2 -
           | b1:1 -:1 f#2 b1:1 -:1 d2 a2:1 -:1 f#2 d2 -
           | c#2:1 -:1 g#2 c#2:1 -:1 g#2 c#2:1 -:1 f#2 g#2 -
           | c#2:1 -:1 g#2 c#2:1 -:1 e#2 b2:1 -:1 g#2 e#2 -`,
      chords: 'F#m9 | F#m9 | Dmaj7 | Dmaj7 | Bm7 | Bm7 | C#sus4 | C#7',
      comp: 'o...........1...|......2.....0...',
      kick: 'x.......x..x....|x....x..x......x',
      snare: '........x.......|........x....g..',
      hat: 'x..gx..gx..gx..g|x..gx..gx..gx.o.',
      perc: '......g.........|...g.........x..',
    },
    B: {
      bars: 8,
      melody: `e6:6 c#6 b5:4 g#5:4 | a5:10 e5 f#5:4
             | d#6:6 b5 a#5:4 f#5:4 | g#5:10 d#5 f#5:4
             | a5:6 f#5 e5:4 c#5:4 | d5:8 a5:4 f#5:4
             | g#5:4 c#6 b5 g#5:4 f#5 c#5 | e#5:6 g#5 b5:4 g#5:4`,
      bass: `a2:1 -:1 e3 a2:1 -:1 e3 a2:1 -:1 c#3 e3 -
           | a2:1 -:1 e3 a2:1 -:1 c#3 g#2:1 -:1 e3 c#3 -
           | g#2:1 -:1 d#3 g#2:1 -:1 d#3 g#2:1 -:1 b2 d#3 -
           | g#2:1 -:1 d#3 g#2:1 -:1 b2 f#2:1 -:1 d#3 b2 -
           | d2:1 -:1 a2 d2:1 -:1 a2 d2:1 -:1 f#2 a2 -
           | d2:1 -:1 a2 d2:1 -:1 f#2 c#3:1 -:1 a2 f#2 -
           | c#2:1 -:1 g#2 c#2:1 -:1 g#2 c#2:1 -:1 f#2 g#2 -
           | c#2:1 -:1 g#2 c#2:1 -:1 e#2 b2:1 -:1 g#2 c#3 -`,
      chords: 'Amaj7 | Amaj7 | G#m7 | G#m7 | Dmaj7 | Dmaj7 | C#sus4 | C#7',
      comp: 'o.....2.....1...|..0.....3.....2.',
      kick: 'x....x..x....x..|x......xx..x....',
      snare: '........X.......|......g.X.....g.',
      hat: 'x.g.x..gx.g.x..g|x.g.x..gx.g.x.o.',
      perc: '..g........x....|.....g.......x.g',
    },
  },
};

export const NEUE_STUECKE: Record<'wolken' | 'riff' | 'eis' | 'mond', SongDef> = {
  wolken: WOLKEN,
  riff: RIFF,
  eis: EIS,
  mond: MOND,
};

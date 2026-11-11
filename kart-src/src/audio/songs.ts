// Die sechs Musikstücke als Daten – und der kleine Übersetzer, der daraus
// Schrittlisten für den Sequenzer macht. Alles Eigenkomposition.
//
// Schreibweise (ein Takt = 16 Schritte = 16 Sechzehntel, Takte durch | getrennt):
//
//   Melodie/Bass   "e5 g5:4 -:2 ~:3"   Ton mit Länge in Schritten (ohne Angabe 2 = Achtel),
//                                      "-" Pause, "~" verlängert den Ton davor (auch über den Taktstrich).
//                                      c4 ist das eingestrichene c, # und b sind Vorzeichen.
//   Akkorde        "Am7 | F C"         ein oder mehrere Akkorde je Takt, gleichmäßig verteilt.
//   Begleitmuster  "..x..x.0.1.2..o."  je Schritt ein Zeichen: x/X Akkordschlag (X betont),
//                                      o gehaltener Akkord, Ziffer = einzelner Akkordton (Arpeggio,
//                                      0 ist der tiefste, ab der Tonzahl geht es eine Oktave höher).
//   Schlagzeug     "x...x..g....o..."  x Schlag, X betont, g leise ("Ghost"), bei der Hi-Hat o = offen.
//
// Hat eine Stimme weniger Takte als der Abschnitt, wird sie wiederholt.

import { NEUE_STUECKE } from './songs-neu';
import type { MusicId } from './types';
import type { Wave } from './mixer';

export type PercKind = 'shaker' | 'clank' | 'tom' | 'clap';

export interface SectionDef {
  bars: number;
  melody: string;
  bass: string;
  chords: string;
  comp: string;
  kick: string;
  snare: string;
  hat: string;
  perc?: string;
}

export interface SongDef {
  bpm: number;
  /** Anteil eines Schritts, um den jedes zweite Sechzehntel verzögert wird (0 = gerade). */
  swing: number;
  /** Rennmusik reagiert auf die letzte Runde, Menü und Ergebnis nicht. */
  race: boolean;
  /** Gesamtpegel des Stücks – gleicht die Stücke untereinander an. */
  level: number;
  lead: {
    wave: Wave;
    /** Grenzfrequenz des Tiefpasses in Hz. */
    cutoff: number;
    gain: number;
    /** Verstimmung der zweiten Stimme in Cent (0 = nur eine Stimme). */
    detune: number;
    /** Vibratotiefe in Cent; setzt nur bei längeren Tönen ein. */
    vibrato: number;
    /** Anteil, der ins Echo geht. */
    send: number;
    /** Tonlänge als Anteil der notierten Länge. */
    gate: number;
  };
  bass: {
    wave: Wave;
    cutoff: number;
    /** So viele Hz öffnet der Filter beim Anschlag zusätzlich ("Zupfen"). */
    pluck: number;
    q: number;
    gain: number;
    gate: number;
  };
  comp: {
    wave: Wave;
    cutoff: number;
    gain: number;
    gate: number;
    send: number;
    /** Tiefster Ton der Akkordlage (MIDI); alle Akkordtöne liegen in der Oktave darüber. */
    low: number;
    pan: number;
  };
  drums: { kick: number; snare: number; hat: number; perc: PercKind; percGain: number };
  /** Abfolge der Abschnitte, z. B. "AB". */
  order: string;
  sections: Record<string, SectionDef>;
}

export interface NoteEvent {
  midi: number;
  steps: number;
}

export interface CompEvent {
  /** Ein Ton = Arpeggio, mehrere = Akkordschlag. */
  midis: number[];
  steps: number;
  vel: number;
}

/** Fertig übersetztes Stück: je Schritt, was zu spielen ist. */
export interface Song {
  def: SongDef;
  steps: number;
  lead: (NoteEvent | null)[];
  bass: (NoteEvent | null)[];
  comp: (CompEvent | null)[];
  /** Anschlagstärke je Schritt, 0 = nichts. */
  kick: number[];
  snare: number[];
  /** Positiv = geschlossen, negativ = offen. */
  hat: number[];
  perc: number[];
}

// ---------------------------------------------------------------------------
// Die Stücke
// ---------------------------------------------------------------------------

/** Menü: entspannt und groovig, F-Dur mit weichen Septakkorden. */
const MENU: SongDef = {
  bpm: 104,
  swing: 0.14,
  race: false,
  level: 1,
  lead: { wave: 'pulse25', cutoff: 2100, gain: 0.2, detune: 7, vibrato: 7, send: 0.3, gate: 0.86 },
  bass: { wave: 'triangle', cutoff: 620, pluck: 500, q: 1.2, gain: 0.5, gate: 0.8 },
  comp: { wave: 'triangle', cutoff: 1900, gain: 0.13, gate: 0.55, send: 0.25, low: 55, pan: 0.25 },
  drums: { kick: 0.62, snare: 0.26, hat: 0.07, perc: 'shaker', percGain: 0.07 },
  order: 'AB',
  sections: {
    A: {
      bars: 8,
      melody: `- a4 c5 f5:3 e5:3 c5:4 | - a4 c5 d5:3 f5:3 a4:4
             | - bb4 d5 f5:3 a5:3 g5:4 | e5:3 g5:3 e5 d5:4 c5 -
             | - a4 c5 f5:3 e5:3 c5:4 | - a4 c5 d5:3 f5:3 a5:4
             | g5:3 f5:3 d5 bb4:4 d5 c5 | c5:6 e5 g5 bb5:4 -`,
      bass: `f2:3 f2:3 c3 - f2 a2 c3 | d2:3 d2:3 a2 - d2 f2 a2
           | bb2:3 bb2:3 f2 - bb2 d3 f3 | c3:3 c3:3 g2 - c3 bb2 g2
           | f2:3 f2:3 c3 - f2 a2 c3 | d2:3 d2:3 a2 - d2 f2 a2
           | g2:3 g2:3 d3 - g2 bb2 d3 | c3:3 c3:3 g2 - c3 d3 e3`,
      chords: 'Fmaj7 | Dm7 | Bbmaj7 | C7 | Fmaj7 | Dm7 | Gm7 | C7',
      comp: '....x..x....x...|....x..x..x.x...',
      kick: 'x.....x...x.....|x.....x...x..x..',
      snare: '....x.......x...|....x.......x..g',
      hat: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.o.',
      perc: '..g...g...g...g.',
    },
    B: {
      bars: 8,
      melody: `a5:4 f5 d5 f5:4 - d5 | g5:4 e5 c5 e5:6 -
             | f5:4 d5 bb4 d5:4 f5 g5 | e5:3 d5:3 c5 e5:4 g5:4
             | a5:4 f5 d5 f5:4 a5 bb5 | c6:4 a5 e5 g5:6 -
             | f5:3 e5:3 d5 a4:4 d5 f5 | g5:4 bb5 a5 g5:3 e5:3 c5`,
      bass: `bb2:4 - bb2 f2:4 bb2 d3 | a2:4 - a2 e2:4 a2 c3
           | g2:4 - g2 d2:4 g2 bb2 | c3:4 - c3 g2:4 c3 e3
           | bb2:4 - bb2 f2:4 bb2 d3 | a2:4 - a2 e2:4 a2 c3
           | d3:4 - d3 a2:4 d3 c3 | g2:3 g2:3 d3 c3:3 c3:3 e3`,
      chords: 'Bbmaj7 | Am7 | Gm7 | C7 | Bbmaj7 | Am7 | Dm7 | Gm7 C7',
      comp: 'x..x..x.....x...',
      kick: 'x.....x.x.......|x.....x.x.....x.',
      snare: '....x.......x...',
      hat: 'x.xgx.xgx.xgx.o.',
      perc: '..g...g...g...g.',
    },
  },
};

/** Werkshof: funkiger Garagen-Groove in e-Moll (dorisch), mit Amboss-Klang im Schlagzeug. */
const WERKSHOF: SongDef = {
  bpm: 124,
  swing: 0.1,
  race: true,
  level: 1,
  lead: { wave: 'pulse25', cutoff: 2500, gain: 0.2, detune: 6, vibrato: 6, send: 0.22, gate: 0.8 },
  bass: { wave: 'sawtooth', cutoff: 420, pluck: 1500, q: 4, gain: 0.34, gate: 0.72 },
  comp: { wave: 'pulse12', cutoff: 2300, gain: 0.085, gate: 0.4, send: 0.12, low: 57, pan: 0.3 },
  drums: { kick: 0.7, snare: 0.3, hat: 0.075, perc: 'clank', percGain: 0.1 },
  order: 'AB',
  sections: {
    A: {
      bars: 8,
      melody: `-:4 b4 d5 e5:3 d5:1 b4 g4 | a4:3 b4:3 -:10
             | -:4 c#5 e5 g5:3 e5:1 c#5 a4 | b4:3 c#5:3 e5:4 -:6
             | -:4 b4 d5 e5:3 g5:1 e5 d5 | e5:3 g5:3 b5:6 -:4
             | bb5:3 g5:3 e5 c5:3 e5:3 g5 | f#5:3 d#5:3 b4 a4:3 b4:5`,
      bass: `e2 -:1 e2:1 - e3 -:1 d3:1 e3:1 -:1 g2 a2 | e2 -:1 e2:1 - e3 -:1 d3:1 e3:1 -:1 b2 d3
           | a2 -:1 a2:1 - a3 -:1 g3:1 a3:1 -:1 c3 c#3 | a2 -:1 a2:1 - a3 -:1 g3:1 a3:1 -:1 d3 d#3
           | e2 -:1 e2:1 - e3 -:1 d3:1 e3:1 -:1 g2 a2 | e2 -:1 e2:1 - e3 -:1 d3:1 e3:1 -:1 b2 d3
           | c3 -:1 c3:1 - c3:1 -:1 bb2 g2:1 bb2:1 c3 - | b2 -:1 b2:1 - b2:1 -:1 a2 f#2:1 a2:1 b2 d#3`,
      chords: 'Em7 | Em7 | A7 | A7 | Em7 | Em7 | C7 | B7',
      comp: '..x..x.x..x..x..|..x..x.x..x.x..x',
      kick: 'x..x......x.....|x..x......x..x..',
      snare: '....x..g.g..x...|....x..g.g..x..g',
      hat: 'x.xxx.x.x.xxx.x.|x.xxx.x.x.xxx.o.',
      perc: '......x.........|......x...x.....',
    },
    B: {
      bars: 8,
      melody: `e5:4 c5 a4 c5:3 e5:3 g5 | f#5:4 d5 a4 d5:3 f#5:3 a5
             | b5:3 a5:3 g5 d5:4 g5 a5 | g5:3 e5:3 c5 e5:6 -
             | e5:4 c5 a4 c5:3 e5:3 a5 | c6:3 a5:3 f#5 d5:4 f#5 a5
             | b5:3 g5:3 e5 d5:3 e5:5 | d#5 f#5 a5 b5:4 - b4:1 d5:1 d#5`,
      bass: `a2:3 a2:1 - e3 a2:1 -:1 g2 a2 c3 | d3:3 d3:1 - a2 d3:1 -:1 c3 d3 f#2
           | g2:3 g2:1 - d3 g2:1 -:1 f#2 g2 b2 | c3:3 c3:1 - g2 c3:1 -:1 b2 c3 e3
           | a2:3 a2:1 - e3 a2:1 -:1 g2 a2 c3 | d3:3 d3:1 - a2 d3:1 -:1 c3 d3 f#2
           | e2:3 e2:1 - b2 e2:1 -:1 d3 e3 g2 | b2:3 b2:1 - f#2 b2:1 -:1 a2 b2 d#3`,
      chords: 'Am7 | D7 | Gmaj7 | Cmaj7 | Am7 | D7 | Em7 | B7',
      comp: 'x..x..x...x..x..',
      kick: 'x.....x...x.....|x.....x...x..x..',
      snare: '....x.......x...|....x.......x.gg',
      hat: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.o.',
      perc: '..x.......x.....',
    },
  },
};

/** Klippe: luftig und treibend in D-Dur, mit perlendem Arpeggio. */
const KLIPPE: SongDef = {
  bpm: 138,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'pulse25', cutoff: 2700, gain: 0.19, detune: 8, vibrato: 7, send: 0.34, gate: 0.88 },
  bass: { wave: 'pulse25', cutoff: 520, pluck: 700, q: 1.5, gain: 0.33, gate: 0.6 },
  comp: { wave: 'triangle', cutoff: 3000, gain: 0.15, gate: 0.6, send: 0.4, low: 62, pan: -0.3 },
  drums: { kick: 0.66, snare: 0.27, hat: 0.07, perc: 'shaker', percGain: 0.065 },
  order: 'AB',
  sections: {
    A: {
      bars: 8,
      melody: `f#5:4 a5 d6:4 c#6 a5 f#5 | e5:4 a5 c#6:4 b5 a5 e5
             | d5:4 f#5 b5:4 a5 f#5 d5 | b5:3 a5:3 g5 d5:6 -
             | f#5:4 a5 d6:4 e6 d6 a5 | c#6:4 e6 c#6:4 b5 a5 e5
             | g5:3 b5:3 d6 b5:3 g5:3 b5 | a5:6 c#6 e6:6 -`,
      bass: `d2 d2 d3 d2 d2 d3 a2 d3 | a2 a2 a3 a2 a2 a3 e3 a2
           | b2 b2 b3 b2 b2 b3 f#3 b2 | g2 g2 g3 g2 g2 g3 d3 g2
           | d2 d2 d3 d2 d2 d3 a2 d3 | a2 a2 a3 a2 a2 a3 e3 a2
           | g2 g2 g3 g2 g2 g3 d3 g2 | a2 a2 a3 a2 a2 a3 c#3 e3`,
      chords: 'D | A | Bm | G | D | A | G | A',
      comp: '0.1.2.1.3.2.1.2.',
      kick: 'x...x...x...x...',
      snare: '....x.......x...|....x.......x.x.',
      hat: 'g.x.g.x.g.x.g.x.',
      perc: 'x.gxx.gxx.gxx.gx',
    },
    B: {
      bars: 8,
      melody: `d6:6 b5 g5:4 b5 d6 | c#6:6 a5 e5:4 a5 c#6
             | a5:3 f#5:3 c#5 f#5:4 a5 c#6 | b5:6 f#5 d5:6 -
             | d6:6 b5 g5:4 b5 d6 | e6:6 c#6 a5:4 c#6 e6
             | d6:3 a5:3 f#5 d5:4 f#5 a5 | e5 a5 c#6 e6:4 c#6 a5:4`,
      bass: `g2 g2 g3 g2 g2 g3 d3 g2 | a2 a2 a3 a2 a2 a3 e3 a2
           | f#2 f#2 f#3 f#2 f#2 f#3 c#3 f#2 | b2 b2 b3 b2 b2 b3 f#3 b2
           | g2 g2 g3 g2 g2 g3 d3 g2 | a2 a2 a3 a2 a2 a3 e3 a2
           | d2 d2 d3 d2 d2 d3 a2 d3 | a2 a2 a3 a2 e3 e3 c#3 a2`,
      chords: 'G | A | F#m | Bm | G | A | D | A',
      comp: '0.2.3.2.0.2.3.2.|1.2.3.2.1.2.3.4.',
      kick: 'x.....x.x.....x.|x.....x.x...x...',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.o.',
      perc: 'x.gxx.gxx.gxx.gx',
    },
  },
};

/** Glut: drängend in d-Moll, galoppierender tiefer Bass, Trommelwirbel zum Abschnittsende. */
const GLUT: SongDef = {
  bpm: 148,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'sawtooth', cutoff: 2000, gain: 0.15, detune: 10, vibrato: 8, send: 0.24, gate: 0.84 },
  bass: { wave: 'sawtooth', cutoff: 330, pluck: 900, q: 3, gain: 0.38, gate: 0.62 },
  comp: { wave: 'pulse25', cutoff: 1700, gain: 0.075, gate: 0.5, send: 0.15, low: 53, pan: 0.2 },
  drums: { kick: 0.72, snare: 0.3, hat: 0.06, perc: 'tom', percGain: 0.4 },
  order: 'AB',
  sections: {
    A: {
      bars: 8,
      melody: `d5:3 d5:3 f5 e5:3 d5:3 a4 | d5:3 d5:3 f5 a5:4 g5 f5
             | d5:3 d5:3 f5 g5:3 f5:3 d5 | e5:3 e5:3 g5 c6:4 bb5 g5
             | a5:3 a5:3 f5 d5:3 f5:3 a5 | d6:6 c6 a5:4 f5 a5
             | bb5:3 a5:3 f5 d5:3 f5:3 bb5 | a5:4 e5 c#5:4 e5 a5 c#6`,
      bass: `d2 d2:1 d2:1 d2 d2:1 d2:1 d2 d2:1 d2:1 d3 c3 | d2 d2:1 d2:1 d2 d2:1 d2:1 d2 d2:1 d2:1 d3 a2
           | bb1 bb1:1 bb1:1 bb1 bb1:1 bb1:1 bb1 bb1:1 bb1:1 bb2 a2 | c2 c2:1 c2:1 c2 c2:1 c2:1 c2 c2:1 c2:1 c3 e2
           | d2 d2:1 d2:1 d2 d2:1 d2:1 d2 d2:1 d2:1 d3 c3 | d2 d2:1 d2:1 d2 d2:1 d2:1 d2 d2:1 d2:1 d3 a2
           | bb1 bb1:1 bb1:1 bb1 bb1:1 bb1:1 bb1 bb1:1 bb1:1 bb2 f2 | a1 a1:1 a1:1 a1 a1:1 a1:1 a1 a1:1 a1:1 a2 c#3`,
      chords: 'Dm | Dm | Bb | C | Dm | Dm | Bb | A',
      comp: 'x..x..x...x..x..',
      kick: 'x...x...x...x..x|x...x...x...x.x.',
      snare: '....x.......x...|....x.......x..x',
      hat: 'x.xgx.xgx.xgx.xg',
      perc: '................|................|................|..........x.x.xx',
    },
    B: {
      bars: 8,
      melody: `d6:6 bb5 g5:6 bb5 | a5:6 f5 d5:6 f5
             | f5:3 g5:3 a5 bb5:4 d6:4 | c#6:6 a5 e5:4 a5 c#6
             | d6:6 bb5 g5:4 bb5 d6 | f6:6 d6 a5:6 d6
             | eb6:3 d6:3 bb5 g5:3 bb5:3 eb5 | e5:3 a5:3 c#6 e6:4 c#6 a5`,
      bass: `g2 g2:1 g2:1 g2 g2:1 g2:1 g2 g2:1 g2:1 d2 f2 | d2 d2:1 d2:1 d2 d2:1 d2:1 d2 d2:1 d2:1 d3 c3
           | bb1 bb1:1 bb1:1 bb1 bb1:1 bb1:1 bb1 bb1:1 bb1:1 bb2 f2 | a1 a1:1 a1:1 a1 a1:1 a1:1 a1 a1:1 a1:1 a2 e2
           | g2 g2:1 g2:1 g2 g2:1 g2:1 g2 g2:1 g2:1 d2 f2 | d2 d2:1 d2:1 d2 d2:1 d2:1 d2 d2:1 d2:1 d3 c3
           | eb2 eb2:1 eb2:1 eb2 eb2:1 eb2:1 eb2 eb2:1 eb2:1 bb1 eb2 | a1 a1:1 a1:1 a1 a1:1 a1:1 a1 a1:1 a1:1 a2 c#3`,
      chords: 'Gm | Dm | Bb | A | Gm | Dm | Eb | A',
      comp: '0.1.2.3.2.1.2.3.',
      kick: 'x.....x.x...x...|x.....x.x...x.x.',
      snare: '....x.......x...',
      hat: 'xgxgxgxgxgxgxgxg',
      perc: '................|............x.xx',
    },
  },
};

/** Nacht: elektronisch in f-Moll, Bassdrum auf allen Vieren, Stimmen im 3-3-2-Raster dagegen. */
const NACHT: SongDef = {
  bpm: 128,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'square', cutoff: 1900, gain: 0.15, detune: 9, vibrato: 6, send: 0.4, gate: 0.82 },
  bass: { wave: 'pulse25', cutoff: 360, pluck: 1900, q: 5, gain: 0.36, gate: 0.55 },
  comp: { wave: 'pulse12', cutoff: 2600, gain: 0.1, gate: 0.42, send: 0.45, low: 56, pan: -0.25 },
  drums: { kick: 0.74, snare: 0.22, hat: 0.07, perc: 'clap', percGain: 0.2 },
  order: 'AB',
  sections: {
    A: {
      bars: 8,
      melody: `- c5:3 eb5:3 f5:4 - eb5 | c5:3 ab4:3 bb4:6 -:4
             | - c5:3 eb5:3 f5:4 - ab5 | g5:3 eb5:3 bb4:6 -:4
             | - c5:3 eb5:3 f5:4 - g5 | ab5:3 g5:3 eb5:3 c5:3 eb5:4
             | f5:3 ab5:3 c6:6 - bb5 | g5:3 e5:3 c5:3 e5:3 g5:4`,
      bass: `f2:3 f2:3 f3 -:1 f2 eb3:1 f3 c3 | f2:3 f2:3 f3 -:1 f2 eb3:1 f3 c3
           | db2:3 db2:3 db3 -:1 db2 c3:1 db3 ab2 | eb2:3 eb2:3 eb3 -:1 eb2 db3:1 eb3 bb2
           | f2:3 f2:3 f3 -:1 f2 eb3:1 f3 c3 | f2:3 f2:3 f3 -:1 f2 eb3:1 f3 c3
           | db2:3 db2:3 db3 -:1 db2 c3:1 db3 ab2 | c2:3 c2:3 c3 -:1 c2 bb2:1 c3 e2`,
      chords: 'Fm9 | Fm9 | Dbmaj7 | Eb | Fm9 | Fm9 | Dbmaj7 | C7',
      comp: '0..1..2.0..1..3.',
      kick: 'x...x...x...x...',
      snare: '....x.......x...',
      hat: '..o.g.o...o.g.o.',
      perc: '....x.......x...|....x.......x.x.',
    },
    B: {
      bars: 8,
      melody: `f5:6 db5 bb4:3 db5:3 f5 | g5:6 eb5 db5:3 eb5:3 g5
             | c6:3 bb5:3 ab5 eb5:3 ab5:3 c6 | ab5:6 f5 c5:6 -
             | f5:6 db5 bb4:3 db5:3 f5 | g5:6 bb5 db6:3 bb5:3 g5
             | ab5:3 f5:3 c5 f5:3 ab5:3 c6 | bb5:3 g5:3 e5 c5:4 - c5:1 e5:1`,
      bass: `bb1:3 bb1:3 bb2 -:1 bb1 ab2:1 bb2 f2 | eb2:3 eb2:3 eb3 -:1 eb2 db3:1 eb3 bb2
           | ab2:3 ab2:3 ab3 -:1 ab2 g3:1 ab3 eb3 | db2:3 db2:3 db3 -:1 db2 c3:1 db3 ab2
           | bb1:3 bb1:3 bb2 -:1 bb1 ab2:1 bb2 f2 | eb2:3 eb2:3 eb3 -:1 eb2 db3:1 eb3 bb2
           | f2:3 f2:3 f3 -:1 f2 eb3:1 f3 c3 | c2:3 c2:3 c3 -:1 c2 bb2:1 c3 e2`,
      chords: 'Bbm7 | Eb7 | Abmaj7 | Dbmaj7 | Bbm7 | Eb7 | Fm | C7',
      comp: 'x..x..x...x..x..',
      kick: 'x...x...x...x...|x...x...x...x.x.',
      snare: '....x.......x...',
      hat: 'x.o.x.o.x.o.x.o.',
      perc: '....x.......x...',
    },
  },
};

/** Ergebnis: zufrieden und gemütlich in C-Dur, endet aufgelöst und läuft rund weiter. */
const RESULTS: SongDef = {
  bpm: 96,
  swing: 0.18,
  race: false,
  level: 1,
  lead: { wave: 'triangle', cutoff: 3200, gain: 0.3, detune: 6, vibrato: 8, send: 0.3, gate: 0.88 },
  bass: { wave: 'triangle', cutoff: 700, pluck: 400, q: 1, gain: 0.5, gate: 0.85 },
  comp: { wave: 'pulse25', cutoff: 1500, gain: 0.075, gate: 0.5, send: 0.3, low: 55, pan: 0.25 },
  drums: { kick: 0.6, snare: 0.22, hat: 0.06, perc: 'shaker', percGain: 0.07 },
  order: 'AB',
  sections: {
    A: {
      bars: 8,
      melody: `e5:4 g5 c6:6 a5 g5 | e5:4 g5 a5:6 g5 e5
             | f5:4 a5 c6:4 a5 f5 a5 | g5:6 d5 b4:4 d5 g5
             | e5:4 g5 c6:6 d6 c6 | e6:4 c6 a5:6 g5 e5
             | f5:3 a5:3 d6 c6:3 a5:3 f5 | g5:8 b5:4 d6:4`,
      bass: `c3:6 g2 c3:4 e3 g2 | a2:6 e2 a2:4 c3 e3
           | f2:6 c3 f2:4 a2 c3 | g2:6 d3 g2:4 b2 d3
           | c3:6 g2 c3:4 e3 g2 | a2:6 e2 a2:4 c3 e3
           | d3:6 a2 d3:4 f3 a2 | g2:6 d3 g2:4 a2 b2`,
      chords: 'C | Am7 | Fmaj7 | G | C | Am7 | Dm7 | G',
      comp: '....x.....x.x...',
      kick: 'x.....x.x.......|x.....x.x.....x.',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.o.',
      perc: '..g...g...g...g.',
    },
    B: {
      bars: 8,
      melody: `c6:3 a5:3 f5 a5:4 c6 a5 | b5:3 g5:3 d5 g5:4 b5 d6
             | g5:3 e5:3 b4 e5:4 g5 b5 | a5:6 e5 c5:6 -
             | c6:3 a5:3 f5 a5:4 c6 d6 | d6:3 b5:3 g5 b5:4 d6 b5
             | c6:6 g5 e5:4 g5 c6 | e6:4 c6 g5 c6:6 -`,
      bass: `f2:6 c3 f2:4 a2 c3 | g2:6 d3 g2:4 b2 d3
           | e2:6 b2 e2:4 g2 b2 | a2:6 e3 a2:4 g2 e2
           | f2:6 c3 f2:4 a2 c3 | g2:6 d3 g2:4 b2 d3
           | c3:6 g2 c3:4 e3 g2 | c3:6 g2 c3:4 g2 b2`,
      chords: 'F | G | Em7 | Am7 | F | G | C | C',
      comp: 'x.....x...x.....',
      kick: 'x.....x...x.....',
      snare: '....x.......x..g',
      hat: 'x.xgx.xgx.xgx.o.',
      perc: '..g...g...g...g.',
    },
  },
};

export const SONGS: Record<MusicId, SongDef> = {
  menu: MENU,
  werkshof: WERKSHOF,
  klippe: KLIPPE,
  glut: GLUT,
  nacht: NACHT,
  // Die Stücke der neueren Welten stehen in songs-neu.ts; eingebunden wird jedes mit seiner Welt.
  wolken: NEUE_STUECKE.wolken,
  riff: NEUE_STUECKE.riff,
  results: RESULTS,
};

// ---------------------------------------------------------------------------
// Übersetzer
// ---------------------------------------------------------------------------

const STEPS_PER_BAR = 16;

const PITCH: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** Akkordtöne als Halbtonabstände zum Grundton. Bei Nonenakkorden fällt der Grundton weg (den spielt der Bass). */
const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  '9': [4, 7, 10, 14],
  m9: [3, 7, 10, 14],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
};

function splitBars(src: string): string[] {
  return src
    .split('|')
    .map((bar) => bar.trim())
    .filter((bar) => bar.length > 0);
}

function noteNumber(name: string, where: string): number {
  const m = /^([a-g])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`${where}: unbekannter Ton "${name}"`);
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + PITCH[m[1]] + accidental;
}

/** Einstimmige Linie (Melodie oder Bass) über `bars` Takte. */
function compileLine(src: string, bars: number, where: string): (NoteEvent | null)[] {
  const out: (NoteEvent | null)[] = new Array<NoteEvent | null>(bars * STEPS_PER_BAR).fill(null);
  const barSrc = splitBars(src);
  let last: NoteEvent | null = null;
  for (let bar = 0; bar < bars; bar++) {
    const tokens = barSrc[bar % barSrc.length].split(/\s+/);
    let pos = 0;
    for (const token of tokens) {
      const [name, lenText] = token.split(':');
      const len = lenText === undefined ? 2 : Number(lenText);
      if (!Number.isInteger(len) || len < 1) throw new Error(`${where}, Takt ${bar + 1}: Länge in "${token}"`);
      if (name === '~') {
        if (last) last.steps += len;
      } else if (name === '-') {
        last = null;
      } else {
        last = { midi: noteNumber(name, `${where}, Takt ${bar + 1}`), steps: len };
        if (pos < STEPS_PER_BAR) out[bar * STEPS_PER_BAR + pos] = last;
      }
      pos += len;
    }
    if (pos !== STEPS_PER_BAR) {
      throw new Error(`${where}, Takt ${bar + 1}: ${pos} statt ${STEPS_PER_BAR} Schritte`);
    }
  }
  return out;
}

/** Akkordsymbol → Töne in enger Lage ab `low`, aufsteigend sortiert. */
function chordNotes(symbol: string, low: number, where: string): number[] {
  const m = /^([A-G])([#b]?)(.*)$/.exec(symbol);
  const intervals = m ? QUALITY[m[3]] : undefined;
  if (!m || !intervals) throw new Error(`${where}: unbekannter Akkord "${symbol}"`);
  const root = PITCH[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return intervals
    .map((iv) => {
      const pc = (((root + iv - low) % 12) + 12) % 12;
      return low + pc;
    })
    .sort((a, b) => a - b);
}

/** Akkordfolge → je Schritt die gerade gültigen Akkordtöne. */
function compileChords(src: string, bars: number, low: number, where: string): number[][] {
  const out: number[][] = [];
  const barSrc = splitBars(src);
  for (let bar = 0; bar < bars; bar++) {
    const symbols = barSrc[bar % barSrc.length].split(/\s+/);
    if (STEPS_PER_BAR % symbols.length !== 0) throw new Error(`${where}, Takt ${bar + 1}: Akkorde nicht teilbar`);
    const each = STEPS_PER_BAR / symbols.length;
    for (const symbol of symbols) {
      const notes = chordNotes(symbol, low, `${where}, Takt ${bar + 1}`);
      for (let i = 0; i < each; i++) out.push(notes);
    }
  }
  return out;
}

/** Zeichenmuster (16 Zeichen je Takt) über `bars` Takte ausrollen. */
function compilePattern(src: string, bars: number, where: string): string {
  const barSrc = splitBars(src.replace(/\s+/g, ''));
  let out = '';
  for (let bar = 0; bar < bars; bar++) {
    const pattern = barSrc[bar % barSrc.length];
    if (pattern.length !== STEPS_PER_BAR) throw new Error(`${where}, Takt ${bar + 1}: ${pattern.length} Zeichen`);
    out += pattern;
  }
  return out;
}

function compileComp(pattern: string, chords: number[][]): (CompEvent | null)[] {
  const out: (CompEvent | null)[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    const notes = chords[i];
    // Länge: bis zum nächsten Zeichen, höchstens bis zum Taktende.
    let steps = 1;
    while ((i + steps) % STEPS_PER_BAR !== 0 && '.-'.includes(pattern[i + steps])) steps++;
    if (ch === 'x' || ch === 'X' || ch === 'o') {
      out.push({ midis: notes, steps: ch === 'o' ? steps : Math.min(steps, 2), vel: ch === 'X' ? 1.2 : ch === 'o' ? 0.8 : 1 });
    } else if (ch >= '0' && ch <= '9') {
      const idx = Number(ch);
      const midi = notes[idx % notes.length] + 12 * Math.floor(idx / notes.length);
      out.push({ midis: [midi], steps: Math.min(steps, 3), vel: 1 });
    } else {
      out.push(null);
    }
  }
  return out;
}

function compileDrum(pattern: string, isHat: boolean): number[] {
  const out: number[] = [];
  for (const ch of pattern) {
    if (ch === 'x') out.push(1);
    else if (ch === 'X') out.push(1.25);
    else if (ch === 'g') out.push(0.4);
    else if (ch === 'o') out.push(isHat ? -1 : 0.7);
    else out.push(0);
  }
  return out;
}

/** Übersetzt ein Stück. Wirft bei Schreibfehlern in den Daten einen Fehler mit Fundstelle. */
export function compileSong(def: SongDef, name = 'Stück'): Song {
  const song: Song = { def, steps: 0, lead: [], bass: [], comp: [], kick: [], snare: [], hat: [], perc: [] };
  for (const key of def.order) {
    const sec = def.sections[key];
    if (!sec) throw new Error(`${name}: Abschnitt "${key}" fehlt`);
    const where = `${name}/${key}`;
    const chords = compileChords(sec.chords, sec.bars, def.comp.low, `${where} Akkorde`);
    song.lead.push(...compileLine(sec.melody, sec.bars, `${where} Melodie`));
    song.bass.push(...compileLine(sec.bass, sec.bars, `${where} Bass`));
    song.comp.push(...compileComp(compilePattern(sec.comp, sec.bars, `${where} Begleitung`), chords));
    song.kick.push(...compileDrum(compilePattern(sec.kick, sec.bars, `${where} Kick`), false));
    song.snare.push(...compileDrum(compilePattern(sec.snare, sec.bars, `${where} Snare`), false));
    song.hat.push(...compileDrum(compilePattern(sec.hat, sec.bars, `${where} Hi-Hat`), true));
    song.perc.push(...compileDrum(compilePattern(sec.perc ?? '................', sec.bars, `${where} Percussion`), false));
    song.steps += sec.bars * STEPS_PER_BAR;
  }
  return song;
}

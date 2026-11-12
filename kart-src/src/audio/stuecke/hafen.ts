// Rennstück für den Sturmhafen. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'hafen' ein.
import type { SongDef } from '../songs';

/**
 * Sturmhafen: c-Moll, 134 BPM, gerade. Rau und vorwärtsdrängend: Die Bassdrum stampft
 * mit einem Doppelschlag vor der Drei („x...x..xx...x..."), der Bass läuft darunter wie
 * eine Schiffsmaschine in der Figur 3-1-2-1-1-2-3-1-2 (Grundton, Quinte, kleine Septime,
 * Oktave), metallisches Klirren der Ketten auf den Zählzeiten zwischen den Schlägen.
 * A: die Leitstimme, ein musettehaft schwebender Sägezahn, singt in kurzen Bögen über
 * Cm – Fm – G7. B: Arbeitslied – oben ruft die Stimme (Ab, Eb, Fm), unten antwortet sie,
 * „Hau-ruck"-Auftakte mit betonter Snare. C: der Himmel reißt auf – Es-Dur, halbes Tempo
 * im Schlagzeug, lange Töne über gehaltenen Akkorden; im letzten Takt läuft die Maschine
 * auf G7 wieder an, und es geht von vorn los.
 */
export const HAFEN_STUECK: SongDef = {
  bpm: 134,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'sawtooth', cutoff: 1800, gain: 0.17, detune: 14, vibrato: 5, send: 0.26, gate: 0.85 },
  bass: { wave: 'square', cutoff: 300, pluck: 1200, q: 3.5, gain: 0.26, gate: 0.7 },
  comp: { wave: 'pulse25', cutoff: 1800, gain: 0.08, gate: 0.45, send: 0.2, low: 55, pan: -0.25 },
  drums: { kick: 0.68, snare: 0.3, hat: 0.065, perc: 'clank', percGain: 0.1 },
  order: 'ABC',
  sections: {
    A: {
      bars: 8,
      melody: `c5:3 eb5:1 g5:4 f5 eb5 d5 eb5 | c5:4 - bb4 c5 d5 f5:4
             | ab5:3 g5:1 f5:4 c5 f5 ab5 g5 | g5:6 f5 d5 b4 d5:4
             | c5:3 eb5:1 g5:4 c6 bb5 g5 eb5 | f5:4 - eb5 d5 bb4 d5:4
             | c5:3 f5:1 ab5:4 c6:3 bb5:1 ab5:4 | g5:4 b4 d5 f5 d5 b4:4`,
      bass: `c2:3 c2:1 g2 c2:1 c2:1 bb2 c2:3 c3:1 g2 | c2:3 c2:1 g2 c2:1 c2:1 bb1:3 bb1:1 f2 bb1
           | f2:3 f2:1 c3 f2:1 f2:1 eb3 f2:3 f3:1 c3 | g2:3 g2:1 d3 g2:1 g2:1 f3 g2:3 g3:1 d3
           | c2:3 c2:1 g2 c2:1 c2:1 bb2 c2:3 c3:1 g2 | eb2:3 eb2:1 bb2 eb2:1 eb2:1 bb1:3 bb1:1 f2 bb1
           | f2:3 f2:1 c3 f2:1 f2:1 ab2:3 ab2:1 eb3 ab2 | g2:3 g2:1 d3 g2:1 g2:1 f3 d3 g2 b2`,
      chords: 'Cm | Cm Bb | Fm | G7 | Cm | Eb Bb | Fm Ab | G7',
      comp: '..X...x...X...x.|..X...x...X.x.x.',
      kick: 'x...x..xx...x...|x...x..xx...x.x.',
      snare: '....x.......x...|....x.......x..g',
      hat: 'x.x.xgx.x.x.xgx.|x.x.xgx.x.x.xgo.',
      perc: '...x......x...x.|...x......x..x.x',
    },
    B: {
      bars: 8,
      melody: `eb6 c6 ab5:3 c6:1 eb6:4 - c6 | bb5 g5 eb5:4 - g4 bb4 eb5
             | c6 ab5 f5:3 ab5:1 c6:4 - ab5 | g5:3 eb5:1 c5:6 - g5 g5
             | ab5 c6 eb6:3 c6:1 ab5:4 - c6 | bb5 eb6 f6:4 eb6 d6 bb5 g5
             | ab5:3 g5:1 f5 c5 d5:3 f5:1 b5:4 | c6:6 g5 eb5 d5 c5:4`,
      bass: `ab2:4 eb3 ab2 ab2:3 ab2:1 eb3 ab3 | eb2:4 bb2 eb2 eb2:3 eb2:1 bb2 eb3
           | f2:4 c3 f2 f2:3 f2:1 c3 f3 | c2:4 g2 c2 c2:3 c2:1 g2 c3
           | ab2:4 eb3 ab2 ab2:3 ab2:1 eb3 ab3 | eb2:4 bb2 eb2 eb2:3 eb2:1 bb2 eb3
           | f2:4 c3 f2 g2:4 d3 b2 | c2:4 g2 c2 c2:3 c2:1 eb2 g2`,
      chords: 'Ab | Eb | Fm | Cm | Ab | Eb | Fm G7 | Cm',
      comp: 'x.2.1.2.x.2.1.3.',
      kick: 'x.....xxx.....x.|x.....xxx...x.x.',
      snare: '....X.......X...|....X.......X.gg',
      hat: 'xgx.xgx.xgx.xgx.',
      perc: '..x...x...x...x.',
    },
    C: {
      bars: 8,
      melody: `g5:8 bb5:4 eb6:4 | d6:8 c6:4 bb5:4
             | c6:6 ab5 eb5:4 f5:4 | g5:12 -:4
             | ab5:8 c6:4 f6:4 | eb6:6 d6 bb5:4 f5:4
             | c6:4 bb5:4 ab5:4 c6:4 | b5:6 g5 d5:4 b4:4`,
      bass: `eb2:8 bb2:6 eb2 | bb1:8 f2:6 bb1
           | ab2:8 eb2:6 ab2 | eb2:8 g2:4 bb2:4
           | f2:8 c3:6 f2 | bb1:8 d2:4 f2:4
           | ab2:8 eb3:4 c3:4 | g2:4 g2 g2 g2:1 g2:1 g2:1 g2:1 b2 d3`,
      chords: 'Eb | Bb | Ab | Eb | Fm7 | Bb | Ab | G7',
      comp: 'o.......o...1.2.|o.......o...2.1.',
      kick: 'x.........x.....|x.......x.....x.',
      snare: `........x.......|........x.......|........x.......|........x.....g.
            | ........x.......|........x.......|........x.......|....x.x.x.xxXXXX`,
      hat: 'x...o...x...o...',
      perc: '................|..........x.....',
    },
  },
};

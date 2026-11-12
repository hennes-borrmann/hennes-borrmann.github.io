// Rennstück für den Wüstenexpress. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'wueste' ein.
import type { SongDef } from '../songs';

/**
 * Wüstenexpress: A-mixolydisch (A-Dur mit kleiner Septime g), 136 BPM, ganz leicht
 * geschoben. Unter allem rollt der Zug: Der Bass stampft wie Kolben in Gruppen aus
 * „kurz-kurz-lang“ (zwei Sechzehntel, ein Achtel – Grundton, Grundton, Quinte bzw. Oktave),
 * die Hi-Hat schnauft „tsch-ke-ke ·“ je Viertel, und das Klirren im Schlagzeug ist der
 * Schienenstoß – ein leises „ta“ und ein lautes „tack“ kurz vor der Drei und vor der Eins.
 * Darüber pfeift die Leitstimme (Sinus mit weitem Vibrato und Echo) in weiten Sprüngen –
 * Quarte, Quinte, Sexte, Oktave –, aus denen sie stufenweise zurückfällt.
 * A: die Fahrt (A – Em7 – G – D – F#m – D – Bm7 – E7), die Melodie springt auf und
 * kehrt um. B: der Zug bremst, die Landschaft wird weit – halbes Tempo im Schlagzeug,
 * liegende Töne über gehaltenen Akkorden (Gmaj7 – D – A – Esus4 – E7), nur ab und zu ein
 * ferner Schienenstoß; im letzten Takt stampft der Bass schon wieder an. C: Der Zug
 * nimmt Fahrt auf – Rufe mit Pausen werden zu Läufen, Hi-Hat und Bassdrum dichter, die
 * Schienenstöße rücken von einem je Takt auf vier je Takt zusammen; ein Trommelwirbel
 * auf E7 führt zurück an den Anfang.
 */
export const WUESTE_STUECK: SongDef = {
  bpm: 136,
  swing: 0.08,
  race: true,
  level: 1,
  lead: { wave: 'sine', cutoff: 3000, gain: 0.19, detune: 5, vibrato: 14, send: 0.36, gate: 0.9 },
  bass: { wave: 'sawtooth', cutoff: 380, pluck: 1100, q: 2.6, gain: 0.32, gate: 0.6 },
  comp: { wave: 'pulse25', cutoff: 2000, gain: 0.08, gate: 0.45, send: 0.22, low: 57, pan: 0.25 },
  drums: { kick: 0.68, snare: 0.27, hat: 0.07, perc: 'clank', percGain: 0.1 },
  order: 'ABC',
  sections: {
    A: {
      bars: 8,
      melody: `e5 a5 e6:6 c#6 a5:4 | b5:6 g5 d5:4 e5:4
             | d5 g5 b5:4 d6:4 c#6 b5 | a5:8 f#5 e5 d5:4
             | c#5 f#5 c#6:6 a5 f#5:4 | a5:4 f#5 d6:6 - a5
             | b5:3 a5:1 f#5 d5 a5:4 g5:4 | g#5:4 b5 d6 e6:6 -`,
      bass: `a1:1 a1:1 e2 a1:1 a1:1 a2 a1:1 a1:1 e2 c#2:1 d2:1 d#2
           | e2:1 e2:1 b2 e2:1 e2:1 e3 e2:1 e2:1 b2 d3:1 b2:1 a2
           | g2:1 g2:1 d3 g2:1 g2:1 g3 g2:1 g2:1 d3 b2:1 a2:1 f#2
           | d2:1 d2:1 a2 d2:1 d2:1 d3 d2:1 d2:1 a2 a2:1 g2:1 e2
           | f#2:1 f#2:1 c#3 f#2:1 f#2:1 f#3 f#2:1 f#2:1 c#3 a2:1 g#2:1 e2
           | d2:1 d2:1 a2 d2:1 d2:1 d3 d2:1 d2:1 a2 d2:1 c#2:1 b1
           | b1:1 b1:1 f#2 b1:1 b1:1 b2 b1:1 b1:1 f#2 a2:1 f#2:1 d#2
           | e2:1 e2:1 b2 e2:1 e2:1 e3 e2:1 e2:1 d3 b2:1 g#2:1 e2`,
      chords: 'A | Em7 | G | D | F#m | D | Bm7 | E7',
      comp: '..x...x...x...x.|..x...x...x.x.x.',
      kick: 'x.......x..x....|x.......x..x..x.',
      snare: '....x.......x...|....x.......x..g',
      hat: 'xgg.xgg.xgg.xgg.|xgg.xgg.xgg.xgo.',
      perc: '......gx......gx',
    },
    B: {
      bars: 8,
      melody: `d6:12 b5:4 | a5:8 f#5:4 d5:4
             | e5:16 | ~:10 -:2 c#5 e5
             | f#5:12 g5 a5 | b5:8 a5:4 f#5:4
             | e5:12 a5:4 | g#5:8 b5:4 d6:4`,
      bass: `g2:12 d3:4 | d2:12 a2:4
           | a1:12 e2:4 | a1:8 e2:4 c#2:4
           | g2:12 d3:4 | d2:8 f#2:4 a2:4
           | e2:12 b2:4 | e2:4 e2 e2 e2:1 e2:1 e2:1 e2:1 b2:1 d3:1 e3`,
      chords: 'Gmaj7 | D | A | A | Gmaj7 | D | Esus4 | E7',
      comp: 'o.......0...2...|o.......1...3...',
      kick: 'x...............|x.........x.....',
      snare: '........x.......|........x.......|........x.......|........x.......|........x.......|........x.......|........x.......|....x.......x.gg',
      hat: '..x...x...x...x.',
      perc: '................|..............gx',
    },
    C: {
      bars: 8,
      melody: `a5 - e5 - a5 c#6 -:4 | b5 - d5 - g5 b5 -:4
             | f#5 a5 d6:4 b5 f#5 a5:4 | f#5 d5 a4:4 d5 f#5 a5:4
             | c#6 a5:1 e5:1 c#5 e5 a5 c#6 e6:4 | d6 b5:1 g5:1 d5 g5 b5 d6 b5:4
             | c#6:3 a5:1 f#5 c#5 e5 f#5 a5:4 | g#5 b5 d6 e6 d6 b5 g#5 e5`,
      bass: `a1 - e2 - a1:1 a1:1 e2 a1:1 a1:1 c#2 | g2 - d3 - g2:1 g2:1 d3 g2:1 g2:1 b2
           | b1:1 b1:1 f#2 b1:1 b1:1 b2 b1:1 b1:1 f#2 a2:1 b2:1 c#3
           | d2:1 d2:1 a2 d2:1 d2:1 d3 d2:1 d2:1 a2 f#2:1 e2:1 c#2
           | a1:1 a1:1 e2 a1:1 a1:1 a2 a1:1 a1:1 e2 c#2:1 e2:1 f#2
           | g2:1 g2:1 d3 g2:1 g2:1 g3 g2:1 g2:1 d3 b2:1 a2:1 g#2
           | f#2:1 f#2:1 c#3 f#2:1 f#2:1 f#3 f#2:1 f#2:1 c#3 a2:1 f#2:1 d#2
           | e2:1 e2:1 b2 e2:1 e2:1 e3 e2:1 e2:1 b2 d3:1 e3:1 g#2`,
      chords: 'A | G | Bm7 | D | A | G | F#m | E7',
      comp: '1.0.2..x1.0.2..x',
      kick: 'x.......x.......|x.......x.......|x.......x..x....|x.......x..x....|x...x...x..x....|x...x...x..x..x.|x...x...x...x...|x.x.x.x.x.x.x.x.',
      snare: '........x.......|........x.......|....x.......x...|....x.......x...|....x.......x...|....x.......x..g|....x.......x.g.|....x...x.x.xxXX',
      hat: 'x...x...x...x...|x...x...x...x...|x.g.x.g.x.g.x.g.|x.g.x.g.x.g.x.g.|xgg.xgg.xgg.xgg.|xgg.xgg.xgg.xgg.|xgg.xgg.xgg.xgg.|xgg.xgg.xggxxggx',
      perc: '..............gx|..............gx|......gx......gx|......gx......gx|......gx..gx..gx|......gx..gx..gx|..gx..gx..gx..gx|..gx..gx..gx..gx',
    },
  },
};

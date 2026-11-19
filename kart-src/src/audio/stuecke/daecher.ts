// Rennstück für die Dächerjagd. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'daecher' ein.
import type { SongDef } from '../songs';

/**
 * Dächerjagd: D-Dur, 140 BPM, eine Spur geschwungen – ein Festtag in der Altstadt, die Jagd über die Dächer als
 * Stadtfest-Galopp. Klangbild einer Festkapelle auf dem Marktplatz: Die Leitstimme ist ein Akkordeon (Sägezahn mit zwei
 * gegeneinander verstimmten Zungen, wenig Vibrato), die Begleitung schlägt wie ein Glockenspiel helle Akkordtöne an, der
 * Bass bläst wie eine Tuba auf Eins und Drei, die kleine Trommel marschiert, und dazwischen klatscht das Publikum.
 * A: durch die Gassen – ein springendes Motiv, das den D-Dur-Dreiklang hinaufläuft und auf der Sexte kurz hängen bleibt,
 *    über D – A – Hm – G – D – A – G – A; Tuba im Umtata, Glockenspiel auf den Nachschlägen.
 * B: über die Dächer und durch den Kirchturm – lange Bögen, das Glockenspiel läuft in Arpeggien hinauf wie ein Geläut,
 *    das Schlagzeug im halben Tempo; G – D – Em – C – G – D – C – A.
 * A noch einmal (die Treppengasse hinunter), dann C: Gleitflug und Kanal – Sechzehntelläufe in h-Moll, die Tuba treibt
 *    in Doppelstößen, Händeklatschen auf Zwei und Vier, ein A7 am Ende führt zurück in die Gassen. Abfolge A B A C.
 */
export const DAECHER_STUECK: SongDef = {
  bpm: 140,
  swing: 0.1,
  race: true,
  level: 1,
  lead: { wave: 'sawtooth', cutoff: 2300, gain: 0.14, detune: 11, vibrato: 8, send: 0.26, gate: 0.86 },
  bass: { wave: 'square', cutoff: 560, pluck: 420, q: 1.3, gain: 0.38, gate: 0.55 },
  comp: { wave: 'triangle', cutoff: 4200, gain: 0.1, gate: 0.32, send: 0.3, low: 62, pan: 0.2 },
  drums: { kick: 0.62, snare: 0.3, hat: 0.06, perc: 'clap', percGain: 0.12 },
  order: 'ABAC',
  sections: {
    A: {
      bars: 8,
      melody: `d5:2 f#5:2 a5:3 f#5:1 g5:2 f#5:2 e5:4
             | c#5:2 e5:2 a5:4 g5:2 f#5:2 e5:4
             | d5:2 f#5:2 b5:3 a5:1 f#5:2 d5:2 b4:4
             | g4:2 b4:2 d5:2 g5:2 f#5:2 e5:2 d5:4
             | a5:3 f#5:1 a5:2 d6:2 c#6:2 b5:2 a5:4
             | e5:2 a5:2 c#6:4 b5:2 a5:2 g5:4
             | f#5:2 g5:2 b5:3 a5:1 g5:2 e5:2 c#5:4
             | e5:2 f#5:2 g5:2 a5:2 -:4 a4:4`,
      bass: `d2 a2 d3 a2 d2 a2 f#2 a2
           | a1 e2 a2 e2 a1 e2 c#2 e2
           | b1 f#2 b2 f#2 b1 f#2 d2 f#2
           | g2 d2 b2 d2 g2 d2 b1 d2
           | d2 a2 d3 a2 f#2 a2 d2 a2
           | a1 e2 a2 e2 c#2 e2 a1 e2
           | g2 d2 b2 d2 b1 d2 g2 d2
           | a1 e2 a2 e2 a1:4 e2:2 c#2:2`,
      chords: 'D | A | Bm | G | D | A | G | A',
      comp: '..x...x...x...x.|..x...x...x.2.4.',
      kick: 'x.......x.......|x.......x...x...',
      snare: '....x.......x.x.|....x.......x.xx',
      hat: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.xo',
      perc: '....x.......x...',
    },
    B: {
      bars: 8,
      melody: `b4:4 d5:4 g5:6 a5:2
             | f#5:4 a5:4 d5:8
             | e5:2 g5:2 b5:4 a5:4 g5:4
             | e5:6 g5:2 c5:8
             | d5:2 g5:2 b5:4 d6:6 c6:2
             | b5:4 a5:2 f#5:2 a5:8
             | g5:4 e5:4 c6:4 b5:4
             | a5:8 c#6:4 e5:4`,
      bass: `g2:8 d2:8
           | d2:8 a1:8
           | e2:8 b1:8
           | c2:8 g2:8
           | g2:8 b1:8
           | d2:8 f#2:8
           | c2:8 e2:8
           | a1:8 c#2:8`,
      chords: 'G | D | Em | C | G | D | C | A',
      comp: '0.1.2.3.4.3.2.1.',
      kick: 'x.......x.......',
      snare: '........x.......|........x.....g.',
      hat: '..o...o...o...o.',
      perc: '................|............x...',
    },
    C: {
      bars: 8,
      melody: `f#5:1 a5:1 b5:2 a5:2 f#5:2 d5:2 f#5:2 b5:4
             | g5:1 b5:1 d6:2 b5:2 g5:2 d5:2 g5:2 b5:4
             | a5:2 f#5:2 d5:2 f#5:2 a5:2 d6:2 c#6:2 a5:2
             | e5:4 a5:4 c#6:4 a5:4
             | b5:3 a5:1 b5:2 d6:2 f#5:4 d5:4
             | g5:3 f#5:1 g5:2 b5:2 d5:4 b4:4
             | e5:2 g5:2 b5:2 e6:2 d6:2 b5:2 g5:2 e5:2
             | a5:4 c#6:4 e6:4 g5:4`,
      bass: `b1:2 b2:1 b2:1 f#2:2 b2:2 a2:2 f#2:2 d2:2 b1:2
           | g2:2 g2:1 g2:1 d2:2 g2:2 b2:2 g2:2 d2:2 b1:2
           | d2:2 d3:1 d3:1 a2:2 d3:2 f#2:2 a2:2 d2:2 a1:2
           | a1:2 a2:1 a2:1 e2:2 a2:2 c#2:2 e2:2 a1:2 e2:2
           | b1:2 b2:1 b2:1 f#2:2 b2:2 d2:2 f#2:2 b1:2 d2:2
           | g2:2 g2:1 g2:1 d2:2 b2:2 g2:2 d2:2 b1:2 d2:2
           | e2:2 e3:1 e3:1 b2:2 e3:2 g2:2 b2:2 e2:2 b1:2
           | a1:2 a2:1 a2:1 c#2:2 e2:2 g2:2 e2:2 c#2:2 a1:2`,
      chords: 'Bm | G | D | A | Bm | G | Em | A7',
      comp: '..x.x...x.x.x...|..x.x...x.x.X...',
      kick: 'x...x...x...x...|x...x...x...x.x.',
      snare: '....x.......x..g|....x.......x.xx',
      hat: 'xgxgxgxgxgxgxgxg|xgxgxgxgxgxgxgxo',
      perc: '....x.......x...',
    },
  },
};

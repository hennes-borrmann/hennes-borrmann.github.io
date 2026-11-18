// Rennstück für die Neonhochbahn. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'neon' ein.
import type { SongDef } from '../songs';

/**
 * Neonhochbahn: b-Moll, 136 BPM, ein Hauch Shuffle (0,07). Eine Zukunftsstadt bei Nacht – kühl, glänzend,
 * treibend, mit einem Augenzwinkern. Klangbild zwischen Synthwave und Future-Funk: Die Leitstimme ist eine
 * Maschine, die singt – eine schmale Pulswelle (12,5 %), nasal und hohl wie eine Vokoderstimme, zwei Stimmen
 * 7 Cent auseinander und absichtlich ganz ohne Vibrato. Bass und Begleitung sind Sägezähne: der Bass knackig
 * gezupft, die Begleitung perlt in Arpeggien mit dem punktierten Achtel-Echo, das jeden Ton als Lichtspur
 * hinter sich herzieht. Die Snare trägt auf 2 und 4 ein Klatschen obenauf (die große Achtziger-Snare), die
 * offene Hi-Hat zischt auf jedem „und“.
 * Eigenart des Stücks: alles atmet mit der Bassdrum. Weil der Synthesizer keinen Sidechain-Kompressor hat, ist
 * das Pumpen auskomponiert – auf jedem Viertel, wo die Bassdrum schlägt, setzen Bass und Begleitung aus und
 * kommen erst ein Sechzehntel später („– da-DA-da“), die Flächen im B-Teil beginnen nach dem Schlag und
 * verklingen vor dem nächsten. Nur im Gleitflug pumpt nichts: kein Boden unter den Rädern, das Arpeggio läuft
 * ungeduckt durch.
 * Zwei Motive: das „Flackern“ – ein Ton stottert in Sechzehnteln mit unregelmäßigen Lücken (f-f·f··f-f), wie eine
 * Neonröhre, die zündet, und springt dann hinauf auf einen langen, ruhigen Ton: Jetzt brennt sie. Und das
 * „Schweben“ – ein langer Ton, ein kurzes Wippen zum Nachbarton und zurück, dann ein Schritt hinab, wie ein
 * Kart, das auf dem Magnetband federt.
 * A: Hochbahn – das Flackern über Bbm9 – Bbm9 – Gbmaj7 – Ab9 – Bbm9 – Eb9 – Gbmaj7 – F7, jeweils mit einer
 * Antwort im Rhythmus 3-3-2; das g im Eb9 ist das dorische Licht. Der Bass rollt geduckt in Sechzehnteln
 * (Pause, Grundton, Oktave, Grundton), die Arpeggien steigen in Wellen über zwei Takte auf und ab. Die
 * Bassdrum geht auf allen Vierteln. B: Wandfahrt – schwebend und offener: Das Schweben-Motiv wandert über
 * absteigende Septakkorde (Gbmaj7 – Fm7 – Ebm9 – Dbmaj7, das c über Gbmaj7 als lydischer Glanz), die
 * Begleitung hält pumpende Flächen, Snare und Klatschen nur noch auf der Drei (halbes Tempo über
 * durchlaufender Bassdrum), die Hi-Hat tickt in Sechzehnteln wie vorbeiziehende Fensterlichter. Der Bass liegt
 * erst lang, ab Takt 5 springt er auf die unbetonten Achtel (Oktaven „und“ – „und“). A noch einmal, dann C:
 * Takt 1–3 die U-Bahn-Station – gedämpft: gehaltene Akkorde, keine Snare, die Bassdrum nur leise als
 * Schienenstoß („ta-tack … ta-tack“), dazu der Bahnsteig-Gong (b–ges–des³), eine Durchsage der Vokoderstimme
 * in tiefer Lage und im Sprechrhythmus, das Türsignal piept. Takt 4 der Magnetzug fährt an: ein Lauf in
 * F-phrygisch-dominant hinauf bis zum f³, der Bass beschleunigt von Achteln in Sechzehntel, die Snare wirbelt.
 * Takt 5–7 der Gleitflug zwischen den Dächern – das f³ bleibt in der Luft liegen, Gbmaj7 – Abmaj7 (mit dem
 * hellen g) – Ebm9, Schlagzeug im halben Tempo, offene Becken, ungeduckte Arpeggien. Takt 8 die Landung auf
 * Fsus4 – F7, die Neonröhre flackert schon wieder an. Abfolge A B A C.
 */
export const NEON_STUECK: SongDef = {
  bpm: 136,
  swing: 0.07,
  race: true,
  level: 1,
  lead: { wave: 'pulse12', cutoff: 2600, gain: 0.3, detune: 7, vibrato: 0, send: 0.3, gate: 0.9 },
  bass: { wave: 'sawtooth', cutoff: 320, pluck: 1500, q: 3.5, gain: 0.34, gate: 0.62 },
  comp: { wave: 'sawtooth', cutoff: 2600, gain: 0.07, gate: 0.62, send: 0.38, low: 56, pan: 0.25 },
  drums: { kick: 0.72, snare: 0.24, hat: 0.065, perc: 'clap', percGain: 0.18 },
  order: 'ABAC',
  sections: {
    A: {
      bars: 8,
      melody: `f5:1 f5:1 -:1 f5:1 -:2 f5:1 f5:1 c6:6 bb5:2
             | ab5:3 f5:3 c5:2 db5:6 -:2
             | f5:1 f5:1 -:1 f5:1 -:2 f5:1 f5:1 db6:6 c6:2
             | bb5:3 ab5:3 eb5:2 gb5:6 -:2
             | bb5:1 bb5:1 -:1 bb5:1 -:2 bb5:1 bb5:1 f6:6 eb6:2
             | db6:3 bb5:3 f5:2 g5:6 -:2
             | f5:1 f5:1 -:1 f5:1 -:2 bb5:1 db6:1 f6:4 eb6:2 db6:2
             | c6:3 a5:3 f5:2 eb5:4 -:2 f5:1 f5:1`,
      bass: `-:1 bb1:1 bb2:1 bb1:1 -:1 bb1:1 bb2:1 bb1:1 -:1 bb1:1 bb2:1 bb1:1 -:1 bb1:1 bb2:1 bb1:1
           | -:1 bb1:1 bb2:1 bb1:1 -:1 bb1:1 bb2:1 bb1:1 -:1 bb1:1 bb2:1 bb1:1 -:1 db2:1 eb2:1 f2:1
           | -:1 gb2:1 gb3:1 gb2:1 -:1 gb2:1 gb3:1 gb2:1 -:1 gb2:1 gb3:1 gb2:1 -:1 gb2:1 gb3:1 gb2:1
           | -:1 ab2:1 ab3:1 ab2:1 -:1 ab2:1 ab3:1 ab2:1 -:1 ab2:1 ab3:1 ab2:1 -:1 ab2:1 c3:1 eb3:1
           | -:1 bb1:1 bb2:1 bb1:1 -:1 bb1:1 bb2:1 bb1:1 -:1 bb1:1 bb2:1 bb1:1 -:1 bb1:1 bb2:1 bb1:1
           | -:1 eb2:1 eb3:1 eb2:1 -:1 eb2:1 eb3:1 eb2:1 -:1 eb2:1 eb3:1 eb2:1 -:1 eb2:1 db3:1 eb2:1
           | -:1 gb2:1 gb3:1 gb2:1 -:1 gb2:1 gb3:1 gb2:1 -:1 gb2:1 gb3:1 gb2:1 -:1 gb2:1 gb3:1 gb2:1
           | -:1 f2:1 f3:1 f2:1 -:1 f2:1 f3:1 f2:1 -:1 f2:1 f3:1 f2:1 -:1 a2:1 c3:1 eb3:1`,
      chords: 'Bbm9 | Bbm9 | Gbmaj7 | Ab9 | Bbm9 | Eb9 | Gbmaj7 | F7',
      comp: '.024.135.246.357|.753.642.531.420',
      kick: 'x...x...x...x...|x...x...x...x...|x...x...x...x...|x...x...x...x.x.',
      snare: '....x.......x...|....x.......x..g',
      hat: 'x.o.x.o.x.o.x.o.|x.o.x.o.x.o.xgo.',
      perc: '....x.......x...',
    },
    B: {
      bars: 8,
      melody: `db6:6 eb6:1 db6:1 c6:4 bb5:4
             | c6:6 db6:1 c6:1 ab5:6 c6:2
             | bb5:6 c6:1 bb5:1 gb5:6 bb5:2
             | f5:2 ab5:2 c6:2 eb6:2 f6:8
             | f6:6 eb6:1 f6:1 db6:6 bb5:2
             | c6:6 db6:1 c6:1 ab5:4 f5:4
             | gb5:6 ab5:1 gb5:1 f5:4 db5:4
             | bb5:4 c6:4 a5:4 -:2 f5:1 f5:1`,
      bass: `gb2:6 gb3:2 -:4 db3:2 f2:2
           | f2:6 f3:2 -:4 c3:2 eb2:2
           | eb2:6 eb3:2 -:4 bb2:2 db2:2
           | db2:6 db3:2 -:4 ab2:2 f2:2
           | -:2 gb2:2 -:2 gb3:2 -:2 gb2:2 -:2 gb3:2
           | -:2 f2:2 -:2 f3:2 -:2 f2:2 -:2 f3:2
           | -:2 eb2:2 -:2 eb3:2 -:2 eb2:2 -:2 eb3:2
           | -:2 f2:2 -:2 f3:2 -:2 a2:2 c3:2 eb3:2`,
      chords: 'Gbmaj7 | Fm7 | Ebm9 | Dbmaj7 | Gbmaj7 | Fm7 | Ebm9 | Fsus4 F7',
      comp: `.o...o...o...o..|.o...o...o...o..|.o...o...o...o..|.o...o..01234567
           | .o...o...o...o..|.o...o...o...o..|.o...o...o...o..|.o...o...o..0123`,
      kick: 'x...x...x...x...|x...x...x...x...|x...x...x...x...|x...x...x...x.xx',
      snare: '........x.......|........x.....g.|........x.......|........x...gxgx',
      hat: 'ggxgggxgggxgggxg|ggxgggxgggxggox.',
      perc: '........x.......',
    },
    C: {
      bars: 8,
      melody: `bb5:3 gb5:3 db6:10
             | bb4:1 bb4:1 db5:2 -:2 bb4:1 bb4:1 c5:1 ab4:3 -:4
             | f6:1 -:1 f6:1 -:1 f6:1 -:1 f6:1 -:1 f6:1 -:1 f6:1 -:1 db6:4
             | c5:1 db5:1 eb5:1 f5:1 gb5:1 a5:1 bb5:1 c6:1 db6:1 eb6:1 f6:6
             | ~:6 eb6:2 db6:8
             | eb6:6 c6:2 g5:6 ab5:2
             | bb5:6 db6:2 f6:8
             | eb6:2 c6:2 bb5:2 c6:2 a5:4 -:2 f5:1 f5:1`,
      bass: `eb2:12 bb1:4
           | bb1:12 db2:4
           | gb2:12 f2:4
           | f2:2 f2:2 f2:2 f2:1 f2:1 f2:1 f2:1 f2:1 f2:1 a2:1 c3:1 eb3:1 f3:1
           | gb2:10 db3:2 gb3:4
           | ab2:10 eb3:2 ab3:4
           | eb2:10 bb2:2 eb3:4
           | f2:3 f3:3 f2:2 a2:2 c3:2 eb3:2 f3:2`,
      chords: 'Ebm9 | Bbm9 | Gbmaj7 | F7 | Gbmaj7 | Abmaj7 | Ebm9 | Fsus4 F7',
      comp: `o.......o.......|o.......o.......|o.......o.......|0.1.2.3.01234567
           | 0123456776543210|0123456776543210|0123456776543210|..x...x...x...x.`,
      kick: `g.g.....g.g.....|g.g.....g.g.....|g...g...g...g...|x...x...x...x...
           | x.........x.....|x.........x.....|x.........x.....|x...x...x...x.x.`,
      snare: `................|................|................|....g...g.g.gxXX
            | ........x.......|........x.......|........x.......|....x.......xgXX`,
      hat: `......g.......g.|......g.......g.|g.g.g.g.g.g.g.g.|x.x.x.x.xxxxxxxx
          | ..o...o...o...o.|..o...o...o...o.|..o...o...o...o.|x.o.x.o.x.o.xxxx`,
      perc: `................|................|................|................
           | ........x.......|........x.......|........x.......|....x.......x...`,
    },
  },
};

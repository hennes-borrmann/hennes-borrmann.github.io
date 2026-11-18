// Rennstück für die Gipfelbahn. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'gipfel' ein.
import type { SongDef } from '../songs';

/**
 * Gipfelbahn: F-Dur, 142 BPM, gerade. Ein Sommertag in den Alpen – sonnig, schwungvoll, ein bisschen
 * übermütig. Klangbild einer Tanzlmusi mit Rennmotor: Bass und Begleitung sind die linke Hand eines
 * Akkordeons (Sägezahn wie Stimmzungen, der Bass knapp gezupft, die Akkorde kurz nachgeschlagen), die
 * Leitstimme ist ein heller Jodler (Dreieck, zwei um 6 Cent verstimmte Stimmen, 10 Cent Vibrato und viel
 * Echo – das Echo vom Berg). Das metallische 'clank' ist die Kuhglocke, die Snare schlägt im A-Teil mit
 * den Akkorden auf die Zählzeit „und“, die Bassdrum stampft darunter auf allen Vierteln: der Rennpuls.
 * Der Wechselbass geht im A-Teil auf den Vierteln zwischen Grundton und Quinte hin und her („Hm-ta,
 * hm-ta“), mit Durchgängen zum nächsten Akkord (a–h–c hinauf, c–b–a–g hinab).
 * Zwei Motive: der „Juchzer“ – den Dreiklang hinauf zu einem langen hohen Ton (c–f–a–c³) – und der
 * „Kehlschlag“ – Sechzehntel, die zwischen einer Melodie oben und einem liegenden Ton unten hin und her
 * kippen (g–c–a–c–b–c–a–c), wie die Stimme beim Jodeln zwischen Brust und Kopf.
 * A: Dorfplatz – Juchzer und Kehlschlag im Wechsel über F – F – C7 – C7 – F – B – C7 – F; die Kuhglocke
 * bimmelt auf jedem Juchzer. B: Serpentinen unter der Seilbahn – breite Bögen im Ländlerschwung
 * (punktierte Viertel, 3-3-2), jeder Bogen steigt und macht oben eine Kehre; der Bass treibt in Achteln
 * (Grundton, Quinte, Oktave, Quinte), das Akkordeon hält und stößt nach, die Kuhglocke schlägt die
 * Viertel wie die Rollen an der Seilbahnstütze. B – F – D7 – Gm – B (mit dem e³ als lydischem Licht
 * obenauf) – Am – Gm7 – C7. A noch einmal, dann C: Takt 1–2 der Gletschertunnel – d-Moll, gehaltene
 * Akkorde, einzelne Töne tropfen wie von Eiszapfen (mit Echo), keine Snare, nur leise Hi-Hat. Takt 3–5
 * der Gleitflug – Absprung im Juchzer bis zum f³, dann liegende Töne über F – G – F (das h im G-Dur ist
 * das „Alphorn-Fa“), Schlagzeug im halben Tempo, offene Becken, das Akkordeon perlt in Arpeggien, die
 * Kuhglocken klingen von den Almen herauf. Takt 6–8 die Abfahrt durch den Bergwald – der Kehlschlag
 * kopfüber (der hohe Ton liegt oben, darunter stürzt die Linie hinab), der Bass rennt die Tonleiter
 * hinunter, Hi-Hat in Sechzehnteln, ein Trommelwirbel auf C7 führt zurück auf den Dorfplatz.
 * Abfolge A B A C.
 */
export const GIPFEL_STUECK: SongDef = {
  bpm: 142,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'triangle', cutoff: 3800, gain: 0.22, detune: 6, vibrato: 10, send: 0.34, gate: 0.84 },
  bass: { wave: 'sawtooth', cutoff: 340, pluck: 700, q: 1.8, gain: 0.36, gate: 0.5 },
  comp: { wave: 'sawtooth', cutoff: 1900, gain: 0.075, gate: 0.5, send: 0.15, low: 57, pan: -0.2 },
  drums: { kick: 0.68, snare: 0.26, hat: 0.065, perc: 'clank', percGain: 0.09 },
  order: 'ABAC',
  sections: {
    A: {
      bars: 8,
      melody: `c5 f5 a5:3 c6:5 a5 f5
             | g5:1 c5:1 a5:1 c5:1 bb5:1 c5:1 a5:1 c5:1 g5:4 -:2 c5
             | e5 g5 bb5:3 c6:5 bb5 g5
             | a5:1 c5:1 bb5:1 c5:1 c6:1 c5:1 bb5:1 c5:1 g5:4 e5 c5
             | f5 a5 c6:3 f6:5 c6 a5
             | d6:1 f5:1 c6:1 f5:1 bb5:1 f5:1 a5:1 f5:1 g5:3 bb5:3 d6
             | c6:3 bb5:1 g5 e5 c5 e5 g5 bb5
             | a5:4 c6 a5 f5:6 -`,
      bass: `f2 - c2 - f2 - c2 -
           | f2 - c2 - f2 - a2 b2
           | c3 - g2 - c3 - g2 -
           | c3 - g2 - c3 bb2 a2 g2
           | f2 - c2 - f2 - c2 -
           | bb1 - f2 - bb1 - f2 -
           | c3 - g2 - c3 - e2 g2
           | f2 - c2 - f2 e2 d2 c2`,
      chords: 'F | F | C7 | C7 | F | Bb | C7 | F',
      comp: '..x...x...x...x.|..x...x...x.x.x.',
      kick: 'x...x...x...x...|x...x...x...x.x.',
      snare: '..g...x...g...x.|..g...x...g...xg',
      hat: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.o.',
      perc: '.......x........|..........x.x...',
    },
    B: {
      bars: 8,
      melody: `d5:3 f5:3 bb5:2 d6:6 c6:1 bb5:1
             | a5:6 f5:2 c6:6 -:2
             | f#5:3 a5:3 d6:2 c6:6 bb5:1 a5:1
             | bb5:6 g5:2 d6:6 -:2
             | f5:3 bb5:3 d6:2 f6:6 e6:1 d6:1
             | c6:6 a5:2 e6:4 d6:2 c6:2
             | bb5:3 a5:3 g5:2 f5:3 g5:3 bb5:2
             | e6:1 c6:1 bb5:1 g5:1 e5:1 c5:1 e5:1 g5:1 bb5:4 -:4`,
      bass: `bb1 f2 bb2 f2 bb1 f2 bb2 f2
           | f2 c3 f3 c3 f2 c3 a2 c3
           | d2 a2 d3 a2 f#2 a2 c3 a2
           | g2 d3 g3 d3 g2 d3 bb2 d3
           | bb1 f2 bb2 f2 bb1 f2 d2 f2
           | a1 e2 a2 e2 a1 e2 c2 e2
           | g2 d3 g3 d3 f2 d3 bb2 d3
           | c2 g2 c3 g2 e2 g2 bb2 g2`,
      chords: 'Bb | F | D7 | Gm | Bb | Am | Gm7 | C7',
      comp: 'o.....x...x...x.',
      kick: 'x.....x.x...x...|x.....x.x...x.x.',
      snare: '....x.......x...|....x.......x.gg',
      hat: 'xgx.xgx.xgx.xgx.|xgx.xgx.xgx.xgo.',
      perc: 'x...g...x...g...|x...g...x...g.x.',
    },
    C: {
      bars: 8,
      melody: `d6:1 -:2 a5:1 -:2 f5:1 -:3 e6:1 -:5
             | d6:1 -:2 a5:1 -:2 f5:1 -:3 c6:1 -:3 bb5:1 a5:1
             | c5:1 f5:1 a5:1 c6:1 f6:12
             | e6:6 d6:2 b5:8
             | c6:6 a5:2 f5:4 a5:2 c6:2
             | d6:1 a5:1 d6:1 g5:1 d6:1 f5:1 d6:1 e5:1 d5 f5 a5 d6
             | bb5:1 g5:1 bb5:1 f5:1 bb5:1 d5:1 bb5:1 c5:1 bb4 d5 f5 bb5
             | c6:1 bb5:1 g5:1 e5:1 g5:1 e5:1 c5:1 bb4:1 c5 e5 g5:4`,
      bass: `d2:8 a1:8
           | bb1:8 f2:8
           | f2:12 c2:4
           | g2:12 d2:4
           | f2:8 a2:4 c3:4
           | d3 c3 bb2 a2 g2 f2 e2 d2
           | g2 f2 e2 d2 c2 bb1 a1 bb1
           | c2 e2 g2 bb2 c3 bb2 g2 e2`,
      chords: 'Dm | Bbmaj7 | F | G | F | Dm | Gm7 | C7',
      comp: `o...............|o...............|0.1.2.3.4.5.4.3.|0.1.2.3.4.5.4.3.
           | 0.1.2.3.4.5.4.3.|..x...x...x...x.|..x...x...x...x.|..x.x.x.x.x.x.x.`,
      kick: `g...............|g...............|x.......x.......|x.......x.......
           | x.......x.....x.|x...x...x...x...|x...x...x...x...|x...x...x...x.x.`,
      snare: `................|................|........x.......|........x.......
            | ........x.....gg|..g...x...g...x.|..g...x...g...x.|....x.x.x.xxXXXX`,
      hat: `..g...g...g...g.|..g...g...g...g.|..o...o...o...o.|..o...o...o...o.
          | ..o...o...o...o.|xgxgxgxgxgxgxgxg|xgxgxgxgxgxgxgxg|xxxxxxxxxxxxxxxx`,
      perc: `................|................|x.....g.........|......x...g.....
           | x.........g.....|x..x..x...x.....|x..x..x...x.....|x...x...x.x.x.x.`,
    },
  },
};

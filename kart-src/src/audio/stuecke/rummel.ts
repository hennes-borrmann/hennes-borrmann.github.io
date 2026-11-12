// Rennstück für den Achterbahn-Rummel. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'rummel' ein.
import type { SongDef } from '../songs';

/**
 * Achterbahn-Rummel: Es-Dur, 141 BPM, leichter Shuffle (0,2). Jahrmarkt am Abend – ausgelassen,
 * schwungvoll, ein bisschen schwindlig. Klangbild einer Jahrmarktsorgel: Die Leitstimme pfeift
 * (Rechteck, zwei um 15 Cent gegeneinander verstimmte Pfeifen, die hörbar schweben, dazu ein
 * Tremulant von 12 Cent), die Begleitung tupft kurze Orgelakkorde, der Bass hüpft kurz und
 * staccato, Glöckchen (das metallische 'clank') setzen Lichter, die offene Hi-Hat ist das Becken.
 * Das Walzer-Gefühl kommt ohne Walzertakt: Bass, Bassdrum und Akkorde gehen im A-Teil in
 * Gruppen zu drei, drei und zwei Achteln („Hum-ta-ta, hum-ta-ta, hum-ta“), Snare und Hi-Hat
 * bleiben im Vierer – der Dreier dreht sich gegen den Vierer wie ein Karussell gegen den Boden.
 * Das Motiv „Kreisel“: ein Ton, um den die Stimme einmal herumwirbelt (b-c-b-a-b, auch
 * chromatisch c-des-c-h-c), dann ein langer Ton und ein Sprung hinauf.
 * A: Festplatz – der Kreisel über Es – Es – Asmaj7 – B7 – Gm – C7 – Fm7 – B7, Läufe in
 * punktierten Vierteln (3-3-2) abwärts. B: Budengasse – breiter singend, im geraden
 * Hum-ta (Bass auf den Vierteln, Akkorde auf den Achteln dazwischen) über As – Adim – Es –
 * C7 – Fm – B7 – Es – B7; die Glöckchen klingeln dazwischen. A noch einmal, dann C: die Fahrt.
 * Anstieg (vier Takte): der Bass tuckert in Achteln wie die Kette, die Leitstimme pendelt um
 * einen Halteton und steigt mit jedem Takt (Es – Fm7 – Gm – As), ab dem dritten Takt in
 * Sechzehnteln, Hi-Hat in Sechzehnteln, die Snare wirbelt. Kuppe (ein Takt, Bsus4): ein
 * langes hohes f über gehaltenen Orgelakkorden, ein einzelner Bassschlag, das Becken, sonst
 * nur die Glöckchen – Innehalten.
 * Abfahrt (drei Takte): Sechzehntel-Läufe stürzen abwärts und schwingen wieder hinauf
 * (Kamelbuckel), alles spielt, der Dreier kehrt zurück, und auf B7 geht es von vorn los.
 * Abfolge A B A C.
 */
export const RUMMEL_STUECK: SongDef = {
  bpm: 141,
  swing: 0.2,
  race: true,
  level: 1,
  lead: { wave: 'square', cutoff: 2800, gain: 0.15, detune: 15, vibrato: 12, send: 0.2, gate: 0.82 },
  bass: { wave: 'pulse25', cutoff: 340, pluck: 520, q: 1.6, gain: 0.34, gate: 0.48 },
  comp: { wave: 'pulse25', cutoff: 2000, gain: 0.08, gate: 0.45, send: 0.15, low: 58, pan: -0.22 },
  drums: { kick: 0.66, snare: 0.27, hat: 0.07, perc: 'clank', percGain: 0.09 },
  order: 'ABAC',
  sections: {
    A: {
      bars: 8,
      melody: `bb5:1 c6:1 bb5:1 a5:1 bb5:2 g5:6 eb6:4
             | d6:1 eb6:1 d6:1 c6:1 bb5:2 g5:2 ab5:2 bb5:2 g5:4
             | c6:1 db6:1 c6:1 b5:1 c6:2 ab5:6 f6:4
             | eb6:3 d6:3 c6:2 bb5:3 ab5:3 f5:2
             | bb5:1 c6:1 bb5:1 a5:1 bb5:2 d5:6 g5:4
             | e5:1 f5:1 e5:1 d#5:1 e5:2 g5:2 bb5:2 c6:2 e6:4
             | f6:3 eb6:3 c6:2 ab5:3 f5:3 c5:2
             | d5:2 f5:2 ab5:2 bb5:6 -:2 bb4:1 d5:1`,
      bass: `eb2:2 -:4 bb2:2 -:4 eb3:2 bb2:2
           | eb2:2 -:4 bb2:2 -:4 f2:2 g2:2
           | ab2:2 -:4 eb3:2 -:4 ab2:2 c3:2
           | bb1:2 -:4 f2:2 -:4 bb2:2 a2:2
           | g2:2 -:4 d3:2 -:4 g2:2 bb2:2
           | c3:2 -:4 g2:2 -:4 bb2:2 e2:2
           | f2:2 -:4 c3:2 -:4 eb3:2 c3:2
           | bb1:2 -:4 f2:2 -:4 bb1:2 d2:2`,
      chords: 'Eb | Eb | Abmaj7 | Bb7 | Gm | C7 | Fm7 | Bb7',
      comp: '..x.x...x.x...x.',
      kick: 'x.....x.....x...|x.....x.....x.x.',
      snare: '....x.......x...|....x.......x..g',
      hat: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.o.',
      perc: '......x.....x...|......x.....x.x.',
    },
    B: {
      bars: 8,
      melody: `c6:6 ab5:2 c6:2 eb6:6
             | eb6:3 c6:3 a5:2 c6:3 a5:3 eb5:2
             | bb5:6 g5:2 bb5:2 eb6:4 d6:2
             | c6:3 bb5:3 g5:2 e5:3 g5:3 bb5:2
             | ab5:6 f5:2 ab5:2 c6:6
             | d6:3 c6:3 bb5:2 ab5:3 f5:3 d5:2
             | eb5:1 f5:1 g5:1 ab5:1 bb5:2 g5:2 eb6:6 -:2
             | f5:1 g5:1 ab5:1 bb5:1 c6:1 d6:1 eb6:2 d6:2 bb5:2 ab5:2 f5:2`,
      bass: `ab2:2 -:2 eb2:2 -:2 ab2:2 -:2 c3:2 ab2:2
           | a2:2 -:2 eb2:2 -:2 a2:2 -:2 c3:2 a2:2
           | bb2:2 -:2 eb2:2 -:2 g2:2 -:2 bb2:2 b2:2
           | c3:2 -:2 g2:2 -:2 e2:2 -:2 g2:2 e2:2
           | f2:2 -:2 c3:2 -:2 f2:2 -:2 ab2:2 a2:2
           | bb2:2 -:2 f2:2 -:2 d2:2 -:2 f2:2 d2:2
           | eb2:2 -:2 bb2:2 -:2 g2:2 -:2 eb2:2 c2:2
           | bb1:2 -:2 f2:2 -:2 bb1:2 -:2 d2:2 f2:2`,
      chords: 'Ab | Adim | Eb | C7 | Fm | Bb7 | Eb | Bb7',
      comp: '..x...x...x...x.',
      kick: 'x.......x.......|x.......x.....x.',
      snare: '....x.......x...|....x.......x.gg',
      hat: '..x...x...x...x.|..x...x...x...o.',
      perc: '..g...x...g...x.|..g...x...g.x.x.',
    },
    C: {
      bars: 8,
      melody: `bb4:2 eb5:2 bb4:2 f5:2 bb4:2 g5:2 bb4:2 ab5:2
             | c5:2 f5:2 c5:2 g5:2 c5:2 ab5:2 c5:2 bb5:2
             | d5:1 g5:1 d5:1 a5:1 d5:1 bb5:1 d5:1 c6:1 d5:1 bb5:1 d5:1 c6:1 d5:1 d6:1 d5:1 c6:1
             | eb5:1 ab5:1 eb5:1 bb5:1 eb5:1 c6:1 eb5:1 db6:1 eb5:1 c6:1 eb5:1 db6:1 eb5:1 eb6:1 f6:2
             | f6:12 -:2 f6:1 eb6:1
             | d6:1 c6:1 bb5:1 ab5:1 g5:1 f5:1 eb5:1 d5:1 eb5:2 g5:2 bb5:2 eb6:2
             | eb6:1 c6:1 ab5:1 eb5:1 c6:1 ab5:1 eb5:1 c5:1 f5:2 ab5:2 c6:2 f6:2
             | f6:1 d6:1 bb5:1 ab5:1 f5:1 d5:1 bb4:1 d5:1 f5:2 ab5:2 bb5:4`,
      bass: `eb2 eb2 eb2 eb2 eb2 eb2 eb2 eb2
           | f2 f2 f2 f2 f2 f2 f2 f2
           | g2 g2 g2 g2 g2 g2 g2 g2
           | ab2 ab2 ab2 ab2 ab2 ab2 ab2 ab2
           | bb1:4 -:12
           | eb2:2 -:4 bb2:2 -:4 eb3:2 d3:2
           | ab2:2 -:2 eb2:2 -:2 f2:2 -:2 c3:2 -:2
           | bb1:2 -:2 f2:2 -:2 bb2:2 ab2:2 f2:2 d2:2`,
      chords: 'Eb | Fm7 | Gm | Ab | Bbsus4 | Eb | Ab Fm7 | Bb7',
      comp: `..x...x...x...x.|..x...x...x...x.|..x.x.x...x.x.x.|..x.x.x.x.x.x.x.
           | o.......o.......|..x.x...x.x...x.|..x.x...x.x...x.|..x.x...x.x...x.`,
      kick: `x...x...x...x...|x...x...x...x...|x...x...x...x...|x...x...x...x.x.
           | x...............|x.....x.....x...|x.....x.....x...|x.....x.....x.x.`,
      snare: `....x.......x...|....x.......x...|....x.......x.x.|..x.x.x.x.x.xxxx
            | ................|....x.......x...|....x.......x...|....x.......x.gg`,
      hat: `x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|xxxxxxxxxxxxxxxx|xxxxxxxxxxxxxxxx
          | o...............|o.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.o.`,
      perc: `................|................|........x.......|....x.......x...
           | ..x...x...x.x.xx|......x.....x...|......x.....x...|......x.....x.x.`,
    },
  },
};

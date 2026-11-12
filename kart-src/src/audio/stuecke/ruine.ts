// Rennstück für die Zeitriss-Ruine. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'ruine' ein.
import type { SongDef } from '../songs';

/**
 * Zeitriss-Ruine: A, 130 BPM, gerade, 20 Takte (≈ 37 s). Ein Tempel im Dschungel, in dem die
 * Zeit springt – zwei Gesichter desselben Themas. Durch alles zieht sich ein Uhrwerk: die
 * Hi-Hat tickt gleichmäßig in Achteln, abwechselnd hell und leise („Tick-tack").
 * Die Leitstimme ist ein hohles, gefiltertes Rechteck (wie eine Flöte aus Holz), die
 * Begleitung ein dünner Puls, der Bass ein runder Dreieckston.
 * E – „Einst": A-Dur, pentatonisch gefärbt (die Leitstimme benutzt nur A, H, Cis, E, Fis).
 * Getragene Bögen im Rhythmus lang-kurz-lang-lang über A – Hm7 – Fism7 – Esus4; der Bass
 * schreitet punktiert (Grundton lang, kurz, Quinte lang, kurz), Trommeln (Tom) wie eine
 * Prozession, die Snare nur auf der Drei.
 * U – Übergang (zwei Takte, Fmaj7 – Esus4/E): die Stimme sinkt, ein Trommelwirbel mit
 * fallenden Toms; er führt vom einen Zeitalter ins andere und wieder zurück (Folge E U J U).
 * J – „Jetzt": dieselbe Melodie, zerbrochen – nach a-Moll gerückt (Cis → C, Fis → F, im
 * siebten Takt H → B, einzelne Töne der neuen Harmonie angepasst). Die Bögen setzen oft ein
 * Achtel zu spät ein, sind von Pausen durchlöchert und enden in kurzen Nachschlägen, die wie
 * Echos klingen (einmal eine Oktave tiefer). Die Harmonie kippt ins Phrygische (Am – Bbmaj7
 * – Fmaj7 – Esus4), der Bass stolpert synkopiert, Bassdrum und Snare treiben mit
 * Ghost-Notes, die Toms fallen zwischen die Zählzeiten.
 */
export const RUINE_STUECK: SongDef = {
  bpm: 130,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'square', cutoff: 2300, gain: 0.15, detune: 6, vibrato: 7, send: 0.38, gate: 0.84 },
  bass: { wave: 'triangle', cutoff: 640, pluck: 900, q: 1.6, gain: 0.4, gate: 0.72 },
  comp: { wave: 'pulse12', cutoff: 2600, gain: 0.085, gate: 0.62, send: 0.32, low: 57, pan: -0.22 },
  drums: { kick: 0.66, snare: 0.25, hat: 0.075, perc: 'tom', percGain: 0.24 },
  order: 'EUJU',
  sections: {
    E: {
      bars: 8,
      melody: `e5:4 f#5:2 a5:6 b5:4 | a5:6 f#5:2 e5:4 b4:4
             | c#5:4 e5:2 f#5:6 a5:4 | b5:8 a5:4 e5:4
             | e5:4 f#5:2 a5:6 c#6:4 | e6:6 c#6:2 b5:4 a5:4
             | f#5:4 a5:2 b5:4 a5:2 f#5:4 | e5:12 -:4`,
      bass: `a2:6 a2:2 e3:6 a2:2 | b1:6 b1:2 f#2:6 b1:2
           | f#2:6 f#2:2 c#3:6 f#2:2 | e2:6 e2:2 b2:6 e2:2
           | a2:6 a2:2 e3:6 a2:2 | d2:6 d2:2 a2:6 d2:2
           | b1:6 b1:2 f#2:6 b1:2 | e2:6 e2:2 b2:4 g#2:2 b2:2`,
      chords: 'A | Bm7 | F#m7 | Esus4 | A | Dmaj7 | Bm7 | Esus4 E',
      comp: 'o.......o...2.1.|o.......o.....3.',
      kick: 'x.......x.......|x.......x.....x.',
      snare: '........x.......|........x...g.g.',
      hat: 'x.g.x.g.x.g.x.g.',
      perc: 'x.....x...x.x...|x.....x...x.x.xx',
    },
    U: {
      bars: 2,
      melody: 'a5:6 g5:2 f5:4 c5:4 | b4:6 c5:2 d5:4 e5:2 -:2',
      bass: 'f2:8 c3:4 f2:4 | e2:4 e2:4 e2:2 e2:2 g#2:2 b2:2',
      chords: 'Fmaj7 | Esus4 E',
      comp: 'o.......o.......|o.......0.1.2.3.',
      kick: 'x...............|x...x...x...x...',
      snare: '................|....g.g.x.x.xxxX',
      hat: 'x.g.x.g.x.g.x.g.',
      perc: '................|x...x...x.x.x.x.',
    },
    J: {
      bars: 8,
      melody: `- e5:3 f5:2 a5:3 -:2 b5:2 a5:1 -:1 | a5:3 f5:3 d5:2 -:4 f5:1 d5:1 -:2
             | - c5:3 e5:3 f5:2 a5:4 -:2 | b5:3 -:1 b5:2 a5:3 e5:3 -:4
             | - e5:3 f5:2 a5:3 -:2 c6:2 b5:1 -:1 | e6:3 c6:3 -:2 b5:1 a5:1 -:2 a4:2 -:2
             | f5:3 a5:3 bb5:2 -:2 a5:1 f5:1 -:4 | e5:3 -:1 e5:1 -:1 e5:1 -:3 g#4:2 b4:2 d5:2`,
      bass: `a2:2 -:1 a2:1 -:2 e3:3 a2:1 -:2 c3:2 b2:2 | bb2:2 -:1 bb2:1 -:2 f3:3 bb2:1 -:2 d3:2 a2:2
           | f2:2 -:1 f2:1 -:2 c3:3 f2:1 -:2 a2:2 g2:2 | e2:2 -:1 e2:1 -:2 b2:3 e2:1 -:2 d3:2 b2:2
           | a2:2 -:1 a2:1 -:2 e3:3 a2:1 -:2 c3:2 b2:2 | d2:2 -:1 d2:1 -:2 a2:3 d2:1 -:2 f2:2 a2:2
           | bb2:2 -:1 bb2:1 -:2 f3:3 bb2:1 -:2 d3:2 a2:2 | e2:2 -:1 e2:1 -:2 b2:3 e2:1 -:2 g#2:2 d3:2`,
      chords: 'Am | Bbmaj7 | Fmaj7 | Esus4 | Am | Dm7 | Bbmaj7 | E7',
      comp: '..x...x.0..1.3..|..x..2..x...1...',
      kick: 'x..x....x.x.....|x..x....x....x..',
      snare: '....x..g....x.g.|....x..g....x.gg',
      hat: 'x.g.x.g.x.g.x.g.',
      perc: '..x...x..x...x..|..x...x..x..x.xx',
    },
  },
};

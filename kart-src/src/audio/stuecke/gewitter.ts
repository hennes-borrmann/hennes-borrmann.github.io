// Rennstück für den Gewitterkamm. Eigenkomposition im Datenformat von songs.ts
// (Schreibweise im Kopf jener Datei); songs.ts trägt es unter 'gewitter' ein.
import type { SongDef } from '../songs';

// Bassfiguren (je ein Takt, 16 Sechzehntel). Sie stehen als kleine Bausteine hier, damit
// man die Figur sieht und nicht nur eine lange Tonkette: r = Grundton, o = Oktave, q = Quinte.

/** „Pochen" (A): Doppelschläge in Dreiergruppen 3-3-3-3, dann zwei einzelne Töne (2-2) – das Herz klopft gegen den Takt. */
const poch = (r: string, a: string, b: string): string =>
  `${r}:1 ${r}:1 -:1 ${r}:1 ${r}:1 -:1 ${r}:1 ${r}:1 -:1 ${r}:1 ${r}:1 -:1 ${a}:1 -:1 ${b}:1 -:1`;
/** „Jagd" (B): die Doppelschläge laufen weiter, dazwischen springt der Bass zweimal hinauf und hält. */
const jagd = (r: string, o: string, q: string): string =>
  `${r}:1 ${r}:1 -:1 ${r}:1 ${r}:1 -:1 ${r}:1 ${r}:1 ${o}:2 ${r}:1 ${r}:1 -:1 ${r}:1 ${q}:2`;
/** „Schlag" (D): wie das Pochen, aber jeder zweite Doppelschlag endet eine Oktave höher – es hämmert. */
const schlag = (r: string, o: string, q: string): string =>
  `${r}:1 ${r}:1 -:1 ${o}:1 ${r}:1 -:1 ${r}:1 ${r}:1 -:1 ${o}:1 ${r}:1 -:1 ${r}:1 ${q}:1 ${o}:1 -:1`;

/**
 * Gewitterkamm: g-Moll mit phrygischer Färbung (As statt A in den Akkorden), 142 BPM, gerade.
 * Nachts über den Grat: Wenig Töne, viel Raum. Unter allem pocht der Bass in Doppelschlägen
 * (3-3-3-3-2-2 Sechzehntel), dunkel gefiltert; darüber ruft eine einzelne hohe Stimme (weiches
 * Dreieck mit breitem, langsamem Vibrato und viel Echo – eine Pfeife im Wind) in langen Tönen und
 * weiten Sprüngen (Quarten, Quinten, Sexten). Die Begleitung sind gehaltene, dumpfe Flächen.
 * Das Schlagzeug lässt die Toms am Ende jedes vierten Takts rollen; weil die Tom bei jedem Schlag
 * im Takt tiefer gestimmt ist, poltert der Wirbel abwärts wie ein Donner.
 * A: Aufstieg über Gm – As – Fm – Es – D7, je zwei Takte eine Harmonie.
 * B: Jagd über As – Fm – Cm – D, der Bass springt, die Stimme ruft höher und dichter.
 * A noch einmal, dann C: die Stille vor dem Schlag – ein Bassdrum-Schlag, ein liegender Akkord,
 * ein einzelner hoher Ton; zwei Takte fast nichts (nur der Akkord liegt noch einmal leise an); im vierten Takt rollt der Donner (Toms und
 * Snare) heran und der Bass klopft auf D. D: der Schlag – das Pochen hämmert in Oktaven, Snare
 * betont, Akkordschläge, die Stimme oben am Grat, Wirbel in jedem Takt; dann von vorn.
 */
export const GEWITTER_STUECK: SongDef = {
  bpm: 142,
  swing: 0,
  race: true,
  level: 1,
  lead: { wave: 'triangle', cutoff: 2600, gain: 0.22, detune: 5, vibrato: 14, send: 0.45, gate: 0.95 },
  bass: { wave: 'sawtooth', cutoff: 240, pluck: 1300, q: 6, gain: 0.38, gate: 0.5 },
  comp: { wave: 'triangle', cutoff: 1300, gain: 0.11, gate: 0.9, send: 0.5, low: 55, pan: 0.3 },
  drums: { kick: 0.72, snare: 0.28, hat: 0.06, perc: 'tom', percGain: 0.32 },
  order: 'ABACD',
  sections: {
    A: {
      bars: 8,
      melody: `-:4 d5:2 g5:10 | ~:4 -:4 bb5:2 a5:2 g5:4
             | c6:12 -:2 bb5:1 ab5:1 | eb5:10 -:6
             | -:4 c5:2 f5:10 | ~:4 -:4 ab5:2 g5:2 f5:4
             | g5:6 bb5:6 d6:4 | c6:4 a5:4 f#5:8`,
      bass: [
        poch('g2', 'd3', 'g2'),
        poch('g2', 'bb2', 'a2'),
        poch('ab2', 'eb3', 'ab2'),
        poch('ab2', 'c3', 'g2'),
        poch('f2', 'c3', 'f2'),
        poch('f2', 'ab2', 'g2'),
        poch('eb2', 'bb2', 'g2'),
        poch('d2', 'f#2', 'a2'),
      ].join(' | '),
      chords: 'Gm | Gm | Ab | Ab | Fm | Fm | Ebmaj7 | D7',
      comp: 'o...............|o...........1.2.',
      kick: 'x......x..x.....|x......x..x...x.',
      snare: '....x.......x...|....x.......x..g',
      hat: '..x...x...x...x.|..x...x...x.x.o.',
      perc: '................|................|................|........g.gxgxxx',
    },
    B: {
      bars: 8,
      melody: `eb6:3 c6:1 ab5:4 -:4 eb6:2 f6:2 | c6:8 -:4 ab5:2 c6:2
             | g5:3 eb5:1 c5:4 -:4 g5:2 bb5:2 | a5:8 f#5:4 d5:4
             | eb6:3 c6:1 ab5:4 -:4 f6:2 eb6:2 | f6:4 eb6:2 c6:6 -:4
             | bb5:3 g5:1 eb5:4 -:2 g5:2 bb5:2 d6:2 | d6:6 c6:2 a5:4 f#5:2 a5:2`,
      bass: [
        jagd('ab2', 'ab3', 'eb3'),
        jagd('f2', 'f3', 'c3'),
        jagd('c2', 'c3', 'g2'),
        jagd('d2', 'd3', 'a2'),
        jagd('ab2', 'ab3', 'eb3'),
        jagd('f2', 'f3', 'c3'),
        jagd('eb2', 'eb3', 'bb2'),
        jagd('d2', 'd3', 'a2'),
      ].join(' | '),
      chords: 'Ab | Fm | Cm | D | Ab | Fm | Eb | D7',
      comp: 'x.....x...0.1.2.',
      kick: 'x..x....x..x....|x..x....x..x..x.',
      snare: '....x.......x...|....x.......x.gx',
      hat: 'x.gxx.gxx.gxx.g.',
      perc: '..............xx|................|..............xx|......g.g.xxXXXX',
    },
    C: {
      bars: 4,
      melody: 'd6:16 | ~:6 -:10 | -:16 | -:16',
      bass: 'g2:16 | ~:8 -:8 | -:16 | -:8 d2:1 -:1 d2:1 -:1 d2:1 d2:1 d2:1 d2:1',
      chords: 'Gm | Gm | Gm | D7',
      comp: 'o...............|................|o...............|................',
      kick: 'X...............|................|................|................',
      snare: '................|................|................|..........g.x.XX',
      hat: '................',
      perc: '................|................|................|g.g.g.xgx.xxXXXX',
    },
    D: {
      bars: 8,
      melody: `g5:2 d6:6 -:2 d6:2 bb5:2 g5:2 | bb5:8 -:2 g5:2 bb5:2 eb6:2
             | c6:2 eb6:6 -:2 eb6:2 c6:2 ab5:2 | a5:6 f#5:2 d5:4 -:4
             | g5:2 d6:6 -:2 f6:2 eb6:2 d6:2 | eb6:8 -:2 d6:2 bb5:2 g5:2
             | ab5:4 c6:4 eb6:4 f6:4 | d6:6 c6:2 a5:2 f#5:2 d5:4`,
      bass: [
        schlag('g2', 'g3', 'd3'),
        schlag('eb2', 'eb3', 'bb2'),
        schlag('ab2', 'ab3', 'eb3'),
        schlag('d2', 'd3', 'a2'),
        schlag('g2', 'g3', 'd3'),
        schlag('eb2', 'eb3', 'bb2'),
        'f2:1 f2:1 -:1 f3:1 f2:1 -:1 f2:1 c3:1 ab2:1 ab2:1 -:1 ab3:1 ab2:1 -:1 eb3:1 -:1',
        'd2:1 d2:1 -:1 d3:1 d2:1 -:1 d2:1 d2:1 -:1 d3:1 c3:1 -:1 a2:1 f#2:1 d2:1 -:1',
      ].join(' | '),
      chords: 'Gm | Eb | Ab | D | Gm | Eb | Fm Ab | D7',
      comp: 'X.....X.....X.x.|X.....X...X.X.X.',
      kick: 'x..x..x...x..x..|x..x..x...x.xx.x',
      snare: '....X.......X...|....X.......X.xx',
      hat: 'x.xxx.xxx.xxx.x.|x.xxx.xxx.xxx.o.',
      perc: '......xx......xx|......xx....xXXX',
    },
  },
};

// 24 · Startrampe – ein Raketenstartplatz an der Küste, an einem Nachmittag mit dramatischem Himmel.
//
// Mitten auf dem Platz steht die Rakete auf ihrer Startrampe; alle 40 s hebt eine ab (STARTTAKT). Die Runde in fünf Teilen:
//   1. Startgerade und Schleife südlich um die Startrampe; die Abkürzung (a) geht geradeaus durch den Flammengraben,
//      mitten unter der Rakete hindurch.
//   2. Flammenzone: Wo der Flammengraben ins Freie mündet, kreuzt die Straße den Abgasstrahl. Beim Start schießt dort das
//      Feuer heraus (mechanics.ts, PULSE_FLAME: Treffer), und der Abgasstoß schiebt rings herum alles zur Seite (winds).
//   3. Serviceturm: Die Straße schraubt sich in einer Steilkurven-Wendel (gut 28° nach innen geneigt) außen um den
//      stählernen Turm 44 m hinauf.
//   4. Magnetring: Vom Turm führt das Schwebeband (mechanics.ts: Band) über eine Brücke zur Rakete und dreht sich in einem
//      Ring um sie senkrecht an die Wand – man fährt an der Innenseite des Rings, die Rakete vor Augen (gerechnet flach,
//      gezeigt gedreht: twistWarp). Danach Absprung und Gleitflug über den Platz, unter der eigenen Brücke hindurch.
//   5. Landung auf dem Dünenhügel, Kehre und durch den Kriechweg des Raupentransporters zurück zur Startgeraden.
//
// Zwei echte Abkürzungen, jede mit Preis:
//   a) Flammengraben ('window'): geradeaus durch den Graben unter der Rakete statt außen um die Startrampe. Das Schutztor
//      ist nur zwischen den Starts offen – 9 s vor einem Start schließt es, 4 s danach öffnet es wieder (Ampel und
//      Countdown an den Tafeln). Wer zu spät kommt, muss außen herum; die KI rechnet aus, ob es bei ihrer Ankunft offen ist.
//   b) Transporterdach ('train'): geradeaus über den Kriechweg-Graben statt hinunter auf seine Sohle und wieder hinauf.
//      Über den Graben trägt nur die Plattform des Raupentransporters, solange er an der Abkürzung steht (crawler); die
//      Schranke an der Mündung ist nur dann offen. Auf der Hauptstraße quert er langsam den Weg – seine vier Raupenböcke
//      sind fahrende Wände, unter der Plattform kommt man hindurch.

import type { TrackDef } from '../track';

/**
 * Stützpunkte eines Bogens um (cx, cz) mit Halbmesser r: Winkel a0 … a1 in Grad (0 = Norden, also −z; 90 = Osten),
 * steigend = im Uhrzeigersinn (Rechtskurve), fallend = links herum; Höhe gleichmäßig von y0 nach y1, je Stützpunkt step Grad.
 */
function bogen(cx: number, cz: number, r: number, a0: number, a1: number, y0: number, y1: number, step = 45): number[][] {
  const out: number[][] = [];
  const n = Math.max(1, Math.round(Math.abs(a1 - a0) / step));
  for (let k = 0; k <= n; k++) {
    const a = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180;
    out.push([+(cx + r * Math.sin(a)).toFixed(2), +(cz - r * Math.cos(a)).toFixed(2), +(y0 + ((y1 - y0) * k) / n).toFixed(2)]);
  }
  return out;
}

/** Die Rakete (Mitte der Startrampe und des Magnetrings): Lage, Halbmesser des Bandrings (gerechnet), Achsabstand des Bands. */
export const RAKETE = { x: 0, z: 0, r: 24, axis: 9 };
/** Serviceturm: Mitte und Halbmesser der Wendel. */
export const TURM = { x: 106, z: -70, r: 24 };
/** Startplatz: Höhe des Platzes und der Oberkante der Startrampe (Meter). */
export const PLATZ = { y: 3, pad: 4.6 };
/**
 * Starttakt: alle period Sekunden ein Start, der erste first Sekunden nach „Los“. Daraus folgen der Abgasstrahl
 * (PULSE_FLAME), der Abgasstoß (winds) und das Tor des Flammengrabens – und die Darstellung (Rakete, Countdown).
 */
export const STARTTAKT = { period: 40, first: 20 };
/** Das Tor des Flammengrabens schließt so lange vor einem Start und öffnet so lange danach (Sekunden). */
export const GRABEN_ZU = { before: 9, after: 4 };
/** Kriechweg des Raupentransporters: Höhe der Sohle (Meter), Lage (z) – er verläuft von Ost nach West – und sein Ende 1 (x). */
export const KRIECHWEG = { floor: -2, z: -20, end: -300 };

const WENDEL = bogen(TURM.x, TURM.z, TURM.r, 90, -753.44, 4, 48);
const RING = bogen(RAKETE.x, RAKETE.z, RAKETE.r, -33.44, -333.44, 46.5, 34);

/** Versatz des Takts für PULSE_FLAME und winds (Sekunden): der Zyklus beginnt mit dem Start. */
const PHASE = STARTTAKT.period - STARTTAKT.first;

/** Das Feuer im Flammengraben: von der Einfahrt bis zur Ausfahrt (Stützpunkt-Einheiten der Abkürzung) je 0,22 eine Zone. */
const GRABENFEUER = Array.from({ length: 16 }, (_, k) => ({ at: 1.7 + k * 0.22, lat: 0, period: STARTTAKT.period, phase: PHASE, radius: 5.5 }));

// Stützpunkte, an denen die Teile beginnen bzw. enden.
const W0 = 9;
const W1 = W0 + WENDEL.length - 1;
const R0 = W1 + 2;
const R1 = R0 + RING.length - 1;

export const RAMPE: TrackDef = {
  id: 'rampe',
  name: 'Startrampe',
  theme: 'rampe',
  blurb: 'Raketenstartplatz an der Küste: durch den Flammengraben unter der Rakete, in der Steilkurven-Wendel um den Serviceturm, auf dem Magnetring an der Wand um die Rakete, Gleitflug über den Platz und durch den Kriechweg des Raupentransporters.',
  twist: 'Alle 40 Sekunden ein Start – Countdown, Abgasstrahl, Abgasstoß. Drei Fahrarten: Steilkurve, Schwebeband an der Wand, Gleitflug. Abkürzungen durch den Flammengraben (nur zwischen den Starts) und über die Plattform des fahrenden Raupentransporters.',
  grade: 3,
  surface: 'asphalt',
  points: [
    // 0–1: Startgerade nach Osten, an der Tribüne vorbei
    [-180, 10, 3],
    [-140, 8, 3],
    // 2–6: Gabelung (a) bei 1,55; die Schleife südlich um die Startrampe
    [-104, 13, 3],
    [-76, 38, 3],
    [-35, 88, 3],
    [25, 97, 3],
    [78, 64, 3],
    // 7–8: Flammenzone (der Abgasstrahl quert die Straße), Einmündung des Flammengrabens, zur Strandstraße
    [106, 14, 3],
    [122, -34, 3.5],
    // 9–28: die Wendel um den Serviceturm, links herum hinauf
    ...WENDEL,
    // 29: die Brücke zur Rakete (Schwebeband)
    [40, -55, 47.5],
    // 30–37: der Magnetring um die Rakete
    ...RING,
    // 38–41: Gleitflug nach Westnordwesten, Landung auf dem Dünenhügel
    [-30, -40, 31],
    [-70, -58, 26],
    [-110, -76, 20.5],
    [-150, -92, 15],
    // 42–44: Kehre links herum, hinab zum Kriechweg (Gabelung b)
    [-190, -104, 11],
    [-228, -94, 6],
    [-252, -72, 4.5],
    // 45–50: hinunter auf die Sohle des Kriechwegs, quer hindurch, wieder hinauf
    [-277, -53, 3.5],
    [-297, -38, -0.5],
    [-300, -29, -2],
    [-300, -20, -2],
    [-300, -11, -2],
    [-295, 8, 0.5],
    // 51–53: Bogen nach Osten, zurück zur Startgeraden
    [-275, 27, 3],
    [-240, 31, 3],
    [-206, 18, 3],
  ],
  roadHalf: 6.4,
  shoulder: 1.6,
  startAt: 0,
  laps: 3,
  bank: 1.2,
  fallDepth: 6,
  landmarkAt: R0 + 3,
  // Die Wendel hängt frei am Turm, Brücke und Magnetring frei in der Luft – und das Stück Anlauf bis zur Kante des
  // Gleitflugs (sonst zöge es das Gelände zu sich hinauf).
  decks: [[W0 + 0.6, R1 + 0.8]],
  widths: [
    // Schwebeband wie in der Neonhochbahn
    [W1 + 0.3, R1 + 0.6, 5.6, 0.9],
  ],
  banks: [
    // Wendel um den Serviceturm: links herum, gut 28° nach innen geneigt
    [W0 + 0.4, W1 - 0.3, 0.55],
    // Brücke und Ring: das Band liegt eben (die Verdrehung macht das Bild)
    [W1, R1 + 0.6, 0],
    // flach an Gabelungen und Einmündungen, und auf der Sohle des Kriechwegs
    [1.3, 2.4, 0],
    [7.3, 8.5, 0],
    [43.2, 45, 0],
    [46.6, 49.4, 0],
    [52.6, 53.9, 0],
  ],
  bands: [
    {
      from: W1 + 0.3,
      to: R1 + 0.6,
      radius: RAKETE.axis,
      twists: [
        [W1 + 1.2, 0],
        [R0 + 0.4, 90],
        [R1 - 1.4, 90],
        [R1 + 0.4, 0],
      ],
    },
  ],
  surfaces: [
    [W1 + 0.3, R1 + 0.6, 'band'],
    // Startplatz: Beton
    [6.9, 7.6, 'concrete'],
  ],
  glides: [[R1 + 0.8, 41]],
  thermals: [{ at: 39.5, lat: 3, radius: 7 }],
  rings: [
    { at: 38.6, lat: -2, up: 2 },
    { at: 40.3, lat: 2, up: 2 },
  ],
  // Flammenzone: wo der Abgasstrahl aus dem Graben über die Straße schießt (links, auf der Seite des Grabens)
  flames: [{ at: 7.25, lat: -2.6, period: STARTTAKT.period, phase: PHASE, radius: 5 }],
  // Abgasstoß: der Druck schiebt rings um die Flammenzone alles vom Graben weg (nach rechts, zum Strand)
  winds: [{ from: 6.85, to: 7.9, push: 6.5, period: STARTTAKT.period, phase: PHASE, gust: 2.8 }],
  pads: [
    { at: 0.3, lat: 0 },
    { at: R1 + 0.55, lat: 0, halfWidth: 0 },
    { at: 42.4, lat: 0 },
  ],
  boxRows: [0.6, 8.55, R0 - 0.5, 42.9],
  // Raupentransporter: am Ende 0 über der Abkürzung (b), am Ende 1 mit der Plattform über der Hauptstraße (die Böcke stehen
  // dann links und rechts neben ihr). 8 s Fahrt, 9 s Halt an der Abkürzung, 1 s über der Straße – ein Umlauf 26 s.
  crawler: { branch: 1, to: [KRIECHWEG.end, KRIECHWEG.z], floor: KRIECHWEG.floor, travel: 8, dwell: [9, 1], phase: 9 },
  branches: [
    // a) Flammengraben: geradeaus unter der Rakete hindurch – nur zwischen den Starts.
    {
      from: 1.55,
      to: 8,
      shortcut: 'window',
      points: [
        [-84, 6, 0],
        [-42, 4, -6],
        [0, 2, -6.5],
        [40, 2, -6],
        [72, -1, -1],
        [95, -4, 2.4],
        [109.4, -12, 3],
      ],
      roadHalf: 4.6,
      shoulder: 0.6,
      surface: 'concrete',
      tunnels: [[2.3, 3.7]],
      gates: [{ every: STARTTAKT.period, closes: STARTTAKT.first - GRABEN_ZU.before, opens: STARTTAKT.first + GRABEN_ZU.after }],
      // Beim Start rast das Feuer durch den ganzen Graben (alle 9 m eine Flammenzone, die sich überlappen).
      flames: GRABENFEUER,
    },
    // b) Transporterdach: geradeaus über den Kriechweg-Graben – auf der Plattform des Raupentransporters.
    {
      from: 43.55,
      to: 53.3,
      shortcut: 'train',
      points: [
        [-251, -47, 4.5],
        [-256, -20, 4.5],
        [-253, 1, 4.5],
        [-243, 13, 4],
        [-223, 19, 3.2],
      ],
      roadHalf: 4.6,
      shoulder: 0.6,
      surface: 'concrete',
      trench: [1.7, 2.37],
      decks: [[1.3, 2.7]],
    },
  ],
};

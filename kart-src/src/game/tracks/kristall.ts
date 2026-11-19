// 21 · Kristallmine – ein Bergwerk bei Nacht: oben die Zeche mit dem Förderturm, unten Stollen voller leuchtender Kristalle.
//
// Die Runde in vier Teilen:
//   1. Über Tage: vom Zechenplatz die Rampe hinauf zur Hängebank des Förderturms.
//   2. Lorenbahn: Dort beginnen die Schienen (mechanics.ts: Rail). In der Lore geht es in einer steilen Wendel den
//      Hauptschacht hinunter – Lenken wechselt das Gleis, die Bremsstrecken halten das Tempo im Zaum. Unten teilt sich das
//      Gleis an einer Weiche.
//   3. Unter Tage: Füllort (dort pendelt eine Lore quer über den Weg), die Sprengstrecke (Ladungen gehen im Takt hoch),
//      hinunter in den unterirdischen See (Tauchen) und hinein in die Riesengeode: Auf dem Schwebeband (mechanics.ts: Band)
//      fährt man an ihrer Wand rings um die Kristallkugel – gerechnet flach, gezeigt senkrecht an der Wand (twistWarp).
//   4. Durch den Wetterschacht in einer Wendel wieder hinauf ans Tageslicht – na ja, ans Mondlicht.
//
// Zwei echte Abkürzungen, jede mit Preis:
//   a) Sprengort ('window'): An der Weiche unten im Schacht führt das rechte Gleis geradeaus durch den Sprengort statt im
//      Bogen um den Erzkörper. Dort wird im Takt gesprengt: Nur solange das Signal grün ist, ist die Weiche gestellt und das
//      Gleis frei; danach bricht das Hangende nach, der Sprengort ist verschüttet, und die Weiche führt geradeaus weiter.
//   b) Alter Mann ('risk'): ein alter, enger Stollen mit niedriger Decke – nur ein Bohlensteg ohne Geländer über einem
//      Rolloch. Wer danebengerät, stürzt hinein.

import type { TrackDef } from '../track';

// Die beiden Gleise der Lorenbahn liegen 2 m links und rechts der Mitte.
const L = -2;
const R = 2;

/**
 * Stützpunkte einer Wendel um (cx, cz) mit Halbmesser r: Winkel a0 … a1 in Grad (0 = Norden, also −z; 90 = Osten),
 * im Uhrzeigersinn steigend (Rechtskurve); Höhe gleichmäßig von y0 nach y1, je Stützpunkt step Grad.
 * Ohne den ersten Punkt, wenn skipFirst.
 */
function wendel(cx: number, cz: number, r: number, a0: number, a1: number, y0: number, y1: number, step = 45): number[][] {
  const out: number[][] = [];
  const n = Math.round(Math.abs(a1 - a0) / step);
  for (let k = 0; k <= n; k++) {
    const a = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180;
    out.push([+(cx + r * Math.sin(a)).toFixed(2), +(cz - r * Math.cos(a)).toFixed(2), +(y0 + ((y1 - y0) * k) / n).toFixed(2)]);
  }
  return out;
}

/**
 * Stützpunkte eines Bogens links herum (gegen den Uhrzeigersinn) um (cx, cz): Winkel wie bei wendel (0 = Norden,
 * 90 = Osten), fallend.
 */
function bogenLinks(cx: number, cz: number, r: number, a0: number, a1: number, y0: number, y1: number, step = 45): number[][] {
  return wendel(cx, cz, r, a0, a1, y0, y1, step);
}

// Hauptschacht (Lorenbahn hinunter) und Wetterschacht (Straße hinauf): Mitte und Halbmesser der Wendel.
// wall = Halbmesser der Schachtwand, floor = Höhe der Sohle (für Gelände und Kulisse).
export const SCHACHT = { x: 60, z: -20, r: 18, wall: 24.5, floor: -40 };
export const WETTERSCHACHT = { x: -188, z: -20, r: 18, wall: 27.5, floor: -40 };
// Riesengeode: Mitte, Halbmesser des Bandrings (gerechnet) und Achsabstand der Verdrehung.
export const GEODE = { x: -300, z: 76, r: 20, axis: 9 };

const HAUPT = wendel(SCHACHT.x, SCHACHT.z, SCHACHT.r, 0, 540, 8, -28);
const WETTER = wendel(WETTERSCHACHT.x, WETTERSCHACHT.z, WETTERSCHACHT.r, -720, 0, -28, 1);
// Der Bandring in der Geode: links herum von Osten (90°) über Norden, Westen und Süden bis Ost-Südost.
const RING = bogenLinks(GEODE.x, GEODE.z, GEODE.r, 90, -200, -38.6, -28);

export const KRISTALL: TrackDef = {
  id: 'kristall',
  name: 'Kristallmine',
  theme: 'kristall',
  blurb: 'Zeche bei Nacht, mit der Lore die Wendel im Hauptschacht hinunter, Sprengstrecke, Tauchgang durch den unterirdischen See, an der Wand der Riesengeode rings um die Kristallkugel und durch den Wetterschacht wieder hinauf.',
  twist: 'Drei Fahrarten unter Tage: in der Lore auf Schienen (Lenken wechselt das Gleis), tauchend im Grubensee, schwebend an der Wand der Geode. Sprengungen im Takt. Abkürzungen durch den Sprengort (nur bei Grün) und über den Bohlensteg im Alten Mann (ohne Geländer).',
  grade: 3,
  scale: 1,
  surface: 'cobble',
  sea: -40,
  points: [
    // 0–2: Zechenplatz, nach Osten (Start), ein Schlenker um die Kaue
    [-100, -38, 1],
    [-66, -41, 1],
    [-36, -47, 1.5],
    // 3–5: die Rampe hinauf zur Hängebank des Förderturms (ab 4 Schienen), Brücke über den Schachtkranz
    [-8, -45, 3.5],
    [16, -38, 7.6],
    [40, -38, 8],
    // 6–18: Hauptschacht – die Lorenbahn in der Wendel steil hinunter (anderthalb Runden rechts herum)
    ...HAUPT,
    // 19–20: unten nach Westen, zur Weiche (bei 19,5)
    [30, -2, -29],
    [8, -2, -29.5],
    // 21–25: Bogen um den Erzkörper (die Abkürzung geht geradeaus durch den Sprengort), Einmündung bei 25,5
    [-14, 22, -30],
    [-36, 50, -30],
    [-70, 56, -30],
    [-96, 38, -30],
    [-110, 10, -30],
    // 26–27: Füllort – hier enden die Schienen; eine Lore pendelt quer über den Weg
    [-126, -2, -30],
    [-146, 8, -30],
    // 28–30: die Sprengstrecke nach Süden
    [-158, 34, -30.5],
    [-162, 70, -31],
    [-162, 96, -31.5],
    // 31–35: weiter Bogen nach Osten und zurück nach Westen (der Alte Mann schneidet ihn ab: Gabelung bei 29,7, Einmündung bei 35,6)
    [-140, 116, -32],
    [-116, 144, -32.5],
    [-128, 174, -33],
    [-168, 182, -34],
    [-206, 172, -35.5],
    // 36–38: hinunter in den Grubensee und am Grund entlang, wieder hinauf
    [-240, 160, -42],
    [-268, 146, -47],
    [-280, 122, -44],
    // 39–46: in die Riesengeode – auf dem Schwebeband rings um die Kristallkugel, an der Wand, und steigend hinaus
    [-280, 100, -39.2],
    ...RING,
    // 47–50: nach Norden, zum Wetterschacht
    [-262, 70, -28],
    [-258, 30, -28],
    [-250, -8, -28],
    [-228, -34, -28],
    // 51–67: Wetterschacht – in der Wendel hinauf (zwei Runden rechts herum)
    ...WETTER,
    // 68: zurück auf den Zechenplatz
    [-146, -40, 1],
  ],
  roadHalf: 6.4,
  shoulder: 1.8,
  startAt: 0,
  laps: 3,
  bank: 1.2,
  fallDepth: 8,
  landmarkAt: 6,
  widths: [
    // Lorenbahn: schmal, zwei Gleise und je ein Laufsteg
    [4.0, 25.6, 3.6, 0.8],
    // Schwebeband in der Geode
    [39.0, 46.6, 5.6, 0.9],
  ],
  rails: [
    {
      from: 4.0,
      to: 25.6,
      lanes: [L, R],
      // In der Wendel halten die Bremsstrecken das Tempo im Zaum.
      brakes: [
        [7.5, 9.5, 24],
        [11.5, 13.5, 24],
        [15.5, 18.5, 23],
      ],
    },
  ],
  banks: [
    // Wetterschacht: die Wendel ist kräftig nach innen geneigt (gut 28°)
    [51.3, 67.2, -0.55],
    // Hauptschacht: leicht geneigt
    [6.3, 18, -0.2],
    // flach an der Weiche und der Einmündung
    [19, 20.6, 0],
    [25, 26, 0],
    // Geode: das Band liegt eben (die Verdrehung macht das Bild)
    [38.5, 47, 0],
  ],
  bands: [
    {
      from: 39.0,
      to: 46.6,
      radius: GEODE.axis,
      twists: [
        [39.6, 0],
        [41.6, 90],
        [43.7, 90],
        [45.9, 0],
      ],
    },
  ],
  surfaces: [
    [4.0, 25.6, 'metal'],
    [26, 39.0, 'rock'],
    [39.0, 46.6, 'band'],
    [46.6, 67.5, 'rock'],
  ],
  dives: [[35.9, 38.7]],
  // Alles unter Tage liegt in Stollen und Höhlen (die zeichnet die Kulisse); die Wendeln hängen frei im Schacht.
  decks: [
    [5, 18.5],
    [39.1, 47],
    [50.8, 68],
  ],
  // Sprengstrecke: drei Ladungen am Rand und in der Mitte, reihum alle 7 s (je 2,4 s versetzt)
  blasts: [
    { at: 28.2, lat: -4.4, period: 7, phase: 0 },
    { at: 28.65, lat: 4.4, period: 7, phase: 2.4 },
    { at: 29.1, lat: -1.5, period: 7, phase: 4.8 },
  ],
  hazards: [{ at: 26.6, amp: 4.6, period: 5, phase: 0.8 }],
  pads: [
    { at: 1.4, lat: 0 },
    { at: 26.9, lat: 0 },
    { at: 47.6, lat: 0 },
  ],
  boxRows: [0.7, 27.4, 32.4, 48.3],
  branches: [
    // a) Sprengort: geradeaus statt im Bogen um den Erzkörper – nur solange das Signal grün ist (die Weiche gestellt).
    {
      from: 19.5,
      to: 25.5,
      shortcut: 'window',
      points: [
        [-20, -2, -29.8],
        [-55, -2, -30],
        [-90, -1, -30],
      ],
      rails: [{ from: 0, to: 4, lanes: [L, R] }],
      roadHalf: 3.6,
      shoulder: 0.8,
      surface: 'metal',
      // Alle 14 s: 6 s frei, dann verschüttet (gesprengt wird im verschütteten Sprengort).
      gates: [{ closes: 6, opens: 14, every: 14 }],
    },
    // b) Alter Mann: der enge alte Stollen, ein Bohlensteg ohne Geländer über dem Rolloch.
    {
      from: 29.7,
      to: 35.6,
      shortcut: 'risk',
      points: [
        [-164, 122, -32.2],
        [-180, 148, -33.4],
        [-199, 165, -34.8],
      ],
      roadHalf: 2.8,
      shoulder: 0.3,
      surface: 'wood',
      open: [[0.6, 3.4, 0]],
      decks: [[0.6, 3.4]],
    },
  ],
};

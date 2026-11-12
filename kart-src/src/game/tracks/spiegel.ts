// 14 · Spiegelkabinett – ein Glaspalast im Park, innen eine Zickzack-Galerie aus Spiegeln.
//
// In der Fahrbahn stehen goldene Rahmen (mechanics.ts: Portal). Ist ein Rahmen leer, fährt man hindurch wie
// durch ein Tor. Schimmert darin ein Spiegel, kommt man im selben Augenblick aus einem anderen Rahmen wieder
// heraus – gleiche Spur, gleiches Tempo:
//   türkis – der Spiegel führt vorwärts: aus dem Rahmen jenseits der Kehre, die Kehre ist gespart.
//   pink   – der Spiegel wirft zurück: ein Stück vor den Rahmen, den man gerade ansteuerte.
// Drei Stellen: der Zeitspiegel im Spiegelsaal (nur vier von zehn Sekunden offen), die Zwillingsspiegel
// (links und rechts tauschen alle sechs Sekunden vorwärts gegen zurück) und der Randspiegel auf der Galerie
// (immer offen, aber ganz außen, wo das Geländer fehlt).
//
// (Lage: x nach Osten, z nach Süden – in Fahrtrichtung +z liegt rechts −x.)

import type { TrackDef } from '../track';

export const SPIEGEL: TrackDef = {
  id: 'spiegel',
  name: 'Spiegelkabinett',
  theme: 'spiegel',
  blurb: 'Vorplatz, Spiegelsaal, zwei Kehren im Zickzack, Rampe zur Galerie, Sprung durchs Rosettenfenster, Orangerie.',
  twist: 'In der Bahn stehen Spiegel: Türkis spart die Kehre, Pink wirft zurück. Der erste ist nur zeitweise offen, die Zwillinge tauschen alle sechs Sekunden die Seiten.',
  grade: 3,
  scale: 1.5,
  surface: 'marble',
  points: [
    // 0–2: Vorplatz, nach Osten (Start)
    [-80, -132, 4],
    [-28, -134, 4],
    [24, -132, 4],
    // 3–4: Rechtsbogen nach Süden, durchs Portal in den Palast
    [68, -124, 4],
    [93, -100, 4],
    // 5–7: Spiegelsaal, nach Süden (bei 6.85 der Zeitspiegel)
    [98, -64, 4],
    [98, -22, 4],
    [98, 10, 4],
    // 8–10: erste Kehre (rechts)
    [94.49, 18.49, 4],
    [86, 22, 4],
    [77.51, 18.49, 4],
    // 11–13: zurück nach Norden (bei 12.85 die Zwillingsspiegel)
    [74, 10, 4],
    [74, -20, 4],
    [74, -50, 4],
    // 14–16: zweite Kehre (links)
    [70.49, -58.49, 4],
    [62, -62, 4],
    [53.51, -58.49, 4],
    // 17–20: wieder nach Süden, die Rampe hinauf zur Galerie
    [50, -50, 4],
    [50, -18, 4.6],
    [50, 16, 6.6],
    [43, 50, 8.6],
    // 21–24: die Galerie, ein weiter Rechtsbogen um den Innenhof (bei 22.0 der Randspiegel, links außen)
    [20, 78, 9.2],
    [-18, 88, 9.2],
    [-56, 76, 9.2],
    [-80, 46, 9.2],
    // 25: Anlauf – bei 25.3 der Sprung durchs Rosettenfenster. 26: Landung im Park
    [-86, 8, 9.2],
    [-90, -34, 4.4],
    // 27–29: Orangerie, S-Kurve zurück zum Vorplatz
    [-112, -66, 4],
    [-122, -100, 4],
    [-108, -126, 4],
  ],
  roadHalf: 6.4,
  shoulder: 2,
  startAt: 0,
  laps: 3,
  bank: 1.2,
  fallDepth: 6,
  landmarkAt: 9,
  surfaces: [[26.4, 4.4, 'cobble']],
  portals: [
    // Zeitspiegel: vor der ersten Kehre, linke Hälfte (außen); Ausgang hinter der Kehre
    { at: 6.85, to: 11.15, lat0: -6.0, lat1: -1.2, opens: 0, closes: 4, every: 10 },
    // Zwillingsspiegel vor der zweiten Kehre: links und rechts tauschen alle 6 s (dazwischen eine halbe Sekunde leer)
    { at: 12.85, to: 17.15, lat0: -6.2, lat1: -1.6, opens: 0, closes: 5.5, every: 12 },
    { at: 12.85, to: 11.9, lat0: -6.2, lat1: -1.6, opens: 6, closes: 11.5, every: 12 },
    { at: 12.85, to: 17.15, lat0: 1.6, lat1: 6.2, opens: 6, closes: 11.5, every: 12 },
    { at: 12.85, to: 11.9, lat0: 1.6, lat1: 6.2, opens: 0, closes: 5.5, every: 12 },
    // Randspiegel auf der Galerie: immer offen, ganz außen (links – die Galerie ist ein Rechtsbogen)
    { at: 22.0, to: 22.75, lat0: -6.0, lat1: -2.6 },
  ],
  // Galerie: frei stehend; außen fehlt am Randspiegel das Geländer
  decks: [[20.4, 25.4]],
  open: [[21.5, 22.3, -1]],
  // Sprung durchs Rosettenfenster
  ramps: [{ at: 25.3, length: 8, height: 1.0, gap: 9 }],
  pads: [
    { at: 2.4, lat: 0 },
    { at: 18.6, lat: 0 },
    { at: 25.12, lat: 0 },
    { at: 28.4, lat: 0 },
  ],
  boxRows: [1.4, 5.4, 19.6, 23.6, 27.4],
};

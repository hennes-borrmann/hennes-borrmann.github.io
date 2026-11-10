// Untergründe: worauf gefahren wird. Jeder sieht anders aus (siehe
// render/world.ts) und fährt sich etwas anders – deutlich genug, dass man es
// merkt, aber nie so stark, dass eine Strecke zur Glückssache wird.

export type SurfaceId = 'asphalt' | 'wood' | 'sand' | 'dirt' | 'gravel' | 'grass' | 'rock' | 'metal' | 'cobble' | 'neon';

export interface Surface {
  id: SurfaceId;
  name: string;
  /** Faktor auf den Halt in Kurven (1 = Asphalt); weniger Halt heißt auch: das Heck rutscht länger. */
  grip: number;
  /** Faktor auf die Höchstgeschwindigkeit. */
  speed: number;
  /** Faktor auf die Beschleunigung. */
  accel: number;
}

/** Reihenfolge = Nummer im Feld Track.surf. */
export const SURFACES: Surface[] = [
  { id: 'asphalt', name: 'Asphalt', grip: 1, speed: 1, accel: 1 },
  // Holzbohlen: Stege und Brücken – rumpelt, hält aber ordentlich.
  { id: 'wood', name: 'Holzbohlen', grip: 0.96, speed: 1, accel: 1 },
  // Sand: weich und rutschig, kostet Tempo – dafür driftet es sich weit.
  { id: 'sand', name: 'Sand', grip: 0.82, speed: 0.95, accel: 0.9 },
  // Waldweg: fester Lehm mit Fahrrinnen.
  { id: 'dirt', name: 'Waldweg', grip: 0.9, speed: 0.98, accel: 0.95 },
  // Schotter: lose Steine, das Heck kommt schnell.
  { id: 'gravel', name: 'Schotter', grip: 0.85, speed: 0.97, accel: 0.92 },
  // Wiese: weich, bremst etwas.
  { id: 'grass', name: 'Wiese', grip: 0.88, speed: 0.94, accel: 0.92 },
  // Fels: rau und griffig.
  { id: 'rock', name: 'Fels', grip: 1.05, speed: 1, accel: 1 },
  // Stahlplatten und Gitterroste: schnell, aber glatt.
  { id: 'metal', name: 'Stahl', grip: 0.92, speed: 1.02, accel: 1 },
  // Kopfsteinpflaster: holprig, etwas langsamer.
  { id: 'cobble', name: 'Pflaster', grip: 0.95, speed: 0.97, accel: 1 },
  // Glatter Stadtasphalt mit Leuchtmarkierung: griffig und schnell.
  { id: 'neon', name: 'Neon-Asphalt', grip: 1.03, speed: 1.02, accel: 1 },
];

export const SURFACE_INDEX = Object.fromEntries(SURFACES.map((s, i) => [s.id, i])) as Record<SurfaceId, number>;

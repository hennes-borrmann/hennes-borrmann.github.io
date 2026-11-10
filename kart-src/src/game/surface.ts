// Untergründe: worauf gefahren wird. Jeder sieht anders aus (siehe
// render/world.ts) und fährt sich spürbar anders: Sand und Schotter rutschen
// und laden den Drift schnell, Stahl ist schnell und glatt, Fels und der
// Stadtasphalt kleben. Die KI plant mit denselben Werten.

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
  /** Faktor auf die Bremse. */
  brake: number;
  /** Zusätzliche Drift-Ladung: Anteil der Ticks, in denen der Mini-Turbo doppelt lädt (loser Grund driftet sich gut). */
  charge: number;
}

/** Reihenfolge = Nummer im Feld Track.surf. */
export const SURFACES: Surface[] = [
  { id: 'asphalt', name: 'Asphalt', grip: 1, speed: 1, accel: 1, brake: 1, charge: 0 },
  // Holzbohlen: Stege und Brücken – rumpelt, hält aber ordentlich.
  { id: 'wood', name: 'Holzbohlen', grip: 0.93, speed: 1, accel: 1, brake: 0.9, charge: 0 },
  // Sand: weich und rutschig, kostet Tempo – dafür driftet es sich weit, und der Turbo lädt schnell.
  { id: 'sand', name: 'Sand', grip: 0.72, speed: 0.93, accel: 0.85, brake: 0.8, charge: 0.5 },
  // Waldweg: fester Lehm mit Fahrrinnen – das Heck arbeitet.
  { id: 'dirt', name: 'Waldweg', grip: 0.83, speed: 0.97, accel: 0.93, brake: 0.85, charge: 0.25 },
  // Schotter: lose Steine, das Heck kommt schnell.
  { id: 'gravel', name: 'Schotter', grip: 0.75, speed: 0.96, accel: 0.9, brake: 0.75, charge: 0.4 },
  // Wiese: weich, bremst.
  { id: 'grass', name: 'Wiese', grip: 0.8, speed: 0.91, accel: 0.88, brake: 0.8, charge: 0.25 },
  // Fels: rau und griffig.
  { id: 'rock', name: 'Fels', grip: 1.1, speed: 1, accel: 1, brake: 1.1, charge: 0 },
  // Stahlplatten und Gitterroste: schnell, aber glatt – bremsen dauert.
  { id: 'metal', name: 'Stahl', grip: 0.8, speed: 1.06, accel: 1, brake: 0.6, charge: 0 },
  // Kopfsteinpflaster: holprig, etwas langsamer.
  { id: 'cobble', name: 'Pflaster', grip: 0.9, speed: 0.95, accel: 0.95, brake: 0.9, charge: 0 },
  // Glatter Stadtasphalt mit Leuchtmarkierung: griffig und schnell.
  { id: 'neon', name: 'Neon-Asphalt', grip: 1.08, speed: 1.03, accel: 1.05, brake: 1.1, charge: 0 },
];

export const SURFACE_INDEX = Object.fromEntries(SURFACES.map((s, i) => [s.id, i])) as Record<SurfaceId, number>;

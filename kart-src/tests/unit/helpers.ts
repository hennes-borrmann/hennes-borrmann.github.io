// Hilfen für die Tests.

import { TRACK } from '../../src/game/track';

/**
 * Führt fn auf der aktiven Strecke ohne Streckenmechanik aus (kein Verkehr,
 * keine Geysire, keine Lava) – für Messungen, die nur Verlauf und Fahrwerk
 * vergleichen sollen und sonst vom Zufall des Verkehrs abhingen.
 */
export function withoutMechanics<T>(fn: () => T): T {
  const t = TRACK;
  const keep = { vehicles: t.vehicles, pulses: t.pulses, floods: t.floods };
  t.vehicles = [];
  t.pulses = [];
  t.floods = [];
  try {
    return fn();
  } finally {
    t.vehicles = keep.vehicles;
    t.pulses = keep.pulses;
    t.floods = keep.floods;
  }
}

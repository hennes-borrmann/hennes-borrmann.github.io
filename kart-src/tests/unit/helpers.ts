// Hilfen für die Tests.

import { TRACK } from '../../src/game/track';

/**
 * Führt fn auf der aktiven Strecke ohne Streckenmechanik aus (kein Verkehr,
 * keine Geysire, keine Lava, keine Bänder, keine Flut) – für Messungen, die nur Verlauf und Fahrwerk
 * vergleichen sollen und sonst vom Zufall des Verkehrs abhingen.
 */
export function withoutMechanics<T>(fn: () => T): T {
  const t = TRACK;
  const keep = { vehicles: t.vehicles, pulses: t.pulses, floods: t.floods, belts: t.belts, tide: t.tide };
  t.vehicles = [];
  t.pulses = [];
  t.floods = [];
  t.belts = [];
  t.tide = null;
  try {
    return fn();
  } finally {
    t.vehicles = keep.vehicles;
    t.pulses = keep.pulses;
    t.floods = keep.floods;
    t.belts = keep.belts;
    t.tide = keep.tide;
  }
}

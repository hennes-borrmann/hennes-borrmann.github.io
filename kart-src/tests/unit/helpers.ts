// Hilfen für die Tests.

import { TRACK } from '../../src/game/track';

/**
 * Führt fn auf der aktiven Strecke ohne Streckenmechanik aus (kein Verkehr,
 * keine Geysire, keine Lava, keine Bänder, keine Flut, kein Wind, kein Seegang) – für Messungen, die nur Verlauf und Fahrwerk
 * vergleichen sollen und sonst vom Zufall des Verkehrs abhingen.
 */
export function withoutMechanics<T>(fn: () => T): T {
  const t = TRACK;
  const keep = { vehicles: t.vehicles, pulses: t.pulses, floods: t.floods, belts: t.belts, tide: t.tide, winds: t.winds, pontoons: t.pontoons };
  t.vehicles = [];
  t.pulses = [];
  t.floods = [];
  t.belts = [];
  t.tide = null;
  t.winds = [];
  t.pontoons = [];
  try {
    return fn();
  } finally {
    t.vehicles = keep.vehicles;
    t.pulses = keep.pulses;
    t.floods = keep.floods;
    t.belts = keep.belts;
    t.tide = keep.tide;
    t.winds = keep.winds;
    t.pontoons = keep.pontoons;
  }
}

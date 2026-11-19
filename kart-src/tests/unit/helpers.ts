// Hilfen für die Tests.

import { TRACK } from '../../src/game/track';

/**
 * Führt fn auf der aktiven Strecke ohne Streckenmechanik aus (kein Verkehr, kein Raupentransporter,
 * keine Geysire, keine Lava, keine Bänder, keine Flut, kein Wind, kein Seegang, keine Bruchstellen, keine Tore, keine Portale) – für Messungen, die nur Verlauf und Fahrwerk
 * vergleichen sollen und sonst vom Zufall des Verkehrs abhingen. except: was trotzdem bleibt.
 */
export function withoutMechanics<T>(fn: () => T, except: ('vehicles' | 'gates')[] = []): T {
  const t = TRACK;
  const keep = { crawler: t.crawler, vehicles: t.vehicles, pulses: t.pulses, floods: t.floods, belts: t.belts, tide: t.tide, winds: t.winds, pontoons: t.pontoons, holes: t.holes, gates: t.gates, rivers: t.rivers, portals: t.portals };
  t.vehicles = [];
  t.crawler = null;
  t.pulses = [];
  t.floods = [];
  t.belts = [];
  t.tide = null;
  t.winds = [];
  t.pontoons = [];
  t.holes = [];
  t.gates = [];
  t.rivers = [];
  t.portals = [];
  // (Die Abkürzung über das Zugdach der Neonhochbahn gibt es nur mit Zug – und mit dem Tor, das ihn abwartet.)
  if (except.includes('vehicles')) {
    t.vehicles = keep.vehicles;
    t.crawler = keep.crawler;
  }
  if (except.includes('gates')) t.gates = keep.gates;
  try {
    return fn();
  } finally {
    t.vehicles = keep.vehicles;
    t.crawler = keep.crawler;
    t.pulses = keep.pulses;
    t.floods = keep.floods;
    t.belts = keep.belts;
    t.tide = keep.tide;
    t.winds = keep.winds;
    t.pontoons = keep.pontoons;
    t.holes = keep.holes;
    t.gates = keep.gates;
    t.rivers = keep.rivers;
    t.portals = keep.portals;
  }
}

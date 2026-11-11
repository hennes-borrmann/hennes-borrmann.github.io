// Darstellung der Streckenmechanik (game/mechanics.ts): Verkehr, Geysire,
// Lavabomben, Lavaschwall. Anders als die Kulisse (life.ts) greift das hier
// ins Rennen ein – deshalb läuft alles im Takt der Rennzeit, nicht der Uhr des
// Bildschirms: was hier zu sehen ist, steht genau dort, wo die Physik es hat.

import type * as THREE from 'three';
import type { Track } from '../game/track';
import type { FxSink } from './fxApi';
import type { World } from './world';
import { PULSE_PRESS } from '../game/mechanics';
import { buildFlight, hasGlide } from './mechanics/flight';
import { buildLava } from './mechanics/lava';
import { buildMachines } from './mechanics/machines';
import { buildTide } from './mechanics/tide';
import { buildTraffic } from './mechanics/traffic';

export interface MechanicView {
  readonly group: THREE.Group;
  /**
   * Pro Bild.
   * @param time    Rennzeit in Ticks seit "Los" (gebrochen, im Countdown negativ) – RaceView.time
   * @param seconds Sekunden seit Aufbau der Szene (für Flackern und andere reine Zierde)
   * @param cam     Kameraposition
   * @param fx      Teilchen der Szene (fxApi.ts)
   */
  update(time: number, seconds: number, dt: number, cam: THREE.Vector3, fx: FxSink): void;
  dispose(): void;
}

/**
 * Alles, was die Strecke an Mechanik hat. detail = false auf schwachen Geräten: weniger Zierde, gleiche Hindernisse.
 * world: die stehende Welt der Strecke – die Gezeiten heben und senken ihr Meer.
 */
export function buildMechanics(track: Track, detail: boolean, world: World): MechanicView[] {
  const out: MechanicView[] = [];
  if (track.vehicles.length > 0) out.push(buildTraffic(track, detail));
  const presses = track.pulses.some((p) => p.kind === PULSE_PRESS);
  if (track.pulses.some((p) => p.kind !== PULSE_PRESS) || track.floods.length > 0) out.push(buildLava(track, detail));
  if (track.belts.length > 0 || presses) out.push(buildMachines(track, detail));
  if (track.tide) out.push(buildTide(track, detail, world));
  if (track.thermals.length > 0 || track.rings.length > 0 || hasGlide(track)) out.push(buildFlight(track, detail));
  return out;
}

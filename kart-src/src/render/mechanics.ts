// Darstellung der Streckenmechanik (game/mechanics.ts): Verkehr, Geysire,
// Lavabomben, Lavaschwall. Anders als die Kulisse (life.ts) greift das hier
// ins Rennen ein – deshalb läuft alles im Takt der Rennzeit, nicht der Uhr des
// Bildschirms: was hier zu sehen ist, steht genau dort, wo die Physik es hat.

import type * as THREE from 'three';
import type { Track } from '../game/track';
import type { FxSink } from './fxApi';
import type { World } from './world';
import { PULSE_AVALANCHE, PULSE_BOMB, PULSE_BUBBLE, PULSE_ICICLE, PULSE_METEOR, PULSE_PRESS, PULSE_VENT } from '../game/mechanics';
import { buildDive } from './mechanics/dive';
import { buildFlight, hasGlide } from './mechanics/flight';
import { buildHarbor } from './mechanics/harbor';
import { buildLava } from './mechanics/lava';
import { buildMachines } from './mechanics/machines';
import { buildMirrors } from './mechanics/mirrors';
import { buildMoon } from './mechanics/moon';
import { buildRift } from './mechanics/rift';
import { buildRiver } from './mechanics/river';
import { buildSizers } from './mechanics/sizers';
import { buildSnow } from './mechanics/snow';
import { buildStorm } from './mechanics/storm';
import { buildTide } from './mechanics/tide';
import { buildTraffic } from './mechanics/traffic';
import { buildTrain } from './mechanics/train';
import { buildVolcano } from './mechanics/volcano';

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
  if (track.vehicles.some((v) => !v.roofs)) out.push(buildTraffic(track, detail));
  if (track.roofed) out.push(buildTrain(track, detail));
  const presses = track.pulses.some((p) => p.kind === PULSE_PRESS);
  if (track.pulses.some((p) => p.kind === PULSE_VENT || p.kind === PULSE_BOMB) || track.floods.length > 0) out.push(buildLava(track, detail));
  // (Im Dschungel ist ein „Band“ die Querströmung der Furt: die zeichnet mechanics/river.ts.)
  if ((track.belts.some((b) => !b.swim) && track.def.theme !== 'dschungel') || presses) out.push(buildMachines(track, detail));
  if (track.tide) out.push(buildTide(track, detail, world));
  if (track.thermals.length > 0 || track.rings.length > 0 || hasGlide(track)) out.push(buildFlight(track, detail));
  if (track.belts.some((b) => b.swim) || track.pulses.some((p) => p.kind === PULSE_BUBBLE)) out.push(buildDive(track, detail));
  if (track.pulses.some((p) => p.kind === PULSE_AVALANCHE || p.kind === PULSE_ICICLE)) out.push(buildSnow(track, detail));
  if (track.launchers.length > 0 || track.pulses.some((p) => p.kind === PULSE_METEOR)) out.push(buildMoon(track, detail));
  if (track.winds.length > 0 || track.pontoons.length > 0) out.push(buildHarbor(track, detail));
  if (track.dark) out.push(buildStorm(track, detail, world));
  if (track.rivers.length > 0) out.push(buildRiver(track, detail));
  if (track.portals.length > 0) out.push(buildMirrors(track, detail));
  if (track.sizers.length > 0) out.push(buildSizers(track, detail));
  if (track.era) out.push(buildRift(track, detail));
  else if (track.holes.length > 0 || track.gates.some((g) => g.only === 0)) out.push(buildVolcano(track, detail));
  return out;
}

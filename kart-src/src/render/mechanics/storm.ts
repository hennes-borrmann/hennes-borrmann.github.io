// Gewitterkamm: Darstellung des Gewitters – Blitzeinschläge, Blitzableiter mit Ladefeld, Leitpfosten,
// und das Wetterleuchten, das Licht und Dunst der Welt im Takt aufhellt.
// PLATZHALTER – wird ausgearbeitet. Bis dahin: nur das Aufhellen (damit man überhaupt etwas sieht).

import * as THREE from 'three';
import { stormLight } from '../../game/mechanics';
import type { Track } from '../../game/track';
import type { MechanicView } from '../mechanics';
import type { World } from '../world';

export function buildStorm(track: Track, _detail: boolean, world: World): MechanicView {
  const group = new THREE.Group();
  const fog = world.fog;
  const base = { color: fog.color.clone(), near: fog.near, far: fog.far, hemi: world.hemi.intensity, sun: world.sun.intensity };
  const lit = new THREE.Color(0x8fa6d8);
  return {
    group,
    update(time) {
      const k = stormLight(track.pulses, track.flashes, time);
      fog.color.copy(base.color).lerp(lit, k * 0.7);
      fog.far = base.far + 520 * k;
      world.hemi.intensity = base.hemi + 2.4 * k;
      world.sun.intensity = base.sun + 2.2 * k;
    },
    dispose() {
      fog.color.copy(base.color);
      fog.near = base.near;
      fog.far = base.far;
      world.hemi.intensity = base.hemi;
      world.sun.intensity = base.sun;
    },
  };
}

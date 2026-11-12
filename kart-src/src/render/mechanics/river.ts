// Dschungel-Fluss: Darstellung des Flusses – Wasser, Flöße (der Boden, auf dem gefahren wird), Wasserfall.
// PLATZHALTER – wird ausgearbeitet.

import * as THREE from 'three';
import type { Track } from '../../game/track';
import type { MechanicView } from '../mechanics';

export function buildRiver(_track: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  return {
    group,
    update() {},
    dispose() {},
  };
}

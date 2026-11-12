// Kulisse der Zeitriss-Ruine.
// PLATZHALTER – wird ausgearbeitet.

import * as THREE from 'three';
import type { Life } from '../life';
import type { World } from '../world';

export function buildRuineLife(_world: World): Life {
  const group = new THREE.Group();
  return {
    group,
    update() {},
    dispose() {},
  };
}

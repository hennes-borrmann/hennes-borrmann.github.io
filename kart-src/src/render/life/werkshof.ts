// Platzhalter – wird durch die lebendige Kulisse dieser Welt ersetzt.

import * as THREE from 'three';
import type { Life } from '../life';
import type { World } from '../world';

export function buildWerkshofLife(_world: World): Life {
  return { group: new THREE.Group(), update: () => {}, dispose: () => {} };
}

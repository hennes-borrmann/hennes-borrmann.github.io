// Leben der Welt „Mondbasis: Kuppelstadt am Kraterrand“. (Platzhalter – wird ausgebaut.)

import * as THREE from 'three';
import type { Life } from '../life';
import type { World } from '../world';

export function buildMondLife(_world: World): Life {
  const group = new THREE.Group();
  return {
    group,
    update(): void {},
    dispose(): void {},
  };
}

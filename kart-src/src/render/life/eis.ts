// Leben der Welt „Eiszapfen-Pass: verschneiter Gebirgspass“. (Platzhalter – wird ausgebaut.)

import * as THREE from 'three';
import type { Life } from '../life';
import type { World } from '../world';

export function buildEisLife(_world: World): Life {
  const group = new THREE.Group();
  return {
    group,
    update(): void {},
    dispose(): void {},
  };
}

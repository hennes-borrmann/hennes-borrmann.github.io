// Vulkaninsel: Darstellung der Bruchstellen (samt der Fahrbahn dort) und der Tore.
// PLATZHALTER – wird ausgearbeitet.

import * as THREE from 'three';
import type { Track } from '../../game/track';
import type { MechanicView } from '../mechanics';

export function buildVolcano(_track: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  return {
    group,
    update() {},
    dispose() {},
  };
}

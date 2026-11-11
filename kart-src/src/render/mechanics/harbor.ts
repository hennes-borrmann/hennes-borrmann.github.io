// Sturmhafen: Darstellung der Pontons (samt Übergängen) und des Winds.
// PLATZHALTER – wird ausgearbeitet.

import * as THREE from 'three';
import type { Track } from '../../game/track';
import type { MechanicView } from '../mechanics';

export function buildHarbor(_track: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  return {
    group,
    update() {},
    dispose() {},
  };
}

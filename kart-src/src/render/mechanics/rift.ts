// Zeitriss-Ruine: Darstellung der beiden Zeitalter – Hallenboden, Aquädukt, Mauer der Schatzkammer, Uhr.
// PLATZHALTER – wird ausgearbeitet.

import * as THREE from 'three';
import type { Track } from '../../game/track';
import type { MechanicView } from '../mechanics';

export function buildRift(_track: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  return {
    group,
    update() {},
    dispose() {},
  };
}

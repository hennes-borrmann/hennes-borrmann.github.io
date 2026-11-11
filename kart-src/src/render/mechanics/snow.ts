// Darstellung von Lawinen und Eiszapfen (Eiszapfen-Pass). Platzhalter – wird ausgearbeitet.

import * as THREE from 'three';
import type { Track } from '../../game/track';
import type { MechanicView } from '../mechanics';

export function buildSnow(_track: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  group.name = 'schnee';
  return { group, update() {}, dispose() {} };
}

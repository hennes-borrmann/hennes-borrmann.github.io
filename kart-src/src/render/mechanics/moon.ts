// Darstellung von Sprungplatten und Meteoriten (Mondbasis). Platzhalter – wird ausgearbeitet.

import * as THREE from 'three';
import type { Track } from '../../game/track';
import type { MechanicView } from '../mechanics';

export function buildMoon(_track: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  group.name = 'mond';
  return { group, update() {}, dispose() {} };
}

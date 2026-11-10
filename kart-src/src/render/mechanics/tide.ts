// Möwenklippe: Ebbe und Flut.
//
// VORLÄUFIG: eine schlichte Wasserfläche auf Höhe des Pegels über der Bucht,
// damit das Rennen spielbar ist. Die richtige Darstellung ersetzt diese Datei.

import * as THREE from 'three';
import { tideLevel } from '../../game/mechanics';
import type { Track } from '../../game/track';
import type { MechanicView } from '../mechanics';

export function buildTide(track: Track, _detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  // Mitte und Ausdehnung der Stücke, auf denen die Gezeit gilt
  let cx = 0;
  let cz = 0;
  let n = 0;
  for (let i = 0; i < t.total; i++) {
    if (!t.tidal[i]) continue;
    cx += t.px[i];
    cz += t.pz[i];
    n++;
  }
  cx /= Math.max(1, n);
  cz /= Math.max(1, n);
  let r = 60;
  for (let i = 0; i < t.total; i++) if (t.tidal[i]) r = Math.max(r, Math.hypot(t.px[i] - cx, t.pz[i] - cz) + 40);
  const geo = new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x3fb6d8, transparent: true, opacity: 0.72, depthWrite: false });
  const water = new THREE.Mesh(geo, mat);
  water.position.set(cx, 0, cz);
  group.add(water);
  return {
    group,
    update(time) {
      if (t.tide) water.position.y = tideLevel(t.tide, time);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

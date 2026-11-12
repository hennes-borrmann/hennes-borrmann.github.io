// Riesenkinderzimmer: Darstellung der Größenringe (blau = schrumpfen, orange = wachsen) und der Größentore
// (Mauseloch, Bauklotz-Burg).
// PLATZHALTER – wird ausgearbeitet: schlichte Ringe an den Stellen der Physik, damit die Strecke fahrbar und prüfbar ist.

import * as THREE from 'three';
import { rightX, rightZ, type Track } from '../../game/track';
import type { MechanicView } from '../mechanics';

export function buildSizers(track: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const rings: THREE.Mesh[] = [];
  for (const z of track.sizers) {
    const w = z.lat1 - z.lat0;
    const geo = new THREE.TorusGeometry(w / 2, 0.28, 6, 20);
    const mat = new THREE.MeshBasicMaterial({ color: z.grow ? 0xffa23a : 0x4fb3ff });
    geos.push(geo);
    mats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    const mid = (z.lat0 + z.lat1) / 2;
    // Der Ring steht am Ende des Abschnitts (dort zählt die Physik die Durchfahrt), sein unterer Rand auf der Fahrbahn.
    mesh.position.set(
      track.px[z.seg] + track.tx[z.seg] * track.step * 0.5 + rightX(track, z.seg) * mid,
      track.py[z.seg] + mid * track.bank[z.seg] + w / 2,
      track.pz[z.seg] + track.tz[z.seg] * track.step * 0.5 + rightZ(track, z.seg) * mid,
    );
    mesh.rotation.y = Math.atan2(track.tx[z.seg], track.tz[z.seg]);
    group.add(mesh);
    rings.push(mesh);
  }
  return {
    group,
    update(_time, seconds) {
      // ruhiges Atmen, damit die Ringe als „lebendig“ auffallen
      for (let i = 0; i < rings.length; i++) rings[i].scale.setScalar(1 + 0.04 * Math.sin(seconds * 2.4 + i));
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

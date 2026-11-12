// Achterbahn-Rummel: Darstellung der Schienen – je Schiene zwei Stahlprofile auf Schwellen – und der Schubmagnete,
// die im Takt aufleuchten.
// PLATZHALTER – wird ausgearbeitet: schlichte Bänder und Leuchtflächen, damit die Strecke fahrbar und prüfbar ist.

import * as THREE from 'three';
import { PULSE_KICK, pulseCycle, type Pulse } from '../../game/mechanics';
import { rightX, rightZ, type Track } from '../../game/track';
import type { MechanicView } from '../mechanics';

export function buildRails(track: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  const pos: number[] = [];
  const col: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], r: number, g: number, bl: number): void => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) col.push(r, g, bl);
  };
  const at = (seg: number, lat: number, up: number): number[] => [
    track.px[seg] + rightX(track, seg) * lat,
    track.py[seg] + lat * track.bank[seg] + up,
    track.pz[seg] + rightZ(track, seg) * lat,
  ];
  for (const r of track.rails) {
    for (let k = 0; k < r.count - 1; k++) {
      const i = r.first + k;
      const j = track.next[i];
      for (const lane of r.lanes) {
        // zwei Stahlprofile
        for (const side of [-0.55, 0.55]) {
          const c = lane + side;
          quad(at(i, c - 0.07, 0.1), at(i, c + 0.07, 0.1), at(j, c + 0.07, 0.1), at(j, c - 0.07, 0.1), 0.72, 0.76, 0.8);
        }
        // Schwelle alle zwei Meter
        if (k % 2 === 0) quad(at(i, lane - 0.9, 0.04), at(i, lane + 0.9, 0.04), at(j, lane + 0.9, 0.04), at(j, lane - 0.9, 0.04), 0.3, 0.2, 0.13);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  group.add(new THREE.Mesh(geo, mat));

  // Schubmagnete: Leuchtfläche auf ihrer Schiene
  const kicks: { p: Pulse; mat: THREE.MeshBasicMaterial }[] = [];
  const plate = new THREE.PlaneGeometry(1.7, 9);
  plate.rotateX(-Math.PI / 2);
  for (const p of track.pulses) {
    if (p.kind !== PULSE_KICK) continue;
    const m = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const mesh = new THREE.Mesh(plate, m);
    mesh.position.set(p.x, p.y + 0.14, p.z);
    mesh.rotation.y = Math.atan2(track.tx[p.seg], track.tz[p.seg]);
    group.add(mesh);
    kicks.push({ p, mat: m });
  }

  return {
    group,
    update(time: number): void {
      for (const k of kicks) {
        const c = pulseCycle(k.p, time);
        // zieht an: hell; kündigt sich an: glimmt auf
        k.mat.opacity = c < k.p.on ? 0.9 : c >= k.p.period - k.p.warn ? 0.2 + (0.4 * (c - (k.p.period - k.p.warn))) / k.p.warn : 0.14;
      }
    },
    dispose(): void {
      geo.dispose();
      mat.dispose();
      plate.dispose();
      for (const k of kicks) k.mat.dispose();
    },
  };
}

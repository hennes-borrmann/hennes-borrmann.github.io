// Wüstenexpress: Darstellung der Züge – Lok, Keilwagen, Flachwagen, Rampenwagen – und des Gleises.
// PLATZHALTER – wird ausgearbeitet: schlichte Keile und Kästen in den Maßen der Physik, damit die Strecke
// fahrbar und prüfbar ist. Jeder Wagen steht dort, wo ihn die Physik hat (track.ts: vehiclePose).

import * as THREE from 'three';
import type { Vehicle } from '../../game/mechanics';
import { newVehiclePose, vehiclePose, type Track } from '../../game/track';
import type { MechanicView } from '../mechanics';
import { toonMaterial } from '../toon';

interface Car {
  mesh: THREE.Mesh;
  v: Vehicle;
  car: number;
}

/** Ein Wagen als Keil: Grundfläche 2·half × 2·halfWidth, Dachhöhe am Heck rear, am Bug front (z = Fahrtrichtung). */
function wedge(half: number, halfWidth: number, rear: number, front: number): THREE.BufferGeometry {
  const w = halfWidth;
  const base = 0.35;
  // unten (Fahrgestell hebt den Kasten vom Gleis ab), oben
  const p = [
    [-w, base, -half],
    [w, base, -half],
    [w, base, half],
    [-w, base, half],
    [-w, Math.max(base + 0.02, rear), -half],
    [w, Math.max(base + 0.02, rear), -half],
    [w, front, half],
    [-w, front, half],
  ];
  const quads = [
    [4, 7, 6, 5], // Dach
    [0, 1, 2, 3], // Boden
    [0, 4, 5, 1], // Heck
    [3, 2, 6, 7], // Bug
    [0, 3, 7, 4], // links
    [1, 5, 6, 2], // rechts
  ];
  const pos: number[] = [];
  for (const q of quads) for (const i of [q[0], q[1], q[2], q[0], q[2], q[3]]) pos.push(p[i][0], p[i][1], p[i][2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function buildTrain(track: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  const cars: Car[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const pose = newVehiclePose();
  const colors = [0x2d2f3a, 0x8a4a2a, 0xb5432e, 0x3f6f8f, 0xb5432e, 0x3f6f8f, 0xd9a13a];
  for (const v of track.vehicles) {
    if (!v.roofs) continue;
    for (let car = 0; car < v.cars; car++) {
      const r = v.roofs[Math.min(car, v.roofs.length - 1)];
      const geo = wedge(v.half, v.halfWidth, r[0], r[1]);
      const mat = toonMaterial({ color: colors[car % colors.length] });
      geos.push(geo);
      mats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.order = 'YXZ';
      group.add(mesh);
      cars.push({ mesh, v, car });
    }
  }
  return {
    group,
    update(time) {
      for (const c of cars) {
        const p = vehiclePose(track, c.v, c.car, time, pose);
        c.mesh.position.set(p.x, p.y, p.z);
        c.mesh.rotation.set(-Math.atan(p.slope), p.heading, 0);
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

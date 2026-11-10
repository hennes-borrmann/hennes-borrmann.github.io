// Verkehr: Taxis, Lieferwagen, Busse und die Straßenbahn.
//
// VORLÄUFIG: schlichte Kästen in den Maßen der Physik (VEHICLE_SPECS), damit
// das Rennen spielbar ist. Die richtigen Modelle ersetzen diese Datei.

import * as THREE from 'three';
import { VEH_BUS, VEH_TAXI, VEH_TRAM } from '../../game/mechanics';
import { newVehiclePose, vehiclePose, type Track } from '../../game/track';
import { MeshBuilder } from '../build';
import type { MechanicView } from '../mechanics';
import { rgb, toonMaterial, withOutline } from '../toon';

export function buildTraffic(track: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  const mat = toonMaterial({ vertexColors: true });
  const geos: THREE.BufferGeometry[] = [];
  const cars: { mesh: THREE.Mesh; v: number; car: number }[] = [];
  const pose = newVehiclePose();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  track.vehicles.forEach((v, vi) => {
    const b = new MeshBuilder();
    const body = v.kind === VEH_TAXI ? rgb(0xffc928) : v.kind === VEH_BUS ? rgb(0x3aa0e8) : v.kind === VEH_TRAM ? rgb(0xe8503a) : rgb(0xe9e6f2);
    b.box(0, v.height * 0.5 + 0.15, 0, v.halfWidth * 2, v.height - 0.3, v.half * 2, body);
    // Rücklichter
    b.box(0, v.height * 0.45, -v.half - 0.02, v.halfWidth * 1.6, 0.25, 0.06, rgb(0xff3030));
    const geo = b.build();
    geos.push(geo);
    for (let car = 0; car < v.cars; car++) {
      const mesh = new THREE.Mesh(geo, mat);
      withOutline(mesh, 0.06);
      group.add(mesh);
      cars.push({ mesh, v: vi, car });
    }
  });

  return {
    group,
    update(time) {
      for (const c of cars) {
        const p = vehiclePose(track, track.vehicles[c.v], c.car, time, pose);
        c.mesh.position.set(p.x, p.y, p.z);
        euler.set(-Math.atan(p.slope), p.heading, -Math.atan(p.bank));
        c.mesh.quaternion.setFromEuler(euler);
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      mat.dispose();
    },
  };
}

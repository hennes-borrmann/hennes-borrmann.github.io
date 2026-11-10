// Werkshof: Förderbänder und Stampfpressen.
//
// VORLÄUFIG: schlichte Flächen und Klötze an den Stellen der Physik, damit das
// Rennen spielbar ist. Die richtige Darstellung ersetzt diese Datei.

import * as THREE from 'three';
import { PULSE_PRESS, pulseCycle, pulseWarning } from '../../game/mechanics';
import { rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, type V3 } from '../build';
import type { MechanicView } from '../mechanics';
import { rgb } from '../toon';

export function buildMachines(track: Track, _detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  // Bänder: je Abschnitt ein Streifen, abwechselnd hell und dunkel; die Farbe wandert mit dem Band.
  const P = (s: number, lat: number, dy: number): V3 => [t.px[s] + rightX(t, s) * lat, t.py[s] + lat * t.bank[s] + dy, t.pz[s] + rightZ(t, s) * lat];
  const belts = t.belts.map((b) => {
    const mb = new MeshBuilder();
    for (let k = 0; k < b.count - 1; k++) {
      const i = b.first + k;
      const j = t.next[i];
      mb.quad(P(i, b.lat0 + 0.15, 0.03), P(i, b.lat1 - 0.15, 0.03), P(j, b.lat1 - 0.15, 0.03), P(j, b.lat0 + 0.15, 0.03), rgb(0xffffff));
    }
    const geo = mb.build();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    disposables.push(geo, mat);
    group.add(new THREE.Mesh(geo, mat));
    return { b, geo };
  });

  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  disposables.push(box);
  const presses = t.pulses
    .map((p, i) => ({ p, i }))
    .filter((x) => x.p.kind === PULSE_PRESS)
    .map(({ p }) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0x8792a0 });
      const lamp = new THREE.MeshBasicMaterial({ color: 0x402020 });
      disposables.push(mat, lamp);
      const plate = new THREE.Mesh(box, mat);
      plate.scale.set(p.radius * 2, 1.2, p.radius * 2);
      plate.rotation.y = Math.atan2(t.tx[p.seg], t.tz[p.seg]);
      const light = new THREE.Mesh(box, lamp);
      light.scale.set(0.6, 0.6, 0.6);
      light.position.set(p.x, p.y + 7.2, p.z);
      group.add(plate, light);
      return { p, plate, lamp };
    });

  return {
    group,
    update(time, seconds) {
      for (const { b, geo } of belts) {
        // Streifenmuster wandert mit dem Tempo des Bands
        const col = geo.getAttribute('color') as THREE.BufferAttribute;
        const shift = (seconds * (b.along !== 0 ? b.along : b.across)) / 2;
        const quads = col.count / 6;
        for (let q = 0; q < quads; q++) {
          const on = Math.floor(q - shift) % 2 === 0;
          const fwd = b.along > 0 || (b.along === 0 && b.across !== 0);
          const c = on ? (fwd ? [0.2, 0.85, 0.75] : [0.95, 0.45, 0.3]) : [0.16, 0.16, 0.2];
          for (let v = 0; v < 6; v++) col.setXYZ(q * 6 + v, c[0], c[1], c[2]);
        }
        col.needsUpdate = true;
      }
      for (const { p, plate, lamp } of presses) {
        const c = pulseCycle(p, time);
        const down = c < p.on;
        // Unten während der Gefahr, sonst oben; kurz vorher senkt sie sich an.
        const lift = down ? 0 : Math.max(0.2, 5.5 * (1 - Math.pow(pulseWarning(p, time), 6)));
        plate.position.set(p.x, p.y + lift, p.z);
        lamp.color.setHex(down || pulseWarning(p, time) > 0 ? (Math.floor(seconds * 8) % 2 === 0 ? 0xff3030 : 0x801010) : 0x30c060);
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

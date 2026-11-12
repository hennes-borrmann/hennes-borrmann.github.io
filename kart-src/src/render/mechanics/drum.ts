// Magnetwerk: Darstellung der Magnettrommel – die Röhre, an deren Innenwand die Bahn sich herumschraubt, und die
// Magnetplatten an der Decke, die im Takt abschalten.
// PLATZHALTER – wird ausgearbeitet: eine gestreifte Röhre (Hallenboden dunkel, Decke hell) und farbige Platten.
//
// Gezeichnet wird so, dass die Fahrbahn aufrecht bleibt und sich die Trommel um sie dreht (track.ts: drumPoint).

import * as THREE from 'three';
import { planActive, type Hole } from '../../game/mechanics';
import { EDGE_DRUM, drumPoint, rightX, rightZ, type Track } from '../../game/track';
import type { MechanicView } from '../mechanics';

const SIDES = 28;

export function buildDrum(track: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  const pos: number[] = [];
  const col: number[] = [];
  const P = { x: 0, y: 0, z: 0 };
  const c = new THREE.Color();
  for (const d of track.drums) {
    // Ringe alle 2 m; zwischen ihnen Vierecke. Die Fahrbahn selbst (±0,33 rad um die Bahn) lässt die Röhre frei.
    const rings: number[][][] = [];
    for (let k = 0; k < d.count; k += 2) {
      const seg = d.first + k;
      const ring: number[][] = [];
      for (let i = 0; i <= SIDES; i++) {
        const theta = (i / SIDES) * Math.PI * 2;
        drumPoint(track, seg, theta, d.radius + 1.4, d.radius, P);
        ring.push([P.x, P.y, P.z, theta]);
      }
      rings.push(ring);
    }
    for (let r = 0; r + 1 < rings.length; r++) {
      const seg = d.first + r * 2;
      for (let i = 0; i < SIDES; i++) {
        const a = rings[r][i];
        const b = rings[r][i + 1];
        const e = rings[r + 1][i + 1];
        const f = rings[r + 1][i];
        // die Bahn freilassen: Winkel relativ zur Bahn
        let rel = (a[3] + Math.PI / SIDES - track.roll[seg]) % (Math.PI * 2);
        if (rel < 0) rel += Math.PI * 2;
        if (rel < 0.36 || rel > Math.PI * 2 - 0.36) continue;
        // Hallenboden (theta um 0) dunkel, Decke hell, dazu Streifen längs der Röhre
        const down = Math.cos(a[3] + Math.PI / SIDES);
        c.setHSL(0.6, 0.12, 0.3 + 0.25 * (1 - down) / 2 + (i % 2 === 0 ? 0.05 : 0));
        if (r % 6 === 0) c.setHSL(0.08, 0.8, 0.5);
        pos.push(a[0], a[1], a[2], b[0], b[1], b[2], e[0], e[1], e[2], a[0], a[1], a[2], e[0], e[1], e[2], f[0], f[1], f[2]);
        for (let v = 0; v < 6; v++) col.push(c.r, c.g, c.b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(geo, mat));

  // Magnetplatten: an = blau, kündigt sich an = gelb, aus = dunkelrot
  const plates: { h: Hole; mat: THREE.MeshBasicMaterial }[] = [];
  for (const h of track.holes) {
    if ((track.edge[h.first] & EDGE_DRUM) === 0) continue;
    const p: number[] = [];
    for (let k = 0; k < h.count; k++) {
      const s = h.first + k;
      const n = track.next[s];
      const at = (seg: number, lat: number): number[] => [track.px[seg] + rightX(track, seg) * lat, track.py[seg] + lat * track.bank[seg] + 0.06, track.pz[seg] + rightZ(track, seg) * lat];
      p.push(...at(s, h.lat0), ...at(s, h.lat1), ...at(n, h.lat1), ...at(s, h.lat0), ...at(n, h.lat1), ...at(n, h.lat0));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const m = new THREE.MeshBasicMaterial({ color: 0x3a8cff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    group.add(new THREE.Mesh(g, m));
    plates.push({ h, mat: m });
  }

  return {
    group,
    update(time: number): void {
      for (const p of plates) {
        const off = planActive(p.h.plan, time);
        const soon = !off && planActive(p.h.plan, time + p.h.warn);
        p.mat.color.setHex(off ? 0x401010 : soon ? 0xffc23a : 0x3a8cff);
        p.mat.opacity = off ? 0.9 : 0.55;
      }
    },
    dispose(): void {
      geo.dispose();
      mat.dispose();
      for (const p of plates) {
        p.mat.dispose();
        (group.children.find((m) => (m as THREE.Mesh).material === p.mat) as THREE.Mesh | undefined)?.geometry.dispose();
      }
    },
  };
}

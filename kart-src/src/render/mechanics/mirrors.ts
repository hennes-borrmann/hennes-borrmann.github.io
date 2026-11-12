// Spiegelkabinett: Darstellung der Portale – Rahmen in der Fahrbahn, darin der Spiegel (türkis = vorwärts,
// pink = zurück, leer = zu), und der Rahmen am Ausgang.
// PLATZHALTER – wird ausgearbeitet: schlichte Rahmen und farbige Flächen, damit die Strecke fahrbar und prüfbar ist.

import * as THREE from 'three';
import { PORTAL_WARN, portalLeft, portalOpen, type Portal } from '../../game/mechanics';
import { rightX, rightZ, type Track } from '../../game/track';
import type { MechanicView } from '../mechanics';

interface Pane {
  mesh: THREE.Mesh;
  portals: Portal[];
}

const FORWARD = new THREE.Color(0x4fe3ff);
const BACK = new THREE.Color(0xff5fc4);

export function buildMirrors(track: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  const gold = new THREE.MeshBasicMaterial({ color: 0xcfa84a });
  const post = new THREE.BoxGeometry(0.35, 5, 0.35);
  const beam = new THREE.BoxGeometry(1, 0.35, 0.35);
  const panes: Pane[] = [];
  const mats: THREE.Material[] = [gold];
  const geos: THREE.BufferGeometry[] = [post, beam];

  const frame = (seg: number, lat0: number, lat1: number): THREE.Group => {
    const g = new THREE.Group();
    // Der Rahmen steht am Ende des Abschnitts (dort, wo die Physik die Durchfahrt zählt).
    const x = track.px[seg] + track.tx[seg] * track.step * 0.5;
    const z = track.pz[seg] + track.tz[seg] * track.step * 0.5;
    const rx = rightX(track, seg);
    const rz = rightZ(track, seg);
    const mid = (lat0 + lat1) / 2;
    g.position.set(x + rx * mid, track.py[seg] + mid * track.bank[seg], z + rz * mid);
    g.rotation.y = Math.atan2(track.tx[seg], track.tz[seg]);
    const w = lat1 - lat0;
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(post, gold);
      m.position.set((side * w) / 2, 2.5, 0);
      g.add(m);
    }
    const top = new THREE.Mesh(beam, gold);
    top.scale.x = w + 0.35;
    top.position.y = 5;
    g.add(top);
    group.add(g);
    return g;
  };

  // Rahmen je Stelle (Abschnitt und Seitenlage): mehrere Portale teilen sich einen Rahmen.
  const seen = new Map<string, Pane>();
  for (const p of track.portals) {
    const key = `${p.seg}:${p.lat0}:${p.lat1}`;
    let pane = seen.get(key);
    if (!pane) {
      const g = frame(p.seg, p.lat0, p.lat1);
      const geo = new THREE.PlaneGeometry(p.lat1 - p.lat0 - 0.35, 4.7);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
      geos.push(geo);
      mats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 2.5;
      g.add(mesh);
      pane = { mesh, portals: [] };
      seen.set(key, pane);
      panes.push(pane);
    }
    pane.portals.push(p);
    // Ausgang
    const out = frame(p.to, p.lat0, p.lat1);
    const geo = new THREE.PlaneGeometry(p.lat1 - p.lat0 - 0.35, 4.7);
    const mat = new THREE.MeshBasicMaterial({ color: p.kind === 0 ? FORWARD : BACK, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    geos.push(geo);
    mats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 2.5;
    out.add(mesh);
  }

  return {
    group,
    update(time, seconds) {
      for (const pane of panes) {
        let open: Portal | null = null;
        for (const p of pane.portals) if (portalOpen(p, time)) open = p;
        const mat = pane.mesh.material as THREE.MeshBasicMaterial;
        pane.mesh.visible = open !== null;
        if (!open) continue;
        mat.color.copy(open.kind === 0 ? FORWARD : BACK);
        // kurz vor dem Schließen: ruhiges Blinken (kein hartes Flackern)
        const left = portalLeft(open, time);
        mat.opacity = left < PORTAL_WARN ? 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(seconds * 9)) : 0.6;
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

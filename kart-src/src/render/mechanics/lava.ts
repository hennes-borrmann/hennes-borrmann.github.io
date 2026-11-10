// Glutkessel: Geysire, Lavabomben und der Lavaschwall in der Höhle.
//
// VORLÄUFIG: schlichte Scheiben und Säulen an den Stellen der Physik, damit
// das Rennen spielbar ist. Die richtige Darstellung ersetzt diese Datei.

import * as THREE from 'three';
import { FLOOD_DEPTH, PULSE_VENT, floodLevel, pulseCycle, pulseWarning } from '../../game/mechanics';
import { rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, type V3 } from '../build';
import type { MechanicView } from '../mechanics';
import { rgb } from '../toon';

export function buildLava(track: Track, _detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const disc = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  const column = new THREE.CylinderGeometry(0.7, 1, 1, 10).translate(0, 0.5, 0);
  disposables.push(disc, column);

  const marks = t.pulses.map((p) => {
    const base = new THREE.MeshBasicMaterial({ color: 0x1c1118 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xff7a1c, transparent: true, opacity: 0 });
    const jet = new THREE.MeshBasicMaterial({ color: 0xffb030 });
    disposables.push(base, glow, jet);
    const ring = new THREE.Mesh(disc, base);
    ring.position.set(p.x, p.y + 0.04, p.z);
    ring.scale.setScalar(p.kind === PULSE_VENT ? p.radius * 0.6 : 0.01);
    const warn = new THREE.Mesh(disc, glow);
    warn.position.set(p.x, p.y + 0.06, p.z);
    const pillar = new THREE.Mesh(column, jet);
    pillar.position.set(p.x, p.y, p.z);
    pillar.visible = false;
    group.add(ring, warn, pillar);
    return { ring, warn, pillar, glow };
  });

  const sheets = t.floods.map((f) => {
    const b = new MeshBuilder();
    const c = rgb(0xff6a14);
    for (let k = 0; k < f.count - 1; k++) {
      const i = f.first + k;
      const j = i + 1;
      const P = (s: number, lat: number): V3 => [t.px[s] + rightX(t, s) * lat, t.py[s] + lat * t.bank[s], t.pz[s] + rightZ(t, s) * lat];
      b.quad(P(i, -t.wh[i]), P(i, t.wh[i]), P(j, t.wh[j]), P(j, -t.wh[j]), c);
    }
    const geo = b.build();
    const mat = new THREE.MeshBasicMaterial({ color: 0xff6a14, transparent: true, opacity: 0.9 });
    disposables.push(geo, mat);
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    return mesh;
  });

  return {
    group,
    update(time, seconds) {
      t.pulses.forEach((p, i) => {
        const m = marks[i];
        const c = pulseCycle(p, time);
        const w = pulseWarning(p, time);
        const active = c < p.on;
        m.glow.opacity = active ? 0.9 : w * 0.8;
        m.warn.scale.setScalar(active ? p.radius : p.radius * (0.3 + 0.7 * w));
        m.pillar.visible = active && (p.kind === PULSE_VENT || c < 14);
        if (m.pillar.visible) m.pillar.scale.set(p.radius * 0.7, (p.kind === PULSE_VENT ? 7 : 3) * (0.8 + 0.2 * Math.sin(seconds * 30 + i)), p.radius * 0.7);
      });
      t.floods.forEach((f, i) => {
        const level = floodLevel(f, time);
        sheets[i].visible = level > 0.02;
        sheets[i].position.y = -0.1 + level * (FLOOD_DEPTH * 0.5);
      });
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

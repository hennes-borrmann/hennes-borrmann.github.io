// Neonhochbahn: der Atriumturm um die Abkürzung (a) – ein hohler Turm, durch dessen Lichthof der schmale Steg ohne
// Geländer führt. Rundum Galerien mit Leuchtbändern, tief unten der Boden des Lichthofs, oben ein Glasdach aus Trägern.
// Man soll beim Hineinfahren sehen: Hier geht es tief hinunter, und der Steg ist schmal.
//
// Stehende Geometrie, zwei Zeichenaufrufe (Körper, Leuchtendes). Wo die Hauptstrecke dem Turm nahe kommt (an Gabelung
// und Einmündung), bleibt die Wand weg – nichts steht je in einer Fahrbahn.

import * as THREE from 'three';
import { rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, shade, type RGB, type V3 } from '../build';
import type { MechanicView } from '../mechanics';
import { rgb, toonMaterial } from '../toon';

const WALL = rgb(0x1e2246);
const WALL_IN = rgb(0x161937);
const CYAN = rgb(0x5ff3ff);
const PINK = rgb(0xff3fae);
const VIOLET = rgb(0x9a6bff);
const BEAM = rgb(0x2c3160);
const FLOOR = rgb(0x0f1230);

/** Abstand der Wände von der Mitte des Stegs und wie hoch der Turm über den Steg ragt (Meter). */
const HALF = 13;
const ABOVE = 22;

export function buildAtrium(t: Track, branch: number): MechanicView {
  const group = new THREE.Group();
  group.name = 'Atrium';
  const b = t.branches[branch];
  const solid = new MeshBuilder();
  const glow = new MeshBuilder();
  const a0 = b.first + Math.round(b.count * 0.24);
  const a1 = b.first + Math.round(b.count * 0.78);
  const top = Math.max(t.py[a0], t.py[a1]) + ABOVE;
  const floor = Math.min(t.py[a0], t.py[a1]) - 34;
  const W = (i: number, lat: number, y: number): V3 => [t.px[i] + rightX(t, i) * lat, y, t.pz[i] + rightZ(t, i) * lat];
  /** Bleibt die Stelle frei von der Hauptstrecke (samt Bande und etwas Luft)? */
  const clear = (p: V3): boolean => {
    for (let k = 0; k < t.n; k += 3) {
      if (Math.abs(t.py[k] - p[1]) > 40) continue;
      if (Math.hypot(t.px[k] - p[0], t.pz[k] - p[2]) < t.wh[k] + 3) return false;
    }
    return true;
  };
  const STEP = 4;
  for (let i = a0; i < a1; i += STEP) {
    const j = Math.min(a1, i + STEP);
    const yi = t.py[i];
    for (const s of [-1, 1]) {
      const ok = clear(W(i, s * HALF, yi)) && clear(W(j, s * HALF, t.py[j]));
      if (!ok) continue;
      // Wand: außen und innen (innen dunkler), Dicke 1 m
      const oi = W(i, s * (HALF + 1), floor);
      const oj = W(j, s * (HALF + 1), floor);
      const ii = W(i, s * HALF, floor);
      const ij = W(j, s * HALF, floor);
      const up = (p: V3): V3 => [p[0], top, p[2]];
      if (s > 0) {
        solid.quad(ii, ij, up(ij), up(ii), WALL_IN);
        solid.quad(oj, oi, up(oi), up(oj), WALL);
      } else {
        solid.quad(ij, ii, up(ii), up(ij), WALL_IN);
        solid.quad(oi, oj, up(oj), up(oi), WALL);
      }
      solid.quad(up(oi), up(oj), up(ij), up(ii), shade(WALL, 0.8));
      // Galerien: Leuchtbänder an der Innenwand, alle 5 m über die ganze Tiefe, wechselnde Farben
      for (let y = floor + 4, n = 0; y < top - 2; y += 5, n++) {
        const c = n % 3 === 0 ? PINK : n % 3 === 1 ? CYAN : VIOLET;
        const pi = W(i, s * (HALF - 0.05), y);
        const pj = W(j, s * (HALF - 0.05), y);
        glow.quad(pi, pj, [pj[0], y + 0.35, pj[2]], [pi[0], y + 0.35, pi[2]], c);
        // Brüstung der Galerie: ein Sims davor
        const qi = W(i, s * (HALF - 1.6), y - 0.5);
        const qj = W(j, s * (HALF - 1.6), y - 0.5);
        solid.quad(qi, qj, [qj[0], y - 0.2, qj[2]], [qi[0], y - 0.2, qi[2]], BEAM);
      }
      // Fensterbänder außen
      for (let y = floor + 6; y < top - 3; y += 6) {
        const pi = W(i, s * (HALF + 1.05), y);
        const pj = W(j, s * (HALF + 1.05), y);
        glow.quad(pj, pi, [pi[0], y + 1.6, pi[2]], [pj[0], y + 1.6, pj[2]], shade(CYAN, 0.45));
      }
    }
    // Glasdach: Querträger alle 8 m
    if ((i - a0) % 8 === 0) {
      const l = W(i, -HALF, top + 0.2);
      const r = W(i, HALF, top + 0.2);
      const d = [t.tx[i] * 0.3, t.tz[i] * 0.3];
      glow.quad([l[0] - d[0], l[1], l[2] - d[1]], [r[0] - d[0], r[1], r[2] - d[1]], [r[0] + d[0], r[1], r[2] + d[1]], [l[0] + d[0], l[1], l[2] + d[1]], shade(CYAN, 0.7));
    }
    // Boden des Lichthofs: tief unten, mit leuchtendem Muster
    const f = (lat: number, k: number): V3 => W(k, lat, floor + 0.05);
    solid.quad(f(-HALF, i), f(HALF, i), f(HALF, j), f(-HALF, j), FLOOR);
    if ((i - a0) % 8 === 0) glow.quad(f(-HALF + 2, i), f(HALF - 2, i), f(HALF - 2, i + 1), f(-HALF + 2, i + 1), shade(PINK, 0.5));
  }
  // Stirnwände mit der Öffnung für den Steg (lichte Höhe 8 m über dem Steg, 1 m Luft neben der Kante)
  for (const [i, dir] of [
    [a0, -1],
    [a1, 1],
  ] as [number, number][]) {
    const y = t.py[i];
    const open = t.wh[i] + 1;
    const pieces: [number, number, number, number][] = [
      [-HALF - 1, -open, floor, top],
      [open, HALF + 1, floor, top],
      [-open, open, y + 8, top],
      [-open, open, floor, y - 1.4],
    ];
    for (const [l0, l1, y0, y1] of pieces) {
      const p0 = W(i, l0, y0);
      const p1 = W(i, l1, y0);
      if (!clear(W(i, (l0 + l1) / 2, y))) continue;
      const q = (p: V3, yy: number): V3 => [p[0], yy, p[2]];
      if (dir < 0) solid.quad(p1, p0, q(p0, y1), q(p1, y1), WALL);
      else solid.quad(p0, p1, q(p1, y1), q(p0, y1), WALL);
    }
    // Leuchtrahmen um die Öffnung
    const c: RGB = dir < 0 ? CYAN : PINK;
    const fl = W(i, -open, y - 1.4);
    const fr = W(i, open, y - 1.4);
    const tl = W(i, -open, y + 8);
    const tr = W(i, open, y + 8);
    const off = [t.tx[i] * 0.25 * -dir, t.tz[i] * 0.25 * -dir];
    const bar = (p: V3, q: V3): void => {
      glow.quad([p[0] + off[0], p[1] - 0.25, p[2] + off[1]], [q[0] + off[0], q[1] - 0.25, q[2] + off[1]], [q[0] + off[0], q[1] + 0.25, q[2] + off[1]], [p[0] + off[0], p[1] + 0.25, p[2] + off[1]], c);
    };
    bar(tl, tr);
    const side = (p: V3, q: V3): void => {
      const rx = rightX(t, i) * 0.25;
      const rz = rightZ(t, i) * 0.25;
      glow.quad([p[0] - rx + off[0], p[1], p[2] - rz + off[1]], [p[0] + rx + off[0], p[1], p[2] + rz + off[1]], [q[0] + rx + off[0], q[1], q[2] + rz + off[1]], [q[0] - rx + off[0], q[1], q[2] - rz + off[1]], c);
    };
    side(fl, tl);
    side(fr, tr);
  }
  const solidMat = toonMaterial({ vertexColors: true });
  solidMat.side = THREE.DoubleSide;
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const solidMesh = new THREE.Mesh(solid.build(), solidMat);
  const glowMesh = new THREE.Mesh(glow.build(), glowMat);
  group.add(solidMesh, glowMesh);
  return {
    group,
    update() {},
    dispose() {
      solidMesh.geometry.dispose();
      glowMesh.geometry.dispose();
      solidMat.dispose();
      glowMat.dispose();
    },
  };
}

// Bild des Flusses im Dschungel (render/mechanics/river.ts).
//
// Die Flöße sind die Fahrbahn: ihr Deck ist ein Netz, dessen Ecken je Bild aus der Rennzeit neu gesetzt
// werden. Geprüft wird, was ein Fehler dabei sichtbar (und gefährlich) machen würde:
//   (a) Zu vielen Rennzeiten, an jedem Meter des Flusses, je Bahn in der Mitte und 0,3 m vor beiden
//       Bahngrenzen: Wo raftLane ein Floß meldet, trifft ein Strahl von oben das Deck – auf 2 cm in der
//       Höhe von groundNow; wo Wasser ist, trifft er kein Deck. Abweichen darf es nur in einem Übergang
//       von höchstens 0,6 m an Bug und Heck (die größte Abweichung wird ausgegeben).
//   (b) Die Wasserfläche liegt unter den Decks (0,3–0,6 m) und bedeckt den Fluss über die ganze Breite
//       der Fahrbahn und mindestens 8 m je Seite daneben.
//   (c) Zeitsprünge: 100 s, dann 2 s, dann wieder 100 s – das Bild ist dasselbe wie beim ersten Mal.
//   (d) Keine Ecke, keine Instanz im Unendlichen; kein eigener Shader, keine Textur; Grenzen für
//       Dreiecke und Zeichenaufrufe.
// Über das Aussehen auf einem echten Gerät sagt der Test nichts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NO_GROUND, getTrack, groundNow, projectOnTrack, raftLane, rightX, rightZ } from '../../src/game/track';
import type { FxSink } from '../../src/render/fxApi';
import { buildRiver } from '../../src/render/mechanics/river';
import { RIVER_WATER } from '../../src/render/world';

const fx: FxSink = { spark() {}, puff() {} };
const FLUSS = 12;

function meshOf(group: THREE.Group, name: string): THREE.Mesh {
  const found = group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === name);
  expect(found.length).toBe(1);
  return found[0];
}

const ray = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);
const hits: THREE.Intersection[] = [];
/** Höhe der obersten Fläche des Netzes über (x, z) – oder null, wenn dort keine ist. */
function heightOver(mesh: THREE.Mesh, x: number, z: number, from: number): number | null {
  ray.set(new THREE.Vector3(x, from, z), down);
  hits.length = 0;
  mesh.raycast(ray, hits);
  if (hits.length === 0) return null;
  let best = -Infinity;
  for (const h of hits) best = Math.max(best, h.point.y);
  return best;
}

/** Rennzeiten (Ticks): Countdown, Start, krumme Werte, lange Rennen. */
const TIMES = [-90, 0, 3.7 * 60, 20 * 60, 61.3 * 60, 150 * 60, 4321.5];

describe('Dschungel-Fluss: Bild der Flöße, des Wassers und des Wasserfalls', () => {
  const t = getTrack(FLUSS);
  const riv = t.rivers[0];

  it('es gibt den Fluss mit drei Bahnen', () => {
    expect(t.rivers.length).toBe(1);
    expect(riv.lanes.length).toBe(3);
  });

  it.each([
    [true, TIMES],
    [false, [0, 20 * 60, 150 * 60]],
  ])('(a) Deck genau dort, wo die Physik ein Floß hat, auf der Höhe von groundNow (Zierde: %s)', (detail, times) => {
    const view = buildRiver(t, detail);
    const deck = meshOf(view.group, 'deck');
    expect((deck.geometry.getAttribute('position') as THREE.BufferAttribute).usage).toBe(THREE.DynamicDrawUsage);
    let onRaft = 0;
    let onWater = 0;
    let worstY = 0;
    let worstEnd = 0;
    let mismatches = 0;
    for (const time of times) {
      const mid = riv.first + (riv.count >> 1);
      view.update(time, time / 60, 1 / 60, new THREE.Vector3(t.px[mid], t.py[mid] + 3, t.pz[mid]), fx);
      deck.geometry.computeBoundingSphere();
      deck.updateMatrixWorld();
      for (let s = riv.first; s < riv.first + riv.count; s++) {
        // jeden Meter (knapp neben den Kanten zwischen zwei Dreiecken: dort verfehlt ein Strahl beide)
        for (const along of [-0.31, 0.137]) {
          for (const l of riv.lanes) {
            for (const lat0 of [l.lat0 + 0.3, (l.lat0 + l.lat1) / 2 + 0.003, l.lat1 - 0.3]) {
              const x = t.px[s] + t.tx[s] * along * t.step + rightX(t, s) * lat0;
              const z = t.pz[s] + t.tz[s] * along * t.step + rightZ(t, s) * lat0;
              // So ordnet die Physik den Punkt zu – genau damit rechnet sie den Boden des Karts.
              const p = projectOnTrack(t, x, z, s);
              if (p.seg < riv.first || p.seg >= riv.first + riv.count) continue;
              const lane = raftLane(t, p.seg, p.along, p.lat, time);
              const g = groundNow(t, p.seg, p.along, p.lat, time);
              const ref = t.py[s] + 30;
              const y = heightOver(deck, x, z, ref);
              // Abstand (längs) zur nächsten Floßkante der Bahn, in der der Punkt liegt
              const a = (p.seg - riv.first) * t.step + p.along;
              const L = riv.lanes.find((q) => p.lat >= q.lat0 && p.lat <= q.lat1)!;
              let edge = Infinity;
              if (L.gap > 0) {
                const pitch = L.length + L.gap;
                let u = (a - L.phase - (L.speed * Math.max(0, time)) / 60) % pitch;
                if (u < 0) u += pitch;
                edge = Math.min(u, Math.abs(u - L.length), pitch - u);
              }
              if (lane !== null) {
                expect(g).not.toBe(NO_GROUND);
                onRaft++;
                if (y === null) {
                  mismatches++;
                  worstEnd = Math.max(worstEnd, edge);
                  if (edge > 0.6) throw new Error(`kein Deck auf dem Floß bei Abschnitt ${s} (${along}, ${lat0.toFixed(2)}) zur Zeit ${time}, ${edge.toFixed(2)} m vom Floßende`);
                  continue;
                }
                const d = Math.abs(y - g);
                if (d > 0.02) throw new Error(`Deck ${y.toFixed(3)} statt ${g.toFixed(3)} bei Abschnitt ${s} (${along}, ${lat0.toFixed(2)}) zur Zeit ${time}`);
                worstY = Math.max(worstY, d);
              } else {
                expect(g).toBe(NO_GROUND);
                onWater++;
                if (y !== null) {
                  mismatches++;
                  worstEnd = Math.max(worstEnd, edge);
                  if (edge > 0.6) throw new Error(`Deck über Wasser bei Abschnitt ${s} (${along}, ${lat0.toFixed(2)}) zur Zeit ${time}, ${edge.toFixed(2)} m vom Floßende`);
                }
              }
            }
          }
        }
      }
    }
    console.log(`(a) Zierde ${detail}: ${onRaft} Stichproben auf Flößen, ${onWater} über Wasser; größte Höhenabweichung ${(worstY * 100).toFixed(2)} cm; ${mismatches} Abweichungen an Bug/Heck, größte ${worstEnd.toFixed(3)} m vom Floßende`);
    expect(onRaft).toBeGreaterThan(times.length * 1500);
    expect(onWater).toBeGreaterThan(times.length * 150);
    expect(worstY).toBeLessThan(0.02);
    expect(worstEnd).toBeLessThanOrEqual(0.6);
    view.dispose();
  });

  it('(b) das Wasser liegt 0,3–0,6 m unter den Decks und reicht über die Fahrbahn hinaus', () => {
    expect(RIVER_WATER).toBeGreaterThanOrEqual(0.3);
    expect(RIVER_WATER).toBeLessThanOrEqual(0.6);
    const view = buildRiver(t, true);
    const water = meshOf(view.group, 'wasser');
    water.updateMatrixWorld();
    let checked = 0;
    let worst = 0;
    for (const time of [0, 20 * 60, 61.3 * 60]) {
      view.update(time, time / 60, 1 / 60, new THREE.Vector3(), fx);
      for (let s = riv.first; s < riv.first + riv.count; s++) {
        const along = 0.21;
        const wh = t.wh[s];
        for (let lat0 = -(wh + 8); lat0 <= wh + 8 + 1e-6; lat0 += 0.8) {
          const x = t.px[s] + t.tx[s] * along * t.step + rightX(t, s) * lat0;
          const z = t.pz[s] + t.tz[s] * along * t.step + rightZ(t, s) * lat0;
          const y = heightOver(water, x, z, t.py[s] + 30);
          if (y === null) throw new Error(`kein Wasser bei Abschnitt ${s}, seitlich ${lat0.toFixed(2)}`);
          const p = projectOnTrack(t, x, z, s);
          // Bezug: die Höhe, die ein Deck dort hätte (Fahrbahnebene, auch neben der Fahrbahn fortgesetzt)
          const deckY = t.py[s] + (t.py[t.next[s]] - t.py[s]) * along + lat0 * t.bank[s];
          const below = deckY - y;
          if (raftLane(t, p.seg, p.along, p.lat, time) !== null) {
            const g = groundNow(t, p.seg, p.along, p.lat, time);
            const d = g - y;
            if (d < 0.3 || d > 0.6) throw new Error(`Wasser ${d.toFixed(3)} m unter dem Deck bei Abschnitt ${s}, seitlich ${lat0.toFixed(2)}`);
            worst = Math.max(worst, Math.abs(d - RIVER_WATER));
          } else if (below < 0.3 - 0.03 || below > 0.6 + 0.03) {
            // (Schaum um die Felsen liegt 2 cm über dem Wasser)
            throw new Error(`Wasser ${below.toFixed(3)} m unter der Fahrbahnebene bei Abschnitt ${s}, seitlich ${lat0.toFixed(2)}`);
          }
          checked++;
        }
      }
    }
    console.log(`(b) ${checked} Stichproben; Wasser unter dem Deck höchstens ${(worst * 100).toFixed(2)} cm von ${RIVER_WATER} m entfernt`);
    expect(checked).toBeGreaterThan(3 * riv.count * 30);
    view.dispose();
  });

  it('(c) Zeitsprünge: 100 s → 2 s → 100 s ergibt dasselbe Bild', () => {
    const view = buildRiver(t, true);
    const cam = new THREE.Vector3(t.px[riv.first + 60], t.py[riv.first + 60] + 3, t.pz[riv.first + 60]);
    const snap = (): Float32Array[] => {
      const out: Float32Array[] = [];
      view.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || o.name === 'outline') return;
        out.push(new Float32Array(o.geometry.getAttribute('position').array));
        const c = o.geometry.getAttribute('color');
        if (c) out.push(new Float32Array(c.array));
        if (o instanceof THREE.InstancedMesh) out.push(new Float32Array(o.instanceMatrix.array));
      });
      return out;
    };
    view.update(6000, 100, 1 / 60, cam, fx);
    const a = snap();
    view.update(120, 2, 1 / 60, cam, fx);
    const b = snap();
    view.update(6000, 100, 1 / 60, cam, fx);
    const c = snap();
    expect(a.length).toBe(c.length);
    let differ = 0;
    for (let i = 0; i < a.length; i++) {
      expect(a[i].length).toBe(c[i].length);
      for (let k = 0; k < a[i].length; k++) expect(Math.abs(a[i][k] - c[i][k])).toBeLessThan(1e-4);
      for (let k = 0; k < a[i].length; k++) if (Math.abs(a[i][k] - b[i][k]) > 1e-3) differ++;
    }
    // (und zwischendurch hat sich wirklich etwas bewegt)
    expect(differ).toBeGreaterThan(1000);
    view.dispose();
  });

  it('(d) keine Ecke im Unendlichen, kein eigener Shader, keine Textur, Grenzen eingehalten', () => {
    for (const detail of [true, false]) {
      const view = buildRiver(t, detail);
      const m = new THREE.Matrix4();
      const v = new THREE.Vector3();
      let meshes = 0;
      for (const time of [...TIMES, 33, 600, 61 * 60, 9999]) {
        for (const s of [riv.first, riv.first + 100, riv.first + riv.count + 12, t.belts[0].first + 40]) {
          view.update(time, time / 60, 1 / 60, new THREE.Vector3(t.px[s], t.py[s] + 2, t.pz[s]), fx);
        }
        view.group.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          meshes++;
          const arr = o.geometry.getAttribute('position').array;
          for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) throw new Error(`${o.name}: Ecke ${Math.floor(i / 3)} nicht endlich zur Zeit ${time}`);
          for (const a of ['normal', 'onormal', 'color']) {
            const n = o.geometry.getAttribute(a);
            if (n) for (let i = 0; i < n.count * n.itemSize; i++) if (!Number.isFinite(n.array[i])) throw new Error(`${o.name}: ${a} nicht endlich`);
          }
          if (o instanceof THREE.InstancedMesh) {
            for (let i = 0; i < o.count; i++) {
              o.getMatrixAt(i, m);
              v.setFromMatrixPosition(m);
              expect(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)).toBe(true);
            }
          }
        });
      }
      expect(meshes).toBeGreaterThan(5);
      // Zeichenaufrufe (jedes Netz, Konturen eingerechnet) und Dreiecke
      let calls = 0;
      view.group.traverse((o) => {
        if (o instanceof THREE.Mesh && o.visible) calls++;
        if (!(o instanceof THREE.Mesh)) return;
        const mat = o.material as THREE.Material & { map?: THREE.Texture | null };
        expect(mat.map ?? null).toBeNull();
        expect(mat.onBeforeCompile.toString()).toBe(new THREE.Material().onBeforeCompile.toString());
        if (mat instanceof THREE.ShaderMaterial) expect(o.name).toBe('outline');
        if (!detail) expect(o.name).not.toBe('outline');
      });
      const tris = view.group.userData.triangles as number;
      console.log(`(d) Zierde ${detail}: ${calls} Zeichenaufrufe, ${tris} Dreiecke`);
      expect(calls).toBeLessThanOrEqual(detail ? 12 : 8);
      expect(tris).toBeLessThanOrEqual(detail ? 18000 : 10000);
      view.dispose();
    }
    const src = readFileSync(join(import.meta.dirname, '../../src/render/mechanics/river.ts'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n');
    expect(src).not.toMatch(/ShaderMaterial|onBeforeCompile|Texture|\bmap\s*:|gl_Position|textTexture|PointLight|SpotLight/);
  });
});

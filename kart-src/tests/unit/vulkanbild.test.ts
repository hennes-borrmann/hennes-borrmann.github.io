// Bild der Vulkaninsel: Platten, Hängebrücke, Tore (render/mechanics/volcano.ts).
//
// Die Platten füllen genau die Löcher, die die stehende Welt in der Fahrbahn lässt, und
// alles ist eine reine Funktion der Rennzeit. Geprüft wird hier, was ein Fehler dabei
// sichtbar machen würde: Die Deckflächen bedecken die Bruchstellen ohne Lücke und ohne
// Überstand auf Fahrbahnhöhe; nach dem Bruch liegt dort nichts mehr; Zeitsprünge ergeben
// dasselbe Bild wie ein frischer Aufbau; die Sperren stehen genau dann, wenn die Physik
// sperrt. Über das Aussehen auf einem echten Gerät sagt der Test nichts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EDGE_OPEN_L, EDGE_OPEN_R, TRACK, gateAt, groundAt, rightX, rightZ, setTrack, type Track } from '../../src/game/track';
import type { FxSink } from '../../src/render/fxApi';
import { buildVolcano } from '../../src/render/mechanics/volcano';
import { HOLE_RIM } from '../../src/render/world';

const fx: FxSink = { spark() {}, puff() {} };
const far = new THREE.Vector3(0, 500, 0);

interface Info {
  solid: THREE.Mesh;
  glow: THREE.Mesh;
  glutschein: THREE.Mesh;
  ampeln: THREE.Mesh;
  deckTris: number[];
  sperren: THREE.Mesh[];
}

function view(detail = true): { v: ReturnType<typeof buildVolcano>; info: Info } {
  setTrack(9);
  const v = buildVolcano(TRACK, detail);
  return { v, info: v.group.userData.vulkan as Info };
}
const at = (v: ReturnType<typeof buildVolcano>, sec: number): void => v.update(sec * 60, sec, 1 / 60, far, fx);

/** Je Abschnitt die Vereinigung der Bruchstellen, beschnitten wie in world.ts (Sims unter der Bande). */
function holeCells(t: Track): Map<number, [number, number][]> {
  const m = new Map<number, [number, number][]>();
  for (const h of t.holes)
    for (let s = h.first; s < h.first + h.count; s++) {
      const rim = t.edge[s] & (EDGE_OPEN_L | EDGE_OPEN_R) ? 0 : HOLE_RIM;
      const lo = Math.max(h.lat0, -t.wh[s] + rim);
      const hi = Math.min(h.lat1, t.wh[s] - rim);
      if (hi > lo) (m.get(s) ?? m.set(s, []).get(s)!).push([lo, hi]);
    }
  for (const [s, list] of m) {
    list.sort((a, b) => a[0] - b[0]);
    const out: [number, number][] = [];
    for (const iv of list) {
      const l = out[out.length - 1];
      if (l && iv[0] <= l[1]) l[1] = Math.max(l[1], iv[1]);
      else out.push([iv[0], iv[1]]);
    }
    m.set(s, out);
  }
  return m;
}

/** Punkt auf der Fahrbahn wie in world.ts (nur waagerecht). */
function xz(t: Track, i: number, f: number, lat: number): [number, number] {
  const j = t.next[i];
  const x0 = t.px[i] + rightX(t, i) * lat;
  const z0 = t.pz[i] + rightZ(t, i) * lat;
  const x1 = t.px[j] + rightX(t, j) * lat;
  const z1 = t.pz[j] + rightZ(t, j) * lat;
  return [x0 + (x1 - x0) * f, z0 + (z1 - z0) * f];
}

function polyArea(p: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, z0] = p[i];
    const [x1, z1] = p[(i + 1) % p.length];
    s += x0 * z1 - x1 * z0;
  }
  return Math.abs(s) / 2;
}

/** Fläche der Löcher von oben: je Abschnitt von der Mitte vor bis zur Mitte hinter ihm. */
function holeArea(t: Track): number {
  let area = 0;
  for (const [s, list] of holeCells(t))
    for (const [lo, hi] of list) {
      const p = t.prev[s];
      area += polyArea([xz(t, p, 0.5, lo), xz(t, s, 0, lo), xz(t, s, 0.5, lo), xz(t, s, 0.5, hi), xz(t, s, 0, hi), xz(t, p, 0.5, hi)]);
    }
  return area;
}

function triArea(pos: THREE.BufferAttribute, tri: number): number {
  const a = tri * 3;
  const ax = pos.getX(a);
  const az = pos.getZ(a);
  return Math.abs((pos.getX(a + 1) - ax) * (pos.getZ(a + 2) - az) - (pos.getZ(a + 1) - az) * (pos.getX(a + 2) - ax)) / 2;
}

/** Höhe der Deckfläche über (x, z) – oder NaN, wenn dort keine liegt. */
function deckHeight(pos: THREE.BufferAttribute, tris: number[], x: number, z: number): number {
  for (const tri of tris) {
    const a = tri * 3;
    const x0 = pos.getX(a);
    const z0 = pos.getZ(a);
    const x1 = pos.getX(a + 1);
    const z1 = pos.getZ(a + 1);
    const x2 = pos.getX(a + 2);
    const z2 = pos.getZ(a + 2);
    const d = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
    if (Math.abs(d) < 1e-12) continue;
    const l0 = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / d;
    const l1 = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / d;
    const l2 = 1 - l0 - l1;
    if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
    return l0 * pos.getY(a) + l1 * pos.getY(a + 1) + l2 * pos.getY(a + 2);
  }
  return NaN;
}

/** Nächster Abschnittsmittelpunkt (wie die Physik) unter a … b, mit Lage dazu. */
function nearest(t: Track, x: number, z: number, a: number, b: number): { seg: number; along: number; lat: number } {
  let best = a;
  let bd = Infinity;
  for (let s = a; s <= b; s++) {
    const d = (t.px[s] - x) ** 2 + (t.pz[s] - z) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  const dx = x - t.px[best];
  const dz = z - t.pz[best];
  return { seg: best, along: dx * t.tx[best] + dz * t.tz[best], lat: dx * rightX(t, best) + dz * rightZ(t, best) };
}

function snapshot(info: Info): Float32Array[] {
  const out: Float32Array[] = [];
  for (const m of [info.solid, info.glow, info.glutschein, info.ampeln]) {
    out.push((m.geometry.getAttribute('position').array as Float32Array).slice());
    out.push((m.geometry.getAttribute('color').array as Float32Array).slice());
  }
  out.push(new Float32Array(info.sperren.flatMap((s) => [s.visible ? 1 : 0, s.position.y])));
  return out;
}

describe('Vulkaninsel: Bild der Bruchstellen und Tore', () => {
  it('(a) bei Rennzeit 0 decken Platten und Brücke genau die Löcher der Welt – Fläche und Höhe', () => {
    const { v, info } = view();
    at(v, 0);
    const t = TRACK;
    const pos = info.solid.geometry.getAttribute('position') as THREE.BufferAttribute;
    let area = 0;
    for (const tri of info.deckTris) area += triArea(pos, tri);
    const want = holeArea(t);
    expect(want).toBeGreaterThan(500);
    expect(Math.abs(area - want) / want).toBeLessThan(0.02);
    // Höhe: Mitte, Ränder und Ecken jedes Abschnitts jeder Bruchstelle
    let checked = 0;
    let worst = 0;
    for (const [s, list] of holeCells(t))
      for (const [lo, hi] of list)
        for (const along of [-0.45, 0, 0.45])
          for (const lat of [lo + 0.05, (lo + hi) / 2, hi - 0.05]) {
            // Lage wie die Fahrbahn der Welt: vor der Mitte auf dem Stück davor, dahinter auf dem eigenen
            const [x, z] = along < 0 ? xz(t, t.prev[s], 1 + along, lat) : xz(t, s, along, lat);
            const y = deckHeight(pos, info.deckTris, x, z);
            if (Number.isNaN(y)) throw new Error(`keine Deckfläche über Abschnitt ${s}, ${along}, ${lat.toFixed(2)}`);
            const d = Math.abs(y - groundAt(t, s, along, lat));
            worst = Math.max(worst, d);
            checked++;
          }
    expect(checked).toBeGreaterThan(1000);
    expect(worst).toBeLessThan(0.02);
    v.dispose();
  });

  it('(b) 3 s nach dem Bruch liegt im Loch nichts Sichtbares mehr auf Fahrbahnhöhe', () => {
    const t = TRACK;
    setTrack(9);
    for (const h of TRACK.holes) {
      const { v, info } = view();
      const sec = h.plan.spans[0] / 60 + 3;
      at(v, sec - 1);
      at(v, sec);
      const cells = holeCells(t);
      let inside = 0;
      for (const m of [info.solid, info.glow]) {
        const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let tri = 0; tri < pos.count / 3; tri++) {
          if (triArea(pos, tri) < 1e-6 && Math.abs(pos.getY(tri * 3) - pos.getY(tri * 3 + 1)) < 1e-6) continue;
          const cx = (pos.getX(tri * 3) + pos.getX(tri * 3 + 1) + pos.getX(tri * 3 + 2)) / 3;
          const cy = (pos.getY(tri * 3) + pos.getY(tri * 3 + 1) + pos.getY(tri * 3 + 2)) / 3;
          const cz = (pos.getZ(tri * 3) + pos.getZ(tri * 3 + 1) + pos.getZ(tri * 3 + 2)) / 3;
          const p = nearest(t, cx, cz, h.first - 2, h.first + h.count + 2);
          const s = p.seg;
          if (s < h.first || s >= h.first + h.count) continue;
          if ((s === h.first && p.along < -0.2) || (s === h.first + h.count - 1 && p.along > 0.2)) continue;
          const own = (cells.get(s) ?? []).find(([lo, hi]) => p.lat > lo + 0.3 && p.lat < hi - 0.3 && p.lat > h.lat0 + 0.3 && p.lat < h.lat1 - 0.3);
          if (!own) continue;
          inside++;
          if (cy > t.py[s] - 1) throw new Error(`Bruchstelle ${h.first}+${h.count} bei ${sec} s: ${m.name} hat noch ein Dreieck auf ${(cy - t.py[s]).toFixed(2)} m (Abschnitt ${s}, längs ${p.along.toFixed(2)}, seitlich ${p.lat.toFixed(2)}, Dreieck ${tri})`);
        }
      }
      expect(inside).toBeGreaterThanOrEqual(0);
      v.dispose();
    }
  });

  it('(c) Zeitsprünge vor und zurück ergeben dasselbe Bild wie ein frischer Aufbau', () => {
    const { v, info } = view();
    at(v, 200);
    const first200 = snapshot(info);
    at(v, 10);
    const back10 = snapshot(info);
    at(v, 200);
    const again200 = snapshot(info);
    const fresh = view();
    at(fresh.v, 10);
    const fresh10 = snapshot(fresh.info);
    const fresh0 = view();
    at(fresh0.v, 0);
    for (let i = 0; i < first200.length; i++) {
      expect(again200[i]).toEqual(first200[i]);
      expect(back10[i]).toEqual(fresh10[i]);
    }
    // bei 10 s wie bei 0 s: alles trägt, Deckflächen gleich
    const p10 = info.solid.geometry.getAttribute('position') as THREE.BufferAttribute;
    at(v, 10);
    const p0 = fresh0.info.solid.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (const tri of info.deckTris) for (let k = 0; k < 9; k++) expect(p10.array[tri * 9 + k]).toBe(p0.array[tri * 9 + k]);
    v.dispose();
    fresh.v.dispose();
    fresh0.v.dispose();
  });

  it('(d) die Sperre jedes Tors steht genau dann, wenn die Physik sperrt', () => {
    const { v, info } = view();
    expect(info.sperren.length).toBe(TRACK.gates.length);
    for (const sec of [0, 49, 50, 83, 84, 150, 10, 49.99, 84.01]) {
      at(v, sec);
      for (const s of info.sperren) {
        const g = TRACK.gates[s.userData.gate as number];
        expect(s.visible, `Tor ${s.userData.gate} bei ${sec} s`).toBe(gateAt(TRACK, g.first, sec * 60));
        if (s.visible && sec >= 84 && sec < 100) expect(Math.abs(s.position.y)).toBeLessThan(1e-6);
      }
    }
    v.dispose();
  });

  it('(e) endliche Koordinaten, kein eigener Shader, keine Textur; Grenzen für Dreiecke und Zeichenaufrufe', () => {
    for (const detail of [true, false]) {
      const { v } = view(detail);
      for (const sec of [-3, 0, 37, 38.3, 39, 60, 84.6, 86, 90, 140, 200]) {
        at(v, sec);
        v.group.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const a = o.geometry.getAttribute('position').array as Float32Array;
          for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) throw new Error(`${o.name}: Ecke nicht endlich bei ${sec} s`);
          expect(Number.isFinite(o.position.y)).toBe(true);
        });
      }
      let calls = 0;
      let tris = 0;
      v.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        calls++;
        const g = o.geometry;
        tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        const m = o.material as THREE.Material & { map?: THREE.Texture | null };
        expect(m.map ?? null).toBeNull();
        expect(m.onBeforeCompile.toString()).toBe(new THREE.Material().onBeforeCompile.toString());
        if (m instanceof THREE.ShaderMaterial) expect(o.name).toBe('outline');
      });
      console.log(`Vulkaninsel ${detail ? 'mit' : 'ohne'} detail: ${calls} Zeichenaufrufe, ${tris} Dreiecke (gezählt: ${v.group.userData.triangles})`);
      expect(tris).toBeLessThanOrEqual(detail ? 16000 : 9000);
      expect(calls).toBeLessThanOrEqual(detail ? 12 : 8);
      v.dispose();
    }
    // Quelltext: keine Shader, keine Texturen
    const src = readFileSync(join(import.meta.dirname, '../../src/render/mechanics/volcano.ts'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n');
    expect(src).not.toMatch(/ShaderMaterial|onBeforeCompile|RawShader|Texture|\bmap\s*:/);
  });
});

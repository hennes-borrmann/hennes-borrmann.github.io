// Bild der Zeitriss-Ruine: Hallenplatten, Aquädukt, Tore (render/mechanics/rift.ts).
//
// Die Platten und das Aquädukt füllen genau die Löcher, die die stehende Welt lässt, und alles ist
// eine reine Funktion der Rennzeit. Geprüft wird, was ein Fehler dabei sichtbar machen würde: Einst
// decken die Deckflächen die Bruchstellen ohne Lücke und ohne Absatz auf Fahrbahnhöhe; Jetzt liegt dort
// nichts Deckendes mehr (das Zeitecho ist durchsichtig und als solches gekennzeichnet); die Stücke des
// Aquädukts tragen im Bild genau so lange wie in der Physik; Zeitsprünge ergeben dasselbe Bild wie ein
// frischer Aufbau; die Sperren stehen genau dann, wenn die Physik sperrt. Über das Aussehen auf einem
// echten Gerät sagt der Test nichts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { planActive } from '../../src/game/mechanics';
import { EDGE_OPEN_L, EDGE_OPEN_R, TRACK, gateAt, groundAt, rightX, rightZ, setTrack, type Track } from '../../src/game/track';
import type { FxSink } from '../../src/render/fxApi';
import { buildRift } from '../../src/render/mechanics/rift';
import { HOLE_RIM } from '../../src/render/world';

const fx: FxSink = { spark() {}, puff() {} };
const far = new THREE.Vector3(0, 500, 0);
const RUINE = 10;

interface Info {
  platten: THREE.Mesh;
  stein: THREE.Mesh;
  echo: THREE.Mesh;
  lichter: THREE.Mesh;
  fest: THREE.Mesh;
  deck: { hole: number; layer: 'platten' | 'stein'; tris: number[] }[];
  sperren: THREE.Mesh[];
}
type View = ReturnType<typeof buildRift>;

function view(detail = true): { v: View; info: Info } {
  setTrack(RUINE);
  const v = buildRift(TRACK, detail);
  return { v, info: v.group.userData.rift as Info };
}
const at = (v: View, sec: number): void => v.update(sec * 60, sec, 1 / 60, far, fx);
const posOf = (m: THREE.Mesh): THREE.BufferAttribute => m.geometry.getAttribute('position') as THREE.BufferAttribute;
const meshOf = (info: Info, layer: 'platten' | 'stein'): THREE.Mesh => (layer === 'platten' ? info.platten : info.stein);

/** Je Abschnitt die Vereinigung der Bruchstellen, beschnitten wie in world.ts (Sims unter der Bande). */
function holeCells(t: Track, only?: number): Map<number, [number, number][]> {
  const m = new Map<number, [number, number][]>();
  t.holes.forEach((h, hi) => {
    if (only !== undefined && hi !== only) return;
    for (let s = h.first; s < h.first + h.count; s++) {
      const rim = t.edge[s] & (EDGE_OPEN_L | EDGE_OPEN_R) ? 0 : HOLE_RIM;
      const lo = Math.max(h.lat0, -t.wh[s] + rim);
      const hi2 = Math.min(h.lat1, t.wh[s] - rim);
      if (hi2 > lo) (m.get(s) ?? m.set(s, []).get(s)!).push([lo, hi2]);
    }
  });
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

/** Alle Deckdreiecke als [Ecken, Dreieck]. */
function deckTris(info: Info): [THREE.BufferAttribute, number][] {
  const out: [THREE.BufferAttribute, number][] = [];
  for (const d of info.deck) {
    const pos = posOf(meshOf(info, d.layer));
    for (const tri of d.tris) out.push([pos, tri]);
  }
  return out;
}

/** Höhe der Deckfläche über (x, z) – oder NaN, wenn dort keine liegt. */
function deckHeight(list: [THREE.BufferAttribute, number][], x: number, z: number): number {
  for (const [pos, tri] of list) {
    const a = tri * 3;
    const x0 = pos.getX(a);
    const z0 = pos.getZ(a);
    const x1 = pos.getX(a + 1);
    const z1 = pos.getZ(a + 1);
    const x2 = pos.getX(a + 2);
    const z2 = pos.getZ(a + 2);
    if (Math.min(x0, x1, x2) > x + 0.01 || Math.max(x0, x1, x2) < x - 0.01 || Math.min(z0, z1, z2) > z + 0.01 || Math.max(z0, z1, z2) < z - 0.01) continue;
    const d = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
    if (Math.abs(d) < 1e-12) continue;
    const l0 = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / d;
    const l1 = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / d;
    const l2 = 1 - l0 - l1;
    // Ecken liegen als float32 vor: auf einer gemeinsamen Kante etwas Spiel lassen (1e-4 ≈ 0,05 mm)
    if (l0 < -1e-4 || l1 < -1e-4 || l2 < -1e-4) continue;
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

/** (a): Deckflächen decken die Löcher – Fläche auf 2 %, Höhe auf 2 cm. */
function checkCovered(info: Info, label: string): void {
  const t = TRACK;
  const list = deckTris(info);
  let area = 0;
  for (const [pos, tri] of list) area += triArea(pos, tri);
  const want = holeArea(t);
  expect(want).toBeGreaterThan(1000);
  expect(Math.abs(area - want) / want, `${label}: Fläche ${area.toFixed(1)} statt ${want.toFixed(1)}`).toBeLessThan(0.02);
  let checked = 0;
  let worst = 0;
  for (const [s, cells] of holeCells(t))
    for (const [lo, hi] of cells)
      for (const along of [-0.45, 0, 0.45])
        for (const lat of [lo + 0.05, (lo + hi) / 2, hi - 0.05]) {
          const [x, z] = along < 0 ? xz(t, t.prev[s], 1 + along, lat) : xz(t, s, along, lat);
          const y = deckHeight(list, x, z);
          if (Number.isNaN(y)) throw new Error(`${label}: keine Deckfläche über Abschnitt ${s}, ${along}, ${lat.toFixed(2)}`);
          worst = Math.max(worst, Math.abs(y - groundAt(t, s, along, lat)));
          checked++;
        }
  expect(checked).toBeGreaterThan(1500);
  expect(worst, `${label}: größte Abweichung der Höhe`).toBeLessThan(0.02);
}

/** Liegt ein deckendes Dreieck dieses Netzes im Innern einer Bruchstelle oberhalb py − 1? */
function solidInHoles(m: THREE.Mesh, label: string): number {
  const t = TRACK;
  if (!m.visible) return 0;
  const pos = posOf(m);
  const boxes = t.holes.map((h) => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let s = h.first; s < h.first + h.count; s++) {
      x0 = Math.min(x0, t.px[s] - t.wh[s] - 1);
      x1 = Math.max(x1, t.px[s] + t.wh[s] + 1);
      z0 = Math.min(z0, t.pz[s] - t.wh[s] - 1);
      z1 = Math.max(z1, t.pz[s] + t.wh[s] + 1);
    }
    return [x0, x1, z0, z1];
  });
  let inside = 0;
  for (let tri = 0; tri < pos.count / 3; tri++) {
    const cx = (pos.getX(tri * 3) + pos.getX(tri * 3 + 1) + pos.getX(tri * 3 + 2)) / 3;
    const cy = (pos.getY(tri * 3) + pos.getY(tri * 3 + 1) + pos.getY(tri * 3 + 2)) / 3;
    const cz = (pos.getZ(tri * 3) + pos.getZ(tri * 3 + 1) + pos.getZ(tri * 3 + 2)) / 3;
    t.holes.forEach((h, hi) => {
      const [x0, x1, z0, z1] = boxes[hi];
      if (cx < x0 || cx > x1 || cz < z0 || cz > z1) return;
      const p = nearest(t, cx, cz, h.first - 2, h.first + h.count + 1);
      const s = p.seg;
      if (s < h.first || s >= h.first + h.count) return;
      if ((s === h.first && p.along < -0.2) || (s === h.first + h.count - 1 && p.along > 0.2)) return;
      const rim = t.edge[s] & (EDGE_OPEN_L | EDGE_OPEN_R) ? 0 : HOLE_RIM;
      const lo = Math.max(h.lat0, -t.wh[s] + rim) + 0.3;
      const hi2 = Math.min(h.lat1, t.wh[s] - rim) - 0.3;
      if (p.lat < lo || p.lat > hi2) return;
      inside++;
      if (cy > t.py[s] - 1) throw new Error(`${label}: ${m.name} hat ein Dreieck ${(cy - t.py[s]).toFixed(2)} m über der Fahrbahn im Loch (Bruchstelle ${hi}, Abschnitt ${s}, seitlich ${p.lat.toFixed(2)})`);
    });
  }
  return inside;
}

/** Trägt das Stück im Bild: liegen (fast) alle seine Deckdreiecke auf Fahrbahnhöhe? */
function carries(info: Info, hole: number): boolean {
  const t = TRACK;
  const h = t.holes[hole];
  let on = 0;
  let all = 0;
  for (const d of info.deck) {
    if (d.hole !== hole) continue;
    const pos = posOf(meshOf(info, d.layer));
    for (const tri of d.tris) {
      all++;
      const cx = (pos.getX(tri * 3) + pos.getX(tri * 3 + 1) + pos.getX(tri * 3 + 2)) / 3;
      const cy = (pos.getY(tri * 3) + pos.getY(tri * 3 + 1) + pos.getY(tri * 3 + 2)) / 3;
      const cz = (pos.getZ(tri * 3) + pos.getZ(tri * 3 + 1) + pos.getZ(tri * 3 + 2)) / 3;
      const p = nearest(t, cx, cz, h.first - 2, h.first + h.count + 1);
      if (Math.abs(cy - groundAt(t, p.seg, p.along, p.lat)) < 0.05) on++;
    }
  }
  expect(all).toBeGreaterThan(20);
  if (on > 0 && on < all * 0.95) throw new Error(`Bruchstelle ${hole}: nur ${on} von ${all} Deckdreiecken auf Fahrbahnhöhe`);
  return on >= all * 0.95;
}

function snapshot(info: Info): Float32Array[] {
  const out: Float32Array[] = [];
  for (const m of [info.platten, info.stein, info.echo, info.lichter]) {
    out.push((m.geometry.getAttribute('position').array as Float32Array).slice());
    out.push((m.geometry.getAttribute('color').array as Float32Array).slice());
  }
  out.push(new Float32Array(info.sperren.map((s) => (s.visible ? 1 : 0))));
  return out;
}

describe('Zeitriss-Ruine: Bild von Hallenboden, Aquädukt und Toren', () => {
  it('(a) Einst decken Mosaikplatten und Aquädukt genau die Löcher der Welt – Fläche und Höhe', () => {
    const { v, info } = view();
    expect(info.deck.filter((d) => d.layer === 'platten').length).toBeGreaterThan(0);
    expect(info.deck.filter((d) => d.layer === 'stein').length).toBeGreaterThan(0);
    for (const sec of [5, 41]) {
      at(v, sec);
      checkCovered(info, `${sec} s`);
    }
    v.dispose();
  });

  it('(b) Jetzt, 6 s nach dem Sprung, liegt in keinem Loch etwas Deckendes auf Fahrbahnhöhe', () => {
    const { v, info } = view();
    at(v, 23);
    at(v, 24);
    for (const h of TRACK.holes) expect(planActive(h.plan, 24 * 60)).toBe(true);
    let inside = 0;
    for (const m of [info.platten, info.stein, info.fest, ...info.sperren]) inside += solidInHoles(m, '24 s');
    expect(inside).toBeGreaterThanOrEqual(0);
    // Das Zeitecho dort ist durchsichtig (additiv, schreibt keine Tiefe) und als solches gekennzeichnet.
    const em = info.echo.material as THREE.MeshBasicMaterial;
    expect(info.echo.userData.echo).toBe(true);
    expect(em.transparent && !em.depthWrite && em.blending === THREE.AdditiveBlending).toBe(true);
    v.dispose();
  });

  it('(c) die Stücke des Aquädukts und die Hallenplatten tragen im Bild genau so lange wie in der Physik', () => {
    const { v, info } = view();
    const t = TRACK;
    const bridge = t.holes.map((_, i) => i).filter((i) => t.branchOf[t.holes[i].first] >= 0);
    const hall = t.holes.map((_, i) => i).filter((i) => t.branchOf[t.holes[i].first] < 0);
    expect(bridge.length).toBe(5);
    expect(hall.length).toBe(5);
    const gone: Record<number, number> = {};
    for (const sec of [18.5, 20.5, 23]) {
      at(v, sec);
      gone[sec] = 0;
      for (const hi of bridge) {
        const want = !planActive(t.holes[hi].plan, sec * 60);
        expect(carries(info, hi), `Aquädukt, Stück ${hi} bei ${sec} s`).toBe(want);
        if (!want) gone[sec]++;
      }
    }
    expect(gone).toEqual({ 18.5: 0, 20.5: 2, 23: 5 });
    for (const sec of [2, 17.95, 18.7, 30, 35.95, 36.05]) {
      at(v, sec);
      for (const hi of hall) expect(carries(info, hi), `Halle, Platte ${hi} bei ${sec} s`).toBe(!planActive(t.holes[hi].plan, sec * 60));
    }
    v.dispose();
  });

  it('(d) Zeitsprünge vor und zurück ergeben dasselbe Bild wie ein frischer Aufbau', () => {
    const { v, info } = view();
    at(v, 200);
    const first200 = snapshot(info);
    at(v, 5);
    const back5 = snapshot(info);
    // bei 5 s wie in (a)
    checkCovered(info, '200 s → 5 s');
    at(v, 200);
    const again200 = snapshot(info);
    const fresh = view();
    at(fresh.v, 5);
    const fresh5 = snapshot(fresh.info);
    for (let i = 0; i < first200.length; i++) {
      expect(again200[i], `Puffer ${i} bei 200 s`).toEqual(first200[i]);
      expect(back5[i], `Puffer ${i} bei 5 s`).toEqual(fresh5[i]);
    }
    v.dispose();
    fresh.v.dispose();
  });

  it('(e) die Sperre jedes Tors ist genau dann sichtbar, wenn die Physik sperrt', () => {
    const { v, info } = view();
    expect(info.sperren.length).toBe(TRACK.gates.length);
    expect(TRACK.gates.length).toBe(2);
    for (const sec of [1, 17.9, 18.1, 35.9, 36.1, 100, 0, 54.05, 71.95]) {
      at(v, sec);
      for (const s of info.sperren) {
        const g = TRACK.gates[s.userData.gate as number];
        expect(s.visible, `Tor ${s.userData.gate} bei ${sec} s`).toBe(gateAt(TRACK, g.first, sec * 60));
      }
    }
    v.dispose();
  });

  it('(f) endliche Koordinaten, kein eigener Shader, keine Textur; Grenzen für Dreiecke und Zeichenaufrufe', () => {
    for (const detail of [true, false]) {
      const { v } = view(detail);
      for (const sec of [-3, 0, 5, 15.5, 17.99, 18.01, 18.3, 18.8, 19.5, 21, 25, 33.5, 35.9, 36.0, 36.2, 36.5, 41, 90, 200]) {
        at(v, sec);
        v.group.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const a = o.geometry.getAttribute('position').array as Float32Array;
          for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) throw new Error(`${o.name}: Ecke nicht endlich bei ${sec} s`);
          const c = o.geometry.getAttribute('color')?.array as Float32Array | undefined;
          if (c) for (let i = 0; i < c.length; i++) if (!Number.isFinite(c[i])) throw new Error(`${o.name}: Farbe nicht endlich bei ${sec} s`);
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
      console.log(`Zeitriss-Ruine ${detail ? 'mit' : 'ohne'} detail: ${calls} Zeichenaufrufe, ${tris} Dreiecke (gezählt: ${v.group.userData.triangles})`);
      expect(tris).toBeLessThanOrEqual(detail ? 18000 : 10000);
      expect(calls).toBeLessThanOrEqual(detail ? 12 : 8);
      v.dispose();
    }
    // Quelltext: keine Shader, keine Texturen
    const src = readFileSync(join(import.meta.dirname, '../../src/render/mechanics/rift.ts'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n');
    expect(src).not.toMatch(/ShaderMaterial|onBeforeCompile|RawShader|Texture|\bmap\s*:/);
  });
});

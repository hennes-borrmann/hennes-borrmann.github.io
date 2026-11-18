// Bild der Magnettrommel im Magnetwerk (render/mechanics/drum.ts).
//
// Die Trommel wird so gezeichnet, dass die Fahrbahn aufrecht bleibt und sich die Halle um sie dreht
// (track.ts: drumPoint). Geprüft wird, was ein Fehler dabei sichtbar machen würde:
//   (a) Die Röhrenwand liegt überall auf Halbmesser ± 2 m um die Trommelachse und schließt sich rundum
//       (kein Durchblick aufs Gelände); zwischen Bahn und Achse ist auf ±8,4 m nichts von ihr, und über der
//       Bahn ragt bis 10 m Höhe überhaupt nichts auf (die Kamera fährt dort). Die Lampen bleiben 10 m weg.
//   (b) Die Deckenplatten liegen auf ihrer Spur (lat0 … lat1, auf 0,15 m) und zeigen zu Zeiten 0, 40, 100,
//       150, 200, 300 Ticks den Zustand, den planActive verlangt: an = blau und da, kündigt sich an = gelb
//       und da, aus = fort. „Kündigt sich an“ heißt: schaltet binnen warn Ticks ab (enthält planActive(plan,
//       time + warn); bei 150, 200 liegen Platten in den 30 Ticks davor, die jene Formel allein ausließe).
//   (c) „Unten“: Die Lampen hängen von der Achse zum Hallenboden – unten, an der Wand, an der Decke.
//   (d) Zeitsprünge (5000 → 17 → 5000) ergeben dasselbe Bild wie ein frischer Aufbau.
//   (e) Endliche Koordinaten; kein eigener Shader außer der Kontur, keine Textur, keine Lichtquelle;
//       Dreiecke und Zeichenaufrufe in den Grenzen.
// Über das Aussehen auf einem echten Gerät sagt der Test nichts.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { planActive, planUntil } from '../../src/game/mechanics';
import { drumPoint, rightX, rightZ, setTrack, type Track } from '../../src/game/track';
import type { FxSink } from '../../src/render/fxApi';
import { buildDrum } from '../../src/render/mechanics/drum';
import type { MechanicView } from '../../src/render/mechanics';

const MAGNET = 17;
const fx: FxSink = { spark() {}, puff() {} };
const cam = new THREE.Vector3();

interface DrumData {
  wall: [number, number][];
  floor: [number, number][];
  hang: [number, number][];
  lamps: { seg: number; top: [number, number, number]; from: number; to: number }[];
  plates: { holes: number[]; lat0: number; lat1: number; from: number; to: number }[];
}

function parts(view: MechanicView): { fixed: THREE.Mesh; signal: THREE.Mesh; glow: THREE.Mesh; data: DrumData } {
  const fixed = view.group.getObjectByName('trommel-fest') as THREE.Mesh;
  const signal = view.group.getObjectByName('trommel-signal') as THREE.Mesh;
  const glow = view.group.getObjectByName('trommel-schein') as THREE.Mesh;
  expect(fixed && signal && glow).toBeTruthy();
  return { fixed, signal, glow, data: view.group.userData.drum as DrumData };
}

/** Lage eines Punkts im Rahmen der Bahn: nächster Abschnitt (im Trommelbereich ± pad), seitlich, voraus, Höhe. */
function local(t: Track, first: number, last: number, x: number, y: number, z: number, pad = 6): { seg: number; lat: number; along: number; h: number } {
  let best = first;
  let bd = Infinity;
  for (let s = first - pad; s <= last + pad; s++) {
    const d = (x - t.px[s]) ** 2 + (z - t.pz[s]) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  const dx = x - t.px[best];
  const dz = z - t.pz[best];
  const lat = dx * rightX(t, best) + dz * rightZ(t, best);
  const along = dx * t.tx[best] + dz * t.tz[best];
  return { seg: best, lat, along, h: y - t.py[best] - lat * t.bank[best] };
}

function inRanges(i: number, ranges: [number, number][]): boolean {
  for (const [a, b] of ranges) if (i >= a && i < b) return true;
  return false;
}

describe('Magnetwerk: Bild der Magnettrommel', () => {
  const t = setTrack(MAGNET);
  const d = t.drums[0];
  const R = d.radius;
  const first = d.first;
  const last = d.first + d.count - 1;

  it('(a) die Röhre ist geschlossen, liegt auf ihrem Halbmesser und lässt die Bahn frei', () => {
    const view = buildDrum(t, true);
    const { fixed, signal, data } = parts(view);
    const pos = fixed.geometry.getAttribute('position');
    const P = { x: 0, y: 0, z: 0 };
    let wallCount = 0;
    for (const [a, b] of data.wall) {
      for (let i = a; i < b; i++) {
        wallCount++;
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        expect(Number.isFinite(x + y + z)).toBe(true);
        const l = local(t, first, last, x, y, z, 0);
        // Abstand von der Achse quer zur Fahrtrichtung: Achse = Mitte zwischen Bahn und Gegenseite (drumPoint)
        drumPoint(t, l.seg, t.roll[l.seg] + Math.PI, R, R, P);
        const ax = (P.x + t.px[l.seg]) / 2;
        const ay = (P.y + t.py[l.seg]) / 2;
        const az = (P.z + t.pz[l.seg]) / 2;
        const vx = x - ax;
        const vy = y - ay;
        const vz = z - az;
        const al = vx * t.tx[l.seg] + vz * t.tz[l.seg];
        const dist = Math.hypot(vx - t.tx[l.seg] * al, vy, vz - t.tz[l.seg] * al);
        if (Math.abs(dist - R) > 2) throw new Error(`Röhrenecke ${i} bei ${l.seg} m liegt ${dist.toFixed(2)} m von der Achse`);
        if (Math.abs(l.lat) < 8.4 && l.h > 0.25 && l.h < R) throw new Error(`Röhrenecke ${i} bei ${l.seg} m ragt über die Bahn: seitlich ${l.lat.toFixed(2)}, Höhe ${l.h.toFixed(2)}`);
      }
    }
    expect(wallCount).toBeGreaterThan(1000);

    // Geschlossen: alle 5 m Strahlen von der Achse rundum (außer zur Bahn hin) – jeder trifft Wand oder Hallenboden,
    // höchstens Halbmesser + 2,5 m weit. (Wo der ebene Hallenboden liegt, schließt er die Röhre.)
    const tris: number[][] = [];
    for (const [a, b] of [...data.wall, ...data.floor]) for (let i = a; i < b; i += 3) tris.push([i, i + 1, i + 2].flatMap((k) => [pos.getX(k), pos.getY(k), pos.getZ(k)]));
    const hit = (o: number[], d: number[], tri: number[]): number => {
      // Möller–Trumbore
      const e1 = [tri[3] - tri[0], tri[4] - tri[1], tri[5] - tri[2]];
      const e2 = [tri[6] - tri[0], tri[7] - tri[1], tri[8] - tri[2]];
      const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
      const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
      if (Math.abs(det) < 1e-9) return Infinity;
      const tv = [o[0] - tri[0], o[1] - tri[1], o[2] - tri[2]];
      const u = (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / det;
      if (u < -1e-6 || u > 1 + 1e-6) return Infinity;
      const q = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
      const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
      if (v < -1e-6 || u + v > 1 + 1e-6) return Infinity;
      const dist = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
      return dist > 0 ? dist : Infinity;
    };
    let rays = 0;
    for (let s = first + 2; s <= last - 2; s += 5) {
      // Dreiecke, die längs nahe an diesem Abschnitt liegen
      const near = tris.filter((tr) => Math.abs(((tr[0] + tr[3] + tr[6]) / 3 - t.px[s]) * t.tx[s] + ((tr[2] + tr[5] + tr[8]) / 3 - t.pz[s]) * t.tz[s]) < 8);
      const o = [t.px[s], t.py[s] + R, t.pz[s]];
      for (let a = 0.66; a < 2 * Math.PI - 0.66; a += 0.04) {
        const d = [rightX(t, s) * Math.sin(a), -Math.cos(a), rightZ(t, s) * Math.sin(a)];
        let best = Infinity;
        for (const tr of near) best = Math.min(best, hit(o, d, tr));
        rays++;
        if (!(best < R + 2.5)) throw new Error(`Durchblick aus der Trommel bei ${s} m unter ${a.toFixed(2)} rad (von der Bahn aus): ${best.toFixed(2)}, ${near.length} Dreiecke`);
      }
    }
    expect(rays).toBeGreaterThan(5000);

    // Alles Übrige (außer Lampen, Kabeln, Tragseil) ragt über der Bahn nirgends zwischen 0,25 m und 10 m auf
    const check = (mesh: THREE.Mesh, skip: [number, number][]): void => {
      const p = mesh.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        if (inRanges(i, skip)) continue;
        const l = local(t, first, last, p.getX(i), p.getY(i), p.getZ(i), 3);
        if (Math.abs(l.along) > 0.8) continue;
        if (Math.abs(l.lat) < 8.4 && l.h > 0.25 && l.h < 10) throw new Error(`${mesh.name}: Ecke ${i} bei ${l.seg} m in der Fahrbahn: seitlich ${l.lat.toFixed(2)}, Höhe ${l.h.toFixed(2)}`);
      }
    };
    check(fixed, data.hang);
    view.update(100, 0, 1 / 60, cam, fx);
    check(signal, []);
    // Lampen, Kabel und Tragseil: mindestens 10 m von der Fahrbahn
    for (const [a, b] of data.hang) {
      for (let i = a; i < b; i++) {
        const l = local(t, first, last, pos.getX(i), pos.getY(i), pos.getZ(i), 3);
        const off = Math.max(0, Math.abs(l.lat) - 8.4);
        const dist = Math.hypot(off, l.h, Math.max(0, Math.abs(l.along) - 0.6));
        if (dist < 10) throw new Error(`Hängendes bei ${l.seg} m nur ${dist.toFixed(2)} m von der Bahn`);
      }
    }
    view.dispose();
  });

  it('(b) die Deckenplatten liegen auf ihrer Spur und zeigen ihren Zustand: an, kündigt sich an, aus', () => {
    const view = buildDrum(t, true);
    const { signal, data } = parts(view);
    expect(data.plates.length).toBeGreaterThanOrEqual(6);
    const pos = signal.geometry.getAttribute('position');
    const col = signal.geometry.getAttribute('color');
    const seen = new Set<string>();
    for (const time of [0, 40, 100, 150, 200, 300]) {
      view.update(time, time / 60, 1 / 60, cam, fx);
      for (const p of data.plates) {
        // Soll: der gefährlichste Zustand seiner Platten
        let want = 0;
        for (const hi of p.holes) {
          const h = t.holes[hi];
          // kündigt sich an: schaltet binnen warn Ticks ab – das schließt planActive(plan, time + warn) ein und auch die
          // letzten Ticks davor, die jene Formel bei warn (150) > Dauer des Abschaltens (120) ausließe
          const s = planActive(h.plan, time) ? 2 : planUntil(h.plan, time) <= h.warn ? 1 : 0;
          if (s === 0) expect(planActive(h.plan, time + h.warn)).toBe(false);
          want = Math.max(want, s);
        }
        let area = 0;
        let r = 0;
        let g = 0;
        let b = 0;
        let minLat = Infinity;
        let maxLat = -Infinity;
        for (let v = p.from; v < p.to; v += 4) {
          const q = [0, 1, 2, 3].map((k) => new THREE.Vector3().fromBufferAttribute(pos, v + k));
          const a = new THREE.Vector3().subVectors(q[2], q[0]).cross(new THREE.Vector3().subVectors(q[3], q[1])).length() / 2;
          area += a;
          r += col.getX(v) * a;
          g += col.getY(v) * a;
          b += col.getZ(v) * a;
          for (const e of q) {
            expect(Number.isFinite(e.x + e.y + e.z)).toBe(true);
            const l = local(t, first, last, e.x, e.y, e.z, 2);
            if (a > 1e-6) {
              minLat = Math.min(minLat, l.lat);
              maxLat = Math.max(maxLat, l.lat);
            }
          }
        }
        const holes = p.holes.map((i) => t.holes[i]);
        const full = (holes[0].count - 0) * (p.lat1 - p.lat0);
        const where = `Platte ${p.holes.join('+')} (${p.lat0}…${p.lat1}) bei ${time} Ticks`;
        if (want === 2) {
          expect(area / full, where + ': aus, also fort').toBeLessThan(0.02);
          seen.add('aus');
          continue;
        }
        expect(area / full, where + ': sichtbar').toBeGreaterThan(0.4);
        // Spur: lat0 … lat1 auf 0,15 m
        expect(minLat, where).toBeGreaterThan(p.lat0 - 0.15);
        expect(maxLat, where).toBeLessThan(p.lat1 + 0.15);
        expect(minLat, where).toBeLessThan(p.lat0 + 0.15);
        expect(maxLat, where).toBeGreaterThan(p.lat1 - 0.15);
        r /= area;
        g /= area;
        b /= area;
        if (want === 0) {
          expect(b > r && b > g, where + `: an = blau (${r.toFixed(2)}, ${g.toFixed(2)}, ${b.toFixed(2)})`).toBe(true);
          seen.add('an');
        } else {
          expect(r > b && g > b && r > 0.5, where + `: kündigt sich an = gelb (${r.toFixed(2)}, ${g.toFixed(2)}, ${b.toFixed(2)})`).toBe(true);
          seen.add('gelb');
        }
      }
    }
    expect([...seen].sort()).toEqual(['an', 'aus', 'gelb']);
    view.dispose();
  });

  it('(c) die Lampen hängen zum Hallenboden – unten, an der Wand und an der Decke', () => {
    const view = buildDrum(t, true);
    const { fixed, data } = parts(view);
    const pos = fixed.geometry.getAttribute('position');
    const P = { x: 0, y: 0, z: 0 };
    for (const want of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      // die Lampe, deren Verdrehung dem Ziel am nächsten liegt
      const lamp = data.lamps.reduce((a, b) => (Math.abs(t.roll[b.seg] - want) < Math.abs(t.roll[a.seg] - want) ? b : a));
      expect(Math.abs(t.roll[lamp.seg] - want), `Lampe für ${want.toFixed(2)}`).toBeLessThan(0.35);
      const top = new THREE.Vector3(...lamp.top);
      // Aufhängung auf der Achse
      drumPoint(t, lamp.seg, 0, 0, R, P);
      expect(top.distanceTo(new THREE.Vector3(P.x, P.y, P.z))).toBeLessThan(0.6);
      // unteres Ende = die Ecke am weitesten von der Aufhängung
      let bottom = top.clone();
      for (let i = lamp.from; i < lamp.to; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        if (v.distanceTo(top) > bottom.distanceTo(top)) bottom = v;
      }
      drumPoint(t, lamp.seg, 0, R, R, P);
      const floor = new THREE.Vector3(P.x, P.y, P.z);
      expect(bottom.distanceTo(top)).toBeGreaterThan(5);
      expect(bottom.distanceTo(floor), `Lampe bei ${lamp.seg} m`).toBeLessThan(top.distanceTo(floor) - 5);
    }
    view.dispose();
  });

  it('(d) Zeitsprünge ergeben dasselbe Bild wie ein frischer Aufbau', () => {
    const snap = (v: MechanicView): Float32Array[] => {
      const { signal, glow } = parts(v);
      return [signal.geometry.getAttribute('position').array as Float32Array, signal.geometry.getAttribute('color').array as Float32Array, glow.geometry.getAttribute('color').array as Float32Array].map((a) => a.slice());
    };
    const same = (a: Float32Array[], b: Float32Array[]): void => {
      for (let k = 0; k < a.length; k++) {
        expect(a[k].length).toBe(b[k].length);
        let worst = 0;
        for (let i = 0; i < a[k].length; i++) worst = Math.max(worst, Math.abs(a[k][i] - b[k][i]));
        expect(worst).toBeLessThan(1e-5);
      }
    };
    const a = buildDrum(t, true);
    a.update(5000, 0, 1 / 60, cam, fx);
    a.update(17, 0, 1 / 60, cam, fx);
    const at17 = snap(a);
    a.update(5000, 0, 1 / 60, cam, fx);
    const at5000 = snap(a);
    const b = buildDrum(t, true);
    b.update(17, 0, 1 / 60, cam, fx);
    same(at17, snap(b));
    const c = buildDrum(t, true);
    c.update(5000, 0, 1 / 60, cam, fx);
    same(at5000, snap(c));
    for (const v of [a, b, c]) v.dispose();
  });

  it('(e) endlich, ohne eigenen Shader, ohne Textur, ohne Licht – und in den Grenzen', () => {
    for (const detail of [true, false]) {
      const view = buildDrum(t, detail);
      view.update(123, 2, 1 / 60, cam, fx);
      let calls = 0;
      let tris = 0;
      view.group.traverse((o) => {
        expect(o instanceof THREE.Light).toBe(false);
        if (!(o instanceof THREE.Mesh)) return;
        calls++;
        const g = o.geometry;
        tris += g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
        const p = g.getAttribute('position');
        for (let i = 0; i < p.count; i++) expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))).toBe(true);
        const m = o.material as THREE.Material & { map?: THREE.Texture | null };
        expect(m.map ?? null).toBeNull();
        expect(m.onBeforeCompile.toString()).toBe(new THREE.Material().onBeforeCompile.toString());
        if (m instanceof THREE.ShaderMaterial) expect(o.name).toBe('outline');
        else expect(m instanceof THREE.MeshBasicMaterial).toBe(true);
      });
      expect(tris).toBe(view.group.userData.triangles);
      expect(tris).toBeLessThanOrEqual(detail ? 24000 : 11000);
      expect(calls).toBeLessThanOrEqual(detail ? 10 : 7);
      view.dispose();
    }
  });
});

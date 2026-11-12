// Bild der Holzachterbahn (Achterbahn-Rummel, Strecke 16): render/mechanics/rails.ts.
//
// Geprüft wird, was ein Fehler im Bild verraten würde: Die Profile liegen dort, wo die Physik die Schienen hat
// (±2 m, auf Höhe und Querneigung der Fahrbahn); jede Magnetplatte liegt auf ihrer Schiene und zeigt zu jeder Zeit den
// Zustand, den pulseCycle verlangt – ebenso ihre Signallampe; Zeitsprünge ergeben dasselbe Bild wie ein frischer
// Aufbau; die Kette läuft bergauf; über der Fahrbahn steht nichts im Weg; Technik und Grenzen stimmen.
// Über das Aussehen auf einem echten Gerät sagt der Test nichts.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PULSE_KICK, pulseCycle, type Pulse } from '../../src/game/mechanics';
import { TRACK, rightX, rightZ, setTrack } from '../../src/game/track';
import type { FxSink } from '../../src/render/fxApi';
import { buildRails } from '../../src/render/mechanics/rails';

const fx: FxSink = { spark() {}, puff() {} };
const cam = new THREE.Vector3();
const RUMMEL = 16;

function role(group: THREE.Group, name: string): THREE.Mesh {
  const m = group.children.find((c) => c.userData.rolle === name);
  expect(m, name).toBeDefined();
  return m as THREE.Mesh;
}

/** Lage eines Punkts zur Strecke beim Abschnitt s: längs, seitlich, Höhe über der Fahrbahn an dieser Stelle (linear zwischen den Mitten). */
function local(s: number, x: number, y: number, z: number): { along: number; lat: number; up: number } {
  const t = TRACK;
  const dx = x - t.px[s];
  const dz = z - t.pz[s];
  const along = dx * t.tx[s] + dz * t.tz[s];
  const lat = dx * rightX(t, s) + dz * rightZ(t, s);
  const o = along >= 0 ? t.next[s] : t.prev[s];
  const f = Math.min(1, Math.abs(along) / t.step);
  const py = t.py[s] + (t.py[o] - t.py[s]) * f;
  const bank = t.bank[s] + (t.bank[o] - t.bank[s]) * f;
  return { along, lat, up: y - (py + lat * bank) };
}

/** Nächster Abschnitt eines Punkts innerhalb des Schienenstücks. */
function nearest(x: number, z: number, from: number, to: number): number {
  let best = from;
  let bd = Infinity;
  for (let s = from; s <= to; s++) {
    const d = (TRACK.px[s] - x) ** 2 + (TRACK.pz[s] - z) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

function mean(attr: THREE.BufferAttribute, start: number, count: number, ch = 0): number {
  let sum = 0;
  for (let i = start; i < start + count; i++) sum += attr.getComponent(i, ch);
  return sum / count;
}

/** Ein Magnet zieht ⇔ sein Schein leuchtet; ruht er (keine Ankündigung), sind die Winkel dunkel. */
const ZIEHT_SCHEIN = 0.25;
const AUS_SCHEIN = 0.05;
const RUHT_WINKEL = 0.15;
const ZIEHT_WINKEL = 0.5;
const ZIEHT_LAMPE = 0.5;
const AUS_LAMPE = 0.45;

describe('Achterbahn-Rummel: Bild der Schienen', () => {
  setTrack(RUMMEL);
  const rail = TRACK.rails[0];
  const first = rail.first;
  const last = rail.first + rail.count - 1;

  it('(a) Profile liegen bei ±2 m auf Höhe und Querneigung der Fahrbahn – überall, auch in der Steilkurve', () => {
    const view = buildRails(TRACK, true);
    const pos = role(view.group, 'profile').geometry.getAttribute('position') as THREE.BufferAttribute;
    const seen = new Map<number, Set<number>>();
    let banked = 0;
    for (let i = 0; i < pos.count; i++) {
      const s = nearest(pos.getX(i), pos.getZ(i), first, last);
      const l = local(s, pos.getX(i), pos.getY(i), pos.getZ(i));
      const lane = l.lat < 0 ? -2 : 2;
      expect(Math.abs(l.lat - lane)).toBeLessThan(0.85);
      expect(l.up).toBeGreaterThan(-0.05);
      expect(l.up).toBeLessThan(0.25);
      if (Math.abs(TRACK.bank[s]) > 0.3) banked++;
      const key = Math.round((s - first) / 10);
      if (!seen.has(key)) seen.set(key, new Set());
      seen.get(key)!.add(lane);
    }
    // an jeder geprüften Stelle (alle 10 m) beide Schienen
    for (let k = 0; k * 10 < rail.count - 5; k++) expect(seen.get(k)?.size ?? 0, `bei ${k * 10} m`).toBe(2);
    expect(banked).toBeGreaterThan(50);
    view.dispose();
  });

  it('(b, c) Magnetplatten liegen auf ihrer Schiene und zeigen – wie ihre Lampen – den Stand, den pulseCycle verlangt', () => {
    const view = buildRails(TRACK, true);
    const dyn = role(view.group, 'magnete');
    const glow = role(view.group, 'schein');
    const pos = dyn.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = dyn.geometry.getAttribute('color') as THREE.BufferAttribute;
    const gcol = glow.geometry.getAttribute('color') as THREE.BufferAttribute;
    const platten = dyn.userData.platten as { seg: number; lat: number; radius: number; pulse: Pulse; winkel: [number, number]; rand: [number, number] }[];
    const scheine = glow.userData.platten as { pulse: Pulse; schein: [number, number] }[];
    const lampen = dyn.userData.lampen as { pulse: Pulse; lampe: [number, number] }[];
    const kicks = TRACK.pulses.filter((p) => p.kind === PULSE_KICK);
    expect(kicks.length).toBe(12);
    expect(platten.length).toBe(12);
    expect(lampen.length).toBe(12);
    for (const time of [0, 40, 80, 130, 170, -100, 3000.5, 7777]) {
      view.update(time, 0, 1 / 60, cam, fx);
      const ziehtJe = new Map<number, number>();
      platten.forEach((pl, i) => {
        // Lage: alle Ecken der Winkel und des Rands
        let latSum = 0;
        let n = 0;
        for (const [start, count] of [pl.winkel, pl.rand]) {
          for (let v = start; v < start + count; v++) {
            const l = local(pl.seg, pos.getX(v), pos.getY(v), pos.getZ(v));
            expect(Math.abs(l.along)).toBeLessThanOrEqual(0.5 + pl.radius + 1e-3);
            expect(Math.abs(l.lat - pl.lat)).toBeLessThan(0.5);
            // Höhe gegen den nächsten Abschnitt (auf dem Lifthügel steigt die Bahn längs der Platte fast 2 m)
            const h = local(nearest(pos.getX(v), pos.getZ(v), first, last), pos.getX(v), pos.getY(v), pos.getZ(v)).up;
            expect(h).toBeGreaterThan(0);
            expect(h).toBeLessThan(0.25);
            latSum += l.lat;
            n++;
          }
        }
        expect(Math.abs(latSum / n - pl.lat)).toBeLessThan(0.1);
        // Zustand
        const p = pl.pulse;
        const c = pulseCycle(p, time);
        const zieht = c < p.on;
        const ruht = !zieht && c < p.period - p.warn;
        const schein = mean(gcol, scheine[i].schein[0], scheine[i].schein[1]);
        const winkel = mean(col, pl.winkel[0], pl.winkel[1]);
        if (zieht) {
          expect(schein, `Schein bei ${time}`).toBeGreaterThan(ZIEHT_SCHEIN);
          expect(winkel).toBeGreaterThan(ZIEHT_WINKEL);
          ziehtJe.set(p.seg, (ziehtJe.get(p.seg) ?? 0) + 1);
        } else expect(schein, `Schein bei ${time}`).toBeLessThan(AUS_SCHEIN);
        if (ruht) expect(winkel).toBeLessThan(RUHT_WINKEL);
      });
      // nie beide eines Paars zugleich
      for (const n of ziehtJe.values()) expect(n).toBeLessThanOrEqual(1);
      for (const l of lampen) {
        const c = pulseCycle(l.pulse, time);
        const r = mean(col, l.lampe[0], l.lampe[1]);
        if (c < l.pulse.on) expect(r).toBeGreaterThan(ZIEHT_LAMPE);
        else expect(r).toBeLessThan(AUS_LAMPE);
      }
    }
    view.dispose();
  });

  it('(d) Zeitsprünge ergeben dasselbe Bild wie ein frischer Aufbau; die Kette läuft bergauf', () => {
    const a = buildRails(TRACK, true);
    for (const time of [5000, 17, 5000]) a.update(time, 0, 1 / 60, cam, fx);
    const b = buildRails(TRACK, true);
    b.update(5000, 9, 1 / 60, cam, fx);
    for (const name of ['magnete', 'schein', 'kette']) {
      for (const attr of ['position', 'color']) {
        const x = role(a.group, name).geometry.getAttribute(attr).array as Float32Array;
        const y = role(b.group, name).geometry.getAttribute(attr).array as Float32Array;
        expect(Array.from(x)).toEqual(Array.from(y));
      }
    }
    const chain = role(a.group, 'kette');
    const ketten = chain.userData.ketten as { s0: number; ecken: [number, number] }[];
    expect(ketten.length).toBe(2);
    const pos = chain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const along = (s0: number, v: number): number => local(s0, pos.getX(v), pos.getY(v), pos.getZ(v)).along;
    for (const k of ketten) {
      // Glied 5 (nicht am Umlauf): kurz danach ein Stück weiter oben
      const v = k.ecken[0] + 5 * 12;
      a.update(100, 0, 1 / 60, cam, fx);
      const u0 = along(k.s0, v);
      const y0 = pos.getY(v);
      a.update(101, 0, 1 / 60, cam, fx);
      const u1 = along(k.s0, v);
      expect(u1 - u0).toBeGreaterThan(0.1);
      expect(u1 - u0).toBeLessThan(0.3);
      expect(pos.getY(v)).toBeGreaterThan(y0);
    }
    a.dispose();
    b.dispose();
  });

  it('(e) über der Fahrbahn steht nichts im Weg (±4,4 m, 0,25–10 m)', () => {
    for (const detail of [true, false]) {
      const view = buildRails(TRACK, detail);
      view.update(4321, 0, 1 / 60, cam, fx);
      const meshes: THREE.Mesh[] = [];
      view.group.traverse((o) => o instanceof THREE.Mesh && o.name !== 'outline' && meshes.push(o));
      const t = TRACK;
      for (const m of meshes) {
        const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
        const n = m.geometry.drawRange.count === Infinity ? pos.count : Math.min(pos.count, m.geometry.drawRange.count);
        for (let s = 0; s < t.total; s += 5) {
          for (let i = 0; i < n; i++) {
            const dx = pos.getX(i) - t.px[s];
            const dz = pos.getZ(i) - t.pz[s];
            if (dx * dx + dz * dz > 25) continue;
            const l = local(s, pos.getX(i), pos.getY(i), pos.getZ(i));
            if (Math.abs(l.along) > 0.5 || Math.abs(l.lat) > 4.4) continue;
            if (l.up > 0.25 && l.up < 10) throw new Error(`${m.userData.rolle}: Ecke ${i} bei Abschnitt ${s} liegt ${l.up.toFixed(2)} m über der Bahn (lat ${l.lat.toFixed(2)})`);
          }
        }
      }
      view.dispose();
    }
  });

  it('(f) endliche Koordinaten, erlaubte Technik, Grenzen für Dreiecke und Zeichenaufrufe', () => {
    for (const [detail, maxTris, maxCalls] of [
      [true, 24000, 10],
      [false, 11000, 7],
    ] as const) {
      const view = buildRails(TRACK, detail);
      view.update(77, 0, 1 / 60, cam, fx);
      let tris = 0;
      let calls = 0;
      view.group.traverse((o) => {
        expect(o instanceof THREE.Light).toBe(false);
        if (!(o instanceof THREE.Mesh)) return;
        calls++;
        const g = o.geometry;
        const pos = g.getAttribute('position');
        const n = Math.min(pos.count, g.drawRange.count);
        tris += (g.index ? g.index.count : n) / 3;
        for (let i = 0; i < n * 3; i++) expect(Number.isFinite(pos.array[i])).toBe(true);
        const m = o.material as THREE.Material & { map?: THREE.Texture | null };
        expect(m.map ?? null).toBeNull();
        expect(m.onBeforeCompile.toString()).toBe(new THREE.Material().onBeforeCompile.toString());
        if (m instanceof THREE.ShaderMaterial) expect(o.name).toBe('outline');
      });
      console.log(`Schienenbild detail=${detail}: ${Math.round(tris)} Dreiecke, ${calls} Zeichenaufrufe`);
      expect(tris).toBeLessThanOrEqual(maxTris);
      expect(calls).toBeLessThanOrEqual(maxCalls);
      view.dispose();
    }
  });
});

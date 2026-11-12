// Bild der Spiegel im Spiegelkabinett (Strecke 13).
//
// Die Spiegelflächen und Teppiche sind Netze, deren Ecken und Farben je Bild aus der Rennzeit neu gesetzt
// werden (render/mechanics/mirrors.ts). Geprüft wird in Zahlen, was ein Spieler daraus ablesen soll und was
// die Physik entscheidet (game/mechanics.ts: portalOpen; game/sim.ts: die Durchfahrt zählt an der Grenze am
// Ende von seg, heraus kommt man an der Grenze vor to):
//   (a) Ein Spiegel ist genau dann sichtbar, wenn an seinem Rahmen ein Portal offen ist, und hat dessen Farbe.
//   (b) Er steht genau in der Ebene, die die Physik zählt, seitlich von lat0 bis lat1, auf der Fahrbahn.
//   (c) Springt die Zeit, stimmt das Bild sofort (reine Funktion der Rennzeit).
//   (d) Der Teppich jeder Spur zeigt dieselbe Sorte wie ihr Spiegel.
//   (e) Keine unendlichen Ecken, keine eigenen Shader, keine Texturen, Grenzen für Dreiecke und Zeichenaufrufe.
// Die Sorte wird aus den Eckenfarben gelesen, nicht aus einer Kennzeichnung: Türkis (Blau deutlich über Rot)
// = vorwärts, Pink (Rot deutlich über Grün) = zurück, alles andere (Tusche, Weiß) = neutral.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { portalOpen } from '../../src/game/mechanics';
import { TRACK, groundAt, rightX, rightZ, setTrack } from '../../src/game/track';
import type { FxSink } from '../../src/render/fxApi';
import { buildMirrors, type CarpetInfo, type PaneInfo } from '../../src/render/mechanics/mirrors';

const fx: FxSink = { spark() {}, puff() {} };
const cam = new THREE.Vector3();
/** Prüfzeiten in Sekunden (Rennzeit). */
const TIMES = [0, 2, 3.9, 4.1, 5, 5.4, 5.7, 6.1, 9, 11.4, 11.8, 12.1, 30, 300];

function find(group: THREE.Group, role: string): THREE.Mesh {
  const found = group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.userData.role === role);
  expect(found.length).toBe(1);
  return found[0];
}

/** Sorte einer Ecke aus ihrer Farbe: 0 Türkis, 1 Pink, −1 neutral. */
function kindOf(col: THREE.BufferAttribute, i: number): number {
  const r = col.getX(i);
  const g = col.getY(i);
  const b = col.getZ(i);
  if (b - r > 0.25) return 0;
  if (r - g > 0.3 && r > b) return 1;
  return -1;
}

interface Seen {
  /** größte Deckkraft im Bereich */
  maxA: number;
  /** Sorten der Ecken, die man sieht (Deckkraft > 0,05) */
  kinds: Set<number>;
}

function look(mesh: THREE.Mesh, first: number, count: number): Seen {
  const col = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  expect(col.itemSize).toBe(4);
  const kinds = new Set<number>();
  let maxA = 0;
  for (let i = first; i < first + count; i++) {
    const a = col.getW(i);
    maxA = Math.max(maxA, a);
    if (a > 0.05) kinds.add(kindOf(col, i));
  }
  return { maxA, kinds };
}

/** Lage aller sichtbaren Ecken eines Bereichs, bezogen auf die Ebene der Physik. */
function place(mesh: THREE.Mesh, first: number, count: number, seg: number, end: boolean) {
  const t = TRACK;
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const col = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  const h = (t.step / 2) * (end ? 1 : -1);
  const bx = t.px[seg] + t.tx[seg] * h;
  const bz = t.pz[seg] + t.tz[seg] * h;
  let maxD = 0;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minH = Infinity;
  for (let i = first; i < first + count; i++) {
    if (col.getW(i) <= 0.05) continue;
    const dx = pos.getX(i) - bx;
    const dz = pos.getZ(i) - bz;
    const d = dx * t.tx[seg] + dz * t.tz[seg];
    const lat = dx * rightX(t, seg) + dz * rightZ(t, seg);
    maxD = Math.max(maxD, Math.abs(d));
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    // Höhe über der Fahrbahn, wie die Physik sie an dieser Stelle hat
    minH = Math.min(minH, pos.getY(i) - groundAt(t, seg, h, lat));
  }
  return { maxD, minLat, maxLat, minH };
}

/** Ist an diesem Rahmen ein Portal offen – und welches? */
function openAt(info: PaneInfo, time: number): number[] {
  return TRACK.portals.filter((p) => p.seg === info.seg && p.lat0 === info.lat0 && p.lat1 === info.lat1 && portalOpen(p, time)).map((p) => p.kind);
}

function snapshot(group: THREE.Group): number[][] {
  const out: number[][] = [];
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.name === 'outline') return;
    const pos = o.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (pos.usage !== THREE.DynamicDrawUsage) return;
    out.push([o.visible ? 1 : 0], Array.from(pos.array as Float32Array), Array.from((o.geometry.getAttribute('color') as THREE.BufferAttribute).array as Float32Array));
  });
  return out;
}

describe('Spiegelkabinett: Bild der Spiegel', () => {
  it('(a, b) ein Spiegel ist genau dann zu sehen, wenn die Physik ihn offen hat – in ihrer Farbe und an ihrer Stelle', () => {
    setTrack(13);
    expect(TRACK.portals.length).toBe(6);
    const view = buildMirrors(TRACK, true);
    const glass = find(view.group, 'spiegel');
    const panes = glass.userData.panes as PaneInfo[];
    const entrances = panes.filter((p) => !p.exit);
    const exits = panes.filter((p) => p.exit);
    expect(entrances.length).toBe(4);
    expect(exits.length).toBe(6);
    let seenOpen = 0;
    let seenShut = 0;
    for (const s of TIMES) {
      const time = s * 60;
      view.update(time, s, 1 / 60, cam, fx);
      for (const e of entrances) {
        const open = openAt(e, time);
        // Nie zwei Spiegel in einem Rahmen (sonst wäre die Farbe nicht eindeutig)
        expect(open.length).toBeLessThanOrEqual(1);
        const seen = look(glass, e.first, e.count);
        const where = `Rahmen ${e.seg} (${e.lat0} … ${e.lat1}) bei ${s} s`;
        if (open.length === 1) {
          seenOpen++;
          expect(seen.maxA, `${where}: Spiegel nicht deckend genug`).toBeGreaterThanOrEqual(0.5);
          expect([...seen.kinds].filter((k) => k !== -1), `${where}: Farbe`).toEqual(open);
          expect(e.kind).toBe(open[0]);
          // (b) Lage: in der Ebene am Ende von seg, seitlich lat0 … lat1, auf der Fahrbahn
          const at = place(glass, e.first, e.count, e.seg, true);
          expect(at.maxD, `${where}: Abstand zur Ebene`).toBeLessThanOrEqual(0.1);
          expect(Math.abs(at.minLat - e.lat0), `${where}: linke Kante`).toBeLessThanOrEqual(0.15);
          expect(Math.abs(at.maxLat - e.lat1), `${where}: rechte Kante`).toBeLessThanOrEqual(0.15);
          expect(at.minH, `${where}: unter der Fahrbahn`).toBeGreaterThanOrEqual(-0.05);
          expect(at.minH, `${where}: schwebt über der Fahrbahn`).toBeLessThanOrEqual(0.1);
        } else {
          seenShut++;
          expect(seen.maxA, `${where}: leerer Rahmen zeigt einen Spiegel`).toBeLessThan(0.02);
          expect(e.kind).toBe(-1);
          // Der Vorbote darf blass zu sehen sein – aber nur blass
          expect(look(glass, e.heraldFirst, e.heraldCount).maxA).toBeLessThanOrEqual(0.3);
        }
      }
      // Ausgänge: zarter Schleier in der Ebene vor to, seitlich wie der Eingang, in der Farbe der Sorte
      for (const x of exits) {
        const seen = look(glass, x.first, x.count);
        const where = `Ausgang ${x.to} (${x.lat0} … ${x.lat1}) bei ${s} s`;
        expect(seen.maxA, where).toBeGreaterThan(0.05);
        expect(seen.maxA, where).toBeLessThanOrEqual(0.8);
        expect([...seen.kinds].filter((k) => k !== -1), where).toEqual([x.kind]);
        const at = place(glass, x.first, x.count, x.to, false);
        expect(at.maxD, `${where}: Abstand zur Ebene`).toBeLessThanOrEqual(0.1);
        expect(Math.abs(at.minLat - x.lat0), `${where}: linke Kante`).toBeLessThanOrEqual(0.15);
        expect(Math.abs(at.maxLat - x.lat1), `${where}: rechte Kante`).toBeLessThanOrEqual(0.15);
        expect(at.minH, where).toBeGreaterThanOrEqual(-0.05);
        expect(at.minH, where).toBeLessThanOrEqual(0.1);
      }
    }
    // Die Prüfzeiten treffen beide Zustände
    expect(seenOpen).toBeGreaterThan(10);
    expect(seenShut).toBeGreaterThan(5);
    view.dispose();
  });

  it('(c) Zeitsprünge: das Bild hängt allein an der Rennzeit', () => {
    setTrack(13);
    const a = buildMirrors(TRACK, true);
    a.update(200 * 60, 1, 1 / 60, cam, fx);
    const at200 = snapshot(a.group);
    a.update(3 * 60, 2, 1 / 60, cam, fx);
    const at3 = snapshot(a.group);
    const b = buildMirrors(TRACK, true);
    b.update(3 * 60, 77, 1 / 60, cam, fx);
    expect(at3).toEqual(snapshot(b.group));
    a.update(200 * 60, 3, 1 / 60, cam, fx);
    expect(snapshot(a.group)).toEqual(at200);
    // Im Countdown gilt der Stand von Zeit 0
    b.update(0, 0, 1 / 60, cam, fx);
    const at0 = snapshot(b.group);
    b.update(-150, 5, 1 / 60, cam, fx);
    expect(snapshot(b.group)).toEqual(at0);
    a.dispose();
    b.dispose();
  });

  it('(d) der Teppich jeder Spur zeigt die Sorte ihres Spiegels (neutral, wenn der Rahmen leer ist)', () => {
    setTrack(13);
    const view = buildMirrors(TRACK, true);
    const floor = find(view.group, 'teppich');
    const carpets = floor.userData.carpets as CarpetInfo[];
    expect(carpets.length).toBe(4);
    for (const s of TIMES) {
      const time = s * 60;
      view.update(time, s, 1 / 60, cam, fx);
      for (const c of carpets) {
        const open = TRACK.portals.filter((p) => p.seg === c.seg && p.lat0 === c.lat0 && p.lat1 === c.lat1 && portalOpen(p, time)).map((p) => p.kind);
        const seen = look(floor, c.first, c.count);
        const where = `Teppich ${c.seg} (${c.lat0} … ${c.lat1}) bei ${s} s`;
        expect(seen.maxA, where).toBeGreaterThan(0.05);
        if (open.length === 1) {
          expect([...seen.kinds], where).toEqual(open);
          expect(seen.maxA, `${where}: zu blass`).toBeGreaterThan(0.5);
        } else {
          expect([...seen.kinds], where).toEqual([-1]);
          expect(seen.maxA, `${where}: leer, aber auffällig`).toBeLessThanOrEqual(0.25);
        }
        expect(c.kind).toBe(open.length === 1 ? open[0] : -1);
        // Teppich liegt auf seiner Spur, auf den 45 m vor dem Rahmen
        const pos = floor.geometry.getAttribute('position') as THREE.BufferAttribute;
        const col = floor.geometry.getAttribute('color') as THREE.BufferAttribute;
        const t = TRACK;
        const bx = t.px[c.seg] + (t.tx[c.seg] * t.step) / 2;
        const bz = t.pz[c.seg] + (t.tz[c.seg] * t.step) / 2;
        for (let i = c.first; i < c.first + c.count; i++) {
          if (col.getW(i) <= 0.05) continue;
          // Nicht hinter dem Rahmen
          const along = (pos.getX(i) - bx) * t.tx[c.seg] + (pos.getZ(i) - bz) * t.tz[c.seg];
          expect(along, where).toBeLessThanOrEqual(0.05);
          // Seitliche Lage am nächstgelegenen Abschnitt (wie die Physik zuordnet), höchstens 47 Abschnitte vor dem Rahmen
          let best = -1;
          let bestD = Infinity;
          let seg = t.next[c.seg];
          for (let k = 0; k < 49; k++, seg = t.prev[seg]) {
            const d = (pos.getX(i) - t.px[seg]) ** 2 + (pos.getZ(i) - t.pz[seg]) ** 2;
            if (d < bestD) {
              bestD = d;
              best = seg;
            }
          }
          const lat = (pos.getX(i) - t.px[best]) * rightX(t, best) + (pos.getZ(i) - t.pz[best]) * rightZ(t, best);
          expect(lat, where).toBeGreaterThanOrEqual(c.lat0 - 0.05);
          expect(lat, where).toBeLessThanOrEqual(c.lat1 + 0.05);
          expect(pos.getY(i) - groundAt(t, best, 0, lat), where).toBeGreaterThan(0);
          expect(pos.getY(i) - groundAt(t, best, 0, lat), where).toBeLessThan(0.15);
        }
      }
    }
    view.dispose();
  });

  it('(e) endlich, ohne eigene Shader und Texturen, in den Grenzen für Dreiecke und Zeichenaufrufe', () => {
    setTrack(13);
    const src = readFileSync(join(import.meta.dirname, '../../src/render/mechanics/mirrors.ts'), 'utf8');
    expect(src).not.toMatch(/ShaderMaterial|onBeforeCompile|Texture|WebGLRenderTarget|Light\(/);
    for (const detail of [true, false]) {
      const view = buildMirrors(TRACK, detail);
      for (const s of TIMES) {
        view.update(s * 60, s, 1 / 60, cam, fx);
        view.group.updateMatrixWorld(true);
        let calls = 0;
        let tris = 0;
        view.group.traverse((o) => {
          if (!(o instanceof THREE.Mesh) || !o.visible) return;
          calls++;
          const g = o.geometry;
          const pos = g.getAttribute('position');
          tris += (g.index ? g.index.count : pos.count) / 3;
          for (let i = 0; i < pos.count; i++) expect(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i))).toBe(true);
          const m = o.material as THREE.Material & { map?: THREE.Texture | null };
          expect(m.map ?? null).toBeNull();
          expect(m.onBeforeCompile.toString()).toBe(new THREE.Material().onBeforeCompile.toString());
          if (m instanceof THREE.ShaderMaterial) expect(o.name).toBe('outline');
        });
        expect((view.group.userData.overflow as () => boolean)()).toBe(false);
        if (detail) {
          expect(tris).toBeLessThanOrEqual(10000);
          expect(calls).toBeLessThanOrEqual(10);
        } else {
          expect(tris).toBeLessThanOrEqual(5500);
          expect(calls).toBeLessThanOrEqual(7);
        }
        if (s === 0) console.log(`detail=${detail}: ${tris} Dreiecke, ${calls} Zeichenaufrufe`);
      }
      view.dispose();
    }
  });
});

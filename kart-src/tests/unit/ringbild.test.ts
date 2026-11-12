// Bild der Größenringe und Größentore im Riesenkinderzimmer (render/mechanics/sizers.ts).
//
// Geprüft wird, dass das Bild mit der Physik deckungsgleich ist: Die Ringe stehen in der Ebene, in der
// sim.ts die Durchfahrt zählt, ihre lichte Weite ist genau die Spur lat0 … lat1, und darin steht bis 2,2 m
// Höhe nichts Festes; die Teppiche liegen in der Spur flach auf der Fahrbahn; die Tor-Wände stehen auf der
// Bandenlinie der Hauptstrecke (dort, wo gateShut Karts abprallen lässt), lassen die Hauptstrecke frei und
// versperren den Durchlass nicht; die Klotzmauer fliegt nur für riesige Karts auseinander und kommt wieder.
// Über das Aussehen auf einem echten Gerät sagt der Test nichts.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gridState } from '../../src/game/sim';
import { TRACK, groundAt, rightX, rightZ, setTrack, trackHeading } from '../../src/game/track';
import type { RenderEntity } from '../../src/game/view';
import type { FxSink } from '../../src/render/fxApi';
import { buildSizers, SIZER_MESH_BLOCKS, SIZER_MESH_BODY, SIZER_MESH_LINTEL, SIZER_MESH_SIGNS, type SizerPart } from '../../src/render/mechanics/sizers';

const ZIMMER = 15;
const fx: FxSink = { spark() {}, puff() {} };

interface Info {
  parts: SizerPart[];
  blockGate: Int8Array;
  blockPassage: Uint8Array;
  gates: { k: number; seg0: number; len: number; a: number; b: number; side: number; only: number }[];
}

function build(detail: boolean) {
  setTrack(ZIMMER);
  const view = buildSizers(TRACK, detail);
  view.update(0, 1.234, 1 / 60, new THREE.Vector3(), fx);
  const info = view.group.userData.sizers as Info;
  const mesh = (name: string) => view.group.children.find((c) => c.name === name) as THREE.Mesh;
  return { view, info, mesh };
}

function vertices(mesh: THREE.Mesh, first: number, count: number): THREE.Vector3[] {
  const pos = mesh.geometry.getAttribute('position');
  const out: THREE.Vector3[] = [];
  for (let i = first; i < first + count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i));
  return out;
}

/** Die acht Ecken jedes Klotzes (Instanz-Matrix · Einheitswürfel). */
function blockCorners(mesh: THREE.InstancedMesh, i: number): THREE.Vector3[] {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  const out: THREE.Vector3[] = [];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) out.push(new THREE.Vector3(x, y, z).applyMatrix4(m));
  return out;
}
function blockCenter(mesh: THREE.InstancedMesh, i: number): THREE.Vector3 {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
}

/** Nächster Abschnitt der Hauptstrecke zwischen lo und hi; seitliche Lage, Lage längs, Höhe über der Fahrbahn. */
function onMain(p: THREE.Vector3, lo: number, hi: number) {
  const t = TRACK;
  let best = lo;
  let bd = Infinity;
  for (let s = lo; s <= hi; s++) {
    const d = (p.x - t.px[s]) ** 2 + (p.z - t.pz[s]) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  const lat = (p.x - t.px[best]) * rightX(t, best) + (p.z - t.pz[best]) * rightZ(t, best);
  const al = (p.x - t.px[best]) * t.tx[best] + (p.z - t.pz[best]) * t.tz[best];
  return { seg: best, lat, along: al, h: p.y - (t.py[best] + lat * t.bank[best]) };
}

describe('Riesenkinderzimmer: Bild der Ringe und Tore', () => {
  it('(a) jeder Ring steht in der Zählebene, seine lichte Weite ist die Spur, darin nichts Festes bis 2,2 m', () => {
    const { view, info, mesh } = build(true);
    const t = TRACK;
    expect(t.sizers.length).toBe(2);
    const body = mesh(SIZER_MESH_BODY);
    t.sizers.forEach((z, ri) => {
      const s = z.seg;
      const n = t.next[s];
      const o = new THREE.Vector3((t.px[s] + t.px[n]) / 2, (t.py[s] + t.py[n]) / 2, (t.pz[s] + t.pz[n]) / 2);
      const d = new THREE.Vector3(t.px[n] - t.px[s], 0, t.pz[n] - t.pz[s]).normalize();
      const r = new THREE.Vector3(-d.z, 0, d.x);
      const bank = (t.bank[s] + t.bank[n]) / 2;
      const ps = info.parts.filter((p) => p.mesh === SIZER_MESH_BODY && (p.kind === 'ring' ? p.id === ri : p.kind === 'schild' && p.id === -1 - ri));
      expect(ps.length).toBe(2);
      const ring = info.parts.find((p) => p.kind === 'ring' && p.id === ri)!;
      const vs = vertices(body, ring.first, ring.count).map((p) => {
        const q = p.clone().sub(o);
        const lat = q.dot(r);
        return { w: q.dot(d), lat, h: p.y - (o.y + lat * bank) };
      });
      // Ebene: zwischen seg und dem nächsten Abschnitt
      const ws = vs.map((v) => v.w);
      expect(Math.abs((Math.max(...ws) + Math.min(...ws)) / 2)).toBeLessThan(0.1);
      // Unterkante auf der Fahrbahn
      expect(Math.abs(Math.min(...vs.map((v) => v.h)))).toBeLessThan(0.05);
      // lichte Weite unten: links bis lat0, rechts ab lat1
      const low = vs.filter((v) => v.h < 2.2);
      const mid = (z.lat0 + z.lat1) / 2;
      expect(Math.abs(Math.max(...low.filter((v) => v.lat < mid).map((v) => v.lat)) - z.lat0)).toBeLessThan(0.2);
      expect(Math.abs(Math.min(...low.filter((v) => v.lat > mid).map((v) => v.lat)) - z.lat1)).toBeLessThan(0.2);
      // Kein Dreieck des Rings (samt Schild) ragt unter 2,2 m in die Spur
      for (const p of ps) {
        const all = vertices(body, p.first, p.count);
        for (let i = 0; i < all.length; i += 3) {
          const tri = [all[i], all[i + 1], all[i + 2]].map((q) => {
            const lat = q.clone().sub(o).dot(r);
            return { lat, h: q.y - (o.y + lat * bank) };
          });
          if (Math.min(...tri.map((v) => v.h)) >= 2.2) continue;
          const left = tri.every((v) => v.lat <= z.lat0 + 0.01);
          const right = tri.every((v) => v.lat >= z.lat1 - 0.01);
          if (!left && !right) throw new Error(`Ring ${ri}: Dreieck ${i / 3} ragt unter 2,2 m in die Spur`);
        }
      }
    });
    view.dispose();
  });

  it('(b) jeder Spur-Teppich liegt in seiner Spur, höchstens 6 cm über der Fahrbahn', () => {
    const { view, info, mesh } = build(true);
    const t = TRACK;
    const signs = mesh(SIZER_MESH_SIGNS);
    for (const seconds of [0, 0.37, 2.5, 13.1, 600.7]) {
      view.update(seconds * 60, seconds, 1 / 60, new THREE.Vector3(), fx);
      t.sizers.forEach((z, ri) => {
        const part = info.parts.find((p) => p.kind === 'teppich' && p.id === ri)!;
        let seen = 0;
        for (const p of vertices(signs, part.first, part.count)) {
          expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
          const pr = onMain(p, z.seg - 52, z.seg + 2);
          expect(pr.lat).toBeGreaterThanOrEqual(z.lat0 - 0.01);
          expect(pr.lat).toBeLessThanOrEqual(z.lat1 + 0.01);
          const up = p.y - groundAt(t, pr.seg, pr.along, pr.lat);
          expect(up).toBeGreaterThanOrEqual(0);
          expect(up).toBeLessThanOrEqual(0.06);
          // vor dem Ring (bis etwa 47 m davor)
          const back = z.seg - pr.seg + 0.5 - pr.along;
          expect(back).toBeGreaterThan(-0.1);
          expect(back).toBeLessThan(48);
          seen++;
        }
        expect(seen).toBeGreaterThan(100);
      });
    }
    view.dispose();
  });

  it('(c) die Tor-Wände stehen auf der Bandenlinie, lassen die Hauptstrecke frei und den Durchlass offen', () => {
    const { view, info, mesh } = build(true);
    const t = TRACK;
    const body = mesh(SIZER_MESH_BODY);
    const blocks = view.group.children.find((c) => c.name === SIZER_MESH_BLOCKS) as THREE.InstancedMesh;
    expect(info.gates.map((g) => g.only).sort()).toEqual([-1, 1]);
    for (const g of info.gates) {
      const lo = g.seg0 - 12;
      const hi = g.seg0 + g.len + 12;
      const walls: THREE.Vector3[] = [];
      for (const p of info.parts) if (p.kind === 'tor' && p.id === g.k && p.solid) walls.push(...vertices(mesh(p.mesh), p.first, p.count));
      for (let i = 0; i < info.blockGate.length; i++) if (info.blockGate[i] === g.k) walls.push(...blockCorners(blocks, i));
      const solid = [...walls];
      for (const p of info.parts) if (p.kind === 'schild' && p.id === g.k) solid.push(...vertices(body, p.first, p.count));
      expect(walls.length).toBeGreaterThan(50);
      const ws = walls.map((p) => ({ p, m: onMain(p, lo, hi) }));
      // Stichproben alle 4 m: die zur Fahrbahn zeigende Fläche liegt auf der Linie ±wh
      let samples = 0;
      for (let s = 2; s <= g.len - 2; s += 4) {
        const seg = g.seg0 + s;
        const near = ws.filter((w) => Math.abs(w.m.seg + w.m.along - seg) < 1.5).map((w) => w.m.lat * g.side);
        expect(near.length, `Tor ${g.k}, Meter ${s}`).toBeGreaterThan(0);
        expect(Math.abs(Math.min(...near) - t.wh[seg]), `Tor ${g.k}, Meter ${s}`).toBeLessThan(0.6);
        samples++;
      }
      expect(samples).toBeGreaterThan(10);
      // Nichts Festes näher als wh − 0,3 an der Mitte der Hauptstrecke
      for (const p of solid) {
        const m = onMain(p, lo, hi);
        if (Math.abs(m.lat) < t.wh[m.seg] - 0.3) throw new Error(`Tor ${g.k}: fester Körper bei Abschnitt ${m.seg}, seitlich ${m.lat.toFixed(2)}`);
      }
      // Durchlass: Wo ein Kart passender Größe die Linie überqueren kann, steht unter 1,3 m (Mauseloch) bzw.
      // überhaupt (Burg, außer den Klötzen, die beim Durchbruch wegfliegen) nichts.
      const pass = (m: { seg: number; along: number }) => {
        const s = m.seg + m.along - g.seg0;
        return s > g.a + 0.01 && s < g.b - 0.01;
      };
      if (g.only < 0) {
        for (const w of ws) if (pass(w.m)) expect(w.m.h, `Mauseloch: Ecke bei Meter ${(w.m.seg + w.m.along - g.seg0).toFixed(2)}`).toBeGreaterThan(1.25);
        expect(g.b - g.a).toBeGreaterThan(20);
      } else {
        for (let i = 0; i < info.blockGate.length; i++) {
          if (info.blockGate[i] !== g.k) continue;
          if (pass(onMain(blockCenter(blocks, i), lo, hi))) expect(info.blockPassage[i], `Klotz ${i}`).toBe(1);
          else expect(info.blockPassage[i], `Klotz ${i}`).toBe(0);
        }
        for (const p of info.parts) {
          if (p.kind !== 'tor' || p.id !== g.k) continue;
          for (const v of vertices(mesh(p.mesh), p.first, p.count)) expect(pass(onMain(v, lo, hi))).toBe(false);
        }
      }
    }
    view.dispose();
  });

  /** Ein Kart an Abschnitt seg, seitlich lat, Tempo v, Kurs um turn (rad, links positiv) gegen die Strecke gedreht. */
  function kart(seg: number, lat: number, v: number, turn: number, size: number): RenderEntity {
    const t = TRACK;
    const s = gridState(0);
    const h = trackHeading(t, seg) + turn;
    Object.assign(s, { seg, x: t.px[seg] + rightX(t, seg) * lat, z: t.pz[seg] + rightZ(t, seg) * lat, y: t.py[seg], heading: h, vx: Math.sin(h) * v, vz: Math.cos(h) * v, size });
    return { ...s, slot: 0, bot: false, lap: 1, place: 1, finished: false };
  }

  it('(d) die Klotzmauer fliegt für ein riesiges Kart auseinander und setzt sich wieder zusammen', () => {
    const { view, info } = build(true);
    const t = TRACK;
    const blocks = view.group.children.find((c) => c.name === SIZER_MESH_BLOCKS) as THREE.InstancedMesh;
    const g = info.gates.find((q) => q.only > 0)!;
    const passage = [...info.blockPassage.keys()].filter((i) => info.blockPassage[i] === 1);
    expect(passage.length).toBeGreaterThan(20);
    const rest = new Map<number, THREE.Vector3[]>();
    for (let i = 0; i < info.blockGate.length; i++) rest.set(i, blockCorners(blocks, i));
    const center0 = (i: number) => rest.get(i)!.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / 8);
    const atRest = (tol: number) => {
      for (let i = 0; i < info.blockGate.length; i++) {
        const c = blockCorners(blocks, i);
        const r = rest.get(i)!;
        for (let k = 0; k < 8; k++) if (c[k].distanceTo(r[k]) > tol) return false;
      }
      return true;
    };
    // Kart etwa 10 m vor der Mauer: 6 m hinter dem Anfang des Durchlasses, links in der Bahn, 30° zur Mauer hin
    const seg = g.seg0 + Math.round(g.a) + 6;
    const lat = 3 * g.side;
    const dist = (t.wh[seg] - Math.abs(lat)) / Math.sin(Math.PI / 6);
    expect(dist).toBeGreaterThan(9);
    expect(dist).toBeLessThan(12);
    for (const size of [0, -600]) {
      const quiet = buildSizers(TRACK, true);
      const qb = quiet.group.children.find((c) => c.name === SIZER_MESH_BLOCKS) as THREE.InstancedMesh;
      const before = [...info.blockGate.keys()].map((i) => blockCorners(qb, i));
      for (let k = 0; k < 120; k++) quiet.observe!([kart(seg, lat, 20, (Math.PI / 6) * -g.side, size), kart(g.seg0 + 30, 0, 0, 0, size)], 1 / 60, fx);
      for (let i = 0; i < before.length; i++) {
        const c = blockCorners(qb, i);
        for (let k = 0; k < 8; k++) expect(c[k].distanceTo(before[i][k])).toBeLessThan(1e-6);
      }
      quiet.dispose();
    }
    const big = kart(seg, lat, 20, (Math.PI / 6) * -g.side, 30000);
    for (let k = 0; k < 36; k++) view.observe!([big], 1 / 60, fx);
    for (const i of passage) {
      const c = blockCenter(blocks, i);
      expect(c.distanceTo(center0(i)), `Klotz ${i} nach 0,6 s`).toBeGreaterThan(1.5);
      expect(Number.isFinite(c.x + c.y + c.z)).toBe(true);
    }
    for (let k = 0; k < 360; k++) view.observe!([], 1 / 60, fx);
    expect(atRest(0.02)).toBe(true);
    view.dispose();
  });

  it('(f) fährt die Kamera einem winzigen Kart durchs Mauseloch nach, verschwindet der Sturz darüber – sonst nie', () => {
    const { view, info, mesh } = build(true);
    const t = TRACK;
    const g = info.gates.find((q) => q.only < 0)!;
    const lintel = mesh(SIZER_MESH_LINTEL);
    expect(lintel).toBeTruthy();
    const br = t.branches[g.k];
    // Kart auf der Abzweigung 34 m hinter der Gabelung (überquert gerade die Bandenlinie), Kamera 5 m dahinter, 2 m hoch
    const seg = br.first + 34;
    const cs = br.first + 29;
    const cam = new THREE.Vector3(t.px[cs], t.py[cs] + 2, t.pz[cs]);
    for (const [size, shown] of [[0, true], [-600, false], [600, true]] as const) {
      const e = kart(seg, 0, 15, 0, size);
      for (let k = 0; k < 10; k++) {
        view.update(k, k / 60, 1 / 60, cam, fx);
        view.observe!([e], 1 / 60, fx);
      }
      expect(lintel.visible, `Größe ${size}`).toBe(shown);
      // danach (Kart weg) wieder da
      for (let k = 0; k < 60; k++) {
        view.update(k, k / 60, 1 / 60, cam, fx);
        view.observe!([], 1 / 60, fx);
      }
      expect(lintel.visible).toBe(true);
    }
    view.dispose();
  });

  it('(e) endlich, ohne eigenen Shader, ohne Textur, ohne Licht, in den Grenzen', () => {
    // Nur Code, keine Kommentare
    const code = readFileSync(join(import.meta.dirname, '../../src/render/mechanics/sizers.ts'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n');
    expect(code).not.toMatch(/ShaderMaterial|onBeforeCompile|Texture\b|CanvasTexture|DataTexture|Light\b|\bmap\s*:|RenderTarget/);
    for (const detail of [true, false]) {
      const { view } = build(detail);
      for (const seconds of [0, 3.3, 77.7]) view.update(seconds * 60, seconds, 1 / 60, new THREE.Vector3(), fx);
      let calls = 0;
      let tris = 0;
      view.group.traverse((o) => {
        if (o instanceof THREE.Light) throw new Error('Lichtquelle');
        if (!(o instanceof THREE.Mesh)) return;
        calls++;
        const g = o.geometry;
        const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        tris += n * (o instanceof THREE.InstancedMesh ? o.count : 1);
        const m = o.material as THREE.Material & { map?: THREE.Texture | null };
        expect(m.map ?? null).toBeNull();
        expect(m.onBeforeCompile.toString()).toBe(new THREE.Material().onBeforeCompile.toString());
        if (m instanceof THREE.ShaderMaterial) expect(o.name).toBe('outline');
        const pos = g.getAttribute('position');
        for (let i = 0; i < pos.count; i++) expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true);
        if (o instanceof THREE.InstancedMesh) {
          const mm = new THREE.Matrix4();
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, mm);
            expect(mm.elements.every(Number.isFinite)).toBe(true);
          }
        }
      });
      console.log(`Größenringe/-tore ${detail ? 'mit' : 'ohne'} detail: ${calls} Zeichenaufrufe, ${tris} Dreiecke`);
      expect(calls).toBeLessThanOrEqual(detail ? 9 : 6);
      expect(tris).toBeLessThanOrEqual(detail ? 9000 : 4500);
      view.dispose();
    }
  });
});

// Bild der Pontons und des Winds im Sturmhafen (render/mechanics/harbor.ts).
//
// Die Pontons sind die Fahrbahn selbst: ihre Deckfläche ist ein Netz, dessen Ecken je Bild in der
// Höhe neu gesetzt werden. Geprüft wird, was ein Fehler dabei sichtbar machen würde:
//   (a) Ein Strahl von oben trifft die Deckfläche überall genau dort, wo die Physik den Boden hat
//       (groundNow – damit fährt das Kart), auf 2 cm: Mitte und Ränder, auf den Pontons und auf den
//       Übergängen, auf beiden Wegen, zu vielen Rennzeiten.
//   (b) An beiden Enden jeder schwimmenden Strecke beginnt die Deckfläche genau an der Kante der
//       festen Fahrbahn (world.ts endet eine halbe Abschnittslänge vor dem ersten schwimmenden
//       Abschnitt) und liegt dort auf der Höhe der Physik; entlang der Strecke gibt es keine Lücke.
//   (c) Keine Ecke, keine Instanz liegt im Unendlichen.
//   (d) Kein eigener Shader, keine Textur.
// Über das Aussehen auf einem echten Gerät sagt der Test nichts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EDGE_FLOAT, EDGE_FREE_L, EDGE_FREE_R, NO_GROUND, getTrack, groundNow, projectOnTrack, rightX, rightZ, type Track } from '../../src/game/track';
import type { FxSink } from '../../src/render/fxApi';
import { buildHarbor } from '../../src/render/mechanics/harbor';

const fx: FxSink = { spark() {}, puff() {} };

/**
 * Freie Seite (EDGE_FREE_*): Abzweigung und Hauptstrecke liegen ineinander, die Physik ordnet Punkte
 * dort teils der festen Nachbarfahrbahn zu, die world.ts zeichnet. Das Deck endet davor; geprüft wird
 * dort nichts. (Auf der Pontonkette betrifft das die letzten Meter vor der Einmündung.)
 */
function free(t: Track, seg: number, lat: number): boolean {
  return (t.edge[seg] & (lat < 0 ? EDGE_FREE_L : EDGE_FREE_R)) !== 0;
}
const HAFEN = 8;

/** Schwimmende Strecken: fester Abschnitt davor, die schwimmenden, fester danach. */
function floatRuns(t: Track): number[][] {
  const runs: number[][] = [];
  for (let i = 0; i < t.total; i++) {
    if (!(t.edge[i] & EDGE_FLOAT) || t.edge[t.prev[i]] & EDGE_FLOAT) continue;
    const r = [t.prev[i]];
    let s = i;
    while (t.edge[s] & EDGE_FLOAT) {
      r.push(s);
      s = t.next[s];
    }
    r.push(s);
    runs.push(r);
  }
  return runs;
}

function deckOf(group: THREE.Group): THREE.Mesh {
  const found = group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === 'deck');
  expect(found.length).toBe(1);
  const m = found[0];
  expect((m.geometry.getAttribute('position') as THREE.BufferAttribute).usage).toBe(THREE.DynamicDrawUsage);
  return m;
}

const ray = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);
const hits: THREE.Intersection[] = [];
/** Höhe der obersten Deckfläche über (x, z) – oder null, wenn dort keine ist. */
function deckHeight(deck: THREE.Mesh, x: number, z: number, from: number): number | null {
  ray.set(new THREE.Vector3(x, from, z), down);
  hits.length = 0;
  deck.raycast(ray, hits);
  if (hits.length === 0) return null;
  let best = -Infinity;
  for (const h of hits) best = Math.max(best, h.point.y);
  return best;
}

/** Rennzeiten (Ticks): Countdown, Start, krumme Werte, lange Rennen. */
const TIMES = [-150, 0, 23.5, 61, 102.25, 170, 4321.5, 60 * 3600 + 13];

describe('Sturmhafen: Bild der Pontons', () => {
  const t = getTrack(HAFEN);
  const runs = floatRuns(t);

  it('es gibt schwimmende Strecken auf beiden Wegen', () => {
    expect(runs.length).toBeGreaterThanOrEqual(2);
    expect(runs.some((r) => t.branchOf[r[1]] < 0)).toBe(true);
    expect(runs.some((r) => t.branchOf[r[1]] >= 0)).toBe(true);
  });

  it.each([
    [true, TIMES],
    [false, TIMES.slice(1, 5)],
  ])('(a) die Deckfläche liegt überall auf der Höhe der Physik (groundNow) – auf 2 cm (Zierde: %s)', (detail, times) => {
    const view = buildHarbor(t, detail);
    const deck = deckOf(view.group);
    let checked = 0;
    let worst = 0;
    for (const time of times) {
      for (const r of runs) {
        const cam = new THREE.Vector3(t.px[r[r.length >> 1]], t.py[r[r.length >> 1]] + 3, t.pz[r[r.length >> 1]]);
        view.update(time, time / 60, 1 / 60, cam, fx);
        deck.geometry.computeBoundingSphere();
        deck.updateMatrixWorld();
        for (let k = 1; k + 1 < r.length; k++) {
          const s = r[k];
          // (genau auf einer Kante zwischen zwei Dreiecken verfehlt ein Strahl beide: knapp daneben messen)
          for (const along of [-0.45, -0.15, 0.004, 0.3, 0.45]) {
            for (const q of [-0.97, -0.5, 0.003, 0.55, 0.97]) {
              const lat0 = q * t.wh[s];
              const x = t.px[s] + t.tx[s] * along * t.step + rightX(t, s) * lat0;
              const z = t.pz[s] + t.tz[s] * along * t.step + rightZ(t, s) * lat0;
              // So ordnet die Physik den Punkt zu – genau damit rechnet sie die Höhe des Karts.
              const p = projectOnTrack(t, x, z, s);
              if (!(t.edge[p.seg] & EDGE_FLOAT) || Math.abs(p.lat) > t.wh[p.seg] - 0.03) continue;
              // An der Einmündung liegt auf der freien Seite die Nachbarfahrbahn (world.ts) – siehe free().
              if (free(t, p.seg, p.lat)) continue;
              const g = groundNow(t, p.seg, p.along, p.lat, time);
              expect(g).not.toBe(NO_GROUND);
              const y = deckHeight(deck, x, z, g + 30);
              if (y === null) throw new Error(`keine Deckfläche bei Abschnitt ${s} (${along}, ${lat0.toFixed(2)}) zur Zeit ${time}`);
              const d = Math.abs(y - g);
              worst = Math.max(worst, d);
              if (d > 0.02) throw new Error(`Deck ${y.toFixed(3)} statt ${g.toFixed(3)} bei Abschnitt ${s} (${along}, ${lat0.toFixed(2)}) zur Zeit ${time}`);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(times.length * 1000);
    expect(worst).toBeLessThan(0.02);
    view.dispose();
  });

  it('(b) die Deckfläche schließt an die feste Fahrbahn an und hat keine Lücke', () => {
    const view = buildHarbor(t, false);
    const deck = deckOf(view.group);
    const pos = deck.geometry.getAttribute('position');
    // Punkt der festen Fahrbahn (world.ts): Abschnitt i, Anteil f zum nächsten, seitlich lat
    const P = (i: number, f: number, lat: number): [number, number, number] => {
      const j = t.next[i];
      const a = [t.px[i] + rightX(t, i) * lat, t.py[i] + lat * t.bank[i], t.pz[i] + rightZ(t, i) * lat];
      const b = [t.px[j] + rightX(t, j) * lat, t.py[j] + lat * t.bank[j], t.pz[j] + rightZ(t, j) * lat];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    };
    /**
     * Ecke des Decks auf der Linie von p nach o (Naht), nächst an p – mit ihrem Abstand zu p und ihrer
     * Höhe (bei gleichem Ort die höchste).
     */
    const onLine = (p: number[], o: number[]): { d: number; y: number } => {
      const lx = o[0] - p[0];
      const lz = o[2] - p[2];
      const ll = Math.hypot(lx, lz);
      let d = Infinity;
      let y = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const dx = pos.getX(i) - p[0];
        const dz = pos.getZ(i) - p[2];
        if (Math.abs(dx * lz - dz * lx) / ll > 0.002) continue;
        const e = Math.hypot(dx, dz);
        if (e < d - 1e-6) {
          d = e;
          y = pos.getY(i);
        } else if (e < d + 1e-6) y = Math.max(y, pos.getY(i));
      }
      return { d, y };
    };
    let sliverMax = 0;
    for (const time of [0, 41, 97.5, 150, 1234]) {
      for (const r of runs) {
        const cam = new THREE.Vector3(t.px[r[1]], t.py[r[1]] + 3, t.pz[r[1]]);
        view.update(time, time / 60, 1 / 60, cam, fx);
        deck.geometry.computeBoundingSphere();
        // Nähte: zwischen festem und erstem schwimmenden Abschnitt (und am Ende umgekehrt), auf halbem Weg
        const seams: [number, number, number][] = [
          [r[0], r[1], 1],
          [r[r.length - 2], r[r.length - 1], -1],
        ];
        for (const [i, j, dir] of seams) {
          const floatSeg = dir > 0 ? j : i;
          const wh = t.wh[t.edge[i] & EDGE_FLOAT ? i : j];
          for (const q of [-1, -0.5, 0, 0.5, 1]) {
            const lat = q * wh;
            if (q !== 0 && free(t, floatSeg, lat)) continue;
            const fixed = P(i, 0.5, lat);
            // Die Deckfläche hat an der Naht Ecken genau auf der Kante der festen Fahrbahn (höchstens so
            // weit darüber hinaus, wie sich die Breite zum nächsten Abschnitt ändert) …
            if (q === -1 || q === 1) {
              const o = P(i, 0.5, -lat);
              const c = onLine(fixed, o);
              expect(c.d).toBeLessThanOrEqual(Math.abs(t.wh[i] - t.wh[j]) + 0.002);
              // Höhe an der Naht gegenüber der festen Fahrbahn (sie steht, world.ts mittelt die
              // Querneigung): es bleibt, was die Physik selbst dort hat – der halbe Seegang des ersten
              // schwimmenden Abschnitts (so legt track.ts die Gewichte, ≈ 1/12 des Ausschlags) und die
              // halbe Stufe der Querneigung zum Nachbarabschnitt (dazu 1 cm für den Versatz der Querlinie). Ein Absatz von wenigen Zentimetern,
              // den die Stirnfläche des Decks verdeckt.
              const a = t.floatA[floatSeg];
              const step = 0.5 * t.floatWA[floatSeg] * Math.abs(t.pontoons[a].amp) + 0.5 * Math.abs(lat * (t.bank[j] - t.bank[i])) + 0.01;
              if (Math.abs(c.y - fixed[1]) >= step) throw new Error(`Naht ${i}/${j} seitlich ${lat.toFixed(2)}: Deck ${c.y.toFixed(3)}, feste Fahrbahn ${fixed[1].toFixed(3)}, erlaubt ${step.toFixed(3)} (Zeit ${time})`);
              expect(step).toBeLessThan(0.06);
            }
            // … und liegt dort auf der Höhe der Physik.
            // Genau auf der Naht hat auch die Physik eine Stufe (fester gegen schwimmenden Abschnitt), und
            // world.ts endet auf der geradlinig gemittelten Querlinie, nicht ganz auf der Mittelsenkrechten,
            // an der die Physik den Abschnitt wechselt (in Kurven am Rand ein paar Zentimeter daneben; in
            // diesem Streifen hat die Physik noch den festen Abschnitt): jenseits davon vergleichen.
            const cx = t.px[j] - t.px[i];
            const cz = t.pz[j] - t.pz[i];
            const cl = Math.hypot(cx, cz);
            const sliver = Math.abs(((fixed[0] - (t.px[i] + t.px[j]) / 2) * cx + (fixed[2] - (t.pz[i] + t.pz[j]) / 2) * cz) / cl);
            sliverMax = Math.max(sliverMax, sliver);
            const inside = P(i, 0.5 + dir * (sliver + 0.03), lat * 0.998);
            const p = projectOnTrack(t, inside[0], inside[2], floatSeg);
            const g = groundNow(t, p.seg, p.along, p.lat, time);
            const y = deckHeight(deck, inside[0], inside[2], g + 30);
            expect(y).not.toBeNull();
            if (Math.abs(y! - g) > 0.02) throw new Error(`Naht: Deck ${y!.toFixed(3)} statt ${g.toFixed(3)} bei ${i}/${j}, seitlich ${lat.toFixed(2)}, Zeit ${time}`);
          }
        }
        // Keine Lücke: dicht entlang der Mitte und beider Ränder von Naht zu Naht
        for (let k = 0; k + 1 < r.length; k++) {
          for (let f = 0.013; f < 1; f += 0.125) {
            if ((k === 0 && f < 0.52) || (k === r.length - 2 && f > 0.48)) continue;
            for (const q of [-0.98, 0.004, 0.98]) {
              const sg = r[Math.max(1, Math.min(r.length - 2, k + (f > 0.5 ? 1 : 0)))];
              const w = t.wh[sg];
              if (free(t, sg, q) || free(t, r[k], q) || free(t, r[k + 1], q)) continue;
              const p = P(r[k], f, q * w);
              if (deckHeight(deck, p[0], p[2], p[1] + 30) === null) throw new Error(`Lücke im Deck bei Abschnitt ${r[k]} + ${f}, seitlich ${q} zur Zeit ${time}`);
            }
          }
        }
      }
    }
    // So breit ist der Streifen zwischen dem Ende der festen Fahrbahn und dem Wechsel der Physik höchstens.
    expect(sliverMax).toBeLessThan(0.15);
    view.dispose();
  });

  it('(c) keine Ecke, keine Instanz im Unendlichen – mit und ohne Zierde, zu jeder Zeit', () => {
    for (const detail of [true, false]) {
      const view = buildHarbor(t, detail);
      const cams = [...runs.map((r) => r[r.length >> 1]), ...t.winds.map((w) => w.first + (w.count >> 1))].map((s) => new THREE.Vector3(t.px[s], t.py[s] + 3, t.pz[s]));
      const m = new THREE.Matrix4();
      const v = new THREE.Vector3();
      let meshes = 0;
      for (const time of [...TIMES, 33, 200, 300, 333, 410, 455]) {
        for (const cam of cams) view.update(time, time / 60, 1 / 60, cam, fx);
        view.group.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          meshes++;
          const pos = o.geometry.getAttribute('position');
          const arr = pos.array;
          for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) throw new Error(`${o.name}: Ecke ${Math.floor(i / 3)} nicht endlich zur Zeit ${time}`);
          for (const a of ['normal', 'onormal']) {
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
          expect(o.geometry.boundingSphere === null || Number.isFinite(o.geometry.boundingSphere.radius)).toBe(true);
        });
      }
      expect(meshes).toBeGreaterThan(5);
      view.dispose();
    }
  });

  it('(d) kommt ohne eigenen Shader und ohne Textur aus', () => {
    const view = buildHarbor(t, true);
    view.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const m = o.material as THREE.Material & { map?: THREE.Texture | null };
      expect(m.map ?? null).toBeNull();
      expect(m.onBeforeCompile.toString()).toBe(new THREE.Material().onBeforeCompile.toString());
      // Erlaubt: Flächen mit Eckenfarbe, Toon-Körper (mit der gemeinsamen Schattierungsstufe) und die gemeinsame Kontur.
      if (m instanceof THREE.ShaderMaterial) expect(o.name).toBe('outline');
    });
    view.dispose();
    // Auch im Quelltext: kein Shader, kein onBeforeCompile, keine Textur
    const src = readFileSync(join(import.meta.dirname, '../../src/render/mechanics/harbor.ts'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n');
    expect(src).not.toMatch(/ShaderMaterial|onBeforeCompile|Texture|\bmap\s*:|gl_Position|textTexture/);
  });
});

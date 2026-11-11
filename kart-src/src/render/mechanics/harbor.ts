// Sturmhafen: Darstellung der Pontons (samt Übergängen) und des Winds.
//
// Pontons – sie SIND die Fahrbahn. Wo track.edge[seg] & EDGE_FLOAT gesetzt ist, zeichnet die
// stehende Welt nichts (world.ts endet dort eine halbe Abschnittslänge vor dem ersten
// schwimmenden Abschnitt wie an einer Lücke). Alles dazwischen entsteht hier, als Netz, dessen
// Ecken je Bild in der Höhe neu gesetzt werden:
//   * Jede Ecke liegt in "Streckenkoordinaten" (u, lat, dy): u zählt die Abschnitte einer
//     schwimmenden Strecke (ganzzahlig = Mitte eines Abschnitts), lat seitlich, dy über der
//     Fahrbahn in Ruhelage. Daraus wird einmal der Ort in der Welt gerechnet (wie world.ts: die
//     Abschnittsmitten linear verbunden) und je Bild die Höhe: Ruhelage + Seegang, und zwar
//     genau so wie die Physik (heaveAt an den Abschnittsmitten, dazwischen linear). Wo die
//     geradlinige Verbindung von der Physik abweicht (enge Kurven, schnell wechselnde Querneigung,
//     die Nähte), wird jede Hälfte zwischen zwei Abschnitten als Ebene genau wie groundAt gerechnet
//     (locate, mode 1–3); ebene, gerade Stücke werden zusammengefasst. Geprüft in
//     tests/unit/hafenbild.test.ts: überall auf 2 cm gleich groundNow.
//   * Die Schwimmkörper unter einem Ponton heben sich starr mit dem Ponton (pontoonLift).
//   * Deck: Rostfelder hell/dunkel, gelbe Randstreifen (Seitenstreifen rh…wh), an den gelenkigen
//     Übergängen Riffelblech mit gelb-schwarzer Schraffur an jedem Knick.
//   * Kante: offen (Pontonkette) → Scheuerleiste und Poller; sonst ein Geländer (≈ 0,9 m).
//   * Unter Wasser reichende Schwimmkörper, Fender, Gelenke, Dalben an den Übergängen.
//
// Wind – lesbar aus 60–80 m:
//   * Windsäcke an Masten auf der Windseite (Anfang jedes Böenbereichs, dann etwa alle 40 m;
//     auf schwimmenden Stücken auf einem Ausleger, der den Seegang mitmacht).
//     Flaute: schlaff, Lampe aus. Vorwarnung: hebt sich, Lampe blinkt gelb, immer schneller.
//     Böe: steht waagrecht in Windrichtung über der Bahn und flattert, Lampe rot.
//   * Böenschleier: helle, flache Streifen ziehen während der Böe quer über die Bahn – nicht im
//     Windschatten.
//   * Windschatten: je Eintrag in wind.lee eine Reihe hoher Containerstapel auf der Windseite
//     und eine gestrichelte Bodenlinie am Rand des ruhigen Streifens.
//
// Zeichentechnik (harte Vorgabe, siehe tests/unit/shaderregeln.test.ts): nur eingebaute
// Materialien, keine Texturen. Netze aus MeshBuilder, Ecken je Bild neu gesetzt
// (DynamicDrawUsage), Toon-Material mit Kontur, eine InstancedMesh für die Lampen, Teilchen über fx.
//
// Zeichenaufrufe mit detail: Deck 1, Pontonbau 1 + Kontur 1, Pontonkanten (ohne Kontur) 1,
// Feststehendes 1 + Kontur 1, Windsäcke 1 + Kontur 1, Lampen 1, Schleier 1 = 10. Ohne detail: 7.
// Dreiecke (Konturen eingerechnet, Sturmhafen): mit detail ≈ 13 960, ohne ≈ 7 440 (group.userData.triangles).

import * as THREE from 'three';
import { gustStrength, gustWarning, pontoonLift, type Wind } from '../../game/mechanics';
import { EDGE_DECK, EDGE_FLOAT, EDGE_FREE_L, EDGE_FREE_R, EDGE_OPEN_L, EDGE_OPEN_R, heaveAt, rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, smooth, type RGB, type V3 } from '../build';
import type { MechanicView } from '../mechanics';
import { rgb, toonMaterial, withOutline } from '../toon';
import { boxT, cylT, face, stripedFace, type Xform } from './machineKit';

// --- Farben ---------------------------------------------------------------------

const C_GRATE_A = rgb(0x7f8893);
const C_GRATE_B = rgb(0x5a616c);
const C_GRATE_C = rgb(0x6c7480);
const C_RIFF_A = rgb(0xa4abb5);
const C_RIFF_B = rgb(0x8d949f);
const C_YEL = rgb(0xf2c230);
const C_INK = rgb(0x1c1b22);
const C_STEEL = rgb(0x4a515b);
const C_STEEL_D = rgb(0x33383f);
const C_HULL = rgb(0x56606b);
const C_HULL_RED = rgb(0x9a3b2c);
const C_FENDER = rgb(0x24252a);
const C_RAIL = rgb(0xf2c230);
const C_POST = rgb(0x2a2e35);
const C_PILE = rgb(0x5b4a3a);
const C_MAST = rgb(0xd9dde2);
const C_MAST_D = rgb(0x3a3f47);
const C_SOCK_A = rgb(0xff5a1f);
const C_SOCK_B = rgb(0xf6f3ea);
const C_LEE = rgb(0xa9e3dc);
const CONTAINER: RGB[] = [rgb(0xc8402f), rgb(0x2f6fb3), rgb(0x2f9e8f), rgb(0xe0892b), rgb(0x6f8a2f), rgb(0xd8d2c4), rgb(0x8a3d7a)];

// --- Maße -----------------------------------------------------------------------

/** Wasserspiegel (Thema hafen: liquidY). */
const WATER = -3.2;
/** Unterkante der Deckplatte unter der Fahrbahn. */
const DECK_T = 0.45;
/** Geländer: Höhe des Handlaufs (Oberkante) und Abstand der Pfosten in Abschnitten. */
const RAIL_H = 0.95;
const POST_EVERY = 4;
/** Mast: Höhe des Windsacks über der Fahrbahn, Länge und Öffnung des Sacks. */
const MAST_H = 5.6;
const SOCK_L = 3.0;
const SOCK_R0 = 0.55;
const SOCK_R1 = 0.22;
/** Ringe des Windsacks (Bänder = SOCK_RINGS − 1) und Ecken je Ring. */
const SOCK_RINGS = 5;
const SOCK_SIDES = 5;
/** Abstand der Windsäcke (Meter). */
const SOCK_EVERY = 40;
/** Böenschleier: ein Streifen je so vielen Metern Böenbereich. */
const VEIL_EVERY = 2.6;

/** Gelber Seitenstreifen: rh … wh, wenn das sinnvoll breit ist, sonst so breit. */
const STRIPE = 0.45;

// ---------------------------------------------------------------------------------

/** Eine zusammenhängende schwimmende Strecke: Knoten = fester Abschnitt davor, die schwimmenden, fester danach. */
interface Run {
  /** u des ersten Knotens (fester Abschnitt davor). */
  base: number;
  /** Abschnitte der Knoten base … base + segs.length − 1. */
  segs: number[];
}

export function buildHarbor(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  group.name = 'Hafen';
  const disposables: { dispose(): void }[] = [];
  let tris = 0;

  // ============================ Schwimmende Strecken ============================

  const runs: Run[] = [];
  /** Abschnitt je ganzzahligem u (−1 = Lücke zwischen zwei Strecken). */
  const nodeSeg: number[] = [];
  /** u eines schwimmenden Abschnitts (NaN = schwimmt nicht). */
  const uOf = new Float64Array(t.total).fill(NaN);
  for (let i = 0; i < t.total; i++) {
    if (!(t.edge[i] & EDGE_FLOAT) || t.edge[t.prev[i]] & EDGE_FLOAT) continue;
    const segs = [t.prev[i]];
    let s = i;
    while (t.edge[s] & EDGE_FLOAT && segs.length < 4000) {
      segs.push(s);
      s = t.next[s];
    }
    segs.push(s);
    const base = nodeSeg.length;
    segs.forEach((g, k) => {
      nodeSeg.push(g);
      if (k > 0 && k < segs.length - 1) uOf[g] = base + k;
    });
    nodeSeg.push(-1);
    runs.push({ base, segs });
  }
  const U = nodeSeg.length;
  /** Zu welcher Strecke ein ganzzahliges u gehört. */
  const runOf = new Int16Array(U).fill(-1);
  runs.forEach((r, ri) => {
    for (let k = 0; k < r.segs.length; k++) runOf[r.base + k] = ri;
  });

  /**
   * Quellen des Seegangs je Bild: [0] = 0 (steht), 1 … U = Knoten (heaveAt an der Abschnittsmitte),
   * U + 1 … = Pontons (pontoonLift, starr).
   */
  const SRC_NODE = 1;
  const SRC_PONTOON = 1 + U;
  const H = new Float64Array(1 + U + t.pontoons.length);

  /**
   * (u, lat, dy) → Ort in der Welt bei Seegang 0; dazu Quellen und Anteil für die Höhe.
   * mode 0: wie world.ts – die Abschnittsmitten geradlinig verbunden (Ort, Höhe, Querneigung).
   * mode 1 / 2: genau wie die Physik (groundAt/heaveAt) in der ersten bzw. zweiten Hälfte des Stücks
   * zwischen zwei Knoten: dort gilt der nähere Abschnitt – sein Rahmen (seitlich gemessen an seiner
   * Querrichtung, längs an seiner Fahrtrichtung) und seine Querneigung. In jeder Hälfte ist das eine
   * Ebene; die Grenze ist die Mittellinie zwischen den beiden Abschnitten (dort endet auch world.ts).
   */
  const at = { x: 0, y: 0, z: 0, a: 0, b: 0, f: 0 };
  function locate(u: number, lat: number, dy: number, mode: number): typeof at {
    let k = mode === 2 ? Math.ceil(u - 1e-6) - 1 : mode === 1 ? Math.floor(u + 1e-6) : Math.floor(u);
    let ri = runOf[Math.max(0, Math.min(U - 1, k))];
    if (ri < 0) ri = runOf[Math.max(0, k - 1)];
    const r = runs[ri];
    k = Math.max(r.base, Math.min(r.base + r.segs.length - 2, k));
    const f = u - k;
    const A = nodeSeg[k];
    const B = nodeSeg[k + 1];
    const xa = t.px[A] + rightX(t, A) * lat;
    const za = t.pz[A] + rightZ(t, A) * lat;
    const ya = t.py[A] + lat * t.bank[A];
    const xb = t.px[B] + rightX(t, B) * lat;
    const zb = t.pz[B] + rightZ(t, B) * lat;
    const yb = t.py[B] + lat * t.bank[B];
    if (mode === 0) {
      at.x = xa + (xb - xa) * f;
      at.y = ya + (yb - ya) * f + dy;
      at.z = za + (zb - za) * f;
      at.a = SRC_NODE + k;
      at.b = SRC_NODE + k + 1;
      at.f = f;
      return at;
    }
    // Grenze bei f = 0.5: die Mittelsenkrechte zwischen den beiden Abschnitten – dort wechselt
    // projectOnTrack den nächsten Abschnitt. An den Nähten endet world.ts dagegen auf der
    // gemittelten Querlinie (L); die beiden Linien kreuzen sich nahe der Mitte. Dort gilt als Grenze
    // die, die weiter zur schwimmenden Seite liegt; den Streifen zwischen L und der Mittelsenkrechten
    // (mode 3) trägt noch der feste Abschnitt.
    const lx = (xa + xb) / 2;
    const lz = (za + zb) / 2;
    const cx = t.px[B] - t.px[A];
    const cz = t.pz[B] - t.pz[A];
    const cl = Math.hypot(cx, cz) || 1;
    const o = ((lx - (t.px[A] + t.px[B]) / 2) * cx + (lz - (t.pz[A] + t.pz[B]) / 2) * cz) / cl;
    const start = k === r.base;
    const end = k === r.base + r.segs.length - 2;
    let mx = lx;
    let mz = lz;
    if (mode !== 3 && !((start && o > 0) || (end && o < 0))) {
      mx -= (o * cx) / cl;
      mz -= (o * cz) / cl;
    }
    let near: number;
    if (mode === 3) {
      near = start ? A : B;
      at.x = mx;
      at.z = mz;
    } else {
      // Dazwischen geradlinig bis zur Querlinie durch den näheren Abschnitt.
      near = mode === 1 ? A : B;
      const ex = mode === 1 ? xa : xb;
      const ez = mode === 1 ? za : zb;
      const g = mode === 1 ? Math.max(0, Math.min(1, 1 - f / 0.5)) : Math.max(0, Math.min(1, (f - 0.5) / 0.5));
      at.x = mx + (ex - mx) * g;
      at.z = mz + (ez - mz) * g;
    }
    const other = near === A ? B : A;
    // Höhe genau wie groundAt + heaveAt für den Abschnitt near
    const dx = at.x - t.px[near];
    const dz = at.z - t.pz[near];
    const along = Math.abs(dx * t.tx[near] + dz * t.tz[near]);
    const latN = dx * -t.tz[near] + dz * t.tx[near];
    const q = Math.min(1, along / t.step);
    at.y = t.py[near] + (t.py[other] - t.py[near]) * q + latN * t.bank[near] + dy;
    at.a = SRC_NODE + (near === A ? k : k + 1);
    at.b = SRC_NODE + (near === A ? k + 1 : k);
    at.f = q;
    return at;
  }
  /**
   * Breiten je Knoten. Die Physik nimmt die Breite des nächsten Abschnitts (Stufen in der Mitte
   * zwischen zwei Abschnitten); das Deck verbindet die Knoten geradlinig. Damit es überall mindestens
   * so breit ist wie die Physik, bekommt jeder Knoten das Größte von sich und seinen Nachbarn.
   * An den Nähten reicht es damit mindestens bis an den Rand der festen Fahrbahn.
   */
  const nodeWidths = (arr: Float64Array): Float64Array => {
    const out = new Float64Array(U);
    for (const r of runs) {
      const n = r.segs.length;
      for (let k = 0; k < n; k++) out[r.base + k] = Math.max(arr[r.segs[Math.max(0, k - 1)]], arr[r.segs[k]], arr[r.segs[Math.min(n - 1, k + 1)]]);
    }
    return out;
  };
  const WH = nodeWidths(t.wh);
  const RH = nodeWidths(t.rh);
  /**
   * Links und rechts getrennt: An Gabelung und Einmündung (EDGE_FREE_*) liegt auf der freien Seite die
   * Nachbarfahrbahn – dort endet das Deck, wo world.ts deren Fahrbahn bzw. Seitenstreifen zeichnet
   * (wie cutRoad/cutSh in world.ts), sonst schwankte es durch die feste Nachbarin hindurch.
   */
  const WL = Float64Array.from(WH);
  const WR = Float64Array.from(WH);
  /** Freie Seite je Knoten: Bit 1 links, 2 rechts. */
  const FREE = new Uint8Array(U);
  for (let u = 0; u < U; u++) {
    const sg = nodeSeg[u];
    if (sg < 0) continue;
    const e = t.edge[sg];
    const k = t.twin[sg];
    for (const sgn of [-1, 1]) {
      if (!(e & (sgn < 0 ? EDGE_FREE_L : EDGE_FREE_R))) continue;
      FREE[u] |= sgn < 0 ? 1 : 2;
      if (k < 0) continue;
      const sep = Math.abs((t.px[sg] - t.px[k]) * rightX(t, k) + (t.pz[sg] - t.pz[k]) * rightZ(t, k));
      const cos = Math.max(0.6, t.tx[sg] * t.tx[k] + t.tz[sg] * t.tz[k]);
      // bis an den Rand der Nachbarfahrbahn (world.ts zeichnet bis hierher deren Fahrbahn)
      const cut = Math.max(0.5, (sep - t.rh[k]) / cos);
      if (sgn < 0) WL[u] = Math.min(WL[u], cut);
      else WR[u] = Math.min(WR[u], cut);
    }
  }
  const sideW = (sgn: number): Float64Array => (sgn < 0 ? WL : WR);
  /** Ist die Seite sgn an der Stelle u frei (Nachbarfahrbahn statt Kante)? */
  const freeAt = (u: number, sgn: number): boolean => (FREE[Math.max(0, Math.min(U - 1, Math.round(u)))] & (sgn < 0 ? 1 : 2)) !== 0;
  /** Breite an einer Stelle u (linear zwischen den Knoten). */
  const widthAt = (u: number, arr: Float64Array): number => {
    const k = Math.floor(u);
    const ri = runOf[Math.max(0, Math.min(U - 1, k))];
    const r = runs[ri < 0 ? runOf[Math.max(0, k - 1)] : ri];
    const kk = Math.max(r.base, Math.min(r.base + r.segs.length - 2, k));
    const f = u - kk;
    return arr[kk] + (arr[kk + 1] - arr[kk]) * f;
  };

  interface Heaving {
    mesh: THREE.Mesh;
    attr: THREE.BufferAttribute;
    baseY: Float32Array;
    srcA: Uint16Array;
    srcB: Uint16Array;
    frac: Float32Array;
    /** Ecken, die sich bewegen (vorn im Puffer). */
    moving: number;
  }

  /**
   * Setzt Netze in Streckenkoordinaten (PB) und ein festes Netz (Weltkoordinaten) zusammen:
   * Streckenkoordinaten → Welt, Drehsinn umgekehrt (die Abbildung spiegelt).
   */
  function compile(parts: PB[], fixed: MeshBuilder | null, material: THREE.Material, slack: number): Heaving {
    const fixedGeo = fixed && !fixed.empty ? fixed.build() : null;
    let count = 0;
    for (const p of parts) count += p.count;
    const moving = count;
    if (fixedGeo) count += fixedGeo.getAttribute('position').count;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const baseY = new Float32Array(moving);
    const srcA = new Uint16Array(moving);
    const srcB = new Uint16Array(moving);
    const frac = new Float32Array(moving);
    let v = 0;
    for (const p of parts) {
      for (let i = 0; i < p.count; i++) {
        // Drehsinn: im Dreieck die zweite und dritte Ecke tauschen
        const r = i % 3;
        const src = r === 1 ? i + 1 : r === 2 ? i - 1 : i;
        const l = locate(p.v[src * 3], p.v[src * 3 + 1], p.v[src * 3 + 2], p.mode[src]);
        pos[v * 3] = l.x;
        pos[v * 3 + 1] = l.y;
        pos[v * 3 + 2] = l.z;
        baseY[v] = l.y;
        const pont = p.pont[src];
        if (pont >= 0) {
          srcA[v] = srcB[v] = SRC_PONTOON + pont;
          frac[v] = 0;
        } else {
          srcA[v] = l.a;
          srcB[v] = l.b;
          frac[v] = l.f;
        }
        col[v * 3] = p.c[src * 3];
        col[v * 3 + 1] = p.c[src * 3 + 1];
        col[v * 3 + 2] = p.c[src * 3 + 2];
        v++;
      }
    }
    if (fixedGeo) {
      const p = fixedGeo.getAttribute('position');
      const c = fixedGeo.getAttribute('color');
      for (let i = 0; i < p.count; i++, v++) {
        pos[v * 3] = p.getX(i);
        pos[v * 3 + 1] = p.getY(i);
        pos[v * 3 + 2] = p.getZ(i);
        col[v * 3] = c.getX(i);
        col[v * 3 + 1] = c.getY(i);
        col[v * 3 + 2] = c.getZ(i);
      }
      fixedGeo.dispose();
    }
    const geo = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(pos, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', attr);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    // Der Seegang hebt und senkt: Hülle um den größten Ausschlag weiter.
    if (geo.boundingSphere) geo.boundingSphere.radius += slack;
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    return { mesh, attr, baseY, srcA, srcB, frac, moving };
  }

  function writeHeave(h: Heaving): void {
    const pos = h.attr.array as Float32Array;
    const { baseY, srcA, srcB, frac } = h;
    for (let i = 0; i < h.moving; i++) {
      const a = H[srcA[i]];
      pos[i * 3 + 1] = baseY[i] + a + (H[srcB[i]] - a) * frac[i];
    }
    h.attr.clearUpdateRanges();
    h.attr.addUpdateRange(0, h.moving * 3);
    h.attr.needsUpdate = true;
  }

  // --- Bausteine in Streckenkoordinaten ------------------------------------------------
  // Xform für boxT/cylT: x = u, y = dy, z = lat → (u, lat, dy).
  const UV: Xform = (x, y, z) => [x, z, y];
  const UP: V3 = [0, 0, 1];

  // Je Knoten: Zusammensetzung des Seegangs (gleich an beiden Enden → das Stück bleibt eben).
  const compKey = (seg: number): string => (t.edge[seg] & EDGE_FLOAT ? `${t.floatA[seg]}:${t.floatWA[seg].toFixed(4)}:${t.floatB[seg]}:${t.floatWB[seg].toFixed(4)}` : 'fest');

  const deckMB = new PB();
  /** Pontonbau mit Kontur (Pfosten, Poller, Masten) und ohne (Kanten, Handläufe, Leisten, Gelenke). */
  const bodyMB = new PB();
  const flatMB = new PB();
  /** Schwimmkörper: starr mit ihrem Ponton (pont je Ecke). */
  const hullMB = new PB();
  /** Feststehendes: Dalben, Masten an Land, Containerstapel. */
  const fixedMB = new MeshBuilder();
  /** Feststehendes, flach auf der Fahrbahn (Windschatten-Linie). */
  const floorMB = new MeshBuilder();

  for (const r of runs) {
    const n = r.segs.length;
    const u0 = r.base + 0.5;
    const u1 = r.base + n - 1.5;
    // Übergänge: Stücke zwischen zwei Knoten verschiedener Zusammensetzung
    const link: boolean[] = [];
    for (let k = 0; k + 1 < n; k++) link.push(compKey(r.segs[k]) !== compKey(r.segs[k + 1]));
    /** Stück k (Knoten k → k+1) ist erstes bzw. letztes eines Übergangs: dort sitzt der Knick. */
    const hatch = (k: number): boolean => link[k] && (k === 0 || !link[k - 1] || k + 1 === link.length || !link[k + 1]);

    // ---- Deck ----
    // Die Physik nimmt den nächsten Abschnitt: seine Querneigung, und "längs" gemessen an seiner
    // Fahrtrichtung. In engen Kurven und wo sich die Querneigung schnell ändert, weicht die
    // geradlinige Verbindung der Abschnittsmitten (world.ts) davon um mehr als ein paar Millimeter
    // ab – dort wird das Stück in zwei Hälften gezeichnet, jede genau als Ebene der Physik (locate,
    // mode 1/2), dazwischen eine senkrechte Stufe. Die halben Stücke an den Nähten immer so.
    /** Größter Hub je Knoten (für die Abschätzung unten): Summe der Ausschläge mal Gewicht. */
    const heaveMax = (sg: number): number[] => {
      const out = t.pontoons.map(() => 0);
      if (t.floatA[sg] >= 0) out[t.floatA[sg]] += t.floatWA[sg];
      if (t.floatB[sg] >= 0) out[t.floatB[sg]] += t.floatWB[sg];
      return out;
    };
    /** Muss das Stück k → k+1 in zwei Hälften genau nach der Physik gezeichnet werden? */
    const needsExact = (k: number): boolean => {
      if (k === 0 || k + 2 === n) return true;
      const sa = r.segs[k];
      const sb = r.segs[k + 1];
      const w = Math.max(WH[r.base + k], WH[r.base + k + 1]);
      // Stufe der Querneigung auf halbem Weg
      const bankErr = Math.abs(t.bank[sb] - t.bank[sa]) * w * 0.5;
      // In Kurven misst die Physik "längs" an der Fahrtrichtung des nächsten Abschnitts: am Rand um
      // etwa curv · w · ½ Schritt versetzt – mal der größten Steigung (Gefälle plus Seegang)
      const ha = heaveMax(sa);
      const hb = heaveMax(sb);
      let dh = 0;
      t.pontoons.forEach((p, i) => (dh += Math.abs(ha[i] - hb[i]) * Math.abs(p.amp)));
      const slope = (Math.abs(t.py[sb] - t.py[sa]) + dh) / t.step;
      const curveErr = Math.max(Math.abs(t.curv[sa]), Math.abs(t.curv[sb])) * w * 0.5 * t.step * slope;
      return bankErr + curveErr > 0.005;
    };
    /** Lassen sich die Stücke k und k+1 zu einem zusammenfassen (eben, gerade, gleiche Farbe)? */
    const straight = (k: number): boolean => {
      if (k + 2 >= n || link[k] || link[k + 1] || needsExact(k) || needsExact(k + 1)) return false;
      const A = r.segs[k];
      const M = r.segs[k + 1];
      const B = r.segs[k + 2];
      const w = Math.max(WH[r.base + k], WH[r.base + k + 1], WH[r.base + k + 2]);
      for (const lat of [-w, w]) {
        const dx = t.px[M] + rightX(t, M) * lat - (t.px[A] + rightX(t, A) * lat + t.px[B] + rightX(t, B) * lat) / 2;
        const dz = t.pz[M] + rightZ(t, M) * lat - (t.pz[A] + rightZ(t, A) * lat + t.pz[B] + rightZ(t, B) * lat) / 2;
        const dy = t.py[M] + lat * t.bank[M] - (t.py[A] + lat * t.bank[A] + t.py[B] + lat * t.bank[B]) / 2;
        if (Math.hypot(dx, dz) > 0.01 || Math.abs(dy) > 0.003) return false;
      }
      // Breiten gleichmäßig (sonst knickt der Rand)
      return Math.abs(WL[r.base + k + 1] * 2 - WL[r.base + k] - WL[r.base + k + 2]) < 0.01 && Math.abs(WR[r.base + k + 1] * 2 - WR[r.base + k] - WR[r.base + k + 2]) < 0.01;
    };
    const ROW = detail ? 2 : 4;
    for (let k = 0; k + 1 < n; k++) {
      const ka = r.base + k;
      const mid = ka + 0.5;
      const exact = needsExact(k);
      // Ebene, gerade Stücke einer Farbreihe zusammenfassen
      if (!exact && !link[k]) {
        let e = k;
        while (e + 1 < n - 1 && Math.floor((r.base + e + 1) / ROW) === Math.floor(ka / ROW) && straight(e)) e++;
        if (e > k) {
          deckRow(k, ka, r.base + e + 1);
          k = e;
          continue;
        }
      }
      if (exact) {
        if (Math.max(u0, ka) < Math.min(u1, mid)) {
          deckMB.mode0 = 1;
          deckRow(k, Math.max(u0, ka), Math.min(u1, mid));
        }
        if (Math.max(u0, mid) < Math.min(u1, ka + 1)) {
          deckMB.mode0 = 2;
          deckRow(k, Math.max(u0, mid), Math.min(u1, ka + 1));
        }
        deckMB.mode0 = 0;
        if (k === 0 || k + 2 === n) {
          // Streifen an der Naht zwischen dem Ende der festen Fahrbahn und der Grenze der Physik
          // (meist null breit; in Kurven am Rand ein paar Zentimeter). Er gehört zum festen Abschnitt.
          const e = 1e-4;
          const uf = k === 0 ? mid : mid; // Kante der festen Fahrbahn
          const ub = k === 0 ? mid + e : mid - e; // Grenze der Physik
          const mf = 3;
          const mb = k === 0 ? 1 : 2;
          const wl = widthAt(mid, WL);
          const wr = widthAt(mid, WR);
          const lats = [-wl, -wl / 2, 0, wr / 2, wr];
          for (let q = 0; q + 1 < lats.length; q++) {
            const P0: V3 = [uf, lats[q], 0];
            const P1: V3 = [uf, lats[q + 1], 0];
            const Q1: V3 = [ub, lats[q + 1], 0];
            const Q0: V3 = [ub, lats[q], 0];
            // Drehsinn in (u, lat, dy) wie face(): nach oben (UP) bei steigendem u und lat
            const flip = k !== 0;
            if (!flip) {
              deckMB.triModes(P0, P1, Q1, mf, mf, mb, C_STEEL_D);
              deckMB.triModes(P0, Q1, Q0, mf, mb, mb, C_STEEL_D);
            } else {
              deckMB.triModes(P0, Q1, P1, mf, mb, mf, C_STEEL_D);
              deckMB.triModes(P0, Q0, Q1, mf, mb, mb, C_STEEL_D);
            }
          }
        }
        if (mid >= u0 && mid <= u1) {
          // Stufe auf halbem Weg: je Seite ein Dreieck, beidseitig (welche Hälfte höher liegt, hängt vom Seegang ab)
          for (const sgn of [-1, 1]) {
            const A: V3 = [mid, sgn * widthAt(mid, sideW(sgn)), 0];
            const C: V3 = [mid, 0, 0];
            deckMB.triModes(A, A, C, 1, 2, 1, C_STEEL_D);
            deckMB.triModes(A, C, A, 1, 1, 2, C_STEEL_D);
          }
        }
      } else deckRow(k, ka, ka + 1);
    }
    function deckRow(k: number, a: number, b: number): void {
      // Kante und Beginn des gelben Randstreifens je Seite, an beiden Enden (a, b) des Stücks
      const edgeOf = (u: number, sgn: number): [number, number] => {
        const w = widthAt(u, sideW(sgn));
        const rr = Math.min(widthAt(u, RH), w - 0.2);
        const st = freeAt(u, sgn) ? w - 0.25 : w - rr > 0.2 && w - rr < 1.2 ? rr : w - STRIPE;
        return [w, st];
      };
      const [waL, stAL] = edgeOf(a, -1);
      const [wbL, stBL] = edgeOf(b, -1);
      const [waR, stAR] = edgeOf(a, 1);
      const [wbR, stBR] = edgeOf(b, 1);
      const quad = (l0a: number, l1a: number, l0b: number, l1b: number, c: RGB, b2 = b, a2 = a): void =>
        face(deckMB, [a2, l0a, 0], [a2, l1a, 0], [b2, l1b, 0], [b2, l0b, 0], UP, c);
      if (link[k] && hatch(k)) {
        // Knick: gelb-schwarze Schraffur über die ganze Breite
        stripedFace(deckMB, [a, -waL, 0], [a, waR, 0], [b, wbR, 0], [b, -wbL, 0], UP, C_YEL, C_INK, 0.9);
        return;
      }
      // Ränder: gelb (zur freien Seite hin ein schmaler dunkler Saum)
      quad(-waL, -stAL, -wbL, -stBL, freeAt(a, -1) ? C_STEEL_D : C_YEL);
      quad(stAR, waR, stBR, wbR, freeAt(a, 1) ? C_STEEL_D : C_YEL);
      const row = Math.floor((r.base + k) / ROW);
      if (link[k]) {
        // Riffelblech: helle Platte, quer in zwei Tönen
        const m = Math.max(a, Math.min(b, r.base + k + 0.5));
        const g = (m - a) / Math.max(1e-6, b - a);
        const smL = stAL + (stBL - stAL) * g;
        const smR = stAR + (stBR - stAR) * g;
        if (m > a + 1e-4) quad(-stAL, stAR, -smL, smR, C_RIFF_A, m, a);
        if (b > m + 1e-4) quad(-smL, smR, -stBL, stBR, C_RIFF_B, b, m);
      } else if (detail) {
        // Rostfelder: zwei Bahnen im Schachbrett zu je 2 m
        quad(-stAL, 0, -stBL, 0, row % 2 === 0 ? C_GRATE_A : C_GRATE_B);
        quad(0, stAR, 0, stBR, row % 2 === 0 ? C_GRATE_B : C_GRATE_C);
      } else quad(-stAL, stAR, -stBL, stBR, row % 2 === 0 ? C_GRATE_A : C_GRATE_B);
    }

    // ---- Kanten der Deckplatte (folgen dem Deck; in ebenen Stücken zusammengefasst) ----
    const stations: number[] = [u0];
    for (let k = 1; k + 1 < n; k++) {
      const u = r.base + k;
      const prev = stations[stations.length - 1];
      // Knoten, an denen sich die Neigung ändert, müssen dabei sein; sonst höchstens alle 3 Abschnitte
      const bend = link[k - 1] || link[k];
      if (bend || u - prev >= 3) stations.push(u);
    }
    if (u1 - stations[stations.length - 1] > 0.05) stations.push(u1);
    else stations[stations.length - 1] = u1;
    for (let q = 0; q + 1 < stations.length; q++) {
      const a = stations[q];
      const b = stations[q + 1];
      for (const sgn of [-1, 1]) {
        const wa = widthAt(a, sideW(sgn));
        const wb = widthAt(b, sideW(sgn));
        face(flatMB, [a, sgn * wa, -DECK_T], [b, sgn * wb, -DECK_T], [b, sgn * wb, 0], [a, sgn * wa, 0], [0, sgn, 0], C_STEEL);
      }
      // Unterseite (sichtbar über dem Wasser zwischen den Schwimmkörpern)
      if (detail) face(flatMB, [a, -widthAt(a, WL), -DECK_T], [a, widthAt(a, WR), -DECK_T], [b, widthAt(b, WR), -DECK_T], [b, -widthAt(b, WL), -DECK_T], [0, 0, -1], C_STEEL_D);
    }
    // Stirnflächen an den Nahtstellen zur festen Fahrbahn
    for (const [u, dir] of [
      [u0, -1],
      [u1, 1],
    ] as const) {
      const wl = widthAt(u, WL);
      const wr = widthAt(u, WR);
      face(flatMB, [u, -wl, -DECK_T - 0.3], [u, wr, -DECK_T - 0.3], [u, wr, 0], [u, -wl, 0], [dir, 0, 0], C_STEEL_D);
    }

    // ---- Kante: Geländer oder Scheuerleiste und Poller ----
    for (const sgn of [-1, 1]) {
      const openBit = sgn < 0 ? EDGE_OPEN_L : EDGE_OPEN_R;
      // Stücke gleicher Art (offen / mit Geländer) zwischen Pfostenstationen
      let q = 0;
      const posts: number[] = [];
      const every = detail ? POST_EVERY : POST_EVERY + 2;
      for (let k = 1; k + 1 < n; k++) if ((k - 1) % every === 0) posts.push(r.base + k);
      if (posts[0] - u0 > 0.6) posts.unshift(u0 + 0.15);
      if (u1 - posts[posts.length - 1] > 0.6) posts.push(u1 - 0.15);
      for (q = 0; q + 1 < posts.length; q++) {
        const a = posts[q];
        const b = posts[q + 1];
        const segMid = nodeSeg[Math.round((a + b) / 2)];
        const open = (t.edge[segMid] & openBit) !== 0;
        // Zur Nachbarfahrbahn hin (frei): weder Geländer noch Leiste
        if (freeAt(a, sgn) || freeAt(b, sgn) || freeAt((a + b) / 2, sgn)) continue;
        const la = sgn * (widthAt(a, sideW(sgn)) + 0.1);
        const lb = sgn * (widthAt(b, sideW(sgn)) + 0.1);
        const out: V3 = [0, sgn, 0];
        if (open) {
          // Scheuerleiste: niedriger dunkler Balken mit gelber Oberkante
          face(flatMB, [a, la - sgn * 0.12, 0], [b, lb - sgn * 0.12, 0], [b, lb - sgn * 0.12, 0.22], [a, la - sgn * 0.12, 0.22], [0, -sgn, 0], C_FENDER);
          face(flatMB, [a, la - sgn * 0.12, 0.22], [b, lb - sgn * 0.12, 0.22], [b, lb + sgn * 0.1, 0.22], [a, la + sgn * 0.1, 0.22], UP, C_YEL);
          face(flatMB, [a, la + sgn * 0.1, -DECK_T], [b, lb + sgn * 0.1, -DECK_T], [b, lb + sgn * 0.1, 0.22], [a, la + sgn * 0.1, 0.22], out, C_FENDER);
          // Poller alle 3 Pfostenstationen
          if (q % 3 === 0) {
            const lp = la - sgn * 0.45;
            boxT(bodyMB, UV, a - 0.24, a + 0.24, 0, 0.5, lp - 0.24, lp + 0.24, C_INK, { noBottom: true, top: C_YEL });
          }
        } else {
          // Geländer: Handlauf (gelb), Knieholm, Fußleiste; Pfosten dunkel
          const rail = (y0: number, y1: number, c: RGB, top: boolean): void => {
            face(flatMB, [a, la - sgn * 0.07, y0], [b, lb - sgn * 0.07, y0], [b, lb - sgn * 0.07, y1], [a, la - sgn * 0.07, y1], [0, -sgn, 0], c);
            if (top) face(flatMB, [a, la - sgn * 0.07, y1], [b, lb - sgn * 0.07, y1], [b, lb + sgn * 0.07, y1], [a, la + sgn * 0.07, y1], UP, c);
          };
          rail(RAIL_H - 0.16, RAIL_H, C_RAIL, true);
          if (detail) rail(0.42, 0.52, C_STEEL, false);
          rail(0, 0.18, C_INK, false);
          boxT(bodyMB, UV, a - 0.09, a + 0.09, -0.3, RAIL_H + 0.04, la - sgn * 0.09, la + sgn * 0.09, C_POST, { noBottom: true });
        }
      }
      const lastA = posts[posts.length - 1];
      const segLast = nodeSeg[Math.round(lastA)];
      if (!(t.edge[segLast] & openBit) && !freeAt(lastA, sgn)) {
        const la = sgn * (widthAt(lastA, sideW(sgn)) + 0.1);
        boxT(bodyMB, UV, lastA - 0.09, lastA + 0.09, -0.3, RAIL_H + 0.04, la - sgn * 0.09, la + sgn * 0.09, C_POST, { noBottom: true });
      }
    }

    // ---- Gelenke an den Knicken, Dalben an den Übergängen ----
    for (let k = 0; k < link.length; k++) {
      if (!link[k]) continue;
      const first = k === 0 || !link[k - 1];
      const last = k + 1 === link.length || !link[k + 1];
      if (!first && !last) continue;
      if (detail) {
        // Gelenk am Knick: zwei Lagerböcke an den Seiten
        const u = Math.max(u0, Math.min(u1, r.base + (first ? k : k + 1)));
        for (const sgn of [-1, 1]) {
          if (freeAt(u, sgn)) continue;
          const w = widthAt(u, sideW(sgn));
          boxT(flatMB, UV, u - 0.32, u + 0.32, -0.42, 0.05, sgn * (w + 0.1) - 0.17, sgn * (w + 0.1) + 0.17, C_INK, { noBottom: true, top: C_YEL });
        }
      }
      if (first) {
        // Dalben: zwei Pfähle neben der Mitte des Übergangs (stehen fest im Hafengrund)
        let e = k;
        while (e + 1 < link.length && link[e + 1]) e++;
        const um = Math.max(u0, Math.min(u1, r.base + (k + e + 1) / 2));
        for (const sgn of [-1, 1]) {
          if (freeAt(um, sgn)) continue;
          const w = widthAt(um, sideW(sgn));
          const l = locate(um, sgn * (w + 1.25), 0, 0);
          const top = l.y + 1.9;
          const T: Xform = (x, y, z) => [l.x + x, y, l.z + z];
          cylT(fixedMB, T, 0, 0, 0.42, WATER - 1.5, top, C_PILE, C_YEL, 6, 'top');
          if (detail) cylT(fixedMB, T, 0, 0, 0.48, top - 0.5, top - 0.25, C_INK, undefined, 6);
        }
      }
    }
  }

  // ---- Schwimmkörper je Ponton: starr, reichen ins Wasser ----
  t.pontoons.forEach((p, pi) => {
    const mb = hullMB;
    mb.pont0 = pi;
    const firstU = uOf[p.first];
    const lastU = uOf[p.first + p.count - 1];
    if (!(firstU === firstU) || !(lastU === lastU)) return;
    // Nur der Teil, der ganz zum Ponton gehört (Gewicht 1): die Übergänge sind Bleche, keine Schwimmkörper.
    const a = firstU + 2.5;
    const b = lastU - 2.5;
    if (b - a < 2) return;
    const steps = Math.max(1, Math.ceil((b - a) / 12));
    for (let s = 0; s < steps; s++) {
      const ua = a + ((b - a) * s) / steps;
      const ub = a + ((b - a) * (s + 1)) / steps;
      const wa = Math.min(widthAt(ua, WL), widthAt(ua, WR)) - 0.35;
      const wb = Math.min(widthAt(ub, WL), widthAt(ub, WR)) - 0.35;
      const ya = locate(ua, 0, 0, 0).y;
      const yb = locate(ub, 0, 0, 0).y;
      // Höhen relativ zur Fahrbahn (Ruhelage): Wasserlinie und Kiel
      const wlA = WATER + 0.25 - ya;
      const wlB = WATER + 0.25 - yb;
      const kA = WATER - 1.4 - ya;
      const kB = WATER - 1.4 - yb;
      for (const sgn of [-1, 1]) {
        const out: V3 = [0, sgn, 0];
        face(mb, [ua, sgn * wa, wlA], [ub, sgn * wb, wlB], [ub, sgn * wb, -DECK_T], [ua, sgn * wa, -DECK_T], out, C_HULL);
        face(mb, [ua, sgn * wa, kA], [ub, sgn * wb, kB], [ub, sgn * wb, wlB], [ua, sgn * wa, wlA], out, C_HULL_RED);
      }
      if (s === 0) face(mb, [ua, -wa, kA], [ua, wa, kA], [ua, wa, -DECK_T], [ua, -wa, -DECK_T], [-1, 0, 0], C_HULL);
      if (s === steps - 1) face(mb, [ub, -wb, kB], [ub, wb, kB], [ub, wb, -DECK_T], [ub, -wb, -DECK_T], [1, 0, 0], C_HULL);
      // Fender: schwarze Polster an den Seiten
      if (detail) {
        const um = (ua + ub) / 2;
        const wm = (wa + wb) / 2;
        const ym = (ya + yb) / 2;
        for (const sgn of [-1, 1]) { flatMB.pont0 = pi; boxT(flatMB, UV, um - 0.5, um + 0.5, WATER + 0.6 - ym, -DECK_T - 0.25, sgn * (wm + 0.12) - 0.16, sgn * (wm + 0.12) + 0.16, C_FENDER, { noBottom: true }); flatMB.pont0 = -1; }
      }
    }
  });

  // ============================ Wind ============================

  /** Windseite: von dort kommt der Wind (−1 links, 1 rechts). */
  const windSide = (w: Wind): number => (w.push > 0 ? -1 : 1);
  /** Zeigt ein Abschnitt in die Nähe eines anderen Wegs (fremde Fahrbahn)? */
  const crowded = (x: number, z: number, seg: number): boolean => {
    for (let k = 0; k < t.total; k += 2) {
      if (Math.abs(t.prog[k] - t.prog[seg]) < 30 && t.branchOf[k] === t.branchOf[seg]) continue;
      if (Math.hypot(t.px[k] - x, t.pz[k] - z) < t.wh[k] + 1.2) return true;
    }
    return false;
  };

  // ---- Containerstapel und Windschatten-Linie ----
  let colorPick = 0;
  for (const w of t.winds) {
    const side = windSide(w);
    for (const lee of w.lee) {
      // Stapel auf der Windseite, über genau die Länge des Windschattens
      const len = lee.last - lee.first + 1;
      const boxes = Math.max(1, Math.round(len / 12.2));
      for (let b = 0; b < boxes; b++) {
        const s0 = lee.first + Math.floor((b * len) / boxes);
        const s1 = lee.first + Math.floor(((b + 1) * len) / boxes) - 1;
        const sm = Math.round((s0 + s1) / 2);
        const L = Math.hypot(t.px[s1] - t.px[s0], t.pz[s1] - t.pz[s0]) + t.step * 0.7;
        const wh = Math.max(t.wh[s0], t.wh[sm], t.wh[s1]);
        const lat = side * (wh + 1.3 + 1.22);
        const cx = (t.px[s0] + t.px[s1]) / 2 + rightX(t, sm) * lat;
        const cz = (t.pz[s0] + t.pz[s1]) / 2 + rightZ(t, sm) * lat;
        const fx = t.px[s1] - t.px[s0];
        const fz = t.pz[s1] - t.pz[s0];
        const fl = Math.hypot(fx, fz) || 1;
        const ux = fx / fl;
        const uz = fz / fl;
        const ground = Math.min(t.py[s0], t.py[sm], t.py[s1]) + lat * t.bank[sm] - 0.4;
        // Rahmen des Containers: x längs, z quer (positiv zur Fahrbahn hin), y absolut
        const nx = rightX(t, sm) * -side;
        const nz = rightZ(t, sm) * -side;
        const T: Xform = (x, y, z) => [cx + ux * x + nx * z, y, cz + uz * x + nz * z];
        const tiers = 3 + ((b + lee.first) % 2);
        for (let k = 0; k < tiers; k++) {
          const c = CONTAINER[colorPick++ % CONTAINER.length];
          const y0 = ground + k * 2.6;
          const len2 = k === 3 ? L * 0.5 - 0.2 : L - 0.35;
          const off = k === 3 ? ((b % 2 === 0 ? 1 : -1) * L) / 4 : 0;
          boxT(fixedMB, T, off - len2 / 2, off + len2 / 2, y0, y0 + 2.55, -1.22, 1.22, c, { noBottom: true, top: shadeRgb(c, 0.85) });
          if (detail) {
            // Rippen auf der Seite zur Fahrbahn und dunkle Eckbeschläge oben
            const ribs = 2;
            for (let q = 1; q < ribs; q++) {
              const x = off - len2 / 2 + (q * len2) / ribs;
              face(fixedMB, T(x - 0.12, y0 + 0.15, 1.24), T(x + 0.12, y0 + 0.15, 1.24), T(x + 0.12, y0 + 2.4, 1.24), T(x - 0.12, y0 + 2.4, 1.24), sub3(T(0, 0, 2), T(0, 0, 0)), shadeRgb(c, 0.72));
            }
          }
        }
      }
      // Bodenlinie am Rand des ruhigen Streifens (gestrichelt), auf der Seite zur Böe hin
      const edgeLat = side < 0 ? lee.lat1 : lee.lat0;
      for (let s = lee.first; s < lee.last; s++) {
        if ((s - lee.first) % 3 === 2) continue;
        const n = t.next[s];
        const P = (seg: number, lat: number): V3 => [t.px[seg] + rightX(t, seg) * lat, t.py[seg] + lat * t.bank[seg] + 0.035, t.pz[seg] + rightZ(t, seg) * lat];
        // links → rechts → voraus: von oben gegen den Uhrzeigersinn
        floorMB.quad(P(s, edgeLat - 0.09), P(s, edgeLat + 0.09), P(n, edgeLat + 0.09), P(n, edgeLat - 0.09), C_LEE);
      }
      // Anfang und Ende des ruhigen Streifens: kurze Querstriche
      for (const s of [lee.first, lee.last]) {
        const P = (lat: number, fwd: number): V3 => [t.px[s] + rightX(t, s) * lat + t.tx[s] * fwd, t.py[s] + lat * t.bank[s] + 0.035, t.pz[s] + rightZ(t, s) * lat + t.tz[s] * fwd];
        const l0 = Math.max(lee.lat0, -t.wh[s] + 0.6);
        const l1 = Math.min(lee.lat1, t.wh[s] - 0.6);
        floorMB.quad(P(l0, -0.09), P(l1, -0.09), P(l1, 0.09), P(l0, 0.09), C_LEE);
      }
    }
  }

  // ---- Windsäcke: Lage ----
  interface Sock {
    seg: number;
    side: number;
    wind: Wind;
    /** Lage des Masts seitlich und ob er schwimmt (dann u ≠ NaN). */
    lat: number;
    u: number;
    /** Drehpunkt (Ruhelage), Richtung des Winds (waagrecht, zur Fahrbahn hin) und Fahrtrichtung. */
    px: number;
    py: number;
    pz: number;
    hx: number;
    hz: number;
    fx: number;
    fz: number;
    /** Lampe (Ruhelage). */
    lx: number;
    ly: number;
    lz: number;
  }
  const socks: Sock[] = [];
  for (const w of t.winds) {
    const side = windSide(w);
    const inLee = (s: number): boolean => w.lee.some((l) => s >= l.first - 2 && s <= l.last + 2 && (side < 0 ? l.lat0 < 0 : l.lat1 > 0));
    const end = w.first + w.count - 3;
    const wanted: number[] = [];
    for (let s = w.first + 3; s <= end; s += SOCK_EVERY) wanted.push(s);
    if (end - wanted[wanted.length - 1] > SOCK_EVERY * 0.6) wanted.push(end);
    for (let s of wanted) {
      // Nicht vor einen Containerstapel: in die nächste Lücke
      if (inLee(s)) {
        const l = w.lee.find((q) => s >= q.first - 2 && s <= q.last + 2)!;
        const after = l.last + 4;
        const before = l.first - 4;
        s = after <= end && !inLee(after) && after - s < s - before ? after : before >= w.first + 1 && !inLee(before) ? before : after;
        if (s > end || s < w.first) continue;
      }
      // Nicht in eine fremde Fahrbahn: ein Stück weiter
      let lat = 0;
      let tries = 0;
      for (;;) {
        const float = (t.edge[s] & EDGE_FLOAT) !== 0;
        lat = side * (t.wh[s] + (float ? 1.15 : t.edge[s] & EDGE_DECK ? 0.85 : 0.95));
        const x = t.px[s] + rightX(t, s) * lat;
        const z = t.pz[s] + rightZ(t, s) * lat;
        if (!crowded(x, z, s) || tries > 6) break;
        s = Math.min(end, s + 5);
        tries++;
      }
      if (socks.some((o) => o.wind === w && Math.abs(o.seg - s) < 15)) continue;
      const u = uOf[s];
      const hx = rightX(t, s) * -side;
      const hz = rightZ(t, s) * -side;
      const base = t.py[s] + lat * t.bank[s];
      // Arm vom Mast zur Fahrbahn hin; daran hängt der Sack
      const arm = 0.75;
      const mx = t.px[s] + rightX(t, s) * lat;
      const mz = t.pz[s] + rightZ(t, s) * lat;
      socks.push({
        seg: s,
        side,
        wind: w,
        lat,
        u,
        px: mx + hx * arm,
        py: base + MAST_H,
        pz: mz + hz * arm,
        hx,
        hz,
        fx: t.tx[s],
        fz: t.tz[s],
        lx: mx - hx * 0.25,
        ly: base + MAST_H - 0.75,
        lz: mz - hz * 0.25,
      });
    }
  }

  // ---- Masten: fest (Land, Mole) oder auf einem Ausleger am Ponton ----
  for (const s of socks) {
    const seg = s.seg;
    const side = s.side;
    if (s.u === s.u) {
      // schwimmt: Ausleger vom Deckrand, Mast darauf (in Streckenkoordinaten, macht den Seegang mit)
      const u = s.u;
      const w = t.wh[seg];
      const a0 = side * w;
      const a1 = s.lat + side * 0.25;
      boxT(flatMB, UV, u - 0.3, u + 0.3, -0.4, -0.08, Math.min(a0, a1), Math.max(a0, a1), C_STEEL_D);
      const T: Xform = (x, y, z) => [u + x, s.lat + z, y];
      cylT(bodyMB, T, 0, 0, 0.13, -1.2, MAST_H + 0.3, C_MAST, C_MAST_D, 5, 'top');
      boxT(flatMB, UV, u - 0.06, u + 0.06, MAST_H - 0.06, MAST_H + 0.06, Math.min(s.lat, s.lat - side * 0.8), Math.max(s.lat, s.lat - side * 0.8), C_MAST_D);
      boxT(flatMB, UV, u - 0.2, u + 0.2, MAST_H - 1.05, MAST_H - 0.45, s.lat + side * 0.25 - 0.2, s.lat + side * 0.25 + 0.2, C_MAST_D);
    } else {
      const mx = t.px[seg] + rightX(t, seg) * s.lat;
      const mz = t.pz[seg] + rightZ(t, seg) * s.lat;
      const base = t.py[seg] + s.lat * t.bank[seg];
      const T: Xform = (x, y, z) => [mx + x, y, mz + z];
      const bottom = base - (t.edge[seg] & EDGE_DECK ? 3.4 : 2.5);
      cylT(fixedMB, T, 0, 0, 0.14, bottom, base + MAST_H + 0.3, C_MAST, C_MAST_D, 5, 'top');

      // Arm zur Fahrbahn hin und Lampengehäuse
      // Rahmen: z zur Fahrbahn hin, x quer dazu
      const Tr: Xform = (x, y, z) => [mx + s.hx * z + s.hz * x, y, mz + s.hz * z - s.hx * x];
      boxT(fixedMB, Tr, -0.06, 0.06, base + MAST_H - 0.06, base + MAST_H + 0.06, 0, 0.8, C_MAST_D);
      boxT(fixedMB, Tr, -0.2, 0.2, base + MAST_H - 1.05, base + MAST_H - 0.45, -0.45, -0.05, C_MAST_D);
    }
  }

  // ============================ Netze ============================

  const maxAmp = t.pontoons.reduce((m, p) => Math.max(m, Math.abs(p.amp)), 0) + 0.2;
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);

  // Deck (+ Windschatten-Linie, steht): flach eingefärbt, leicht nach vorn gezogen wie die Farbe der Fahrbahn
  const deckMat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  disposables.push(deckMat);
  const deck = runs.length > 0 || !floorMB.empty ? compile([deckMB], floorMB, deckMat, maxAmp) : null;
  if (deck) {
    deck.mesh.name = 'deck';
    // Normalen nach oben: dann nimmt three.js dasselbe Grafikprogramm wie für die Fahrbahnfarbe.
    const nor = deck.mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
    for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
    group.add(deck.mesh);
    tris += deck.mesh.geometry.getAttribute('position').count / 3;
  }

  // Pontonbau (Kanten, Geländer, Schwimmkörper, Masten auf Pontons): Toon mit Kontur
  hullMB.pont0 = -1;
  const body = runs.length > 0 ? compile([bodyMB, hullMB], null, toon, maxAmp) : null;
  if (body) {
    body.mesh.name = 'pontons';
    if (detail) withOutline(body.mesh, 0.04);
    group.add(body.mesh);
    tris += (body.mesh.geometry.getAttribute('position').count / 3) * (detail ? 2 : 1);
  }
  // Kanten, Handläufe, Leisten: ohne Kontur (dünne Teile; die Kontur kostete hier die meisten Dreiecke)
  const flat = runs.length > 0 && !flatMB.empty ? compile([flatMB], null, toon, maxAmp) : null;
  if (flat) {
    flat.mesh.name = 'pontonkanten';
    group.add(flat.mesh);
    tris += flat.mesh.geometry.getAttribute('position').count / 3;
  }

  // Feststehendes: Containerstapel, Dalben, Masten an Land
  if (!fixedMB.empty) {
    const geo = fixedMB.build();
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, toon);
    mesh.name = 'feststehend';
    if (detail) withOutline(mesh, 0.05);
    group.add(mesh);
    tris += fixedMB.triangles * (detail ? 2 : 1);
  }

  // ---- Windsäcke: ein Netz, Ecken, Normalen (und Konturnormalen) je Bild ----
  const BANDS = SOCK_RINGS - 1;
  const VPS = BANDS * 2 * SOCK_SIDES; // Ecken je Sack (jedes Band eigene Ecken: harte Farbkanten)
  const nSock = socks.length;
  let sockMesh: THREE.Mesh | null = null;
  let sockPos: Float32Array | null = null;
  let sockNor: Float32Array | null = null;
  let sockOn: Float32Array | null = null;
  let sockAttrs: THREE.BufferAttribute[] = [];
  if (nSock > 0) {
    sockPos = new Float32Array(nSock * VPS * 3);
    sockNor = new Float32Array(nSock * VPS * 3);
    sockOn = new Float32Array(nSock * VPS * 3);
    const col = new Float32Array(nSock * VPS * 3);
    const index = new Uint16Array(nSock * BANDS * SOCK_SIDES * 6);
    let ii = 0;
    for (let s = 0; s < nSock; s++)
      for (let b = 0; b < BANDS; b++) {
        const c = b % 2 === 0 ? C_SOCK_A : C_SOCK_B;
        const v0 = s * VPS + b * 2 * SOCK_SIDES;
        for (let k = 0; k < 2 * SOCK_SIDES; k++) col.set(c, (v0 + k) * 3);
        for (let k = 0; k < SOCK_SIDES; k++) {
          const k1 = (k + 1) % SOCK_SIDES;
          const a0 = v0 + k;
          const a1 = v0 + k1;
          const b0 = v0 + SOCK_SIDES + k;
          const b1 = v0 + SOCK_SIDES + k1;
          // außen herum gegen den Uhrzeigersinn (sonst zeichnete die Kontur über den Sack)
          index[ii++] = a0;
          index[ii++] = a1;
          index[ii++] = b0;
          index[ii++] = a1;
          index[ii++] = b1;
          index[ii++] = b0;
        }
      }
    const geo = new THREE.BufferGeometry();
    const pa = new THREE.BufferAttribute(sockPos, 3).setUsage(THREE.DynamicDrawUsage);
    const na = new THREE.BufferAttribute(sockNor, 3).setUsage(THREE.DynamicDrawUsage);
    const oa = new THREE.BufferAttribute(sockOn, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', pa);
    geo.setAttribute('normal', na);
    geo.setAttribute('onormal', oa);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    const box = new THREE.Box3();
    for (const s of socks) box.expandByPoint(new THREE.Vector3(s.px, s.py, s.pz));
    geo.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    geo.boundingSphere.radius += SOCK_L + 2;
    sockAttrs = [pa, na, oa];
    const mat = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
    disposables.push(geo, mat);
    sockMesh = new THREE.Mesh(geo, mat);
    sockMesh.name = 'windsaecke';
    group.add(sockMesh);
    if (detail) withOutline(sockMesh, 0.035);
    tris += nSock * BANDS * SOCK_SIDES * 2 * (detail ? 2 : 1);
  }

  // ---- Lampen an den Masten: Instanzen, Farbe je Bild ----
  let lamps: THREE.InstancedMesh | null = null;
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lampGeo = new THREE.OctahedronGeometry(0.5);
  disposables.push(lampMat, lampGeo);
  const m4 = new THREE.Matrix4();
  const tmpColor = new THREE.Color();
  if (nSock > 0) {
    lamps = new THREE.InstancedMesh(lampGeo, lampMat, nSock);
    lamps.name = 'lampen';
    lamps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    socks.forEach((s, i) => {
      m4.makeTranslation(s.lx, s.ly, s.lz);
      lamps!.setMatrixAt(i, m4);
      lamps!.setColorAt(i, tmpColor.setHex(0x3a3626));
    });
    lamps.frustumCulled = false;
    group.add(lamps);
    tris += nSock * 8;
  }

  // ---- Böenschleier: flache Streifen über der Bahn, Ecken je Bild ----
  interface Streak {
    wind: Wind;
    seg: number;
    /** Windseite, Halbbreite des Bereichs, Phase, Tempo (m/s), Länge, Höhe über der Bahn. */
    side: number;
    half: number;
    phase: number;
    speed: number;
    len: number;
    lift: number;
    /** Windschatten auf diesem Abschnitt: frei erst ab dieser Lage (in Windrichtung gemessen), sonst −Infinity. */
    calmTo: number;
  }
  const streaks: Streak[] = [];
  for (const w of t.winds) {
    const side = windSide(w);
    const count = Math.max(1, Math.round(w.count / (detail ? VEIL_EVERY : VEIL_EVERY * 1.6)));
    for (let j = 0; j < count; j++) {
      const fr = (x: number): number => x - Math.floor(x);
      const seg = w.first + Math.min(w.count - 1, Math.floor(((j + 0.5 + (fr(j * 0.618) - 0.5) * 0.7) * w.count) / count));
      // Windschatten: der Streifen erscheint erst hinter ihm (Lage in Windrichtung d = lat · −side)
      let calmTo = -Infinity;
      for (const l of w.lee) {
        if (seg < l.first || seg > l.last) continue;
        const d0 = Math.min(l.lat0 * -side, l.lat1 * -side);
        const d1 = Math.max(l.lat0 * -side, l.lat1 * -side);
        if (d0 <= -t.wh[seg]) calmTo = Math.max(calmTo, d1);
      }
      streaks.push({
        wind: w,
        seg,
        side,
        half: t.wh[seg] + 0.3,
        phase: fr(j * 0.754877),
        speed: 15 + 6 * fr(j * 0.371),
        len: 3.2 + 2.2 * fr(j * 0.713),
        lift: 0.3 + 0.35 * fr(j * 0.291),
        calmTo,
      });
    }
  }
  const nStreak = streaks.length;
  let veilPos: Float32Array | null = null;
  let veilAttr: THREE.BufferAttribute | null = null;
  let veilMesh: THREE.Mesh | null = null;
  if (nStreak > 0) {
    veilPos = new Float32Array(nStreak * 4 * 3);
    const index = new Uint16Array(nStreak * 6);
    for (let i = 0; i < nStreak; i++) index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    const geo = new THREE.BufferGeometry();
    veilAttr = new THREE.BufferAttribute(veilPos, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', veilAttr);
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    const box = new THREE.Box3();
    for (const s of streaks) box.expandByPoint(new THREE.Vector3(t.px[s.seg], t.py[s.seg], t.pz[s.seg]));
    geo.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    geo.boundingSphere.radius += 12;
    const mat = new THREE.MeshBasicMaterial({ color: 0xf2f8fb, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
    disposables.push(geo, mat);
    veilMesh = new THREE.Mesh(geo, mat);
    veilMesh.name = 'boeenschleier';
    veilMesh.renderOrder = 2;
    group.add(veilMesh);
    tris += nStreak * 2;
  }

  // Zum Nachzählen (Dreiecke, Konturen eingerechnet)
  group.userData.triangles = Math.round(tris);

  // ============================ je Bild ============================

  /** Mitte und Halbmesser je schwimmender Strecke (für "zu weit weg"). */
  const runMid = runs.map((r) => {
    const b = new THREE.Box3();
    for (const s of r.segs) b.expandByPoint(new THREE.Vector3(t.px[s], t.py[s], t.pz[s]));
    const c = b.getCenter(new THREE.Vector3());
    return { x: c.x, z: c.z, r: b.getSize(new THREE.Vector3()).length() / 2 };
  });
  const lastLift = new Float64Array(t.pontoons.length).fill(NaN);
  const spine = new Float64Array((SOCK_RINGS + 1) * 3);
  let puffBudget = 0;
  let first = true;

  /** Zustand eines Windsacks: 0 = hängt … 1 = steht waagrecht. */
  function elevation(w: Wind, time: number): number {
    let c = (time + w.phase) % w.period;
    if (c < 0) c += w.period;
    if (c < w.on) return 0.62 + 0.38 * smooth(Math.min(1, gustStrength(w, time) * 1.2));
    if (c < w.on + 50) return 0.04 + 0.58 * (1 - (c - w.on) / 50);
    return 0.04 + 0.58 * smooth(Math.min(1, gustWarning(w, time) * 1.6));
  }

  function writeSock(i: number, s: Sock, time: number, heave: number): void {
    const w = s.wind;
    const e = elevation(w, time);
    const k = gustStrength(w, time);
    const warn = gustWarning(w, time);
    const sec = time / 60;
    // Richtung des Sacks: zwischen senkrecht nach unten und waagrecht in Windrichtung
    const ang = e * Math.PI * 0.5;
    const dh = Math.sin(ang);
    const dv = -Math.cos(ang);
    const flutter = 0.05 + 0.22 * k + 0.1 * warn;
    const L = SOCK_L * (0.85 + 0.15 * e);
    const seg = L / (SOCK_RINGS - 1);
    let x = s.px;
    let y = s.py + heave;
    let z = s.pz;
    spine[0] = x;
    spine[1] = y;
    spine[2] = z;
    for (let r = 1; r < SOCK_RINGS; r++) {
      const q = r / (SOCK_RINGS - 1);
      // Wellen laufen den Sack entlang: seitlich (Fahrtrichtung) und etwas auf und ab
      const wave = Math.sin(sec * (7 + 9 * k) - r * 1.3 + i * 1.7);
      const wave2 = Math.cos(sec * (5 + 7 * k) - r * 1.1 + i * 0.9);
      const side = flutter * q * wave;
      const lift = (0.6 * flutter * q * wave2 + (e > 0.6 ? -0.08 * q : 0)) * dh;
      let ddx = s.hx * dh + s.fx * side;
      let ddy = dv + lift;
      let ddz = s.hz * dh + s.fz * side;
      const l = Math.hypot(ddx, ddy, ddz) || 1;
      ddx /= l;
      ddy /= l;
      ddz /= l;
      x += ddx * seg;
      y += ddy * seg;
      z += ddz * seg;
      spine[r * 3] = x;
      spine[r * 3 + 1] = y;
      spine[r * 3 + 2] = z;
    }
    const pos = sockPos!;
    const nor = sockNor!;
    const on = sockOn!;
    for (let b = 0; b < BANDS; b++)
      for (let end = 0; end < 2; end++) {
        const r = b + end;
        const q = r / (SOCK_RINGS - 1);
        // Achse an diesem Ring
        const ra = Math.max(0, r - 1);
        const rb = Math.min(SOCK_RINGS - 1, r + 1);
        let ax = spine[rb * 3] - spine[ra * 3];
        let ay = spine[rb * 3 + 1] - spine[ra * 3 + 1];
        let az = spine[rb * 3 + 2] - spine[ra * 3 + 2];
        const al = Math.hypot(ax, ay, az) || 1;
        ax /= al;
        ay /= al;
        az /= al;
        // p1 = Achse × Fahrtrichtung, p2 = Achse × p1
        let p1x = ay * s.fz - az * 0;
        let p1y = az * s.fx - ax * s.fz;
        let p1z = ax * 0 - ay * s.fx;
        const pl = Math.hypot(p1x, p1y, p1z) || 1;
        p1x /= pl;
        p1y /= pl;
        p1z /= pl;
        const p2x = ay * p1z - az * p1y;
        const p2y = az * p1x - ax * p1z;
        const p2z = ax * p1y - ay * p1x;
        // schlaff: zum Ende hin zusammengefallen
        const rad = (SOCK_R0 + (SOCK_R1 - SOCK_R0) * q) * (1 - 0.5 * (1 - Math.min(1, e / 0.62)) * q);
        const cx = spine[r * 3];
        const cy = spine[r * 3 + 1];
        const cz = spine[r * 3 + 2];
        const v0 = i * VPS + b * 2 * SOCK_SIDES + end * SOCK_SIDES;
        for (let k2 = 0; k2 < SOCK_SIDES; k2++) {
          const th = (k2 / SOCK_SIDES) * Math.PI * 2;
          const c = Math.cos(th);
          const sn = Math.sin(th);
          const nx = p1x * c + p2x * sn;
          const ny = p1y * c + p2y * sn;
          const nz = p1z * c + p2z * sn;
          const o = (v0 + k2) * 3;
          pos[o] = cx + nx * rad;
          pos[o + 1] = cy + ny * rad;
          pos[o + 2] = cz + nz * rad;
          nor[o] = on[o] = nx;
          nor[o + 1] = on[o + 1] = ny;
          nor[o + 2] = on[o + 2] = nz;
        }
      }
  }

  return {
    group,
    update(time, _seconds, dt, cam, fx) {
      // ---- Seegang ----
      let near = first;
      for (const m of runMid) if (Math.hypot(cam.x - m.x, cam.z - m.z) < m.r + 520) near = true;
      if (runs.length > 0 && near) {
        for (let u = 0; u < U; u++) {
          const s = nodeSeg[u];
          H[SRC_NODE + u] = s < 0 ? 0 : heaveAt(t, s, 0, time);
        }
        for (let p = 0; p < t.pontoons.length; p++) H[SRC_PONTOON + p] = pontoonLift(t.pontoons[p], time);
        if (deck) writeHeave(deck);
        if (body) writeHeave(body);
        if (flat) writeHeave(flat);
      }
      first = false;

      // ---- Gischt, wenn ein Ponton unten eintaucht (nur mit Zierde, in Kameranähe) ----
      for (let p = 0; p < t.pontoons.length; p++) {
        const po = t.pontoons[p];
        const lift = pontoonLift(po, time);
        const prev = lastLift[p];
        lastLift[p] = lift;
        if (!detail || prev !== prev || !(prev > -0.55 * po.amp && lift <= -0.55 * po.amp)) continue;
        const mid = po.first + (po.count >> 1);
        if (Math.hypot(t.px[mid] - cam.x, t.pz[mid] - cam.z) > 110) continue;
        for (let k = 0; k < 14; k++) {
          const s = po.first + 3 + Math.floor(((k >> 1) / 7) * (po.count - 6));
          const sgn = k % 2 === 0 ? -1 : 1;
          const w = t.wh[s] - 0.2;
          const rx = rightX(t, s) * sgn;
          const rz = rightZ(t, s) * sgn;
          fx.puff(t.px[s] + rx * w, WATER + 0.25, t.pz[s] + rz * w, rx * (2 + Math.random() * 2), 2.5 + Math.random() * 2, rz * (2 + Math.random() * 2), 0.7, 0.8, 0xe6f1f4, 1.6, 7);
        }
      }

      // ---- Windsäcke und Lampen ----
      if (sockMesh && lamps) {
        const sec = time / 60;
        for (let i = 0; i < nSock; i++) {
          const s = socks[i];
          const heave = s.u === s.u ? heaveAt(t, s.seg, 0, time) : 0;
          writeSock(i, s, time, heave);
          const k = gustStrength(s.wind, time);
          const warn = gustWarning(s.wind, time);
          let hex = 0x3a3626;
          if (k > 0) hex = 0xff2a14;
          else if (warn > 0) hex = Math.floor(sec * (2.5 + 9 * warn) * 2) % 2 === 0 ? 0xffd23f : 0x4a3a10;
          lamps.setColorAt(i, tmpColor.setHex(hex));
          if (s.u === s.u) {
            m4.makeTranslation(s.lx, s.ly + heave, s.lz);
            lamps.setMatrixAt(i, m4);
          }
        }
        for (const a of sockAttrs) a.needsUpdate = true;
        lamps.instanceMatrix.needsUpdate = true;
        if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
      }

      // ---- Böenschleier ----
      if (veilPos && veilAttr && veilMesh) {
        const sec = time / 60;
        let any = false;
        for (let i = 0; i < nStreak; i++) {
          const st = streaks[i];
          const k = gustStrength(st.wind, time);
          const o = i * 12;
          const s = st.seg;
          let d0 = 0;
          let d1 = 0;
          if (k > 0.02) {
            // Kopf des Streifens in Windrichtung d (von −half bis +half, dann von vorn)
            const span = 2 * st.half + st.len;
            let h = (sec * st.speed + st.phase * span) % span;
            if (h < 0) h += span;
            h -= st.half;
            d1 = Math.min(st.half, h);
            d0 = Math.max(-st.half, h - st.len * (0.35 + 0.65 * k), st.calmTo + 0.6);
          }
          if (d1 - d0 < 0.05) {
            for (let q = 0; q < 12; q++) veilPos[o + q] = 0;
            veilPos[o] = veilPos[o + 3] = veilPos[o + 6] = veilPos[o + 9] = t.px[s];
            veilPos[o + 1] = veilPos[o + 4] = veilPos[o + 7] = veilPos[o + 10] = t.py[s];
            veilPos[o + 2] = veilPos[o + 5] = veilPos[o + 8] = veilPos[o + 11] = t.pz[s];
            continue;
          }
          any = true;
          // d → lat: Wind weht zur Seite −side
          const la = d0 * -st.side;
          const lb = d1 * -st.side;
          const rx = rightX(t, s);
          const rz = rightZ(t, s);
          const y0 = t.py[s] + (t.edge[s] & EDGE_FLOAT ? heaveAt(t, s, 0, time) : 0) + st.lift;
          const wdt = 0.12 + 0.14 * k;
          // leicht schräg: das hintere Ende hängt etwas zurück
          const back = 0.5;
          const ax = t.px[s] + rx * la;
          const az = t.pz[s] + rz * la;
          const bx = t.px[s] + rx * lb;
          const bz = t.pz[s] + rz * lb;
          const ya = y0 + la * t.bank[s];
          const yb = y0 + lb * t.bank[s];
          veilPos[o] = ax - t.tx[s] * (wdt + back);
          veilPos[o + 1] = ya;
          veilPos[o + 2] = az - t.tz[s] * (wdt + back);
          veilPos[o + 3] = bx - t.tx[s] * wdt;
          veilPos[o + 4] = yb;
          veilPos[o + 5] = bz - t.tz[s] * wdt;
          veilPos[o + 6] = bx + t.tx[s] * wdt;
          veilPos[o + 7] = yb;
          veilPos[o + 8] = bz + t.tz[s] * wdt;
          veilPos[o + 9] = ax + t.tx[s] * (wdt - back);
          veilPos[o + 10] = ya;
          veilPos[o + 11] = az + t.tz[s] * (wdt - back);
        }
        veilMesh.visible = any;
        veilAttr.needsUpdate = true;
      }

      // ---- Gischt quer über die Bahn während der Böe (nur mit Zierde) ----
      if (detail && nStreak > 0) {
        puffBudget = Math.min(4, puffBudget + dt * 14);
        while (puffBudget >= 1) {
          puffBudget -= 1;
          const st = streaks[Math.floor(Math.random() * nStreak)];
          const k = gustStrength(st.wind, time);
          if (k < 0.35) continue;
          const s = st.seg;
          if (Math.hypot(t.px[s] - cam.x, t.pz[s] - cam.z) > 75) continue;
          const d = Math.max(-st.half, st.calmTo + 0.4);
          const lat = d * -st.side;
          const rx = rightX(t, s) * -st.side;
          const rz = rightZ(t, s) * -st.side;
          const y = t.py[s] + (t.edge[s] & EDGE_FLOAT ? heaveAt(t, s, 0, time) : 0) + 0.5;
          const v = 9 + 6 * k;
          fx.puff(t.px[s] + rightX(t, s) * lat, y, t.pz[s] + rightZ(t, s) * lat, rx * v + t.tx[s] * (Math.random() - 0.5) * 2, 0.6, rz * v + t.tz[s] * (Math.random() - 0.5) * 2, 0.75, 0.55, 0xe9f2f5, 1.3, -0.4);
        }
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
      lamps?.dispose();
    },
  };
}

/**
 * MeshBuilder in Streckenkoordinaten (u, lat, dy): merkt sich je Ecke, wie sie in die Welt kommt
 * (mode, siehe locate) und ob sie starr an einem Ponton hängt (pont ≥ 0). Die Bausteine aus
 * machineKit (face, boxT, cylT, stripedFace) zeichnen über tri() – sie funktionieren unverändert.
 */
class PB extends MeshBuilder {
  readonly v: number[] = [];
  readonly c: number[] = [];
  readonly mode: number[] = [];
  readonly pont: number[] = [];
  /** Für die nächsten Dreiecke. */
  mode0 = 0;
  pont0 = -1;
  get count(): number {
    return this.mode.length;
  }
  override get empty(): boolean {
    return this.mode.length === 0;
  }
  override get triangles(): number {
    return this.mode.length / 3;
  }
  override tri(a: V3, b: V3, c: V3, color: RGB): void {
    this.triModes(a, b, c, this.mode0, this.mode0, this.mode0, color);
  }
  triModes(a: V3, b: V3, c: V3, ma: number, mb: number, mc: number, color: RGB): void {
    this.v.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.mode.push(ma, mb, mc);
    this.pont.push(this.pont0, this.pont0, this.pont0);
    for (let i = 0; i < 3; i++) this.c.push(color[0], color[1], color[2]);
  }
}

function shadeRgb(c: RGB, f: number): RGB {
  return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
}

function sub3(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// Kulisse der Vulkaninsel: eine bewohnte Insel, deren Berg gerade ausbricht.
//
// Unten ist die Welt noch heil – das weiße Fischerdorf mit Kirchturm, Hafen und
// Fähre, Palmen und Agaven an der Küstenstraße, Brandung an den Klippen und in
// der Schlucht. Je höher, desto verbrannter: Asche und verkohlte Bäume an der
// Flanke, Fumarolen, ein verlassener Messwagen; oben schwarze Schlacke, eine
// gezackte Kraterkrone und im Krater ein Lavasee mit treibenden Krustenschollen,
// aus dem die Aschesäule aufsteigt. Unter den brüchigen Stegen (Kraterrand,
// Basaltbrücke) glüht der Glutgraben; unter der Basaltbrücke fließt ein
// Lavastrom zischend ins Meer, im Westen kriechen Lavazungen zwischen den
// Serpentinen hinab, das Lavafeld ist schwarz und von Glutadern durchzogen.
//
// Der Berg arbeitet in Schüben (etwa alle 20–30 s): die Säule quillt, der See
// glüht auf, Brocken fliegen in hohem Bogen – und fallen in den Krater zurück.
//
// Zeichentechnik (harte Vorgabe, siehe tests/unit/shaderregeln.test.ts): keine
// eigenen Shader, keine Texturen. Alles sind Netze mit Eckenfarben; was sich
// bewegt, wird je Bild auf der CPU umgerechnet (Ecken bzw. Eckenfarben) oder ist
// eine Instanz. Zeichenaufrufe: stehende Kulisse + Kontur, Geländeauflage,
// Glut (Lava, Lichter, Brandung, Brocken), Beweglisches + Kontur, Aschesäule
// + Kontur – bei niedriger Qualität ohne Konturen.
//
// Reine Kulisse: nichts liegt näher als 3 m an einer Fahrbahnkante (auch die
// Abzweigungen; um die Hängebrücke 6 m), nichts hängt tiefer als 10 m über der
// Fahrbahn, im Glutgraben liegt nur Lava. Im Lauf wird nichts neu angelegt.

import * as THREE from 'three';
import { EDGE_DECK, EDGE_OPEN_L, EDGE_OPEN_R, EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { MeshBuilder, mixRgb, noise, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import { PIT_D, type World } from '../world';

/** Ablauf eines Schubs in Sekunden: Grollen, Ausbruch, Abklingen. */
const RUMBLE = 2.4;
const BLAST = 4.5;
const TAIL = 7;
/** Schwerkraft der Glutbrocken. */
const BOMB_G = 15;
/** So tief unter der Fahrbahn liegt die Lava im Glutgraben. */
const PIT_LAVA = 4.5;
/** Abstand der Kulisse zur Fahrbahnkante (Bande) und zur Hängebrücke. */
const KEEP = 3;
const KEEP_BRIDGE = 6;
/** Takt der Brandung. */
const SURF = 6;

// Farben der Glut: Kruste, dunkelrot, orange, gelb, weißglühend.
const L_CRUST = rgb(0x3a1712);
const L_DARK = rgb(0xa82a10);
const L_MID = rgb(0xff5f1a);
const L_HOT = rgb(0xffa832);
const L_WHITE = rgb(0xffe795);

export function buildVulkanLife(world: World): Life {
  const t = world.track;
  const th = world.theme;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const hi = detail > 0;
  const many = detail === 0 ? 0.5 : 1;
  const SEA = th.liquidY ?? -4;
  const rnd = seeded(9100 + t.index * 31);
  const cr = world.crater;
  const hemiBase = world.hemi.intensity;
  /** Wind (heißer Wind vom Meer übers Land, weht die Säule vom Kraterrand weg). */
  const windX = 0.34;
  const windZ = 0.94;

  // =====================================================================================
  // Grundlagen: Abstand zur Fahrbahn (schnell über ein Raster), Höhe des gezeichneten Geländes
  // =====================================================================================
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < t.total; i++) {
    minX = Math.min(minX, t.px[i]);
    maxX = Math.max(maxX, t.px[i]);
    minZ = Math.min(minZ, t.pz[i]);
    maxZ = Math.max(maxZ, t.pz[i]);
  }
  const HB = 12;
  const hbx0 = minX - 80;
  const hbz0 = minZ - 80;
  const hnx = Math.ceil((maxX - minX + 160) / HB) + 1;
  const hnz = Math.ceil((maxZ - minZ + 160) / HB) + 1;
  const hStart = new Int32Array(hnx * hnz + 1);
  const hSegs = new Int32Array(t.total);
  {
    const cellOf = (i: number): number => Math.floor((t.px[i] - hbx0) / HB) + Math.floor((t.pz[i] - hbz0) / HB) * hnx;
    for (let i = 0; i < t.total; i++) hStart[cellOf(i) + 1]++;
    for (let c = 0; c < hnx * hnz; c++) hStart[c + 1] += hStart[c];
    const fill = hStart.slice();
    for (let i = 0; i < t.total; i++) hSegs[fill[cellOf(i)]++] = i;
  }
  /** Ergebnis von clear(): nächster Abschnitt. */
  let nearSeg = -1;
  /**
   * Abstand zur nächsten Fahrbahnkante (wie world.clearance, um Tunnel liegt Fels).
   * Über 40 m wird nicht genau gerechnet (Ergebnis dann ≥ 40). skipBranch: diese Abzweigung auslassen.
   */
  const clear = (x: number, z: number, skipBranch = -9): number => {
    const cx = Math.floor((x - hbx0) / HB);
    const cz = Math.floor((z - hbz0) / HB);
    let best = 99;
    nearSeg = -1;
    for (let dz = -4; dz <= 4; dz++) {
      const zz = cz + dz;
      if (zz < 0 || zz >= hnz) continue;
      for (let dx = -4; dx <= 4; dx++) {
        const xx = cx + dx;
        if (xx < 0 || xx >= hnx) continue;
        const c = xx + zz * hnx;
        for (let k = hStart[c]; k < hStart[c + 1]; k++) {
          const i = hSegs[k];
          if (t.branchOf[i] === skipBranch) continue;
          let d = Math.hypot(x - t.px[i], z - t.pz[i]) - t.wh[i];
          if (t.edge[i] & EDGE_TUNNEL) d -= 7;
          // Die Hängebrücke (Abzweigung 1) bleibt beidseits weiter frei.
          if (t.branchOf[i] === 1) d -= KEEP_BRIDGE - KEEP;
          if (d < best) {
            best = d;
            nearSeg = i;
          }
        }
      }
    }
    return best;
  };

  // Raster des Geländes genau wie in world.buildTerrain: so liegen Auflagen und Lava exakt darauf.
  const cell = detail === 0 ? 11 : 7.5;
  const gx0 = minX - 150;
  const gz0 = minZ - 150;
  const gnx = Math.max(1, Math.ceil((maxX - minX + 300) / cell));
  const gnz = Math.max(1, Math.ceil((maxZ - minZ + 300) / cell));
  const gh = new Float32Array((gnx + 1) * (gnz + 1)).fill(NaN);
  const GH = (ix: number, iz: number): number => {
    const k = iz * (gnx + 1) + ix;
    let y = gh[k];
    if (Number.isNaN(y)) {
      const edge = Math.min(ix, gnx - ix, iz, gnz - iz) / 5;
      const h = world.heightAt(gx0 + ix * cell, gz0 + iz * cell);
      y = th.farY + (h - th.farY) * smooth(edge);
      gh[k] = y;
    }
    return y;
  };
  /** Höhe des gezeichneten Geländes (dieselben Dreiecke wie die Welt). */
  const TY = (x: number, z: number): number => {
    const fx = (x - gx0) / cell;
    const fz = (z - gz0) / cell;
    const ix = Math.max(0, Math.min(gnx - 1, Math.floor(fx)));
    const iz = Math.max(0, Math.min(gnz - 1, Math.floor(fz)));
    const u = fx - ix;
    const v = fz - iz;
    const a = GH(ix, iz);
    const b = GH(ix + 1, iz);
    const c = GH(ix + 1, iz + 1);
    const d = GH(ix, iz + 1);
    if ((ix + iz) % 2 === 0) return v > u ? a + (c - d) * u + (d - a) * v : a + (b - a) * u + (c - b) * v;
    return u + v < 1 ? a + (b - a) * u + (d - a) * v : c + (d - c) * (1 - u) + (b - c) * (1 - v);
  };
  /** Liegt ein Abschnitt über dem Glutgraben (wie world.pitAt)? */
  const pitSeg = (i: number): boolean => {
    if (t.holes.length === 0 || (t.edge[i] & EDGE_DECK) === 0 || (t.edge[i] & (EDGE_OPEN_L | EDGE_OPEN_R)) !== 0) return false;
    for (const h of t.holes) if (t.branchOf[h.first] === t.branchOf[i] && i >= h.first - 14 && i < h.first + h.count + 14) return true;
    return false;
  };
  const isPit = new Uint8Array(t.total);
  for (let i = 0; i < t.total; i++) isPit[i] = pitSeg(i) ? 1 : 0;

  /** Belegte Plätze (x, z, Halbmesser), damit nichts ineinander steht. */
  const taken: number[] = [];
  const free = (x: number, z: number, r: number): boolean => {
    for (let q = 0; q < taken.length; q += 3) if (Math.hypot(x - taken[q], z - taken[q + 1]) < r + taken[q + 2]) return false;
    return true;
  };
  /**
   * Prüft einen Platz für ein Objekt mit Halbmesser r: Abstand zur Fahrbahn (am Glutgraben
   * zusätzlich bis hinter dessen Wand), über Wasser, nicht zu schief, nicht belegt.
   * Liefert die tiefste Geländehöhe unter dem Objekt oder NaN.
   */
  const site = (x: number, z: number, r: number, need = KEEP, slope = 2.5, minY = SEA + 0.6): number => {
    const c = clear(x, z);
    if (c < need + r) return NaN;
    if (nearSeg >= 0 && isPit[nearSeg] && c < r + 9) return NaN;
    if (!free(x, z, r)) return NaN;
    let lo = TY(x, z);
    let hiY = lo;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      const y = TY(x + Math.cos(a) * r, z + Math.sin(a) * r);
      lo = Math.min(lo, y);
      hiY = Math.max(hiY, y);
    }
    if (lo < minY || hiY - lo > slope) return NaN;
    return lo;
  };
  const take = (x: number, z: number, r: number): void => {
    taken.push(x, z, r);
  };
  /** Punkt neben der Strecke: Abschnitt i, seitlich lat. */
  const sx = (i: number, lat: number): number => t.px[i] + rightX(t, i) * lat;
  const sz = (i: number, lat: number): number => t.pz[i] + rightZ(t, i) * lat;
  /** Drehung, mit der die lokale +z-Achse (Vorderseite) nach (dx, dz) zeigt. */
  const face = (dx: number, dz: number): number => Math.atan2(dx, dz);
  /** Hauptstrecke zwischen zwei Metern (mit Überlauf an der Ziellinie)? */
  const inRange = (i: number, a: number, b: number): boolean => i >= 0 && i < t.n && (a <= b ? i >= a && i <= b : i >= a || i <= b);

  // =====================================================================================
  // Bausteine
  // =====================================================================================
  /** Lokale Koordinaten (x quer, y hoch, z vorn) um (cx, cy, cz), um die Hochachse gedreht. */
  const XF = (cx: number, cy: number, cz: number, rot: number) => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return (x: number, y: number, z: number): V3 => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
  };
  /** Vieleckiger Stumpf (Säule, Stamm, Felszahn) von y0 aufwärts, Spitze um (lx, lz) versetzt. */
  const prism = (
    b: MeshBuilder,
    cx: number,
    y0: number,
    cz: number,
    r0: number,
    r1: number,
    h: number,
    n: number,
    col: RGB,
    rot = 0,
    top?: RGB,
    lx = 0,
    lz = 0,
  ): void => {
    const p = (a: number, r: number, y: number, ox: number, oz: number): V3 => [cx + ox + Math.cos(a + rot) * r, y, cz + oz + Math.sin(a + rot) * r];
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      b.quad(p(a1, r0, y0, 0, 0), p(a0, r0, y0, 0, 0), p(a0, r1, y0 + h, lx, lz), p(a1, r1, y0 + h, lx, lz), shade(col, 0.92 + (k % 3) * 0.06));
      if (r1 > 0.01) b.tri([cx + lx, y0 + h, cz + lz], p(a1, r1, y0 + h, lx, lz), p(a0, r1, y0 + h, lx, lz), top ?? col);
    }
  };
  const icoGeo = new THREE.IcosahedronGeometry(1, 0);
  disposables.push(icoGeo);
  const tm = new THREE.Matrix4();
  const tq = new THREE.Quaternion();
  const te = new THREE.Euler();
  const tv = new THREE.Vector3();
  const ts = new THREE.Vector3();
  /** Kantiger Brocken (Ikosaeder), verzerrt und gedreht. */
  const rock = (b: MeshBuilder, x: number, y: number, z: number, ax: number, ay: number, az: number, col: RGB, rot = 0, tilt = 0): void => {
    te.set(tilt, rot, tilt * 0.5);
    tq.setFromEuler(te);
    b.add(icoGeo, col, tm.compose(tv.set(x, y, z), tq, ts.set(ax, ay, az)));
  };
  /** Tonnendach: halber Zylinder längs der lokalen z-Achse, Breite w, Länge d, Fuß bei y0. */
  const barrel = (b: MeshBuilder, P: (x: number, y: number, z: number) => V3, w: number, d: number, y0: number, col: RGB, flat = 0.55): void => {
    const N = 6;
    const q = (k: number, z: number): V3 => {
      const a = (k / N) * Math.PI;
      return P(Math.cos(a) * w * 0.5, y0 + Math.sin(a) * w * 0.5 * flat, z);
    };
    for (let k = 0; k < N; k++) {
      b.quad(q(k, -d / 2), q(k + 1, -d / 2), q(k + 1, d / 2), q(k, d / 2), shade(col, 0.95 + (k % 2) * 0.07));
      b.tri(P(0, y0, d / 2), q(k, d / 2), q(k + 1, d / 2), shade(col, 0.9));
      b.tri(P(0, y0, -d / 2), q(k + 1, -d / 2), q(k, -d / 2), shade(col, 0.9));
    }
  };
  /** Flaches Rechteck auf einer Wand (lokale z = zf, Blick nach +z bzw. −z). */
  const plate = (b: MeshBuilder, P: (x: number, y: number, z: number) => V3, x: number, y: number, w: number, h: number, zf: number, col: RGB): void => {
    if (zf > 0) b.quad(P(x - w / 2, y, zf), P(x + w / 2, y, zf), P(x + w / 2, y + h, zf), P(x - w / 2, y + h, zf), col);
    else b.quad(P(x + w / 2, y, zf), P(x - w / 2, y, zf), P(x - w / 2, y + h, zf), P(x + w / 2, y + h, zf), col);
  };
  /** Wie plate, aber auf einer Seitenwand (lokale x = xf, Blick nach ±x). */
  const plateX = (b: MeshBuilder, P: (x: number, y: number, z: number) => V3, z: number, y: number, w: number, h: number, xf: number, col: RGB): void => {
    if (xf > 0) b.quad(P(xf, y, z + w / 2), P(xf, y, z - w / 2), P(xf, y + h, z - w / 2), P(xf, y + h, z + w / 2), col);
    else b.quad(P(xf, y, z - w / 2), P(xf, y, z + w / 2), P(xf, y + h, z + w / 2), P(xf, y + h, z - w / 2), col);
  };

  // Netze
  const st = new MeshBuilder(); // stehende Kulisse (Toon, Kontur)
  const drape = new MeshBuilder(); // Auflage aufs Gelände (Sand, Asche, Schlacke)

  // --- Glut: ein Netz mit Eckenfarben (MeshBasic). Drei Teile hintereinander:
  //     A) Ecken, die je Bild neu liegen (Brocken, Blasen, Brandung), B) Flächen, deren
  //     Farbe fließt (Lava), C) feste Lichter (Laternen, Fenster).
  const gA: number[] = []; // lokale Ecken der Teile in A
  const gAc: number[] = [];
  const gB: number[] = [];
  const fKind: number[] = []; // je Dreieck in B: 1 See, 2 Fluss, 3 Glutader
  const fS: number[] = [];
  const fO: number[] = [];
  const gC: number[] = [];
  const gCc: number[] = [];
  const lavaTri = (a: V3, b: V3, c: V3, kind: number, s: number, o: number): void => {
    gB.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    fKind.push(kind);
    fS.push(s);
    fO.push(o);
  };
  const glowTri = (a: V3, b: V3, c: V3, col: RGB): void => {
    gC.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let k = 0; k < 3; k++) gCc.push(col[0], col[1], col[2]);
  };
  const glowQuad = (a: V3, b: V3, c: V3, d: V3, col: RGB): void => {
    glowTri(a, b, c, col);
    glowTri(a, c, d, col);
  };
  const glowBox = (cx: number, cy: number, cz: number, s: number, col: RGB): void => {
    const b = new MeshBuilder();
    b.box(cx, cy, cz, s, s, s, col);
    const g = b.build();
    const p = g.getAttribute('position');
    for (let k = 0; k < p.count; k += 3) glowTri([p.getX(k), p.getY(k), p.getZ(k)], [p.getX(k + 1), p.getY(k + 1), p.getZ(k + 1)], [p.getX(k + 2), p.getY(k + 2), p.getZ(k + 2)], col);
    g.dispose();
  };
  /** Teil in A: Ecken einer Vorlage (um den Ursprung), Rückgabe: [erste Ecke, Anzahl]. */
  const glowPart = (g: THREE.BufferGeometry, colOf: (face: number) => RGB): [number, number] => {
    const p = g.getAttribute('position');
    const start = gA.length / 3;
    for (let k = 0; k < p.count; k++) {
      gA.push(p.getX(k), p.getY(k), p.getZ(k));
      const c = colOf(Math.floor(k / 3));
      gAc.push(c[0], c[1], c[2]);
    }
    return [start, p.count];
  };

  // --- Bewegliches: ein Netz (Toon, Kontur), dessen Ecken je Bild aus Vorlagen gerechnet werden.
  const mL: number[] = []; // lokale Ecken
  const mN: number[] = []; // lokale Normalen
  const mO: number[] = []; // lokale Konturnormalen
  const mC: number[] = [];
  const parts: number[] = []; // je Teil: erste Ecke, Anzahl
  const addPart = (b: MeshBuilder, ink = 1): number => {
    const g = addSmoothNormals(b.build());
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const o = g.getAttribute('onormal');
    const c = g.getAttribute('color');
    parts.push(mL.length / 3, p.count);
    for (let k = 0; k < p.count; k++) {
      mL.push(p.getX(k), p.getY(k), p.getZ(k));
      mN.push(n.getX(k), n.getY(k), n.getZ(k));
      mO.push(o.getX(k) * ink, o.getY(k) * ink, o.getZ(k) * ink);
      mC.push(c.getX(k), c.getY(k), c.getZ(k));
    }
    g.dispose();
    return parts.length / 2 - 1;
  };

  // =====================================================================================
  // 1. Krater: Lavasee, Krone, Basaltsäulen am Außenhang
  // =====================================================================================
  const lakeY = cr ? cr.floorY + 1 : 0;
  let lakeR = 0;
  if (cr) {
    // Ufer des Sees: dort, wo das gezeichnete Gelände über den Spiegel steigt.
    const NS = detail === 0 ? 20 : 30;
    const shore: number[] = [];
    for (let k = 0; k < NS; k++) {
      const a = (k / NS) * Math.PI * 2;
      let r = cr.floor * 0.8;
      while (r < cr.floor + 12 && TY(cr.x + Math.cos(a) * r, cr.z + Math.sin(a) * r) < lakeY + 0.35) r += 0.7;
      shore.push(r + 0.8);
    }
    lakeR = Math.min(...shore);
    const RINGS = [0, 0.3, 0.55, 0.78, 1];
    const P = (k: number, j: number): V3 => {
      const a = (k / NS) * Math.PI * 2;
      const r = shore[k % NS] * RINGS[j];
      return [cr.x + Math.cos(a) * r, lakeY, cr.z + Math.sin(a) * r];
    };
    for (let j = 0; j < RINGS.length - 1; j++) {
      for (let k = 0; k < NS; k++) {
        if (j === 0) lavaTri(P(k, 0), P(k + 1, 1), P(k, 1), 1, 0, 0);
        else {
          lavaTri(P(k, j), P(k + 1, j + 1), P(k, j + 1), 1, j, k);
          lavaTri(P(k, j), P(k + 1, j), P(k + 1, j + 1), 1, j, k + 0.5);
        }
      }
    }

    // Kraterkrone: gezackte Felszähne auf dem Rand, wo keine Strecke läuft.
    const inner = cr.road - cr.wh - 1;
    const NT = Math.round(46 * many);
    const cTooth = rgb(0x2a2226);
    const cTooth2 = rgb(0x3d3034);
    for (let k = 0; k < NT; k++) {
      const a = (k / NT) * Math.PI * 2 + rnd() * 0.08;
      const d = inner + 0.5 + rnd() * 4;
      const x = cr.x + Math.cos(a) * d;
      const z = cr.z + Math.sin(a) * d;
      const c = clear(x, z);
      if (c < 6) continue;
      const y = TY(x, z);
      const big = 0.5 + 0.5 * noise(a * 2.2, 3.1);
      const h = 4 + big * 9 + rnd() * 4;
      const r0 = 2.2 + big * 2 + rnd();
      // Leicht nach außen gelehnt, oben spitz.
      prism(st, x, y - 2, z, r0, 0.25 + rnd() * 0.5, h + 2, 4 + Math.floor(rnd() * 2), rnd() < 0.5 ? cTooth : cTooth2, rnd() * 3, undefined, Math.cos(a) * 1.2, Math.sin(a) * 1.2);
      if (rnd() < 0.6) rock(st, x + Math.cos(a) * r0, y + 0.4, z + Math.sin(a) * r0, 1.6, 1, 1.4, cTooth2, rnd() * 3, 0.3);
    }
    // Innenwand: ein paar dunkle Felsrippen, die zum See hinabführen.
    for (let k = 0; k < Math.round(16 * many); k++) {
      const a = rnd() * Math.PI * 2;
      const d = lakeR + 3 + rnd() * 6;
      const x = cr.x + Math.cos(a) * d;
      const z = cr.z + Math.sin(a) * d;
      if (clear(x, z) < 10) continue;
      rock(st, x, TY(x, z) + 0.3, z, 2 + rnd() * 2, 1 + rnd(), 1.5 + rnd(), rgb(0x2a1e22), a, 0.3);
    }
  }

  // Basaltsäulen: Gruppen sechseckiger Säulen mit gestuften Köpfen.
  const cBasalt = rgb(0x34303a);
  const cBasaltTop = rgb(0x4a4450);
  const basaltGroup = (x: number, z: number, n: number, hMax: number, r = 0.85): boolean => {
    const y = site(x, z, 2.5 + n * 0.25, KEEP + 1, 4);
    if (Number.isNaN(y)) return false;
    take(x, z, 2 + n * 0.3);
    for (let k = 0; k < n; k++) {
      const a = k * 2.39996;
      const d = Math.sqrt(k) * r * 1.75;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      const h = hMax * (1 - 0.55 * (d / (Math.sqrt(n) * r * 1.75 + 0.01))) * (0.75 + rnd() * 0.35);
      prism(st, px, y - 1.5, pz, r, r, h + 1.5, 6, cBasalt, 0.3, cBasaltTop);
    }
    return true;
  };
  {
    // Außenhang des Kraterrands (rechts der Fahrbahn, hinter dem Graben).
    let placed = 0;
    for (let k = 0; k < 120 && placed < Math.round(9 * many); k++) {
      const i = 790 + Math.floor(rnd() * 160);
      const lat = t.wh[i] + 14 + rnd() * 22;
      if (basaltGroup(sx(i, lat), sz(i, lat), 5 + Math.floor(rnd() * 7), 3 + rnd() * 4)) placed++;
    }
  }

  // =====================================================================================
  // 2. Glutgraben unter Kraterrand und Basaltbrücke, Lavastrom ins Meer, Glutspalte
  // =====================================================================================
  // Breite der Lava quer: Bruchteil von (wh + 9); innen eben, außen folgt sie dem Gelände
  // nach unten (läuft über) und endet in der Grabenwand.
  const FR = [-1, -0.9, -0.8, -0.7, -0.45, -0.2, 0, 0.2, 0.45, 0.7, 0.8, 0.9, 1];
  let streamMouth: V3 | null = null;
  {
    const runs: [number, number][] = [];
    let a = -1;
    for (let i = 0; i <= t.n; i++) {
      const p = i < t.n && isPit[i] === 1;
      if (p && a < 0) a = i;
      if (!p && a >= 0) {
        runs.push([a, i - 1]);
        a = -1;
      }
    }
    const step = detail === 0 ? 3 : 2;
    for (const [r0, r1] of runs) {
      const rows: { p: V3[]; buried: boolean[] }[] = [];
      for (let i = r0 - 2; i <= r1 + 3; i += step) {
        const seg = Math.max(0, Math.min(t.n - 1, i));
        const L = t.wh[seg] + 9;
        const y0 = t.py[seg] - PIT_LAVA;
        const p: V3[] = [];
        const buried: boolean[] = [];
        for (const f of FR) {
          const lat = f * L;
          const x = sx(seg, lat);
          const z = sz(seg, lat);
          const g = TY(x, z);
          let y = Math.abs(lat) <= t.wh[seg] + 3 ? y0 : Math.min(y0, g + 0.3);
          if (g > y0 + 0.6) y = y0;
          p.push([x, y, z]);
          buried.push(g > y + 0.5);
        }
        rows.push({ p, buried });
      }
      for (let r = 0; r + 1 < rows.length; r++) {
        const A = rows[r];
        const Bq = rows[r + 1];
        for (let k = 0; k + 1 < FR.length; k++) {
          const s = (r0 + r * step) * 1.0;
          const o = Math.abs(FR[k]) * 2.2;
          if (!(A.buried[k] && A.buried[k + 1] && Bq.buried[k])) lavaTri(A.p[k], Bq.p[k], A.p[k + 1], 2, s, o);
          if (!(A.buried[k + 1] && Bq.buried[k] && Bq.buried[k + 1])) lavaTri(A.p[k + 1], Bq.p[k], Bq.p[k + 1], 2, s + step * 0.5, o);
        }
      }
    }

    // Basaltbrücke: der Strom kommt vom Berg (rechts) in den Graben und läuft links ins Meer.
    const basalt = runs.find(([r0, r1]) => r0 > 1200 && r1 < 1420);
    /** Ein Lavaband, das dem Gelände folgt: Mittellinie pts, Breite w0 → w1, Flussrichtung = Reihenfolge. */
    const ribbon = (pts: V3[], w0: number, w1: number, s0: number, kind = 2): void => {
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k];
        const b = pts[k + 1];
        let dx = b[0] - a[0];
        let dz = b[2] - a[2];
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        const wa = (w0 + (w1 - w0) * (k / (pts.length - 1))) / 2;
        const wb = (w0 + (w1 - w0) * ((k + 1) / (pts.length - 1))) / 2;
        // quer: (−dz, dx)
        const aL: V3 = [a[0] - dz * wa, 0, a[2] + dx * wa];
        const aR: V3 = [a[0] + dz * wa, 0, a[2] - dx * wa];
        const bL: V3 = [b[0] - dz * wb, 0, b[2] + dx * wb];
        const bR: V3 = [b[0] + dz * wb, 0, b[2] - dx * wb];
        for (const v of [aL, aR]) v[1] = Math.max(TY(v[0], v[2]), a[1] - 0.6) + 0.22;
        for (const v of [bL, bR]) v[1] = Math.max(TY(v[0], v[2]), b[1] - 0.6) + 0.22;
        const s = s0 + k * 2.5;
        lavaTri(aL, bL, aR, kind, s, 0);
        lavaTri(aR, bL, bR, kind, s + 1, 0.5);
      }
    };
    if (basalt) {
      const [r0, r1] = basalt;
      // Mündung: von der Grabenmitte nach links, bis das Meer erreicht ist.
      let bestLen = Infinity;
      let bestPts: V3[] = [];
      for (let i = r0 + 12; i <= r1 - 8; i += 3) {
        const pts: V3[] = [];
        const y0 = t.py[i] - PIT_LAVA;
        let ok = false;
        for (let lat = -(t.wh[i] + 3); lat > -(t.wh[i] + 70); lat -= 2.5) {
          const x = sx(i, lat);
          const z = sz(i, lat);
          const g = TY(x, z);
          if (g > y0 + 1.2) break;
          // Ein anderer Teil der Strecke darf nicht im Weg liegen.
          if (clear(x, z) < KEEP && nearSeg >= 0 && !isPit[nearSeg]) break;
          pts.push([x, Math.min(y0, g + 0.3), z]);
          if (g < SEA - 0.4) {
            ok = true;
            break;
          }
        }
        if (ok && pts.length < bestLen) {
          bestLen = pts.length;
          bestPts = pts;
        }
      }
      if (bestPts.length >= 2) {
        // Ins Meer hinaus noch ein Stück flach auf dem Wasser auslaufen lassen.
        const last = bestPts[bestPts.length - 1];
        const prev = bestPts[bestPts.length - 2];
        const dx = last[0] - prev[0];
        const dz = last[2] - prev[2];
        for (let k = 1; k <= 3; k++) bestPts.push([last[0] + dx * k, SEA + 0.12, last[2] + dz * k]);
        for (const p of bestPts) p[1] = Math.max(p[1], SEA + 0.12);
        ribbon(bestPts, 9, 6, r1 + 4);
        streamMouth = bestPts[bestPts.length - 3];
      }
      // Zufluss vom Berg: aus einer Spalte am Hang rechts der Brücke hinab in den Graben.
      for (let tryI = 0; tryI < 8; tryI++) {
        const i = r0 + 4 + tryI * 3;
        const pts: V3[] = [];
        let ok = true;
        const L = 60;
        for (let lat = t.wh[i] + 3; lat <= t.wh[i] + L; lat += 2.5) {
          const wig = Math.sin(lat * 0.13 + tryI) * 3;
          const x = sx(i, lat) + rightZ(t, i) * wig * 0;
          const z = sz(i, lat);
          const x2 = x + t.tx[i] * wig;
          const z2 = z + t.tz[i] * wig;
          const c = clear(x2, z2);
          const inPit = nearSeg >= 0 && isPit[nearSeg] === 1 && lat < t.wh[i] + 8;
          if (!inPit && c < KEEP + 1.5) {
            ok = false;
            break;
          }
          pts.push([x2, Math.min(t.py[i] - PIT_LAVA, TY(x2, z2)) + (inPit ? 0 : 0.25), z2]);
        }
        if (!ok || pts.length < 10) continue;
        pts.reverse();
        // Oben in der Spalte: Lava fließt hangab (Reihenfolge = Fließrichtung).
        for (const p of pts) p[1] = Math.max(p[1], TY(p[0], p[2]) + 0.22);
        pts[pts.length - 1][1] = t.py[i] - PIT_LAVA;
        ribbon(pts, 3, 6.5, r0 - 40);
        const src = pts[0];
        // Speiende Spalte: dunkler Schlackenkegel um die Quelle.
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          rock(st, src[0] + Math.cos(a) * 3, src[1] + 0.2, src[2] + Math.sin(a) * 3, 2, 1.2 + rnd(), 1.6, rgb(0x2b2226), a, 0.2);
        }
        take(src[0], src[2], 5);
        vents.push(src[0], src[1] + 1, src[2], 1);
        break;
      }
    }

    // Glutspalte unter dem Sprung: die Lücke selbst glüht.
    for (let i = 0; i < t.n; i++) {
      if ((t.edge[i] & 4) === 0) continue; // EDGE_GAP
      const n2 = t.next[i];
      const L = t.wh[i] + 3;
      for (let k = 0; k < 6; k++) {
        const f0 = -1 + (k / 6) * 2;
        const f1 = -1 + ((k + 1) / 6) * 2;
        const P = (seg: number, f: number): V3 => {
          const x = sx(seg, f * L);
          const z = sz(seg, f * L);
          return [x, TY(x, z) + 0.25, z];
        };
        lavaTri(P(i, f0), P(n2, f0), P(i, f1), 3, i, f0);
        lavaTri(P(i, f1), P(n2, f0), P(n2, f1), 3, i, f0 + 0.3);
      }
    }
  }

  // =====================================================================================
  // 3. Fischerdorf (0–171 m und 1408–1445 m)
  // =====================================================================================
  const village = (i: number): boolean => inRange(i, 1405, 175);
  const cWhite = rgb(0xf6f1e6);
  const cWhite2 = rgb(0xece4d4);
  const cRoofs = [rgb(0xf6f1e6), rgb(0x5a8fd0), rgb(0xd86a3a), rgb(0xf0eadb)];
  const cShutters = [rgb(0x2f6fd0), rgb(0x2a9a6a), rgb(0xf0b02a), rgb(0xd04a3a), rgb(0x3ab0c8)];
  const cWin = rgb(0x24304a);
  const cLit = rgb(0xffcf6a);
  const cDoor = rgb(0x6a4228);
  /** Haus: weiß, Tonnendach, Fenster mit bunten Läden; Vorderseite (+z) zur Straße. Liefert die Tür (Welt). */
  const house = (x: number, y: number, z: number, rot: number, w: number, d: number, h: number): V3 => {
    const P = XF(x, y, z, rot);
    const wall = rnd() < 0.7 ? cWhite : cWhite2;
    const [bx, , bz] = P(0, 0, 0);
    st.box(bx, y + (h + 0.8) / 2 - 0.8, bz, w, h + 0.8, d, wall, rot);
    const roofC = cRoofs[Math.floor(rnd() * cRoofs.length)];
    // Dachrand, dann Tonne quer oder längs.
    st.box(bx, y + h + 0.1, bz, w + 0.3, 0.2, d + 0.3, rgb(0xd9d0c0), rot);
    if (w >= d) barrel(st, XF(x, y, z, rot + Math.PI / 2), d + 0.2, w + 0.2, y + h + 0.2 - y, roofC);
    else barrel(st, P, w + 0.2, d + 0.2, h + 0.2, roofC);
    const sh = cShutters[Math.floor(rnd() * cShutters.length)];
    const nWin = Math.max(1, Math.floor(w / 2.4));
    for (const zf of [d / 2 + 0.04, -d / 2 - 0.04]) {
      for (let k = 0; k < nWin; k++) {
        const wx = -w / 2 + (k + 0.5) * (w / nWin);
        const door = zf > 0 && k === Math.floor(nWin / 2);
        if (door) {
          plate(st, P, wx, 0, 1.1, 2.1, zf, cDoor);
          plate(st, P, wx, 2.1, 1.4, 0.18, zf * 1.01, sh);
          continue;
        }
        const wy = h > 4.2 ? 2.5 : 1.3;
        const lit = rnd() < 0.3;
        if (lit) {
          const s = zf > 0 ? 1 : -1;
          const a = P(wx - 0.4 * s, wy, zf * 1.002);
          const b = P(wx + 0.4 * s, wy, zf * 1.002);
          const c = P(wx + 0.4 * s, wy + 1.1, zf * 1.002);
          const dd = P(wx - 0.4 * s, wy + 1.1, zf * 1.002);
          glowQuad(a, b, c, dd, cLit);
        } else plate(st, P, wx, wy, 0.8, 1.1, zf, cWin);
        plate(st, P, wx - 0.75, wy - 0.05, 0.5, 1.2, zf * 1.004, sh);
        plate(st, P, wx + 0.75, wy - 0.05, 0.5, 1.2, zf * 1.004, sh);
        if (h > 4.2) plate(st, P, wx, 0.9, 0.8, 0.9, zf, cWin);
      }
    }
    for (const xf of [w / 2 + 0.04, -w / 2 - 0.04]) if (d > 3.5) plateX(st, P, 0, 1.4, 0.8, 1, xf, cWin);
    return P(0, 0, d / 2 + 1.2);
  };

  // Plätze der Häuser: beidseits der Straße, Vorderseite zur Straße.
  const doorsSea: V3[] = []; // Türen auf der Meerseite (dort laufen Leute zum Hafen)
  let seaSide = -1; // Seite (Vorzeichen von lat), auf der das Meer liegt
  {
    let sea = 0;
    for (let i = 0; i < 160; i += 10) {
      if (TY(sx(i, -(t.wh[i] + 40)), sz(i, -(t.wh[i] + 40))) < SEA) sea--;
      if (TY(sx(i, t.wh[i] + 40), sz(i, t.wh[i] + 40)) < SEA) sea++;
    }
    seaSide = sea > 0 ? 1 : -1;
  }
  // Kirche: landeinwärts bei 95 m.
  let bellAt: V3 = [0, 0, 0];
  let churchFlag: V3 = [0, 0, 0];
  for (let tryK = 0; tryK < 40; tryK++) {
    const i = 80 + tryK * 2;
    const lat = -seaSide * (t.wh[i] + 9 + (tryK % 5) * 2);
    const x = sx(i, lat);
    const z = sz(i, lat);
    const y = site(x, z, 7, KEEP + 1, 3);
    if (Number.isNaN(y)) continue;
    take(x, z, 8);
    const rot = face(-rightX(t, i) * Math.sign(lat), -rightZ(t, i) * Math.sign(lat));
    const P = XF(x, y, z, rot);
    // Schiff mit Tonnendach, Turm seitlich davor.
    const [nx, , nz] = P(0, 0, -1);
    st.box(nx, y + 3, nz, 7, 6.8, 11, cWhite, rot);
    barrel(st, XF(nx, y, nz, rot), 7.4, 11.4, 6.4, rgb(0x5a8fd0), 0.6);
    plate(st, XF(nx, y, nz, rot), 0, 0, 1.6, 3, 5.54, cDoor);
    plate(st, XF(nx, y, nz, rot), 0, 3.6, 1.6, 1.6, 5.54, rgb(0x5a8fd0));
    for (const xf of [3.54, -3.54]) for (const zz of [-3, 0, 3]) plateX(st, XF(nx, y, nz, rot), zz, 2.6, 0.9, 2.2, xf, rgb(0x2f6fd0));
    const T = XF(...P(4.2, 0, 4.2).slice(0, 1).concat([y]).concat(P(4.2, 0, 4.2).slice(2)) as unknown as [number, number, number], rot);
    const [tx0, , tz0] = P(4.2, 0, 4.2);
    st.box(tx0, y + 5, tz0, 3.2, 11, 3.2, cWhite2, rot);
    // Glockenstube: vier Pfeiler, darüber eine kleine blaue Kuppel.
    for (const [ux, uz] of [
      [-1.3, -1.3],
      [1.3, -1.3],
      [1.3, 1.3],
      [-1.3, 1.3],
    ]) {
      const [qx, , qz] = T(ux, 0, uz);
      st.box(qx, y + 12.2, qz, 0.6, 3.4, 0.6, cWhite, rot);
    }
    st.box(tx0, y + 14.05, tz0, 3.5, 0.3, 3.5, cWhite, rot);
    prism(st, tx0, y + 14.2, tz0, 1.7, 0.2, 2.2, 8, rgb(0x2f6fd0), 0, rgb(0x2f6fd0));
    bellAt = [tx0, y + 13.6, tz0];
    churchFlag = [tx0, y + 16.4, tz0];
    st.box(tx0, y + 15.8, tz0, 0.12, 3, 0.12, rgb(0x3a3440));
    break;
  }
  // Häuser
  {
    const want = Math.round(22 * many);
    let n = 0;
    for (let tryK = 0; tryK < 600 && n < want; tryK++) {
      const along = Math.floor(rnd() * 210);
      const i = (1408 + along) % t.n;
      const side = rnd() < 0.45 ? seaSide : -seaSide;
      const w = 4.4 + rnd() * 3;
      const d = 3.8 + rnd() * 2.4;
      const r = Math.hypot(w, d) / 2;
      const lat = side * (t.wh[i] + KEEP + 1.5 + r + rnd() * rnd() * 22);
      const x = sx(i, lat);
      const z = sz(i, lat);
      const y = site(x, z, r, KEEP + 0.5, 2.6, 0.2);
      if (Number.isNaN(y)) continue;
      take(x, z, r + 0.6);
      const rot = face(-rightX(t, i) * side, -rightZ(t, i) * side) + (rnd() - 0.5) * 0.15;
      const door = house(x, y, z, rot, w, d, 3.2 + rnd() * (rnd() < 0.3 ? 2.4 : 0.8));
      if (side === seaSide) doorsSea.push(door);
      n++;
    }
  }

  // Hafen: eine Mole vom Strand hinaus ins Meer, daran die Fähre.
  let quayA: V3 | null = null; // Wurzel (am Strand)
  let quayB: V3 | null = null; // Kopf
  let quayDir: [number, number] = [0, -1];
  {
    let best = Infinity;
    for (let i = 10; i < 165; i += 4) {
      const rx = rightX(t, i) * seaSide;
      const rz = rightZ(t, i) * seaSide;
      let beach = -1;
      let deep = -1;
      for (let lat = t.wh[i] + 10; lat < t.wh[i] + 90; lat += 2) {
        const g = TY(t.px[i] + rx * lat, t.pz[i] + rz * lat);
        if (beach < 0 && g < 0.9) beach = lat;
        if (beach >= 0 && g < SEA - 3) {
          deep = lat;
          break;
        }
      }
      if (beach < 0 || deep < 0) continue;
      const score = deep - beach + Math.abs(i - 70) * 0.1;
      if (score < best) {
        // Mole frei von anderen Teilen der Strecke?
        const ax = t.px[i] + rx * beach;
        const az = t.pz[i] + rz * beach;
        if (clear(ax, az) < KEEP + 3) continue;
        best = score;
        quayA = [ax, 1.3, az];
        quayB = [t.px[i] + rx * (deep + 26), 1.3, t.pz[i] + rz * (deep + 26)];
        quayDir = [rx, rz];
      }
    }
    if (quayA && quayB) {
      const len = Math.hypot(quayB[0] - quayA[0], quayB[2] - quayA[2]);
      const rot = face(quayDir[0], quayDir[1]);
      const mx = (quayA[0] + quayB[0]) / 2;
      const mz = (quayA[2] + quayB[2]) / 2;
      const top = 1.3;
      st.box(mx, (top + SEA - 4) / 2, mz, 5.5, top - SEA + 4, len, rgb(0xb8ab98), rot, rgb(0xd8ccb8));
      const P = XF(mx, 0, mz, rot);
      for (let k = 0; k < len / 6; k++) {
        const z = -len / 2 + 3 + k * 6;
        for (const xs of [-2.3, 2.3]) {
          const [bx, , bz] = P(xs, 0, z);
          prism(st, bx, top, bz, 0.25, 0.22, 0.6, 6, rgb(0x2a2a33));
        }
      }
      // Leuchtturm am Molenkopf: rot-weiß, mit Licht.
      const [hx, , hz] = P(0, 0, len / 2 - 2);
      prism(st, hx, top, hz, 1.2, 0.9, 3, 8, rgb(0xf6f1e6));
      prism(st, hx, top + 3, hz, 0.9, 0.8, 2.4, 8, rgb(0xd8402a));
      prism(st, hx, top + 5.4, hz, 0.8, 0.75, 1.6, 8, rgb(0xf6f1e6));
      glowBox(hx, top + 7.5, hz, 1.1, rgb(0xfff0a8));
      prism(st, hx, top + 8.05, hz, 0.9, 0.1, 1, 8, rgb(0xd8402a));
      take(mx, mz, 4);
      for (let k = 0; k < len; k += 6) take(quayA[0] + quayDir[0] * k, quayA[2] + quayDir[1] * k, 4);
      // Leute am Kai: zeigen zum Berg (stehen, Arm hebt sich – im beweglichen Teil).
    }
  }

  // Boote am Strand, Netze, Laternen
  const cHulls = [rgb(0x2f6fd0), rgb(0xd04a3a), rgb(0x2a9a6a), rgb(0xf0b02a), rgb(0xf6f1e6)];
  /** Fischerboot (lokal, Bug nach +z): Rumpf mit Spitzen, Bordwand, Bänke. */
  const boatInto = (b: MeshBuilder, P: (x: number, y: number, z: number) => V3, len: number, col: RGB, cabin: boolean): void => {
    const hw = len * 0.18;
    const hl = len / 2;
    const top = 0.7;
    const bot = -0.25;
    // Grundriss: Heck breit, Bug spitz.
    const ring = (y: number, k: number): V3[] => [P(-hw * k, y, -hl * 0.92), P(hw * k, y, -hl * 0.92), P(hw * k, y, hl * 0.35), P(0, y, hl), P(-hw * k, y, hl * 0.35)];
    const lo = ring(bot, 0.6);
    const up = ring(top, 1);
    const n = lo.length;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      b.quad(lo[k], lo[k2], up[k2], up[k], k === 0 ? shade(col, 0.85) : col);
    }
    // Deck etwas tiefer, Bordwandkante weiß.
    const deck = ring(top - 0.25, 0.92);
    b.tri(deck[0], deck[2], deck[1], rgb(0xa8794a));
    b.tri(deck[0], deck[4], deck[2], rgb(0xa8794a));
    b.tri(deck[4], deck[3], deck[2], rgb(0xa8794a));
    b.tri(lo[0], lo[1], lo[2], rgb(0x3a3440));
    b.tri(lo[0], lo[2], lo[4], rgb(0x3a3440));
    b.tri(lo[4], lo[2], lo[3], rgb(0x3a3440));
    if (cabin) {
      const [cx, cy, cz] = P(0, top, -hl * 0.3);
      const [qx, , qz] = P(0, 0, 1);
      const [ox, , oz] = P(0, 0, 0);
      const rot = Math.atan2(qx - ox, qz - oz);
      b.box(cx, cy + 0.7, cz, hw * 1.3, 1.4, len * 0.25, rgb(0xf6f1e6), rot, rgb(0xd04a3a));
      const [mx, my, mz] = P(0, top, hl * 0.15);
      b.box(mx, my + 1.6, mz, 0.12, 3.2, 0.12, rgb(0x6a4228), rot);
    }
  };
  {
    let n = 0;
    for (let tryK = 0; tryK < 400 && n < Math.round(8 * many); tryK++) {
      const i = (1408 + Math.floor(rnd() * 200)) % t.n;
      const lat = seaSide * (t.wh[i] + 8 + rnd() * 40);
      const x = sx(i, lat);
      const z = sz(i, lat);
      const y = TY(x, z);
      if (y < SEA + 0.4 || y > 1.4) continue;
      if (Number.isNaN(site(x, z, 2.5, KEEP + 2, 1.6, SEA + 0.4))) continue;
      take(x, z, 2.5);
      const rot = face(rightX(t, i) * seaSide, rightZ(t, i) * seaSide) + (rnd() - 0.5) * 1.2;
      boatInto(st, XF(x, y + 0.2, z, rot), 4.5 + rnd() * 1.5, cHulls[Math.floor(rnd() * cHulls.length)], false);
      n++;
      // Daneben ein Netzgestell.
      if (n % 2 === 0) {
        const nx = x + Math.cos(rot) * 4;
        const nz = z - Math.sin(rot) * 4;
        if (!Number.isNaN(site(nx, nz, 2.5, KEEP + 1, 2, SEA + 0.4))) {
          take(nx, nz, 2.5);
          const P = XF(nx, TY(nx, nz), nz, rot + 0.3);
          for (const xs of [-2.4, 2.4]) {
            const [ax, ay, az] = P(xs, 0, 0);
            st.box(ax, ay + 1.1, az, 0.16, 2.2, 0.16, rgb(0x6a4228));
          }
          const cNet = rgb(0x4a5a3a);
          for (let k = 0; k < 6; k++) {
            const x0 = -2.4 + (k / 6) * 4.8;
            const x1 = -2.4 + ((k + 1) / 6) * 4.8;
            const sag = (x: number): number => 2 - 0.5 * (1 - (x / 2.4) ** 2);
            const lo0 = 0.4 + (k % 2) * 0.25;
            const lo1 = 0.4 + ((k + 1) % 2) * 0.25;
            st.quad(P(x0, lo0, 0.02), P(x1, lo1, 0.02), P(x1, sag(x1), 0.02), P(x0, sag(x0), 0.02), cNet);
            st.quad(P(x1, lo1, -0.02), P(x0, lo0, -0.02), P(x0, sag(x0), -0.02), P(x1, sag(x1), -0.02), shade(cNet, 0.8));
          }
        }
      }
    }
    // Laternen entlang der Dorfstraße.
    for (let i = 1410; i < t.n + 170; i += 22) {
      const seg = i % t.n;
      for (const side of [-1, 1]) {
        const lat = side * (t.wh[seg] + KEEP + 0.4);
        const x = sx(seg, lat);
        const z = sz(seg, lat);
        const y = site(x, z, 0.4, KEEP, 3, 0);
        if (Number.isNaN(y)) continue;
        take(x, z, 0.6);
        prism(st, x, y - 0.2, z, 0.14, 0.1, 3.9, 5, rgb(0x2a2a33));
        st.box(x, y + 3.7, z, 0.5, 0.12, 0.5, rgb(0x2a2a33));
        glowBox(x, y + 4.05, z, 0.42, rgb(0xffd27a));
        prism(st, x, y + 4.26, z, 0.4, 0.05, 0.35, 4, rgb(0x2a2a33), Math.PI / 4);
      }
    }
  }

  // =====================================================================================
  // 4. Küstenstraße: Palmen, Agaven, Steinmauern
  // =====================================================================================
  const palm = (x: number, y: number, z: number, h: number): void => {
    const lean = rnd() * Math.PI * 2;
    const lx = Math.cos(lean);
    const lz = Math.sin(lean);
    const N = 5;
    let px = x;
    let pz = z;
    let py = y - 0.3;
    for (let k = 0; k < N; k++) {
      const f = (k + 1) / N;
      const nx = x + lx * f * f * h * 0.28;
      const nz = z + lz * f * f * h * 0.28;
      const seg = h / N;
      prism(st, px, py, pz, 0.34 - k * 0.03, 0.3 - k * 0.03, seg + 0.1, 5, k % 2 ? rgb(0x8a6a48) : rgb(0x7a5a3c), k, undefined, nx - px, nz - pz);
      px = nx;
      pz = nz;
      py += seg;
    }
    const cF = rgb(0x3f8a3a);
    const cF2 = rgb(0x2f7030);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + rnd() * 0.4;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const L = 3 + rnd() * 0.8;
      const base: V3 = [px, py, pz];
      const mid: V3 = [px + ca * L * 0.55, py + 0.7, pz + sa * L * 0.55];
      const tip: V3 = [px + ca * L, py - 0.9, pz + sa * L];
      const w = 0.55;
      const sL: V3 = [mid[0] - sa * w, mid[1] - 0.1, mid[2] + ca * w];
      const sR: V3 = [mid[0] + sa * w, mid[1] - 0.1, mid[2] - ca * w];
      const c = k % 2 ? cF : cF2;
      // beidseitig sichtbar
      st.tri(base, sR, mid, c);
      st.tri(base, mid, sL, c);
      st.tri(mid, sR, tip, c);
      st.tri(mid, tip, sL, c);
      st.tri(base, mid, sR, shade(c, 0.75));
      st.tri(base, sL, mid, shade(c, 0.75));
      st.tri(mid, tip, sR, shade(c, 0.75));
      st.tri(mid, sL, tip, shade(c, 0.75));
    }
    st.box(px, py - 0.25, pz, 0.6, 0.5, 0.6, rgb(0x6a4a2a));
  };
  const agave = (x: number, y: number, z: number, s: number): void => {
    const c = rgb(0x7aa890);
    const c2 = rgb(0x5f8f78);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + rnd() * 0.3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const L = (1.1 + rnd() * 0.5) * s;
      const up = (0.9 + rnd() * 0.6) * s;
      const tip: V3 = [x + ca * L, y + up, z + sa * L];
      const w = 0.22 * s;
      const l: V3 = [x - sa * w, y, z + ca * w];
      const r: V3 = [x + sa * w, y, z - ca * w];
      const back: V3 = [x - ca * w, y + 0.1, z - sa * w];
      st.tri(r, tip, l, k % 2 ? c : c2);
      st.tri(l, tip, back, shade(c2, 0.8));
      st.tri(back, tip, r, shade(c2, 0.8));
    }
  };
  {
    // Palmen und Agaven im Dorf und an der Küstenstraße (nicht am Hang).
    let nP = 0;
    let nA = 0;
    for (let tryK = 0; tryK < 900 && (nP < Math.round(30 * many) || nA < Math.round(30 * many)); tryK++) {
      const i = (1400 + Math.floor(rnd() * (560 + 45))) % t.n;
      if (!inRange(i, 1400, 548)) continue;
      const side = rnd() < 0.5 ? -1 : 1;
      const wantPalm = nP < Math.round(30 * many) && (rnd() < 0.5 || nA >= Math.round(30 * many));
      const lat = side * (t.wh[i] + (wantPalm ? 6 : 4) + rnd() * 16);
      const x = sx(i, lat);
      const z = sz(i, lat);
      const y = site(x, z, wantPalm ? 3 : 1.2, KEEP, 3, 0.2);
      if (Number.isNaN(y) || y > 14) continue;
      if (wantPalm) {
        take(x, z, 1.5);
        palm(x, y, z, 6.5 + rnd() * 3.5);
        nP++;
      } else {
        take(x, z, 1.2);
        agave(x, y, z, 0.9 + rnd() * 0.7);
        nA++;
      }
    }
    // Steinmauern landseitig entlang der Küstenstraße.
    const cStone = [rgb(0xc8b8a0), rgb(0xb0a08a), rgb(0xd6c8b0)];
    for (let i = 175; i < 545; i += 4) {
      if (i > 340 && i < 560 && i % 8 !== 0) continue;
      for (const side of [-1, 1]) {
        if (side === seaSide && i < 300) continue;
        const lat = side * (t.wh[i] + KEEP + 1.2);
        const x = sx(i, lat);
        const z = sz(i, lat);
        if (clear(x, z) < KEEP + 0.4) continue;
        const y = TY(x, z);
        if (y < SEA + 0.8 || (nearSeg >= 0 && t.branchOf[nearSeg] === 1)) continue;
        if (Math.floor(i / 28) % 3 === 2) continue; // Lücken
        st.box(x, y + 0.3, z, 1.1, 1.3, 3.8, cStone[(i >> 2) % 3], Math.atan2(t.tx[i], t.tz[i]), rgb(0xe0d6c4));
      }
    }
  }

  // =====================================================================================
  // 5. Schlucht: Felswände entlang der Hängebrücke, Brandung unten
  // =====================================================================================
  {
    const br = t.branches[1];
    if (br) {
      const cCliff = [rgb(0x9a6c58), rgb(0x86604f), rgb(0xb07e64)];
      for (let k = 30; k < br.count - 30; k += detail === 0 ? 7 : 4) {
        const i = br.first + k;
        for (const side of [-1, 1]) {
          for (const extra of [0, 5]) {
            const lat = side * (t.wh[i] + KEEP_BRIDGE + 1.5 + extra + rnd() * 2);
            const x = sx(i, lat);
            const z = sz(i, lat);
            if (clear(x, z) < KEEP + 1) continue;
            const g = TY(x, z);
            // Nur dort, wo die Schlucht tief ist: die Wand reicht vom Wasser bis zur Kante.
            const top = Math.max(g, TY(x + rightX(t, i) * side * 6, z + rightZ(t, i) * side * 6));
            if (top < SEA + 3) continue;
            const bot = SEA - 2;
            const h = top - bot + rnd() * 1.5 - 0.5;
            prism(st, x, bot, z, 2.6 + rnd(), 1.6 + rnd() * 0.8, h, 5, cCliff[Math.floor(rnd() * 3)], rnd() * 3, rgb(0x6f9a48));
          }
        }
      }
    }
  }

  // =====================================================================================
  // 6. Flanke (548–786 m): verkohlte Bäume, Asche, Glutrisse, Fumarolen, Messwagen
  // =====================================================================================
  const vents: number[] = []; // x, y, z, Stärke (Dampf)
  const deadTree = (x: number, y: number, z: number, h: number): void => {
    const c = rgb(0x1f1a1c);
    prism(st, x, y - 0.3, z, 0.3, 0.14, h, 5, c, rnd() * 3, undefined, (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.6);
    for (let k = 0; k < 3; k++) {
      const a = rnd() * Math.PI * 2;
      const by = y + h * (0.45 + k * 0.17);
      const L = 1.2 + rnd() * 1.2;
      prism(st, x, by, z, 0.1, 0.04, L, 4, c, a, undefined, Math.cos(a) * L * 0.8, Math.sin(a) * L * 0.8);
    }
  };
  {
    let nT = 0;
    for (let tryK = 0; tryK < 400 && nT < Math.round(24 * many); tryK++) {
      const i = 520 + Math.floor(rnd() * 280);
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + 4 + rnd() * 24);
      const x = sx(i, lat);
      const z = sz(i, lat);
      const y = site(x, z, 1, KEEP, 4, 2);
      if (Number.isNaN(y)) continue;
      take(x, z, 1);
      deadTree(x, y, z, 3.5 + rnd() * 3);
      nT++;
    }
    // Lavafeld und Serpentinen: auch dort ein paar Gerippe.
    for (let tryK = 0; tryK < 200 && nT < Math.round(36 * many); tryK++) {
      const i = 990 + Math.floor(rnd() * 240);
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + 4 + rnd() * 20);
      const x = sx(i, lat);
      const z = sz(i, lat);
      const y = site(x, z, 1, KEEP, 4, 1);
      if (Number.isNaN(y)) continue;
      take(x, z, 1);
      deadTree(x, y, z, 3 + rnd() * 3);
      nT++;
    }
    // Fumarolen: gelbliche Schwefelbrocken um einen Spalt, aus dem es dampft.
    let nV = 0;
    for (let tryK = 0; tryK < 300 && nV < Math.round(8 * many); tryK++) {
      const i = 600 + Math.floor(rnd() * 340);
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + 6 + rnd() * 18);
      const x = sx(i, lat);
      const z = sz(i, lat);
      const y = site(x, z, 2, KEEP + 1, 3, 3);
      if (Number.isNaN(y)) continue;
      take(x, z, 2.5);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + rnd();
        rock(st, x + Math.cos(a) * 1.3, y + 0.15, z + Math.sin(a) * 1.3, 0.7, 0.45, 0.6, k % 2 ? rgb(0xe8d04a) : rgb(0xc8b040), a);
      }
      vents.push(x, y + 0.5, z, 0.7);
      nV++;
    }
    // Messwagen und Wetterstation: verlassen am Hang.
    for (let tryK = 0; tryK < 80; tryK++) {
      const i = 640 + tryK * 2;
      const side = tryK % 2 ? 1 : -1;
      const lat = side * (t.wh[i] + 8 + (tryK % 3) * 3);
      const x = sx(i, lat);
      const z = sz(i, lat);
      const y = site(x, z, 4.5, KEEP + 1, 1.6, 2);
      if (Number.isNaN(y)) continue;
      take(x, z, 5);
      const rot = Math.atan2(t.tx[i], t.tz[i]) + 0.5;
      const P = XF(x, y, z, rot);
      const [ax, , az] = P(0, 0, -0.6);
      st.box(ax, y + 1.6, az, 2.3, 2.2, 3.6, rgb(0xf0f0ea), rot, rgb(0xd8d8d0));
      const [bx, , bz] = P(0, 0, 1.9);
      st.box(bx, y + 1.25, bz, 2.2, 1.5, 1.6, rgb(0xf0a82a), rot);
      plate(st, XF(bx, y, bz, rot), 0, 1.25, 1.8, 0.7, 0.82, rgb(0x2a3a5a));
      plateX(st, P, -0.6, 1.4, 3.4, 0.35, 1.17, rgb(0xd8402a));
      plateX(st, P, -0.6, 1.4, 3.4, 0.35, -1.17, rgb(0xd8402a));
      for (const [ux, uz] of [
        [-1.15, -1.6],
        [1.15, -1.6],
        [-1.15, 1.8],
        [1.15, 1.8],
      ]) {
        const [wx, , wz] = P(ux, 0, uz);
        rock(st, wx, y + 0.45, wz, 0.45, 0.45, 0.45, rgb(0x22202a), rot);
      }
      // Antenne auf dem Dach, Mast der Wetterstation daneben (Schalenkreuz dreht sich).
      const [mx, , mz] = P(-1, 0, -0.8);
      st.box(mx, y + 3.6, mz, 0.08, 1.8, 0.08, rgb(0x3a3440));
      const [sx2, , sz2] = P(3.4, 0, 0.5);
      prism(st, sx2, y - 0.2, sz2, 0.12, 0.08, 6.2, 4, rgb(0xd8d8d0));
      st.box(sx2, y + 3, sz2, 0.6, 0.5, 0.4, rgb(0xf0f0ea));
      anemo = [sx2, y + 6.1, sz2];
      break;
    }
  }
  let anemo: V3 | null = null;

  // Glutrisse im Hang der Flanke und auf dem Lavafeld: Zickzackbänder.
  const crack = (x: number, z: number, len: number, w: number, kind = 3): void => {
    let a = rnd() * Math.PI * 2;
    let px = x;
    let pz = z;
    const segs = Math.max(3, Math.round(len / 2.2));
    for (let k = 0; k < segs; k++) {
      a += (rnd() - 0.5) * 1.3;
      const L = len / segs;
      const nx = px + Math.cos(a) * L;
      const nz = pz + Math.sin(a) * L;
      if (clear(nx, nz) < KEEP) break;
      const ww = w * (1 - Math.abs(k / segs - 0.5));
      const ox = -Math.sin(a) * ww;
      const oz = Math.cos(a) * ww;
      const A: V3 = [px - ox, TY(px - ox, pz - oz) + 0.16, pz - oz];
      const B: V3 = [px + ox, TY(px + ox, pz + oz) + 0.16, pz + oz];
      const C: V3 = [nx + ox, TY(nx + ox, nz + oz) + 0.16, nz + oz];
      const D: V3 = [nx - ox, TY(nx - ox, nz - oz) + 0.16, nz - oz];
      lavaTri(A, C, B, kind, k, x * 0.1);
      lavaTri(A, D, C, kind, k, x * 0.1);
      px = nx;
      pz = nz;
    }
  };
  {
    let n = 0;
    for (let tryK = 0; tryK < 300 && n < Math.round(14 * many); tryK++) {
      const i = 610 + Math.floor(rnd() * 175);
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 6 + rnd() * 20);
      const x = sx(i, lat);
      const z = sz(i, lat);
      if (clear(x, z) < KEEP + 2 || TY(x, z) < 14) continue;
      crack(x, z, 6 + rnd() * 8, 0.35 + rnd() * 0.25);
      n++;
    }
  }

  // =====================================================================================
  // 7. Serpentinen und Lavaröhre: Lavazungen, erstarrte Wülste, Portale aus Basalt
  // =====================================================================================
  {
    let n = 0;
    for (let tryK = 0; tryK < 300 && n < Math.round(5 * many + 0.5); tryK++) {
      const i = 975 + Math.floor(rnd() * 200);
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 8 + rnd() * 20);
      let x = sx(i, lat);
      let z = sz(i, lat);
      if (clear(x, z) < 8 || TY(x, z) < 15) continue;
      // Hangab der steilsten Richtung folgen, bis die Fahrbahn zu nahe kommt.
      const pts: V3[] = [];
      for (let k = 0; k < 26; k++) {
        const e = 1.5;
        const gx = TY(x + e, z) - TY(x - e, z);
        const gz = TY(x, z + e) - TY(x, z - e);
        const gl = Math.hypot(gx, gz);
        if (gl < 0.05) break;
        pts.push([x, TY(x, z), z]);
        x -= (gx / gl) * 2.5;
        z -= (gz / gl) * 2.5;
        if (clear(x, z) < KEEP + 2) break;
      }
      if (pts.length < 8) continue;
      let ok = true;
      for (const p of pts) if (!free(p[0], p[2], 2)) ok = false;
      if (!ok) continue;
      ribbon(pts, 2, 4.2, n * 20);
      for (const p of pts) take(p[0], p[2], 2.2);
      // Die Front erstarrt zu einem dunklen Wulst.
      const end = pts[pts.length - 1];
      rock(st, end[0], end[1] + 0.2, end[2], 2.4, 0.9, 2, rgb(0x2a2024), rnd() * 3, 0.1);
      n++;
    }
    // Erstarrte Wülste und Schollen am Westhang.
    for (let k = 0; k < Math.round(30 * many); k++) {
      const i = 975 + Math.floor(rnd() * 230);
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 5 + rnd() * 22);
      const x = sx(i, lat);
      const z = sz(i, lat);
      const y = site(x, z, 1.8, KEEP, 5, 0);
      if (Number.isNaN(y)) continue;
      take(x, z, 1.8);
      rock(st, x, y + 0.2, z, 1.6 + rnd() * 1.4, 0.6 + rnd() * 0.6, 1.2 + rnd(), rnd() < 0.5 ? rgb(0x2a2226) : rgb(0x3a2e30), rnd() * 3, 0.15);
    }
    // Portale an Ein- und Ausfahrt der Lavaröhre: Basaltsäulen beidseits, darüber liegende Säulen.
    const tube = t.branches[0];
    if (tube) {
      for (const [m, dir] of [
        [52, -1],
        [130, 1],
      ] as const) {
        const i = tube.first + m + dir * 1;
        const rx = rightX(t, i);
        const rz = rightZ(t, i);
        const y0 = t.py[i];
        for (const side of [-1, 1]) {
          for (let k = 0; k < 4; k++) {
            const lat = side * (t.wh[i] + KEEP + 0.6 + k * 1.25);
            const x = sx(i, lat) + t.tx[i] * dir * (k * 0.4);
            const z = sz(i, lat) + t.tz[i] * dir * (k * 0.4);
            if (clear(x, z, 0) < KEEP) continue;
            const g = TY(x, z);
            const h = y0 + 9.5 + k * 0.9 - (g - 1.5);
            prism(st, x, g - 1.5, z, 0.75, 0.75, h, 6, cBasalt, 0.2 + k, cBasaltTop);
          }
        }
        // Liegende Säulen als Sturz – mindestens 10 m über der Fahrbahn.
        const span = t.wh[i] + KEEP + 4.6;
        for (let k = 0; k < 3; k++) {
          const yy = y0 + 10.6 + k * 1.3;
          const half = span - k * 0.8;
          const cx = t.px[i] + t.tx[i] * dir * (0.4 + k * 0.5);
          const cz = t.pz[i] + t.tz[i] * dir * (0.4 + k * 0.5);
          // Säule quer: als Sechseck-Prisma entlang rechts.
          const N = 6;
          const R = 0.7;
          const fx = t.tx[i];
          const fz = t.tz[i];
          const p = (a: number, l: number): V3 => [cx + rx * l + fx * Math.cos(a) * R, yy + Math.sin(a) * R, cz + rz * l + fz * Math.cos(a) * R];
          for (let q = 0; q < N; q++) {
            const a0 = (q / N) * Math.PI * 2;
            const a1 = ((q + 1) / N) * Math.PI * 2;
            st.quad(p(a0, -half), p(a1, -half), p(a1, half), p(a0, half), shade(cBasalt, 0.92 + (q % 3) * 0.06));
            st.quad(p(a1, -half), p(a0, -half), p(a0, half), p(a1, half), shade(cBasalt, 0.85));
          }
        }
        take(t.px[i], t.pz[i], 2);
        void rx;
      }
    }
  }

  // =====================================================================================
  // 8. Lavafeld (1207–1408 m): schwarze Schollen mit Glutadern, Basaltsäulen, Dampf
  // =====================================================================================
  {
    let n = 0;
    for (let tryK = 0; tryK < 500 && n < Math.round(36 * many); tryK++) {
      const i = 1195 + Math.floor(rnd() * 200);
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 4 + rnd() * 30);
      const x = sx(i, lat);
      const z = sz(i, lat);
      const r = 1.6 + rnd() * 2.2;
      const y = site(x, z, r, KEEP, 3, SEA + 0.6);
      if (Number.isNaN(y)) continue;
      take(x, z, r * 0.8);
      // Scholle: flaches, schiefes Vieleck, Ränder aufgeworfen.
      const N = 5 + Math.floor(rnd() * 3);
      const h = 0.5 + rnd() * 0.8;
      prism(st, x, y - 0.4, z, r, r * 0.8, h + 0.4, N, rgb(0x241e22), rnd() * 3, rnd() < 0.5 ? rgb(0x2e2629) : rgb(0x1c171a), (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.6);
      n++;
    }
    let nb = 0;
    for (let tryK = 0; tryK < 200 && nb < Math.round(7 * many); tryK++) {
      const i = 1200 + Math.floor(rnd() * 190);
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 8 + rnd() * 22);
      if (basaltGroup(sx(i, lat), sz(i, lat), 4 + Math.floor(rnd() * 9), 2 + rnd() * 5)) nb++;
    }
    let nc = 0;
    for (let tryK = 0; tryK < 400 && nc < Math.round(26 * many); tryK++) {
      const i = 1200 + Math.floor(rnd() * 200);
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 4 + rnd() * 28);
      const x = sx(i, lat);
      const z = sz(i, lat);
      if (clear(x, z) < KEEP + 1 || TY(x, z) < SEA + 0.8) continue;
      crack(x, z, 5 + rnd() * 10, 0.3 + rnd() * 0.35);
      nc++;
    }
    let nv = 0;
    for (let tryK = 0; tryK < 120 && nv < Math.round(5 * many); tryK++) {
      const i = 1200 + Math.floor(rnd() * 190);
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 6 + rnd() * 20);
      const x = sx(i, lat);
      const z = sz(i, lat);
      const y = site(x, z, 1.5, KEEP + 1, 3, SEA + 0.6);
      if (Number.isNaN(y)) continue;
      take(x, z, 1.5);
      vents.push(x, y + 0.3, z, 0.6);
      nv++;
    }
  }

  // =====================================================================================
  // 9. Auflage aufs Gelände: Sandstrand, Asche an der Flanke, Schlacke am Lavafeld, Kraterkessel
  // =====================================================================================
  const coast: number[] = []; // Uferpunkte: x, z, Richtung aufs Meer (nx, nz), offen (1) oder Bucht (0)
  {
    const cSand = rgb(0xead39c);
    const cSand2 = rgb(0xdcc28a);
    const cBlackSand = rgb(0x3a3438);
    const cSlag = rgb(0x262024);
    const cSlag2 = rgb(0x322a2d);
    const cAsh = rgb(0x8f888c);
    const cAsh2 = rgb(0xa29a9a);
    const cBurnt = rgb(0x5e5a3e);
    const cBowl = rgb(0x2c2226);
    const cBowlHot = rgb(0x6a2a1e);
    const ix0 = Math.max(1, Math.floor((minX - 70 - gx0) / cell));
    const ix1 = Math.min(gnx - 1, Math.ceil((maxX + 70 - gx0) / cell));
    const iz0 = Math.max(1, Math.floor((minZ - 70 - gz0) / cell));
    const iz1 = Math.min(gnz - 1, Math.ceil((maxZ + 70 - gz0) / cell));
    const W = ix1 - ix0 + 2;
    const gc = new Float32Array(W * (iz1 - iz0 + 2)).fill(NaN);
    const segAt = new Int32Array(W * (iz1 - iz0 + 2));
    const GC = (ix: number, iz: number): number => {
      const k = (iz - iz0) * W + (ix - ix0);
      if (Number.isNaN(gc[k])) {
        gc[k] = clear(gx0 + ix * cell, gz0 + iz * cell);
        segAt[k] = nearSeg;
      }
      return gc[k];
    };
    const colorOf = (cx: number, cz: number, mid: number, up: number, seg: number, dist: number): RGB | null => {
      const n1 = noise(cx * 0.05, cz * 0.05);
      const v = 0.94 + noise(cx * 0.3, cz * 0.3) * 0.12;
      if (cr) {
        const dc = Math.hypot(cx - cr.x, cz - cr.z);
        if (dc < cr.road - cr.wh - 2) return shade(mixRgb(cBowl, cBowlHot, smooth((lakeR + 7 - dc) / 7)), v);
      }
      const lavaZone = seg >= 0 && inRange(seg, 1195, 1372) && dist < 48;
      if (lavaZone) {
        if (mid < SEA + 2.2) return shade(cBlackSand, v);
        return shade(n1 > 0.5 ? cSlag : cSlag2, v);
      }
      if (mid > SEA - 0.6 && mid < 1.2 && up > 0.72) return shade(n1 > 0.55 ? cSand2 : cSand, v);
      if (seg >= 0 && inRange(seg, 552, 800) && dist < 46 && mid > 10) {
        if (n1 > 0.42) return shade(n1 > 0.62 ? cAsh2 : cAsh, v);
        if (mid < 17) return shade(cBurnt, v);
      }
      if (seg >= 0 && inRange(seg, 960, 1195) && dist < 40 && mid > 12 && n1 > 0.55) return shade(cAsh, v * 0.85);
      return null;
    };
    for (let iz = iz0; iz < iz1; iz++) {
      for (let ix = ix0; ix < ix1; ix++) {
        const a: V3 = [gx0 + ix * cell, GH(ix, iz), gz0 + iz * cell];
        const b: V3 = [gx0 + (ix + 1) * cell, GH(ix + 1, iz), gz0 + iz * cell];
        const c: V3 = [gx0 + (ix + 1) * cell, GH(ix + 1, iz + 1), gz0 + (iz + 1) * cell];
        const d: V3 = [gx0 + ix * cell, GH(ix, iz + 1), gz0 + (iz + 1) * cell];
        // Ufer: Kante vom Land ins Wasser.
        if ((a[1] - SEA) * (b[1] - SEA) < 0 || (a[1] - SEA) * (d[1] - SEA) < 0) {
          const e = (a[1] - SEA) * (b[1] - SEA) < 0 ? b : d;
          const f = (a[1] - SEA) / (a[1] - e[1]);
          const x = a[0] + (e[0] - a[0]) * f;
          const z = a[2] + (e[2] - a[2]) * f;
          // Richtung aufs Wasser: Gefälle.
          const gx = TY(x + 2, z) - TY(x - 2, z);
          const gz = TY(x, z + 2) - TY(x, z - 2);
          const gl = Math.hypot(gx, gz) || 1;
          const nx = -gx / gl;
          const nz = -gz / gl;
          if (clear(x, z) > KEEP + 1) {
            const open = TY(x + nx * 14, z + nz * 14) < SEA - 2 ? 1 : 0;
            coast.push(x, z, nx, nz, open);
          }
        }
        const cs = [GC(ix, iz), GC(ix + 1, iz), GC(ix + 1, iz + 1), GC(ix, iz + 1)];
        const tris: [V3, V3, V3, number, number][] = (ix + iz) % 2 === 0 ? [[a, d, c, 0, 3], [a, c, b, 0, 1]] : [[a, d, b, 0, 3], [b, d, c, 1, 2]];
        for (const [p, q, r, k0, k1] of tris) {
          const cmin = Math.min(cs[k0], cs[k1], cs[2], cs[0]);
          if (cmin < 0.4) continue;
          if (Math.max(p[1], q[1], r[1]) < SEA - 0.7) continue;
          const cx = (p[0] + q[0] + r[0]) / 3;
          const cz = (p[2] + q[2] + r[2]) / 3;
          const mid = (p[1] + q[1] + r[1]) / 3;
          const ux = q[0] - p[0];
          const uy = q[1] - p[1];
          const uz = q[2] - p[2];
          const vx = r[0] - p[0];
          const vy = r[1] - p[1];
          const vz = r[2] - p[2];
          const nx = uy * vz - uz * vy;
          const ny = uz * vx - ux * vz;
          const nz = ux * vy - uy * vx;
          const up = Math.abs(ny) / Math.hypot(nx, ny, nz);
          const k = (iz - iz0) * W + (ix - ix0);
          const col = colorOf(cx, cz, mid, up, segAt[k], gc[k]);
          if (!col) continue;
          drape.tri([p[0], p[1] + 0.06, p[2]], [q[0], q[1] + 0.06, q[2]], [r[0], r[1] + 0.06, r[2]], col);
        }
      }
    }
  }

  // =====================================================================================
  // 10. Bewegliches: Glocke, Fahnen, Wäsche, Leute, Boote, Fähre, Möwen, Schollen, Schalenkreuz
  // =====================================================================================
  // Schollen auf dem Lavasee
  const floes: number[] = []; // je Scholle: Teil, Kreisradius, Winkel, Winkelgeschw., Größe
  if (cr) {
    const nF = Math.round(14 * many);
    for (let k = 0; k < nF; k++) {
      const b = new MeshBuilder();
      const N = 5 + Math.floor(rnd() * 3);
      const r = 1;
      const pts: V3[] = [];
      for (let q = 0; q < N; q++) {
        const a = (q / N) * Math.PI * 2;
        const rr = r * (0.7 + rnd() * 0.5);
        pts.push([Math.cos(a) * rr, 0, Math.sin(a) * rr]);
      }
      const h = 0.35;
      const topC = rnd() < 0.5 ? rgb(0x2a1c1c) : rgb(0x3a2420);
      for (let q = 0; q < N; q++) {
        const p0 = pts[q];
        const p1 = pts[(q + 1) % N];
        b.quad([p1[0], -0.3, p1[2]], [p0[0], -0.3, p0[2]], [p0[0], h, p0[2]], [p1[0], h, p1[2]], rgb(0x5a2418));
        b.tri([0, h + 0.08, 0], [p1[0], h, p1[2]], [p0[0], h, p0[2]], topC);
      }
      const part = addPart(b);
      const ring = 4 + rnd() * Math.max(2, lakeR - 9);
      floes.push(part, ring, rnd() * Math.PI * 2, (0.03 + rnd() * 0.04) * (k % 3 === 0 ? -1 : 1), 1.6 + rnd() * 2);
    }
  }

  // Glocke
  let bellPart = -1;
  if (bellAt[1] !== 0) {
    const b = new MeshBuilder();
    // Glocke hängt am Ursprung (Drehpunkt), Öffnung unten.
    const N = 8;
    const prof: [number, number][] = [
      [0.12, -0.05],
      [0.42, -0.35],
      [0.5, -0.9],
      [0.7, -1.15],
    ];
    const cB = rgb(0xd8a23a);
    for (let j = 0; j + 1 < prof.length; j++) {
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * Math.PI * 2;
        const a1 = ((k + 1) / N) * Math.PI * 2;
        const P = (a: number, p: [number, number]): V3 => [Math.cos(a) * p[0], p[1], Math.sin(a) * p[0]];
        b.quad(P(a1, prof[j]), P(a0, prof[j]), P(a0, prof[j + 1]), P(a1, prof[j + 1]), shade(cB, 0.9 + (k % 2) * 0.12));
      }
    }
    b.box(0, -0.02, 0, 0.3, 0.12, 0.3, rgb(0x3a3440));
    b.box(0, -1.05, 0, 0.18, 0.3, 0.18, rgb(0x3a3440));
    bellPart = addPart(b);
  }
  // Schalenkreuz der Wetterstation
  let anemoPart = -1;
  if (anemo) {
    const b = new MeshBuilder();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      b.box(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35, 0.7, 0.05, 0.05, rgb(0x3a3440), -a);
      b.box(Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72, 0.22, 0.22, 0.22, rgb(0xd8402a), -a);
    }
    anemoPart = addPart(b);
  }

  // Tuch (Fahne, Wäsche): Streifen entlang lokaler x (0..L), Höhe h, beidseitig.
  const cloths: number[] = []; // Teil, x, y, z, Länge, Phase
  const clothPart = (L: number, h: number, colA: RGB, colB: RGB, stripes: number): number => {
    const b = new MeshBuilder();
    const N = 4;
    for (let k = 0; k < N; k++) {
      const x0 = (k / N) * L;
      const x1 = ((k + 1) / N) * L;
      for (let s = 0; s < stripes; s++) {
        const y0 = -h + (s / stripes) * h;
        const y1 = -h + ((s + 1) / stripes) * h;
        const c = s % 2 === 0 ? colA : colB;
        b.quad([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], c);
        b.quad([x1, y0, 0], [x0, y0, 0], [x0, y1, 0], [x1, y1, 0], shade(c, 0.85));
      }
    }
    return addPart(b, 0);
  };
  if (churchFlag[1] !== 0) cloths.push(clothPart(2.6, 1.5, rgb(0x2f6fd0), rgb(0xf6f1e6), 3), churchFlag[0], churchFlag[1], churchFlag[2], 2.6, 0);
  if (quayA && quayB) {
    // Fahnenmast an der Molenwurzel.
    const x = quayA[0] - quayDir[1] * 4;
    const z = quayA[2] + quayDir[0] * 4;
    if (clear(x, z) > KEEP + 0.5) {
      const y = TY(x, z);
      prism(st, x, y - 0.3, z, 0.12, 0.08, 7.8, 5, rgb(0xf6f1e6));
      cloths.push(clothPart(2.4, 1.4, rgb(0xd8402a), rgb(0xf0b02a), 2), x, y + 7.4, z, 2.4, 1.3);
    }
  }
  // Wäscheleinen zwischen zwei Pfosten im Dorf.
  {
    const cols = [rgb(0xf6f1e6), rgb(0xd8402a), rgb(0x2f6fd0), rgb(0xf0b02a), rgb(0x8ad0e0), rgb(0xe07aa8)];
    let n = 0;
    for (let tryK = 0; tryK < 200 && n < Math.round(4 * many + 0.5); tryK++) {
      const i = (1410 + Math.floor(rnd() * 190)) % t.n;
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + KEEP + 3 + rnd() * 12);
      const x = sx(i, lat);
      const z = sz(i, lat);
      const y = site(x, z, 3.4, KEEP, 1.2, 0.3);
      if (Number.isNaN(y)) continue;
      take(x, z, 3.4);
      const fx = t.tx[i];
      const fz = t.tz[i];
      for (const s of [-3, 3]) st.box(x + fx * s, y + 1.2, z + fz * s, 0.14, 2.6, 0.14, rgb(0x6a4228));
      // Leine
      const yl = y + 2.4;
      st.quad([x - fx * 3, yl, z - fz * 3], [x + fx * 3, yl, z + fz * 3], [x + fx * 3, yl + 0.04, z + fz * 3], [x - fx * 3, yl + 0.04, z - fz * 3], rgb(0xe0e0e0));
      for (let k = 0; k < 4; k++) {
        const s = -2.4 + k * 1.5;
        const L = 1.0 + rnd() * 0.3;
        cloths.push(clothPart(L, 0.9 + rnd() * 0.5, cols[Math.floor(rnd() * cols.length)], cols[Math.floor(rnd() * cols.length)], 1), x + fx * s, yl, z + fz * s, L, k * 0.9);
      }
      n++;
    }
  }

  // Leute: Rumpf (mit Kopf, Arm, Koffer) und zwei Beine; Blick nach +z.
  const cSkin = [rgb(0xe8b890), rgb(0xc08a60), rgb(0x8a5a3a)];
  const cCloth = [rgb(0x2f6fd0), rgb(0xd8402a), rgb(0x2a9a6a), rgb(0xf0b02a), rgb(0x6a4a8a), rgb(0xf6f1e6)];
  const personParts = (suitcase: boolean, pointing: boolean): [number, number, number, number] => {
    const skin = cSkin[Math.floor(rnd() * cSkin.length)];
    const shirt = cCloth[Math.floor(rnd() * cCloth.length)];
    const pants = rnd() < 0.5 ? rgb(0x2a3048) : rgb(0x5a4a3a);
    const b = new MeshBuilder();
    b.box(0, 1.25, 0, 0.62, 0.8, 0.36, shirt);
    b.box(0, 1.85, 0, 0.36, 0.38, 0.36, skin);
    b.box(0, 2.08, 0, 0.42, 0.12, 0.42, rnd() < 0.5 ? rgb(0x3a2a20) : rgb(0xd8c890));
    b.box(-0.4, 1.2, 0, 0.18, 0.7, 0.2, shirt);
    if (suitcase) {
      b.box(0.42, 1.15, 0, 0.16, 0.6, 0.18, shirt);
      b.box(0.5, 0.62, 0, 0.22, 0.5, 0.7, cHulls[Math.floor(rnd() * cHulls.length)]);
    } else if (!pointing) b.box(0.4, 1.2, 0, 0.18, 0.7, 0.2, shirt);
    const body = addPart(b);
    const leg = (): number => {
      const lb = new MeshBuilder();
      lb.box(0, -0.42, 0, 0.24, 0.84, 0.26, pants);
      lb.box(0, -0.8, 0.06, 0.26, 0.1, 0.36, rgb(0x2a2228));
      return addPart(lb);
    };
    const l = leg();
    const r = leg();
    let arm = -1;
    if (pointing) {
      const ab = new MeshBuilder();
      ab.box(0, 0, 0.4, 0.18, 0.2, 0.8, shirt);
      ab.box(0, 0, 0.88, 0.16, 0.16, 0.16, skin);
      arm = addPart(ab);
    }
    return [body, l, r, arm];
  };
  // Wege: von einer Tür auf der Meerseite zur Mole und auf ihr bis zur Fähre.
  const walkers: number[] = []; // body, l, r, Weg-Index, Geschwindigkeit, Phase
  const paths: V3[][] = [];
  const watchers: number[] = []; // body, l, r, arm, x, y, z, rot, Phase
  if (quayA && quayB) {
    for (const door of doorsSea) {
      // Weg frei von der Fahrbahn?
      let ok = true;
      const pts: V3[] = [];
      const L = Math.hypot(quayA[0] - door[0], quayA[2] - door[2]);
      for (let s = 0; s <= L; s += 2) {
        const f = s / L;
        const x = door[0] + (quayA[0] - door[0]) * f;
        const z = door[2] + (quayA[2] - door[2]) * f;
        if (clear(x, z) < KEEP) ok = false;
      }
      if (!ok || L > 120) continue;
      pts.push([door[0], TY(door[0], door[2]), door[2]]);
      pts.push([quayA[0], 1.3, quayA[2]]);
      pts.push([quayB[0] - quayDir[0] * 6 + quayDir[1] * 1.2, 1.3, quayB[2] - quayDir[1] * 6 - quayDir[0] * 1.2]);
      paths.push(pts);
      if (paths.length >= 4) break;
    }
    const nW = paths.length > 0 ? Math.round(8 * many) : 0;
    for (let k = 0; k < nW; k++) {
      const [body, l, r] = personParts(rnd() < 0.8, false);
      walkers.push(body, l, r, k % paths.length, 1.3 + rnd() * 0.6, rnd() * 100);
    }
    // Auf der Mole: Leute, die zum Berg zeigen.
    const nWatch = Math.round(5 * many);
    for (let k = 0; k < nWatch; k++) {
      const f = 0.15 + (k / Math.max(1, nWatch)) * 0.6;
      const side = k % 2 === 0 ? 1.6 : -1.6;
      const x = quayA[0] + (quayB[0] - quayA[0]) * f - quayDir[1] * side;
      const z = quayA[2] + (quayB[2] - quayA[2]) * f + quayDir[0] * side;
      const [body, l, r, arm] = personParts(false, k % 2 === 0);
      const toX = cr ? cr.x - x : 0;
      const toZ = cr ? cr.z - z : 1;
      watchers.push(body, l, r, arm, x, 1.3, z, face(toX, toZ) + (rnd() - 0.5) * 0.5, rnd() * 10);
    }
  }

  // Boote: in der Bucht und draußen auf See (schaukeln, kreisen langsam)
  const boats: number[] = []; // Teil, x, z, Kreisradius, Winkel, Geschw., Phase
  {
    const want = Math.round(5 * many);
    for (let tryK = 0; tryK < 400 && boats.length / 7 < want; tryK++) {
      const i = Math.floor(rnd() * 560);
      const j = (1400 + i) % t.n;
      const lat = seaSide * (t.wh[j] + 50 + rnd() * 90);
      const x = sx(j, lat);
      const z = sz(j, lat);
      const ring = 10 + rnd() * 18;
      let ok = TY(x, z) < SEA - 6 && clear(x, z) > 30;
      for (let a = 0; a < 6 && ok; a++) {
        const ax = x + Math.cos(a) * ring;
        const az = z + Math.sin(a) * ring;
        if (TY(ax, az) > SEA - 3 || clear(ax, az) < 26) ok = false;
      }
      for (let q = 0; q < boats.length && ok; q += 7) if (Math.hypot(x - boats[q + 1], z - boats[q + 2]) < 50) ok = false;
      if (!ok) continue;
      const b = new MeshBuilder();
      boatInto(b, (px, py, pz) => [px, py, pz], 6 + rnd() * 2, cHulls[Math.floor(rnd() * cHulls.length)], true);
      boats.push(addPart(b), x, z, ring, rnd() * Math.PI * 2, (0.05 + rnd() * 0.05) * (rnd() < 0.5 ? -1 : 1), rnd() * 10);
    }
  }
  // Fähre am Molenkopf
  let ferryPart = -1;
  let ferryAt: V3 = [0, 0, 0];
  let ferryRot = 0;
  let funnel: V3 = [0, 0, 0];
  if (quayA && quayB) {
    const b = new MeshBuilder();
    const L = 26;
    const W = 7;
    // Rumpf: Heck breit, Bug spitz (lokal +z = Bug).
    const ring = (y: number, k: number): V3[] => [[-W / 2 * k, y, -L / 2], [W / 2 * k, y, -L / 2], [W / 2 * k, y, L * 0.25], [0, y, L / 2], [-W / 2 * k, y, L * 0.25]];
    const lo = ring(-1.6, 0.8);
    const mid = ring(0.6, 1);
    const up = ring(2.4, 1.02);
    for (let k = 0; k < 5; k++) {
      const k2 = (k + 1) % 5;
      b.quad(lo[k], lo[k2], mid[k2], mid[k], rgb(0x2a3a6a));
      b.quad(mid[k], mid[k2], up[k2], up[k], rgb(0xf6f1e6));
    }
    b.tri(up[0], up[2], up[1], rgb(0xb0a89a));
    b.tri(up[0], up[4], up[2], rgb(0xb0a89a));
    b.tri(up[4], up[3], up[2], rgb(0xb0a89a));
    // Aufbauten mit Fensterband, Brücke, Schornstein.
    b.box(0, 3.6, -3, W * 0.8, 2.4, 13, rgb(0xf6f1e6));
    b.box(0, 3.6, -3, W * 0.82, 0.6, 12.6, rgb(0x24304a));
    b.box(0, 5.8, -1, W * 0.6, 2, 6, rgb(0xf6f1e6));
    b.box(0, 5.9, 2.05, W * 0.5, 0.6, 0.1, rgb(0x24304a));
    prism(b, 0, 4.8, -6.5, 1, 0.9, 3.4, 8, rgb(0xd8402a));
    prism(b, 0, 8.2, -6.5, 0.9, 0.9, 0.8, 8, rgb(0x22202a), 0, rgb(0x16131c));
    b.box(0, 4.9, 3.4, 0.14, 0.2, 0.14, rgb(0x3a3440));
    ferryPart = addPart(b);
    // Längsseits am Kopf der Mole, Bug seewärts.
    const side = 1;
    ferryRot = face(quayDir[0], quayDir[1]);
    ferryAt = [quayB[0] - quayDir[0] * 12 + quayDir[1] * (2.75 + W / 2 + 0.6) * side, SEA + 0.9, quayB[2] - quayDir[1] * 12 - quayDir[0] * (2.75 + W / 2 + 0.6) * side];
    const fP = XF(ferryAt[0], ferryAt[1], ferryAt[2], ferryRot);
    funnel = fP(0, 9.2, -6.5);
    // Gangway von der Mole zur Fähre (stehend).
    const g0 = XF(ferryAt[0], 0, ferryAt[2], ferryRot);
    const [gx, , gz] = g0(-(W / 2 + 1), 0, 2);
    st.box(gx, 1.7, gz, 2.2, 0.15, 1.4, rgb(0x8a8a90), ferryRot);
  }

  // Möwen: zwei Schwärme fliehen vom Berg aufs Meer.
  const gulls: number[] = []; // body, wingL, wingR, Schwarm, Versatz x, y, z, Phase
  const nFlock = 2;
  const flock = new Float32Array(nFlock * 6); // Start, Dauer, Richtung x, z, Pause bis, aktiv
  {
    const perFlock = detail === 0 ? 5 : 8;
    for (let f = 0; f < nFlock; f++) {
      for (let k = 0; k < perFlock; k++) {
        const b = new MeshBuilder();
        rock(b, 0, 0, 0, 0.32, 0.3, 0.9, rgb(0xf7f7f2));
        rock(b, 0, 0.12, 0.85, 0.22, 0.22, 0.25, rgb(0xffffff));
        b.tri([0, 0.1, 1.05], [-0.06, 0.08, 1.4], [0.06, 0.08, 1.4], rgb(0xffb21f));
        b.tri([0, 0.06, -0.7], [-0.25, 0.04, -1.25], [0.25, 0.04, -1.25], rgb(0xd9dde3));
        b.tri([0, 0.0, -0.7], [0.25, 0.04, -1.25], [-0.25, 0.04, -1.25], rgb(0xd9dde3));
        const body = addPart(b);
        const wing = (s: number): number => {
          const w = new MeshBuilder();
          const tip = rgb(0x2a2a33);
          const c = rgb(0xe8eaee);
          const A: V3 = [0, 0, 0.35];
          const B: V3 = [0, 0, -0.3];
          const C: V3 = [s * 1.3, 0, -0.1];
          const D: V3 = [s * 2.1, 0, -0.45];
          const E: V3 = [s * 1.3, 0, 0.25];
          if (s > 0) {
            w.tri(A, E, B, c);
            w.tri(B, E, C, c);
            w.tri(E, D, C, tip);
            w.tri(A, B, E, shade(c, 0.85));
            w.tri(B, C, E, shade(c, 0.85));
            w.tri(E, C, D, tip);
          } else {
            w.tri(A, B, E, c);
            w.tri(B, C, E, c);
            w.tri(E, C, D, tip);
            w.tri(A, E, B, shade(c, 0.85));
            w.tri(B, E, C, shade(c, 0.85));
            w.tri(E, D, C, tip);
          }
          return addPart(w, 0);
        };
        gulls.push(body, wing(1), wing(-1), f, (rnd() - 0.5) * 22, (rnd() - 0.5) * 7, (rnd() - 0.5) * 22, rnd() * 10);
      }
      flock[f * 6 + 4] = 3 + f * 9;
    }
  }

  // =====================================================================================
  // 11. Netze zusammenbauen
  // =====================================================================================
  const outlined: THREE.Mesh[] = [];
  const stMat = toonMaterial({ vertexColors: true });
  disposables.push(stMat);
  if (!st.empty) {
    const g = addSmoothNormals(st.build());
    const m = new THREE.Mesh(g, stMat);
    group.add(m);
    disposables.push(g);
    if (hi) {
      const ol = new THREE.Mesh(g, outlineMaterial(0.05));
      ol.name = 'outline';
      group.add(ol);
    }
    outlined.push(m);
  }
  if (!drape.empty) {
    const g = drape.build();
    const mat = toonMaterial({ vertexColors: true });
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -4;
    const m = new THREE.Mesh(g, mat);
    group.add(m);
    disposables.push(g, mat);
  }

  // Glut: A (bewegt) + B (Lava) + C (fest)
  // Brocken und Blasen als Teile in A.
  const nBombs = detail === 0 ? 4 : 8;
  const bombGeo = new THREE.IcosahedronGeometry(1, 0);
  const bombParts: number[] = [];
  for (let k = 0; k < nBombs; k++) {
    const [s, n] = glowPart(bombGeo, (f) => (f % 3 === 0 ? L_CRUST : f % 3 === 1 ? L_HOT : L_MID));
    bombParts.push(s, n);
  }
  bombGeo.dispose();
  const nBub = cr ? (detail === 0 ? 4 : 7) : 0;
  const bubGeo = new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
  const bubParts: number[] = [];
  {
    const p = bubGeo.getAttribute('position');
    for (let k = 0; k < nBub; k++) {
      const [s, n] = glowPart(bubGeo, (f) => {
        const y = p.getY(f * 3);
        return y > 0.75 ? L_WHITE : y > 0.35 ? L_HOT : L_MID;
      });
      bubParts.push(s, n);
    }
  }
  bubGeo.dispose();
  // Brandung: je Uferpunkt ein Schaumstreifen, der aufs Ufer zuläuft.
  const foamStart = gA.length / 3;
  const nFoam = coast.length / 5;
  for (let k = 0; k < nFoam; k++) {
    const c = rgb(0xf4f8fa);
    for (let q = 0; q < 6; q++) gAc.push(c[0], c[1], c[2], c[0], c[1], c[2], c[0], c[1], c[2]).valueOf();
    for (let q = 0; q < 18; q++) gA.push(0);
  }
  // gAc wurde je Schaum für 6 Ecken × 3 Werte = 18 Werte zu viel befüllt? – auf Länge kürzen.
  gAc.length = gA.length;

  const nA = gA.length / 3;
  const nBv = gB.length / 3;
  const nCv = gC.length / 3;
  const glowPos = new Float32Array((nA + nBv + nCv) * 3);
  const glowCol = new Float32Array((nA + nBv + nCv) * 3);
  glowPos.set(gA, 0);
  glowPos.set(gB, nA * 3);
  glowPos.set(gC, (nA + nBv) * 3);
  glowCol.set(gAc, 0);
  glowCol.set(gCc, (nA + nBv) * 3);
  const glowGeo = new THREE.BufferGeometry();
  const gPosAttr = new THREE.BufferAttribute(glowPos, 3);
  const gColAttr = new THREE.BufferAttribute(glowCol, 3);
  gPosAttr.setUsage(THREE.DynamicDrawUsage);
  gColAttr.setUsage(THREE.DynamicDrawUsage);
  glowGeo.setAttribute('position', gPosAttr);
  glowGeo.setAttribute('color', gColAttr);
  glowGeo.computeBoundingSphere();
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.frustumCulled = false;
  group.add(glowMesh);
  disposables.push(glowGeo, glowMat);
  const nLavaFaces = fKind.length;

  // Bewegliches
  const nM = mL.length / 3;
  const mPos = new Float32Array(Math.max(3, nM * 3));
  const mNor = new Float32Array(Math.max(3, nM * 3));
  const mOn = new Float32Array(Math.max(3, nM * 3));
  const mCol = new Float32Array(Math.max(3, nM * 3));
  mCol.set(mC);
  mNor.set(mN);
  mOn.set(mO);
  const moverGeo = new THREE.BufferGeometry();
  const mvPosAttr = new THREE.BufferAttribute(mPos, 3);
  const mvNorAttr = new THREE.BufferAttribute(mNor, 3);
  const mvOnAttr = new THREE.BufferAttribute(mOn, 3);
  for (const a of [mvPosAttr, mvNorAttr, mvOnAttr]) a.setUsage(THREE.DynamicDrawUsage);
  moverGeo.setAttribute('position', mvPosAttr);
  moverGeo.setAttribute('normal', mvNorAttr);
  moverGeo.setAttribute('onormal', mvOnAttr);
  moverGeo.setAttribute('color', new THREE.BufferAttribute(mCol, 3));
  const moverMesh = new THREE.Mesh(moverGeo, stMat);
  moverMesh.frustumCulled = false;
  group.add(moverMesh);
  disposables.push(moverGeo);
  if (hi && nM > 0) {
    const ol = new THREE.Mesh(moverGeo, outlineMaterial(0.04));
    ol.name = 'outline';
    ol.frustumCulled = false;
    group.add(ol);
  }

  // Aschesäule: kantige Ballen (Instanzen) mit Kontur.
  const nSmoke = cr ? (detail === 0 ? 22 : 40) : 0;
  const smokeGeo = addSmoothNormals(new THREE.IcosahedronGeometry(1, 0));
  const smokeMat = toonMaterial({});
  const smoke = new THREE.InstancedMesh(smokeGeo, smokeMat, Math.max(1, nSmoke));
  smoke.frustumCulled = false;
  group.add(smoke);
  disposables.push(smokeGeo, smokeMat, smoke);
  if (hi && nSmoke > 0) {
    const ol = new THREE.InstancedMesh(smokeGeo, outlineMaterial(0.14), nSmoke);
    ol.instanceMatrix = smoke.instanceMatrix;
    ol.frustumCulled = false;
    ol.name = 'outline';
    group.add(ol);
    disposables.push(ol);
  }
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const ashA = new THREE.Color(0x4a3e48);
  const ashB = new THREE.Color(0x6e6068);
  const ashC = new THREE.Color(0x8a7c80);
  const ashHot = new THREE.Color(0xd0623a);
  const tmpC = new THREE.Color();
  // Je Ballen: Geburt, Lebensdauer, Startversatz x, z, Steiggeschw., Größe, Farbe 0..1, Drehung
  const sm = new Float32Array(Math.max(1, nSmoke) * 8);
  for (let k = 0; k < nSmoke; k++) {
    sm[k * 8] = -1e9;
    smoke.setMatrixAt(k, zero);
    smoke.setColorAt(k, ashA);
  }
  let smokeT = 0;

  // =====================================================================================
  // 12. Lauf
  // =====================================================================================
  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const eu = new THREE.Euler(0, 0, 0, 'YXZ');
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  /** Schreibt Teil p mit Lage (x, y, z), Drehung (yaw, pitch, roll) und Maßstab s ins bewegliche Netz. */
  const place = (p: number, x: number, y: number, z: number, yaw: number, pitch: number, roll: number, s: number): void => {
    eu.set(pitch, yaw, roll);
    q4.setFromEuler(eu);
    m4.compose(pv.set(x, y, z), q4, sv.set(s, s, s));
    const e = m4.elements;
    const a = parts[p * 2];
    const n = parts[p * 2 + 1];
    const inv = s > 1e-6 ? 1 / s : 0;
    for (let k = a * 3; k < (a + n) * 3; k += 3) {
      const lx = mL[k];
      const ly = mL[k + 1];
      const lz = mL[k + 2];
      mPos[k] = e[0] * lx + e[4] * ly + e[8] * lz + e[12];
      mPos[k + 1] = e[1] * lx + e[5] * ly + e[9] * lz + e[13];
      mPos[k + 2] = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
      const nx = mN[k];
      const ny = mN[k + 1];
      const nz = mN[k + 2];
      mNor[k] = (e[0] * nx + e[4] * ny + e[8] * nz) * inv;
      mNor[k + 1] = (e[1] * nx + e[5] * ny + e[9] * nz) * inv;
      mNor[k + 2] = (e[2] * nx + e[6] * ny + e[10] * nz) * inv;
      const ox = mO[k];
      const oy = mO[k + 1];
      const oz = mO[k + 2];
      mOn[k] = (e[0] * ox + e[4] * oy + e[8] * oz) * inv;
      mOn[k + 1] = (e[1] * ox + e[5] * oy + e[9] * oz) * inv;
      mOn[k + 2] = (e[2] * ox + e[6] * oy + e[10] * oz) * inv;
    }
  };
  const hide = (p: number): void => place(p, 0, -200, 0, 0, 0, 0, 0);
  /** Teil in A (Glut) verschieben und skalieren. */
  const placeGlow = (start: number, n: number, x: number, y: number, z: number, sxv: number, syv: number, szv: number, yaw: number): void => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (let k = start * 3; k < (start + n) * 3; k += 3) {
      const lx = gA[k] * sxv;
      const lz = gA[k + 2] * szv;
      glowPos[k] = x + lx * c + lz * s;
      glowPos[k + 1] = y + gA[k + 1] * syv;
      glowPos[k + 2] = z - lx * s + lz * c;
    }
  };

  // Zustand des Bergs
  let erStart = -1e9;
  let erNext = 4;
  let heat = 0.3;
  let flash = 0;
  const bomb = new Float32Array(nBombs * 8); // aktiv, t0, x0, z0, vx, vy, vz, Größe
  let bombsLeft = 0;
  let bombT = 0;
  const bub = new Float32Array(Math.max(1, nBub) * 4); // x, z, Zyklus, Größe
  const bubCyc = new Int32Array(Math.max(1, nBub)).fill(-1);
  let ventT = 0;
  let surfT = 0;
  let ashT = 0;
  let steamT = 0;
  let sparkT = 0;
  let hornNext = 6;
  let hornLeft = 0;
  let hornT = 0;
  const lavaCol: RGB[] = [L_CRUST, L_DARK, L_MID, L_HOT, L_WHITE];

  const startEruption = (time: number): void => {
    erStart = time;
    erNext = time + 20 + rnd() * 10;
    bombsLeft = nBombs;
    bombT = RUMBLE;
  };

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink): void {
      // --- Schub des Bergs ---
      if (cr && time >= erNext) startEruption(time);
      const tau = time - erStart;
      let target = 0.3 + 0.05 * Math.sin(time * 0.7);
      flash = 0;
      if (tau < RUMBLE) target = 0.3 + 0.4 * (tau / RUMBLE) + 0.15 * Math.sin(tau * 14) * (tau / RUMBLE);
      else if (tau < RUMBLE + BLAST) {
        target = 1;
        const k = tau - RUMBLE;
        flash = Math.max(0, 1 - k / 1.6) * (0.65 + 0.35 * Math.sin(k * 31));
      } else if (tau < RUMBLE + BLAST + TAIL) target = 1 - 0.7 * ((tau - RUMBLE - BLAST) / TAIL);
      heat += (target - heat) * Math.min(1, dt * 3);
      world.hemi.intensity = hemiBase + 0.25 * flash;

      if (cr) {
        // --- Lavasee, Graben, Ströme: Farben fließen ---
        const off = nA * 3;
        for (let f = 0; f < nLavaFaces; f++) {
          const kind = fKind[f];
          const o = off + f * 9;
          let c: RGB;
          if (kind === 1) {
            const cx = glowPos[o];
            const cz = glowPos[o + 2];
            const n = noise(cx * 0.11 + time * 0.07, cz * 0.11 - time * 0.05) * 0.85 + 0.15 * Math.sin(time * 1.7 + fO[f]) + heat * 0.3;
            c = n < 0.42 ? L_DARK : n < 0.68 ? L_MID : n < 0.9 ? L_HOT : L_WHITE;
          } else if (kind === 2) {
            const ph = fS[f] * 0.045 - time * (0.16 + heat * 0.12) + fO[f] * 0.12;
            const k = ph - Math.floor(ph);
            c = k < 0.18 ? L_CRUST : k < 0.42 ? L_DARK : k < 0.85 ? L_MID : L_HOT;
          } else {
            const p = Math.sin(time * 1.3 + fO[f] + fS[f] * 0.5);
            c = p > 0.55 ? L_HOT : p > -0.3 ? L_MID : L_DARK;
          }
          for (let k = 0; k < 9; k += 3) {
            glowCol[o + k] = c[0];
            glowCol[o + k + 1] = c[1];
            glowCol[o + k + 2] = c[2];
          }
        }
        gColAttr.clearUpdateRanges();
        gColAttr.addUpdateRange(off, nLavaFaces * 9);
        gColAttr.needsUpdate = true;

        // --- Glutbrocken: steigen in hohem Bogen und fallen in den See zurück ---
        if (bombsLeft > 0 && tau >= bombT) {
          bombT += 0.3;
          bombsLeft--;
          for (let b = 0; b < nBombs; b++) {
            if (bomb[b * 8] > 0) continue;
            const a = rnd() * Math.PI * 2;
            const r0 = rnd() * 4;
            const x0 = cr.x + Math.cos(a) * r0;
            const z0 = cr.z + Math.sin(a) * r0;
            const a2 = rnd() * Math.PI * 2;
            const r1 = rnd() * lakeR * 0.75;
            const apex = 22 + rnd() * 26;
            const vy = Math.sqrt(2 * BOMB_G * apex);
            const T = (2 * vy) / BOMB_G;
            bomb.set([1, time, x0, z0, (cr.x + Math.cos(a2) * r1 - x0) / T, vy, (cr.z + Math.sin(a2) * r1 - z0) / T, 1.2 + rnd() * 1.1], b * 8);
            break;
          }
        }
        for (let b = 0; b < nBombs; b++) {
          const o = b * 8;
          const s0 = bombParts[b * 2];
          const n0 = bombParts[b * 2 + 1];
          if (bomb[o] <= 0) {
            placeGlow(s0, n0, cr.x, lakeY - 20, cr.z, 0, 0, 0, 0);
            continue;
          }
          const tt = time - bomb[o + 1];
          const T = (2 * bomb[o + 5]) / BOMB_G;
          const x = bomb[o + 2] + bomb[o + 4] * tt;
          const y = lakeY + 0.5 + bomb[o + 5] * tt - 0.5 * BOMB_G * tt * tt;
          const z = bomb[o + 3] + bomb[o + 6] * tt;
          if (tt >= T || tt < 0) {
            bomb[o] = 0;
            placeGlow(s0, n0, cr.x, lakeY - 20, cr.z, 0, 0, 0, 0);
            if (tt < T + 1) {
              for (let k = 0; k < 5; k++) {
                const a = rnd() * Math.PI * 2;
                fx.spark(x, lakeY + 0.6, z, Math.cos(a) * 4, 8 + rnd() * 8, Math.sin(a) * 4, 0.9, 1.4 + rnd(), rnd() < 0.5 ? 0xffe27a : 0xff8a2a, 14);
              }
              fx.puff(x, lakeY + 1.2, z, 0, 3, 0, 2.2, 2.6, 0x5a4048, 2, -1.5);
            }
            continue;
          }
          const s = bomb[o + 7];
          placeGlow(s0, n0, x, y, z, s, s * 0.85, s, tt * 3 + b);
          if (hi && (Math.floor(tt * 12) !== Math.floor((tt - dt) * 12))) fx.spark(x, y, z, 0, 0, 0, 0.8, s * 1.1, 0xff8a2a, -1);
        }

        // --- Blasen: wachsen, platzen ---
        for (let b = 0; b < nBub; b++) {
          const per = 3.2 + (b % 3) * 0.9;
          const cyc = (time + b * 1.37) / per;
          const n = Math.floor(cyc);
          const k = cyc - n;
          if (bubCyc[b] !== n) {
            if (bubCyc[b] >= 0 && Math.abs(bub[b * 4] - cam.x) + Math.abs(bub[b * 4 + 1] - cam.z) < 260) {
              for (let s = 0; s < 4; s++) {
                const a = rnd() * Math.PI * 2;
                fx.spark(bub[b * 4], lakeY + 0.5, bub[b * 4 + 1], Math.cos(a) * 2.5, 7 + rnd() * 6 + heat * 6, Math.sin(a) * 2.5, 1, 1.3, rnd() < 0.5 ? 0xffe27a : 0xff9a1f, 12);
              }
            }
            bubCyc[b] = n;
            const a = rnd() * Math.PI * 2;
            const r = Math.sqrt(rnd()) * (lakeR - 4);
            bub[b * 4] = cr.x + Math.cos(a) * r;
            bub[b * 4 + 1] = cr.z + Math.sin(a) * r;
            bub[b * 4 + 3] = 1.2 + rnd() * 1.8;
          }
          const sz0 = k < 0.8 ? bub[b * 4 + 3] * Math.pow(k / 0.8, 0.6) : 0;
          placeGlow(bubParts[b * 2], bubParts[b * 2 + 1], bub[b * 4], lakeY - 0.15, bub[b * 4 + 1], sz0, sz0 * 0.8, sz0, 0);
        }

        // --- Aschesäule ---
        smokeT -= dt;
        const interval = (detail === 0 ? 0.85 : 0.5) * (heat > 0.7 ? 0.6 : 1);
        if (smokeT <= 0) {
          smokeT = interval;
          for (let k = 0; k < nSmoke; k++) {
            const o = k * 8;
            if (time - sm[o] < sm[o + 1]) continue;
            sm[o] = time;
            sm[o + 1] = 15 + rnd() * 5;
            const a = rnd() * Math.PI * 2;
            const r = rnd() * 5;
            sm[o + 2] = cr.x + Math.cos(a) * r;
            sm[o + 3] = cr.z + Math.sin(a) * r;
            sm[o + 4] = 5 + rnd() * 2.5 + heat * 6;
            sm[o + 5] = 3.5 + rnd() * 2 + heat * 2.5;
            sm[o + 6] = rnd();
            sm[o + 7] = rnd() * 6;
            break;
          }
        }
        for (let k = 0; k < nSmoke; k++) {
          const o = k * 8;
          const age = time - sm[o];
          const life = sm[o + 1];
          if (age < 0 || age >= life) {
            smoke.setMatrixAt(k, zero);
            continue;
          }
          const drift = Math.pow(age, 1.5) * 0.33;
          const x = sm[o + 2] + windX * drift + Math.sin(age * 0.4 + k) * 1.5;
          const z = sm[o + 3] + windZ * drift + Math.cos(age * 0.35 + k) * 1.5;
          const y = lakeY + 2 + sm[o + 4] * (age - (age * age) / 50);
          let s = sm[o + 5] + age * 1.05;
          if (age < 0.8) s *= age / 0.8;
          if (age > life - 1.6) s *= Math.max(0, (life - age) / 1.6);
          eu.set(age * 0.05 + sm[o + 7], sm[o + 7] + age * 0.08, 0);
          q4.setFromEuler(eu);
          m4.compose(pv.set(x, y, z), q4, sv.set(s, s * 0.85, s));
          smoke.setMatrixAt(k, m4);
          const shadeK = sm[o + 6];
          tmpC.copy(shadeK < 0.4 ? ashA : shadeK < 0.75 ? ashB : ashC);
          const glowK = Math.max(0, 1 - age / 3.5) * (0.35 + heat * 0.65);
          if (glowK > 0) tmpC.lerp(ashHot, glowK);
          smoke.setColorAt(k, tmpC);
        }
        smoke.instanceMatrix.needsUpdate = true;
        if (smoke.instanceColor) smoke.instanceColor.needsUpdate = true;

        // Funken aus dem See, im Schub eine Fontäne.
        sparkT -= dt;
        while (sparkT <= 0) {
          sparkT += heat > 0.7 ? (hi ? 0.05 : 0.09) : hi ? 0.35 : 0.6;
          const a = rnd() * Math.PI * 2;
          const r = rnd() * 6;
          const s = 2 + rnd() * 5;
          fx.spark(cr.x + Math.cos(a) * r, lakeY + 1, cr.z + Math.sin(a) * r, Math.cos(a) * s, 10 + rnd() * 12 + heat * 14, Math.sin(a) * s, 1.4, 1.6 + rnd() * 1.6 + heat, rnd() < 0.4 ? 0xfff2b0 : rnd() < 0.5 ? 0xffb52e : 0xff6a1f, 9);
        }
      }
      if (cr) gPosAttr.clearUpdateRanges();

      // --- Brandung: Schaumstreifen laufen aufs Ufer, an offenen Stellen spritzt Gischt ---
      for (let k = 0; k < nFoam; k++) {
        const o = k * 5;
        const ph = (time / SURF + coast[o] * 0.013 + coast[o + 1] * 0.017) % 1;
        const vis = ph < 0.65;
        const run = (1 - ph / 0.65) * 5 + 0.3;
        const x = coast[o] + coast[o + 2] * run;
        const z = coast[o + 1] + coast[o + 3] * run;
        const y = vis ? SEA + 0.08 : SEA - 3;
        const w = 3.2;
        const d = 0.9 + (1 - ph) * 0.8;
        const tx = -coast[o + 3] * w;
        const tz = coast[o + 2] * w;
        const nx = coast[o + 2] * d;
        const nz = coast[o + 3] * d;
        const base = (foamStart + k * 6) * 3;
        // zwei Dreiecke: (−t−n), (+t−n), (+t+n) / (−t−n), (+t+n), (−t+n)
        const put = (q: number, px: number, pz: number): void => {
          glowPos[base + q * 3] = px;
          glowPos[base + q * 3 + 1] = y;
          glowPos[base + q * 3 + 2] = pz;
        };
        put(0, x - tx - nx, z - tz - nz);
        put(1, x + tx + nx, z + tz + nz);
        put(2, x + tx - nx, z + tz - nz);
        put(3, x - tx - nx, z - tz - nz);
        put(4, x - tx + nx, z - tz + nz);
        put(5, x + tx + nx, z + tz + nz);
      }
      surfT -= dt;
      if (surfT <= 0 && nFoam > 0) {
        surfT = hi ? 0.12 : 0.25;
        // Gischt an einer offenen Stelle nahe der Kamera.
        for (let tries = 0; tries < 6; tries++) {
          const k = Math.floor(rnd() * nFoam);
          const o = k * 5;
          if (!coast[o + 4]) continue;
          if (Math.abs(coast[o] - cam.x) + Math.abs(coast[o + 1] - cam.z) > 170) continue;
          const ph = (time / SURF + coast[o] * 0.013 + coast[o + 1] * 0.017) % 1;
          if (ph < 0.55 || ph > 0.75) continue;
          for (let s = 0; s < 3; s++) fx.puff(coast[o] + (rnd() - 0.5) * 3, SEA + 0.6, coast[o + 1] + (rnd() - 0.5) * 3, coast[o + 2] * -1.5, 5 + rnd() * 4, coast[o + 3] * -1.5, 1.1, 1.4 + rnd(), 0xffffff, 1.2, 8);
          break;
        }
      }
      gPosAttr.clearUpdateRanges();
      gPosAttr.addUpdateRange(0, nA * 3);
      gPosAttr.needsUpdate = true;

      // --- Dampf: Fumarolen, Mündung des Lavastroms, Fähre ---
      ventT -= dt;
      if (ventT <= 0) {
        ventT = hi ? 0.35 : 0.7;
        for (let k = 0; k < vents.length; k += 4) {
          if (Math.abs(vents[k] - cam.x) + Math.abs(vents[k + 2] - cam.z) > 220) continue;
          if (rnd() > 0.6) continue;
          fx.puff(vents[k] + (rnd() - 0.5), vents[k + 1], vents[k + 2] + (rnd() - 0.5), windX * 1.2, 2.5 + rnd() * 2, windZ * 1.2, 3.2, 1.4 * vents[k + 3] + rnd() * 0.8, rnd() < 0.6 ? 0xf0ece8 : 0xd8d0cc, 1.4, -0.6);
        }
      }
      steamT -= dt;
      if (streamMouth && steamT <= 0) {
        steamT = hi ? 0.18 : 0.36;
        const [mx, , mz] = streamMouth;
        if (Math.abs(mx - cam.x) + Math.abs(mz - cam.z) < 320) {
          fx.puff(mx + (rnd() - 0.5) * 7, SEA + 0.8, mz + (rnd() - 0.5) * 7, windX * 2 + (rnd() - 0.5) * 2, 4 + rnd() * 3, windZ * 2, 3.6, 2.4 + rnd() * 2, rnd() < 0.7 ? 0xf6f2ee : 0xc8bcc0, 2.2, -1.2);
          if (rnd() < 0.3) fx.spark(mx, SEA + 0.6, mz, (rnd() - 0.5) * 3, 5 + rnd() * 4, (rnd() - 0.5) * 3, 0.8, 0.9, 0xffb52e, 12);
        }
      }
      // Fähre tutet: drei Dampfstöße.
      if (ferryPart >= 0) {
        if (time >= hornNext) {
          hornNext = time + 14 + rnd() * 6;
          hornLeft = 3;
          hornT = 0;
        }
        if (hornLeft > 0) {
          hornT -= dt;
          if (hornT <= 0) {
            hornT = 0.45;
            hornLeft--;
            for (let s = 0; s < 3; s++) fx.puff(funnel[0], funnel[1] + 0.5, funnel[2], windX * 1.5 + (rnd() - 0.5), 5 + rnd() * 2, windZ * 1.5, 2.2, 1.4 + s * 0.4, 0xffffff, 1.6, -0.8);
          }
        }
      }

      // --- Ascheflocken um die Kamera (nur hohe Qualität), in der Höhe dichter ---
      if (detail === 2) {
        ashT -= dt;
        const rate = 0.6 + Math.max(0, cam.y) * 0.18 + heat * 2;
        while (ashT <= 0) {
          ashT += 1 / rate;
          const a = rnd() * Math.PI * 2;
          const d = 6 + rnd() * 30;
          fx.puff(cam.x + Math.cos(a) * d, cam.y + 4 + rnd() * 10, cam.z + Math.sin(a) * d, windX * 1.5, -1.2, windZ * 1.5, 3.5, 0.22 + rnd() * 0.18, rnd() < 0.5 ? 0x4a4248 : 0x7a7074, 0, 0.3);
        }
      }

      // --- Bewegliches ---
      for (let k = 0; k < floes.length; k += 5) {
        const a = floes[k + 2] + time * floes[k + 3];
        const r = floes[k + 1];
        place(floes[k], cr!.x + Math.cos(a) * r, lakeY + 0.05 + Math.sin(time * 0.8 + k) * 0.06, cr!.z + Math.sin(a) * r, a * 0.6 + k, 0, 0, floes[k + 4]);
      }
      if (bellPart >= 0) place(bellPart, bellAt[0], bellAt[1], bellAt[2], 0.3, 0, Math.sin(time * 3.6) * 0.55, 1);
      if (anemoPart >= 0 && anemo) place(anemoPart, anemo[0], anemo[1], anemo[2], time * 5.5, 0, 0, 1);
      // Tücher: nach Windrichtung, in Wellen.
      const windYaw = Math.atan2(-windZ, windX);
      const cw = Math.cos(windYaw);
      const sw = Math.sin(windYaw);
      for (let k = 0; k < cloths.length; k += 6) {
        const p = cloths[k];
        const ox = cloths[k + 1];
        const oy = cloths[k + 2];
        const oz = cloths[k + 3];
        const L = cloths[k + 4];
        const ph = cloths[k + 5];
        const a = parts[p * 2];
        const n = parts[p * 2 + 1];
        for (let v = a * 3; v < (a + n) * 3; v += 3) {
          const lx = mL[v];
          const ly = mL[v + 1];
          const side = mL[v + 2] + Math.sin(time * 7 + ph - lx * 2.4) * 0.35 * (lx / L) * (1 + heat * 0.5);
          mPos[v] = ox + lx * cw + side * sw;
          mPos[v + 1] = oy + ly - (lx / L) * 0.2;
          mPos[v + 2] = oz - lx * sw + side * cw;
        }
      }
      // Leute: laufen mit Koffern zum Hafen; am Ende verschwinden sie an Bord.
      for (let k = 0; k < walkers.length; k += 6) {
        const path = paths[walkers[k + 3]];
        const v = walkers[k + 4];
        let total = 0;
        for (let q = 0; q + 1 < path.length; q++) total += Math.hypot(path[q + 1][0] - path[q][0], path[q + 1][2] - path[q][2]);
        let d = ((time + walkers[k + 5]) * v) % (total + 6);
        const visible = d < total;
        let x = path[0][0];
        let y = path[0][1];
        let z = path[0][2];
        let yaw = 0;
        for (let q = 0; q + 1 < path.length; q++) {
          const a = path[q];
          const b = path[q + 1];
          const l = Math.hypot(b[0] - a[0], b[2] - a[2]);
          yaw = face(b[0] - a[0], b[2] - a[2]);
          if (d <= l || q + 2 === path.length) {
            const f = Math.min(1, d / l);
            x = a[0] + (b[0] - a[0]) * f;
            y = a[1] + (b[1] - a[1]) * f;
            z = a[2] + (b[2] - a[2]) * f;
            break;
          }
          d -= l;
        }
        if (!visible) {
          hide(walkers[k]);
          hide(walkers[k + 1]);
          hide(walkers[k + 2]);
          continue;
        }
        // seitlicher Versatz je Person, damit sie nicht hintereinander laufen
        const lane = ((k / 6) % 3) - 1;
        x += Math.cos(yaw) * lane * 0.9;
        z -= Math.sin(yaw) * lane * 0.9;
        const step = Math.sin((time + walkers[k + 5]) * v * 4.2);
        const bob = Math.abs(step) * 0.08;
        place(walkers[k], x, y + bob, z, yaw, 0.08, 0, 1);
        const cy = Math.cos(yaw);
        const syw = Math.sin(yaw);
        place(walkers[k + 1], x - cy * 0.17, y + 0.88 + bob, z + syw * 0.17, yaw, step * 0.6, 0, 1);
        place(walkers[k + 2], x + cy * 0.17, y + 0.88 + bob, z - syw * 0.17, yaw, -step * 0.6, 0, 1);
      }
      for (let k = 0; k < watchers.length; k += 9) {
        const x = watchers[k + 4];
        const y = watchers[k + 5];
        const z = watchers[k + 6];
        const yaw = watchers[k + 7];
        const ph = watchers[k + 8];
        place(watchers[k], x, y, z, yaw + Math.sin(time * 0.6 + ph) * 0.15, 0, 0, 1);
        const cy = Math.cos(yaw);
        const syw = Math.sin(yaw);
        place(watchers[k + 1], x - cy * 0.17, y + 0.88, z + syw * 0.17, yaw, 0, 0, 1);
        place(watchers[k + 2], x + cy * 0.17, y + 0.88, z - syw * 0.17, yaw, 0, 0, 1);
        if (watchers[k + 3] >= 0) place(watchers[k + 3], x + cy * 0.42, y + 1.5, z - syw * 0.42, yaw, -0.9 - Math.sin(time * 2.2 + ph) * 0.25, 0, 1);
      }
      for (let k = 0; k < boats.length; k += 7) {
        const a = boats[k + 4] + time * boats[k + 5];
        const r = boats[k + 3];
        const x = boats[k + 1] + Math.cos(a) * r;
        const z = boats[k + 2] + Math.sin(a) * r;
        const yaw = face(-Math.sin(a) * Math.sign(boats[k + 5]), Math.cos(a) * Math.sign(boats[k + 5]));
        place(boats[k], x, SEA + 0.15 + Math.sin(time * 1.3 + boats[k + 6]) * 0.15, z, yaw, Math.sin(time * 1.1 + boats[k + 6]) * 0.06, Math.sin(time * 1.6 + boats[k + 6]) * 0.09, 1);
      }
      if (ferryPart >= 0) place(ferryPart, ferryAt[0], ferryAt[1] + Math.sin(time * 0.9) * 0.08, ferryAt[2], ferryRot, Math.sin(time * 0.7) * 0.012, Math.sin(time * 0.8) * 0.02, 1);
      // Möwen
      for (let f = 0; f < nFlock; f++) {
        const o = f * 6;
        if (flock[o + 5] === 0 && time >= flock[o + 4] && cr) {
          flock[o] = time;
          flock[o + 1] = 24 + rnd() * 6;
          const a = rnd() * Math.PI * 2;
          flock[o + 2] = Math.cos(a);
          flock[o + 3] = Math.sin(a);
          flock[o + 5] = 1;
        }
        const u = (time - flock[o]) / flock[o + 1];
        if (flock[o + 5] === 1 && u >= 1) {
          flock[o + 5] = 0;
          flock[o + 4] = time + 4 + rnd() * 8;
        }
      }
      for (let k = 0; k < gulls.length; k += 8) {
        const f = gulls[k + 3];
        const o = f * 6;
        if (flock[o + 5] === 0 || !cr) {
          hide(gulls[k]);
          hide(gulls[k + 1]);
          hide(gulls[k + 2]);
          continue;
        }
        const u = (time - flock[o]) / flock[o + 1];
        const dist = u * 300;
        const dx = flock[o + 2];
        const dz = flock[o + 3];
        const wig = Math.sin(u * 6 + f) * 12;
        const x = cr.x + dx * dist - dz * wig + gulls[k + 4];
        const z = cr.z + dz * dist + dx * wig + gulls[k + 6];
        const y = 66 - 22 * u + gulls[k + 5] + Math.sin(time * 1.3 + gulls[k + 7]) * 0.8;
        const yaw = face(dx, dz);
        const s = 2.1 * Math.min(1, u * 8);
        const flap = Math.sin(time * 9 + gulls[k + 7]) * 0.7;
        place(gulls[k], x, y, z, yaw, 0, 0, s);
        place(gulls[k + 1], x, y + 0.1 * s, z, yaw, 0, flap, s);
        place(gulls[k + 2], x, y + 0.1 * s, z, yaw, 0, -flap, s);
      }
      mvPosAttr.needsUpdate = true;
      mvNorAttr.needsUpdate = true;
      mvOnAttr.needsUpdate = true;
    },
    dispose(): void {
      world.hemi.intensity = hemiBase;
      for (const d of disposables) d.dispose();
      void outlined;
    },
  };
}

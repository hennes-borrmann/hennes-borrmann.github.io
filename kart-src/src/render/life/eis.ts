// Eiszapfen-Pass lebt: rund um die Strecke stehen große Gipfel mit Fels- und
// Eisflanken, an den Hängen verschneite Tannen und Lärchen, Felsnadeln, Blöcke
// und Schneewechten. Am Start die Passhütte (Schneedach, rauchender Kamin,
// Holzstapel, Skier, Fahnen), an den Lawinenstrichen ein Hang mit Rinne und
// Verbauung (Schneezäune, Stützwerke) und Warntafeln, am Grat Gipfelkreuz und
// Steinmännchen über Wolkenfetzen, an der Eishöhle Gletschertore mit großen
// Zapfen, am zugefrorenen See Schilf, Eisfischer-Hütten, Fähnchen und ein
// eingefrorenes Ruderboot, an der Bobbahn Holzverschalung, Zeitmess-Tor,
// Flutlicht, Fahnenketten und eine Tribüne mit Zuschauern, an der Schlucht
// Felswände und eine Hängebrücke.
// Bewegt: Gondelbahn quer über das Tal, Sessellift, Pistenraupe mit Licht,
// Dohlen im Aufwind, Schneefall in Kameranähe (nur hohe Qualität), wehende
// Fahnen, ziehende Wolkenfetzen, Rauch aus Kamin und Ofenrohren.
//
// Reine Kulisse: alles wird mit festem Zufall aus der Strecke abgeleitet und
// hält Abstand – mindestens RAND Meter neben jeder Fahrbahnkante (auch an der
// Abzweigung), über einer Fahrbahn nichts unter LUFT Metern. Die Lawinenstreifen
// samt Rinne (mechanics/snow.ts) und die Schubstreifen auf dem See bleiben frei.
// Im Lauf wird nichts neu angelegt – Zustände liegen in vorab angelegten Feldern.
//
// Zeichenaufrufe (hoch): Feststehendes + Kontur, Flaches/Leuchtendes, Schrift,
// Wehendes, Fahrwerk (Gondeln, Sessel, Raupe, Dohlen) + Kontur, Lichtkegel = 8.
// Niedrig: ohne Konturen und Lichtkegel = 5.

import * as THREE from 'three';
import { PULSE_AVALANCHE } from '../../game/mechanics';
import { SURFACE_INDEX } from '../../game/surface';
import { EDGE_GAP, EDGE_OPEN_L, EDGE_OPEN_R, EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { MeshBuilder, mixRgb, noise, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

/** Mindestabstand aller Kulisse zur Fahrbahnkante (Meter). */
const RAND = 3;
/** So hoch bleibt der Raum über der Fahrbahn frei (Meter, mit Reserve). */
const LUFT = 10.4;
/** Um Tunnel liegt Fels (world.ts): dort beginnt der freie Platz erst weiter draußen. */
const TUNNEL_PLUS = 7;
const TAU = Math.PI * 2;

// --- Farben ------------------------------------------------------------------------

const C_SCHNEE = rgb(0xf7fbff);
const C_SCHNEE_B = rgb(0xdbe8f6);
const C_SCHNEE_S = rgb(0xb9cde6);
const C_FELS = rgb(0x5b6479);
const C_FELS_D = rgb(0x434a5f);
const C_FELS_H = rgb(0x7d879d);
const C_EIS = rgb(0x8fd3f0);
const C_EIS_D = rgb(0x4d9fd3);
const C_EIS_H = rgb(0xd4f3ff);
const C_TANNE = rgb(0x2c5a45);
const C_TANNE_D = rgb(0x1f4436);
const C_LAERCHE = rgb(0xc98a3a);
const C_LAERCHE_D = rgb(0xa86a2a);
const C_STAMM = rgb(0x5a3d2a);
const C_HOLZ = rgb(0x9a6538);
const C_HOLZ_D = rgb(0x5e3c24);
const C_HOLZ_H = rgb(0xc69058);
const C_STEIN = rgb(0x8a8f9c);
const C_DUNKEL = rgb(0x1b1e2c);
const C_ROT = rgb(0xe8483f);
const C_GELB = rgb(0xffc93c);
const C_BLAU = rgb(0x3a6fd8);
const C_GRUEN = rgb(0x3fae6a);
const C_STAHL = rgb(0x6b7385);
const C_STAHL_D = rgb(0x3f4655);
const C_SEE = rgb(0x3f74a3);
const C_SEE_D = rgb(0x335f8c);
const C_SCHILF = rgb(0xb48a4a);
const C_SCHILF_D = rgb(0x7d5f33);
const C_HAUT = rgb(0xf0c09a);
const C_FENSTER = rgb(0xffd27a);
const C_LICHT = rgb(0xfff2b0);
const JACKEN = [0xe8483f, 0x3a6fd8, 0xffc93c, 0x3fae6a, 0xa45ee5, 0xff8a3d, 0x2ec4b6].map(rgb);
const FAHNEN = [0xe8483f, 0xffc93c, 0x3a6fd8, 0x3fae6a, 0xffffff, 0xff8a3d].map(rgb);

// --- Bausteine -----------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0);
const mP = new THREE.Matrix4();
const mL = new THREE.Matrix4();
const mT = new THREE.Matrix4();
const qT = new THREE.Quaternion();
const eT = new THREE.Euler(0, 0, 0, 'YXZ');
const vT = new THREE.Vector3();
const sT = new THREE.Vector3();
const vA = new THREE.Vector3();

/** Rahmen für zusammengesetzte Stücke: Ort, Drehung (Gieren, Nicken, Rollen), Größe. */
function rahmen(x: number, y: number, z: number, yaw: number, s: number, rx = 0, rz = 0): void {
  eT.set(rx, yaw, rz, 'YXZ');
  qT.setFromEuler(eT);
  mP.compose(vT.set(x, y, z), qT, sT.set(s, s, s));
}
/** Punkt im Rahmen. */
function pt(x: number, y: number, z: number): V3 {
  vA.set(x, y, z).applyMatrix4(mP);
  return [vA.x, vA.y, vA.z];
}
/** Grundform im Rahmen: lokal verschoben, gedreht (YXZ) und gestreckt. */
function teil(b: MeshBuilder, geo: THREE.BufferGeometry, c: RGB, x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): void {
  eT.set(rx, ry, rz, 'YXZ');
  qT.setFromEuler(eT);
  mL.compose(vT.set(x, y, z), qT, sT.set(sx, sy, sz));
  mT.multiplyMatrices(mP, mL);
  b.add(geo, c, mT);
}
/** Stab im Rahmen von a nach e (lokal); geo ist eine Grundform der Höhe 1 entlang y. */
function stab(b: MeshBuilder, geo: THREE.BufferGeometry, c: RGB, a: V3, e: V3, r: number): void {
  const dx = e[0] - a[0];
  const dy = e[1] - a[1];
  const dz = e[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return;
  qT.setFromUnitVectors(UP, vA.set(dx / len, dy / len, dz / len));
  mL.compose(vT.set((a[0] + e[0]) / 2, (a[1] + e[1]) / 2, (a[2] + e[2]) / 2), qT, sT.set(r, len, r));
  mT.multiplyMatrices(mP, mL);
  b.add(geo, c, mT);
}
/** Prisma mit n Ecken im Rahmen: unten Radius r0 auf y0, oben r1 auf y1; Deckel nach Wunsch. */
function prisma(b: MeshBuilder, n: number, r0: number, r1: number, y0: number, y1: number, cs: RGB, ctop: RGB | null, rot = 0): void {
  const lo: V3[] = [];
  const hi: V3[] = [];
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * TAU;
    lo.push(pt(Math.cos(a) * r0, y0, Math.sin(a) * r0));
    hi.push(pt(Math.cos(a) * r1, y1, Math.sin(a) * r1));
  }
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    b.quad(lo[j], lo[k], hi[k], hi[j], k % 2 ? cs : shade(cs, 0.86));
  }
  if (ctop) for (let k = 1; k < n - 1; k++) b.tri(hi[0], hi[k + 1], hi[k], ctop);
}
/** Viereck, dessen sichtbare Seite in Richtung n zeigt. */
function quadN(b: MeshBuilder, a: V3, c1: V3, c2: V3, d: V3, n: V3, color: RGB): void {
  const ux = c1[0] - a[0];
  const uy = c1[1] - a[1];
  const uz = c1[2] - a[2];
  const vx = c2[0] - a[0];
  const vy = c2[1] - a[1];
  const vz = c2[2] - a[2];
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) b.quad(a, c1, c2, d, color);
  else b.quad(d, c2, c1, a, color);
}
/** Viereck, dessen sichtbare Seite nach oben zeigt. */
function quadUp(b: MeshBuilder, a: V3, c1: V3, c2: V3, d: V3, color: RGB): void {
  quadN(b, a, c1, c2, d, [0, 1, 0], color);
}
/** Flächennormale (y-Anteil) eines Dreiecks, nach oben gedreht. */
function upOf(a: V3, b: V3, c: V3): number {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  return Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1);
}

// --- Fahrwerk: bewegte Körper in einem Netz, Ecken je Bild umgerechnet ---------------

interface Vorlage {
  pos: Float32Array;
  nor: Float32Array;
  onor: Float32Array;
  col: Float32Array;
  /** Biegegewicht je Ecke (Flügelschlag der Dohlen). */
  flex: Float32Array;
}

function vorlage(b: MeshBuilder, flex?: (x: number, y: number, z: number) => number): Vorlage {
  const g = addSmoothNormals(b.build());
  const pos = g.getAttribute('position').array as Float32Array;
  const n = pos.length / 3;
  const v: Vorlage = {
    pos: new Float32Array(pos),
    nor: new Float32Array(g.getAttribute('normal').array as Float32Array),
    onor: new Float32Array(g.getAttribute('onormal').array as Float32Array),
    col: new Float32Array(g.getAttribute('color').array as Float32Array),
    flex: new Float32Array(n),
  };
  g.dispose();
  if (flex) for (let i = 0; i < n; i++) v.flex[i] = flex(v.pos[i * 3], v.pos[i * 3 + 1], v.pos[i * 3 + 2]);
  return v;
}

interface Gipfel {
  cx: number;
  cz: number;
  y0: number;
  H: number;
  R0: number;
  /** Ringe des Hauptgipfels (für Bauten an der Flanke). */
  rings: V3[][];
}

/** Abstand der Gipfelflanke von der Mitte in Richtung a auf Höhe y. */
function flanke(p: Gipfel, a: number, y: number): number {
  const dx = Math.cos(a);
  const dz = Math.sin(a);
  let prevR = -1;
  let prevY = 0;
  for (const ring of p.rings) {
    let r = 0;
    let ry = 0;
    for (let i = 0; i < ring.length; i++) {
      const A = ring[i];
      const B = ring[(i + 1) % ring.length];
      ry += A[1] / ring.length;
      // Strahl (Mitte + t·d) gegen Strecke A–B
      const ax = A[0] - p.cx;
      const az = A[2] - p.cz;
      const ex = B[0] - A[0];
      const ez = B[2] - A[2];
      const den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-9) continue;
      const tt = (ax * ez - az * ex) / den;
      const u = (ax * dz - az * dx) / den;
      if (tt > 0 && u >= 0 && u <= 1) r = Math.max(r, tt);
    }
    if (prevR >= 0 && y <= ry) return prevR + (r - prevR) * ((y - prevY) / Math.max(1e-3, ry - prevY));
    prevR = r;
    prevY = ry;
  }
  return Math.max(0, prevR);
}

// --- Kulisse ------------------------------------------------------------------------

export function buildEisLife(world: World): Life {
  const t = world.track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const lines = detail > 0;
  const hoch = detail === 2;
  const rnd = seeded(6600 + t.index * 59);
  const T = t.total;
  const NM = t.n;
  const pick = <X>(a: readonly X[]): X => a[Math.floor(rnd() * a.length) % a.length];
  const segM = (m: number): number => ((Math.round(m / t.step) % NM) + NM) % NM;
  const rX = (g: number): number => rightX(t, g);
  const rZ = (g: number): number => rightZ(t, g);
  /** Punkt neben Abschnitt g: u nach rechts, w in Fahrtrichtung. */
  const at = (g: number, u: number, w = 0): [number, number] => [t.px[g] + rX(g) * u + t.tx[g] * w, t.pz[g] + rZ(g) * u + t.tz[g] * w];
  const yawOf = (dx: number, dz: number): number => Math.atan2(dx, dz);

  // Grundformen (am Ende wieder freigegeben)
  const G = {
    ico0: new THREE.IcosahedronGeometry(1, 0),
    dode: new THREE.DodecahedronGeometry(1, 0),
    okt: new THREE.OctahedronGeometry(1, 0),
    box: new THREE.BoxGeometry(1, 1, 1),
    zyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
    zyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
    kabel: new THREE.CylinderGeometry(1, 1, 1, 4, 1, true),
    kegel5: new THREE.ConeGeometry(1, 1, 5, 1, true),
    kegel4: new THREE.ConeGeometry(1, 1, 4),
    halb: new THREE.SphereGeometry(1, 6, 2, 0, TAU, 0, Math.PI / 2),
  };

  // --- Gelände, wie world.ts es zeichnet ------------------------------------------------
  // Das Gelände ist ein Raster, dessen Ecken auf heightAt() liegen; dazwischen sind es
  // ebene Dreiecke. Damit nichts schwebt oder versinkt, rechnen wir genauso.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < T; i++) {
    minX = Math.min(minX, t.px[i]);
    maxX = Math.max(maxX, t.px[i]);
    minZ = Math.min(minZ, t.pz[i]);
    maxZ = Math.max(maxZ, t.pz[i]);
  }
  const CELL = detail === 0 ? 11 : 7.5;
  const gx0 = minX - 150;
  const gz0 = minZ - 150;
  const hCache = new Map<number, number>();
  const hv = (ix: number, iz: number): number => {
    const key = ix * 65536 + iz;
    let h = hCache.get(key);
    if (h === undefined) {
      h = world.heightAt(gx0 + ix * CELL, gz0 + iz * CELL);
      hCache.set(key, h);
    }
    return h;
  };
  /** Höhe des gezeichneten Geländes. */
  const boden = (x: number, z: number): number => {
    const fx = (x - gx0) / CELL;
    const fz = (z - gz0) / CELL;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const u = fx - ix;
    const v = fz - iz;
    const ha = hv(ix, iz);
    const hb = hv(ix + 1, iz);
    const hc = hv(ix + 1, iz + 1);
    const hd = hv(ix, iz + 1);
    if ((ix + iz) % 2 === 0) return u >= v ? ha + (hb - ha) * u + (hc - hb) * v : ha + (hd - ha) * v + (hc - hd) * u;
    return u + v <= 1 ? ha + (hb - ha) * u + (hd - ha) * v : hc + (hd - hc) * (1 - u) + (hb - hc) * (1 - v);
  };

  // --- Platz -------------------------------------------------------------------------
  let nah = 0;
  // Abschnitte in einem groben Raster: die Suche nach der nächsten Kante bleibt in der Nähe.
  const KZ = 20;
  const kRaster = new Map<number, number[]>();
  const kKey = (ix: number, iz: number): number => (ix + 2048) * 4096 + (iz + 2048);
  const kBreite = new Float64Array(T);
  let kMax = 0;
  for (let k = 0; k < T; k++) {
    kBreite[k] = t.wh[k] + (t.edge[k] & EDGE_TUNNEL ? TUNNEL_PLUS : 0);
    kMax = Math.max(kMax, kBreite[k]);
    if (k % 2) continue;
    const key = kKey(Math.floor(t.px[k] / KZ), Math.floor(t.pz[k] / KZ));
    let a = kRaster.get(key);
    if (!a) kRaster.set(key, (a = []));
    a.push(k);
  }
  /** Abstand zur nächsten Fahrbahnkante über alle Wege (Tunnel mit Felsmantel); merkt den Abschnitt in nah. */
  const kante = (x: number, z: number): number => {
    let best = Infinity;
    let bk = 0;
    const ix = Math.floor(x / KZ);
    const iz = Math.floor(z / KZ);
    let fertig = false;
    for (let r = 0; r <= 4 && !fertig; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const a = kRaster.get(kKey(ix + dx, iz + dz));
          if (!a) continue;
          for (const k of a) {
            const d = Math.hypot(x - t.px[k], z - t.pz[k]) - kBreite[k];
            if (d < best) {
              best = d;
              bk = k;
            }
          }
        }
      }
      // Alles außerhalb der abgesuchten Ringe liegt mindestens r·KZ entfernt.
      if (best <= r * KZ - kMax) fertig = true;
    }
    if (!fertig) {
      for (let k = 0; k < T; k += 2) {
        const d = Math.hypot(x - t.px[k], z - t.pz[k]) - kBreite[k];
        if (d < best) {
          best = d;
          bk = k;
        }
      }
    }
    nah = bk;
    return best - 0.3;
  };
  /** Wie kante, aber ohne den Felsmantel der Tunnel (für die Tore an den Tunnelmündungen). */
  const kanteOT = (x: number, z: number): number => {
    let best = Infinity;
    let bk = 0;
    for (let k = 0; k < T; k++) {
      if (t.edge[k] & EDGE_TUNNEL) continue;
      const d = Math.hypot(x - t.px[k], z - t.pz[k]) - t.wh[k];
      if (d < best) {
        best = d;
        bk = k;
      }
    }
    nah = bk;
    return best - 0.3;
  };
  /** Höchste Fahrbahn im Umkreis r (für Dinge, die hoch darüber hinweggehen). */
  const bahnHoch = (x: number, z: number, r: number): number => {
    let y = -Infinity;
    for (let k = 0; k < T; k++) if (Math.hypot(x - t.px[k], z - t.pz[k]) < t.wh[k] + r && t.py[k] > y) y = t.py[k];
    return y;
  };
  // Sperrkreise (x, z, r): Orte, an denen schon etwas Eigenes steht oder frei bleiben muss.
  const sperr: number[] = [];
  const sperre = (x: number, z: number, r: number): void => {
    sperr.push(x, z, r);
  };
  const gesperrt = (x: number, z: number, r: number): boolean => {
    for (let q = 0; q < sperr.length; q += 3) if (Math.hypot(x - sperr[q], z - sperr[q + 1]) < sperr[q + 2] + r) return true;
    return false;
  };
  // Lawinen: Streifen samt Rinne und Hang bleiben der Mechanik bzw. dem eigenen Hang vorbehalten.
  interface Lawine {
    g: number;
    cx: number;
    cz: number;
    fx: number;
    fz: number;
    rx: number;
    rz: number;
    side: number;
    R: number;
    E: number;
    L: number;
    yb: number;
    s1: number;
    WH: number;
  }
  const lawinen: Lawine[] = [];
  const inLawine = (x: number, z: number, r: number): boolean => {
    for (const a of lawinen) {
      const du = (x - a.cx) * a.rx + (z - a.cz) * a.rz;
      const dw = (x - a.cx) * a.fx + (z - a.cz) * a.fz;
      // Streifen über die Bahn bis weit auf die Talseite
      if (Math.abs(dw) < a.R + 4 + r && Math.abs(du) < a.E + a.L + 4 + r) return true;
      // Hang auf der Bergseite
      const s = du * a.side - a.E;
      if (s > -2 - r && s < a.s1 + r && Math.abs(dw) < a.WH + r) return true;
    }
    return false;
  };
  // Belegung: was schon steht (x, z, r) in einem Raster.
  const ZELLE = 8;
  const raster = new Map<number, number[]>();
  const rk = (ix: number, iz: number): number => (ix + 4096) * 8192 + (iz + 4096);
  const belege = (x: number, z: number, r: number): void => {
    const key = rk(Math.floor(x / ZELLE), Math.floor(z / ZELLE));
    let a = raster.get(key);
    if (!a) raster.set(key, (a = []));
    a.push(x, z, r);
  };
  const belegt = (x: number, z: number, r: number, f = 0.85): boolean => {
    const reach = r + 18;
    const ix0 = Math.floor((x - reach) / ZELLE);
    const ix1 = Math.floor((x + reach) / ZELLE);
    const iz0 = Math.floor((z - reach) / ZELLE);
    const iz1 = Math.floor((z + reach) / ZELLE);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const a = raster.get(rk(ix, iz));
        if (!a) continue;
        for (let q = 0; q < a.length; q += 3) if (Math.hypot(x - a[q], z - a[q + 1]) < (r + a[q + 2]) * f) return true;
      }
    }
    return false;
  };
  // See: Zellen des Eisrasters (wird unten gefüllt).
  const seeZellen = new Set<number>();
  let seeCell = 3;
  let seeX0 = 0;
  let seeZ0 = 0;
  const seeKey = (ix: number, iz: number): number => ix * 4096 + iz;
  const imSee = (x: number, z: number): boolean => seeZellen.has(seeKey(Math.floor((x - seeX0) / seeCell), Math.floor((z - seeZ0) / seeCell)));
  // Gipfel: wo ihr Kegel über dem Gelände steht, wächst nichts.
  const gipfel: Gipfel[] = [];
  const kegelH = (p: Gipfel, x: number, z: number, f = 1.4): number => p.y0 + p.H * (1 - Math.hypot(x - p.cx, z - p.cz) / (p.R0 * f));
  const gipfelH = (x: number, z: number, ohne?: Gipfel): number => {
    let y = -Infinity;
    for (const p of gipfel) y = Math.max(y, kegelH(p, x, z, p === ohne ? 1.05 : 1.4));
    return y;
  };
  /** Frei für ein Stück mit Radius r? */
  const frei = (x: number, z: number, r: number): boolean =>
    kante(x, z) >= RAND + r && !gesperrt(x, z, r) && !inLawine(x, z, r) && !imSee(x, z) && gipfelH(x, z) < boden(x, z) - 1;

  // --- Netze ---------------------------------------------------------------------------
  const bo = new MeshBuilder(); // mit Kontur
  const bn = new MeshBuilder(); // ohne Kontur (flache und kleine Teile)
  const bf = new MeshBuilder(); // flach, unbeleuchtet: Eis des Sees, Fenster, Lampen
  const bt = new MeshBuilder(); // Schrift
  // Wehendes (Fahnen, Wolkenfetzen): eigene Ecken mit Ausschlag (Weite, Phase, Takt) und Richtung.
  const wPos: number[] = [];
  const wCol: number[] = [];
  const wWav: number[] = [];
  const wDir: number[] = [];
  /** Dreieck ins Wehende; k* = Anteil des Ausschlags je Ecke. */
  const wTri = (a: V3, b: V3, c: V3, col: RGB, ka: number, kb: number, kc: number, amp: number, phase: number, speed: number, dir: V3, travel = 2.4): void => {
    for (const [p, k] of [
      [a, ka],
      [b, kb],
      [c, kc],
    ] as [V3, number][]) {
      wPos.push(p[0], p[1], p[2]);
      wCol.push(col[0], col[1], col[2]);
      wWav.push(amp * k, phase + k * travel, speed);
      wDir.push(dir[0], dir[1], dir[2]);
    }
  };
  /** Fahne an einem Mast: Ecke oben am Mast (x,y,z), weht in Richtung (dx,dz), Breite w, Höhe h. */
  const fahne = (x: number, y: number, z: number, dx: number, dz: number, w: number, h: number, c1: RGB, c2: RGB | null, phase: number): void => {
    const n: V3 = [-dz, 0, dx];
    const P = (u: number, v: number): V3 => [x + dx * u * w, y - v * h, z + dz * u * w];
    const N = 3;
    for (let i = 0; i < N; i++) {
      const u0 = i / N;
      const u1 = (i + 1) / N;
      for (let j = 0; j < 2; j++) {
        const v0 = j / 2;
        const v1 = (j + 1) / 2;
        const c = c2 && j === 1 ? c2 : c1;
        wTri(P(u0, v0), P(u0, v1), P(u1, v1), c, u0, u0, u1, 0.45 * w, phase, 4.2, n);
        wTri(P(u0, v0), P(u1, v1), P(u1, v0), c, u0, u1, u1, 0.45 * w, phase, 4.2, n);
      }
    }
  };
  /** Wolkenfetzen: flache Bällchen, die als Ganzes langsam hin und her ziehen. */
  const wolke = (x: number, y: number, z: number, s: number, dir: V3, phase: number): void => {
    const p = G.ico0.getAttribute('position');
    const n = 3 + Math.floor(rnd() * 3);
    for (let b = 0; b < n; b++) {
      const ox = (b - (n - 1) / 2) * 2.4 * s + (rnd() - 0.5) * s;
      const oz = (rnd() - 0.5) * 2.2 * s;
      const r = (1.4 + rnd() * 1.0) * s * (b === Math.floor(n / 2) ? 1.25 : 1);
      for (let i = 0; i + 2 < p.count; i += 3) {
        const v: V3[] = [];
        for (let q = 0; q < 3; q++) v.push([x + ox + p.getX(i + q) * r * 1.3, y + p.getY(i + q) * r * 0.55, z + oz + p.getZ(i + q) * r]);
        const low = (v[0][1] + v[1][1] + v[2][1]) / 3 < y - r * 0.12;
        wTri(v[0], v[1], v[2], low ? C_SCHNEE_S : (i / 3) % 3 === 0 ? C_SCHNEE_B : [1, 1, 1], 1, 1, 1, 2.6 * s, phase, 0.11, dir, 0);
      }
    }
  };
  // Schrift: ein Bild mit mehreren Zeilen.
  const ZEILEN = ['PASSHÜTTE', 'LAWINENGEFAHR', 'BOBBAHN', '0:58.31', 'BERGSTATION'];
  const ZB = 512;
  const ZH = 64;
  const schriftTex = ((): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = ZB;
    c.height = ZH * 8;
    const g = c.getContext('2d')!;
    const farben: [string, string][] = [
      ['#5e3c24', '#fff2d6'],
      ['#d8352b', '#ffffff'],
      ['#1b1e2c', '#ffc93c'],
      ['#101218', '#ff9a2a'],
      ['#2c3550', '#ffffff'],
    ];
    for (let k = 0; k < ZEILEN.length; k++) {
      g.fillStyle = farben[k][0];
      g.fillRect(0, k * ZH, ZB, ZH);
      g.strokeStyle = '#16131c';
      g.lineWidth = 6;
      g.strokeRect(3, k * ZH + 3, ZB - 6, ZH - 6);
      g.fillStyle = farben[k][1];
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      let size = 44;
      const font = k === 3 ? '700 SIZEpx "Courier New", monospace' : '900 SIZEpx "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
      g.font = font.replace('SIZE', String(size));
      const w = g.measureText(ZEILEN[k]).width;
      if (w > ZB * 0.88) {
        size = Math.floor((size * ZB * 0.88) / w);
        g.font = font.replace('SIZE', String(size));
      }
      g.fillText(ZEILEN[k], ZB / 2, k * ZH + ZH / 2 + 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  })();
  /** Schild mit Zeile k: Mitte (x,y,z), Blick nach (nx,nz), Breite w, Höhe h; beidseitig. */
  const schild = (k: number, x: number, y: number, z: number, nx: number, nz: number, w: number, h: number, beide = false): void => {
    const rx = nz;
    const rz = -nx;
    const v0 = 1 - (k + 1) / 8;
    const v1 = 1 - k / 8;
    for (const s of beide ? [1, -1] : [1]) {
      const ox = nx * 0.06 * s;
      const oz = nz * 0.06 * s;
      const a: V3 = [x + ox - rx * (w / 2) * s, y - h / 2, z + oz - rz * (w / 2) * s];
      const b: V3 = [x + ox + rx * (w / 2) * s, y - h / 2, z + oz + rz * (w / 2) * s];
      const c: V3 = [x + ox + rx * (w / 2) * s, y + h / 2, z + oz + rz * (w / 2) * s];
      const d: V3 = [x + ox - rx * (w / 2) * s, y + h / 2, z + oz - rz * (w / 2) * s];
      bt.quadUv(a, b, c, d, [1, 1, 1], 0, v0, 1, v1);
    }
  };

  // Bewegtes: Anker für update()
  const rauch: number[] = []; // x, y, z, Takt, Größe
  const gondel = { ok: false, len: 0, ax: [] as number[], ay: [] as number[], az: [] as number[], as: [] as number[], bx: [] as number[], by: [] as number[], bz: [] as number[] };
  const lift = { ok: false, len: 0, ax: [] as number[], ay: [] as number[], az: [] as number[], as: [] as number[], bx: [] as number[], by: [] as number[], bz: [] as number[] };
  const raupe = { ok: false, x: new Float32Array(41), y: new Float32Array(41), z: new Float32Array(41), len: 0 };
  const dohlenAnker: number[] = []; // x, y, z, Radius

  // === Lawinenstriche: Hang mit Rinne, Verbauung, Warntafeln ================================
  for (const p of t.pulses) {
    if (p.kind !== PULSE_AVALANCHE) continue;
    const g = p.seg;
    const side = p.lat >= 0 ? 1 : -1;
    const R = p.radius;
    const wh = t.wh[g];
    const E = wh + 1.6;
    const cx = t.px[g];
    const cz = t.pz[g];
    const fx = t.tx[g];
    const fz = t.tz[g];
    const rx = rX(g);
    const rz = rZ(g);
    const P2 = (u: number, w: number): [number, number] => [cx + rx * u + fx * w, cz + rz * u + fz * w];
    // Länge der Rinne wie in mechanics/snow.ts: so weit, bis eine andere Fahrbahn in die Quere kommt.
    let L = 26;
    for (let s = 4; s <= 26; s += 2) {
      let hit = false;
      for (const w of [-R - 1.5, 0, R + 1.5]) {
        const [x, z] = P2(side * (E + s), w);
        for (let i = 0; i < T && !hit; i++) {
          if (i < NM) {
            const di = Math.abs(i - g);
            if (Math.min(di, NM - di) * t.step < 40) continue;
          }
          if (Math.hypot(x - t.px[i], z - t.pz[i]) < t.wh[i] + 6) hit = true;
        }
      }
      if (hit) {
        L = Math.max(8, s - 2);
        break;
      }
    }
    const slope = 0.52;
    const yb = t.py[g] + side * (wh + 0.6) * t.bank[g];
    const WH = R + 30;
    let s1 = L + 38;
    // Hang nicht über andere Fahrbahnen: kürzen, bis er frei bleibt.
    for (let s = L; s <= s1; s += 3) {
      let hit = false;
      for (let w = -WH; w <= WH && !hit; w += 6) {
        const [x, z] = P2(side * (E + s), w);
        const k = kante(x, z);
        if (k < RAND + 2) {
          const di = Math.abs(nah - g);
          if (nah >= NM || Math.min(di, NM - di) > 60) hit = true;
        }
      }
      if (hit) {
        s1 = Math.max(L + 8, s - 6);
        break;
      }
    }
    lawinen.push({ g, cx, cz, fx, fz, rx, rz, side, R, E, L, yb, s1, WH });

    /** Höhe des Hangs an (s, w): s ab der Bande bergwärts, w längs der Bahn. */
    const hangY = (s: number, w: number): number => {
      const [x, z] = P2(side * (E + s), w);
      const gr = boden(x, z);
      const aw = Math.abs(w);
      // Oberhalb der Wechte wird der Hang etwas flacher.
      const base = yb + slope * Math.min(s, L) + 0.36 * Math.max(0, s - L);
      const upper = smooth((s - L) / 16);
      const bankH = 1.4 + 3.2 * upper;
      let y: number;
      if (aw < R + 0.4) y = base + 0.55 * (w / R) * (w / R) - 0.3 - 1.6 * upper * (1 - (aw / R) * (aw / R));
      else if (aw < R + 2.6) y = base + 0.9 + (bankH - 0.9) * smooth((aw - R - 0.4) / 2.2);
      else y = base + bankH + 2.5 * noise(x * 0.09, z * 0.09);
      // Ränder laufen ins Gelände aus; nahe einer Fahrbahn bleibt nur das Gelände.
      const mw = 1 - smooth((aw - (WH - 20)) / 20);
      const ms = 1 - smooth((s - (s1 - 16)) / 16);
      const m0 = smooth((s - 2.5) / 7) * (aw < R + 2.6 ? 1 : 1);
      const kk = kante(x, z);
      const di = Math.abs(nah - g);
      const mk = nah < NM && Math.min(di, NM - di) < 30 ? 1 : smooth((kk - RAND - 1) / 6);
      const m = mw * ms * mk * (aw < R + 2.6 && s < L + 0.5 ? 1 : m0);
      return gr + Math.max(0, y - gr) * m;
    };
    // Raster in (s, w) – Spalten auf den Kanten der Rinne, damit diese sauber anschließt.
    const ws: number[] = [];
    {
      const edges = [R + 0.4, R + 2.6];
      const outer: number[] = [];
      for (let w = R + 6; w < WH; w += detail === 0 ? 9 : 6) outer.push(w);
      outer.push(WH);
      const half = [0, R * 0.5, ...edges, ...outer];
      for (let i = half.length - 1; i > 0; i--) ws.push(-half[i]);
      for (const w of half) ws.push(w);
    }
    const ss: number[] = [];
    {
      for (let s = 2.5; s < L; s += detail === 0 ? 7 : 4.5) ss.push(s);
      ss.push(L + 0.4);
      for (let s = L + 4; s < s1; s += detail === 0 ? 8 : 5.5) ss.push(s);
      ss.push(s1);
    }
    const HY: number[][] = ss.map((s) => ws.map((w) => hangY(s, w)));
    const HP = (i: number, j: number): V3 => {
      const [x, z] = P2(side * (E + ss[i]), ws[j]);
      return [x, HY[i][j], z];
    };
    // Ecken zu nah an einer Fahrbahnkante (auch an einer anderen Stelle der Kurve): Zelle auslassen.
    const nahBahn: boolean[][] = ss.map((s) => ws.map((w) => kante(...P2(side * (E + s), w)) < RAND + 0.2));
    for (let i = 0; i + 1 < ss.length; i++) {
      for (let j = 0; j + 1 < ws.length; j++) {
        const wm = (ws[j] + ws[j + 1]) / 2;
        const aw = Math.abs(wm);
        // Die Rinne bis zur Wechte zeichnet mechanics/snow.ts.
        if (ss[i + 1] <= L + 0.5 && aw < R + 2.6) continue;
        if (nahBahn[i][j] || nahBahn[i][j + 1] || nahBahn[i + 1][j] || nahBahn[i + 1][j + 1]) continue;
        const a = HP(i, j);
        const b = HP(i, j + 1);
        const c = HP(i + 1, j + 1);
        const d = HP(i + 1, j);
        const up = upOf(a, b, c);
        let col: RGB;
        if (aw < R + 0.4) col = (j + (i % 2)) % 2 === 0 ? C_SCHNEE : C_SCHNEE_B;
        else if (aw < R + 2.6) col = i % 2 ? C_FELS : C_FELS_D;
        else if (up < 0.5) col = (i + j) % 2 ? C_FELS : C_FELS_H;
        else col = (i + j) % 3 === 0 ? C_SCHNEE_B : C_SCHNEE;
        quadUp(bn, a, b, c, d, col);
      }
    }
    // Lawinenverbauung links und rechts der Rinne: unten Schneezäune aus Holz, oben Stützwerke aus Stahl.
    rahmen(0, 0, 0, 0, 1);
    for (const sw of [-1, 1]) {
      let row = 0;
      for (let s = 7; s < s1 - 8; s += detail === 0 ? 9 : 6.5, row++) {
        const w0 = sw * (R + 5 + (row % 2) * 3);
        const len = 9 + rnd() * 5;
        const w1 = w0 + sw * len;
        if (Math.abs(w1) > WH - 8) continue;
        const stahl = s > L - 2;
        const n = stahl ? 4 : 3;
        const posts: V3[] = [];
        let zuNah = false;
        for (let k = 0; k < n; k++) {
          const w = w0 + ((w1 - w0) * k) / (n - 1);
          const [x, z] = P2(side * (E + s), w);
          if (kante(x, z) < RAND + 2) zuNah = true;
          posts.push([x, hangY(s, w) - 0.2, z]);
        }
        if (zuNah) continue;
        const H = stahl ? 3.0 : 2.2;
        // Neigung talwärts (Stützwerk) bzw. senkrecht (Zaun)
        const lean = stahl ? 1.1 : 0.25;
        const tx = -rx * side * lean;
        const tz = -rz * side * lean;
        for (const q of posts) stab(bo, G.box, stahl ? C_STAHL_D : C_HOLZ_D, q, [q[0] + tx, q[1] + H, q[2] + tz], stahl ? 0.22 : 0.18);
        const bars = stahl ? 4 : 3;
        for (let b = 0; b < bars; b++) {
          const f = (b + 0.7) / (bars + 0.2);
          for (let k = 0; k + 1 < n; k++) {
            const a = posts[k];
            const c = posts[k + 1];
            const A: V3 = [a[0] + tx * f, a[1] + H * f, a[2] + tz * f];
            const C: V3 = [c[0] + tx * f, c[1] + H * f, c[2] + tz * f];
            stab(bn, G.box, stahl ? C_STAHL : b % 2 ? C_HOLZ : C_HOLZ_D, A, C, stahl ? 0.13 : 0.16);
          }
        }
        if (stahl) {
          // Stützen bergseits
          for (const q of [posts[0], posts[n - 1]]) stab(bn, G.box, C_STAHL_D, [q[0] + rx * side * 1.6, q[1], q[2] + rz * side * 1.6], [q[0] + tx * 0.8, q[1] + H * 0.8, q[2] + tz * 0.8], 0.12);
        }
        // Schneepolster hinter dem Zaun
        const m = posts[Math.floor(n / 2)];
        teil(bn, G.halb, C_SCHNEE, m[0] + rx * side * 1.2, m[1] - 0.1, m[2] + rz * side * 1.2, 0, yawOf(fx, fz), 0, len * 0.42, 0.9, 1.3);
      }
    }
    // Ein paar Tannen und Felsen am unteren Hang, damit er nicht nackt wirkt.
    for (let k = 0; k < (detail === 0 ? 3 : 6); k++) {
      const sw = k % 2 ? 1 : -1;
      const w = sw * (R + 8 + rnd() * (WH - R - 20));
      const s = 4 + rnd() * 10;
      const [x, z] = P2(side * (E + s), w);
      const ts = 0.8 + rnd() * 0.4;
      if (kante(x, z) < RAND + 3.1 * ts) continue;
      tanne(x, hangY(s, w) - 0.3, z, ts, false);
    }
    // Warntafeln vor dem Streifen, beidseits, Blick zu den Ankommenden.
    for (const su of [-1, 1]) {
      const w = -(R + 8);
      let uu = wh + RAND + 1;
      while (uu < wh + 12 && kante(...P2(su * uu, w)) < RAND + 0.6) uu += 0.5;
      const [x, z] = P2(su * uu, w);
      const y = boden(x, z);
      rahmen(x, y, z, yawOf(-fx, -fz), 1);
      teil(bo, G.box, C_STAHL_D, 0, 1.6, 0, 0, 0, 0, 0.16, 3.2, 0.16);
      // Gelbe Raute mit schwarzem Rand und Lawinenzeichen
      const ry = 2.7;
      const D = (r: number, dz: number): V3[] => [pt(0, ry - r, dz), pt(r, ry, dz), pt(0, ry + r, dz), pt(-r, ry, dz)];
      const d0 = D(0.95, 0.1);
      const d1 = D(0.78, 0.12);
      bn.quad(d0[0], d0[1], d0[2], d0[3], C_DUNKEL);
      bn.quad(d1[0], d1[1], d1[2], d1[3], C_GELB);
      const b0 = D(0.95, 0.08);
      bn.quad(b0[3], b0[2], b0[1], b0[0], C_STAHL);
      // Berg mit Schneebrocken
      bn.tri(pt(-0.45, ry - 0.35, 0.14), pt(0.45, ry - 0.35, 0.14), pt(0.05, ry + 0.35, 0.14), C_DUNKEL);
      bn.tri(pt(-0.08, ry + 0.17, 0.15), pt(0.17, ry + 0.17, 0.15), pt(0.05, ry + 0.35, 0.15), [1, 1, 1]);
      for (const [ox, oy] of [
        [-0.42, -0.05],
        [-0.25, 0.1],
      ]) {
        bn.quad(pt(ox - 0.07, ry + oy - 0.07, 0.15), pt(ox + 0.07, ry + oy - 0.07, 0.15), pt(ox + 0.07, ry + oy + 0.07, 0.15), pt(ox - 0.07, ry + oy + 0.07, 0.15), C_DUNKEL);
      }
      const sp = pt(0, 1.45, 0.11);
      const n0 = pt(0, 0, 1);
      const o0 = pt(0, 0, 0);
      schild(1, sp[0], sp[1], sp[2], n0[0] - o0[0], n0[2] - o0[2], 2.4, 0.46, true);
      sperre(x, z, 1.5);
    }
  }

  // === Bäume und Felsen (Bausteine; verteilt wird weiter unten) ==============================
  function tanne(x: number, y: number, z: number, s: number, laerche: boolean): void {
    rahmen(x, y, z, rnd() * TAU, s, (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.08);
    const tiers = laerche ? 3 : s > 1.1 ? 3 : 2;
    const H = laerche ? 9.5 : 8;
    const cN = laerche ? C_LAERCHE : C_TANNE;
    const cD = laerche ? C_LAERCHE_D : C_TANNE_D;
    teil(bo, G.box, C_STAMM, 0, 0.9, 0, 0, rnd(), 0, 0.42, 2.2, 0.42);
    const rot = rnd() * TAU;
    for (let k = 0; k < tiers; k++) {
      const f = k / tiers;
      const y0 = 1.3 + f * (H - 2.6);
      const y1 = y0 + (H - 1.3) / tiers + 1.6;
      const r0 = (laerche ? 2.2 : 3.0) * (1 - f * 0.55);
      const ym = y0 + (y1 - y0) * 0.45;
      const rm = r0 * 0.55;
      // unten grün, oben Schneelast
      const lo: V3[] = [];
      const mi: V3[] = [];
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = rot + k * 0.6 + (i / n) * TAU;
        lo.push(pt(Math.cos(a) * r0, y0 - (i % 2) * 0.25, Math.sin(a) * r0));
        mi.push(pt(Math.cos(a) * rm, ym, Math.sin(a) * rm));
      }
      const top = pt(0, y1, 0);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        bo.quad(lo[j], lo[i], mi[i], mi[j], i % 2 ? cN : cD);
        bo.tri(mi[j], mi[i], top, i % 2 ? C_SCHNEE : C_SCHNEE_B);
      }
      // Unterseite (sonst sieht man von unten hinein)
      for (let i = 1; i < n - 1; i++) bn.tri(lo[0], lo[i], lo[i + 1], cD);
    }
  }
  function fels(x: number, y: number, z: number, s: number, nadel: boolean): void {
    rahmen(x, y, z, rnd() * TAU, s);
    if (nadel) {
      const h = 4 + rnd() * 5;
      prisma(bo, 5, 1.3, 0.55, -0.6, h, rnd() < 0.5 ? C_FELS : C_FELS_D, null, rnd());
      prisma(bo, 5, 0.62, 0.05, h - 0.02, h + 1.2, C_SCHNEE, null, rnd());
      if (rnd() < 0.6) {
        rahmen(x + (rnd() - 0.5) * 3 * s, y, z + (rnd() - 0.5) * 3 * s, rnd() * TAU, s * 0.6);
        prisma(bo, 5, 1.2, 0.5, -0.6, h * 0.7, C_FELS_D, null, rnd());
        prisma(bo, 5, 0.56, 0.05, h * 0.7 - 0.02, h * 0.7 + 1, C_SCHNEE, null, rnd());
      }
    } else {
      const sx = 1.6 + rnd() * 0.8;
      const sy = 1.0 + rnd() * 0.8;
      teil(bo, rnd() < 0.5 ? G.dode : G.ico0, rnd() < 0.5 ? C_FELS : C_FELS_D, 0, sy * 0.35, 0, rnd() * 0.3, rnd() * TAU, rnd() * 0.3, sx, sy, sx * (0.8 + rnd() * 0.3));
      teil(bn, G.halb, C_SCHNEE, 0, sy * 0.95, 0, 0, rnd(), 0, sx * 0.7, 0.42, sx * 0.6);
    }
  }
  /** Schneewechte: überhängender Wulst an einer Kante; überhängt in Richtung (dx, dz). */
  function wechte(x: number, y: number, z: number, dx: number, dz: number, len: number): void {
    rahmen(x, y, z, yawOf(dx, dz), 1);
    const prof: [number, number][] = [
      [-2.2, -0.3],
      [-1.2, 0.8],
      [0.4, 1.25],
      [1.6, 0.95],
      [2.2, 0.35],
      [1.7, -0.25],
      [0.6, 0.05],
      [-0.6, -0.4],
    ];
    const n = prof.length;
    const segs = 3;
    for (let k = 0; k < segs; k++) {
      const x0 = -len / 2 + (len * k) / segs;
      const x1 = x0 + len / segs;
      const b0 = Math.sin(k * 1.7) * 0.25;
      const b1 = Math.sin((k + 1) * 1.7) * 0.25;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const [z0, y0] = prof[i];
        const [z1, y1] = prof[j];
        const c = i < 3 ? C_SCHNEE : i < 5 ? C_SCHNEE_B : C_SCHNEE_S;
        const a = pt(x0, y0 + b0 * (y0 > 0 ? 1 : 0), z0 + b0);
        const b = pt(x0, y1 + b0 * (y1 > 0 ? 1 : 0), z1 + b0);
        const cc = pt(x1, y1 + b1 * (y1 > 0 ? 1 : 0), z1 + b1);
        const d = pt(x1, y0 + b1 * (y0 > 0 ? 1 : 0), z0 + b1);
        // Außen: Normale im Profil nach außen
        const nz = y1 - y0;
        const ny = -(z1 - z0);
        const o = pt(0, 0, 0);
        const nn = pt(0, ny, nz);
        quadN(bo, a, b, cc, d, [nn[0] - o[0], nn[1] - o[1], nn[2] - o[2]], c);
      }
    }
    for (const xe of [-len / 2, len / 2]) {
      const pts = prof.map(([pz, py]) => pt(xe, py, pz));
      const o = pt(0, 0, 0);
      const e = pt(xe < 0 ? -1 : 1, 0, 0);
      for (let i = 1; i < n - 1; i++) {
        const nn: V3 = [e[0] - o[0], e[1] - o[1], e[2] - o[2]];
        const a = pts[0];
        const b = pts[i];
        const c = pts[i + 1];
        const ux = b[0] - a[0];
        const uy = b[1] - a[1];
        const uz = b[2] - a[2];
        const vx = c[0] - a[0];
        const vy = c[1] - a[1];
        const vz = c[2] - a[2];
        const d = (uy * vz - uz * vy) * nn[0] + (uz * vx - ux * vz) * nn[1] + (ux * vy - uy * vx) * nn[2];
        if (d >= 0) bo.tri(a, b, c, C_SCHNEE_B);
        else bo.tri(a, c, b, C_SCHNEE_B);
      }
    }
    // Zapfen unter dem Überhang
    for (let k = 0; k < 3; k++) teil(bn, G.kegel4, C_EIS_H, -len / 2 + len * (k + 0.5) / 3, -0.1 - 0.4, 1.4, Math.PI, 0, 0, 0.18, 0.9 + rnd() * 0.6, 0.18);
  }

  // === Passhütte am Start ==================================================================
  {
    let placed = false;
    for (let tries = 0; tries < 24 && !placed; tries++) {
      const g = segM(26 + tries * 6);
      // Bergseite: dort, wo das Gelände höher liegt (innen); die Hütte steht mit der Front zur Bahn.
      const hl = boden(...at(g, 24));
      const hr = boden(...at(g, -24));
      const side = hl >= hr ? 1 : -1;
      const [x, z] = at(g, side * (t.wh[g] + 14.5));
      if (kante(x, z) < RAND + 7.5 || gesperrt(x, z, 8) || inLawine(x, z, 8)) continue;
      placed = true;
      const y = Math.min(boden(x, z), boden(x + 4, z + 4), boden(x - 4, z - 4), boden(x + 4, z - 4), boden(x - 4, z + 4));
      const fwd = yawOf(-rX(g) * side, -rZ(g) * side);
      rahmen(x, y, z, fwd, 1);
      // Sockel und Wände
      teil(bo, G.box, C_STEIN, 0, 0.3, 0, 0, 0, 0, 10.6, 1.6, 8.6);
      teil(bo, G.box, C_HOLZ, 0, 2.85, 0, 0, 0, 0, 10, 3.5, 8);
      for (let k = 0; k < 5; k++) {
        const yy = 1.45 + k * 0.68;
        bn.quad(pt(-5, yy, 4.02), pt(5, yy, 4.02), pt(5, yy + 0.12, 4.02), pt(-5, yy + 0.12, 4.02), C_HOLZ_D);
        bn.quad(pt(5, yy, -4.02), pt(-5, yy, -4.02), pt(-5, yy + 0.12, -4.02), pt(5, yy + 0.12, -4.02), C_HOLZ_D);
        bn.quad(pt(5.02, yy, 4), pt(5.02, yy, -4), pt(5.02, yy + 0.12, -4), pt(5.02, yy + 0.12, 4), C_HOLZ_D);
        bn.quad(pt(-5.02, yy, -4), pt(-5.02, yy, 4), pt(-5.02, yy + 0.12, 4), pt(-5.02, yy + 0.12, -4), C_HOLZ_D);
      }
      for (const [cx2, cz2] of [
        [-5, -4],
        [5, -4],
        [-5, 4],
        [5, 4],
      ])
        teil(bo, G.box, C_HOLZ_D, cx2, 2.85, cz2, 0, 0, 0, 0.5, 3.6, 0.5);
      // Giebel
      const eave = 4.6;
      const ridge = 7.4;
      for (const gx of [-5, 5]) {
        const a = pt(gx, eave, -4);
        const b = pt(gx, eave, 4);
        const c = pt(gx, ridge - 0.3, 0);
        const o = pt(0, eave, 0);
        const e = pt(gx * 2, eave, 0);
        const n: V3 = [e[0] - o[0], e[1] - o[1], e[2] - o[2]];
        quadN(bo, a, b, c, c, n, C_HOLZ_H);
      }
      // Dach: Holz unten, dicke Schneedecke oben
      const OX = 5.9;
      const OZ = 5.0;
      const TH = 0.6;
      for (const sz of [-1, 1]) {
        const e0 = pt(-OX, eave - 0.3, sz * OZ);
        const e1 = pt(OX, eave - 0.3, sz * OZ);
        const r0 = pt(-OX, ridge, 0);
        const r1 = pt(OX, ridge, 0);
        const dn = pt(0, -1, sz * 0.6);
        const o = pt(0, 0, 0);
        quadN(bo, e0, e1, r1, r0, [dn[0] - o[0], dn[1] - o[1], dn[2] - o[2]], C_HOLZ_D);
        const s0 = pt(-OX - 0.1, eave - 0.3 + TH, sz * OZ);
        const s1 = pt(OX + 0.1, eave - 0.3 + TH, sz * OZ);
        const t0 = pt(-OX - 0.1, ridge + TH, 0);
        const t1 = pt(OX + 0.1, ridge + TH, 0);
        quadUp(bo, s0, s1, t1, t0, sz > 0 ? C_SCHNEE : C_SCHNEE_B);
        // Schneekante an der Traufe, leicht wulstig
        const l0 = pt(-OX - 0.1, eave - 0.45, sz * (OZ + 0.15));
        const l1 = pt(OX + 0.1, eave - 0.45, sz * (OZ + 0.15));
        const on = pt(0, 0, sz);
        quadN(bo, l0, l1, s1, s0, [on[0] - o[0], on[1] - o[1], on[2] - o[2]], C_SCHNEE_B);
        // Stirnseiten der Schneedecke
        for (const sx of [-1, 1]) {
          const a = pt(sx * (OX + 0.1), eave - 0.45, sz * (OZ + 0.15));
          const b = pt(sx * (OX + 0.1), eave - 0.3 + TH, sz * OZ);
          const c = pt(sx * (OX + 0.1), ridge + TH, 0);
          const d = pt(sx * (OX + 0.1), ridge - 0.05, 0);
          const sn = pt(sx, 0, 0);
          quadN(bo, a, b, c, d, [sn[0] - o[0], sn[1] - o[1], sn[2] - o[2]], C_SCHNEE_S);
        }
        // Eiszapfen an der Traufe
        for (let k = 0; k < 7; k++) teil(bn, G.kegel4, C_EIS_H, -OX + 0.8 + k * ((2 * OX - 1.6) / 6), eave - 0.75, sz * (OZ + 0.1), Math.PI, 0, 0, 0.12, 0.5 + ((k * 7) % 5) * 0.12, 0.12);
      }
      // Kamin
      teil(bo, G.box, C_STEIN, 2.6, 7.6, -1.6, 0, 0, 0, 1.0, 3.0, 1.0);
      teil(bo, G.box, C_SCHNEE, 2.6, 9.15, -1.6, 0, 0, 0, 1.25, 0.32, 1.25);
      const kam = pt(2.6, 9.6, -1.6);
      rauch.push(kam[0], kam[1], kam[2], 0.32, 1.3);
      // Tür, Fenster mit Läden, Laterne
      teil(bn, G.box, C_HOLZ_D, 0, 2.15, 4.02, 0, 0, 0, 1.5, 2.4, 0.16);
      teil(bn, G.box, C_STEIN, 0, 1.0, 4.6, 0, 0, 0, 2.2, 0.3, 1.2);
      for (const wx of [-3, 3]) {
        teil(bn, G.box, C_HOLZ_D, wx, 2.9, 4.03, 0, 0, 0, 1.55, 1.35, 0.12);
        bf.quad(pt(wx - 0.6, 2.35, 4.11), pt(wx + 0.6, 2.35, 4.11), pt(wx + 0.6, 3.45, 4.11), pt(wx - 0.6, 3.45, 4.11), C_FENSTER);
        bf.quad(pt(wx - 0.05, 2.35, 4.12), pt(wx + 0.05, 2.35, 4.12), pt(wx + 0.05, 3.45, 4.12), pt(wx - 0.05, 3.45, 4.12), C_HOLZ_D);
        for (const sx of [-1, 1]) teil(bn, G.box, C_ROT, wx + sx * 1.15, 2.9, 4.08, 0, sx * 0.25, 0, 0.6, 1.35, 0.08);
        // Blumenkasten mit Schnee
        teil(bn, G.box, C_HOLZ_D, wx, 2.12, 4.25, 0, 0, 0, 1.5, 0.3, 0.4);
        teil(bn, G.box, C_SCHNEE, wx, 2.32, 4.25, 0, 0, 0, 1.5, 0.12, 0.42);
      }
      for (const sx of [-1, 1]) {
        bf.quad(pt(sx * 5.12, 2.35, sx * 0.6), pt(sx * 5.12, 2.35, -sx * 0.6), pt(sx * 5.12, 3.45, -sx * 0.6), pt(sx * 5.12, 3.45, sx * 0.6), C_FENSTER);
        teil(bn, G.box, C_HOLZ_D, sx * 5.05, 2.9, 0, 0, 0, 0, 0.12, 1.35, 1.55);
      }
      bf.quad(pt(1.05, 2.9, 4.2), pt(1.35, 2.9, 4.2), pt(1.35, 3.3, 4.2), pt(1.05, 3.3, 4.2), C_LICHT);
      teil(bn, G.box, C_DUNKEL, 1.2, 3.38, 4.18, 0, 0, 0, 0.42, 0.1, 0.25);
      {
        const sp = pt(0, 4.05, 4.18);
        const o = pt(0, 0, 0);
        const n = pt(0, 0, 1);
        schild(0, sp[0], sp[1], sp[2], n[0] - o[0], n[2] - o[2], 3.6, 0.6);
      }
      // Bank vor der Hütte
      teil(bn, G.box, C_HOLZ, -2.2, 0.85, 5.0, 0, 0, 0, 2.4, 0.15, 0.6);
      teil(bn, G.box, C_SCHNEE, -2.2, 0.97, 5.0, 0, 0, 0, 2.3, 0.1, 0.55);
      // Skier und Stöcke an der Wand
      const skiC = [C_ROT, C_GELB, C_BLAU];
      for (let k = 0; k < 3; k++) {
        for (const o of [0, 0.16]) teil(bn, G.box, skiC[k], 1.7 + k * 0.62 + o, 2.0, 4.25, -0.12, 0, 0.05, 0.09, 2.2, 0.04);
        teil(bn, G.box, C_DUNKEL, 1.95 + k * 0.62, 1.8, 4.3, -0.1, 0, -0.08, 0.05, 1.7, 0.05);
      }
      // Holzstapel an der Seite unter einem Schutzdach
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 5 - r; i++) {
          teil(bn, G.zyl6, (i + r) % 2 ? C_HOLZ_H : C_HOLZ, 5.9 + r * 0.0, 0.55 + r * 0.55, -3 + i * 0.6 + r * 0.3, Math.PI / 2, 0, 0, 0.28, 1.6, 0.28);
        }
      }
      teil(bo, G.box, C_HOLZ_D, 6.4, 2.6, -1.8, 0, 0, -0.25, 1.9, 0.12, 4.0);
      teil(bn, G.box, C_SCHNEE, 6.45, 2.8, -1.8, 0, 0, -0.25, 1.9, 0.28, 4.1);
      // Schneewehen an den Ecken
      for (const [ex, ez, es] of [
        [-5.4, -4.4, 1.6],
        [5.2, 4.4, 1.2],
        [-5.6, 3.0, 1.0],
      ])
        teil(bn, G.halb, C_SCHNEE, ex, 0.2, ez, 0, rnd(), 0, es * 1.6, es * 0.7, es * 1.3);
      // Fahnenmasten zur Bahn hin
      const fa: [RGB, RGB][] = [
        [C_ROT, [1, 1, 1]],
        [C_BLAU, C_GELB],
        [C_GRUEN, [1, 1, 1]],
      ];
      for (let k = 0; k < 3; k++) {
        const fxL = -4.5 + k * 4.5;
        const base = pt(fxL, 0, 6.6);
        const top = pt(fxL, 7.4, 6.6);
        rahmen(0, 0, 0, 0, 1);
        stab(bo, G.zyl6, C_STAHL, base, top, 0.09);
        rahmen(x, y, z, fwd, 1);
        const o = pt(0, 0, 0);
        const d = pt(1, 0, 0);
        fahne(top[0], top[1] - 0.1, top[2], d[0] - o[0], d[2] - o[2], 1.9, 1.15, fa[k][0], fa[k][1], k * 1.7);
      }
      sperre(x, z, 9.5);
      belege(x, z, 9);
    }
  }

  // === Gipfel rund um die Strecke =============================================================
  {
    const want = detail === 0 ? 6 : 8;
    for (let k = 0; k < 900 && gipfel.length < want; k++) {
      const a = rnd() * TAU;
      const d = world.radius * (0.55 + rnd() * 0.85);
      const cx = world.center.x + Math.cos(a) * d;
      const cz = world.center.z + Math.sin(a) * d;
      if (world.heightAt(cx, cz) > -12) continue;
      const H = 105 + rnd() * 75;
      const R0 = H * (0.55 + rnd() * 0.15);
      const p: Gipfel = { cx, cz, y0: -36, H, R0, rings: [] };
      let ok = true;
      for (let s = 0; s < T && ok; s += 3) {
        const dd = Math.hypot(t.px[s] - cx, t.pz[s] - cz) - t.wh[s] - RAND - 2;
        if (dd < R0 * 1.4 && p.y0 + p.H * (1 - Math.max(0, dd) / (R0 * 1.4)) > t.py[s] - 2) ok = false;
      }
      for (const q of gipfel) if (Math.hypot(q.cx - cx, q.cz - cz) < (q.R0 + R0) * 0.95) ok = false;
      if (ok) gipfel.push(p);
    }
    for (const p of gipfel) {
      const massiv = (cx: number, cz: number, H: number, R0: number, n: number, main: boolean): void => {
        const F = main ? [0, 0.22, 0.45, 0.66, 0.84, 0.95] : [0, 0.3, 0.6, 0.86];
        const RF = main ? [1, 0.78, 0.56, 0.36, 0.17, 0.06] : [1, 0.66, 0.34, 0.08];
        const jit: number[] = [];
        for (let i = 0; i < n; i++) jit.push(0.8 + rnd() * 0.4);
        const ring: V3[][] = [];
        const rot = rnd() * TAU;
        for (let j = 0; j < F.length; j++) {
          const r: V3[] = [];
          for (let i = 0; i < n; i++) {
            const a = rot + (i / n) * TAU + (rnd() - 0.5) * 0.18;
            const rr = R0 * RF[j] * (jit[i] * (0.85 + 0.3 * rnd()));
            r.push([cx + Math.cos(a) * rr, p.y0 + H * F[j] * (0.92 + 0.16 * rnd()), cz + Math.sin(a) * rr]);
          }
          ring.push(r);
        }
        if (main) p.rings = ring;
        const apex: V3 = [cx + (rnd() - 0.5) * R0 * 0.08, p.y0 + H, cz + (rnd() - 0.5) * R0 * 0.08];
        const ribs = Math.floor(rnd() * 3);
        const iceCol = Math.floor(rnd() * n);
        const farbe = (a: V3, b: V3, c: V3, i: number, j: number): RGB => {
          const up = upOf(a, b, c);
          const yy = (a[1] + b[1] + c[1]) / 3;
          const hf = (yy - p.y0) / H;
          if (main && j >= 1 && j <= 3 && (i === iceCol || i === (iceCol + 1) % n)) return j % 2 ? C_EIS : C_EIS_D;
          if ((i + ribs) % 3 === 0 && hf < 0.9) return j % 2 ? C_FELS_D : C_FELS;
          if (up > (hf > 0.5 ? 0.3 : 0.45)) return (i + j) % 2 ? C_SCHNEE : C_SCHNEE_B;
          return (i + j) % 2 ? C_FELS : C_FELS_H;
        };
        for (let j = 0; j + 1 < ring.length; j++) {
          for (let i = 0; i < n; i++) {
            const q = (i + 1) % n;
            const a = ring[j][i];
            const b = ring[j][q];
            const c = ring[j + 1][q];
            const d = ring[j + 1][i];
            // außen: gegen den Uhrzeigersinn von außen gesehen
            const col = farbe(a, b, c, i, j);
            const out: V3 = [(a[0] + b[0]) / 2 - cx, 0.2, (a[2] + b[2]) / 2 - cz];
            quadN(bo, a, b, c, d, out, col);
          }
        }
        const top = ring[ring.length - 1];
        for (let i = 0; i < n; i++) {
          const q = (i + 1) % n;
          const a = top[i];
          const b = top[q];
          const out: V3 = [(a[0] + b[0]) / 2 - cx, 0.4, (a[2] + b[2]) / 2 - cz];
          const ux = b[0] - a[0];
          const uy = b[1] - a[1];
          const uz = b[2] - a[2];
          const vx = apex[0] - a[0];
          const vy = apex[1] - a[1];
          const vz = apex[2] - a[2];
          const dd = (uy * vz - uz * vy) * out[0] + (uz * vx - ux * vz) * out[1] + (ux * vy - uy * vx) * out[2];
          const col = i % 2 ? C_SCHNEE : C_SCHNEE_B;
          if (dd >= 0) bo.tri(a, b, apex, col);
          else bo.tri(a, apex, b, col);
        }
      };
      massiv(p.cx, p.cz, p.H, p.R0, detail === 0 ? 9 : 12, true);
      if (detail > 0) {
        const nb = 1 + Math.floor(rnd() * 2);
        for (let b = 0; b < nb; b++) {
          const a = rnd() * TAU;
          const bx = p.cx + Math.cos(a) * p.R0 * 0.62;
          const bz = p.cz + Math.sin(a) * p.R0 * 0.62;
          const H2 = p.H * (0.5 + rnd() * 0.2);
          const R2 = p.R0 * 0.55;
          // Nebengipfel nur, wenn auch er der Strecke fern bleibt.
          let ok = true;
          for (let s = 0; s < T && ok; s += 3) {
            const dd = Math.hypot(t.px[s] - bx, t.pz[s] - bz) - t.wh[s] - RAND - 2;
            if (dd < R2 * 1.4 && p.y0 + H2 * (1 - Math.max(0, dd) / (R2 * 1.4)) > t.py[s] - 2) ok = false;
          }
          if (ok) massiv(bx, bz, H2, R2, 8, false);
        }
      }
    }
  }

  // === Gondelbahn: Talstation bei der Hütte, Bergstation an einem Gipfel ====================
  {
    // Talstation im Tal bei der Hütte; Bergstation an der Flanke eines Gipfels. Gesucht wird
    // ein Paar, dessen Seil überall hoch genug über Gelände, Gipfeln und Fahrbahnen bleibt.
    let V: V3 | null = null;
    let best: { M: V3; p: Gipfel; len: number } | null = null;
    for (let tries = 0; tries < 160 && !best; tries++) {
      const g = segM(30 + rnd() * 200);
      const hl = boden(...at(g, 30));
      const hr = boden(...at(g, -30));
      const side = hl >= hr ? 1 : -1;
      const [x, z] = at(g, side * (t.wh[g] + 22 + rnd() * 26), (rnd() - 0.5) * 10);
      if (!frei(x, z, 7) || belegt(x, z, 7)) continue;
      V = [x, boden(x, z), z];
      for (const p of gipfel) {
        const dx = V[0] - p.cx;
        const dz = V[2] - p.cz;
        const dl = Math.hypot(dx, dz);
        const yM = p.y0 + p.H * 0.48;
        const rM = Math.max(4, flanke(p, Math.atan2(dz, dx), yM) - 3);
        const M: V3 = [p.cx + (dx / dl) * rM, yM, p.cz + (dz / dl) * rM];
        const len = Math.hypot(M[0] - V[0], M[2] - V[2]);
        if (len < 150 || len > 480) continue;
        const yA = V[1] + 8.5;
        const yB = M[1] + 6;
        let ok = true;
        for (let s = 0; s <= len && ok; s += 3) {
          const f = s / len;
          const x = V[0] + (M[0] - V[0]) * f;
          const z = V[2] + (M[2] - V[2]) * f;
          const y = yA + (yB - yA) * f - Math.sin(Math.PI * f) * len * 0.012;
          const k = kante(x, z);
          if (k < 10 && y - 6.5 < bahnHoch(x, z, 12) + LUFT + 2) ok = false;
          if (s > 8 && s < len - 14 && boden(x, z) > y - (s < 40 ? 4 : 7)) ok = false;
          if (gipfelH(x, z, s > len - 40 ? p : undefined) > y - (s > len - 40 ? 0 : 8)) ok = false;
        }
        if (ok && (!best || Math.abs(len - 300) < Math.abs(best.len - 300))) best = { M, p, len };
      }
    }
    if (V && best) {
      const M = best.M;
      const dx = (M[0] - V[0]) / best.len;
      const dz = (M[2] - V[2]) / best.len;
      const yaw = yawOf(dx, dz);
      // Talstation
      rahmen(V[0], V[1], V[2], yaw, 1);
      teil(bo, G.box, C_STEIN, 0, 0.2, 0, 0, 0, 0, 10, 1.2, 13);
      teil(bo, G.box, rgb(0xd9dee8), 0, 3.4, -1.5, 0, 0, 0, 8, 5.4, 8);
      teil(bo, G.box, C_ROT, 0, 6.3, -1.5, 0, 0, 0, 8.6, 0.5, 8.6);
      teil(bo, G.box, C_SCHNEE, 0, 6.65, -1.5, 0, 0, 0, 8.4, 0.3, 8.4);
      bf.quad(pt(-3.2, 2.2, 2.52), pt(3.2, 2.2, 2.52), pt(3.2, 4.6, 2.52), pt(-3.2, 4.6, 2.52), rgb(0x9fd0ef));
      for (let k = -1; k <= 1; k++) teil(bn, G.box, C_STAHL_D, k * 1.6, 3.4, 2.55, 0, 0, 0, 0.12, 2.5, 0.1);
      // Stahlgerüst mit Umlenkrad
      for (const sx of [-1, 1]) for (const sz of [2.5, 5.5]) teil(bo, G.box, C_STAHL_D, sx * 2.6, 4.2, sz, 0, 0, 0, 0.35, 8.4, 0.35);
      teil(bo, G.box, C_STAHL, 0, 8.4, 4, 0, 0, 0, 6, 0.5, 4);
      teil(bo, G.zyl8, C_GELB, 0, 8.9, 4.5, 0, 0, 0, 2.7, 0.35, 2.7);
      {
        const sp = pt(0, 5.25, 2.6);
        const o = pt(0, 0, 0);
        const n = pt(0, 0, 1);
        schild(4, sp[0], sp[1], sp[2], n[0] - o[0], n[2] - o[2], 4.4, 0.62);
      }
      sperre(V[0], V[2], 9);
      belege(V[0], V[2], 9);
      // Bergstation: Plattform am Gipfel, halb im Fels
      rahmen(M[0], M[1], M[2], yaw + Math.PI, 1);
      teil(bo, G.box, C_FELS_D, 0, -6, -2, 0, 0, 0, 12, 14, 14);
      teil(bo, G.box, rgb(0xd9dee8), 0, 3.2, -2.5, 0, 0, 0, 8, 6.4, 8);
      teil(bo, G.box, C_ROT, 0, 6.6, -2.5, 0, 0, 0, 8.6, 0.5, 8.6);
      teil(bo, G.box, C_SCHNEE, 0, 6.95, -2.5, 0, 0, 0, 8.4, 0.3, 8.4);
      bf.quad(pt(-3.2, 2.2, 1.52), pt(3.2, 2.2, 1.52), pt(3.2, 4.6, 1.52), pt(-3.2, 4.6, 1.52), rgb(0x9fd0ef));
      teil(bo, G.box, C_STAHL, 0, 6.2, 3, 0, 0, 0, 6, 0.5, 3.5);
      teil(bo, G.zyl8, C_GELB, 0, 6.7, 3.4, 0, 0, 0, 2.7, 0.35, 2.7);
      // Seile: zwei Spuren, Stützen dazwischen
      const A0: V3 = [V[0] + dx * 4.5, V[1] + 8.5, V[2] + dz * 4.5];
      const B0: V3 = [M[0] - dx * 3.4, M[1] + 6, M[2] - dz * 3.4];
      const total = Math.hypot(B0[0] - A0[0], B0[2] - A0[2]);
      const knoten: V3[] = [A0];
      const nSt = Math.max(0, Math.floor(total / 85));
      for (let k = 1; k <= nSt; k++) {
        for (let tryF = 0; tryF < 7; tryF++) {
          const f = k / (nSt + 1) + (tryF % 2 ? 1 : -1) * Math.ceil(tryF / 2) * 0.03;
          const x = A0[0] + (B0[0] - A0[0]) * f;
          const z = A0[2] + (B0[2] - A0[2]) * f;
          const yc = A0[1] + (B0[1] - A0[1]) * f + 1.5;
          const gr = boden(x, z);
          if (!frei(x, z, 2.5) || yc - gr < 12 || gipfelH(x, z) > gr) continue;
          knoten.push([x, yc, z]);
          // Stütze: Gittermast, oben Querträger
          rahmen(0, 0, 0, 0, 1);
          const px = -dz;
          const pz = dx;
          for (const s of [-1, 1]) stab(bo, G.box, C_STAHL, [x + px * s * 2.2, gr - 0.5, z + pz * s * 2.2], [x + px * s * 0.6, yc - 0.6, z + pz * s * 0.6], 0.45);
          for (let q = 1; q < 4; q++) {
            const yy = gr + ((yc - gr) * q) / 4;
            const ww = 2.2 - 1.6 * (q / 4);
            stab(bn, G.box, C_STAHL_D, [x - px * ww, yy, z - pz * ww], [x + px * ww, yy, z + pz * ww], 0.2);
          }
          stab(bo, G.box, C_STAHL_D, [x - px * 3.2, yc - 0.4, z - pz * 3.2], [x + px * 3.2, yc - 0.4, z + pz * 3.2], 0.35);
          sperre(x, z, 3.5);
          break;
        }
      }
      knoten.push(B0);
      // Seilverlauf fein abtasten (mit Durchhang je Feld) – für Seil und Kabinen.
      for (const [sgn, X, Y, Z] of [
        [1, gondel.ax, gondel.ay, gondel.az],
        [-1, gondel.bx, gondel.by, gondel.bz],
      ] as [number, number[], number[], number[]][]) {
        const ox = -dz * 2.3 * sgn;
        const oz = dx * 2.3 * sgn;
        for (let k = 0; k + 1 < knoten.length; k++) {
          const a = knoten[k];
          const b = knoten[k + 1];
          const span = Math.hypot(b[0] - a[0], b[2] - a[2]);
          const n = 12;
          for (let q = k === 0 ? 0 : 1; q <= n; q++) {
            const f = q / n;
            X.push(a[0] + (b[0] - a[0]) * f + ox);
            Y.push(a[1] + (b[1] - a[1]) * f - Math.sin(Math.PI * f) * span * 0.018);
            Z.push(a[2] + (b[2] - a[2]) * f + oz);
          }
        }
      }
      let acc = 0;
      gondel.as.push(0);
      for (let i = 1; i < gondel.ax.length; i++) {
        acc += Math.hypot(gondel.ax[i] - gondel.ax[i - 1], gondel.ay[i] - gondel.ay[i - 1], gondel.az[i] - gondel.az[i - 1]);
        gondel.as.push(acc);
      }
      gondel.len = acc;
      gondel.ok = true;
      rahmen(0, 0, 0, 0, 1);
      for (const [X, Y, Z] of [
        [gondel.ax, gondel.ay, gondel.az],
        [gondel.bx, gondel.by, gondel.bz],
      ]) {
        for (let i = 0; i + 1 < X.length; i += 2) {
          const j = Math.min(X.length - 1, i + 2);
          stab(bo, G.kabel, C_DUNKEL, [X[i], Y[i], Z[i]], [X[j], Y[j], Z[j]], 0.11);
        }
      }
      // Dohlen kreisen über der Bergstation.
      dohlenAnker.push(M[0] - dx * 25, M[1] + 22, M[2] - dz * 25, 16);
    }
  }

  // === Grat: Gipfelkreuz, Steinmännchen, Wolkenfetzen darunter ===============================
  {
    // Längstes zusammenhängendes Stück ohne Bande auf beiden Seiten (Sprünge ausgenommen).
    let g0 = -1;
    let g1 = -1;
    for (let i = 0; i < NM; ) {
      const offen = (k: number): boolean => (t.edge[k] & (EDGE_OPEN_L | EDGE_OPEN_R)) === (EDGE_OPEN_L | EDGE_OPEN_R) && (t.edge[k] & EDGE_GAP) === 0;
      if (!offen(i)) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < NM && offen(j + 1)) j++;
      if (j - i > g1 - g0) {
        g0 = i;
        g1 = j;
      }
      i = j + 1;
    }
    if (g0 >= 0 && g1 - g0 > 10) {
      const gm = Math.floor((g0 + g1) / 2);
      const wh = t.wh[gm];
      // Gipfelkreuz auf einer Felsnase neben dem Grat (Seite mit dem tieferen Abgrund nach außen)
      const sides = [1, -1];
      const sc = boden(...at(gm, 22)) < boden(...at(gm, -22)) ? 1 : -1;
      for (const side of sides) {
        const kreuz = side === sc;
        const [x, z] = at(gm, side * (wh + RAND + 8), kreuz ? 12 : -8);
        if (kante(x, z) < RAND + 3) continue;
        const gr = boden(x, z);
        const top = t.py[gm] + (kreuz ? 2.6 : -0.6);
        rahmen(x, gr - 1, z, rnd() * TAU, 1);
        prisma(bo, 6, 4.6, 2.2, 0, top - gr + 1, C_FELS_D, null, rnd());
        prisma(bo, 6, 2.3, 1.2, top - gr + 0.98, top - gr + 1.6, C_SCHNEE, C_SCHNEE_B, rnd());
        const yT = top + 0.6;
        if (kreuz) {
          rahmen(x, yT, z, yawOf(t.tx[gm], t.tz[gm]), 1);
          teil(bo, G.box, C_HOLZ_D, 0, 2.3, 0, 0, 0, 0, 0.32, 4.6, 0.32);
          teil(bo, G.box, C_HOLZ_D, 0, 3.4, 0, 0, 0, 0, 2.6, 0.3, 0.3);
          teil(bn, G.box, C_SCHNEE, 0, 3.6, 0, 0, 0, 0, 2.6, 0.12, 0.34);
          teil(bn, G.okt, C_GELB, 0, 3.4, 0.2, 0, 0, Math.PI / 4, 0.35, 0.35, 0.1);
          // Fähnchen am Kreuz
          const pp = pt(1.25, 3.3, 0);
          const o = pt(0, 0, 0);
          const d = pt(0, 0, 1);
          fahne(pp[0], pp[1], pp[2], d[0] - o[0], d[2] - o[2], 0.9, 0.5, C_ROT, null, 0.4);
          dohlenAnker.push(x + rX(gm) * side * 18, t.py[gm] + 15, z + rZ(gm) * side * 18, 12);
        } else {
          // Steinmännchen
          rahmen(x, yT - 0.2, z, rnd() * TAU, 1);
          let yy = 0;
          for (let k = 0; k < 5; k++) {
            const r = 0.7 - k * 0.11;
            teil(bo, G.dode, k % 2 ? C_FELS_H : C_STEIN, (rnd() - 0.5) * 0.15, yy + r * 0.55, (rnd() - 0.5) * 0.15, rnd(), rnd() * TAU, 0, r, r * 0.6, r * 0.9);
            yy += r * 1.05;
          }
        }
        sperre(x, z, 5);
        belege(x, z, 5);
      }
      // weitere Steinmännchen am Rand des Abgrunds
      for (let k = 0; k < 3; k++) {
        const g = g0 + Math.floor(((k + 0.5) / 3) * (g1 - g0));
        const side = k % 2 ? 1 : -1;
        const [x, z] = at(g, side * (t.wh[g] + RAND + 2.2));
        if (kante(x, z) < RAND + 1) continue;
        const gr = boden(x, z);
        const top = Math.max(gr, t.py[g] - 2.5);
        rahmen(x, gr - 0.5, z, rnd() * TAU, 1);
        prisma(bo, 5, 1.8, 1.2, 0, top - gr + 0.5, C_FELS, C_SCHNEE, rnd());
        let yy = top - gr + 0.5;
        for (let q = 0; q < 4; q++) {
          const r = 0.5 - q * 0.08;
          teil(bo, G.dode, q % 2 ? C_FELS_H : C_STEIN, 0, yy + r * 0.5, 0, rnd(), rnd() * TAU, 0, r, r * 0.6, r * 0.9);
          yy += r * 1.0;
        }
        sperre(x, z, 2.5);
      }
      // Wolkenfetzen unterhalb des Grats, beidseits
      const nW = detail === 0 ? 5 : 9;
      for (let k = 0, tries = 0; k < nW && tries < 80; tries++) {
        const g = g0 - 25 + Math.floor(rnd() * (g1 - g0 + 50));
        const gg = ((g % NM) + NM) % NM;
        const side = rnd() < 0.5 ? 1 : -1;
        const u = side * (t.wh[gg] + 18 + rnd() * 36);
        const [x, z] = at(gg, u);
        const y = t.py[gg] - 3 - rnd() * 8;
        const s = 1.2 + rnd() * 0.9;
        if (boden(x, z) > y - 3 * s || kante(x, z) < RAND + 6 * s) continue;
        wolke(x, y, z, s, [t.tx[gg], 0, t.tz[gg]], rnd() * TAU);
        k++;
      }
    }
  }

  // === Eishöhle: Gletschertore an Ein- und Ausgang ========================================
  {
    let e0 = -1;
    let e1 = -1;
    for (let i = 0; i < NM; i++) {
      if (t.edge[i] & EDGE_TUNNEL) {
        if (e0 < 0) e0 = i;
        e1 = i;
      }
    }
    if (e0 >= 0) {
      for (const [g, dirW] of [
        [e0, -1],
        [e1, 1],
      ] as [number, number][]) {
        const wh = t.wh[g];
        const yr = t.py[g];
        const A = wh + 9.2;
        const B = 15;
        const nb = detail === 0 ? 11 : 15;
        for (let k = 0; k < nb; k++) {
          const a = (k / (nb - 1)) * Math.PI;
          let u = Math.cos(a) * A;
          const sz = 2.4 + rnd() * 1.1;
          let y = yr + Math.sin(a) * B + 0.5;
          if (k === 0 || k === nb - 1) u += Math.sign(u) * 0.5;
          const w = dirW * (1.6 + rnd() * 1.2);
          const [x, z] = at(g, u, w);
          // Nahe einer Fahrbahn (auch der Abzweigung nebenan) bleibt alles über LUFT.
          const dE = kanteOT(x, z);
          const nahY = t.py[nah];
          const ueber = dE < RAND + sz * 1.2;
          if (ueber && y - sz * 1.2 < nahY + LUFT) y = nahY + LUFT + sz * 1.2;
          if (ueber && Math.abs(u) > wh + RAND + sz) continue;
          const gy = boden(x, z);
          const yy = Math.max(y, gy + sz * 0.4);
          rahmen(x, yy, z, rnd() * TAU, 1);
          teil(bo, rnd() < 0.5 ? G.ico0 : G.dode, pick([C_EIS, C_EIS_D, C_EIS, C_EIS_H]), 0, 0, 0, rnd(), rnd() * TAU, rnd(), sz * 1.15, sz, sz * 1.05);
          // Säulen bis zum Boden an den Füßen
          if (!ueber && yy - sz > gy) {
            rahmen(x, gy - 0.5, z, rnd() * TAU, 1);
            prisma(bo, 6, sz * 0.95, sz * 0.8, 0, yy - gy + 0.5, C_EIS_D, null, rnd());
          }
          // große Zapfen am oberen Bogen
          if (Math.sin(a) > 0.35) {
            const nz = 1 + Math.floor(rnd() * 2);
            for (let q = 0; q < nz; q++) {
              const ux = u + (rnd() - 0.5) * sz;
              const hang = yy - sz * 0.7;
              const [ix, iz] = at(g, ux, w + (rnd() - 0.5) * 1.2);
              const over = kanteOT(ix, iz) < RAND + 0.8;
              const minTip = over ? Math.max(yr, t.py[nah]) + LUFT : boden(ix, iz) + 1.5;
              const len = Math.min(2.4 + rnd() * 3.4, hang - minTip);
              if (len < 0.8) continue;
              rahmen(ix, hang, iz, rnd() * TAU, 1);
              teil(bo, G.kegel5, q % 2 ? C_EIS_H : C_EIS, 0, -len / 2, 0, Math.PI, 0, 0, 0.45 + len * 0.08, len, 0.45 + len * 0.08);
            }
          }
        }
        // Seracs: blaue Eistürme seitlich vor dem Tor
        for (const su of [-1, 1]) {
          for (let k = 0; k < (detail === 0 ? 2 : 3); k++) {
            const u = su * (A + 3 + k * 4.5 + rnd() * 2);
            const w = dirW * (4 + k * 5 + rnd() * 3);
            const [x, z] = at(g, u, w);
            if (kanteOT(x, z) < RAND + 3.5 || gesperrt(x, z, 2)) continue;
            const gy = boden(x, z);
            const h = 5 + rnd() * 7;
            rahmen(x, gy - 0.5, z, rnd() * TAU, 1, (rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.15);
            prisma(bo, 5, 2.4 + rnd(), 1.0 + rnd() * 0.6, 0, h, k % 2 ? C_EIS : C_EIS_D, C_SCHNEE, rnd());
            prisma(bo, 5, 1.3, 0.05, h - 0.02, h + 1.4, C_SCHNEE, null, rnd());
            sperre(x, z, 3);
          }
        }
        // Platz um das Tor freihalten (für Bäume und Felsen)
        for (let k = 0; k <= 6; k++) {
          const a = (k / 6) * Math.PI;
          const [x, z] = at(g, Math.cos(a) * A, dirW * 2);
          sperre(x, z, 5);
        }
      }
    }
  }

  // === Zugefrorener See an der Abzweigung =====================================================
  const br = t.branches.find((b) => (t.surf[b.first + Math.floor(b.count / 2)] ?? -1) === SURFACE_INDEX.ice) ?? t.branches[0];
  if (br) {
    seeCell = detail === 0 ? 4 : detail === 1 ? 3 : 2.5;
    let bx0 = Infinity;
    let bx1 = -Infinity;
    let bz0 = Infinity;
    let bz1 = -Infinity;
    for (let g = br.first; g < br.first + br.count; g++) {
      bx0 = Math.min(bx0, t.px[g]);
      bx1 = Math.max(bx1, t.px[g]);
      bz0 = Math.min(bz0, t.pz[g]);
      bz1 = Math.max(bz1, t.pz[g]);
    }
    seeX0 = bx0 - 36;
    seeZ0 = bz0 - 36;
    const nx = Math.ceil((bx1 + 36 - seeX0) / seeCell);
    const nz = Math.ceil((bz1 + 36 - seeZ0) / seeCell);
    // Abstand zur Abzweigung und Rand-Info je Zelle
    const dB = new Float32Array(nx * nz).fill(Infinity);
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const x = seeX0 + (ix + 0.5) * seeCell;
        const z = seeZ0 + (iz + 0.5) * seeCell;
        // Abstand zu allen Fahrbahnen (Hauptstrecke mit Tunnelfels) – zuerst, das ist schnell.
        const kk = kante(x, z);
        if (kk < RAND + seeCell * 0.75 || kk > 26) continue;
        let best = Infinity;
        let bg = br.first;
        for (let g = br.first; g < br.first + br.count; g++) {
          const d = Math.hypot(x - t.px[g], z - t.pz[g]) - t.wh[g];
          if (d < best) {
            best = d;
            bg = g;
          }
        }
        const f = (bg - br.first) / br.count;
        if (best < RAND + seeCell * 0.75 || best > 26 || f < 0.1 || f > 0.92) continue;
        const y = boden(x, z);
        if (y < t.py[bg] - 3.2 || y > t.py[bg] + 0.6) continue;
        dB[iz * nx + ix] = best;
        seeZellen.add(seeKey(ix, iz));
      }
    }
    // Eis: dunkles Schwarzeis mit hellen Rissen; die helle Fahrbahn hebt sich davon ab.
    const vy = (ix: number, iz: number): number => boden(seeX0 + ix * seeCell, seeZ0 + iz * seeCell) + 0.16;
    const randPkt: number[] = [];
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        if (!seeZellen.has(seeKey(ix, iz))) continue;
        const x0 = seeX0 + ix * seeCell;
        const z0 = seeZ0 + iz * seeCell;
        const a: V3 = [x0, vy(ix, iz), z0];
        const b: V3 = [x0 + seeCell, vy(ix + 1, iz), z0];
        const c: V3 = [x0 + seeCell, vy(ix + 1, iz + 1), z0 + seeCell];
        const d: V3 = [x0, vy(ix, iz + 1), z0 + seeCell];
        const n = noise(x0 * 0.07, z0 * 0.07);
        quadUp(bf, a, b, c, d, n > 0.56 ? C_SEE_D : n < 0.3 ? mixRgb(C_SEE, C_EIS_D, 0.35) : C_SEE);
        // Rand nach außen (nicht zur Fahrbahn): Schilf und Schneewehen
        const edge = !seeZellen.has(seeKey(ix + 1, iz)) || !seeZellen.has(seeKey(ix - 1, iz)) || !seeZellen.has(seeKey(ix, iz + 1)) || !seeZellen.has(seeKey(ix, iz - 1));
        if (edge && dB[iz * nx + ix] > 4.5) randPkt.push(x0 + seeCell / 2, z0 + seeCell / 2);
      }
    }
    const lakeY = (x: number, z: number): number => boden(x, z) + 0.17;
    // Risse
    for (let k = 0; k < (detail === 0 ? 10 : 22); k++) {
      let x = seeX0 + rnd() * nx * seeCell;
      let z = seeZ0 + rnd() * nz * seeCell;
      if (!imSee(x, z)) continue;
      let a = rnd() * TAU;
      for (let q = 0; q < 4; q++) {
        const l = 2.5 + rnd() * 3;
        const x2 = x + Math.cos(a) * l;
        const z2 = z + Math.sin(a) * l;
        if (!imSee(x2, z2)) break;
        const px = -Math.sin(a) * 0.09;
        const pz = Math.cos(a) * 0.09;
        quadUp(bf, [x - px, lakeY(x, z) + 0.03, z - pz], [x2 - px, lakeY(x2, z2) + 0.03, z2 - pz], [x2 + px, lakeY(x2, z2) + 0.03, z2 + pz], [x + px, lakeY(x, z) + 0.03, z + pz], C_EIS_H);
        x = x2;
        z = z2;
        a += (rnd() - 0.5) * 1.4;
      }
    }
    // Schneeflecken auf dem Eis
    for (let k = 0; k < (detail === 0 ? 6 : 12); k++) {
      const x = seeX0 + rnd() * nx * seeCell;
      const z = seeZ0 + rnd() * nz * seeCell;
      if (!imSee(x, z)) continue;
      const r = 1.2 + rnd() * 2.2;
      const ctr: V3 = [x, lakeY(x, z) + 0.04, z];
      const n = 7;
      for (let q = 0; q < n; q++) {
        const a0 = (q / n) * TAU;
        const a1 = ((q + 1) / n) * TAU;
        const r0 = r * (0.7 + 0.3 * Math.sin(q * 2.3 + k));
        const r1 = r * (0.7 + 0.3 * Math.sin((q + 1) * 2.3 + k));
        const p0: V3 = [x + Math.cos(a0) * r0, ctr[1], z + Math.sin(a0) * r0];
        const p1: V3 = [x + Math.cos(a1) * r1, ctr[1], z + Math.sin(a1) * r1];
        if (!imSee(p0[0], p0[2]) || !imSee(p1[0], p1[2])) continue;
        bf.tri(ctr, p1, p0, C_SCHNEE_B);
      }
    }
    // Schilf und Schneewehen am Ufer
    {
      const nR = randPkt.length / 2;
      const want = detail === 0 ? 14 : 30;
      for (let k = 0; k < Math.min(want, nR); k++) {
        const q = Math.floor(((k + rnd() * 0.8) * nR) / Math.min(want, nR)) % nR;
        const x = randPkt[q * 2] + (rnd() - 0.5) * seeCell;
        const z = randPkt[q * 2 + 1] + (rnd() - 0.5) * seeCell;
        const kk = kante(x, z);
        if (kk < RAND + 1.2) continue;
        const y = lakeY(x, z);
        rahmen(x, y, z, rnd() * TAU, 1);
        const n = 4 + Math.floor(rnd() * 3);
        for (let s = 0; s < n; s++) {
          const a = rnd() * TAU;
          const d = rnd() * 0.6;
          const h = 1.1 + rnd() * 0.9;
          const lean = (rnd() - 0.5) * 0.5;
          const b0 = pt(Math.cos(a) * d - 0.06, 0, Math.sin(a) * d);
          const b1 = pt(Math.cos(a) * d + 0.06, 0, Math.sin(a) * d);
          const tp = pt(Math.cos(a) * d + lean, h, Math.sin(a) * d + lean * 0.5);
          bn.tri(b0, b1, tp, s % 2 ? C_SCHILF : C_SCHILF_D);
          if (s % 2 === 0) teil(bn, G.box, C_HOLZ_D, Math.cos(a) * d + lean * 0.9, h * 0.88, Math.sin(a) * d + lean * 0.45, 0, 0, 0, 0.1, 0.3, 0.1);
        }
        if (k % 3 === 0 && kk > RAND + 3.4) teil(bn, G.halb, C_SCHNEE, (rnd() - 0.5) * 2, -0.05, (rnd() - 0.5) * 2, 0, rnd(), 0, 1.6, 0.45, 1.1);
        belege(x, z, 1);
      }
    }
    // Plätze auf dem Eis abseits der Fahrbahn
    const eisPlatz = (minD: number, r: number): [number, number] | null => {
      for (let k = 0; k < 300; k++) {
        const ix = Math.floor(rnd() * nx);
        const iz = Math.floor(rnd() * nz);
        if (!seeZellen.has(seeKey(ix, iz)) || dB[iz * nx + ix] < minD + r) continue;
        const x = seeX0 + (ix + 0.5) * seeCell;
        const z = seeZ0 + (iz + 0.5) * seeCell;
        if (kante(x, z) < RAND + r || belegt(x, z, r) || gesperrt(x, z, r)) continue;
        // ganz auf dem Eis
        if (!imSee(x + r, z) || !imSee(x - r, z) || !imSee(x, z + r) || !imSee(x, z - r)) continue;
        return [x, z];
      }
      return null;
    };
    // Eisfischer-Hütten mit Loch, Fähnchen und Ofenrohr
    const hutC = [C_ROT, C_BLAU, C_GELB, C_GRUEN];
    for (let k = 0; k < (detail === 0 ? 3 : 4); k++) {
      const p = eisPlatz(RAND + 1, 2.4);
      if (!p) break;
      const [x, z] = p;
      const y = lakeY(x, z) - 0.05;
      const yaw = rnd() * TAU;
      rahmen(x, y, z, yaw, 1);
      const c = hutC[k % hutC.length];
      teil(bo, G.box, c, 0, 1.15, 0, 0, 0, 0, 2.2, 2.3, 2.0);
      teil(bn, G.box, shade(c, 0.7), 0, 0.6, 1.01, 0, 0, 0, 2.2, 0.12, 0.02);
      teil(bn, G.box, C_DUNKEL, 0.35, 0.95, 1.02, 0, 0, 0, 0.7, 1.6, 0.06);
      // Pultdach mit Schnee
      teil(bo, G.box, C_HOLZ_D, 0, 2.45, 0, 0.18, 0, 0, 2.6, 0.14, 2.6);
      teil(bn, G.box, C_SCHNEE, 0, 2.6, -0.02, 0.18, 0, 0, 2.55, 0.25, 2.5);
      teil(bo, G.zyl6, C_STAHL_D, -0.6, 3.0, -0.5, 0, 0, 0, 0.12, 1.3, 0.12);
      const r = pt(-0.6, 3.75, -0.5);
      rauch.push(r[0], r[1], r[2], 0.9, 0.55);
      // Loch im Eis und Fähnchen am Stock
      const hx = 1.9;
      const ctr = pt(hx, 0.07, 1.6);
      for (let q = 0; q < 6; q++) {
        const a0 = (q / 6) * TAU;
        const a1 = ((q + 1) / 6) * TAU;
        bf.tri(ctr, pt(hx + Math.cos(a1) * 0.45, 0.07, 1.6 + Math.sin(a1) * 0.45), pt(hx + Math.cos(a0) * 0.45, 0.07, 1.6 + Math.sin(a0) * 0.45), C_DUNKEL);
      }
      const sb = pt(hx + 0.7, 0, 1.6);
      const st = pt(hx + 0.7, 1.5, 1.6);
      rahmen(0, 0, 0, 0, 1);
      stab(bn, G.box, C_HOLZ_D, sb, st, 0.05);
      fahne(st[0], st[1], st[2], Math.cos(yaw), -Math.sin(yaw), 0.55, 0.35, k % 2 ? C_ROT : C_GELB, null, k * 2.1);
      sperre(x, z, 3.2);
      belege(x, z, 3.2);
    }
    // Fähnchen-Reihen (Markierung abseits der Bahn)
    for (let k = 0; k < (detail === 0 ? 4 : 8); k++) {
      const p = eisPlatz(RAND + 0.5, 0.5);
      if (!p) break;
      const [x, z] = p;
      const y = lakeY(x, z);
      rahmen(0, 0, 0, 0, 1);
      stab(bn, G.box, C_DUNKEL, [x, y - 0.1, z], [x, y + 1.6, z], 0.06);
      const a = 0.6;
      fahne(x, y + 1.6, z, Math.cos(a), Math.sin(a), 0.6, 0.4, k % 2 ? C_ROT : C_GELB, null, k * 1.3);
      belege(x, z, 0.8);
    }
    // Eingefrorenes Ruderboot
    {
      const p = eisPlatz(RAND + 2, 2.6);
      if (p) {
        const [x, z] = p;
        const y = lakeY(x, z) - 0.35;
        rahmen(x, y, z, rnd() * TAU, 1, 0.08, 0.16);
        const L = 2.3;
        const W = 0.85;
        const top: V3[] = [pt(0, 0.75, L + 0.3), pt(W, 0.7, L * 0.4), pt(W * 0.85, 0.72, -L), pt(-W * 0.85, 0.72, -L), pt(-W, 0.7, L * 0.4)];
        const bot: V3[] = [pt(0, 0, L - 0.2), pt(W * 0.55, -0.2, L * 0.3), pt(W * 0.5, -0.1, -L + 0.2), pt(-W * 0.5, -0.1, -L + 0.2), pt(-W * 0.55, -0.2, L * 0.3)];
        for (let k = 0; k < 5; k++) {
          const j = (k + 1) % 5;
          bo.quad(bot[k], bot[j], top[j], top[k], k === 2 ? C_HOLZ_D : rgb(0x2f8f86));
          bo.quad(top[k], top[j], bot[j], bot[k], C_HOLZ);
        }
        teil(bn, G.box, C_HOLZ_H, 0, 0.45, 0.4, 0, 0, 0, W * 1.6, 0.1, 0.4);
        teil(bn, G.box, C_HOLZ_H, 0, 0.45, -1.2, 0, 0, 0, W * 1.6, 0.1, 0.4);
        teil(bn, G.halb, C_SCHNEE, 0, 0.25, -0.4, 0, 0, 0, 0.7, 0.4, 1.6);
        teil(bo, G.box, C_HOLZ_H, 1.2, 0.5, 0, 0.2, 0.3, 1.2, 0.08, 2.4, 0.08);
        sperre(x, z, 3);
        belege(x, z, 3);
      }
    }
  }

  // === Bobbahn: Verschalung, Zeitmess-Tor, Flutlicht, Fahnenketten, Tribüne ===================
  {
    const bob: number[] = [];
    for (let i = 0; i < NM; i++) if (t.surf[i] === SURFACE_INDEX.ice && t.wh[i] < 7 && (t.edge[i] & EDGE_TUNNEL) === 0) bob.push(i);
    if (bob.length > 40) {
      const b0 = bob[0];
      const b1 = bob[bob.length - 1];
      const inBob = (g: number): boolean => g >= b0 && g <= b1;
      // Tribüne: an der stärksten Kurve im mittleren Teil, außen.
      let tg = -1;
      let tc = 0;
      for (let g = b0 + 40; g < b1 - 30; g++) {
        const p = g - 6;
        const n = g + 6;
        const turn = rX(g) * (t.px[n] - t.px[p]) + rZ(g) * (t.pz[n] - t.pz[p]);
        if (Math.abs(turn) > Math.abs(tc)) {
          const [x, z] = at(g, -Math.sign(turn) * (t.wh[g] + 9));
          if (!inLawine(x, z, 10)) {
            tc = turn;
            tg = g;
          }
        }
      }
      const tribSide = tc > 0 ? -1 : 1;
      if (tg >= 0) {
        const wh = t.wh[tg];
        const [x, z] = at(tg, tribSide * (wh + RAND + 5));
        const yaw = yawOf(-rX(tg) * tribSide, -rZ(tg) * tribSide);
        // alle Ecken (samt Dach und Bande) mit Abstand zur Bahn
        rahmen(x, 0, z, yaw, 1);
        let frei4 = true;
        for (const [cx2, cz2] of [
          [-7.5, 2.4],
          [7.5, 2.4],
          [-7.5, -5],
          [7.5, -5],
          [0, 2.4],
        ]) {
          const c = pt(cx2, 0, cz2);
          if (kante(c[0], c[2]) < RAND + 0.3) frei4 = false;
        }
        if (frei4) {
          const gr = boden(x, z);
          rahmen(x, gr, z, yaw, 1);
          const L = 14;
          // Stufen (lokal z zur Bahn, x längs)
          for (let s = 0; s < 4; s++) {
            const zz = 1.2 - s * 1.5;
            const yy = 0.5 + s * 0.85;
            teil(bo, G.box, s % 2 ? C_HOLZ : C_HOLZ_H, 0, yy / 2, zz, 0, 0, 0, L, yy, 1.5);
            teil(bn, G.box, C_SCHNEE, 0, yy + 0.04, zz + 0.45, 0, 0, 0, L, 0.08, 0.5);
          }
          // Dach auf Stützen
          for (const sx of [-1, 1]) {
            teil(bo, G.box, C_STAHL_D, sx * (L / 2 - 0.3), 3.3, -4.0, 0, 0, 0, 0.3, 6.6, 0.3);
            teil(bo, G.box, C_STAHL_D, sx * (L / 2 - 0.3), 2.6, 1.6, 0, 0, 0, 0.3, 5.2, 0.3);
          }
          teil(bo, G.box, C_ROT, 0, 6.2, -1.2, -0.22, 0, 0, L + 0.8, 0.3, 6.6);
          teil(bn, G.box, C_SCHNEE, 0, 6.42, -1.25, -0.22, 0, 0, L + 0.6, 0.22, 6.4);
          // Bande mit Werbefläche (ohne Schrift: Farbfelder)
          for (let k = 0; k < 5; k++) teil(bn, G.box, k % 2 ? C_GELB : C_BLAU, -L / 2 + 1.4 + k * 2.8, 0.5, 2.1, 0, 0, 0, 2.6, 1.0, 0.12);
          // Zuschauer
          const nF = detail === 0 ? 10 : 16;
          for (let f = 0; f < nF; f++) {
            const s = f % 4;
            const fx = -L / 2 + 1 + ((f * 3.7) % (L - 2)) + (rnd() - 0.5) * 0.4;
            const zz = 1.2 - s * 1.5;
            const yy = 0.5 + s * 0.85;
            const jc = pick(JACKEN);
            teil(bo, G.box, jc, fx, yy + 0.55, zz, 0, (rnd() - 0.5) * 0.4, 0, 0.6, 1.1, 0.4);
            teil(bo, G.okt, C_HAUT, fx, yy + 1.35, zz, 0, rnd(), 0, 0.28, 0.32, 0.28);
            teil(bn, G.kegel5, pick(JACKEN), fx, yy + 1.62, zz, 0, 0, 0, 0.3, 0.42, 0.3);
            if (rnd() < 0.45) {
              // Arme hoch
              teil(bn, G.box, jc, fx - 0.38, yy + 1.3, zz, 0, 0, 0.35, 0.16, 0.85, 0.16);
              teil(bn, G.box, jc, fx + 0.38, yy + 1.3, zz, 0, 0, -0.35, 0.16, 0.85, 0.16);
            } else if (rnd() < 0.4) {
              // Fähnchen schwenken
              const hp = pt(fx + 0.35, yy + 1.9, zz);
              const o = pt(0, 0, 0);
              const d = pt(1, 0, 0);
              teil(bn, G.box, C_DUNKEL, fx + 0.35, yy + 1.4, zz, 0, 0, 0, 0.05, 1.0, 0.05);
              fahne(hp[0], hp[1], hp[2], d[0] - o[0], d[2] - o[2], 0.5, 0.32, pick(FAHNEN), null, f * 1.9);
            }
          }
          sperre(x, z, 9);
          belege(x, z, 9);
        }
      }
      // Zeitmess-Tor kurz nach dem Start der Bobbahn
      {
        const g = Math.min(b1, b0 + 16);
        const wh = t.wh[g];
        const yr = t.py[g];
        const u = wh + RAND + 0.6;
        const yaw = yawOf(t.tx[g], t.tz[g]);
        for (const su of [-1, 1]) {
          const [x, z] = at(g, su * u);
          const gr = boden(x, z);
          rahmen(x, gr, z, yaw, 1);
          teil(bo, G.box, C_ROT, 0, (yr + 13 - gr) / 2, 0, 0, 0, 0, 1.0, yr + 13 - gr, 1.0);
          for (let k = 0; k < 4; k++) teil(bn, G.box, [1, 1, 1], 0, yr + 1 + k * 3 - gr, 0, 0, 0, 0, 1.04, 0.8, 1.04);
          sperre(x, z, 2);
        }
        const [mx, mz] = at(g, 0);
        rahmen(mx, yr, mz, yaw, 1);
        // Balken (Unterkante über LUFT)
        teil(bo, G.box, C_DUNKEL, 0, LUFT + 1.0, 0, 0, 0, 0, 2 * u + 1.2, 1.6, 0.9);
        const o = pt(0, 0, 0);
        const fw = pt(0, 0, -1);
        const nX = fw[0] - o[0];
        const nZ = fw[2] - o[2];
        const sp = pt(-u * 0.45, LUFT + 1.0, -0.46);
        schild(2, sp[0], sp[1], sp[2], nX, nZ, 5.5, 1.1);
        const sp2 = pt(u * 0.45, LUFT + 1.0, -0.46);
        schild(3, sp2[0], sp2[1], sp2[2], nX, nZ, 5.0, 1.1);
        const sp3 = pt(0, LUFT + 1.0, 0.46);
        schild(2, sp3[0], sp3[1], sp3[2], -nX, -nZ, 6, 1.1);
        // Lampen am Tor
        for (let k = -2; k <= 2; k++) bf.quad(pt(k * 2.2 - 0.3, LUFT + 2.0, -0.2), pt(k * 2.2 + 0.3, LUFT + 2.0, -0.2), pt(k * 2.2 + 0.3, LUFT + 2.4, -0.2), pt(k * 2.2 - 0.3, LUFT + 2.4, -0.2), k % 2 ? C_ROT : C_GRUEN);
        teil(bn, G.box, C_SCHNEE, 0, LUFT + 1.9, 0, 0, 0, 0, 2 * u + 1.2, 0.2, 0.95);
      }
      // Verschalung außen: Bretterwand mit dunkler Kappe, Pfosten; Fahnenketten; Flutlicht.
      rahmen(0, 0, 0, 0, 1);
      const step = detail === 0 ? 4 : 3;
      for (const su of [-1, 1]) {
        let prev: V3 | null = null;
        let prevG = -1;
        for (let g = b0; g <= b1; g += step) {
          const u = su * (t.wh[g] + RAND + 0.4);
          const [x, z] = at(g, u);
          const ok = inBob(g) && kante(x, z) >= RAND && !inLawine(x, z, 0.5) && !gesperrt(x, z, 0.3);
          if (!ok) {
            prev = null;
            continue;
          }
          const gr = boden(x, z);
          const cur: V3 = [x, gr, z];
          if (prev && g - prevG <= step) {
            const H = 1.5;
            const a: V3 = [prev[0], prev[1] - 0.3, prev[2]];
            const b: V3 = [cur[0], cur[1] - 0.3, cur[2]];
            const c: V3 = [cur[0], cur[1] + H, cur[2]];
            const d: V3 = [prev[0], prev[1] + H, prev[2]];
            const n: V3 = [-rX(g) * su, 0, -rZ(g) * su];
            quadN(bn, a, b, c, d, n, (g / step) % 2 ? C_HOLZ : C_HOLZ_H);
            quadN(bn, a, b, c, d, [-n[0], 0, -n[2]], C_HOLZ_D);
            // Kappe
            const ox = -n[0] * 0.3;
            const oz = -n[2] * 0.3;
            quadUp(bn, [d[0], d[1] + 0.05, d[2]], [c[0], c[1] + 0.05, c[2]], [c[0] + ox, c[1] + 0.05, c[2] + oz], [d[0] + ox, d[1] + 0.05, d[2] + oz], C_DUNKEL);
            // Schneewall dahinter
            if ((g / step) % 3 === 0) teil(bn, G.halb, C_SCHNEE_B, (a[0] + b[0]) / 2 + ox * 3, (a[1] + b[1]) / 2 + 0.2, (a[2] + b[2]) / 2 + oz * 3, 0, yawOf(t.tx[g], t.tz[g]), 0, 1.4, 1.2, step * 0.8);
          }
          if ((g / step) % 2 === 0) teil(bn, G.box, C_HOLZ_D, x, gr + 0.7, z, 0, yawOf(t.tx[g], t.tz[g]), 0, 0.28, 2.0, 0.28);
          belege(x, z, 0.8);
          prev = cur;
          prevG = g;
        }
      }
      // Flutlichtmasten, abwechselnd links und rechts, mit Fahnenketten zum nächsten Pfosten
      let side = 1;
      const nMast = detail === 0 ? 4 : 6;
      for (let k = 0; k < nMast; k++) {
        const g = b0 + Math.floor(((k + 0.6) / nMast) * (b1 - b0));
        const wh = t.wh[g];
        const u = side * (wh + RAND + 2.2);
        const [x, z] = at(g, u);
        side = -side;
        if (kante(x, z) < RAND + 1 || inLawine(x, z, 1) || gesperrt(x, z, 1)) continue;
        const gr = boden(x, z);
        const H = 15;
        const yaw = yawOf(-rX(g) * Math.sign(u), -rZ(g) * Math.sign(u));
        rahmen(x, gr, z, yaw, 1);
        teil(bo, G.box, C_STAHL, 0, H / 2, 0, 0, 0, 0, 0.5, H, 0.5);
        teil(bo, G.box, C_STAHL_D, 0, H + 0.2, 0.3, -0.35, 0, 0, 3.2, 1.4, 0.4);
        for (let q = 0; q < 4; q++) {
          const lx = -1.15 + q * 0.77;
          bf.quad(pt(lx - 0.3, H - 0.25, 0.56), pt(lx + 0.3, H - 0.25, 0.56), pt(lx + 0.3, H + 0.6, 0.83), pt(lx - 0.3, H + 0.6, 0.83), C_LICHT);
        }
        sperre(x, z, 1.5);
        // Fahnenkette entlang der Bahn zu einem Pfosten 14 m weiter
        const g2 = Math.min(b1, g + 14);
        const [x2, z2] = at(g2, Math.sign(u) * (t.wh[g2] + RAND + 2.2));
        if (kante(x2, z2) < RAND + 0.5 || inLawine(x2, z2, 1)) continue;
        const gr2 = boden(x2, z2);
        rahmen(0, 0, 0, 0, 1);
        stab(bo, G.box, C_HOLZ_D, [x2, gr2 - 0.2, z2], [x2, gr2 + 5.4, z2], 0.2);
        const a: V3 = [x, gr + 7, z];
        const b: V3 = [x2, gr2 + 5.3, z2];
        const nP = 9;
        let pp: V3 = a;
        for (let q = 1; q <= nP; q++) {
          const f = q / nP;
          const np: V3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - Math.sin(Math.PI * f) * 1.2, a[2] + (b[2] - a[2]) * f];
          stab(bn, G.box, C_DUNKEL, pp, np, 0.04);
          // Wimpel
          const dx = np[0] - pp[0];
          const dz = np[2] - pp[2];
          const dl = Math.hypot(dx, dz) || 1;
          const m: V3 = [(pp[0] + np[0]) / 2, (pp[1] + np[1]) / 2 - 0.85, (pp[2] + np[2]) / 2];
          const nn: V3 = [-dz / dl, 0, dx / dl];
          wTri(pp, m, np, FAHNEN[q % FAHNEN.length], 0, 1, 0, 0.35, q * 0.9 + k, 3.4, nn, 0);
          pp = np;
        }
      }
    }
  }

  // === Schlucht: Felswände an den Kanten, Hängebrücke daneben =================================
  {
    let g0 = -1;
    let g1 = -1;
    for (let i = 0; i < NM; i++) {
      if (t.edge[i] & EDGE_GAP) {
        if (g0 < 0) g0 = i;
        g1 = i;
      }
    }
    if (g0 >= 0) {
      const gm = Math.floor((g0 + g1) / 2);
      const halfGap = ((g1 - g0) / 2) * t.step + 0.5;
      const wh = t.wh[gm];
      const yr = t.py[gm];
      // Felswände: Lippen der Schlucht beidseits der Bahn, vor und hinter der Lücke
      for (const su of [-1, 1]) {
        for (const sw of [-1, 1]) {
          for (let k = 0; k < (detail === 0 ? 4 : 6); k++) {
            const u = su * (wh + RAND + 3 + k * 4.2 + rnd() * 1.5);
            const w = sw * (halfGap + 2.5 + rnd() * 3);
            const [x, z] = at(gm, u, w);
            if (kante(x, z) < RAND + 2.6 || gesperrt(x, z, 2.5)) continue;
            const gr = boden(x, z);
            const top = yr - 0.6 - k * 0.5 - rnd() * 1.2;
            if (top - gr < 1.5) continue;
            rahmen(x, gr - 1, z, yawOf(t.tx[gm], t.tz[gm]) + (rnd() - 0.5) * 0.4, 1);
            prisma(bo, 5, 3.4, 2.6, 0, top - gr + 1, k % 2 ? C_FELS_D : C_FELS, null, rnd());
            prisma(bo, 5, 2.7, 1.6, top - gr + 0.98, top - gr + 1.7, C_SCHNEE, C_SCHNEE_B, rnd());
            belege(x, z, 2.8);
          }
        }
      }
      // Hängebrücke parallel zum Sprung, auf einer Seite
      const sc = kante(...at(gm, wh + 13)) > kante(...at(gm, -wh - 13)) ? 1 : -1;
      const u = sc * (wh + RAND + 6.5);
      const wA = -(halfGap + 9);
      const wB = halfGap + 9;
      const [ax, az] = at(gm, u, wA);
      const [bx, bz] = at(gm, u, wB);
      if (kante(ax, az) >= RAND + 2 && kante(bx, bz) >= RAND + 2) {
        const ya = Math.max(boden(ax, az), yr + 1.2);
        const yb = Math.max(boden(bx, bz), yr + 1.2);
        rahmen(0, 0, 0, 0, 1);
        const px = rX(gm);
        const pz = rZ(gm);
        // Türme (A-Rahmen) und Felssockel
        for (const [x, y, z] of [
          [ax, ya, az],
          [bx, yb, bz],
        ]) {
          const gr = boden(x, z);
          if (y > gr + 0.3) {
            rahmen(x, gr - 1, z, rnd() * TAU, 1);
            prisma(bo, 5, 3.0, 2.2, 0, y - gr + 1, C_FELS_D, C_SCHNEE, rnd());
            rahmen(0, 0, 0, 0, 1);
          }
          for (const s of [-1, 1]) stab(bo, G.box, C_HOLZ_D, [x + px * s * 1.6, y, z + pz * s * 1.6], [x + px * s * 0.9, y + 4.2, z + pz * s * 0.9], 0.3);
          stab(bo, G.box, C_HOLZ_D, [x - px * 1.2, y + 3.9, z - pz * 1.2], [x + px * 1.2, y + 3.9, z + pz * 1.2], 0.28);
          sperre(x, z, 3);
        }
        const nS = 14;
        // Durchhang: höchstens 2.2 m, und das Deck bleibt über dem Gelände.
        let sag = 2.2;
        for (let q = 1; q < 10; q++) {
          const f = q / 10;
          const room = ya + (yb - ya) * f - (boden(ax + (bx - ax) * f, az + (bz - az) * f) + 0.7);
          sag = Math.min(sag, Math.max(0.2, room / Math.sin(Math.PI * f)));
        }
        const deck = (f: number, s: number): V3 => [ax + (bx - ax) * f + px * s, ya + (yb - ya) * f - Math.sin(Math.PI * f) * sag, az + (bz - az) * f + pz * s];
        for (let q = 0; q < nS; q++) {
          const f0 = q / nS;
          const f1 = (q + 0.82) / nS;
          quadUp(bo, deck(f0, -0.8), deck(f0, 0.8), deck(f1, 0.8), deck(f1, -0.8), q % 2 ? C_HOLZ : C_HOLZ_H);
        }
        for (const s of [-1, 1]) {
          let p0: V3 = [deck(0, s * 0.9)[0], ya + 4.0, deck(0, s * 0.9)[2]];
          for (let q = 1; q <= nS; q++) {
            const f = q / nS;
            const d = deck(f, s * 0.9);
            const top: V3 = [d[0], ya + (yb - ya) * f + 4.0 - Math.sin(Math.PI * f) * 3.4, d[2]];
            stab(bo, G.kabel, C_DUNKEL, p0, top, 0.07);
            if (q < nS) stab(bn, G.box, C_HOLZ_D, d, [d[0], d[1] + Math.max(0.9, top[1] - d[1]), d[2]], 0.04);
            p0 = top;
          }
        }
        // Freihalten
        for (let q = 0; q <= 6; q++) {
          const d = deck(q / 6, 0);
          sperre(d[0], d[2], 2.5);
        }
      }
    }
  }

  // === Sessellift im Tal ====================================================================
  {
    const want = detail === 0 ? 0 : 1;
    for (let tries = 0; tries < 400 && !lift.ok && want > 0; tries++) {
      const a = rnd() * TAU;
      const d = world.radius * rnd() * 0.7;
      const x0 = world.center.x + Math.cos(a) * d;
      const z0 = world.center.z + Math.sin(a) * d;
      const k0 = kante(x0, z0);
      if (k0 < 12 || k0 > 80 || !frei(x0, z0, 6) || belegt(x0, z0, 6)) continue;
      const y0 = boden(x0, z0);
      const b = rnd() * TAU;
      const len = 85 + rnd() * 60;
      const x1 = x0 + Math.cos(b) * len;
      const z1 = z0 + Math.sin(b) * len;
      if (!frei(x1, z1, 6) || belegt(x1, z1, 6)) continue;
      const y1 = boden(x1, z1);
      if (y1 - y0 < 9) continue;
      // Stützen alle ~26 m, Seilhöhe 8.5 m über Grund; überall Abstand zur Fahrbahn.
      let ok = true;
      for (let s = 0; s <= len && ok; s += 3) {
        const f = s / len;
        const x = x0 + (x1 - x0) * f;
        const z = z0 + (z1 - z0) * f;
        if (kante(x, z) < 8 || gesperrt(x, z, 3) || inLawine(x, z, 3) || imSee(x, z) || gipfelH(x, z) > boden(x, z)) ok = false;
      }
      if (!ok) continue;
      const nT = Math.max(1, Math.round(len / 26) - 1);
      const kn: V3[] = [[x0, y0 + 5.5, z0]];
      for (let q = 1; q <= nT; q++) {
        const f = q / (nT + 1);
        const x = x0 + (x1 - x0) * f;
        const z = z0 + (z1 - z0) * f;
        kn.push([x, boden(x, z) + 8.5, z]);
      }
      kn.push([x1, y1 + 5.5, z1]);
      // Durchhang prüfen: Sessel (2.6 m unter dem Seil) bleiben über Grund.
      for (let q = 0; q + 1 < kn.length && ok; q++) {
        for (let s = 1; s < 8; s++) {
          const f = s / 8;
          const x = kn[q][0] + (kn[q + 1][0] - kn[q][0]) * f;
          const z = kn[q][2] + (kn[q + 1][2] - kn[q][2]) * f;
          const y = kn[q][1] + (kn[q + 1][1] - kn[q][1]) * f - Math.sin(Math.PI * f) * 0.6;
          if (y - 3.6 < boden(x, z) + 0.6) ok = false;
        }
      }
      if (!ok) continue;
      const dx = (x1 - x0) / len;
      const dz = (z1 - z0) / len;
      const px = -dz;
      const pz = dx;
      rahmen(0, 0, 0, 0, 1);
      for (let q = 1; q < kn.length - 1; q++) {
        const [x, y, z] = kn[q];
        const gr = boden(x, z);
        stab(bo, G.box, C_STAHL, [x, gr - 0.5, z], [x, y + 0.2, z], 0.4);
        stab(bo, G.box, C_STAHL_D, [x - px * 2.3, y + 0.3, z - pz * 2.3], [x + px * 2.3, y + 0.3, z + pz * 2.3], 0.28);
        sperre(x, z, 2);
      }
      for (const [i, sgn] of [
        [0, 1],
        [kn.length - 1, -1],
      ]) {
        const [x, y, z] = kn[i];
        const gr = boden(x, z);
        rahmen(x - dx * sgn * 1.5, gr, z - dz * sgn * 1.5, yawOf(dx, dz), 1);
        teil(bo, G.box, C_STEIN, 0, 0.3, 0, 0, 0, 0, 7, 1.0, 6);
        teil(bo, G.box, C_HOLZ, 0, 1.9, -sgn * 1.8, 0, 0, 0, 4.4, 2.6, 2.6);
        teil(bo, G.box, C_ROT, 0, 3.35, -sgn * 1.8, 0, 0, 0, 5.0, 0.3, 3.2);
        teil(bn, G.box, C_SCHNEE, 0, 3.6, -sgn * 1.8, 0, 0, 0, 4.8, 0.25, 3.0);
        rahmen(0, 0, 0, 0, 1);
        stab(bo, G.box, C_STAHL, [x, gr - 0.3, z], [x, y + 0.4, z], 0.5);
        rahmen(x, y + 0.6, z, yawOf(dx, dz), 1);
        teil(bo, G.zyl8, C_GELB, 0, 0, 0, 0, 0, 0, 2.0, 0.35, 2.0);
        sperre(x, z, 5);
        belege(x, z, 5);
      }
      rahmen(0, 0, 0, 0, 1);
      for (const [sgn, X, Y, Z] of [
        [1, lift.ax, lift.ay, lift.az],
        [-1, lift.bx, lift.by, lift.bz],
      ] as [number, number[], number[], number[]][]) {
        for (let q = 0; q + 1 < kn.length; q++) {
          const a0 = kn[q];
          const b0 = kn[q + 1];
          const n = 6;
          for (let s = q === 0 ? 0 : 1; s <= n; s++) {
            const f = s / n;
            X.push(a0[0] + (b0[0] - a0[0]) * f + px * 1.9 * sgn);
            Y.push(a0[1] + (b0[1] - a0[1]) * f - Math.sin(Math.PI * f) * 0.6);
            Z.push(a0[2] + (b0[2] - a0[2]) * f + pz * 1.9 * sgn);
          }
        }
        for (let i = 0; i + 1 < X.length; i++) stab(bo, G.kabel, C_DUNKEL, [X[i], Y[i], Z[i]], [X[i + 1], Y[i + 1], Z[i + 1]], 0.06);
      }
      let acc = 0;
      lift.as.push(0);
      for (let i = 1; i < lift.ax.length; i++) {
        acc += Math.hypot(lift.ax[i] - lift.ax[i - 1], lift.ay[i] - lift.ay[i - 1], lift.az[i] - lift.az[i - 1]);
        lift.as.push(acc);
      }
      lift.len = acc;
      lift.ok = true;
      for (let s = 0; s <= len; s += 8) sperre(x0 + dx * s, z0 + dz * s, 3.5);
    }
  }

  // === Pistenraupe an einem fernen Hang =======================================================
  for (let tries = 0; tries < 500 && !raupe.ok; tries++) {
    const a = rnd() * TAU;
    const d = world.radius * (0.2 + rnd() * 0.9);
    const x = world.center.x + Math.cos(a) * d;
    const z = world.center.z + Math.sin(a) * d;
    const k = kante(x, z);
    if (k < 28 || k > 90) continue;
    const gx = boden(x + 3, z) - boden(x - 3, z);
    const gz = boden(x, z + 3) - boden(x, z - 3);
    const gl = Math.hypot(gx, gz);
    if (gl < 0.6 || gl > 4) continue;
    const dx = gx / gl;
    const dz = gz / gl;
    let ok = true;
    for (let q = 0; q <= 40 && ok; q++) {
      const s = -30 + (60 * q) / 40;
      const px = x + dx * s;
      const pz = z + dz * s;
      if (kante(px, pz) < 22 || gesperrt(px, pz, 4) || inLawine(px, pz, 4) || imSee(px, pz) || gipfelH(px, pz) > boden(px, pz) - 1 || boden(px, pz) < -24) ok = false;
      raupe.x[q] = px;
      raupe.y[q] = boden(px, pz);
      raupe.z[q] = pz;
    }
    if (!ok) continue;
    raupe.len = 60;
    raupe.ok = true;
    for (let q = 0; q <= 40; q += 5) sperre(raupe.x[q], raupe.z[q], 4);
    // Spuren im Schnee: helle Streifen entlang des Wegs
    for (let q = 0; q < 40; q++) {
      for (const s of [-1, 1]) {
        const px = -dz * s * 1.2;
        const pz = dx * s * 1.2;
        const a0: V3 = [raupe.x[q] + px - dz * 0.4, raupe.y[q] + 0.08, raupe.z[q] + pz + dx * 0.4];
        const a1: V3 = [raupe.x[q] + px + dz * 0.4, raupe.y[q] + 0.08, raupe.z[q] + pz - dx * 0.4];
        const b1: V3 = [raupe.x[q + 1] + px + dz * 0.4, raupe.y[q + 1] + 0.08, raupe.z[q + 1] + pz - dx * 0.4];
        const b0: V3 = [raupe.x[q + 1] + px - dz * 0.4, raupe.y[q + 1] + 0.08, raupe.z[q + 1] + pz + dx * 0.4];
        quadUp(bf, a0, a1, b1, b0, C_SCHNEE_B);
      }
    }
  }

  // === Bäume, Felsen, Wechten entlang der Strecke (bis zur Dreiecksgrenze) =====================
  {
    // Grenze der feststehenden Kulisse (Dreiecke, Konturen doppelt gezählt)
    const limit = detail === 2 ? 36500 : detail === 1 ? 31000 : 17500;
    const zaehle = (): number => (lines ? 2 : 1) * bo.triangles + bn.triangles + bf.triangles + wPos.length / 9;
    const kand: number[] = []; // x, z, Art (0 Baumgruppe, 1 Fels, 2 Nadel)
    for (let k = 0; k < T; k += 2) {
      if (t.edge[k] & EDGE_TUNNEL) continue;
      for (const su of [-1, 1]) {
        if (rnd() > 0.55) continue;
        const near = rnd() < 0.6;
        const lat = su * (t.wh[k] + RAND + 1.5 + (near ? 9 * Math.pow(rnd(), 1.3) : 9 + rnd() * 50));
        const al = (rnd() - 0.5) * 2;
        const r = rnd();
        kand.push(t.px[k] + rX(k) * lat + t.tx[k] * al, t.pz[k] + rZ(k) * lat + t.tz[k] * al, r < 0.68 ? 0 : r < 0.86 ? 1 : 2);
      }
    }
    const nk = kand.length / 3;
    const order = new Int32Array(nk);
    for (let i = 0; i < nk; i++) order[i] = i;
    for (let i = nk - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    // Wechten zuerst: an steilen Abbrüchen neben der Bahn
    let nWe = 0;
    const wantWe = detail === 0 ? 5 : 10;
    for (let k = 0; k < NM && nWe < wantWe; k += 7) {
      for (const su of [-1, 1]) {
        if (nWe >= wantWe) break;
        const u = su * (t.wh[k] + RAND + 4);
        const [x, z] = at(k, u);
        const [x2, z2] = at(k, u + su * 6);
        const y = boden(x, z);
        const drop = y - boden(x2, z2);
        if (drop < 3.2 || !frei(x, z, 3) || belegt(x, z, 3)) continue;
        if (rnd() < 0.4) continue;
        wechte(x, y - 0.2, z, rX(k) * su, rZ(k) * su, 5 + rnd() * 3);
        belege(x, z, 3.2);
        nWe++;
      }
    }
    for (let q = 0; q < nk && zaehle() < limit; q++) {
      const o = order[q] * 3;
      const art = kand[o + 2];
      const x = kand[o];
      const z = kand[o + 1];
      if (boden(x, z) < -21) continue;
      if (art === 0) {
        const r = 2.6;
        if (!frei(x, z, r) || belegt(x, z, r)) continue;
        const n = 2 + Math.floor(rnd() * 4);
        for (let i = 0; i < n; i++) {
          const ang = rnd() * TAU;
          const dd = i === 0 ? 0 : 3 + rnd() * 4;
          const tx = x + Math.cos(ang) * dd;
          const tz = z + Math.sin(ang) * dd;
          const s = 0.75 + rnd() * 0.65;
          const la = rnd() < 0.28;
          // Radius des untersten Astkranzes: so weit bleibt der Baum von der Kante weg.
          if (!frei(tx, tz, (la ? 2.3 : 3.1) * s) || belegt(tx, tz, 2.0 * s, 0.7)) continue;
          tanne(tx, boden(tx, tz) - 0.35, tz, s, la);
          belege(tx, tz, 2.0 * s);
        }
      } else {
        const s = 0.8 + rnd() * 0.7;
        const r = (art === 2 ? 2.9 : 2.5) * s;
        if (!frei(x, z, r) || belegt(x, z, r * 0.8)) continue;
        fels(x, boden(x, z) - 0.2, z, s, art === 2);
        belege(x, z, r);
      }
    }
  }

  // === Statische Netze ===================================================================
  const toon = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
  disposables.push(toon);
  {
    const go = addSmoothNormals(bo.build());
    const gn = bn.build();
    const body = new THREE.BufferGeometry();
    for (const name of ['position', 'color', 'normal']) {
      const x = go.getAttribute(name).array as Float32Array;
      const y = gn.getAttribute(name).array as Float32Array;
      const out = new Float32Array(x.length + y.length);
      out.set(x, 0);
      out.set(y, x.length);
      body.setAttribute(name, new THREE.BufferAttribute(out, 3));
    }
    body.computeBoundingSphere();
    gn.dispose();
    const mesh = new THREE.Mesh(body, toon);
    group.add(mesh);
    disposables.push(body);
    if (lines) {
      const ol = new THREE.Mesh(go, outlineMaterial(0.045));
      ol.name = 'outline';
      group.add(ol);
      disposables.push(go);
    } else go.dispose();
  }
  const flatMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  {
    const gf = bf.build();
    const flat = new THREE.Mesh(gf, flatMat);
    group.add(flat);
    disposables.push(gf, flatMat);
  }
  const textMat = new THREE.MeshBasicMaterial({ map: schriftTex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  {
    const gt = bt.build();
    const text = new THREE.Mesh(gt, textMat);
    group.add(text);
    disposables.push(gt, textMat, schriftTex);
  }
  // Wehendes: Fahnen und Wolkenfetzen bewegen sich im Shader.
  const zeit = { value: 0 };
  const waveMat = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
  waveMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = zeit;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute vec3 wave;\nattribute vec3 wdir;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += wdir * wave.x * (sin(uTime * wave.z + wave.y) + 0.35 * sin(uTime * wave.z * 2.3 + wave.y * 1.7));');
  };
  waveMat.customProgramCacheKey = () => 'eis-wehend';
  disposables.push(waveMat);
  {
    const gw = new THREE.BufferGeometry();
    gw.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
    gw.setAttribute('color', new THREE.Float32BufferAttribute(wCol, 3));
    gw.setAttribute('wave', new THREE.Float32BufferAttribute(wWav, 3));
    gw.setAttribute('wdir', new THREE.Float32BufferAttribute(wDir, 3));
    gw.computeVertexNormals();
    gw.computeBoundingSphere();
    const wm = new THREE.Mesh(gw, waveMat);
    wm.frustumCulled = false;
    group.add(wm);
    disposables.push(gw);
  }

  // === Fahrwerk: Gondeln, Sessel, Pistenraupe, Dohlen ========================================
  const V_KABINE = 0;
  const V_SESSEL = 1;
  const V_SESSEL_P = 2;
  const V_RAUPE = 3;
  const V_DOHLE = 4;
  const vorlagen: Vorlage[] = [];
  {
    // Gondelkabine: Gehänge oben am Seil (y = 0), Kabine darunter; Blick nach +z.
    const b = new MeshBuilder();
    rahmen(0, 0, 0, 0, 1);
    teil(b, G.box, C_STAHL_D, 0, -0.1, 0, 0, 0, 0, 0.5, 0.4, 1.2);
    teil(b, G.box, C_STAHL, 0, -1.3, 0, 0, 0, 0, 0.18, 2.2, 0.18);
    teil(b, G.box, C_ROT, 0, -3.6, 0, 0, 0, 0, 2.4, 2.4, 2.6, );
    teil(b, G.box, rgb(0x2c3550), 0, -3.35, 0, 0, 0, 0, 2.46, 0.95, 2.66);
    teil(b, G.box, C_SCHNEE, 0, -2.3, 0, 0, 0, 0, 2.5, 0.25, 2.7);
    teil(b, G.box, C_DUNKEL, 0, -4.9, 0, 0, 0, 0, 2.2, 0.2, 2.4);
    vorlagen.push(vorlage(b));
  }
  {
    // Sessel (leer und besetzt); Blick nach +z (bergauf).
    for (const besetzt of [false, true]) {
      const b = new MeshBuilder();
      rahmen(0, 0, 0, 0, 1);
      teil(b, G.box, C_STAHL_D, 0, -0.1, 0, 0, 0, 0, 0.3, 0.3, 0.6);
      teil(b, G.box, C_STAHL, 0, -1.2, -0.2, 0, 0, 0, 0.12, 2.2, 0.12);
      teil(b, G.box, C_BLAU, 0, -2.3, 0.15, 0, 0, 0, 1.8, 0.16, 0.7);
      teil(b, G.box, C_BLAU, 0, -1.9, -0.25, -0.2, 0, 0, 1.8, 0.8, 0.12);
      teil(b, G.box, C_STAHL_D, 0, -1.55, 0.55, 0, 0, 0, 1.8, 0.08, 0.08);
      if (besetzt) {
        const jc = JACKEN[0];
        teil(b, G.box, jc, -0.4, -1.85, 0.05, 0, 0, 0, 0.5, 0.75, 0.4);
        teil(b, G.okt, C_HAUT, -0.4, -1.25, 0.05, 0, 0, 0, 0.22, 0.26, 0.22);
        teil(b, G.kegel4, C_GELB, -0.4, -1.02, 0.05, 0, 0, 0, 0.22, 0.32, 0.22);
        teil(b, G.box, C_DUNKEL, -0.4, -2.45, 0.5, 0, 0, 0, 0.42, 0.3, 0.5);
        for (const o of [-0.52, -0.28]) teil(b, G.box, C_ROT, o, -2.75, 0.45, 0.25, 0, 0, 0.08, 0.05, 1.7);
      }
      vorlagen.push(vorlage(b));
    }
  }
  {
    // Pistenraupe: Ketten, Aufbau, Kabine, Schild vorn, Fräse hinten; Blick nach +z.
    const b = new MeshBuilder();
    rahmen(0, 0, 0, 0, 1);
    for (const s of [-1, 1]) {
      teil(b, G.box, C_DUNKEL, s * 1.35, 0.55, 0, 0, 0, 0, 0.9, 1.1, 4.6);
      teil(b, G.box, C_STAHL, s * 1.35, 0.55, 0, 0, 0, 0, 0.94, 0.4, 4.0);
    }
    teil(b, G.box, C_ROT, 0, 1.45, -0.4, 0, 0, 0, 2.2, 0.9, 3.4);
    teil(b, G.box, C_ROT, 0, 2.45, 0.5, 0, 0, 0, 2.1, 1.3, 1.8);
    teil(b, G.box, rgb(0x2c3550), 0, 2.55, 0.55, 0, 0, 0, 2.16, 0.7, 1.86);
    teil(b, G.box, C_SCHNEE, 0, 3.15, 0.5, 0, 0, 0, 2.15, 0.15, 1.85);
    teil(b, G.box, C_GELB, 0, 3.3, 0.7, 0, 0, 0, 0.5, 0.2, 0.3);
    teil(b, G.box, C_STAHL_D, 0, 0.7, 2.9, -0.25, 0, 0, 3.6, 1.2, 0.2);
    teil(b, G.box, C_STAHL, 0, 0.4, -2.9, 0, 0, 0, 3.2, 0.6, 1.0);
    for (const s of [-0.7, 0.7]) teil(b, G.box, C_LICHT, s, 2.95, 1.45, 0, 0, 0, 0.35, 0.22, 0.1);
    vorlagen.push(vorlage(b));
  }
  {
    // Dohle: schwarz mit gelbem Schnabel; Flügel biegen sich (flex = Abstand von der Mitte).
    const b = new MeshBuilder();
    rahmen(0, 0, 0, 0, 1);
    teil(b, G.ico0, C_DUNKEL, 0, 0, 0, 0, 0, 0, 0.18, 0.17, 0.42);
    teil(b, G.okt, C_DUNKEL, 0, 0.07, 0.4, 0, 0, 0, 0.13, 0.13, 0.14);
    teil(b, G.kegel4, C_GELB, 0, 0.05, 0.58, Math.PI / 2, 0, 0, 0.05, 0.16, 0.05);
    const wc = rgb(0x262838);
    b.tri([0.1, 0.03, 0.18], [1.0, 0.0, -0.05], [0.1, 0.03, -0.22], wc);
    b.tri([0.1, 0.03, 0.18], [0.1, 0.03, -0.22], [1.0, 0.0, -0.05], wc);
    b.tri([-0.1, 0.03, 0.18], [-0.1, 0.03, -0.22], [-1.0, 0.0, -0.05], wc);
    b.tri([-0.1, 0.03, 0.18], [-1.0, 0.0, -0.05], [-0.1, 0.03, -0.22], wc);
    b.tri([0, 0.02, -0.35], [-0.16, 0.0, -0.7], [0.16, 0.0, -0.7], wc);
    b.tri([0, 0.02, -0.35], [0.16, 0.0, -0.7], [-0.16, 0.0, -0.7], wc);
    vorlagen.push(vorlage(b, (x) => Math.max(0, Math.abs(x) - 0.1)));
  }
  interface Akteur {
    v: number;
    off: number;
  }
  const akt: Akteur[] = [];
  const nKab = gondel.ok ? (detail === 0 ? 3 : 4) : 0;
  const nSes = lift.ok ? Math.max(2, Math.floor((lift.len * 2) / 12)) : 0;
  const nDoh = dohlenAnker.length > 0 ? (detail === 0 ? 6 : 10) : 0;
  for (let i = 0; i < nKab; i++) akt.push({ v: V_KABINE, off: 0 });
  for (let i = 0; i < nSes; i++) akt.push({ v: i % 3 === 1 ? V_SESSEL_P : V_SESSEL, off: 0 });
  const iRaupe = akt.length;
  if (raupe.ok) akt.push({ v: V_RAUPE, off: 0 });
  const iDohle = akt.length;
  for (let i = 0; i < nDoh; i++) akt.push({ v: V_DOHLE, off: 0 });
  let nVert = 0;
  for (const a of akt) {
    a.off = nVert;
    nVert += vorlagen[a.v].pos.length / 3;
  }
  const fPos = new Float32Array(Math.max(3, nVert * 3));
  const fNor = new Float32Array(Math.max(3, nVert * 3));
  const fOnor = new Float32Array(Math.max(3, nVert * 3));
  const fCol = new Float32Array(Math.max(3, nVert * 3));
  const solidIdx: number[] = [];
  for (const a of akt) {
    const v = vorlagen[a.v];
    fCol.set(v.col, a.off * 3);
    if (a.v !== V_DOHLE) for (let q = 0; q < v.pos.length / 3; q++) solidIdx.push(a.off + q);
  }
  const fGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(fPos, 3).setUsage(THREE.DynamicDrawUsage);
  const norAttr = new THREE.BufferAttribute(fNor, 3).setUsage(THREE.DynamicDrawUsage);
  const onorAttr = new THREE.BufferAttribute(fOnor, 3).setUsage(THREE.DynamicDrawUsage);
  fGeo.setAttribute('position', posAttr);
  fGeo.setAttribute('normal', norAttr);
  fGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  fGeo.setAttribute('onormal', onorAttr);
  fGeo.setDrawRange(0, nVert);
  const fahrwerk = new THREE.Mesh(fGeo, toon);
  fahrwerk.frustumCulled = false;
  group.add(fahrwerk);
  disposables.push(fGeo);
  if (lines && solidIdx.length > 0) {
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', posAttr);
    og.setAttribute('onormal', onorAttr);
    og.setIndex(solidIdx);
    const ol = new THREE.Mesh(og, outlineMaterial(0.04));
    ol.frustumCulled = false;
    ol.name = 'outline';
    group.add(ol);
    disposables.push(og);
  }
  /** Rechnet die Ecken von Darsteller i mit Matrix m um; flap biegt die Flügel. */
  const setze = (i: number, m: THREE.Matrix4, flap: number): void => {
    const a = akt[i];
    const v = vorlagen[a.v];
    const e = m.elements;
    const sc = Math.hypot(e[0], e[1], e[2]) || 1;
    const inv = 1 / sc;
    const n = v.pos.length / 3;
    const o = a.off * 3;
    for (let q = 0; q < n; q++) {
      const q3 = q * 3;
      const x = v.pos[q3];
      const y = v.pos[q3 + 1] + v.flex[q] * flap;
      const z = v.pos[q3 + 2];
      fPos[o + q3] = e[0] * x + e[4] * y + e[8] * z + e[12];
      fPos[o + q3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      fPos[o + q3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const nx = v.nor[q3];
      const ny = v.nor[q3 + 1];
      const nz = v.nor[q3 + 2];
      fNor[o + q3] = (e[0] * nx + e[4] * ny + e[8] * nz) * inv;
      fNor[o + q3 + 1] = (e[1] * nx + e[5] * ny + e[9] * nz) * inv;
      fNor[o + q3 + 2] = (e[2] * nx + e[6] * ny + e[10] * nz) * inv;
      const ox = v.onor[q3];
      const oy = v.onor[q3 + 1];
      const oz = v.onor[q3 + 2];
      fOnor[o + q3] = (e[0] * ox + e[4] * oy + e[8] * oz) * inv;
      fOnor[o + q3 + 1] = (e[1] * ox + e[5] * oy + e[9] * oz) * inv;
      fOnor[o + q3 + 2] = (e[2] * ox + e[6] * oy + e[10] * oz) * inv;
    }
  };

  // Lichtkegel der Pistenraupe (nur hohe Qualität)
  let kegel: THREE.Mesh | null = null;
  if (raupe.ok && hoch) {
    const b = new MeshBuilder();
    const N = 8;
    for (const s of [-0.7, 0.7]) {
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * TAU;
        const a1 = ((k + 1) / N) * TAU;
        const p = (a: number, z: number, r: number): V3 => [s + Math.cos(a) * r, 2.95 + Math.sin(a) * r - z * 0.18, 1.5 + z];
        b.quad(p(a0, 0, 0.18), p(a1, 0, 0.18), p(a1, 16, 2.6), p(a0, 16, 2.6), [1, 1, 1]);
      }
    }
    const g = b.build();
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
    kegel = new THREE.Mesh(g, mat);
    kegel.matrixAutoUpdate = false;
    kegel.renderOrder = 4;
    group.add(kegel);
    disposables.push(g, mat);
  }

  // Dohlen bleiben hoch über jeder Fahrbahn unter ihrem Kreis.
  for (let q = 0; q < dohlenAnker.length; q += 4) {
    const hb = bahnHoch(dohlenAnker[q], dohlenAnker[q + 2], dohlenAnker[q + 3] + 6);
    dohlenAnker[q + 1] = Math.max(dohlenAnker[q + 1], hb + LUFT + 5.5, boden(dohlenAnker[q], dohlenAnker[q + 2]) + 9);
  }
  // Dohlen: je Vogel Anker, Winkelversatz, Radius, Höhenversatz, Takt
  const dP = new Float32Array(Math.max(1, nDoh) * 5);
  for (let i = 0; i < nDoh; i++) dP.set([i % (dohlenAnker.length / 4), rnd() * TAU, 0.55 + rnd() * 0.45, (rnd() - 0.5) * 5, 0.8 + rnd() * 0.4], i * 5);

  for (const geo of Object.values(G)) geo.dispose();

  // --- Hilfsobjekte für update() -------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3(1, 1, 1);
  const rauchT = new Float32Array(Math.max(1, rauch.length / 5));
  let schneeT = 0;
  let wpRaupe = 0;
  /** Lage auf einem abgetasteten Seil: Ergebnis in pv, Richtung in dirX/dirZ. */
  let dirX = 0;
  let dirZ = 1;
  const seilPunkt = (X: number[], Y: number[], Z: number[], S: number[], s: number): void => {
    const n = S.length;
    if (s <= 0) {
      pv.set(X[0], Y[0], Z[0]);
      dirX = X[1] - X[0];
      dirZ = Z[1] - Z[0];
      return;
    }
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (S[mid] <= s) lo = mid;
      else hi = mid;
    }
    const f = Math.min(1, (s - S[lo]) / Math.max(1e-4, S[hi] - S[lo]));
    pv.set(X[lo] + (X[hi] - X[lo]) * f, Y[lo] + (Y[hi] - Y[lo]) * f, Z[lo] + (Z[hi] - Z[lo]) * f);
    dirX = X[hi] - X[lo];
    dirZ = Z[hi] - Z[lo];
  };
  /** Umlaufbahn: s in [0, 2L) – hinauf auf Spur a, hinab auf Spur b. */
  const umlauf = (bahn: typeof gondel, s: number): number => {
    const L = bahn.len;
    if (s < L) {
      seilPunkt(bahn.ax, bahn.ay, bahn.az, bahn.as, s);
      return 1;
    }
    seilPunkt(bahn.bx, bahn.by, bahn.bz, bahn.as, 2 * L - s);
    return -1;
  };

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink): void {
      zeit.value = time;
      // --- Gondeln ---
      for (let i = 0; i < nKab; i++) {
        const L2 = gondel.len * 2;
        const s = (((time * 5.5 + (i * L2) / nKab) % L2) + L2) % L2;
        const dir = umlauf(gondel, s);
        e.set(Math.sin(time * 0.9 + i) * 0.03, Math.atan2(dirX * dir, dirZ * dir), Math.sin(time * 0.7 + i * 2) * 0.04);
        q.setFromEuler(e);
        m4.compose(pv, q, sv.set(1, 1, 1));
        setze(i, m4, 0);
      }
      // --- Sessel ---
      for (let i = 0; i < nSes; i++) {
        const L2 = lift.len * 2;
        const s = (((time * 2.4 + (i * L2) / nSes) % L2) + L2) % L2;
        const dir = umlauf(lift, s);
        e.set(Math.sin(time * 1.3 + i * 0.7) * 0.06, Math.atan2(dirX * dir, dirZ * dir), 0);
        q.setFromEuler(e);
        m4.compose(pv, q, sv.set(1, 1, 1));
        setze(nKab + i, m4, 0);
      }
      // --- Pistenraupe: hinauf, wenden, hinab ---
      if (raupe.ok) {
        const period = 64;
        const ph = (time % period) / period;
        // 0..0.44 hinauf, 0.44..0.5 wenden, 0.5..0.94 hinab, 0.94..1 wenden
        let f: number;
        let yawAdd: number;
        if (ph < 0.44) {
          f = smooth(ph / 0.44);
          yawAdd = 0;
        } else if (ph < 0.5) {
          f = 1;
          yawAdd = Math.PI * smooth((ph - 0.44) / 0.06);
        } else if (ph < 0.94) {
          f = 1 - smooth((ph - 0.5) / 0.44);
          yawAdd = Math.PI;
        } else {
          f = 0;
          yawAdd = Math.PI + Math.PI * smooth((ph - 0.94) / 0.06);
        }
        const fi = f * 40;
        const i0 = Math.min(39, Math.floor(fi));
        const k = fi - i0;
        const x = raupe.x[i0] + (raupe.x[i0 + 1] - raupe.x[i0]) * k;
        const y = raupe.y[i0] + (raupe.y[i0 + 1] - raupe.y[i0]) * k;
        const z = raupe.z[i0] + (raupe.z[i0 + 1] - raupe.z[i0]) * k;
        const ddx = raupe.x[40] - raupe.x[0];
        const ddz = raupe.z[40] - raupe.z[0];
        const pitch = -Math.atan2(raupe.y[i0 + 1] - raupe.y[i0], Math.hypot(raupe.x[i0 + 1] - raupe.x[i0], raupe.z[i0 + 1] - raupe.z[i0]));
        const yaw = Math.atan2(ddx, ddz) + yawAdd;
        e.set(yawAdd > Math.PI * 0.5 && yawAdd < Math.PI * 1.5 ? -pitch : pitch, yaw, 0);
        q.setFromEuler(e);
        m4.compose(pv.set(x, y + 0.1, z), q, sv.set(1.25, 1.25, 1.25));
        setze(iRaupe, m4, 0);
        if (kegel) {
          kegel.matrix.copy(m4);
          kegel.matrixWorldNeedsUpdate = true;
        }
        // ab und zu Schneestaub hinter der Fräse
        wpRaupe -= dt;
        if (wpRaupe <= 0 && Math.abs(x - cam.x) + Math.abs(z - cam.z) < 260) {
          wpRaupe = 0.4;
          fx.puff(x - Math.sin(yaw) * 4, y + 0.6, z - Math.cos(yaw) * 4, (rnd() - 0.5), 1.2, (rnd() - 0.5), 1.2, 1.2, 0xffffff, 0.8, 1.5);
        }
      }
      // --- Dohlen im Aufwind ---
      for (let i = 0; i < nDoh; i++) {
        const o = i * 5;
        const an = dP[o] * 4;
        const rad = dohlenAnker[an + 3] * dP[o + 2];
        const sp = dP[o + 4];
        const dir = i % 2 ? 1 : -1;
        const a = dP[o + 1] + (dir * time * 7 * sp) / rad;
        const x = dohlenAnker[an] + Math.cos(a) * rad;
        const z = dohlenAnker[an + 2] + Math.sin(a) * rad;
        const y = dohlenAnker[an + 1] + dP[o + 3] + Math.sin(time * 0.45 + i) * 2.2;
        const yaw = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
        e.set(-0.05, yaw, -dir * 0.45);
        q.setFromEuler(e);
        m4.compose(pv.set(x, y, z), q, sv.set(1.7, 1.7, 1.7));
        const glide = smooth((Math.sin(time * 0.6 + i * 1.3) + 0.2) * 2.5);
        setze(iDohle + i, m4, glide * Math.sin(time * 10 + i * 2.1) * 0.7 + 0.12);
      }
      if (nVert > 0) {
        posAttr.needsUpdate = true;
        norAttr.needsUpdate = true;
        onorAttr.needsUpdate = true;
      }
      // --- Rauch aus Kamin und Ofenrohren ---
      for (let k = 0; k < rauchT.length && k * 5 < rauch.length; k++) {
        rauchT[k] -= dt;
        if (rauchT[k] > 0) continue;
        const o = k * 5;
        rauchT[k] = rauch[o + 3];
        if (Math.abs(rauch[o] - cam.x) + Math.abs(rauch[o + 2] - cam.z) > 300) continue;
        const s = rauch[o + 4];
        fx.puff(rauch[o], rauch[o + 1], rauch[o + 2], 0.5 + (rnd() - 0.5) * 0.4, 1.4, 0.3 + (rnd() - 0.5) * 0.4, 3.4, s * (0.8 + rnd() * 0.4), rnd() < 0.5 ? 0xb9bfcc : 0x9aa2b2, s * 0.6, -0.7);
      }
      // --- Schneefall in Kameranähe (nur hohe Qualität) ---
      if (hoch) {
        schneeT += dt * 22;
        let n = 0;
        while (schneeT >= 1 && n < 6) {
          schneeT -= 1;
          n++;
          const a = rnd() * TAU;
          const d = 4 + rnd() * 20;
          fx.puff(cam.x + Math.cos(a) * d, cam.y + 1 + rnd() * 9, cam.z + Math.sin(a) * d, 0.8 + rnd() * 0.6, -1, 0.3, 4.5, 0.16 + rnd() * 0.12, 0xffffff, 0, 2.2);
        }
        if (schneeT > 3) schneeT = 0;
      }
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}

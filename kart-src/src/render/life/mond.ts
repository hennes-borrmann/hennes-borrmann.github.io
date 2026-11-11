// Mondbasis lebt: eine Kuppelstadt am Kraterrand. Über Start und Ziel steht die
// große Glaskuppel auf einem Ring mit Säulen und Streben (die Fahrbahn führt
// unter dem Ring hindurch), daneben Wohn- und Labormodule mit Verbindungsröhren,
// Antennenschüsseln (eine dreht sich), ein Funkmast mit Blinklicht,
// Treibstofftanks, der Landeplatz mit einer Fähre und – weit draußen – der
// Raketenstartplatz. An der Schleuse stehen Portale mit Toren, um die Lavaröhre
// lauert Basalt mit glühenden Adern, zwischen Hauptweg und Lavaröhre liegt das
// Solarfeld. Der Massenbeschleuniger: Schienen mit Spulenringen links und rechts
// der Bahn bis zur Sprungplatte, Lauflichter in Fahrtrichtung, Flutlichtmasten.
// Die Landschaft: Krater in allen Größen (der große Krater um den Kratersprung),
// Felsbrocken, Geröllfelder, Fahrspuren, Bergketten mit harten Schatten. Orange
// Baken säumen die Wege ohne Bande in Signalfarbe.
//
// Bewegt: Rover ziehen Runden und wirbeln Staub auf, Astronauten hüpfen in
// Zeitlupe oder winken, alle halbe Minute hebt eine Rakete ab, ein Satellit
// zieht über den Himmel, Sternschnuppen fallen. Nichts flattert – kein Wind.
//
// Reine Kulisse: alles wird mit festem Zufall aus der Strecke abgeleitet und
// hält mindestens RAND Meter Abstand zur Fahrbahnkante (auch an Abzweigungen);
// über den Sprüngen, um die Schubringe und in den Einflugschneisen der
// Meteoriten bleibt die Luft frei. Im Lauf wird nichts neu angelegt.
//
// Zeichenaufrufe (hoch): Kulisse + Kontur, Leuchtendes, Darsteller + Kontur,
// Lichter (bewegt), Lichtkegel/Sternschnuppen (additiv), Glaskuppel = 8.
// Niedrig: ohne Konturen = 6.

import * as THREE from 'three';
import { PULSE_METEOR } from '../../game/mechanics';
import { EDGE_DECK, EDGE_GAP, EDGE_RAMP, EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { MeshBuilder, noise, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

/** Mindestabstand aller Kulisse zur Fahrbahnkante (Meter). */
const RAND = 3;
/** Um Tunnel liegt Fels (world.ts): dort beginnt der freie Platz erst weiter draußen. */
const TUNNEL_PLUS = 7;
/** Zusätzlicher seitlicher Abstand um Sprünge (Schanze, Lücke, Landung). */
const SPRUNG_PLUS = 7;
/** Einflugschneise der Meteoriten (wie render/mechanics/moon.ts). */
const MET_AHEAD = 80;
const MET_SIDE = 16;
const MET_UP = 58;
const TAU = Math.PI * 2;

// --- Farben ------------------------------------------------------------------------

const C_WEISS = rgb(0xeef1f8);
const C_HELL = rgb(0xd3d8e4);
const C_STAHL = rgb(0x8d98b0);
const C_STAHL_D = rgb(0x5d6680);
const C_DUNKEL = rgb(0x2d3550);
const C_TUSCHE = rgb(0x1a1824);
const C_ORANGE = rgb(0xff8a2a);
const C_GOLD = rgb(0xe0a83a);
const C_GOLD_D = rgb(0xa8741f);
const C_KUPFER = rgb(0xc8743a);
const C_SOLAR = rgb(0x1f3f94);
const C_SOLAR_H = rgb(0x3f72dc);
const C_GRUEN = rgb(0x4fae5a);
const C_GRUEN_D = rgb(0x2f7d4f);
const C_FENSTER = rgb(0x1d2238);
const C_BASALT = rgb(0x3b3846);
const FELS = [0x8e8b9b, 0x7a7789, 0x9f9cac, 0x6b687a, 0x85828f].map(rgb);
const C_KRATER = rgb(0x8c899b);
const C_KRATER_S = rgb(0x4f4c62);
const C_KAMM = rgb(0xd6d3df);
const C_HANG = rgb(0xb0adbc);
const C_HANG_S = rgb(0x6c697c);
const C_STRAHL = rgb(0xc9c6d3);
const C_BERG = rgb(0x9c99ab);
const C_BERG_M = rgb(0x6a6779);
const C_BERG_S = rgb(0x312f3e);
const C_SPUR = rgb(0x7f7c8e);
const C_PLATTE = rgb(0xc4c8d6);
const C_PLATTE_D = rgb(0xaeb2c2);
// Lichter
const L_ORANGE = rgb(0xff8a1a);
const L_WEISS = rgb(0xfff4dc);
const L_ROT = rgb(0xff3b2a);
const L_GRUEN = rgb(0x36ff7a);
const L_GELB = rgb(0xffd21f);
const L_BLAU = rgb(0x8fe0ff);
const L_FLAMME = [rgb(0xff4d0f), rgb(0xff9a1f), rgb(0xfff2b0)];

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
const vB = new THREE.Vector3();

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
/** Richtung im Rahmen (ohne Verschiebung). */
function dir(x: number, y: number, z: number): V3 {
  vA.set(x, y, z).transformDirection(mP);
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
  qT.setFromUnitVectors(UP, vB.set(dx / len, dy / len, dz / len));
  mL.compose(vT.set((a[0] + e[0]) / 2, (a[1] + e[1]) / 2, (a[2] + e[2]) / 2), qT, sT.set(r, len, r));
  mT.multiplyMatrices(mP, mL);
  b.add(geo, c, mT);
}
/** Prisma mit n Ecken im Rahmen: unten Radius r0 auf y0, oben r1 auf y1; Deckel nach Wunsch. */
function prisma(b: MeshBuilder, n: number, r0: number, r1: number, y0: number, y1: number, cs: RGB, ctop: RGB | null, cbot: RGB | null, rot = 0, cs2?: RGB): void {
  const lo: V3[] = [];
  const hi: V3[] = [];
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * TAU;
    lo.push(pt(Math.cos(a) * r0, y0, Math.sin(a) * r0));
    hi.push(pt(Math.cos(a) * r1, y1, Math.sin(a) * r1));
  }
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    b.quad(lo[j], lo[k], hi[k], hi[j], cs2 && k % 2 ? cs2 : k % 2 ? cs : shade(cs, 0.9));
  }
  for (let k = 1; k < n - 1; k++) {
    if (ctop) b.tri(hi[0], hi[k + 1], hi[k], ctop);
    if (cbot) b.tri(lo[0], lo[k], lo[k + 1], cbot);
  }
}
/** Viereck, dessen sichtbare Seite in Richtung n zeigt (Weltkoordinaten). */
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
function triN(b: MeshBuilder, a: V3, c1: V3, c2: V3, n: V3, color: RGB): void {
  const cx = (c1[1] - a[1]) * (c2[2] - a[2]) - (c1[2] - a[2]) * (c2[1] - a[1]);
  const cy = (c1[2] - a[2]) * (c2[0] - a[0]) - (c1[0] - a[0]) * (c2[2] - a[2]);
  const cz = (c1[0] - a[0]) * (c2[1] - a[1]) - (c1[1] - a[1]) * (c2[0] - a[0]);
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) b.tri(a, c1, c2, color);
  else b.tri(a, c2, c1, color);
}
/** Viereck im Rahmen (lokale Ecken), sichtbar in lokaler Richtung n. */
function lq(b: MeshBuilder, a: V3, c1: V3, c2: V3, d: V3, n: V3, color: RGB): void {
  quadN(b, pt(a[0], a[1], a[2]), pt(c1[0], c1[1], c1[2]), pt(c2[0], c2[1], c2[2]), pt(d[0], d[1], d[2]), dir(n[0], n[1], n[2]), color);
}
/** Normale einer Fläche (normiert). */
function normale(a: V3, b: V3, c: V3): V3 {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const x = uy * vz - uz * vy;
  const y = uz * vx - ux * vz;
  const z = ux * vy - uy * vx;
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** Zwei fertige Geometrien (Position, Farbe, Normale) zu einer. */
function verbinde(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'color', 'normal']) {
    const x = a.getAttribute(name).array as Float32Array;
    const y = b.getAttribute(name).array as Float32Array;
    const out = new Float32Array(x.length + y.length);
    out.set(x, 0);
    out.set(y, x.length);
    g.setAttribute(name, new THREE.BufferAttribute(out, 3));
  }
  g.computeBoundingSphere();
  return g;
}

// --- Darsteller (ein Netz, Ecken je Bild umgerechnet) ------------------------------------

const K_STARR = 0;
const K_ASTRO = 1;

interface Vorlage {
  pos: Float32Array;
  nor: Float32Array;
  onor: Float32Array;
  col: Float32Array;
  /** 1 = rechter Arm, 2 = linker Arm (Astronauten), sonst 0. */
  flex: Float32Array;
  /** Die ersten nSolid Ecken bekommen eine Kontur, der Rest (flache Teile) nicht. */
  nSolid: number;
}

function vorlage(solid: MeshBuilder, flat: MeshBuilder, flex?: (x: number, y: number, z: number) => number): Vorlage {
  const gs = addSmoothNormals(solid.build());
  const gf = flat.empty ? null : flat.build();
  const ns = gs.getAttribute('position').count;
  const nf = gf ? gf.getAttribute('position').count : 0;
  const n = ns + nf;
  const v: Vorlage = { pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), onor: new Float32Array(n * 3), col: new Float32Array(n * 3), flex: new Float32Array(n), nSolid: ns };
  v.pos.set(gs.getAttribute('position').array as Float32Array, 0);
  v.nor.set(gs.getAttribute('normal').array as Float32Array, 0);
  v.onor.set(gs.getAttribute('onormal').array as Float32Array, 0);
  v.col.set(gs.getAttribute('color').array as Float32Array, 0);
  if (gf) {
    v.pos.set(gf.getAttribute('position').array as Float32Array, ns * 3);
    v.nor.set(gf.getAttribute('normal').array as Float32Array, ns * 3);
    v.col.set(gf.getAttribute('color').array as Float32Array, ns * 3);
    gf.dispose();
  }
  gs.dispose();
  if (flex) for (let i = 0; i < n; i++) v.flex[i] = flex(v.pos[i * 3], v.pos[i * 3 + 1], v.pos[i * 3 + 2]);
  return v;
}

interface Akteur {
  v: number;
  kind: number;
  /** Je Rolle: Ort, Bahn, Takt … */
  p: number[];
  rolle: number;
}

// Rollen
const R_ROVER = 0;
const R_WINK = 1;
const R_HUEPF = 2;
const R_GEH = 3;
const R_SCHUESSEL = 4;
const R_RAKETE = 5;
const R_SATELLIT = 6;

// Bewegte Lichter
const L_LAUF = 0;
const L_BLINK = 1;
const L_KREIS = 2;
const L_FLAMME_K = 3;

interface Licht {
  first: number;
  count: number;
  kind: number;
  a: number;
  b: number;
}

// --- Kulisse ------------------------------------------------------------------------

export function buildMondLife(world: World): Life {
  const t = world.track;
  const th = world.theme;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const lines = detail > 0;
  const rnd = seeded(7300 + t.index * 41);
  const T = t.total;
  const pick = <X>(a: X[]): X => a[Math.floor(rnd() * a.length) % a.length];
  const SUN: V3 = (() => {
    const l = Math.hypot(th.sunDir[0], th.sunDir[1], th.sunDir[2]);
    return [th.sunDir[0] / l, th.sunDir[1] / l, th.sunDir[2] / l];
  })();
  const sunH = Math.hypot(SUN[0], SUN[2]) || 1;
  const SX = SUN[0] / sunH;
  const SZ = SUN[2] / sunH;

  const G = {
    ico0: new THREE.IcosahedronGeometry(1, 0),
    dode: new THREE.DodecahedronGeometry(1, 0),
    okt: new THREE.OctahedronGeometry(1, 0),
    box: new THREE.BoxGeometry(1, 1, 1),
    zyl4: new THREE.CylinderGeometry(1, 1, 1, 4),
    zyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
    zyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
    zyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
    kegel6: new THREE.ConeGeometry(1, 1, 6),
    kegel8: new THREE.ConeGeometry(1, 1, 8),
    kegelOffen: new THREE.ConeGeometry(1, 1, 10, 1, true),
    halb: new THREE.SphereGeometry(1, 10, 3, 0, TAU, 0, Math.PI / 2),
    kugel: new THREE.SphereGeometry(1, 10, 6),
    ring: new THREE.TorusGeometry(1, 0.24, 3, 8),
  };

  // --- Platz -------------------------------------------------------------------------
  let nah = 0;
  /** Abstand zur nächsten Fahrbahnkante über alle Wege (Tunnel mit Felsmantel); merkt den Abschnitt in nah. */
  const kante = (x: number, z: number): number => {
    let best = Infinity;
    let bk = 0;
    for (let k = 0; k < T; k += 2) {
      const d = Math.hypot(x - t.px[k], z - t.pz[k]) - t.wh[k] - (t.edge[k] & EDGE_TUNNEL ? TUNNEL_PLUS : 0);
      if (d < best) {
        best = d;
        bk = k;
      }
    }
    nah = bk;
    return best - 0.3;
  };
  // Sprünge: Schanze, Lücke und ein Stück Landung; dazu die Anfahrt über die Sprungplatte.
  const sprung: number[] = [];
  for (let k = 0; k < T; k++) {
    if ((t.edge[k] & (EDGE_GAP | EDGE_RAMP)) === 0) continue;
    sprung.push(t.px[k], t.pz[k], t.wh[k] + SPRUNG_PLUS);
    if (t.edge[k] & EDGE_GAP && (t.edge[t.next[k]] & EDGE_GAP) === 0) {
      let j = k;
      for (let a = 0; a < 22; a++) {
        j = t.next[j];
        sprung.push(t.px[j], t.pz[j], t.wh[j] + SPRUNG_PLUS);
      }
    }
  }
  for (const r of t.rings) sprung.push(r.x, r.z, r.radius + 5);
  const imSprung = (x: number, z: number, r: number): boolean => {
    for (let q = 0; q < sprung.length; q += 3) if (Math.hypot(x - sprung[q], z - sprung[q + 1]) < sprung[q + 2] + r) return true;
    return false;
  };
  // Meteoriten: Einschlag und Herkunft am Himmel – die Schneise dazwischen bleibt frei.
  const met: number[] = []; // x, y, z, sx, sz
  for (const p of t.pulses) {
    if (p.kind !== PULSE_METEOR) continue;
    const side = p.lat >= 0 ? 1 : -1;
    met.push(p.x, p.y, p.z, p.x + t.tx[p.seg] * MET_AHEAD + rightX(t, p.seg) * side * MET_SIDE, p.z + t.tz[p.seg] * MET_AHEAD + rightZ(t, p.seg) * side * MET_SIDE);
  }
  const inSchneise = (x: number, z: number, r: number, top: number): boolean => {
    for (let q = 0; q < met.length; q += 5) {
      const ax = met[q];
      const az = met[q + 2];
      const dx = met[q + 3] - ax;
      const dz = met[q + 4] - az;
      const L2 = dx * dx + dz * dz;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const d = Math.hypot(x - ax - dx * u, z - az - dz * u);
      if (d < 14 + r && top > met[q + 1] + MET_UP * u - 10) return true;
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
  const belegt = (x: number, z: number, r: number, f = 0.9): boolean => {
    const reach = r + 40;
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
  /** Frei für ein Stück mit Radius r und Oberkante top (absolute Höhe)? */
  const frei = (x: number, z: number, r: number, top = 1e9): boolean => kante(x, z) >= RAND + r && !imSprung(x, z, r) && !inSchneise(x, z, r, top);

  // --- Boden: genau die Dreiecke des Geländes (world.ts) nachgerechnet ---------------
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
  const cell = detail === 0 ? 11 : 7.5;
  const gx0 = minX - 150;
  const gz0 = minZ - 150;
  const gnx = Math.max(1, Math.ceil((maxX - minX + 300) / cell));
  const gnz = Math.max(1, Math.ceil((maxZ - minZ + 300) / cell));
  const hCache = new Map<number, number>();
  const hv = (ix: number, iz: number): number => {
    const key = ix * 65536 + iz;
    let h = hCache.get(key);
    if (h === undefined) {
      const edge = Math.min(ix, gnx - ix, iz, gnz - iz) / 5;
      const y = world.heightAt(gx0 + ix * cell, gz0 + iz * cell);
      h = th.farY + (y - th.farY) * smooth(edge);
      hCache.set(key, h);
    }
    return h;
  };
  /** Höhe der Geländeoberfläche, wie sie gezeichnet ist (lineare Dreiecke des Rasters). */
  const bodenY = (x: number, z: number): number => {
    const fx = (x - gx0) / cell;
    const fz = (z - gz0) / cell;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    if (ix < 0 || iz < 0 || ix >= gnx || iz >= gnz) return th.farY - 0.2;
    const u = fx - ix;
    const v = fz - iz;
    const ha = hv(ix, iz);
    const hb = hv(ix + 1, iz);
    const hc = hv(ix + 1, iz + 1);
    const hd = hv(ix, iz + 1);
    if ((ix + iz) % 2 === 0) {
      return v > u ? ha + u * (hc - hd) + v * (hd - ha) : ha + u * (hb - ha) + v * (hc - hb);
    }
    return u + v < 1 ? ha + u * (hb - ha) + v * (hd - ha) : hc + (1 - u) * (hd - hc) + (1 - v) * (hb - hc);
  };

  // --- Netze ---------------------------------------------------------------------------
  const bo = new MeshBuilder(); // mit Kontur
  const bn = new MeshBuilder(); // ohne Kontur (Boden, flache und kleine Teile)
  const bg = new MeshBuilder(); // leuchtend, fest
  const dg = new MeshBuilder(); // leuchtend, bewegt (Lauflichter, Blinker, Flamme)
  const ba = new MeshBuilder(); // additiv: Lichtkegel
  const glas = new MeshBuilder();
  const lichter: Licht[] = [];
  const akt: Akteur[] = [];
  const tris = (): number => bo.triangles * (lines ? 2 : 1) + bn.triangles + bg.triangles + glas.triangles + ba.triangles + dg.triangles;
  /** Bewegtes Licht: alles, was zwischen begin() und end() in dg landet. */
  let lFirst = 0;
  const lichtBeginn = (): void => {
    lFirst = dg.triangles * 3;
  };
  const lichtEnde = (kind: number, a: number, b: number): void => {
    lichter.push({ first: lFirst, count: dg.triangles * 3 - lFirst, kind, a, b });
  };

  const segAt = (m: number, br = -1): number => {
    if (br < 0) return ((Math.round(m / t.step) % t.n) + t.n) % t.n;
    const b = t.branches[br];
    return b.first + Math.max(0, Math.min(b.count - 1, Math.round(m / t.step)));
  };
  const yawAt = (k: number): number => Math.atan2(t.tx[k], t.tz[k]);
  /** Freier Ort neben dem Weg: Meter m, seitlich lat (+ = rechts/innen); rückt nach außen, bis r frei ist. */
  const neben = (m: number, lat: number, r: number, top = 1e9, br = -1): [number, number, number] | null => {
    const k = segAt(m, br);
    const sd = lat >= 0 ? 1 : -1;
    for (let tr = 0; tr < 10; tr++) {
      const l = lat + sd * tr * 4;
      const x = t.px[k] + rightX(t, k) * l;
      const z = t.pz[k] + rightZ(t, k) * l;
      if (frei(x, z, r, top) && !belegt(x, z, r)) return [x, z, yawAt(k)];
    }
    return null;
  };
  /** Gierwinkel, mit dem lokal +z auf die nächste Fahrbahn zeigt. */
  const zurBahn = (x: number, z: number): number => {
    kante(x, z);
    return Math.atan2(t.px[nah] - x, t.pz[nah] - z);
  };

  // === Boden: Flecken, Krater, Fahrspuren ================================================

  /** Ringförmige Bodenfläche (Scheibe oder Kranz) dicht über dem Gelände, beschnitten an den Fahrbahnen. */
  const kranz = (b: MeshBuilder, x: number, z: number, r0: number, r1: number, n: number, dy: number, farbe: (a: number, ring: number) => RGB, rings = 1, minK = 0.6): void => {
    const P: V3[][] = [];
    const ok: boolean[][] = [];
    for (let j = 0; j <= rings; j++) {
      const r = r0 + ((r1 - r0) * j) / rings;
      const row: V3[] = [];
      const okr: boolean[] = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        row.push([px, bodenY(px, pz) + dy, pz]);
        okr.push(kante(px, pz) >= minK);
      }
      P.push(row);
      ok.push(okr);
    }
    const mid: V3 = [x, bodenY(x, z) + dy, z];
    const midOk = kante(x, z) >= minK;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      const am = ((k + 0.5) / n) * TAU;
      if (r0 < 0.01) {
        if (midOk && ok[1][k] && ok[1][k2]) triN(b, mid, P[1][k], P[1][k2], [0, 1, 0], farbe(am, 0));
      }
      for (let j = r0 < 0.01 ? 1 : 0; j < rings; j++) {
        if (!(ok[j][k] && ok[j][k2] && ok[j + 1][k] && ok[j + 1][k2])) continue;
        quadN(b, P[j][k], P[j][k2], P[j + 1][k2], P[j + 1][k], [0, 1, 0], farbe(am, j));
      }
    }
  };

  /** Krater mit Ringwall: Boden (mit Schattensichel), Innenhang, Kamm, Außenhang. */
  const krater = (x: number, z: number, R: number, trim: boolean, frisch = false): void => {
    const n = R < 2.5 ? 7 : R < 7 ? 10 : R < 16 ? 14 : 24;
    const h = Math.min(0.17 * R, 3.2);
    const rad = R < 2.5 ? [0, 0.7, 1, 1.5] : [0, 0.45, 0.72, 1, 1.5];
    const dyv = R < 2.5 ? [0.1, 0.1, h, 0.08] : [0.1, 0.1, 0.12, h, 0.08];
    if (R >= 16) {
      rad.splice(4, 0, 1.2);
      dyv.splice(4, 0, h * 0.55);
    }
    const P: V3[][] = [];
    const ok: number[][] = [];
    const rot = rnd() * TAU;
    const wob: number[] = [];
    for (let k = 0; k < n; k++) wob.push(0.92 + rnd() * 0.16);
    for (let j = 0; j < rad.length; j++) {
      const row: V3[] = [];
      const kr: number[] = [];
      for (let k = 0; k < n; k++) {
        const a = rot + (k / n) * TAU;
        const r = rad[j] * R * (j > 0 ? wob[k] : 1);
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        row.push([px, bodenY(px, pz) + dyv[j], pz]);
        kr.push(trim ? kante(px, pz) : 99);
      }
      P.push(row);
      ok.push(kr);
    }
    const last = rad.length - 1;
    const iKamm = rad.indexOf(1);
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      const a = rot + ((k + 0.5) / n) * TAU;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      // Sonne von (SX, SZ): Der Wall auf der Sonnenseite wirft Schatten nach innen.
      const sonnenseite = dx * SX + dz * SZ;
      for (let j = 0; j < last; j++) {
        const raised = dyv[j] > 0.5 || dyv[j + 1] > 0.5;
        const need = raised ? RAND : 0.8;
        if (trim && Math.min(ok[j][k], ok[j][k2], ok[j + 1][k], ok[j + 1][k2]) < need) continue;
        let c: RGB;
        if (j < iKamm - 1) c = sonnenseite > 0.3 && j >= 1 ? C_KRATER_S : C_KRATER;
        else if (j === iKamm - 1) c = sonnenseite > 0.15 ? C_KRATER_S : sonnenseite < -0.4 ? C_KAMM : C_HANG;
        else c = sonnenseite > 0.25 ? C_KAMM : sonnenseite < -0.35 ? C_HANG_S : C_HANG;
        if (j === 0 && rad[0] === 0) {
          triN(bn, P[0][k], P[1][k], P[1][k2], [0, 1, 0], frisch ? C_KRATER_S : c);
        } else {
          quadN(bn, P[j][k], P[j][k2], P[j + 1][k2], P[j + 1][k], [dx * (j < iKamm ? -1 : 1), 1, dz * (j < iKamm ? -1 : 1)], c);
        }
      }
    }
    // Frische Krater: helle Auswurfstrahlen
    if (frisch) {
      const m = 5 + Math.floor(rnd() * 3);
      for (let q = 0; q < m; q++) {
        const a = rnd() * TAU;
        const w = 0.18 + rnd() * 0.15;
        const l0 = R * 1.3;
        const l1 = R * (2.2 + rnd() * 1.2);
        const p1x = x + Math.cos(a - w) * l0;
        const p1z = z + Math.sin(a - w) * l0;
        const p2x = x + Math.cos(a + w) * l0;
        const p2z = z + Math.sin(a + w) * l0;
        const p3x = x + Math.cos(a) * l1;
        const p3z = z + Math.sin(a) * l1;
        if (kante(p3x, p3z) < 0.8 || kante(p1x, p1z) < 0.8 || kante(p2x, p2z) < 0.8) continue;
        triN(bn, [p1x, bodenY(p1x, p1z) + 0.1, p1z], [p2x, bodenY(p2x, p2z) + 0.1, p2z], [p3x, bodenY(p3x, p3z) + 0.1, p3z], [0, 1, 0], C_STRAHL);
      }
    }
  };

  /** Felsbrocken, halb eingesunken. */
  const brocken = (b: MeshBuilder, x: number, z: number, s: number, c: RGB): void => {
    const y = bodenY(x, z);
    rahmen(x, y, z, rnd() * TAU, 1, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5);
    teil(b, rnd() < 0.5 ? G.ico0 : G.dode, c, 0, s * 0.25, 0, rnd(), rnd(), rnd(), s * (0.9 + rnd() * 0.5), s * (0.6 + rnd() * 0.35), s * (0.9 + rnd() * 0.4));
  };

  /** Fahrspur: zwei dunkle Streifen entlang einer Punktfolge (x, z …), unterbrochen an den Fahrbahnen. */
  const spur = (pts: number[], breit: number, gauge: number): void => {
    for (let q = 0; q + 3 < pts.length; q += 2) {
      const ax = pts[q];
      const az = pts[q + 1];
      const ex = pts[q + 2];
      const ez = pts[q + 3];
      const L = Math.hypot(ex - ax, ez - az) || 1;
      const nx = -(ez - az) / L;
      const nz = (ex - ax) / L;
      if (kante(ax, az) < 1.5 || kante(ex, ez) < 1.5) continue;
      for (const sd of [-1, 1]) {
        const o0 = sd * gauge - breit / 2;
        const o1 = sd * gauge + breit / 2;
        const p = (x: number, z: number, o: number): V3 => [x + nx * o, bodenY(x + nx * o, z + nz * o) + 0.09, z + nz * o];
        quadN(bn, p(ax, az, o0), p(ex, ez, o0), p(ex, ez, o1), p(ax, az, o1), [0, 1, 0], C_SPUR);
      }
    }
  };

  // === Berge: nahe Ketten mit harten Schatten ============================================
  const berg = (x: number, z: number, r: number, h: number): void => {
    const n = 7;
    const y0 = bodenY(x, z) - 3;
    const rot = rnd() * TAU;
    const base: V3[] = [];
    const mid: V3[] = [];
    const ax = x + (rnd() - 0.5) * r * 0.5;
    const az = z + (rnd() - 0.5) * r * 0.5;
    const apex: V3 = [ax, y0 + h, az];
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * TAU + (rnd() - 0.5) * 0.4;
      const rr = r * (0.8 + rnd() * 0.45);
      base.push([x + Math.cos(a) * rr, y0, z + Math.sin(a) * rr]);
      const rm = rr * (0.42 + rnd() * 0.2);
      const hm = h * (0.36 + rnd() * 0.22);
      mid.push([ax + (x - ax) * 0.4 + Math.cos(a) * rm, y0 + hm, az + (z - az) * 0.4 + Math.sin(a) * rm]);
    }
    const ton = (nrm: V3, top: boolean): RGB => {
      const l = nrm[0] * SUN[0] + nrm[1] * SUN[1] + nrm[2] * SUN[2];
      if (l > 0.42) return top ? C_HANG : C_BERG;
      if (l > 0.08) return C_BERG_M;
      return C_BERG_S;
    };
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      const ox = (base[k][0] + base[k2][0]) / 2 - x;
      const oz = (base[k][2] + base[k2][2]) / 2 - z;
      const hint: V3 = [ox, 0.3 * r, oz];
      // unteres Band als zwei Dreiecke, jedes mit eigenem Schatten
      const t1 = [base[k], base[k2], mid[k2]] as const;
      const t2 = [base[k], mid[k2], mid[k]] as const;
      for (const tr of [t1, t2]) {
        let nrm = normale(tr[0], tr[1], tr[2]);
        if (nrm[0] * hint[0] + nrm[1] * hint[1] + nrm[2] * hint[2] < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
        triN(bn, tr[0], tr[1], tr[2], hint, ton(nrm, false));
      }
      let nrm = normale(mid[k], mid[k2], apex);
      if (nrm[0] * hint[0] + nrm[1] * hint[1] + nrm[2] * hint[2] < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
      triN(bn, mid[k], mid[k2], apex, hint, ton(nrm, true));
    }
  };
  {
    const cx = world.center.x;
    const cz = world.center.z;
    const R0 = world.radius;
    const N = [22, 30, 34][detail];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + (rnd() - 0.5) * 0.08;
      const nn = noise(i * 0.31, 7.7);
      const d = R0 + 120 + nn * 150 + rnd() * 50;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const h = 26 + nn * 50 + rnd() * 18;
      const r = h * (0.7 + rnd() * 0.4);
      if (kante(x, z) < r + 25 || inSchneise(x, z, r, h)) continue;
      berg(x, z, r, h);
      // Vorberge
      if (rnd() < 0.7) {
        const a2 = a + (rnd() - 0.5) * 0.12;
        const d2 = d - r * (0.7 + rnd() * 0.4);
        const x2 = cx + Math.cos(a2) * d2;
        const z2 = cz + Math.sin(a2) * d2;
        const h2 = h * (0.35 + rnd() * 0.25);
        if (kante(x2, z2) > h2 + 18 && !inSchneise(x2, z2, h2, h2)) berg(x2, z2, h2 * 0.9, h2);
      }
    }
  }

  // === Startkuppel ======================================================================
  // Elliptisch: lang in Fahrtrichtung (A), damit Ring und Glas von der Startaufstellung
  // aus oben im Bild stehen; quer (B) weit genug, dass Säulen und Streben seitlich bleiben.
  const kuppelOrt = { x: 0, z: 0, A: 50, B: 30, H: 15.5 };
  {
    const k0 = 0;
    const fx0 = t.tx[k0];
    const fz0 = t.tz[k0];
    const rx = rightX(t, k0);
    const rz = rightZ(t, k0);
    const cx = t.px[k0] + fx0 * 8;
    const cz = t.pz[k0] + fz0 * 8;
    kuppelOrt.x = cx;
    kuppelOrt.z = cz;
    const cy = t.py[k0];
    const A = kuppelOrt.A;
    const B = kuppelOrt.B;
    const H = cy + kuppelOrt.H;
    const HK = 11;
    const N = 44;
    const wh0 = t.wh[k0];
    /** Punkt der Ellipse: Winkel a, Maßstab s, Zuschlag d (Meter) auf beide Halbachsen. */
    const E = (a: number, s: number, d: number, y: number): V3 => {
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const fa = (A * s + d) * ca;
      const fb = (B * s + d) * sa;
      return [cx + fx0 * fa + rx * fb, y, cz + fz0 * fa + rz * fb];
    };
    const ang = (k: number): number => (k / N) * TAU;
    // Bodenplatte unter der Kuppel: helle Kacheln neben der Fahrbahn, Rand orange-schwarz
    {
      const RING = [0, 0.25, 0.45, 0.65, 0.85, 1.04, 1.09];
      const P: V3[][] = [];
      const ok: boolean[][] = [];
      for (let j = 0; j < RING.length; j++) {
        const row: V3[] = [];
        const okr: boolean[] = [];
        for (let k = 0; k < N; k++) {
          const p = E(ang(k), RING[j], 0, 0);
          p[1] = bodenY(p[0], p[2]) + 0.07;
          row.push(p);
          okr.push(kante(p[0], p[2]) >= 0.4);
        }
        P.push(row);
        ok.push(okr);
      }
      for (let j = 1; j + 1 < RING.length; j++) {
        for (let k = 0; k < N; k++) {
          const k2 = (k + 1) % N;
          if (!(ok[j][k] && ok[j][k2] && ok[j + 1][k] && ok[j + 1][k2])) continue;
          const c = j === RING.length - 2 ? (k % 2 ? C_ORANGE : C_TUSCHE) : (j + k) % 2 ? C_PLATTE : C_PLATTE_D;
          quadN(bn, P[j][k], P[j][k2], P[j + 1][k2], P[j + 1][k], [0, 1, 0], c);
        }
      }
    }
    // Ringträger
    for (let k = 0; k < N; k++) {
      const a0 = ang(k);
      const a1 = ang(k + 1);
      const am = ang(k + 0.5);
      const o: V3 = [fx0 * Math.cos(am) / A + rx * Math.sin(am) / B, 0, fz0 * Math.cos(am) / A + rz * Math.sin(am) / B];
      const cOut = k % 4 === 0 ? C_ORANGE : C_WEISS;
      quadN(bo, E(a0, 1, 0.9, H - 0.7), E(a1, 1, 0.9, H - 0.7), E(a1, 1, 0.9, H + 0.7), E(a0, 1, 0.9, H + 0.7), o, cOut);
      quadN(bo, E(a0, 1, -0.9, H - 0.7), E(a1, 1, -0.9, H - 0.7), E(a1, 1, -0.9, H + 0.7), E(a0, 1, -0.9, H + 0.7), [-o[0], 0, -o[2]], C_HELL);
      quadN(bo, E(a0, 1, -0.9, H - 0.7), E(a1, 1, -0.9, H - 0.7), E(a1, 1, 0.9, H - 0.7), E(a0, 1, 0.9, H - 0.7), [0, -1, 0], C_DUNKEL);
      quadN(bo, E(a0, 1, -0.9, H + 0.7), E(a1, 1, -0.9, H + 0.7), E(a1, 1, 0.9, H + 0.7), E(a0, 1, 0.9, H + 0.7), [0, 1, 0], C_STAHL);
      if (k % 2 === 0) {
        const p = E(am, 1, -0.3, H - 0.85);
        bg.box(p[0], p[1], p[2], 0.8, 0.25, 0.8, k % 4 === 0 ? L_ORANGE : L_WEISS);
      }
    }
    // Glaskuppel: Kappe auf dem Ring
    const PHI = [0, 0.3, 0.62, 0.95, 1.22, 1.42];
    const cap = (j: number, a: number): V3 => E(a, Math.cos(PHI[j]), 0, H + 0.7 + HK * Math.sin(PHI[j]));
    for (let j = 0; j + 1 < PHI.length; j++) {
      for (let k = 0; k < N; k++) {
        const am = ang(k + 0.5);
        quadN(glas, cap(j, ang(k)), cap(j, ang(k + 1)), cap(j + 1, ang(k + 1)), cap(j + 1, ang(k)), [fx0 * Math.cos(am) + rx * Math.sin(am), 1, fz0 * Math.cos(am) + rz * Math.sin(am)], (j + k) % 2 ? [0.82, 0.92, 1] : [0.66, 0.8, 1]);
      }
    }
    // Scheitel: elliptische Nabe mit Lichtkranz
    {
      const j = PHI.length - 1;
      const yT = H + 0.7 + HK * Math.sin(PHI[j]);
      for (let k = 0; k < N; k += 2) {
        const a0 = ang(k);
        const a1 = ang(k + 2);
        quadN(bo, cap(j, a0), cap(j, a1), E(a1, Math.cos(PHI[j]), -0.8, yT + 0.9), E(a0, Math.cos(PHI[j]), -0.8, yT + 0.9), [0, 1, 0], k % 4 ? C_WEISS : C_ORANGE);
        const p = E(ang(k + 1), Math.cos(PHI[j]), -0.4, yT + 0.95);
        bg.box(p[0], p[1], p[2], 0.6, 0.2, 0.6, L_ORANGE);
      }
    }
    // Säulen, Streben und Rippen nur seitlich der Fahrbahn
    const COL = 22;
    const kept: (V3 | null)[] = [];
    for (let k = 0; k < COL; k++) {
      const a = ((k + 0.5) / COL) * TAU;
      const p = E(a, 1, 0, 0);
      const x = p[0];
      const z = p[2];
      const lat0 = (x - cx) * rx + (z - cz) * rz;
      if (kante(x, z) < RAND + 1 || Math.abs(lat0) < wh0 + 10) {
        kept.push(null);
        continue;
      }
      const y = bodenY(x, z);
      kept.push([x, y, z]);
      rahmen(x, y, z, -a, 1);
      prisma(bo, 6, 0.8, 0.6, -0.3, H - y - 0.6, C_HELL, null, null);
      teil(bo, G.box, C_DUNKEL, 0, 0.2, 0, 0, 0, 0, 2.4, 0.8, 2.4);
      teil(bo, G.box, C_ORANGE, 0, 2.2, 0, 0, 0, 0, 1.75, 0.5, 1.75);
      belege(x, z, 2);
      rahmen(0, 0, 0, 0, 1);
      for (let j = 0; j + 1 < PHI.length; j++) stab(bo, G.zyl4, C_STAHL_D, cap(j, a), cap(j + 1, a), 0.28);
    }
    rahmen(0, 0, 0, 0, 1);
    for (let k = 0; k < COL; k++) {
      const a = kept[k];
      const b = kept[(k + 1) % COL];
      if (!a || !b) continue;
      stab(bo, G.zyl4, C_STAHL_D, [a[0], a[1] + 1, a[2]], [b[0], H - 1.2, b[2]], 0.16);
      stab(bo, G.zyl4, C_STAHL_D, [b[0], b[1] + 1, b[2]], [a[0], H - 1.2, a[2]], 0.16);
    }
    // Gewächsbeete unter der Kuppel
    for (const sd of [-1, 1]) {
      for (let f = -30; f <= 40; f += 10) {
        const lat = sd * (wh0 + 6);
        const x = cx + fx0 * f + rx * lat;
        const z = cz + fz0 * f + rz * lat;
        if ((f / A) ** 2 + (lat / B) ** 2 > 0.8 || !frei(x, z, 2) || belegt(x, z, 2)) continue;
        const y = bodenY(x, z);
        rahmen(x, y, z, yawAt(k0), 1);
        teil(bo, G.box, C_WEISS, 0, 0.45, 0, 0, 0, 0, 2.6, 0.9, 6);
        teil(bn, G.box, C_GRUEN_D, 0, 0.92, 0, 0, 0, 0, 2.3, 0.08, 5.7);
        for (let q = 0; q < 4; q++) teil(bn, G.kegel6, q % 2 ? C_GRUEN : C_GRUEN_D, (rnd() - 0.5) * 1.2, 1.4, -2.2 + q * 1.45, 0, rnd(), 0, 0.45, 1.1, 0.45);
        belege(x, z, 3);
      }
    }
  }

  // === Module, Röhren, Antennen, Mast, Tanks ============================================
  const wohnmodul = (x: number, z: number, yaw: number, len: number): void => {
    const y = bodenY(x, z);
    rahmen(x, y, z, yaw, 1);
    // Beine
    for (const sx of [-1.8, 1.8]) for (const sz of [-len * 0.32, len * 0.32]) teil(bo, G.box, C_STAHL_D, sx, 1.1, sz, 0, 0, 0, 0.4, 2.6, 0.4);
    // Zylinder entlang z
    teil(bo, G.zyl12, C_WEISS, 0, 4.2, 0, Math.PI / 2, 0, 0, 3.3, len, 3.3);
    for (const f of [-0.38, 0, 0.38]) teil(bn, G.zyl12, f === 0 ? C_ORANGE : C_HELL, 0, 4.2, f * len, Math.PI / 2, 0, 0, 3.42, 0.8, 3.42);
    for (const sd of [-1, 1]) teil(bn, G.zyl8, C_STAHL, 0, 4.2, sd * (len / 2 + 0.3), Math.PI / 2, 0, 0, 2.6, 0.6, 2.6);
    // Fensterreihe (leuchtet) auf beiden Seiten
    for (const sx of [-1, 1]) {
      for (let q = -2; q <= 2; q++) {
        if (q === 0) continue;
        const zq = q * len * 0.15;
        lq(bg, [sx * 3.33, 4.35, zq - 0.55], [sx * 3.33, 4.35, zq + 0.55], [sx * 3.2, 5.05, zq + 0.55], [sx * 3.2, 5.05, zq - 0.55], [sx, 0.3, 0], L_GELB);
      }
    }
    // Dachaufbau
    teil(bo, G.box, C_STAHL, 0, 7.6, len * 0.15, 0, 0, 0, 1.6, 0.8, 2.4);
    belege(x, z, len / 2 + 1);
  };
  const labor = (x: number, z: number, r: number): void => {
    const y = bodenY(x, z);
    rahmen(x, y, z, rnd() * TAU, 1);
    prisma(bo, 10, r * 0.8, r * 0.7, -0.3, 1.6, C_DUNKEL, C_STAHL, null);
    teil(bo, G.kugel, C_WEISS, 0, r + 1.2, 0, 0, 0, 0, r, r, r);
    teil(bo, G.zyl12, C_ORANGE, 0, r + 1.2, 0, 0, 0, 0, r * 1.02, 0.7, r * 1.02);
    for (let q = 0; q < 6; q++) {
      const a = (q / 6) * TAU;
      const p = pt(Math.cos(a) * r * 0.98, r + 1.95, Math.sin(a) * r * 0.98);
      bg.box(p[0], p[1], p[2], 0.8, 0.5, 0.8, L_BLAU);
    }
    stab(bo, G.zyl4, C_STAHL_D, [0, 2 * r + 1, 0], [0, 2 * r + 4.5, 0], 0.08);
    const tip = pt(0, 2 * r + 4.7, 0);
    lichtBeginn();
    dg.box(tip[0], tip[1], tip[2], 0.35, 0.35, 0.35, L_ROT);
    lichtEnde(L_BLINK, 1.6, rnd() * 3);
    belege(x, z, r + 1);
  };
  /** Verbindungsröhre zwischen zwei Punkten (Welt), auf Stützen; nur wenn der ganze Weg frei ist. */
  const roehre = (ax: number, az: number, ex: number, ez: number, hy: number): boolean => {
    const L = Math.hypot(ex - ax, ez - az);
    const n = Math.max(2, Math.ceil(L / 4));
    for (let q = 0; q <= n; q++) {
      const x = ax + ((ex - ax) * q) / n;
      const z = az + ((ez - az) * q) / n;
      if (kante(x, z) < RAND + 1 || imSprung(x, z, 1)) return false;
    }
    const ya = bodenY(ax, az) + hy;
    const ye = bodenY(ex, ez) + hy;
    rahmen(0, 0, 0, 0, 1);
    stab(bo, G.zyl8, C_HELL, [ax, ya, az], [ex, ye, ez], 1.15);
    const m = Math.max(1, Math.round(L / 9));
    for (let q = 1; q < m; q++) {
      const f = q / m;
      const x = ax + (ex - ax) * f;
      const z = az + (ez - az) * f;
      const y = ya + (ye - ya) * f;
      const dx = (ex - ax) / L;
      const dz = (ez - az) / L;
      stab(bo, G.zyl8, C_ORANGE, [x - dx * 0.3, y, z - dz * 0.3], [x + dx * 0.3, y, z + dz * 0.3], 1.35);
      const g = bodenY(x, z);
      stab(bn, G.zyl4, C_STAHL_D, [x, g - 0.2, z], [x, y - 1, z], 0.25);
    }
    for (let q = 1; q < n; q += 2) belege(ax + ((ex - ax) * q) / n, az + ((ez - az) * q) / n, 1.5);
    return true;
  };
  const schuessel = (x: number, z: number, s: number, dreht: boolean): void => {
    const y = bodenY(x, z);
    rahmen(x, y, z, rnd() * TAU, s);
    prisma(bo, 6, 1.6, 1.2, -0.2, 0.6, C_DUNKEL, C_STAHL, null);
    prisma(bo, 6, 0.7, 0.55, 0.6, 4.2, C_HELL, C_STAHL, null);
    if (dreht) {
      akt.push({ v: -1, kind: K_STARR, rolle: R_SCHUESSEL, p: [x, y + 4.2 * s, z, s, rnd() * TAU] });
    } else {
      // feste Schüssel: zum Himmel gerichtet
      teil(bo, G.box, C_STAHL_D, 0, 4.7, 0, 0, 0, 0, 1.4, 1, 0.8);
      rahmen(x, y + 5.3 * s, z, rnd() * TAU, s, -0.75);
      teil(bo, G.halb, C_WEISS, 0, 0.8, 0, Math.PI, 0, 0, 3.4, 1.1, 3.4);
      stab(bo, G.zyl4, C_STAHL_D, [0, -0.2, 0], [0, 2.8, 0], 0.09);
      teil(bo, G.box, C_ORANGE, 0, 2.9, 0, 0, 0, 0, 0.5, 0.5, 0.5);
    }
    belege(x, z, 4 * s);
  };
  const gittermast = (x: number, z: number, h: number, blink: boolean): void => {
    const y = bodenY(x, z);
    rahmen(x, y, z, rnd() * TAU, 1);
    const r0 = 1.6;
    const r1 = 0.45;
    const lv = Math.max(3, Math.round(h / 3.4));
    const P = (k: number, f: number): V3 => {
      const a = (k / 3) * TAU;
      const r = r0 + (r1 - r0) * f;
      return [Math.cos(a) * r, f * h, Math.sin(a) * r];
    };
    for (let k = 0; k < 3; k++) {
      stab(bo, G.zyl4, k === 0 ? C_ORANGE : C_HELL, P(k, 0), P(k, 1), 0.12);
      for (let l = 0; l < lv; l++) {
        const f0 = l / lv;
        const f1 = (l + 1) / lv;
        stab(bn, G.zyl4, l % 2 ? C_ORANGE : C_HELL, P(k, f0), P(k + 1, f1), 0.06);
      }
    }
    teil(bo, G.box, C_DUNKEL, 0, 0.3, 0, 0, 0, 0, 3.6, 0.6, 3.6);
    if (blink) {
      const tip = pt(0, h + 0.4, 0);
      lichtBeginn();
      dg.box(tip[0], tip[1], tip[2], 0.7, 0.7, 0.7, L_ROT);
      lichtEnde(L_BLINK, 1.2, 0);
      const mid = pt(0, h * 0.55, 0);
      lichtBeginn();
      dg.box(mid[0], mid[1], mid[2], 0.45, 0.45, 0.45, L_ROT);
      lichtEnde(L_BLINK, 1.2, 0.6);
    }
    belege(x, z, 2.5);
  };
  const tanks = (x: number, z: number, yaw: number): void => {
    const y = bodenY(x, z);
    rahmen(x, y, z, yaw, 1);
    teil(bo, G.box, C_DUNKEL, 0, 0.25, 0, 0, 0, 0, 16, 0.5, 9);
    for (let q = 0; q < 3; q++) {
      const ox = -5 + q * 5;
      teil(bo, G.zyl12, C_WEISS, ox, 4.6, -1.5, 0, 0, 0, 2.2, 8, 2.2);
      teil(bo, G.halb, C_WEISS, ox, 8.6, -1.5, 0, 0, 0, 2.2, 1.2, 2.2);
      teil(bo, G.zyl12, C_ORANGE, ox, 6.5, -1.5, 0, 0, 0, 2.25, 0.8, 2.25);
      teil(bo, G.zyl12, C_TUSCHE, ox, 3.2, -1.5, 0, 0, 0, 2.25, 0.25, 2.25);
    }
    for (const ox of [-3, 3]) {
      teil(bo, G.kugel, C_HELL, ox, 3.2, 3, 0, 0, 0, 1.9, 1.9, 1.9);
      for (const sx of [-1, 1]) teil(bn, G.box, C_STAHL_D, ox + sx, 0.8, 3, 0, 0, 0, 0.25, 1.6, 0.25);
    }
    stab(bo, G.zyl6, C_STAHL, [-7, 1.6, 1.2], [7, 1.6, 1.2], 0.3);
    stab(bo, G.zyl6, C_ORANGE, [-7, 2.3, 1.2], [7, 2.3, 1.2], 0.22);
    belege(x, z, 9);
  };
  const flutlicht = (x: number, z: number, h: number, zielX: number, zielZ: number): void => {
    const y = bodenY(x, z);
    const yaw = Math.atan2(zielX - x, zielZ - z);
    rahmen(x, y, z, yaw, 1);
    prisma(bo, 6, 0.38, 0.26, -0.2, h, C_HELL, null, null);
    teil(bo, G.box, C_DUNKEL, 0, 0.3, 0, 0, 0, 0, 1.6, 0.6, 1.6);
    teil(bo, G.box, C_DUNKEL, 0, h + 0.6, 0.2, 0, 0, 0, 3.4, 1.5, 0.7);
    teil(bo, G.box, C_ORANGE, 0, h - 0.25, 0.2, 0, 0, 0, 3.6, 0.25, 0.9);
    for (const sx of [-1.05, 0, 1.05]) {
      for (const sy of [0.25, 0.95]) {
        const p = pt(sx, h + sy, 0.58);
        bg.box(p[0], p[1], p[2], 0.8, 0.5, 0.2, L_WEISS, yaw);
      }
    }
    belege(x, z, 1.5);
  };
  const bake = (b: MeshBuilder, x: number, z: number, yaw: number): void => {
    const y = bodenY(x, z);
    rahmen(x, y, z, yaw, 1);
    prisma(b, 4, 0.4, 0.24, -0.2, 0.9, C_ORANGE, null, null, Math.PI / 4);
    prisma(b, 4, 0.24, 0.24, 0.9, 1.6, C_WEISS, null, null, Math.PI / 4);
    prisma(b, 4, 0.24, 0.2, 1.6, 2.3, C_ORANGE, C_TUSCHE, null, Math.PI / 4);
    const p = pt(0, 2.55, 0);
    rahmen(p[0], p[1], p[2], yaw, 1);
    teil(bg, G.okt, L_ORANGE, 0, 0, 0, 0, 0, 0, 0.32, 0.38, 0.32);
  };

  // Seitlich der Startgeraden: Modulgruppen beidseits, verbunden mit der Kuppel.
  const zurKuppel = (x: number, z: number, hy: number): void => {
    // Punkt auf dem Kuppelrand in Richtung des Moduls (Ellipse, etwas außerhalb)
    const fx0 = t.tx[0];
    const fz0 = t.tz[0];
    const dx = x - kuppelOrt.x;
    const dz = z - kuppelOrt.z;
    const u = (dx * fx0 + dz * fz0) / kuppelOrt.A;
    const v = (dx * rightX(t, 0) + dz * rightZ(t, 0)) / kuppelOrt.B;
    const l = Math.hypot(u, v) || 1;
    const a = Math.atan2(v / l, u / l);
    const fa = (kuppelOrt.A + 1.5) * Math.cos(a);
    const fb = (kuppelOrt.B + 1.5) * Math.sin(a);
    roehre(x, z, kuppelOrt.x + fx0 * fa + rightX(t, 0) * fb, kuppelOrt.z + fz0 * fa + rightZ(t, 0) * fb, hy);
  };
  const plaetze: Record<string, [number, number, number] | null> = {};
  {
    const wh0 = t.wh[0];
    const A = neben(72, wh0 + 15, 8);
    if (A) wohnmodul(A[0], A[1], A[2], 15);
    const B = neben(100, wh0 + 30, 7);
    if (B) labor(B[0], B[1], 5);
    const C = neben(128, wh0 + 15, 8);
    if (C) wohnmodul(C[0], C[1], C[2], 13);
    const D = neben(88, wh0 + 54, 8);
    if (D) wohnmodul(D[0], D[1], D[2] + Math.PI / 2, 14);
    const E = neben(70, -(wh0 + 15), 8);
    if (E) wohnmodul(E[0], E[1], E[2], 14);
    const F = neben(100, -(wh0 + 27), 7);
    if (F) labor(F[0], F[1], 4.4);
    if (A && B) roehre(A[0], A[1], B[0], B[1], 4.2);
    if (B && C) roehre(B[0], B[1], C[0], C[1], 4.2);
    if (B && D) roehre(B[0], B[1], D[0], D[1], 4.2);
    if (A) zurKuppel(A[0] - t.tx[0] * 7.5, A[1] - t.tz[0] * 7.5, 4.2);
    if (E && F) roehre(E[0], E[1], F[0], F[1], 4.2);
    if (E) zurKuppel(E[0] - t.tx[0] * 7, E[1] - t.tz[0] * 7, 4.2);
    plaetze.astroA = A;
    plaetze.astroE = E;
    const S1 = neben(132, -(wh0 + 28), 6, 40);
    if (S1) schuessel(S1[0], S1[1], 1.3, true);
    plaetze.schuessel = S1;
    const M = neben(20, -(wh0 + 44), 3, 60);
    if (M) gittermast(M[0], M[1], 34, true);
    const Tk = neben(t.length - 30, -(wh0 + 22), 10);
    if (Tk) tanks(Tk[0], Tk[1], Tk[2]);
    const S2 = neben(t.length - 60, wh0 + 26, 6, 40);
    if (S2) schuessel(S2[0], S2[1], 1, false);
    const S3 = neben(390, -(wh0 + 30), 6, 40);
    if (S3) schuessel(S3[0], S3[1], 1.1, false);
  }

  // === Schleuse: Portale an den Tunnelenden der Hauptstrecke ==============================
  {
    for (let k = 0; k < t.n; k++) {
      const inT = (t.edge[k] & EDGE_TUNNEL) !== 0;
      if (!inT) continue;
      const first = (t.edge[t.prev[k]] & EDGE_TUNNEL) === 0;
      const last = (t.edge[t.next[k]] & EDGE_TUNNEL) === 0;
      if (!first && !last) continue;
      const fwd = first ? -1.4 : 1.4;
      const wh = t.wh[k];
      const x = t.px[k] + t.tx[k] * fwd;
      const z = t.pz[k] + t.tz[k] * fwd;
      const y = t.py[k];
      rahmen(x, y, z, yawAt(k), 1);
      const L = wh + RAND + 0.9;
      // Pfeiler
      for (const sd of [-1, 1]) {
        teil(bo, G.box, C_HELL, sd * L, 5, 0, 0, 0, 0, 1.8, 10.6, 1.8);
        teil(bo, G.box, C_ORANGE, sd * L, 1.2, 0, 0, 0, 0, 1.95, 1.4, 1.95);
        // Tor (aufgefahren) neben der Öffnung
        teil(bo, G.box, C_STAHL, sd * (L + 4.2), 4.6, first ? 0.6 : -0.6, 0, 0, 0, 6.4, 9.2, 0.8);
        for (let q = 0; q < 4; q++) teil(bn, G.box, q % 2 ? C_TUSCHE : C_ORANGE, sd * (L + 1.3 + q * 0.4), 4.6, first ? 1.05 : -1.05, 0, 0, 0, 0.4, 9.2, 0.1);
        // Ampel
        const p = pt(sd * L, 7.3, first ? -1 : 1);
        lichtBeginn();
        dg.box(p[0], p[1], p[2], 0.55, 0.55, 0.3, L_GRUEN, yawAt(k));
        lichtEnde(L_BLINK, 2.4, sd > 0 ? 0 : 1.2);
      }
      // Sturz mit Warnstreifen
      teil(bo, G.box, C_DUNKEL, 0, 10.1, 0, 0, 0, 0, 2 * L + 1.8, 2, 1.8);
      const nS = 14;
      for (let q = 0; q < nS; q++) {
        const x0 = -L - 0.9 + ((2 * L + 1.8) * q) / nS;
        const x1 = -L - 0.9 + ((2 * L + 1.8) * (q + 1)) / nS;
        const zf = first ? -0.92 : 0.92;
        lq(bn, [x0, 9.3, zf], [x1, 9.3, zf], [x1, 10.9, zf], [x0, 10.9, zf], [0, 0, zf], q % 2 ? C_TUSCHE : C_ORANGE);
      }
      for (let q = -2; q <= 2; q++) {
        const p = pt(q * (L / 2.6), 8.95, first ? -0.5 : 0.5);
        bg.box(p[0], p[1], p[2], 0.9, 0.2, 0.9, L_ORANGE);
      }
    }
  }

  // === Lavaröhre: Basalt mit glühenden Adern an den Mündungen ============================
  {
    for (let k = t.n; k < T; k++) {
      if ((t.edge[k] & EDGE_TUNNEL) === 0) continue;
      const first = (t.edge[t.prev[k]] & EDGE_TUNNEL) === 0;
      const last = (t.edge[t.next[k]] & EDGE_TUNNEL) === 0;
      if (!first && !last) continue;
      for (let q = 0; q < 7; q++) {
        const sd = q % 2 ? 1 : -1;
        const lat = sd * (t.wh[k] + TUNNEL_PLUS + RAND + 1 + rnd() * 6);
        const f = (first ? -1 : 1) * (2 + rnd() * 8);
        const x = t.px[k] + rightX(t, k) * lat + t.tx[k] * f;
        const z = t.pz[k] + rightZ(t, k) * lat + t.tz[k] * f;
        if (!frei(x, z, 1.5)) continue;
        const s = 1.4 + rnd() * 1.6;
        brocken(bo, x, z, s, C_BASALT);
        const y = bodenY(x, z);
        rahmen(x, y, z, rnd() * TAU, 1);
        teil(bg, G.okt, L_ORANGE, 0, s * 0.25, 0, rnd(), rnd(), 0, s * 1.05, 0.12, 0.25);
      }
    }
  }

  // === Landeplatz mit Fähre und Raketenstartplatz ========================================
  {
    const wh = t.wh[segAt(275)];
    const L = neben(275, wh + 42, 15, 40);
    if (L) {
      const [x, z] = L;
      const y = bodenY(x, z) + 0.1;
      rahmen(x, y, z, 0, 1);
      prisma(bo, 8, 13, 12.4, -1, 0.6, C_STAHL_D, C_HELL, null, Math.PI / 8);
      kranz(bn, x, z, 13.2, 21, 16, 0.07, (a) => (Math.sin(a * 5) > 0.3 ? C_KRATER_S : C_KRATER), 1, 1);
      // Markierung: oranger Ring und Kreuz
      for (let q = 0; q < 16; q++) {
        const a0 = (q / 16) * TAU;
        const a1 = ((q + 1) / 16) * TAU;
        lq(bn, [Math.cos(a0) * 8.4, 0.66, Math.sin(a0) * 8.4], [Math.cos(a1) * 8.4, 0.66, Math.sin(a1) * 8.4], [Math.cos(a1) * 9.6, 0.66, Math.sin(a1) * 9.6], [Math.cos(a0) * 9.6, 0.66, Math.sin(a0) * 9.6], [0, 1, 0], q % 2 ? C_ORANGE : C_TUSCHE);
      }
      lq(bn, [-0.6, 0.67, -6], [0.6, 0.67, -6], [0.6, 0.67, 6], [-0.6, 0.67, 6], [0, 1, 0], C_WEISS);
      lq(bn, [-6, 0.67, -0.6], [6, 0.67, -0.6], [6, 0.67, 0.6], [-6, 0.67, 0.6], [0, 1, 0], C_WEISS);
      // Randlichter (laufen im Kreis)
      for (let q = 0; q < 12; q++) {
        const a = (q / 12) * TAU;
        const p = pt(Math.cos(a) * 11.6, 0.8, Math.sin(a) * 11.6);
        lichtBeginn();
        dg.box(p[0], p[1], p[2], 0.45, 0.3, 0.45, L_GELB);
        lichtEnde(L_KREIS, q, 12);
      }
      // Fähre
      rahmen(x + 1.5, y + 0.6, z - 1, rnd() * TAU, 1.15);
      prisma(bo, 8, 2.6, 2.6, 1.6, 3.6, C_GOLD, C_GOLD_D, C_GOLD_D, 0, C_GOLD_D);
      for (let q = 0; q < 4; q++) {
        const a = (q / 4) * TAU + Math.PI / 4;
        const c = Math.cos(a);
        const s = Math.sin(a);
        stab(bo, G.zyl4, C_HELL, [c * 2.2, 3, s * 2.2], [c * 4.3, 0.35, s * 4.3], 0.14);
        stab(bn, G.zyl4, C_STAHL_D, [c * 2.4, 1.8, s * 2.4], [c * 4.1, 0.6, s * 4.1], 0.08);
        teil(bo, G.zyl8, C_HELL, c * 4.35, 0.15, s * 4.35, 0, 0, 0, 0.75, 0.25, 0.75);
      }
      teil(bo, G.kegel8, C_STAHL_D, 0, 1.2, 0, Math.PI, 0, 0, 1, 1, 1);
      teil(bo, G.dode, C_WEISS, 0, 5, 0, 0, 0.3, 0, 2.1, 1.7, 2);
      teil(bo, G.box, C_HELL, 0, 4.2, 1.6, 0, 0, 0, 1.2, 1.4, 0.9);
      teil(bn, G.box, C_FENSTER, -0.7, 5.3, 1.75, 0.3, 0.4, 0, 0.6, 0.5, 0.1);
      teil(bn, G.box, C_FENSTER, 0.7, 5.3, 1.75, 0.3, -0.4, 0, 0.6, 0.5, 0.1);
      stab(bo, G.zyl4, C_STAHL_D, [0.6, 6.4, -0.4], [0.9, 8.2, -0.6], 0.06);
      teil(bo, G.halb, C_WEISS, 0.9, 8.2, -0.6, Math.PI - 0.5, 0, 0, 0.6, 0.25, 0.6);
      belege(x, z, 14);
      plaetze.lande = [x, z, 0];
      // Treppe/Gerätewagen daneben
      const xw = x + 9;
      const zw = z + 9;
      if (frei(xw, zw, 3) && !belegt(xw, zw, 2)) {
        rahmen(xw, bodenY(xw, zw), zw, rnd() * TAU, 1);
        teil(bo, G.box, C_ORANGE, 0, 1, 0, 0, 0, 0, 2.2, 1.2, 3.6);
        teil(bo, G.box, C_HELL, 0, 2, -0.6, 0, 0, 0, 2, 0.8, 1.8);
        for (const sx of [-1.1, 1.1]) for (const sz of [-1.2, 1.2]) teil(bn, G.zyl8, C_TUSCHE, sx, 0.4, sz, 0, 0, Math.PI / 2, 0.4, 0.3, 0.4);
        belege(xw, zw, 3);
      }
    }
  }
  // Raketenstartplatz weit draußen
  let rakete: [number, number, number] | null = null;
  {
    const cx = world.center.x;
    const cz = world.center.z;
    for (let q = 0; q < 24 && !rakete; q++) {
      const a = -1.25 + (q % 2 ? 1 : -1) * Math.floor((q + 1) / 2) * 0.22;
      const d = world.radius + 45 + (q % 3) * 20;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (kante(x, z) < 70 || inSchneise(x, z, 20, 500) || belegt(x, z, 20)) continue;
      const y = bodenY(x, z);
      rakete = [x, y + 1.6, z];
      rahmen(x, y, z, Math.atan2(cx - x, cz - z), 1);
      prisma(bo, 8, 15, 13.5, -1.5, 1.6, C_STAHL_D, C_HELL, null, Math.PI / 8);
      kranz(bn, x, z, 15.2, 30, 18, 0.07, (a) => (Math.sin(a * 4 + 1) > -0.2 ? C_KRATER_S : C_KRATER), 1, 1);
      teil(bn, G.box, C_TUSCHE, 0, 1.62, 0, 0, 0, 0, 4.2, 0.05, 4.2);
      // Turm
      rahmen(x - 7, y + 1.6, z, 0, 1);
      for (const [sx, sz] of [
        [-1.4, -1.4],
        [1.4, -1.4],
        [1.4, 1.4],
        [-1.4, 1.4],
      ])
        stab(bo, G.zyl4, C_ORANGE, [sx, 0, sz], [sx, 36, sz], 0.2);
      for (let l = 0; l < 10; l++) {
        const y0 = l * 3.6;
        stab(bn, G.zyl4, C_HELL, [-1.4, y0, -1.4], [1.4, y0 + 3.6, -1.4], 0.1);
        stab(bn, G.zyl4, C_HELL, [1.4, y0, 1.4], [-1.4, y0 + 3.6, 1.4], 0.1);
        stab(bn, G.zyl4, C_HELL, [-1.4, y0, 1.4], [-1.4, y0 + 3.6, -1.4], 0.1);
      }
      for (const yy of [12, 24]) stab(bo, G.box, C_DUNKEL, [1.4, yy, 0], [5, yy, 0], 0.5);
      const tip = pt(0, 37, 0);
      lichtBeginn();
      dg.box(tip[0], tip[1], tip[2], 1, 1, 1, L_ROT);
      lichtEnde(L_BLINK, 1.4, 0.3);
      belege(x, z, 16);
    }
  }

  // === Solarfeld zwischen Hauptweg und Lavaröhre =========================================
  const solarPanels: number[] = []; // x, y, z
  {
    const tube: number[] = [];
    for (let k = t.n; k < T; k++) if (t.edge[k] & EDGE_TUNNEL) tube.push(k);
    if (tube.length > 0) {
      let cx = 0;
      let cz = 0;
      for (const k of tube) {
        cx += t.px[k];
        cz += t.pz[k];
      }
      cx /= tube.length;
      cz /= tube.length;
      const az = Math.atan2(SX, SZ);
      const ux = Math.cos(az);
      const uz = -Math.sin(az);
      const vx = Math.sin(az);
      const vz = Math.cos(az);
      const want = [26, 50, 72][detail];
      const nahRoehre = (x: number, z: number): number => {
        let best = Infinity;
        for (let q = 0; q < tube.length; q += 3) best = Math.min(best, Math.hypot(x - t.px[tube[q]], z - t.pz[tube[q]]));
        return best;
      };
      const kand: [number, number, number][] = [];
      for (let i = -14; i <= 14; i++) {
        for (let j = -10; j <= 10; j++) {
          const x = cx + ux * i * 6.2 + vx * j * 7.5;
          const z = cz + uz * i * 6.2 + vz * j * 7.5;
          const d = nahRoehre(x, z);
          if (d > 52) continue;
          kand.push([x, z, d]);
        }
      }
      kand.sort((a, b) => a[2] - b[2]);
      const BETA = 0.62;
      const sb = Math.sin(BETA);
      const cb = Math.cos(BETA);
      let n = 0;
      for (const [x, z] of kand) {
        if (n >= want) break;
        if (!frei(x, z, 3.2, 20) || belegt(x, z, 2.6)) continue;
        const y = bodenY(x, z);
        rahmen(x, y, z, az, 1);
        teil(bn, G.box, C_STAHL_D, 0, 1.1, 0, 0, 0, 0, 0.28, 2.4, 0.28);
        teil(bn, G.box, C_DUNKEL, 0, 0.1, 0, 0, 0, 0, 1.3, 0.25, 1.3);
        // Paneel: von vorn unten (+z) nach hinten oben geneigt, zeigt zur Sonne
        const W = 2.7;
        const D = 1.6;
        const P = (u: number, v: number, off: number): V3 => [u, 2.45 + v * sb + off * cb, -v * cb + off * sb];
        const nrm: V3 = [0, cb, sb];
        lq(bo, P(-W, -D, 0), P(W, -D, 0), P(W, D, 0), P(-W, D, 0), [0, -cb, -sb], C_HELL);
        lq(bo, P(-W, -D, 0.01), P(W, -D, 0.01), P(W, D, 0.01), P(-W, D, 0.01), nrm, C_STAHL);
        for (let ci = 0; ci < 3; ci++) {
          for (let cj = 0; cj < 2; cj++) {
            const u0 = -W + 0.12 + (ci * (2 * W - 0.24)) / 3 + 0.06;
            const u1 = -W + 0.12 + ((ci + 1) * (2 * W - 0.24)) / 3 - 0.06;
            const v0 = -D + 0.12 + (cj * (2 * D - 0.24)) / 2 + 0.06;
            const v1 = -D + 0.12 + ((cj + 1) * (2 * D - 0.24)) / 2 - 0.06;
            lq(bn, P(u0, v0, 0.05), P(u1, v0, 0.05), P(u1, v1, 0.05), P(u0, v1, 0.05), nrm, cj === 1 ? C_SOLAR_H : C_SOLAR);
          }
        }
        const c = pt(0, 2.45 + 0.4, 0);
        solarPanels.push(c[0], c[1], c[2]);
        belege(x, z, 2.8);
        n++;
      }
      // Wechselrichterhaus und Schüssel am Rand des Feldes
      plaetze.solar = [cx, cz, az];
    }
  }

  // === Massenbeschleuniger ==============================================================
  {
    let main: (typeof t.launchers)[number] | null = null;
    for (const l of t.launchers) if (t.branchOf[l.seg] < 0) main = l;
    if (main) {
      const segs: number[] = [];
      let k = main.seg;
      for (let a = 0; a < 86; a++) {
        k = t.prev[k];
        segs.unshift(k);
      }
      // ab etwas vor der Platte (dort stehen die Baken aus moon.ts) bis 86 m davor
      const n = segs.length - 3;
      for (const sd of [-1, 1]) {
        // Spulenringe (Außenradius 1,8 m) bleiben so mindestens RAND neben der Kante.
        const off = (s: number): number => sd * (t.wh[s] + RAND + 2.1);
        const P = (s: number, dy: number, dl = 0): V3 => {
          const l = off(s) + sd * dl;
          return [t.px[s] + rightX(t, s) * l, t.py[s] + dy, t.pz[s] + rightZ(t, s) * l];
        };
        rahmen(0, 0, 0, 0, 1);
        let idx = 0;
        const st = detail === 0 ? 4 : 2;
        for (let a = 0; a + st < n; a += st) {
          const s0 = segs[a];
          const s1 = segs[a + st];
          // Schiene: Kasten auf Höhe 1,5 m, oben Stromschiene
          stab(bo, G.box, C_DUNKEL, P(s0, 1.4), P(s1, 1.4), 0.75);
          // Stromschiene oben (Kupfer) und Lauflicht zur Fahrbahn hin
          {
            const a0 = P(s0, 1.79, 0.15);
            const a1 = P(s1, 1.79, 0.15);
            const b0 = P(s0, 1.79, -0.15);
            const b1 = P(s1, 1.79, -0.15);
            quadN(bn, a0, a1, b1, b0, [0, 1, 0], C_KUPFER);
            const l0 = P(s0, 1.8, -0.05);
            const l1 = P(s0, 1.8, -0.4);
            const f = 0.6;
            const e0: V3 = [l0[0] + (a1[0] - a0[0]) * f, l0[1] + (a1[1] - a0[1]) * f, l0[2] + (a1[2] - a0[2]) * f];
            const e1: V3 = [l1[0] + (a1[0] - a0[0]) * f, l1[1] + (a1[1] - a0[1]) * f, l1[2] + (a1[2] - a0[2]) * f];
            lichtBeginn();
            quadN(dg, l0, e0, e1, l1, [0, 1, 0], L_ORANGE);
            const d0 = P(s0, 1.05, -0.4);
            const d1: V3 = [d0[0] + (a1[0] - a0[0]) * f, d0[1] + (a1[1] - a0[1]) * f, d0[2] + (a1[2] - a0[2]) * f];
            quadN(dg, l1, e1, d1, d0, [-rightX(t, s0) * sd, 0, -rightZ(t, s0) * sd], L_ORANGE);
            lichtEnde(L_LAUF, idx++, sd);
          }
          if (a % 12 === 0) {
            const g = P(s0, 0);
            const gy = bodenY(g[0], g[2]);
            stab(bn, G.zyl4, C_STAHL_D, [g[0], gy - 0.3, g[2]], [g[0], t.py[s0] + 1.1, g[2]], 0.28);
          }
          if (a % 8 === 0) {
            // Spulenring um die Schiene, Achse in Fahrtrichtung
            const c = P(s0, 1.5);
            rahmen(c[0], c[1], c[2], yawAt(s0), 1);
            teil(bo, G.ring, (a / 8) % 2 < 1 ? C_KUPFER : C_ORANGE, 0, 0, 0, 0, 0, 0, 1.55, 1.55, 1.55);
            teil(bn, G.box, C_TUSCHE, 0, -1.1, 0, 0, 0, 0, 0.5, 1.2, 0.5);
            rahmen(0, 0, 0, 0, 1);
          }
        }
        // Kopfstation am Anfang
        const s0 = segs[0];
        const h = P(s0, 0, 1.2);
        rahmen(h[0], bodenY(h[0], h[2]), h[2], yawAt(s0), 1);
        teil(bo, G.box, C_HELL, 0, 2.2, -1.5, 0, 0, 0, 3.6, 4.4, 5);
        teil(bo, G.box, C_ORANGE, 0, 4.6, -1.5, 0, 0, 0, 3.8, 0.5, 5.2);
        for (let q = 0; q < 5; q++) teil(bn, G.box, q % 2 ? C_TUSCHE : C_ORANGE, sd * -1.82, 1.2, -3.6 + q * 1.05, 0, 0, 0, 0.05, 1.6, 1.05);
        const lp = pt(0, 5.2, -1.5);
        lichtBeginn();
        dg.box(lp[0], lp[1], lp[2], 0.6, 0.6, 0.6, L_ORANGE);
        lichtEnde(L_BLINK, 0.8, sd > 0 ? 0.4 : 0);
        belege(h[0], h[2], 3);
      }
      // Flutlichtmasten: an der Anfahrt und an der Landung
      const fl = (s: number, sd: number): void => {
        const lat = sd * (t.wh[s] + RAND + 5.5);
        const x = t.px[s] + rightX(t, s) * lat;
        const z = t.pz[s] + rightZ(t, s) * lat;
        if (!frei(x, z, 1.2) || belegt(x, z, 1.2)) return;
        const tl = sd * (t.wh[s] * 0.35);
        flutlicht(x, z, 13, t.px[s] + rightX(t, s) * tl + t.tx[s] * 8, t.pz[s] + rightZ(t, s) * tl + t.tz[s] * 8);
      };
      for (const sd of [-1, 1]) {
        fl(segs[4], sd);
        fl(segs[44], sd);
      }
      // nach der Landung
      let e = main.seg;
      let guard = 0;
      while ((t.edge[e] & (EDGE_GAP | EDGE_RAMP | EDGE_DECK)) === 0 && guard++ < 40) e = t.next[e];
      guard = 0;
      while (t.edge[e] & (EDGE_GAP | EDGE_RAMP | EDGE_DECK) && guard++ < 80) e = t.next[e];
      let s2 = e;
      for (let a = 0; a < 30; a++) s2 = t.next[s2];
      for (const sd of [-1, 1]) fl(s2, sd);
      plaetze.beschl = [t.px[segs[30]], t.pz[segs[30]], segs[30]];
    }
  }

  // Flutlicht am Start und am Meteoritenfeld
  {
    const s = segAt(150);
    for (const sd of [-1, 1]) {
      const lat = sd * (t.wh[s] + RAND + 5.5);
      const x = t.px[s] + rightX(t, s) * lat;
      const z = t.pz[s] + rightZ(t, s) * lat;
      if (frei(x, z, 1.2) && !belegt(x, z, 1.2)) flutlicht(x, z, 12, t.px[s] + t.tx[s] * 14 + rightX(t, s) * sd * 3, t.pz[s] + t.tz[s] * 14 + rightZ(t, s) * sd * 3);
    }
  }

  // === Meteoritenfeld: Warntafeln und frische Einschläge ==================================
  {
    let firstSeg = -1;
    for (const p of t.pulses) if (p.kind === PULSE_METEOR && (firstSeg < 0 || t.prog[p.seg] < t.prog[firstSeg])) firstSeg = p.seg;
    if (firstSeg >= 0) {
      let s = firstSeg;
      for (let a = 0; a < 34; a++) s = t.prev[s];
      for (const sd of [-1, 1]) {
        const lat = sd * (t.wh[s] + RAND + 1.2);
        const x = t.px[s] + rightX(t, s) * lat;
        const z = t.pz[s] + rightZ(t, s) * lat;
        if (!frei(x, z, 1.5, 6) || belegt(x, z, 1.5)) continue;
        const y = bodenY(x, z);
        rahmen(x, y, z, Math.atan2(-t.tx[s], -t.tz[s]) + sd * 0.25, 1);
        for (const sx of [-1.3, 1.3]) teil(bo, G.box, C_STAHL_D, sx, 1.5, 0, 0, 0, 0, 0.22, 3, 0.22);
        teil(bo, G.box, C_TUSCHE, 0, 3.4, 0, 0, 0, 0, 3.4, 2.1, 0.18);
        // Schräge Warnstreifen
        for (let q = 0; q < 6; q++) {
          const u0 = -1.55 + q * 0.52;
          lq(bn, [u0, 2.5, 0.1], [u0 + 0.26, 2.5, 0.1], [u0 + 0.5, 4.3, 0.1], [u0 + 0.24, 4.3, 0.1], [0, 0, 1], C_ORANGE);
        }
        // Symbol: Feuerball (Kreis + Schweif) in der Mitte
        teil(bn, G.okt, C_WEISS, 0.3, 3.4, 0.14, 0, 0, 0, 0.42, 0.42, 0.05);
        lq(bn, [0.1, 3.6, 0.13], [0.5, 3.2, 0.13], [-0.9, 4.1, 0.13], [-0.9, 4.1, 0.13], [0, 0, 1], C_WEISS);
        for (const sx of [-1.45, 1.45]) {
          const p = pt(sx, 4.65, 0);
          lichtBeginn();
          dg.box(p[0], p[1], p[2], 0.35, 0.35, 0.35, L_ORANGE);
          lichtEnde(L_BLINK, 0.9, sx > 0 ? 0.45 : 0);
        }
        belege(x, z, 2);
      }
      // frische Krater rund um die Einschlagstellen, neben der Fahrbahn
      for (const p of t.pulses) {
        if (p.kind !== PULSE_METEOR) continue;
        for (let q = 0; q < 3; q++) {
          const sd = rnd() < 0.5 ? -1 : 1;
          const lat = sd * (t.wh[p.seg] + 4 + rnd() * 18);
          const f = (rnd() - 0.5) * 16;
          const x = t.px[p.seg] + rightX(t, p.seg) * lat + t.tx[p.seg] * f;
          const z = t.pz[p.seg] + rightZ(t, p.seg) * lat + t.tz[p.seg] * f;
          const R = 1.2 + rnd() * 2.2;
          if (kante(x, z) < R * 1.5 + 1 || belegt(x, z, R)) continue;
          krater(x, z, R, false, true);
          belege(x, z, R);
          if (rnd() < 0.6) brocken(bo, x + R * 1.6, z - R * 0.8, 0.5 + rnd() * 0.5, C_BASALT);
        }
      }
    }
  }

  // === Spalten unter den Sprunglücken: dunkler Grund, gezackter Rand ======================
  {
    const C_SPALT = rgb(0x24222e);
    for (let k = 0; k < T; k += 2) {
      if ((t.edge[k] & EDGE_GAP) === 0) continue;
      const j = t.next[t.next[k]];
      const w0 = t.wh[k];
      const p = (s: number, l: number, dy: number): V3 => {
        const x = t.px[s] + rightX(t, s) * l;
        const z = t.pz[s] + rightZ(t, s) * l;
        return [x, bodenY(x, z) + dy, z];
      };
      const jagA = 2 + rnd() * 4;
      const jagB = 2 + rnd() * 4;
      const jagC = 2 + rnd() * 4;
      const jagD = 2 + rnd() * 4;
      quadN(bn, p(k, -w0 * 0.75, 0.16), p(j, -w0 * 0.75, 0.16), p(j, w0 * 0.75, 0.16), p(k, w0 * 0.75, 0.16), [0, 1, 0], C_SPALT);
      quadN(bn, p(k, -w0 - jagA, 0.13), p(j, -w0 - jagB, 0.13), p(j, -w0 * 0.75, 0.16), p(k, -w0 * 0.75, 0.16), [0, 1, 0], C_KRATER_S);
      quadN(bn, p(k, w0 * 0.75, 0.16), p(j, w0 * 0.75, 0.16), p(j, w0 + jagD, 0.13), p(k, w0 + jagC, 0.13), [0, 1, 0], C_KRATER_S);
    }
  }

  // === Der große Krater um den Kratersprung (Abzweigung a) ================================
  {
    let gx = 0;
    let gz = 0;
    let gn = 0;
    for (let k = t.n; k < T; k++) {
      if (t.edge[k] & EDGE_GAP) {
        gx += t.px[k];
        gz += t.pz[k];
        gn++;
      }
    }
    if (gn > 0) {
      gx /= gn;
      gz /= gn;
      // Mitte zur Hauptstrecke hin verschoben: der Krater liegt zwischen den Wegen.
      let best = Infinity;
      let mk = 0;
      for (let k = 0; k < t.n; k += 2) {
        const d = Math.hypot(gx - t.px[k], gz - t.pz[k]);
        if (d < best) {
          best = d;
          mk = k;
        }
      }
      const kx = gx + (t.px[mk] - gx) * 0.28;
      const kz = gz + (t.pz[mk] - gz) * 0.28;
      const R = Math.max(22, best * 0.62);
      krater(kx, kz, R, true);
      // Brocken auf dem Kraterboden und kleine Krater darin
      for (let q = 0; q < [10, 18, 26][detail]; q++) {
        const a = rnd() * TAU;
        const d = R * Math.sqrt(rnd()) * 0.85;
        const x = kx + Math.cos(a) * d;
        const z = kz + Math.sin(a) * d;
        if (q % 3 === 0) {
          const r = 1.5 + rnd() * 4;
          if (kante(x, z) > r * 1.5 + 1 && !belegt(x, z, r)) {
            krater(x, z, r, false);
            belege(x, z, r);
          }
        } else if (frei(x, z, 1.5, 4) && !belegt(x, z, 1.5)) {
          brocken(bo, x, z, 0.8 + rnd() * 1.6, pick(FELS));
          belege(x, z, 1.2);
        }
      }
      plaetze.krater = [kx, kz, R];
      belege(kx, kz, 6);
    }
  }

  // === Baken an den Wegen ohne feste Bande ================================================
  {
    const step = detail === 0 ? 24 : 16;
    const panel = t.surf[0];
    for (let k = 0; k < T; k += 1) {
      const m = Math.round(t.prog[k] * t.step);
      if (m % step !== 0) continue;
      if (t.edge[k] & (EDGE_TUNNEL | EDGE_GAP | EDGE_RAMP | EDGE_DECK)) continue;
      if (t.surf[k] === panel) continue;
      if (t.branchOf[k] < 0 && k > 0 && Math.round(t.prog[k - 1] * t.step) === m) continue;
      for (const sd of [-1, 1]) {
        const lat = sd * (t.wh[k] + RAND + 0.8);
        const x = t.px[k] + rightX(t, k) * lat;
        const z = t.pz[k] + rightZ(t, k) * lat;
        if (!frei(x, z, 0.4, 99) || belegt(x, z, 0.5, 1)) continue;
        bake(bo, x, z, yawAt(k));
        belege(x, z, 0.6);
      }
    }
  }

  // === Rover-Bahnen (Ellipsen) – vor der Streuung, damit die Bahn frei bleibt =============
  interface Bahn {
    cx: number;
    cz: number;
    ax: number;
    az: number;
    rx: number;
    rz: number;
    w: number;
    ph: number;
    hs: Float32Array;
  }
  const bahnen: Bahn[] = [];
  {
    const want = detail === 0 ? 2 : 3;
    const cx = world.center.x;
    const cz = world.center.z;
    const ziele: [number, number][] = [];
    if (plaetze.lande) ziele.push([plaetze.lande[0], plaetze.lande[1]]);
    if (plaetze.solar) ziele.push([plaetze.solar[0], plaetze.solar[1]]);
    ziele.push([cx, cz]);
    if (plaetze.krater) ziele.push([plaetze.krater[0], plaetze.krater[1]]);
    for (let tries = 0; tries < 900 && bahnen.length < want; tries++) {
      const z0 = ziele[bahnen.length % ziele.length];
      const a0 = rnd() * TAU;
      const d0 = 25 + rnd() * 70;
      const x = z0[0] + Math.cos(a0) * d0;
      const z = z0[1] + Math.sin(a0) * d0;
      const rx = 9 + rnd() * 9;
      const rz = 5 + rnd() * 5;
      const an = rnd() * Math.PI;
      const ax = Math.cos(an);
      const az = Math.sin(an);
      let ok = true;
      for (let q = 0; q < 16 && ok; q++) {
        const u = (q / 16) * TAU;
        const px = x + ax * Math.cos(u) * rx - az * Math.sin(u) * rz;
        const pz = z + az * Math.cos(u) * rx + ax * Math.sin(u) * rz;
        if (!frei(px, pz, 3, 6) || belegt(px, pz, 2)) ok = false;
      }
      if (!ok) continue;
      let far = true;
      for (const b of bahnen) if (Math.hypot(b.cx - x, b.cz - z) < 70) far = false;
      if (!far) continue;
      const hs = new Float32Array(65);
      const pts: number[] = [];
      for (let q = 0; q <= 64; q++) {
        const u = (q / 64) * TAU;
        const px = x + ax * Math.cos(u) * rx - az * Math.sin(u) * rz;
        const pz = z + az * Math.cos(u) * rx + ax * Math.sin(u) * rz;
        hs[q] = bodenY(px, pz);
        if (q % 2 === 0) pts.push(px, pz);
      }
      spur(pts, 0.42, 0.95);
      const w = (2.6 + rnd() * 1.4) / Math.max(rx, rz);
      bahnen.push({ cx: x, cz: z, ax, az, rx, rz, w: rnd() < 0.5 ? w : -w, ph: rnd() * TAU, hs });
      for (let q = 0; q < 16; q++) {
        const u = (q / 16) * TAU;
        belege(x + ax * Math.cos(u) * rx - az * Math.sin(u) * rz, z + az * Math.cos(u) * rx + ax * Math.sin(u) * rz, 2.5);
      }
    }
    // alte Fahrspuren quer durchs Gelände
    const nAlt = [3, 6, 8][detail];
    for (let q = 0; q < nAlt; q++) {
      let x = cx + (rnd() - 0.5) * world.radius * 1.4;
      let z = cz + (rnd() - 0.5) * world.radius * 1.4;
      let a = rnd() * TAU;
      const pts: number[] = [x, z];
      for (let s = 0; s < 40; s++) {
        a += (rnd() - 0.5) * 0.35;
        x += Math.cos(a) * 4;
        z += Math.sin(a) * 4;
        pts.push(x, z);
      }
      spur(pts, 0.36, 0.85);
    }
  }

  // === Streuung: Krater, Brocken, Geröllfelder, Hügel ======================================
  {
    const cx = world.center.x;
    const cz = world.center.z;
    const R0 = world.radius + 110;
    const budgetKrater = tris() + [1100, 2900, 3300][detail];
    for (let tries = 0; tries < 2500 && tris() < budgetKrater; tries++) {
      const a = rnd() * TAU;
      const d = Math.sqrt(rnd()) * R0;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const R = 1.4 + 26 * Math.pow(rnd(), 3.2);
      if (kante(x, z) < R * 1.55 + 1 || belegt(x, z, R * 1.2, 0.8)) continue;
      krater(x, z, R, false);
      belege(x, z, R * 1.1);
      // große Krater: Brocken auf dem Wall
      if (R > 8) {
        for (let q = 0; q < 3; q++) {
          const b = rnd() * TAU;
          const bx = x + Math.cos(b) * R * 1.05;
          const bz = z + Math.sin(b) * R * 1.05;
          if (frei(bx, bz, 1.5, 6)) brocken(bo, bx, bz, 0.9 + rnd() * 1.4, pick(FELS));
        }
      }
    }
    const budgetFels = tris() + [900, 2500, 2900][detail];
    for (let tries = 0; tries < 4000 && tris() < budgetFels; tries++) {
      // dichter am Weg
      const k = Math.floor(rnd() * T);
      if (t.edge[k] & EDGE_TUNNEL) continue;
      const sd = rnd() < 0.5 ? -1 : 1;
      const lat = sd * (t.wh[k] + RAND + 1 + (rnd() < 0.7 ? 30 * Math.pow(rnd(), 1.5) : 30 + rnd() * 90));
      const x = t.px[k] + rightX(t, k) * lat + (rnd() - 0.5) * 4;
      const z = t.pz[k] + rightZ(t, k) * lat + (rnd() - 0.5) * 4;
      const geroell = rnd() < 0.3;
      const s = geroell ? 4 : 0.6 + 2.6 * Math.pow(rnd(), 2);
      if (!frei(x, z, s, bodenY(x, z) + s) || belegt(x, z, s * 0.8)) continue;
      if (geroell) {
        // Geröllfeld: viele kleine Steine, ein größerer
        brocken(bo, x, z, 1.1 + rnd() * 0.8, pick(FELS));
        const m = 8 + Math.floor(rnd() * 8);
        for (let q = 0; q < m; q++) {
          const b = rnd() * TAU;
          const r = rnd() * 4;
          const bx = x + Math.cos(b) * r;
          const bz = z + Math.sin(b) * r;
          if (kante(bx, bz) < RAND) continue;
          const y = bodenY(bx, bz);
          rahmen(bx, y, bz, rnd() * TAU, 1);
          teil(bn, G.okt, pick(FELS), 0, 0.05, 0, rnd(), rnd(), rnd(), 0.2 + rnd() * 0.35, 0.15 + rnd() * 0.2, 0.2 + rnd() * 0.3);
        }
      } else {
        brocken(bo, x, z, s, pick(FELS));
      }
      belege(x, z, s);
    }
  }

  // === Statische Netze ===================================================================
  const toon = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
  disposables.push(toon);
  {
    const go = addSmoothNormals(bo.build());
    const gn = bn.build();
    const body = verbinde(go, gn);
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
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  {
    const gg = bg.build();
    const glow = new THREE.Mesh(gg, glowMat);
    group.add(glow);
    disposables.push(gg, glowMat);
  }
  const glasMat = toonMaterial({ vertexColors: true, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
  glasMat.depthWrite = false;
  {
    const gg = glas.build();
    const m = new THREE.Mesh(gg, glasMat);
    m.renderOrder = 2;
    group.add(m);
    disposables.push(gg, glasMat);
  }

  // === Darsteller ==========================================================================
  const vorlagen: Vorlage[] = [];
  const mk = (): [MeshBuilder, MeshBuilder] => [new MeshBuilder(), new MeshBuilder()];
  // 0 Rover (Nase +z)
  const V_ROVER = vorlagen.length;
  {
    const [s, f] = mk();
    rahmen(0, 0, 0, 0, 1);
    teil(s, G.box, C_WEISS, 0, 1.05, 0, 0, 0, 0, 2, 0.55, 3.3);
    teil(s, G.box, C_DUNKEL, 0, 0.72, 0, 0, 0, 0, 1.7, 0.25, 3);
    teil(s, G.box, C_SOLAR, 0, 1.4, -0.3, 0, 0, 0, 2.3, 0.08, 2.2);
    for (const sx of [-1.15, 1.15]) {
      for (const sz of [-1.15, 0, 1.15]) teil(s, G.zyl8, C_TUSCHE, sx, 0.42, sz, 0, 0, Math.PI / 2, 0.42, 0.32, 0.42);
      teil(s, G.box, C_ORANGE, sx * 0.97, 0.95, 0, 0, 0, 0, 0.12, 0.3, 3.4);
    }
    stab(s, G.zyl4, C_STAHL_D, [0, 1.3, 1.2], [0, 2.3, 1.2], 0.09);
    teil(s, G.box, C_DUNKEL, 0, 2.45, 1.2, 0, 0, 0, 0.7, 0.35, 0.35);
    teil(f, G.box, C_ORANGE, 0, 2.45, 1.39, 0, 0, 0, 0.4, 0.15, 0.02);
    stab(s, G.zyl4, C_STAHL_D, [0.6, 1.3, -1.2], [0.6, 2.9, -1.2], 0.04);
    teil(s, G.halb, C_HELL, 0.6, 2.9, -1.2, Math.PI - 0.4, 0, 0, 0.45, 0.18, 0.45);
    vorlagen.push(vorlage(s, f));
  }
  // 1 Astronaut (Füße bei 0, Blick +z)
  const V_ASTRO = vorlagen.length;
  {
    const [s, f] = mk();
    rahmen(0, 0, 0, 0, 1);
    for (const sx of [-0.17, 0.17]) {
      teil(s, G.box, C_WEISS, sx, 0.45, 0, 0, 0, 0, 0.26, 0.72, 0.3);
      teil(s, G.box, C_DUNKEL, sx, 0.09, 0.04, 0, 0, 0, 0.3, 0.18, 0.42);
    }
    teil(s, G.box, C_WEISS, 0, 1.16, 0, 0, 0, 0, 0.74, 0.72, 0.46);
    teil(s, G.box, C_HELL, 0, 1.2, -0.36, 0, 0, 0, 0.62, 0.75, 0.3);
    teil(s, G.dode, C_WEISS, 0, 1.74, 0.02, 0, 0, 0, 0.34, 0.34, 0.34);
    teil(s, G.ico0, C_GOLD, 0, 1.75, 0.2, 0, 0, 0, 0.26, 0.2, 0.14);
    for (const sx of [-0.5, 0.5]) {
      teil(s, G.box, C_WEISS, sx, 1.17, 0, 0, 0, 0, 0.2, 0.62, 0.22);
      teil(s, G.box, C_ORANGE, sx, 0.82, 0, 0, 0, 0, 0.22, 0.18, 0.24);
    }
    teil(f, G.box, C_ORANGE, 0, 1.25, 0.24, 0, 0, 0, 0.36, 0.2, 0.04);
    teil(f, G.box, C_ORANGE, 0.17, 0.62, 0.155, 0, 0, 0, 0.27, 0.08, 0.02);
    teil(f, G.box, C_ORANGE, -0.17, 0.62, 0.155, 0, 0, 0, 0.27, 0.08, 0.02);
    vorlagen.push(vorlage(s, f, (x, y) => (y > 0.7 && y < 1.5 && Math.abs(x) > 0.39 ? (x > 0 ? 1 : 2) : 0)));
  }
  // 2 Antennenschüssel (dreht sich um die Hochachse)
  const V_SCHUESSEL = vorlagen.length;
  {
    const [s, f] = mk();
    rahmen(0, 0, 0, 0, 1);
    teil(s, G.box, C_STAHL_D, 0, 0.5, 0, 0, 0, 0, 1.6, 1, 0.9);
    for (const sx of [-0.7, 0.7]) teil(s, G.box, C_STAHL, sx, 1.4, 0, 0, 0, 0, 0.25, 1.6, 0.5);
    rahmen(0, 2.2, 0, 0, 1, -0.7);
    teil(s, G.halb, C_WEISS, 0, 0.3, 0, Math.PI, 0, 0, 3.3, 1.1, 3.3);
    teil(s, G.zyl12, C_ORANGE, 0, 0.32, 0, 0, 0, 0, 3.35, 0.15, 3.35);
    stab(s, G.zyl4, C_STAHL_D, [0, -0.6, 0], [0, 2.9, 0], 0.09);
    for (let q = 0; q < 3; q++) {
      const a = (q / 3) * TAU;
      stab(f, G.zyl4, C_STAHL_D, [Math.cos(a) * 2.8, 0.4, Math.sin(a) * 2.8], [0, 2.9, 0], 0.04);
    }
    teil(s, G.box, C_ORANGE, 0, 3.0, 0, 0, 0, 0, 0.5, 0.5, 0.5);
    vorlagen.push(vorlage(s, f));
  }
  // 3 Rakete (Fuß bei 0)
  const V_RAKETE = vorlagen.length;
  {
    const [s, f] = mk();
    rahmen(0, 0, 0, 0, 1);
    teil(s, G.kegelOffen, C_STAHL_D, 0, 1, 0, 0, 0, 0, 1.3, 2, 1.3);
    teil(s, G.zyl12, C_WEISS, 0, 10, 0, 0, 0, 0, 1.7, 16, 1.7);
    teil(s, G.zyl12, C_ORANGE, 0, 6, 0, 0, 0, 0, 1.75, 1.2, 1.75);
    teil(s, G.zyl12, C_TUSCHE, 0, 14.5, 0, 0, 0, 0, 1.75, 0.5, 1.75);
    teil(s, G.kegel8, C_ORANGE, 0, 20.6, 0, 0, 0, 0, 1.7, 5.2, 1.7);
    for (let q = 0; q < 4; q++) {
      const a = (q / 4) * TAU;
      teil(s, G.box, C_DUNKEL, Math.cos(a) * 2, 3.6, Math.sin(a) * 2, 0, -a, 0, 1.6, 4, 0.18);
    }
    teil(f, G.zyl8, C_FENSTER, 0, 16.2, 1.68, Math.PI / 2, 0, 0, 0.5, 0.05, 0.5);
    vorlagen.push(vorlage(s, f));
  }
  // 4 Satellit
  const V_SATELLIT = vorlagen.length;
  {
    const [s, f] = mk();
    rahmen(0, 0, 0, 0, 1);
    teil(s, G.box, C_GOLD, 0, 0, 0, 0, 0, 0, 2, 2, 2.6);
    for (const sx of [-1, 1]) {
      stab(s, G.zyl4, C_STAHL, [sx, 0, 0], [sx * 2.2, 0, 0], 0.1);
      teil(s, G.box, C_SOLAR, sx * 6, 0, 0, 0, 0, 0, 7.6, 0.12, 2.6);
      teil(f, G.box, C_SOLAR_H, sx * 6, 0.08, 0, 0, 0, 0, 7.2, 0.04, 0.4);
    }
    teil(s, G.halb, C_WEISS, 0, -1.2, 1, Math.PI, 0, 0, 1, 0.4, 1);
    vorlagen.push(vorlage(s, f));
  }

  // Rover
  for (const b of bahnen) akt.push({ v: V_ROVER, kind: K_STARR, rolle: R_ROVER, p: [bahnen.indexOf(b)] });
  // Astronauten
  {
    const want = detail === 0 ? 4 : 8;
    const orte: [number, number, number][] = []; // x, z, rolle
    const um = (o: [number, number, number] | null | undefined, r0: number, r1: number, rolle: number): void => {
      if (!o) return;
      for (let q = 0; q < 30; q++) {
        const a = rnd() * TAU;
        const d = r0 + rnd() * (r1 - r0);
        const x = o[0] + Math.cos(a) * d;
        const z = o[1] + Math.sin(a) * d;
        if (!frei(x, z, rolle === R_HUEPF ? 4 : 1, 6) || belegt(x, z, rolle === R_HUEPF ? 3 : 0.8)) continue;
        orte.push([x, z, rolle]);
        belege(x, z, rolle === R_HUEPF ? 3 : 1);
        return;
      }
    };
    um(plaetze.lande, 14, 20, R_WINK);
    um(plaetze.astroA, 9, 14, R_HUEPF);
    um(plaetze.solar, 6, 30, R_GEH);
    // am Massenbeschleuniger: winkt den Karts zu
    if (plaetze.beschl) {
      const s = plaetze.beschl[2];
      for (const sd of [1, -1]) {
        const lat = sd * (t.wh[s] + RAND + 3.5);
        const x = t.px[s] + rightX(t, s) * lat;
        const z = t.pz[s] + rightZ(t, s) * lat;
        if (frei(x, z, 0.8, 6) && !belegt(x, z, 0.8)) {
          orte.push([x, z, R_WINK]);
          belege(x, z, 1);
          break;
        }
      }
    }
    um(plaetze.astroE, 9, 14, R_GEH);
    um(plaetze.krater ? [plaetze.krater[0], plaetze.krater[1], 0] : null, 4, plaetze.krater ? plaetze.krater[2] * 0.7 : 10, R_HUEPF);
    um(plaetze.schuessel, 6, 10, R_WINK);
    um(plaetze.solar, 10, 34, R_HUEPF);
    for (const [x, z, rolle] of orte.slice(0, want)) {
      const y = bodenY(x, z);
      const yaw = zurBahn(x, z) + (rolle === R_WINK ? 0 : (rnd() - 0.5) * 2);
      akt.push({ v: V_ASTRO, kind: K_ASTRO, rolle, p: [x, y, z, yaw, rnd() * TAU, 1.15] });
    }
  }
  // Schüssel(n), Rakete, Satellit
  for (const a of akt) if (a.rolle === R_SCHUESSEL) a.v = V_SCHUESSEL;
  if (rakete) akt.push({ v: V_RAKETE, kind: K_STARR, rolle: R_RAKETE, p: [rakete[0], rakete[1], rakete[2]] });
  akt.push({ v: V_SATELLIT, kind: K_STARR, rolle: R_SATELLIT, p: [rnd() * TAU] });

  // Netz der Darsteller zusammensetzen
  let nVert = 0;
  for (const a of akt) nVert += vorlagen[a.v].pos.length / 3;
  const tPos = new Float32Array(Math.max(3, nVert * 3));
  const tNor = new Float32Array(Math.max(3, nVert * 3));
  const tOnor = new Float32Array(Math.max(3, nVert * 3));
  const tCol = new Float32Array(Math.max(3, nVert * 3));
  const aOff = new Int32Array(Math.max(1, akt.length));
  const solidIdx: number[] = [];
  {
    let o = 0;
    for (let i = 0; i < akt.length; i++) {
      const v = vorlagen[akt[i].v];
      aOff[i] = o;
      tCol.set(v.col, o * 3);
      for (let q = 0; q < v.nSolid; q++) solidIdx.push(o + q);
      o += v.pos.length / 3;
    }
  }
  const aktGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage);
  const norAttr = new THREE.BufferAttribute(tNor, 3).setUsage(THREE.DynamicDrawUsage);
  const onorAttr = new THREE.BufferAttribute(tOnor, 3).setUsage(THREE.DynamicDrawUsage);
  aktGeo.setAttribute('position', posAttr);
  aktGeo.setAttribute('normal', norAttr);
  aktGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  aktGeo.setAttribute('onormal', onorAttr);
  if (nVert === 0) aktGeo.setDrawRange(0, 0);
  const aktMesh = new THREE.Mesh(aktGeo, toon);
  aktMesh.frustumCulled = false;
  group.add(aktMesh);
  disposables.push(aktGeo);
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
  /** Rechnet die Ecken von Darsteller i mit Matrix m um; k1, k2 = Winkel rechter, linker Arm. */
  const setze = (i: number, m: THREE.Matrix4, k1: number, k2: number): void => {
    const a = akt[i];
    const v = vorlagen[a.v];
    const e = m.elements;
    const sc = Math.hypot(e[0], e[1], e[2]);
    const inv = sc > 1e-6 ? 1 / sc : 0;
    const n = v.pos.length / 3;
    const o = aOff[i] * 3;
    const astro = a.kind === K_ASTRO;
    const c1 = Math.cos(k1);
    const s1 = Math.sin(k1);
    const c2 = Math.cos(k2);
    const s2 = Math.sin(k2);
    for (let q = 0; q < n; q++) {
      const q3 = q * 3;
      let x = v.pos[q3];
      let y = v.pos[q3 + 1];
      const z = v.pos[q3 + 2];
      let nx = v.nor[q3];
      let ny = v.nor[q3 + 1];
      const nz = v.nor[q3 + 2];
      let ox = v.onor[q3];
      let oy = v.onor[q3 + 1];
      const oz = v.onor[q3 + 2];
      const w = astro ? v.flex[q] : 0;
      if (w !== 0) {
        const c = w === 1 ? c1 : c2;
        const s = w === 1 ? s1 : s2;
        const px = w === 1 ? 0.44 : -0.44;
        const py = 1.44;
        const dx = x - px;
        const dy = y - py;
        x = px + dx * c - dy * s;
        y = py + dx * s + dy * c;
        const tnx = nx * c - ny * s;
        ny = nx * s + ny * c;
        nx = tnx;
        const tox = ox * c - oy * s;
        oy = ox * s + oy * c;
        ox = tox;
      }
      tPos[o + q3] = e[0] * x + e[4] * y + e[8] * z + e[12];
      tPos[o + q3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      tPos[o + q3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      tNor[o + q3] = (e[0] * nx + e[4] * ny + e[8] * nz) * inv;
      tNor[o + q3 + 1] = (e[1] * nx + e[5] * ny + e[9] * nz) * inv;
      tNor[o + q3 + 2] = (e[2] * nx + e[6] * ny + e[10] * nz) * inv;
      if (q < v.nSolid) {
        tOnor[o + q3] = (e[0] * ox + e[4] * oy + e[8] * oz) * inv;
        tOnor[o + q3 + 1] = (e[1] * ox + e[5] * oy + e[9] * oz) * inv;
        tOnor[o + q3 + 2] = (e[2] * ox + e[6] * oy + e[10] * oz) * inv;
      }
    }
  };

  // === Bewegte Lichter: Raketenflamme anhängen und Netz bauen ============================
  let flammeLicht = -1;
  if (rakete) {
    rahmen(0, 0, 0, 0, 1);
    lichtBeginn();
    for (let q = 0; q < 3; q++) {
      const r = [1.25, 0.9, 0.5][q];
      const l = [9, 6.5, 4][q];
      teil(dg, G.kegel8, L_FLAMME[q], 0, -l / 2, 0, Math.PI, q * 0.3, 0, r, l, r);
    }
    lichtEnde(L_FLAMME_K, 0, 0);
    flammeLicht = lichter.length - 1;
  }
  const dgGeo = dg.build();
  const dgPos = dgGeo.getAttribute('position') as THREE.BufferAttribute;
  const dgCol = dgGeo.getAttribute('color') as THREE.BufferAttribute;
  dgPos.setUsage(THREE.DynamicDrawUsage);
  dgCol.setUsage(THREE.DynamicDrawUsage);
  const dgBasePos = new Float32Array(dgPos.array as Float32Array);
  const dgBaseCol = new Float32Array(dgCol.array as Float32Array);
  const dgMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const dgMesh = new THREE.Mesh(dgGeo, dgMat);
  dgMesh.frustumCulled = false;
  group.add(dgMesh);
  disposables.push(dgGeo, dgMat);

  // === Additiv: Lichtkegel (fest) und Sternschnuppen (bewegt) ============================
  const STERN = 5;
  const baGeoFest = ba.build();
  const nFest = baGeoFest.getAttribute('position').count;
  const addPos = new Float32Array((nFest + STERN * 6) * 3);
  const addCol = new Float32Array((nFest + STERN * 6) * 3);
  addPos.set(baGeoFest.getAttribute('position').array as Float32Array, 0);
  addCol.set(baGeoFest.getAttribute('color').array as Float32Array, 0);
  baGeoFest.dispose();
  const addGeo = new THREE.BufferGeometry();
  const addPosAttr = new THREE.BufferAttribute(addPos, 3).setUsage(THREE.DynamicDrawUsage);
  const addColAttr = new THREE.BufferAttribute(addCol, 3).setUsage(THREE.DynamicDrawUsage);
  addGeo.setAttribute('position', addPosAttr);
  addGeo.setAttribute('color', addColAttr);
  const addMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, forceSinglePass: true });
  const addMesh = new THREE.Mesh(addGeo, addMat);
  addMesh.frustumCulled = false;
  addMesh.renderOrder = 3;
  group.add(addMesh);
  disposables.push(addGeo, addMat);

  for (const g of Object.values(G)) g.dispose();

  // --- Hilfsobjekte für update() --------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const eu = new THREE.Euler(0, 0, 0, 'YXZ');
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const staubR = new Float32Array(4);
  let staubT = 0;
  let glanzT = 0;
  const RAK_T = 30;
  const satDir = rnd() * TAU;
  const raketeM = new THREE.Matrix4();
  let raketeAn = false;
  const dgN = dgBasePos.length / 3;

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink): void {
      // --- Darsteller ---
      for (let i = 0; i < akt.length; i++) {
        const a = akt[i];
        const p = a.p;
        let k1 = 0;
        let k2 = 0;
        switch (a.rolle) {
          case R_ROVER: {
            const b = bahnen[p[0]];
            const u = b.ph + b.w * time;
            const cu = Math.cos(u);
            const su = Math.sin(u);
            const x = b.cx + b.ax * cu * b.rx - b.az * su * b.rz;
            const z = b.cz + b.az * cu * b.rx + b.ax * su * b.rz;
            const sg = b.w >= 0 ? 1 : -1;
            const dx = (-b.ax * su * b.rx - b.az * cu * b.rz) * sg;
            const dz = (-b.az * su * b.rx + b.ax * cu * b.rz) * sg;
            const f = ((((u / TAU) % 1) + 1) % 1) * 64;
            const fi = Math.floor(f);
            const y = b.hs[fi] + (b.hs[Math.min(64, fi + 1)] - b.hs[fi]) * (f - fi);
            eu.set(Math.sin(time * 3.1 + i) * 0.03, Math.atan2(dx, dz), Math.sin(time * 2.3 + i * 2) * 0.03, 'YXZ');
            q4.setFromEuler(eu);
            m4.compose(pv.set(x, y + Math.abs(Math.sin(time * 4 + i)) * 0.06, z), q4, sv.setScalar(1.1));
            // Staubfahne hinter den Rädern (nur in Kameranähe)
            const ri = p[0];
            if (ri < staubR.length && Math.hypot(x - cam.x, z - cam.z) < 160) {
              staubR[ri] -= dt;
              if (staubR[ri] <= 0) {
                staubR[ri] = 0.12;
                const l = Math.hypot(dx, dz) || 1;
                const bx = x - (dx / l) * 1.9;
                const bz = z - (dz / l) * 1.9;
                fx.puff(bx + (Math.random() - 0.5) * 1.6, y + 0.3, bz + (Math.random() - 0.5) * 0.8, (-dx / l) * 0.6, 0.5 + Math.random() * 0.4, (-dz / l) * 0.6, 1.6, 0.6, 0xb9b6c2, 0.9, 0.6);
              }
            }
            break;
          }
          case R_WINK:
          case R_HUEPF:
          case R_GEH: {
            const ph = p[4];
            let x = p[0];
            let z = p[2];
            let y = p[1];
            let yaw = p[3];
            if (a.rolle === R_WINK) {
              k1 = 2.35 + Math.sin(time * 3.2 + ph) * 0.45;
              k2 = -0.15;
              y += Math.max(0, Math.sin(time * 1.1 + ph)) * 0.25;
            } else if (a.rolle === R_HUEPF) {
              // Känguruhüpfer in Zeitlupe vor und zurück
              const w = 0.32;
              const s = Math.sin(time * w + ph);
              x += Math.sin(yaw) * s * 3;
              z += Math.cos(yaw) * s * 3;
              y += Math.abs(Math.sin(time * 1.25 + ph)) * 1.3;
              if (Math.cos(time * w + ph) < 0) yaw += Math.PI;
              k1 = 0.5 + Math.abs(Math.sin(time * 1.25 + ph)) * 0.6;
              k2 = -k1;
            } else {
              // gemächlich im Kreis, mit federndem Schritt
              const w = 0.18;
              const u = time * w + ph;
              x += Math.cos(u) * 3;
              z += Math.sin(u) * 3;
              yaw = Math.atan2(-Math.sin(u), Math.cos(u));
              y += Math.abs(Math.sin(time * 2.4 + ph)) * 0.35;
              k1 = Math.sin(time * 2.4 + ph) * 0.4;
              k2 = -k1;
            }
            eu.set(0, yaw, 0, 'YXZ');
            q4.setFromEuler(eu);
            m4.compose(pv.set(x, y, z), q4, sv.setScalar(p[5]));
            break;
          }
          case R_SCHUESSEL: {
            eu.set(0, p[4] + time * 0.12, 0, 'YXZ');
            q4.setFromEuler(eu);
            m4.compose(pv.set(p[0], p[1], p[2]), q4, sv.setScalar(p[3]));
            break;
          }
          case R_RAKETE: {
            const rt = time % RAK_T;
            let y = p[1];
            let s = 1;
            raketeAn = false;
            if (rt < 5) {
              raketeAn = rt > 3;
              if (rt > 3 && Math.hypot(p[0] - cam.x, p[2] - cam.z) < 900) {
                staubT -= dt;
                if (staubT <= 0) {
                  staubT = 0.05;
                  const ang = Math.random() * TAU;
                  fx.puff(p[0] + Math.cos(ang) * 3, p[1] + 0.5, p[2] + Math.sin(ang) * 3, Math.cos(ang) * 9, 1.5 + Math.random() * 2, Math.sin(ang) * 9, 2.4, 3.5, 0xd9d6e0, 2.4, 0.4);
                }
              }
            } else if (rt < 17) {
              const tt = rt - 5;
              y += 0.5 * 6.5 * tt * tt;
              raketeAn = true;
              if (y - p[1] > 380) s = Math.max(0, 1 - (y - p[1] - 380) / 60);
              if (tt < 4 && Math.hypot(p[0] - cam.x, p[2] - cam.z) < 900) {
                staubT -= dt;
                if (staubT <= 0) {
                  staubT = 0.08;
                  fx.puff(p[0] + (Math.random() - 0.5) * 2, y - 4, p[2] + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, -2, (Math.random() - 0.5) * 3, 2.8, 3, 0xd9d6e0, 2.2, -0.2);
                }
              }
            } else if (rt < 25) {
              s = 0;
            } else {
              // Die nächste Rakete fährt aus dem Silo herauf.
              y -= 26 * (1 - smooth((rt - 25) / 4.5));
            }
            eu.set(0, 0.6, 0, 'YXZ');
            q4.setFromEuler(eu);
            m4.compose(pv.set(p[0], y, p[2]), q4, sv.setScalar(s));
            raketeM.copy(m4);
            if (s === 0) raketeAn = false;
            break;
          }
          default: {
            // Satellit: zieht in großer Höhe über das Gelände
            const u = ((time / 70) % 1) * 2 - 1;
            const c = Math.cos(satDir);
            const s = Math.sin(satDir);
            const x = world.center.x + c * u * 900 - s * 120;
            const z = world.center.z + s * u * 900 + c * 120;
            eu.set(0.3, -satDir + time * 0.05, 0.2, 'YXZ');
            q4.setFromEuler(eu);
            m4.compose(pv.set(x, 240, z), q4, sv.setScalar(2.2));
          }
        }
        setze(i, m4, k1, k2);
      }
      if (akt.length > 0) {
        posAttr.needsUpdate = true;
        norAttr.needsUpdate = true;
        onorAttr.needsUpdate = true;
      }

      // --- Bewegte Lichter ---
      const pa = dgPos.array as Float32Array;
      const ca = dgCol.array as Float32Array;
      for (let li = 0; li < lichter.length; li++) {
        const l = lichter[li];
        let f = 1;
        if (l.kind === L_LAUF) {
          // Lauflicht in Fahrtrichtung: Wellen, die nach vorn wandern
          const ph = (time * 2.2 - l.a * 0.18) % 1;
          const w = ph < 0 ? ph + 1 : ph;
          f = 0.12 + 0.88 * Math.max(0, 1 - w * 3.5);
        } else if (l.kind === L_BLINK) {
          const ph = ((time + l.b) / l.a) % 1;
          f = ph < 0.22 ? 1 : 0.08;
        } else if (l.kind === L_KREIS) {
          const ph = (time * 0.9 - l.a / l.b + 10) % 1;
          f = 0.15 + 0.85 * Math.max(0, 1 - ph * 4);
        } else if (l.kind === L_FLAMME_K) {
          const e = raketeM.elements;
          const fl = raketeAn ? 0.85 + Math.random() * 0.3 : 0;
          for (let v = l.first; v < l.first + l.count; v++) {
            const v3 = v * 3;
            const x = dgBasePos[v3];
            const y = dgBasePos[v3 + 1] * fl;
            const z = dgBasePos[v3 + 2];
            pa[v3] = e[0] * x + e[4] * y + e[8] * z + e[12];
            pa[v3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13] + (raketeAn ? 0 : -1000);
            pa[v3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          }
          continue;
        }
        for (let v = l.first; v < l.first + l.count; v++) {
          const v3 = v * 3;
          ca[v3] = dgBaseCol[v3] * f;
          ca[v3 + 1] = dgBaseCol[v3 + 1] * f;
          ca[v3 + 2] = dgBaseCol[v3 + 2] * f;
        }
      }
      if (flammeLicht >= 0) dgPos.needsUpdate = true;
      if (dgN > 0) dgCol.needsUpdate = true;

      // --- Sternschnuppen (am Himmel, um die Kamera) ---
      for (let si = 0; si < STERN; si++) {
        const per = 5.5 + si * 1.9;
        const tt = time + si * 2.7;
        const cyc = Math.floor(tt / per);
        const lt = tt - cyc * per;
        const o = (nFest + si * 6) * 3;
        const life = 0.9;
        const h1 = Math.sin(cyc * 12.9898 + si * 78.233) * 43758.5453;
        const r1 = h1 - Math.floor(h1);
        const h2 = Math.sin(cyc * 39.346 + si * 11.135) * 24634.6345;
        const r2 = h2 - Math.floor(h2);
        if (lt > life) {
          for (let q = 0; q < 18; q++) addCol[o + q] = 0;
          continue;
        }
        const az = r1 * TAU;
        const el = 0.22 + r2 * 0.5;
        const D = 1500;
        const ce = Math.cos(el);
        const bx = cam.x + Math.cos(az) * ce * D;
        const by = cam.y + Math.sin(el) * D;
        const bz = cam.z + Math.sin(az) * ce * D;
        // Bahn: schräg abwärts, seitlich
        const mx = -Math.sin(az) * (r2 < 0.5 ? 1 : -1);
        const my = -0.55;
        const mz = Math.cos(az) * (r2 < 0.5 ? 1 : -1);
        const sp = 260;
        const hx = bx + mx * lt * sp;
        const hy = by + my * lt * sp;
        const hz = bz + mz * lt * sp;
        const L = 90 + 60 * r1;
        const tx = hx - mx * L;
        const ty = hy - my * L;
        const tz = hz - mz * L;
        // Breite quer zur Blickrichtung (einfach: senkrecht nach oben versetzt)
        const w = 2.6;
        const k = Math.sin((lt / life) * Math.PI);
        const orange = r1 > 0.7;
        const cr = k * (orange ? 1 : 0.85);
        const cg = k * (orange ? 0.55 : 0.92);
        const cb = k * (orange ? 0.2 : 1);
        for (let q = 0; q < 18; q += 9) {
          addPos[o + q] = hx;
          addPos[o + q + 1] = hy + w;
          addPos[o + q + 2] = hz;
          addPos[o + q + 3] = hx;
          addPos[o + q + 4] = hy - w;
          addPos[o + q + 5] = hz;
          addPos[o + q + 6] = tx;
          addPos[o + q + 7] = ty;
          addPos[o + q + 8] = tz;
        }
        addCol[o] = cr;
        addCol[o + 1] = cg;
        addCol[o + 2] = cb;
        addCol[o + 3] = cr;
        addCol[o + 4] = cg;
        addCol[o + 5] = cb;
        addCol[o + 6] = 0;
        addCol[o + 7] = 0;
        addCol[o + 8] = 0;
        for (let q = 9; q < 18; q++) addCol[o + q] = 0;
      }
      addPosAttr.needsUpdate = true;
      addColAttr.needsUpdate = true;

      // --- Leuchtendes pulsiert sacht ---
      glowMat.color.setScalar(0.85 + 0.15 * Math.sin(time * 2.1));

      // --- Glanz auf dem Solarfeld: ab und zu blitzt ein Paneel in Kameranähe ---
      if (solarPanels.length > 0 && detail > 0) {
        glanzT -= dt;
        if (glanzT <= 0) {
          glanzT = 0.18;
          const q = Math.floor(Math.random() * (solarPanels.length / 3)) * 3;
          const x = solarPanels[q];
          const y = solarPanels[q + 1];
          const z = solarPanels[q + 2];
          if (Math.hypot(x - cam.x, z - cam.z) < 90) fx.spark(x + (Math.random() - 0.5) * 3, y + 0.4, z + (Math.random() - 0.5) * 2, 0, 0.2, 0, 0.35, 0.9, 0xeaf6ff, 0);
        }
      }
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}

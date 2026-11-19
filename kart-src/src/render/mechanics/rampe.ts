// Startrampe: Darstellung des Startplatzes und seiner Mechanik.
//
// Feststehend: der Startsockel mit dem Starttisch, der Flammengraben (Stützmauern; den Tunnel unter dem Sockel zeichnet
// world.ts), der Kriechweg-Graben (Wände, Kiesbett) und die Rampen der Hauptstraße hinab, das Betonvorfeld rings um alle
// Einschnitte (life/rampeLand.ts), der Serviceturm mit den Kragarmen unter der Wendel, die Pylone der Brücke, der
// Magnetring (Fachwerk, an dem das Band hängt – die Halter zeichnet mechanics/band.ts), der Versorgungsmast neben der
// Rakete, die Markierung der Flammenzone und des Abgasstoßes, Tafeln mit dem Countdown.
//
// Im Takt der Rennzeit (STARTTAKT, alles aus pulseCycle des Abgasstrahls – auf jedem Bildschirm gleich):
//   – die Rakete: steht auf dem Starttisch, hebt beim Start ab (Abgasstrahl unter den Düsen, Rauchsäule), ist bald im
//     Himmel verschwunden; 20 s nach dem Start schwebt die nächste mit Landefeuer ein und steht wieder bereit;
//   – beim Start schießt das Feuer durch den Flammengraben und aus seiner Mündung über die Straße;
//   – Countdown-Tafeln: Sekunden bis zum nächsten Start (die letzten zehn rot, die Lampe blinkt), dazu Grün/Rot für das
//     Tor des Flammengrabens; das Tor selbst (zwei Schiebetore) und die Ampel daran;
//   – der Raupentransporter (crawlerPose) mit Rundumleuchten, die Schranke an der Abkürzung über seine Plattform und eine
//     kleine Tafel daran (Sekunden bis zum Öffnen bzw. Schließen).
//
// Technik: nur eingebaute Materialien, keine Lichtquellen, keine Texturen. Zeichenaufrufe: Feststehendes (Toon),
// Bodenflächen (unbeleuchtet), Leuchtendes und Feuer (unbeleuchtet, Ecken je Bild), Bewegliches (Tore, Schranke: Toon,
// Ecken je Bild), Rakete (Toon + Kontur), Raupentransporter (Toon + Kontur) = 8.

import * as THREE from 'three';
import { CRAWLER_DECK, CRAWLER_HALF, CRAWLER_HALF_WIDTH, CRAWLER_LEG_HALF, CRAWLER_LEG_HALF_WIDTH, CRAWLER_LEG_U, CRAWLER_LEG_W, CRAWLER_SLAB, PULSE_FLAME, gustStrength, planActive, planSince, planUntil, pulseCycle, type Gate, type Pulse } from '../../game/mechanics';
import { EDGE_BAND, EDGE_GLIDE, EDGE_TUNNEL, EDGE_TWIST, crawlerPose, rightX, rightZ, type Track } from '../../game/track';
import { PLATZ, RAKETE, STARTTAKT, TURM } from '../../game/tracks/rampe';
import { MeshBuilder, shade, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import { APRON, rampeLand, SOCKEL } from '../life/rampeLand';
import type { MechanicView } from '../mechanics';
import { rgb, toonMaterial, withOutline } from '../toon';
import type { World } from '../world';

// --- Farben ---------------------------------------------------------------------

const BETON = rgb(0xd6d2c8);
const BETON_2 = rgb(0xc7c2b6);
const BETON_D = rgb(0x9c978c);
const RUSS = rgb(0x3a3836);
const ORANGE = rgb(0xff6a1f);
const WEISS = rgb(0xf6f4ee);
const SCHWARZ = rgb(0x1f1d22);
const GELB = rgb(0xffd23a);
const STAHL = rgb(0x6b727c);
const STAHL_D = rgb(0x464c55);
const TURMROT = rgb(0xc4402c);
const TURMROT_D = rgb(0x8e2c20);
const KIES = rgb(0xb3aa98);
const KIES_2 = rgb(0x9f9684);
const KIES_HELL = rgb(0xc9c1ae);
const RAUPE = rgb(0x3b3e44);
const RAUPE_D = rgb(0x26282c);
const DECK_C = rgb(0x8d939b);
const LAMPE_AUS: RGB = [0.08, 0.07, 0.08];
const ROT = rgb(0xff3a2a);
const ROT_D = rgb(0x3a1414);
const GRUEN = rgb(0x46ff7a);
const GRUEN_D = rgb(0x123a1e);
const BERN = rgb(0xffb02e);
const ZIFFER = rgb(0xfff2d6);
const ZIFFER_ROT = rgb(0xff4a2a);
const ZIFFER_AUS: RGB = [0.14, 0.12, 0.13];
const FEUER_KERN = rgb(0xfff6c8);
const FEUER = rgb(0xffb43a);
const FEUER_AUSSEN = rgb(0xff5a1a);

/** Höhe der Oberkante des Starttischs (darauf steht die Rakete). */
const TISCH = PLATZ.pad + 2;
/** Rakete: Halbmesser der Hauptstufe, Höhe bis zur Spitze. */
const R_KERN = 4.2;
const R_HOEHE = 63;
/** Sekunden im Starttakt: Aufstieg sichtbar bis, Landung von … bis. */
const STEIG_BIS = 16;
const LANDE_AB = 21;
const LANDE_BIS = 29;
/** Höhe, aus der die nächste Rakete einschwebt (Meter über dem Tisch). */
const LANDE_H = 420;

/** Flächen, deren Ecken und Farben je Bild neu gesetzt werden (Vierecke zu je zwei Dreiecken). */
class Dyn {
  pos: number[] = [];
  col: number[] = [];
  readonly geo = new THREE.BufferGeometry();
  posAttr!: THREE.BufferAttribute;
  colAttr!: THREE.BufferAttribute;
  add(n = 1): number {
    const q = this.pos.length / 18;
    for (let k = 0; k < 18 * n; k++) {
      this.pos.push(0);
      this.col.push(0);
    }
    return q;
  }
  finish(normals = false): void {
    this.posAttr = new THREE.BufferAttribute(new Float32Array(this.pos), 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(new Float32Array(this.col), 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('color', this.colAttr);
    if (normals) this.geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.pos.length), 3).setUsage(THREE.DynamicDrawUsage));
  }
  set(q: number, a: V3, b: V3, c: V3, d: V3): void {
    const p = this.posAttr.array as Float32Array;
    const o = q * 18;
    const w = (k: number, v: V3): void => {
      p[o + k] = v[0];
      p[o + k + 1] = v[1];
      p[o + k + 2] = v[2];
    };
    w(0, a);
    w(3, b);
    w(6, c);
    w(9, a);
    w(12, c);
    w(15, d);
    const nrm = this.geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
    if (nrm) {
      const ux = b[0] - a[0];
      const uy = b[1] - a[1];
      const uz = b[2] - a[2];
      const vx = c[0] - a[0];
      const vy = c[1] - a[1];
      const vz = c[2] - a[2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      const n = nrm.array as Float32Array;
      for (let k = 0; k < 6; k++) {
        n[o + k * 3] = nx;
        n[o + k * 3 + 1] = ny;
        n[o + k * 3 + 2] = nz;
      }
    }
  }
  hide(q: number): void {
    const z: V3 = [0, -9999, 0];
    this.set(q, z, z, z, z);
  }
  color(q: number, c: RGB): void {
    const a = this.colAttr.array as Float32Array;
    for (let k = 0; k < 6; k++) {
      a[q * 18 + k * 3] = c[0];
      a[q * 18 + k * 3 + 1] = c[1];
      a[q * 18 + k * 3 + 2] = c[2];
    }
  }
  /** Quader aus 6 Vierecken ab q: Mitte c, Achsen ax, ay, az (je halbe Kantenlänge). */
  box(q: number, c: V3, ax: V3, ay: V3, az: V3): void {
    const v = (sx: number, sy: number, sz: number): V3 => [
      c[0] + ax[0] * sx + ay[0] * sy + az[0] * sz,
      c[1] + ax[1] * sx + ay[1] * sy + az[1] * sz,
      c[2] + ax[2] * sx + ay[2] * sy + az[2] * sz,
    ];
    this.set(q, v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1));
    this.set(q + 1, v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1));
    this.set(q + 2, v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1));
    this.set(q + 3, v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1));
    this.set(q + 4, v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1));
    this.set(q + 5, v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1));
  }
}

/** Vierkantbalken von a nach c (Kantenlänge s). */
function beam(b: MeshBuilder, a: V3, c: V3, s: number, color: RGB): void {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const dz = c[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.01) return;
  const d: V3 = [dx / len, dy / len, dz / len];
  const ref: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u: V3 = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]];
  const ul = Math.hypot(u[0], u[1], u[2]);
  u = [(u[0] / ul) * s * 0.5, (u[1] / ul) * s * 0.5, (u[2] / ul) * s * 0.5];
  const w: V3 = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  const corner = (p: V3, su: number, sw: number): V3 => [p[0] + u[0] * su + w[0] * sw, p[1] + u[1] * su + w[1] * sw, p[2] + u[2] * su + w[2] * sw];
  const A = [corner(a, -1, -1), corner(a, 1, -1), corner(a, 1, 1), corner(a, -1, 1)];
  const C = [corner(c, -1, -1), corner(c, 1, -1), corner(c, 1, 1), corner(c, -1, 1)];
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    b.quad(A[k], A[n], C[n], C[k], k % 2 === 0 ? color : shade(color, 0.82));
  }
}

/** Senkrechter (auch kegeliger) Zylinder um (x, z) von y0 (Halbmesser r0) bis y1 (r1), sides Seiten, mit Deckeln. */
function zyl(b: MeshBuilder, x: number, z: number, y0: number, y1: number, r0: number, r1: number, sides: number, col: RGB, top?: RGB, bottom = false): void {
  for (let k = 0; k < sides; k++) {
    const a0 = (k / sides) * Math.PI * 2;
    const a1 = ((k + 1) / sides) * Math.PI * 2;
    const p = (a: number, r: number, y: number): V3 => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
    const c = k % 2 === 0 ? col : shade(col, 0.94);
    b.quad(p(a1, r0, y0), p(a0, r0, y0), p(a0, r1, y1), p(a1, r1, y1), c);
    if (top && r1 > 0.01) b.tri([x, y1, z], p(a1, r1, y1), p(a0, r1, y1), top);
    if (bottom && r0 > 0.01) b.tri([x, y0, z], p(a0, r0, y0), p(a1, r0, y0), col);
  }
}

/** Ziffer (Siebensegment): welche Segmente a…g leuchten. */
const SEGS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];

interface Tafel {
  /** erstes Viereck der Segmente (2 Ziffern × 7), der Lampen (2). */
  seg: number;
  lamp: number;
}

export function buildRampe(t: Track, detail: boolean, world: World): MechanicView {
  const group = new THREE.Group();
  group.name = 'Startrampe';
  const disposables: { dispose(): void }[] = [];
  const land = rampeLand(t);
  const G = PLATZ.y;
  const fest = new MeshBuilder();
  const flach = new MeshBuilder();
  const glow = new Dyn();
  const beweg = new Dyn();

  /** Punkt auf der (flachen) Fahrbahn: Abschnitt i, seitlich lat, up darüber, along voraus. */
  const P = (i: number, lat: number, up: number, along = 0): V3 => [
    t.px[i] + rightX(t, i) * lat + t.tx[i] * along,
    t.py[i] + lat * t.bank[i] + up,
    t.pz[i] + rightZ(t, i) * lat + t.tz[i] * along,
  ];
  const ground = (x: number, z: number): number => world.groundY(x, z);

  // Der Abgasstrahl auf der Hauptstraße gibt den Takt (alle haben denselben).
  const flames = t.pulses.filter((p) => p.kind === PULSE_FLAME);
  const takt: Pulse | null = flames.find((p) => t.branchOf[p.seg] < 0) ?? flames[0] ?? null;
  const zone = flames.find((p) => t.branchOf[p.seg] < 0) ?? null;
  const kGraben = t.def.branches?.findIndex((b) => b.shortcut === 'window') ?? -1;
  const graben = kGraben >= 0 ? t.branches[kGraben] : null;
  const grabenTor: Gate | null = graben ? (t.gates.find((g) => t.branchOf[g.first] === kGraben) ?? null) : null;
  const c = t.crawler;
  const kriechTor: Gate | null = c ? (t.gates.find((g) => t.branchOf[g.first] === c.branch) ?? null) : null;

  // --- Startsockel und Starttisch -----------------------------------------------------
  {
    const S = SOCKEL;
    const x0 = RAKETE.x - S;
    const x1 = RAKETE.x + S;
    const z0 = RAKETE.z - S;
    const z1 = RAKETE.z + S;
    const top = PLATZ.pad;
    const foot = G - 1.2;
    // Platten auf dem Sockel, im Schachbrett zweier Betontöne
    const n = 10;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        const a = x0 + (i * 2 * S) / n;
        const b = x0 + ((i + 1) * 2 * S) / n;
        const d = z0 + (k * 2 * S) / n;
        const e = z0 + ((k + 1) * 2 * S) / n;
        fest.quad([a, top, e], [b, top, e], [b, top, d], [a, top, d], (i + k) % 2 === 0 ? BETON : BETON_2);
      }
    }
    // Seiten (unten bis unter das Vorfeld), mit Warnstreifen oben
    const side = (ax: number, az: number, bx: number, bz: number): void => {
      fest.quad([ax, foot, az], [bx, foot, bz], [bx, top - 0.5, bz], [ax, top - 0.5, az], BETON_D);
      const L = Math.hypot(bx - ax, bz - az);
      const nseg = Math.round(L / 2);
      for (let s = 0; s < nseg; s++) {
        const f0 = s / nseg;
        const f1 = (s + 1) / nseg;
        const p = (f: number, y: number): V3 => [ax + (bx - ax) * f, y, az + (bz - az) * f];
        fest.quad(p(f0, top - 0.5), p(f1, top - 0.5), p(f1, top), p(f0, top), s % 2 === 0 ? ORANGE : WEISS);
      }
    };
    side(x0, z1, x1, z1);
    side(x1, z0, x0, z0);
    side(x1, z1, x1, z0);
    side(x0, z0, x0, z1);
    // Starttisch: ein dunkler Block mit gelber Kante, in seiner Mitte das Flammenloch
    const T0 = 7;
    fest.box(RAKETE.x, (top + TISCH) / 2, RAKETE.z, 2 * T0, TISCH - top, 2 * T0, rgb(0x4d5058), 0, rgb(0x5c6068));
    for (const [sx, sz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      fest.box(RAKETE.x + sx * (T0 - 0.2), TISCH + 0.05, RAKETE.z + sz * (T0 - 0.2), sx !== 0 ? 0.4 : 2 * T0, 0.12, sz !== 0 ? 0.4 : 2 * T0, GELB);
    }
    fest.quad([RAKETE.x - 3.5, TISCH + 0.02, RAKETE.z + 3.5], [RAKETE.x + 3.5, TISCH + 0.02, RAKETE.z + 3.5], [RAKETE.x + 3.5, TISCH + 0.02, RAKETE.z - 3.5], [RAKETE.x - 3.5, TISCH + 0.02, RAKETE.z - 3.5], SCHWARZ);
    // Versorgungsmast neben der Rakete (schlankes Fachwerk) mit drei Armen zur Rakete hin
    const mx = RAKETE.x - 12;
    const mz = RAKETE.z - 10;
    const mh = 54;
    const mw = 1.6;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      fest.box(mx + sx * mw, top + mh / 2, mz + sz * mw, 0.5, mh, 0.5, TURMROT);
    }
    for (let y = top + 4; y < top + mh; y += 4.5) {
      beam(fest, [mx - mw, y, mz - mw], [mx + mw, y + 4.5, mz - mw], 0.25, TURMROT_D);
      beam(fest, [mx + mw, y, mz + mw], [mx - mw, y + 4.5, mz + mw], 0.25, TURMROT_D);
      beam(fest, [mx - mw, y, mz + mw], [mx - mw, y + 4.5, mz - mw], 0.25, TURMROT_D);
      beam(fest, [mx + mw, y, mz - mw], [mx + mw, y + 4.5, mz + mw], 0.25, TURMROT_D);
    }
    fest.box(mx, top + mh + 0.4, mz, 4, 0.8, 4, WEISS);
    const dx = RAKETE.x - mx;
    const dz = RAKETE.z - mz;
    const dl = Math.hypot(dx, dz);
    for (const h of [18, 34, 50]) {
      const r = h > 46 ? 3.6 : R_KERN;
      const end: V3 = [RAKETE.x - (dx / dl) * (r + 0.6), TISCH + h, RAKETE.z - (dz / dl) * (r + 0.6)];
      beam(fest, [mx, TISCH + h, mz], end, 0.9, h === 34 ? ORANGE : STAHL);
    }
  }

  // --- Stützmauern der Einschnitte (Flammengraben, Rampen zum Kriechweg) -------------------
  for (const s of land.schnitte) {
    const inS = new Uint8Array(t.total);
    for (const i of s.segs) inS[i] = 1;
    const soot = s.segs.some((i) => t.branchOf[i] === kGraben);
    for (const i of s.segs) {
      const j = t.next[i];
      if (!inS[j]) continue;
      for (const sgn of [-1, 1]) {
        const lat = sgn * s.half;
        const a0 = P(i, lat, -0.4);
        const a1 = P(j, lat, -0.4);
        const top0: V3 = [a0[0], G + 0.35, a0[2]];
        const top1: V3 = [a1[0], G + 0.35, a1[2]];
        // Innenseite zur Fahrbahn (unten verrußt im Flammengraben), Krone
        const mid0: V3 = [a0[0], Math.min(G, a0[1] + 3), a0[2]];
        const mid1: V3 = [a1[0], Math.min(G, a1[1] + 3), a1[2]];
        if (sgn < 0) {
          fest.quad(a0, a1, mid1, mid0, soot ? RUSS : BETON_D);
          fest.quad(mid0, mid1, top1, top0, BETON_2);
        } else {
          fest.quad(a1, a0, mid0, mid1, soot ? RUSS : BETON_D);
          fest.quad(mid1, mid0, top0, top1, BETON_2);
        }
        const o0: V3 = [a0[0] + rightX(t, i) * sgn * 0.6, G + 0.35, a0[2] + rightZ(t, i) * sgn * 0.6];
        const o1: V3 = [a1[0] + rightX(t, j) * sgn * 0.6, G + 0.35, a1[2] + rightZ(t, j) * sgn * 0.6];
        if (sgn < 0) fest.quad(top0, top1, o1, o0, i % 6 < 3 ? ORANGE : WEISS);
        else fest.quad(top1, top0, o0, o1, i % 6 < 3 ? ORANGE : WEISS);
      }
    }
  }

  // --- Kriechweg-Graben ------------------------------------------------------------
  const k = land.kriech;
  if (c) {
    // Wo die Hauptstraße die Wände durchbricht: x-Bereiche je Wand (Nord −, Süd +)
    const offen: [number, number][][] = [[], []];
    for (const s of land.schnitte) {
      for (const i of s.segs) {
        if (t.branchOf[i] >= 0) continue;
        for (let w = 0; w < 2; w++) {
          const zw = k.z + (w === 0 ? -1 : 1) * k.half;
          if (Math.abs(t.pz[i] - zw) < 1.2) offen[w].push([t.px[i] - s.half - 0.2, t.px[i] + s.half + 0.2]);
        }
      }
    }
    const blocked = (w: number, x: number): boolean => offen[w].some(([a, b]) => x > a && x < b);
    const STEP = 3;
    for (let x = k.x1; x < k.x0; x += STEP) {
      const xa = x;
      const xb = Math.min(k.x0, x + STEP);
      for (let w = 0; w < 2; w++) {
        if (blocked(w, (xa + xb) / 2)) continue;
        const sgn = w === 0 ? -1 : 1;
        const zw = k.z + sgn * k.half;
        const a: V3 = [xa, k.floor - 0.3, zw];
        const b: V3 = [xb, k.floor - 0.3, zw];
        const m0: V3 = [xa, k.floor + 2.4, zw];
        const m1: V3 = [xb, k.floor + 2.4, zw];
        const t0: V3 = [xa, G + 0.35, zw];
        const t1: V3 = [xb, G + 0.35, zw];
        if (sgn < 0) {
          fest.quad(a, b, m1, m0, BETON_D);
          fest.quad(m0, m1, t1, t0, BETON_2);
          fest.quad(t0, t1, [xb, G + 0.35, zw - 0.6], [xa, G + 0.35, zw - 0.6], Math.floor(x / 6) % 2 === 0 ? ORANGE : WEISS);
        } else {
          fest.quad(b, a, m0, m1, BETON_D);
          fest.quad(m1, m0, t0, t1, BETON_2);
          fest.quad(t1, t0, [xa, G + 0.35, zw + 0.6], [xb, G + 0.35, zw + 0.6], Math.floor(x / 6) % 2 === 0 ? ORANGE : WEISS);
        }
      }
      // Kiesbett: zwei helle Spuren unter den Raupen, dazwischen und daneben dunkler
      const lanes: [number, number, RGB][] = [
        [-k.half, -CRAWLER_LEG_W - 2.4, KIES_2],
        [-CRAWLER_LEG_W - 2.4, -CRAWLER_LEG_W + 2.4, KIES_HELL],
        [-CRAWLER_LEG_W + 2.4, CRAWLER_LEG_W - 2.4, KIES],
        [CRAWLER_LEG_W - 2.4, CRAWLER_LEG_W + 2.4, KIES_HELL],
        [CRAWLER_LEG_W + 2.4, k.half, KIES_2],
      ];
      for (const [w0, w1, col] of lanes) flach.quad([xa, k.floor - 0.03, k.z + w1], [xb, k.floor - 0.03, k.z + w1], [xb, k.floor - 0.03, k.z + w0], [xa, k.floor - 0.03, k.z + w0], col);
    }
    // Stirnwand im Osten
    const e0: V3 = [k.x0, k.floor - 0.3, k.z - k.half];
    const e1: V3 = [k.x0, k.floor - 0.3, k.z + k.half];
    fest.quad(e0, e1, [k.x0, G + 0.35, k.z + k.half], [k.x0, G + 0.35, k.z - k.half], BETON_D);
    // Unter der Abkürzung: die Verladebühnen, auf denen ihre Fahrbahn über dem Graben steht
    const bb = t.branches[c.branch];
    for (let g = bb.first; g < bb.first + bb.count; g += 2) {
      if ((t.edge[g] & 8) === 0 || (t.edge[g] & 4) !== 0) continue;
      const under = t.py[g] - 1.15;
      if (under <= G - 0.2) continue;
      fest.box(t.px[g], (G - 0.4 + under) / 2, t.pz[g], 2.4 * t.wh[g], under - G + 0.4, 2.2, BETON_D, Math.atan2(t.tx[g], t.tz[g]));
    }
  }

  // --- Betonvorfeld rings um die Einschnitte --------------------------------------------
  // Um Sockel und Kriechweg ein Rahmen mit geraden Kanten, längs der Einschnitte an der Fahrbahn je ein Streifen; Stücke,
  // die in einem Einschnitt oder auf einer Fahrbahn in Platzhöhe lägen, fallen weg (dort deckt Wand bzw. Fahrbahn).
  {
    const y = G - 0.32;
    const roads: number[] = [];
    for (let i = 0; i < t.total; i += 2) if (t.py[i] > G - 3 && t.py[i] < G + 6 && (t.edge[i] & EDGE_GLIDE) === 0) roads.push(i);
    const onRoad = (x: number, z: number): boolean => {
      for (const i of roads) {
        const dx = x - t.px[i];
        const dz = z - t.pz[i];
        if (Math.abs(dx) > 14 || Math.abs(dz) > 14) continue;
        if (Math.hypot(dx, dz) < t.wh[i] + 1.2) return true;
      }
      return false;
    };
    const ok = (x: number, z: number): boolean => land.near(x, z) > 0.2 && !onRoad(x, z);
    const tile = (a: V3, b: V3, c: V3, d: V3, col: RGB): void => {
      const cx = (a[0] + b[0] + c[0] + d[0]) / 4;
      const cz = (a[2] + b[2] + c[2] + d[2]) / 4;
      if (ok(cx, cz)) flach.quad(a, b, c, d, col);
    };
    /** Rahmen um das Rechteck x0…x1, z0…z1 (Breite W), in Kacheln von 2,5 m. */
    const rahmen = (x0: number, x1: number, z0: number, z1: number, W: number): void => {
      const C = 2.5;
      for (let x = x0 - W; x < x1 + W - 1e-6; x += C) {
        for (let z = z0 - W; z < z1 + W - 1e-6; z += C) {
          const xa = x;
          const xb = Math.min(x + C, x1 + W);
          const za = z;
          const zb = Math.min(z + C, z1 + W);
          if (xa >= x0 && xb <= x1 && za >= z0 && zb <= z1) continue;
          const col = (Math.floor(x / 7.5) + Math.floor(z / 7.5)) % 2 === 0 ? BETON : BETON_2;
          tile([xa, y, zb], [xb, y, zb], [xb, y, za], [xa, y, za], col);
        }
      }
    };
    rahmen(RAKETE.x - SOCKEL, RAKETE.x + SOCKEL, RAKETE.z - SOCKEL, RAKETE.z + SOCKEL, APRON);
    if (c) rahmen(k.x1, k.x0, k.z - k.half, k.z + k.half, APRON);
    for (const s of land.schnitte) {
      const inS = new Uint8Array(t.total);
      for (const i of s.segs) inS[i] = 1;
      for (const i of s.segs) {
        const j = t.next[i];
        if (!inS[j]) continue;
        for (const sgn of [-1, 1]) {
          for (let r = 0; r < 6; r++) {
            const l0 = sgn * (s.half + 0.6 + (r * APRON) / 6);
            const l1 = sgn * (s.half + 0.6 + ((r + 1) * APRON) / 6);
            const F = (g: number, l: number): V3 => [t.px[g] + rightX(t, g) * l, y, t.pz[g] + rightZ(t, g) * l];
            tile(F(i, l0), F(j, l0), F(j, l1), F(i, l1), (Math.floor(i / 5) + r) % 2 === 0 ? BETON : BETON_2);
          }
        }
      }
    }
  }

  // --- Serviceturm mit den Kragarmen unter der Wendel ----------------------------------------
  let turmTop = 0;
  {
    const H = 7;
    let hi = 0;
    for (let i = 0; i < t.n; i++) if (Math.hypot(t.px[i] - TURM.x, t.pz[i] - TURM.z) < TURM.r + 1) hi = Math.max(hi, t.py[i]);
    const foot = ground(TURM.x, TURM.z) - 0.5;
    const top = hi + 11;
    turmTop = top;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      fest.box(TURM.x + sx * H, (foot + top) / 2, TURM.z + sz * H, 1.3, top - foot, 1.3, TURMROT);
    }
    // Aufzugsschacht in der Mitte
    fest.box(TURM.x, (foot + top) / 2, TURM.z, 5, top - foot, 5, rgb(0xbfbab0));
    const LV = 6;
    for (let y = foot + LV; y < top; y += LV) {
      for (let f = 0; f < 4; f++) {
        const a = f * (Math.PI / 2);
        const p = (s: number, yy: number): V3 => {
          const cx = Math.cos(a) * H;
          const cz = Math.sin(a) * H;
          return [TURM.x + cx - Math.sin(a) * H * s, yy, TURM.z + cz + Math.cos(a) * H * s];
        };
        beam(fest, p(-1, y), p(1, y), 0.55, Math.floor(y / LV) % 2 === 0 ? TURMROT_D : WEISS);
        beam(fest, p(-1, y - LV), p(1, y), 0.32, TURMROT_D);
        beam(fest, p(1, y - LV), p(-1, y), 0.32, TURMROT_D);
      }
    }
    // Plattform oben, Blitzableiter, Kranausleger
    fest.box(TURM.x, top + 0.4, TURM.z, 2 * H + 3, 0.8, 2 * H + 3, STAHL);
    fest.box(TURM.x, top + 3, TURM.z, 6, 4.4, 6, WEISS, 0, ORANGE);
    beam(fest, [TURM.x, top + 5, TURM.z], [TURM.x, top + 16, TURM.z], 0.35, STAHL_D);
    beam(fest, [TURM.x + 2, top + 5.2, TURM.z + 2], [TURM.x - 16, top + 7, TURM.z + 10], 0.7, GELB);
    // Kragarme: alle 10 m unter der Wendel ein Arm vom Turm zur Außenkante und eine Strebe schräg darunter
    for (let i = 0; i < t.n; i += 10) {
      const r = Math.hypot(t.px[i] - TURM.x, t.pz[i] - TURM.z);
      if (Math.abs(r - TURM.r) > 1.5 || (t.edge[i] & EDGE_BAND) !== 0 || t.py[i] < foot + 4) continue;
      const dx = (t.px[i] - TURM.x) / r;
      const dz = (t.pz[i] - TURM.z) / r;
      const outer = P(i, t.wh[i] * Math.sign(dx * rightX(t, i) + dz * rightZ(t, i)), -1.15);
      const inner = P(i, -t.wh[i] * Math.sign(dx * rightX(t, i) + dz * rightZ(t, i)), -1.15);
      const at = (rr: number, y: number): V3 => [TURM.x + dx * rr, y, TURM.z + dz * rr];
      beam(fest, at(H, inner[1]), outer, 0.8, STAHL);
      beam(fest, at(H, inner[1] - 7), [(inner[0] + outer[0]) / 2, (inner[1] + outer[1]) / 2 - 0.4, (inner[2] + outer[2]) / 2], 0.6, STAHL_D);
    }
  }

  // --- Brücke: Pylone, wo das Band noch kaum gedreht ist; Magnetring: Fachwerk außen, Pylone hinab ----
  {
    // Fahrbahnen am Boden und die Flugbahn: da steht kein Pylon.
    const low: number[] = [];
    for (let i = 0; i < t.total; i += 2) if ((t.edge[i] & (EDGE_BAND | EDGE_TWIST)) === 0) low.push(i);
    const free = (x: number, z: number, top: number): boolean => {
      for (const i of low) {
        if (t.py[i] > top - 2) continue;
        const d = Math.hypot(x - t.px[i], z - t.pz[i]);
        if (d < t.wh[i] + ((t.edge[i] & EDGE_GLIDE) !== 0 ? 9 : 2.5)) return false;
      }
      return land.near(x, z) > 2;
    };
    let last = -99;
    for (let i = 0; i < t.n; i++) {
      if ((t.edge[i] & EDGE_BAND) === 0 || t.roll[i] > 0.4) continue;
      if (Math.hypot(t.px[i] - TURM.x, t.pz[i] - TURM.z) < TURM.r + 12) continue;
      if (i - last < 26) continue;
      const under = P(i, 0, -1.15);
      const legs: V3[] = [];
      let ok = true;
      for (const sgn of [-1, 1]) {
        const top = P(i, sgn * 3.2, -1.15);
        const fx = t.px[i] + rightX(t, i) * sgn * 8;
        const fz = t.pz[i] + rightZ(t, i) * sgn * 8;
        if (!free(fx, fz, top[1])) ok = false;
        legs.push(top, [fx, ground(fx, fz) - 0.5, fz]);
      }
      if (!ok) continue;
      last = i;
      beam(fest, legs[1], legs[0], 1.4, WEISS);
      beam(fest, legs[3], legs[2], 1.4, WEISS);
      beam(fest, P(i, -3.6, -1.6), P(i, 3.6, -1.6), 1.1, ORANGE);
      const mid: V3 = [under[0], (under[1] + legs[1][1]) / 2, under[2]];
      beam(fest, [(legs[1][0] + mid[0]) / 2, mid[1], (legs[1][2] + mid[2]) / 2], [(legs[3][0] + mid[0]) / 2, mid[1], (legs[3][2] + mid[2]) / 2], 0.7, STAHL);
    }
    // Magnetring: Fachwerkwand außen am Band (von der Rakete gesehen hinter ihm), so weit das Band an der Wand liegt.
    const RR = RAKETE.r + RAKETE.axis + 2.6;
    const ring: { a: number; y: number }[] = [];
    for (let i = 0; i < t.n; i++) {
      if ((t.edge[i] & EDGE_TWIST) === 0 || t.roll[i] < 0.5) continue;
      const a = Math.atan2(t.pz[i] - RAKETE.z, t.px[i] - RAKETE.x);
      ring.push({ a, y: t.py[i] + RAKETE.axis });
    }
    if (ring.length > 1) {
      // nach Winkel, in Fahrtrichtung (links herum: fallender Winkel in atan2 von z/x … die Reihenfolge der Abschnitte)
      const STEP = 4;
      for (let n = 0; n + STEP < ring.length; n += STEP) {
        const p = ring[n];
        const q = ring[Math.min(ring.length - 1, n + STEP)];
        const A = (r: number, y: number, s: { a: number }): V3 => [RAKETE.x + Math.cos(s.a) * r, y, RAKETE.z + Math.sin(s.a) * r];
        for (const dy of [-7.5, 0, 7.5]) beam(fest, A(RR, p.y + dy, p), A(RR, q.y + dy, q), dy === 0 ? 0.6 : 0.9, dy === 0 ? WEISS : STAHL);
        beam(fest, A(RR, p.y - 7.5, p), A(RR, q.y + 7.5, q), 0.4, STAHL_D);
        if (n % (STEP * 2) === 0) beam(fest, A(RR, p.y - 7.5, p), A(RR, p.y + 7.5, p), 0.8, STAHL);
      }
      // Außen verkleidet: weiße Platten mit orangem Band (von außen sieht man nicht die Rückseite des Bands, sondern den Ring)
      for (let n = 0; n + 1 < ring.length; n += 2) {
        const p = ring[n];
        const q = ring[Math.min(ring.length - 1, n + 2)];
        const A = (y: number, s: { a: number }): V3 => [RAKETE.x + Math.cos(s.a) * (RR + 0.4), y, RAKETE.z + Math.sin(s.a) * (RR + 0.4)];
        const bands: [number, number, RGB][] = [
          [-8.2, -2.2, WEISS],
          [-2.2, 0.6, ORANGE],
          [0.6, 8.2, WEISS],
        ];
        for (const [y0, y1, col] of bands) fest.quad(A(p.y + y0, p), A(q.y + y0, q), A(q.y + y1, q), A(p.y + y1, p), n % 8 < 4 ? col : shade(col, 0.95));
        // Ober- und Unterkante (Deckel zur Rückseite des Bands hin)
        const B = (y: number, s: { a: number }, r: number): V3 => [RAKETE.x + Math.cos(s.a) * r, y, RAKETE.z + Math.sin(s.a) * r];
        fest.quad(B(p.y + 8.2, p, RR + 0.4), B(q.y + 8.2, q, RR + 0.4), B(q.y + 8.2, q, RR - 2.4), B(p.y + 8.2, p, RR - 2.4), STAHL);
        fest.quad(B(p.y - 8.2, p, RR - 2.4), B(q.y - 8.2, q, RR - 2.4), B(q.y - 8.2, q, RR + 0.4), B(p.y - 8.2, p, RR + 0.4), STAHL_D);
      }
      // Pylone hinab: alle 40°, wo der Boden frei ist
      let lastA = -99;
      for (const s of ring) {
        if (Math.abs(s.a - lastA) < (40 * Math.PI) / 180) continue;
        const fx = RAKETE.x + Math.cos(s.a) * (RR + 3);
        const fz = RAKETE.z + Math.sin(s.a) * (RR + 3);
        if (!free(fx, fz, s.y - 8)) continue;
        lastA = s.a;
        const topP: V3 = [RAKETE.x + Math.cos(s.a) * RR, s.y - 7.5, RAKETE.z + Math.sin(s.a) * RR];
        const foot: V3 = [fx, ground(fx, fz) - 0.5, fz];
        beam(fest, foot, topP, 1.8, WEISS);
        fest.box(fx, foot[1] + 0.7, fz, 3.2, 1.8, 3.2, BETON_D);
      }
    }
  }

  // --- Flammenzone und Abgasstoß auf der Straße -------------------------------------------
  if (zone) {
    const N = 24;
    const seg = zone.seg;
    for (let q = 0; q < N; q++) {
      const a0 = (q / N) * Math.PI * 2;
      const a1 = ((q + 1) / N) * Math.PI * 2;
      const Q = (a: number, r: number): V3 => {
        const lat = zone.lat + Math.cos(a) * r;
        return [zone.x + rightX(t, seg) * Math.cos(a) * r + t.tx[seg] * Math.sin(a) * r, t.py[seg] + lat * t.bank[seg] + 0.05, zone.z + rightZ(t, seg) * Math.cos(a) * r + t.tz[seg] * Math.sin(a) * r];
      };
      const lat = zone.lat + Math.cos((a0 + a1) / 2) * zone.radius;
      if (Math.abs(lat) > t.wh[seg]) continue;
      flach.quad(Q(a1, zone.radius + 0.25), Q(a0, zone.radius + 0.25), Q(a0, zone.radius - 0.25), Q(a1, zone.radius - 0.25), q % 2 === 0 ? ROT : GELB);
    }
  }
  for (const w of t.winds) {
    // Pfeile zur Windseite: alle 10 m drei Winkel quer über die Bahn (in Schubrichtung)
    const dir = w.push > 0 ? 1 : -1;
    for (let k2 = 4; k2 < w.count - 4; k2 += 10) {
      const i = w.first + k2;
      for (const lat0 of [-3.5, 0, 3.5]) {
        const tip = P(i, lat0 + dir * 1.1, 0.04);
        const l = P(i, lat0 - dir * 0.4, 0.04, 1.2);
        const r = P(i, lat0 - dir * 0.4, 0.04, -1.2);
        flach.tri(dir > 0 ? l : r, dir > 0 ? r : l, tip, WEISS);
      }
    }
  }

  // --- Tafeln (Countdown) -----------------------------------------------------------
  const tafeln: Tafel[] = [];
  /** Tafel in der Ebene durch m mit Breitenachse (rx, rz), Höhe h (Ziffernhöhe) – Vorderseite zeigt nach (fx, fz). */
  const tafel = (m: V3, rx: number, rz: number, h: number, fx: number, fz: number): void => {
    const w = h * 2.6;
    const hh = h * 0.8;
    const p = (u: number, v: number, off = 0): V3 => [m[0] + rx * u + fx * off, m[1] + v, m[2] + rz * u + fz * off];
    // Rahmen (Rückseite und Kasten), Stütze
    fest.quad(p(w, -hh, -0.4), p(-w, -hh, -0.4), p(-w, hh, -0.4), p(w, hh, -0.4), SCHWARZ);
    fest.quad(p(-w, -hh, -0.4), p(w, -hh, -0.4), p(w, hh, -0.4), p(-w, hh, -0.4), STAHL_D);
    fest.quad(p(-w, hh, -0.4), p(w, hh, -0.4), p(w, hh + 0.3, -0.1), p(-w, hh + 0.3, -0.1), ORANGE);
    const foot = ground(m[0], m[2]);
    fest.box(m[0] - fx * 0.6, (foot + m[1] - hh) / 2, m[2] - fz * 0.6, 0.6, m[1] - hh - foot, 0.6, STAHL);
    // „T−“ als zwei Balken
    const s0 = glow.add(2);
    const tq = (q: number, u0: number, u1: number, v0: number, v1: number): void => {
      glow.set(q, p(u0, v0, 0.05), p(u1, v0, 0.05), p(u1, v1, 0.05), p(u0, v1, 0.05));
      glow.color(q, ZIFFER);
    };
    const x0 = -w + h * 0.35;
    // (Die Ecken werden gesetzt, sobald die Flächen angelegt sind – nach glow.finish.)
    tafelT.push(() => {
      tq(s0, x0, x0 + h * 0.75, h * 0.42, h * 0.55);
      tq(s0 + 1, x0 + h * 0.31, x0 + h * 0.44, -h * 0.55, h * 0.42);
    });
    const minus = glow.add();
    tafelT.push(() => tq(minus, x0 + h * 0.95, x0 + h * 1.45, -0.06 * h, 0.06 * h));
    // zwei Ziffern
    const seg = glow.add(14);
    const lamp = glow.add(2);
    const segQuad = (d: number, s: number): [number, number, number, number] => {
      const dw = h * 0.55;
      const ox = x0 + h * 1.75 + d * (dw + h * 0.3);
      const th = h * 0.11;
      const top = h * 0.5;
      const mid = 0;
      const bot = -h * 0.5;
      switch (s) {
        case 0:
          return [ox, ox + dw, top - th, top];
        case 1:
          return [ox + dw - th, ox + dw, mid, top];
        case 2:
          return [ox + dw - th, ox + dw, bot, mid];
        case 3:
          return [ox, ox + dw, bot, bot + th];
        case 4:
          return [ox, ox + th, bot, mid];
        case 5:
          return [ox, ox + th, mid, top];
        default:
          return [ox, ox + dw, mid - th / 2, mid + th / 2];
      }
    };
    tafelT.push(() => {
      for (let d = 0; d < 2; d++) {
        for (let s = 0; s < 7; s++) {
          const [u0, u1, v0, v1] = segQuad(d, s);
          glow.set(seg + d * 7 + s, p(u0, v0, 0.05), p(u1, v0, 0.05), p(u1, v1, 0.05), p(u0, v1, 0.05));
        }
      }
      // Lampen rechts: oben das Tor des Flammengrabens, unten der Start
      const lx = w - h * 0.45;
      const r = h * 0.22;
      glow.set(lamp, p(lx - r, h * 0.3 - r, 0.05), p(lx + r, h * 0.3 - r, 0.05), p(lx + r, h * 0.3 + r, 0.05), p(lx - r, h * 0.3 + r, 0.05));
      glow.set(lamp + 1, p(lx - r, -h * 0.3 - r, 0.05), p(lx + r, -h * 0.3 - r, 0.05), p(lx + r, -h * 0.3 + r, 0.05), p(lx - r, -h * 0.3 + r, 0.05));
    });
    tafeln.push({ seg, lamp });
  };
  const tafelT: (() => void)[] = [];
  /** Tafel neben der Hauptstrecke, d Meter vor Abschnitt at, auf Seite side – sie schaut den Ankommenden entgegen. */
  const tafelAn = (at: number, d: number, side: number, h: number, up: number): void => {
    let i = at;
    for (let n = 0; n < d; n++) i = t.prev[i];
    const lat = side * (t.wh[i] + 2.5 + h);
    const m = P(i, lat, up);
    tafel(m, rightX(t, i), rightZ(t, i), h, -t.tx[i], -t.tz[i]);
  };
  if (graben) tafelAn(graben.from, 34, 1, 1.4, 5.5);
  if (zone) tafelAn(zone.seg, 46, 1, 1.4, 5.5);
  // Große Tafel am Kopf des Serviceturms, zum Platz hin (Westen)
  {
    const m: V3 = [TURM.x - 8.6, turmTop - 3.2, TURM.z];
    tafel(m, 0, -1, 3.2, -1, 0);
  }

  // --- Tor des Flammengrabens: zwei Schiebetore hinter der Mündung, Ampel darüber ---------------
  let tor: { i: number; half: number; q: number; lamp: number } | null = null;
  if (graben && grabenTor) {
    const i = Math.min(graben.first + graben.count - 1, grabenTor.first + grabenTor.count + 2);
    const half = t.wh[i] + 0.3;
    const H = 5.2;
    for (const sgn of [-1, 1]) {
      const post = P(i, sgn * (half + 0.5), 0);
      fest.box(post[0], post[1] + H / 2 + 0.6, post[2], 1, H + 1.2, 1, BETON_D, Math.atan2(t.tx[i], t.tz[i]));
      // Torkasten außen, in den die Flügel fahren
      const pocket = P(i, sgn * (half * 1.5 + 0.6), 0);
      fest.box(pocket[0], pocket[1] + H / 2, pocket[2], 1.6, H, half + 0.8, BETON_2, Math.atan2(rightX(t, i), rightZ(t, i)));
    }
    const a = P(i, -half - 0.5, H + 1.2);
    const b = P(i, half + 0.5, H + 1.2);
    beam(fest, a, b, 1.2, ORANGE);
    const q = beweg.add(12);
    const lamp = glow.add(2);
    tor = { i, half, q, lamp };
  }

  // --- Schranke am Transporterdach -------------------------------------------------------
  let schranke: { i: number; q: number; lamp: number; tafel: number; pivot: V3; ax: V3; side: number } | null = null;
  if (c && kriechTor) {
    const bb = t.branches[c.branch];
    const i = Math.min(bb.first + bb.count - 1, kriechTor.first + kriechTor.count + 2);
    const side = 1;
    const pivot = P(i, side * (t.wh[i] + 0.6), 1.15);
    const post = P(i, side * (t.wh[i] + 0.6), 0);
    fest.box(post[0], post[1] + 0.6, post[2], 0.8, 1.2, 0.8, WEISS, Math.atan2(t.tx[i], t.tz[i]), ORANGE);
    fest.box(post[0], post[1] + 2.6, post[2], 0.25, 2.8, 0.25, STAHL_D);
    const q = beweg.add(6);
    const lamp = glow.add(2);
    const tq = glow.add(14);
    schranke = { i, q, lamp, tafel: tq, pivot, ax: [-rightX(t, i) * side, 0, -rightZ(t, i) * side], side };
  }

  // --- Rakete --------------------------------------------------------------------------
  const rocket = new THREE.Group();
  rocket.name = 'Rakete';
  {
    const b = new MeshBuilder();
    const R = R_KERN;
    // Triebwerksglocken
    for (const [ox, oz] of [
      [0, 0],
      [1.8, 1.3],
      [-1.8, 1.3],
      [0, -2.1],
    ]) {
      zyl(b, ox, oz, -2.2, 0, 1.15, 0.6, 10, STAHL_D);
    }
    // Hauptstufe: weiß mit schwarzen Feldern (Rollmuster) und orangem Zwischenstück
    zyl(b, 0, 0, 0, 3, R, R, 20, SCHWARZ, undefined, true);
    zyl(b, 0, 0, 3, 18, R, R, 20, WEISS);
    zyl(b, 0, 0, 18, 21, R, R, 20, SCHWARZ);
    zyl(b, 0, 0, 21, 42, R, R, 20, WEISS);
    zyl(b, 0, 0, 42, 45, R, R * 0.86, 20, ORANGE);
    zyl(b, 0, 0, 45, 52, R * 0.86, R * 0.86, 20, WEISS);
    zyl(b, 0, 0, 52, 54, R * 0.86, R * 0.86, 20, SCHWARZ);
    // Spitze
    zyl(b, 0, 0, 54, 59, R * 0.86, R * 0.55, 20, WEISS);
    zyl(b, 0, 0, 59, R_HOEHE, R * 0.55, 0.05, 20, ORANGE);
    // Flossen
    for (let f = 0; f < 4; f++) {
      const a = (f / 4) * Math.PI * 2 + Math.PI / 4;
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      const p = (r: number, y: number, s: number): V3 => [cx * r - cz * s, y, cz * r + cx * s];
      for (const s of [-0.25, 0.25]) {
        const q0 = p(R - 0.1, 0.2, s);
        const q1 = p(R + 3.2, -0.6, s);
        const q2 = p(R + 2.4, 4, s);
        const q3 = p(R - 0.1, 9, s);
        if (s > 0) b.quad(q0, q1, q2, q3, ORANGE);
        else b.quad(q3, q2, q1, q0, ORANGE);
      }
      b.quad(p(R + 3.2, -0.6, -0.25), p(R + 3.2, -0.6, 0.25), p(R + 2.4, 4, 0.25), p(R + 2.4, 4, -0.25), shade(ORANGE, 0.8));
      b.quad(p(R + 2.4, 4, -0.25), p(R + 2.4, 4, 0.25), p(R - 0.1, 9, 0.25), p(R - 0.1, 9, -0.25), shade(ORANGE, 0.9));
    }
    // Zwei Zusatzraketen (Booster) seitlich
    for (const s of [-1, 1]) {
      const bx = s * (R + 2.3);
      zyl(b, bx, 0, -1.4, 0, 1.0, 0.6, 10, STAHL_D);
      zyl(b, bx, 0, 0, 30, 2.1, 2.1, 14, WEISS, undefined, true);
      zyl(b, bx, 0, 6, 8, 2.12, 2.12, 14, SCHWARZ);
      zyl(b, bx, 0, 30, 36, 2.1, 0.3, 14, ORANGE);
      beam(b, [bx - s * 2, 26, 0], [s * (R - 0.2), 27, 0], 0.5, STAHL);
      beam(b, [bx - s * 2, 4, 0], [s * (R - 0.2), 3.5, 0], 0.5, STAHL);
    }
    // Landebeine (eingeklappt an der Hülle; beim Landen klappen sie aus – siehe update)
    const geo = b.build();
    const mat = toonMaterial({ vertexColors: true });
    mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, mat);
    withOutline(mesh, 0.09);
    rocket.add(mesh);
    disposables.push(geo, mesh.material as THREE.Material);
    for (const ch of mesh.children) if (ch instanceof THREE.Mesh) disposables.push(ch.material as THREE.Material);
  }
  rocket.position.set(RAKETE.x, TISCH + 2.2, RAKETE.z);
  group.add(rocket);
  // Feuer unter der Rakete: drei gekreuzte Flächen, innen hell, außen orange – je Bild gesetzt
  const feuer = glow.add(6);
  // Feuer aus dem Flammengraben (an seiner Mündung und im Graben): je Abschnitt zwei gekreuzte Flächen
  const grabenFeuer: { i: number; q: number }[] = [];
  if (graben) {
    for (let g = graben.first; g < graben.first + graben.count; g += 8) {
      if ((t.edge[g] & EDGE_TUNNEL) !== 0) continue;
      if (t.py[g] > G + 1.5) continue;
      grabenFeuer.push({ i: g, q: glow.add(2) });
    }
  }
  if (zone) grabenFeuer.push({ i: zone.seg, q: glow.add(2) });

  // --- Raupentransporter ------------------------------------------------------------------
  const crawler = new THREE.Group();
  crawler.name = 'Raupentransporter';
  const beacons: number[] = [];
  if (c) {
    const b = new MeshBuilder();
    // lokal: x längs des Kriechwegs (u), z quer (w), y ab Sohle
    const top = CRAWLER_DECK;
    const bot = top - CRAWLER_SLAB;
    const HU = CRAWLER_HALF;
    const HW = CRAWLER_HALF_WIDTH;
    // Plattform: Oberseite mit Spurmarkierung quer (die Abkürzung fährt quer über sie), Seiten gestreift
    const NU = 8;
    for (let a = 0; a < NU; a++) {
      const u0 = -HU + (a * 2 * HU) / NU;
      const u1 = -HU + ((a + 1) * 2 * HU) / NU;
      b.quad([u0, top, HW], [u1, top, HW], [u1, top, -HW], [u0, top, -HW], a % 2 === 0 ? DECK_C : shade(DECK_C, 0.93));
    }
    // gelbe Randlinien an den Langseiten
    b.quad([-HU, top + 0.03, HW - 0.2], [HU, top + 0.03, HW - 0.2], [HU, top + 0.03, HW - 0.8], [-HU, top + 0.03, HW - 0.8], GELB);
    b.quad([HU, top + 0.03, -HW + 0.2], [-HU, top + 0.03, -HW + 0.2], [-HU, top + 0.03, -HW + 0.8], [HU, top + 0.03, -HW + 0.8], GELB);
    for (const u of [-5.2, 5.2]) b.quad([u - 0.25, top + 0.03, HW - 1], [u + 0.25, top + 0.03, HW - 1], [u + 0.25, top + 0.03, -HW + 1], [u - 0.25, top + 0.03, -HW + 1], WEISS);
    // Unterseite und Seiten
    b.quad([-HU, bot, -HW], [HU, bot, -HW], [HU, bot, HW], [-HU, bot, HW], RAUPE_D);
    const NS = 12;
    for (let a = 0; a < NS; a++) {
      const u0 = -HU + (a * 2 * HU) / NS;
      const u1 = -HU + ((a + 1) * 2 * HU) / NS;
      const col = a % 2 === 0 ? ORANGE : WEISS;
      b.quad([u0, bot, HW], [u1, bot, HW], [u1, top, HW], [u0, top, HW], col);
      b.quad([u1, bot, -HW], [u0, bot, -HW], [u0, top, -HW], [u1, top, -HW], col);
    }
    b.quad([HU, bot, HW], [HU, bot, -HW], [HU, top, -HW], [HU, top, HW], STAHL);
    b.quad([-HU, bot, -HW], [-HU, bot, HW], [-HU, top, HW], [-HU, top, -HW], STAHL);
    // Geländer an den Stirnseiten
    for (const s of [-1, 1]) {
      for (let w = -HW + 0.3; w <= HW - 0.2; w += 2.3) b.box(s * (HU - 0.25), top + 0.55, w, 0.15, 1.1, 0.15, GELB);
      b.box(s * (HU - 0.25), top + 1.1, 0, 0.18, 0.15, 2 * HW - 0.4, GELB);
    }
    // Vier Raupenböcke: Raupen (zwei Ketten je Bock), Säule bis unter die Plattform
    for (const su of [-1, 1]) {
      for (const sw of [-1, 1]) {
        const cu = su * CRAWLER_LEG_U;
        const cw = sw * CRAWLER_LEG_W;
        for (const k2 of [-1, 1]) {
          const kw = cw + k2 * (CRAWLER_LEG_HALF_WIDTH * 0.5);
          b.box(cu, 0.75, kw, CRAWLER_LEG_HALF * 2, 1.5, CRAWLER_LEG_HALF_WIDTH * 0.9, RAUPE, 0, RAUPE_D);
          // Kettenglieder als helle Querstreifen auf der Außenseite
          for (let u = -CRAWLER_LEG_HALF + 0.3; u < CRAWLER_LEG_HALF; u += 0.7) b.box(cu + u, 0.75, kw + k2 * (CRAWLER_LEG_HALF_WIDTH * 0.45 + 0.02), 0.22, 1.3, 0.05, STAHL);
        }
        b.box(cu, 1.9, cw, CRAWLER_LEG_HALF * 1.6, 0.8, CRAWLER_LEG_HALF_WIDTH * 1.9, GELB);
        b.box(cu, (2.3 + bot) / 2, cw, 1.8, bot - 2.3, 1.8, GELB);
        b.box(cu, bot - 0.4, cw, 2.6, 0.8, 2.6, STAHL);
      }
    }
    // Führerstand unter der Plattform (zwischen den Böcken, am Ende 1)
    b.box(HU - 4, bot - 1.2, 0, 3.4, 2.2, 4.6, WEISS, 0, ORANGE);
    b.box(HU - 2.25, bot - 1.0, 0, 0.1, 1.0, 3.6, rgb(0x2a4a66));
    const geo = b.build();
    const mesh = new THREE.Mesh(geo, toonMaterial({ vertexColors: true }));
    withOutline(mesh, 0.07);
    crawler.add(mesh);
    disposables.push(geo, mesh.material as THREE.Material);
    for (const ch of mesh.children) if (ch instanceof THREE.Mesh) disposables.push(ch.material as THREE.Material);
    crawler.rotation.y = Math.atan2(c.uz, c.ux) * -1;
    group.add(crawler);
    for (let n = 0; n < 4; n++) beacons.push(glow.add(2));
  }

  // --- Netze ---------------------------------------------------------------------------
  glow.finish();
  beweg.finish(true);
  for (const f of tafelT) f();
  const festMat = toonMaterial({ vertexColors: true });
  festMat.side = THREE.DoubleSide;
  const festMesh = new THREE.Mesh(fest.build(), festMat);
  festMesh.name = 'Startplatz fest';
  const flachMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  flachMat.color.setScalar(0.92);
  const flachMesh = new THREE.Mesh(flach.build(), flachMat);
  flachMesh.name = 'Vorfeld und Markierungen';
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glowMesh = new THREE.Mesh(glow.geo, glowMat);
  glowMesh.frustumCulled = false;
  glowMesh.name = 'Tafeln und Feuer';
  const bewegMat = toonMaterial({ vertexColors: true });
  bewegMat.side = THREE.DoubleSide;
  const bewegMesh = new THREE.Mesh(beweg.geo, bewegMat);
  bewegMesh.frustumCulled = false;
  bewegMesh.name = 'Tore und Schranke';
  group.add(festMesh, flachMesh, glowMesh, bewegMesh);
  disposables.push(festMesh.geometry, festMat, flachMesh.geometry, flachMat, glow.geo, glowMat, beweg.geo, bewegMat);
  group.userData.triangles = fest.triangles + flach.triangles;

  // --- je Bild -----------------------------------------------------------------------------
  const PERIOD = STARTTAKT.period * 60;
  /** Sekunden seit dem letzten Start (0 … 40). */
  const zyklus = (time: number): number => (takt ? pulseCycle(takt, time) : ((time % PERIOD) + PERIOD) % PERIOD) / 60;
  const up = new THREE.Vector3();
  const pose = { x: 0, z: 0, vx: 0, vz: 0 };
  let last = -1e9;

  /** Lage der Rakete im Zyklus: Höhe über dem Tisch, Neigung (rad, nach Osten), seitliches Abdriften; Feuer 0 … 1. */
  const flug = (cy: number): { y: number; tilt: number; dx: number; fire: number; visible: boolean; land: boolean } => {
    if (cy < STEIG_BIS) {
      const y = 1.7 * cy * cy;
      const tilt = Math.min(0.5, Math.max(0, cy - 5) * 0.06);
      const dx = Math.max(0, cy - 5) ** 2 * 0.9;
      return { y, tilt, dx, fire: 1, visible: true, land: false };
    }
    if (cy < LANDE_AB) return { y: 0, tilt: 0, dx: 0, fire: 0, visible: false, land: false };
    if (cy < LANDE_BIS) {
      const u = (cy - LANDE_AB) / (LANDE_BIS - LANDE_AB);
      const y = LANDE_H * (1 - u) * (1 - u);
      return { y, tilt: 0, dx: 0, fire: u > 0.3 ? 0.55 : 0, visible: true, land: true };
    }
    // Countdown: kurz vor dem Start zündet es schon (die letzten anderthalb Sekunden)
    return { y: 0, tilt: 0, dx: 0, fire: cy > STARTTAKT.period - 1.5 ? 0.35 : 0, visible: true, land: false };
  };

  const setFlame = (q: number, base: V3, axis: V3, side: V3, len: number, wid: number, col: RGB): void => {
    // zwei gekreuzte Flächen von der Düse (schmal) zur Spitze
    const other: V3 = [axis[1] * side[2] - axis[2] * side[1], axis[2] * side[0] - axis[0] * side[2], axis[0] * side[1] - axis[1] * side[0]];
    for (let k2 = 0; k2 < 2; k2++) {
      const s = k2 === 0 ? side : other;
      const tip: V3 = [base[0] - axis[0] * len, base[1] - axis[1] * len, base[2] - axis[2] * len];
      const a: V3 = [base[0] - s[0] * wid * 0.6, base[1] - s[1] * wid * 0.6, base[2] - s[2] * wid * 0.6];
      const b: V3 = [base[0] + s[0] * wid * 0.6, base[1] + s[1] * wid * 0.6, base[2] + s[2] * wid * 0.6];
      const mid = 0.45;
      const c1: V3 = [base[0] - axis[0] * len * mid + s[0] * wid, base[1] - axis[1] * len * mid + s[1] * wid, base[2] - axis[2] * len * mid + s[2] * wid];
      const d1: V3 = [base[0] - axis[0] * len * mid - s[0] * wid, base[1] - axis[1] * len * mid - s[1] * wid, base[2] - axis[2] * len * mid - s[2] * wid];
      glow.set(q + k2 * 2, a, b, c1, d1);
      glow.set(q + k2 * 2 + 1, d1, c1, tip, tip);
      glow.color(q + k2 * 2, col);
      glow.color(q + k2 * 2 + 1, col);
    }
  };

  function update(time: number, fx: FxSink | null): void {
    const steady = time > last && time - last < 30;
    const cy = zyklus(time);
    const f = flug(cy);
    // Rakete
    rocket.visible = f.visible;
    rocket.position.set(RAKETE.x + f.dx, TISCH + 2.2 + f.y, RAKETE.z);
    rocket.rotation.set(0, 0, -f.tilt);
    up.set(Math.sin(f.tilt), Math.cos(f.tilt), 0);
    const flick = 0.85 + 0.15 * Math.sin(time * 1.7) * Math.sin(time * 0.61);
    if (f.visible && f.fire > 0) {
      const base: V3 = [rocket.position.x - up.x * 2, rocket.position.y - up.y * 2, rocket.position.z];
      const axis: V3 = [up.x, up.y, up.z];
      const len = (f.land ? 14 : cy > STARTTAKT.period - 2 ? 6 : 26 + Math.min(20, cy * 4)) * f.fire * flick + 2;
      setFlame(feuer, base, axis, [0, 0, 1], len, 5.5 * Math.max(0.5, f.fire), FEUER_AUSSEN);
      setFlame(feuer + 4, base, axis, [Math.SQRT1_2, 0, Math.SQRT1_2], len * 0.55, 3.2, FEUER_KERN);
    } else for (let q = 0; q < 6; q++) glow.hide(feuer + q);
    // Feuer im Flammengraben und an seiner Mündung: die ersten anderthalb Sekunden nach dem Start
    const burn = cy < 1.8 ? Math.min(1, cy / 0.15) * (1 - Math.max(0, cy - 1.2) / 0.6) : 0;
    for (const g of grabenFeuer) {
      if (burn <= 0) {
        glow.hide(g.q);
        glow.hide(g.q + 1);
        continue;
      }
      const lat = g.i === zone?.seg ? zone.lat : 0;
      const r = g.i === zone?.seg ? zone.radius : t.wh[g.i];
      const base = P(g.i, lat, 0.1);
      const h = (g.i === zone?.seg ? 9 : 6) * burn * flick;
      const rx = rightX(t, g.i) * r;
      const rz = rightZ(t, g.i) * r;
      glow.set(g.q, [base[0] - rx, base[1], base[2] - rz], [base[0] + rx, base[1], base[2] + rz], [base[0] + rx * 0.4, base[1] + h, base[2] + rz * 0.4], [base[0] - rx * 0.4, base[1] + h, base[2] - rz * 0.4]);
      glow.set(g.q + 1, [base[0] - t.tx[g.i] * r, base[1], base[2] - t.tz[g.i] * r], [base[0] + t.tx[g.i] * r, base[1], base[2] + t.tz[g.i] * r], [base[0] + t.tx[g.i] * r * 0.4, base[1] + h * 0.8, base[2] + t.tz[g.i] * r * 0.4], [base[0] - t.tx[g.i] * r * 0.4, base[1] + h * 0.8, base[2] - t.tz[g.i] * r * 0.4]);
      glow.color(g.q, FEUER);
      glow.color(g.q + 1, FEUER_AUSSEN);
    }
    // Tafeln: Sekunden bis zum nächsten Start
    const left = Math.max(0, Math.ceil(STARTTAKT.period - cy - 1e-6)) % 100;
    const hot = STARTTAKT.period - cy <= 10;
    const shut = grabenTor ? planActive(grabenTor.plan, time) : false;
    const blink = Math.floor(time / 15) % 2 === 0;
    for (const tf of tafeln) {
      const digits = [Math.floor(left / 10), left % 10];
      for (let d = 0; d < 2; d++) {
        const m = SEGS[digits[d]];
        for (let s = 0; s < 7; s++) glow.color(tf.seg + d * 7 + s, (m >> s) & 1 && !(d === 0 && digits[0] === 0) ? (hot ? ZIFFER_ROT : ZIFFER) : ZIFFER_AUS);
      }
      glow.color(tf.lamp, shut ? ROT : GRUEN);
      glow.color(tf.lamp + 1, hot ? (blink ? BERN : LAMPE_AUS) : cy < 3 ? ROT : LAMPE_AUS);
    }
    // Tor des Flammengrabens: fährt in einer Sekunde zu bzw. auf
    if (tor && grabenTor) {
      const P0 = grabenTor.plan;
      const zu = shut ? Math.min(1, planSince(P0, time) / 60) : Math.max(0, 1 - (time - lastOpen(P0, time)) / 60);
      const H = 5.2;
      const i = tor.i;
      const along: V3 = [t.tx[i], 0, t.tz[i]];
      for (let s = 0; s < 2; s++) {
        const sgn = s === 0 ? -1 : 1;
        const w = tor.half / 2;
        const centerLat = sgn * (tor.half - w * zu + (1 - zu) * w * 1.2);
        const cpos = P(i, centerLat, H / 2);
        beweg.box(tor.q + s * 6, cpos, [rightX(t, i) * w, 0, rightZ(t, i) * w], [0, H / 2, 0], [along[0] * 0.3, 0, along[2] * 0.3]);
        for (let q = 0; q < 6; q++) beweg.color(tor.q + s * 6 + q, q < 2 ? ORANGE : WEISS);
      }
      const lp = P(i, 0, H + 2.1, -0.7);
      const r = 0.45;
      for (let s = 0; s < 2; s++) {
        const o = (s === 0 ? -1 : 1) * 0.6;
        const lx = lp[0] + rightX(t, i) * o;
        const lz = lp[2] + rightZ(t, i) * o;
        glow.set(tor.lamp + s, [lx - rightX(t, i) * r, lp[1] - r, lz - rightZ(t, i) * r], [lx + rightX(t, i) * r, lp[1] - r, lz + rightZ(t, i) * r], [lx + rightX(t, i) * r, lp[1] + r, lz + rightZ(t, i) * r], [lx - rightX(t, i) * r, lp[1] + r, lz - rightZ(t, i) * r]);
      }
      glow.color(tor.lamp, shut ? ROT : ROT_D);
      glow.color(tor.lamp + 1, shut ? GRUEN_D : GRUEN);
    }
    // Raupentransporter
    if (c) {
      crawlerPose(c, time, pose);
      crawler.position.set(pose.x, c.floor, pose.z);
      const ux = c.ux;
      const uz = c.uz;
      const moving = Math.hypot(pose.vx, pose.vz) > 0.05;
      for (let n = 0; n < 4; n++) {
        const su = n & 1 ? 1 : -1;
        const sw = n & 2 ? 1 : -1;
        const bx = pose.x + ux * su * (CRAWLER_HALF - 0.6) - uz * sw * (CRAWLER_HALF_WIDTH - 0.6);
        const bz = pose.z + uz * su * (CRAWLER_HALF - 0.6) + ux * sw * (CRAWLER_HALF_WIDTH - 0.6);
        const by = c.floor + CRAWLER_DECK + 1.5;
        const r = 0.45;
        const a = time * 0.12 + n;
        const ox = Math.cos(a) * r;
        const oz = Math.sin(a) * r;
        glow.set(beacons[n], [bx - ox, by - r, bz - oz], [bx + ox, by - r, bz + oz], [bx + ox, by + r, bz + oz], [bx - ox, by + r, bz - oz]);
        glow.set(beacons[n] + 1, [bx - oz, by - r, bz + ox], [bx + oz, by - r, bz - ox], [bx + oz, by + r, bz - ox], [bx - oz, by + r, bz + ox]);
        const on = moving ? Math.floor(time / 10 + n * 0.5) % 2 === 0 : false;
        glow.color(beacons[n], on ? BERN : rgb(0x6a4a1a));
        glow.color(beacons[n] + 1, on ? BERN : rgb(0x6a4a1a));
      }
    }
    // Schranke am Transporterdach: oben, solange das Tor offen ist; senkt sich beim Schließen in einer Sekunde
    if (schranke && kriechTor) {
      const zu = planActive(kriechTor.plan, time);
      const since = zu ? planSince(kriechTor.plan, time) : time - lastOpen(kriechTor.plan, time);
      const down = zu ? Math.min(1, since / 50) : 1 - Math.min(1, since / 50);
      const ang = (1 - down) * (Math.PI / 2) * 0.95;
      const i = schranke.i;
      const L = t.wh[i] * 2 + 0.6;
      const dir: V3 = [schranke.ax[0] * Math.cos(ang), Math.sin(ang), schranke.ax[2] * Math.cos(ang)];
      const cpos: V3 = [schranke.pivot[0] + dir[0] * (L / 2), schranke.pivot[1] + dir[1] * (L / 2) + 0.4, schranke.pivot[2] + dir[2] * (L / 2)];
      const perp: V3 = [-Math.sin(ang) * schranke.ax[0], Math.cos(ang), -Math.sin(ang) * schranke.ax[2]];
      beweg.box(schranke.q, cpos, [dir[0] * (L / 2), dir[1] * (L / 2), dir[2] * (L / 2)], [perp[0] * 0.22, perp[1] * 0.22, perp[2] * 0.22], [t.tx[i] * 0.12, 0, t.tz[i] * 0.12]);
      for (let q = 0; q < 6; q++) beweg.color(schranke.q + q, q % 2 === 0 ? ROT : WEISS);
      // Lampe und Sekunden bis zum Wechsel an der Stütze
      const lp = P(i, schranke.side * (t.wh[i] + 0.6), 4.4);
      const r = 0.35;
      glow.set(schranke.lamp, [lp[0] - t.tx[i] * r, lp[1] - r, lp[2] - t.tz[i] * r], [lp[0] + t.tx[i] * r, lp[1] - r, lp[2] + t.tz[i] * r], [lp[0] + t.tx[i] * r, lp[1] + r, lp[2] + t.tz[i] * r], [lp[0] - t.tx[i] * r, lp[1] + r, lp[2] - t.tz[i] * r]);
      glow.set(schranke.lamp + 1, [lp[0] - rightX(t, i) * r, lp[1] - r, lp[2] - rightZ(t, i) * r], [lp[0] + rightX(t, i) * r, lp[1] - r, lp[2] + rightZ(t, i) * r], [lp[0] + rightX(t, i) * r, lp[1] + r, lp[2] + rightZ(t, i) * r], [lp[0] - rightX(t, i) * r, lp[1] + r, lp[2] - rightZ(t, i) * r]);
      const col = zu ? ROT : GRUEN;
      glow.color(schranke.lamp, col);
      glow.color(schranke.lamp + 1, col);
      // kleine Ziffern: Sekunden bis zum Wechsel
      const until = zu ? planUntil(kriechTor.plan, time) : remaining(kriechTor.plan, time);
      const secs = Math.min(99, Math.ceil(until / 60));
      const digits = [Math.floor(secs / 10), secs % 10];
      const h = 0.7;
      const m = P(i, schranke.side * (t.wh[i] + 0.6), 3.2, -0.45);
      const rx = rightX(t, i);
      const rz = rightZ(t, i);
      const fxv = -t.tx[i];
      const fzv = -t.tz[i];
      for (let d = 0; d < 2; d++) {
        const ox = (d - 0.5) * h * 0.85;
        for (let s = 0; s < 7; s++) {
          const q = schranke.tafel + d * 7 + s;
          const dw = h * 0.5;
          const th = h * 0.13;
          const box: [number, number, number, number][] = [
            [0, dw, h / 2 - th, h / 2],
            [dw - th, dw, 0, h / 2],
            [dw - th, dw, -h / 2, 0],
            [0, dw, -h / 2, -h / 2 + th],
            [0, th, -h / 2, 0],
            [0, th, 0, h / 2],
            [0, dw, -th / 2, th / 2],
          ];
          const [u0, u1, v0, v1] = box[s];
          const p = (u: number, v: number): V3 => [m[0] + rx * (ox + u - dw / 2) + fxv * 0.05, m[1] + v, m[2] + rz * (ox + u - dw / 2) + fzv * 0.05];
          glow.set(q, p(u0, v0), p(u1, v0), p(u1, v1), p(u0, v1));
          glow.color(q, (SEGS[digits[d]] >> s) & 1 ? (zu ? ZIFFER_ROT : GRUEN) : ZIFFER_AUS);
        }
      }
    }
    glow.posAttr.needsUpdate = true;
    glow.colAttr.needsUpdate = true;
    beweg.posAttr.needsUpdate = true;
    beweg.colAttr.needsUpdate = true;
    (beweg.geo.getAttribute('normal') as THREE.BufferAttribute).needsUpdate = true;

    // --- Teilchen (nur bei stetig laufender Zeit) ---
    if (fx && steady) {
      const cy0 = zyklus(last);
      // Start: Rauchwolke am Sockel und aus der Mündung des Grabens, Funken
      if (cy < cy0) start(fx);
      if (cy < STEIG_BIS && f.visible) {
        // Rauchsäule hinter der steigenden Rakete
        const n = detail ? 3 : 2;
        for (let q = 0; q < n; q++) {
          const s = Math.random();
          fx.puff(
            rocket.position.x - up.x * (3 + s * 8) + (Math.random() - 0.5) * 3,
            rocket.position.y - up.y * (3 + s * 8),
            rocket.position.z + (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 2,
            -2 - Math.random() * 3,
            (Math.random() - 0.5) * 2,
            5 + Math.random() * 4,
            4 + Math.random() * 3 + cy * 0.3,
            Math.random() < 0.5 ? 0xf2efe8 : 0xd8d4cc,
            1.6,
            -0.3,
          );
        }
        if (cy < 4) fx.spark(rocket.position.x, rocket.position.y - 3, rocket.position.z, (Math.random() - 0.5) * 10, -6, (Math.random() - 0.5) * 10, 0.5, 1.6, 0xffd27a, 4);
      }
      // Landung: Staub am Sockel
      if (f.land && f.y < 30 && Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        fx.puff(RAKETE.x + Math.cos(a) * 6, TISCH + 0.5, RAKETE.z + Math.sin(a) * 6, Math.cos(a) * 8, 1, Math.sin(a) * 8, 2.5, 3, 0xe6e1d6, 2.2, -0.2);
      }
      // Im Graben und an der Mündung: Feuerfunken
      if (burn > 0) {
        for (const g of grabenFeuer) {
          if (Math.random() > 0.5) continue;
          const p = P(g.i, (Math.random() - 0.5) * t.wh[g.i], 0.5);
          fx.spark(p[0], p[1], p[2], (Math.random() - 0.5) * 6, 4 + Math.random() * 6, (Math.random() - 0.5) * 6, 0.5, 1.2, Math.random() < 0.5 ? 0xffd27a : 0xff7a2a, 3);
        }
      }
      // Abgasstoß: Staubschleier quer über die Straße, solange er schiebt
      for (const w of t.winds) {
        const k2 = gustStrength(w, time);
        if (k2 <= 0 || Math.random() > k2 * 0.8) continue;
        const i = w.first + Math.floor(Math.random() * w.count);
        const p = P(i, -t.wh[i] * Math.sign(w.push), 0.6);
        const s = w.push * 2.2;
        fx.puff(p[0], p[1], p[2], rightX(t, i) * s, 0.6, rightZ(t, i) * s, 1.2, 2.2, 0xe8e2d4, 2.5, -0.2);
      }
      // Raupentransporter: Staub unter den Ketten, solange er fährt
      if (c && Math.hypot(pose.vx, pose.vz) > 0.5 && Math.random() < 0.35) {
        const su = Math.random() < 0.5 ? -1 : 1;
        const sw = Math.random() < 0.5 ? -1 : 1;
        const x = pose.x + c.ux * su * CRAWLER_LEG_U - c.uz * sw * CRAWLER_LEG_W;
        const z = pose.z + c.uz * su * CRAWLER_LEG_U + c.ux * sw * CRAWLER_LEG_W;
        fx.puff(x, c.floor + 0.3, z, (Math.random() - 0.5) * 1.5, 0.8, (Math.random() - 0.5) * 1.5, 1.4, 1.2, 0xbfb6a2, 1.2, -0.2);
      }
    }
    last = time;
  }

  /** Beim Start: Rauch quillt aus der Mündung des Grabens und rings um den Sockel, Funken fliegen. */
  function start(fx: FxSink): void {
    const n = detail ? 26 : 14;
    for (let q = 0; q < n; q++) {
      const a = Math.random() * Math.PI * 2;
      const s = 5 + Math.random() * 10;
      fx.puff(RAKETE.x + Math.cos(a) * 12, TISCH + 1 + Math.random() * 4, RAKETE.z + Math.sin(a) * 12, Math.cos(a) * s, 1 + Math.random() * 3, Math.sin(a) * s, 5 + Math.random() * 4, 6 + Math.random() * 5, Math.random() < 0.5 ? 0xf4f1ea : 0xd9d5cc, 2.4, -0.4);
    }
    if (graben) {
      // aus der Mündung (letzte Abschnitte des Grabens) nach Osten, über die Straße
      const g = graben.first + graben.count - 30;
      const dir = { x: t.tx[g], z: t.tz[g] };
      for (let q = 0; q < n; q++) {
        const p = P(g, (Math.random() - 0.5) * 6, 1 + Math.random() * 3);
        const s = 12 + Math.random() * 14;
        fx.puff(p[0], p[1], p[2], dir.x * s + (Math.random() - 0.5) * 6, 2 + Math.random() * 4, dir.z * s + (Math.random() - 0.5) * 6, 4 + Math.random() * 3, 5 + Math.random() * 4, Math.random() < 0.6 ? 0xeee9df : 0xc9c3b6, 2.8, -0.5);
        fx.spark(p[0], p[1], p[2], dir.x * s * 1.4, 3 + Math.random() * 5, dir.z * s * 1.4, 0.7, 1.4, Math.random() < 0.5 ? 0xffe08a : 0xff8a3a, 2);
      }
    }
  }

  update(0, null);
  return {
    group,
    update(time: number, _seconds: number, _dt: number, _cam: THREE.Vector3, fx: FxSink): void {
      update(time, fx);
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Rennzeit (Ticks), zu der der Plan zuletzt aufhörte zu gelten (das Tor zuletzt aufging) – höchstens eine Periode zurück. */
function lastOpen(p: { period: number; spans: number[] }, time: number): number {
  if (p.period <= 0 || time <= 0) return -1e9;
  const c = time % p.period;
  let best = -Infinity;
  for (let i = 1; i < p.spans.length; i += 2) {
    const end = p.spans[i];
    const at = end <= c ? end : end - p.period;
    if (at > best) best = at;
  }
  return best === -Infinity ? -1e9 : time - (c - best);
}

/** Ticks, bis ein offenes Tor (Plan gilt nicht) wieder schließt. */
function remaining(p: { period: number; spans: number[] }, time: number): number {
  if (p.period <= 0) return Infinity;
  const c = time <= 0 ? 0 : time % p.period;
  let best = Infinity;
  for (let i = 0; i < p.spans.length; i += 2) {
    const s = p.spans[i];
    best = Math.min(best, s > c ? s - c : s + p.period - c);
  }
  return best;
}


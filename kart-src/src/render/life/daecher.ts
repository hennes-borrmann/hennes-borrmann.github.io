// Kulisse der Dächerjagd: eine Hafenstadt am Hang, am späten Nachmittag eines Festtags.
//
// Was die Strecke trägt (die Häuser unter dem Dachweg, Kirche und Turm, Markthalle, Kaimauern, Brücken, die Straßenbahn)
// zeichnet mechanics/altstadt.ts; hier kommt die Stadt drumherum dazu:
//   – Häuserzeilen an allen Gassen: Fachwerk und bunter Putz, Ziegeldächer, Fenster mit Läden, Gauben, Schornsteine; am
//     Marktplatz Läden mit Markisen. Dahinter Füllhäuser, damit von oben (Kirchturm, Gleitflug) eine Dachlandschaft liegt;
//   – das Rathaus am Markt mit Treppengiebel und Glockenspiel (dessen Figuren drehen sich, wenn die Glocken schlagen),
//     Marktstände mit gestreiften Dächern, ein Brunnen, Linden;
//   – die Stadtmauer mit Türmen über dem Hang (die Bastei an der Kehre zeichnet mechanics/altstadt.ts), dahinter Hügel,
//     im Süden das Meer mit Mole und Leuchtturm, ein Segelschiff am Kai, Boote im Hafen;
//   – Wäscheleinen über den Gassen, Wimpel an den Giebeln;
//   – Bewegtes: Tauben, die um den Kirchturm kreisen, Möwen über dem Hafen, schaukelnde Boote, die Glockenspielfiguren.
//
// Reine Kulisse: kein Haus in einer Fahrbahn (mindestens RAND Meter neben der Bande), nichts unter einem Steg oder Dach der
// Strecke, im Flugkorridor des Gleitflugs alles mindestens LUFT_FLUG Meter unter der Flugbahn. Alles mit festem Zufall aus
// der Strecke abgeleitet; im Lauf wird nichts angelegt. Keine eigenen Shader, keine Lichtquellen.
//
// Zeichenaufrufe (hoch): Häuser und Bauten (Toon) + Kontur, Fassaden (Fenster, Balken), Bewegtes = 4. Niedrig: ohne Kontur
// und mit den Fassaden im selben Netz = 2.

import * as THREE from 'three';
import { EDGE_DECK, EDGE_GAP, EDGE_GLIDE, type Track } from '../../game/track';
import { MeshBuilder, noise, seeded, shade, type RGB, type V3 } from '../build';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';
import { BALKEN, LADEN, PUTZ, ZIEGEL, blockBau, face, hausBau, tri, type Haus } from './altstadtBau';
import { BASTEI, DAUER, HAFEN, LAEUTEN, MARKT, RATHAUS, TURM, polyDist, spots, tramWeg, wasser } from './daecherLand';

/** Mindestabstand eines Hauses zur Bande (Meter) und freier Raum unter der Flugbahn des Gleitflugs. */
const RAND = 1.3;
const LUFT_FLUG = 11;
const TAU = Math.PI * 2;

const C_MAUER = rgb(0xb8a68a);
const C_MAUER_D = rgb(0x9a8a72);
const C_ZINNE = rgb(0xc8b89c);
const C_TURMDACH = rgb(0x8a3e2c);
const C_HUEGEL = [0x8aa060, 0x7a9658, 0x96a868, 0x6e8a58].map(rgb);
const C_WALD = rgb(0x5a7a48);
const C_FELS = rgb(0xa89a82);
const C_LINDE = [0x6a9a48, 0x7aa850, 0x5e8e40].map(rgb);
const C_STAMM = rgb(0x6a5040);
const C_STAND = [0xd84a3a, 0x3a8a5a, 0x3a6ab0, 0xe8a83a, 0x9a4ab0].map(rgb);
const C_WEISS = rgb(0xf6f2e6);
const C_HOLZ = rgb(0x9a6a40);
const C_HOLZ_D = rgb(0x6e4a2c);
const C_OBST = [0xe84a2a, 0xf0c03a, 0x7ab84a, 0xe8822a, 0x9a3a6a].map(rgb);
const C_BRUNNEN = rgb(0xc8bca4);
const C_WASSER = rgb(0x6ab0c8);
const C_GOLD = rgb(0xf2c84a);
const C_SEGEL = rgb(0xf6efe0);
const C_RUMPF = [0x6a3a24, 0x2e4a6a, 0xa83a2e, 0x3a6a4a, 0xe8d8b0].map(rgb);
const C_TAUBE = rgb(0x8a8a9a);
const C_MOEWE = rgb(0xf4f4f0);
const C_WIMPEL = [0xe8402e, 0xf2c83a, 0x3a7ad8, 0x3ab06a, 0xf6f2e6, 0xe86ab0].map(rgb);
const C_WAESCHE = [0xf6f2e6, 0x8ab8e8, 0xe8a0a0, 0xf2d86a, 0xa0d0a0].map(rgb);

export function buildDaecherLife(world: World): Life {
  const t = world.track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const hi = world.detail > 0;
  const rnd = seeded(2424 + t.index * 11);
  const grund = (x: number, z: number): number => world.groundY(x, z);
  const sp = spots(t);
  const w = wasser(t);

  // --- Platz -----------------------------------------------------------------------------------------
  // Fahrbahn in Eimern zu 16 m (jeder Abschnitt)
  const CELL = 16;
  const buckets = new Map<number, number[]>();
  const key = (ix: number, iz: number): number => ix * 4096 + iz;
  for (let k = 0; k < t.total; k++) {
    const kk = key(Math.floor(t.px[k] / CELL), Math.floor(t.pz[k] / CELL));
    let b = buckets.get(kk);
    if (!b) buckets.set(kk, (b = []));
    b.push(k);
  }
  /**
   * Darf ein Körper hier stehen? Mitte (x, z), Halbmesser r, von y0 bis y1. Nicht in einer Fahrbahn, nicht unter oder an
   * einem Steg, Dach oder einer Brücke der Strecke (die Häuser dort baut mechanics/altstadt.ts), unter dem Gleitflug nur weit
   * unter der Flugbahn, nicht im Wasser.
   */
  const frei = (x: number, z: number, r: number, y0: number, y1: number): boolean => {
    const reach = r + 22;
    const i0 = Math.floor((x - reach) / CELL);
    const i1 = Math.floor((x + reach) / CELL);
    const j0 = Math.floor((z - reach) / CELL);
    const j1 = Math.floor((z + reach) / CELL);
    for (let ix = i0; ix <= i1; ix++) {
      for (let iz = j0; iz <= j1; iz++) {
        const b = buckets.get(key(ix, iz));
        if (!b) continue;
        for (const k of b) {
          const e = t.edge[k];
          const d = Math.hypot(x - t.px[k], z - t.pz[k]) - t.wh[k];
          if (e & EDGE_GLIDE) {
            if (d < r + 10 && y1 > t.py[k] - LUFT_FLUG) return false;
            continue;
          }
          if (t.deep[k]) continue;
          if (e & EDGE_DECK) {
            if (d < r + 3.5 && y1 > t.py[k] - 16) return false;
            continue;
          }
          if (d < r + RAND && y1 > t.py[k] - 3 && y0 < t.py[k] + 5) return false;
        }
      }
    }
    if (w.im(x, z, r + 2) || w.kanalRand(x, z) < r + 4) return false;
    // Kaipromenade am Hafen bleibt frei.
    if (polyDist(HAFEN, x, z) < r + 14) return false;
    return true;
  };

  // Freiflächen: Marktplatz (zwischen Markthalle und Umweg), Domplatz, Kirche, Bastei, Rathaus
  const markt = MARKT(t);
  const turm = TURM(t);
  const bastei = BASTEI(t);
  const rathaus = RATHAUS(t);
  const kirche: number[] = [];
  for (let i = sp.at(13.6), n = 0; n < t.n && i !== sp.at(18.6); i = (i + 1) % t.n, n++) if (n % 3 === 0) kirche.push(i);
  const tram = tramWeg(t);
  const platz = (x: number, z: number, r: number): boolean => {
    // Weg der Straßenbahn abseits der Fahrbahn, Remise und Torhaus
    for (const [px, pz] of tram.pts) if (Math.hypot(x - px, z - pz) < r + 4.5) return true;
    for (const b of [tram.remise, tram.torhaus]) if (b && Math.hypot(x - b.x, z - b.z) < r + 14) return true;
    if (polyDist(markt, x, z) < r + 2) return true;
    if (Math.hypot(x - bastei.x, z - bastei.z) < bastei.r + r + 6) return true;
    if (Math.hypot(x - rathaus.x, z - rathaus.z) < 16 + r) return true;
    // Kirche: von der Festrampe bis zum Turm ein Streifen um die Fahrbahn, und der Domplatz davor
    for (const i of kirche) if (Math.hypot(x - t.px[i], z - t.pz[i]) < 22 + r) return true;
    if (Math.hypot(x - turm.x, z - turm.z) < 18 + r) return true;
    return false;
  };

  // Belegte Grundrisse (für die Überdeckungsprüfung): Mitte, Halbachsen, Richtung
  const rects: { x: number; z: number; a: number; b: number; rot: number }[] = [];
  const RG = 24;
  const rgrid = new Map<number, number[]>();
  const addRect = (x: number, z: number, a: number, b: number, rot: number): void => {
    const idx = rects.length;
    rects.push({ x, z, a, b, rot });
    const rr = Math.hypot(a, b);
    for (let ix = Math.floor((x - rr) / RG); ix <= Math.floor((x + rr) / RG); ix++) {
      for (let iz = Math.floor((z - rr) / RG); iz <= Math.floor((z + rr) / RG); iz++) {
        const kk = key(ix, iz);
        let l = rgrid.get(kk);
        if (!l) rgrid.set(kk, (l = []));
        l.push(idx);
      }
    }
  };
  /** Überdeckt das Rechteck (Mitte, Halbachsen a quer, b tief, Richtung rot) ein schon gesetztes? (Trennachsen) */
  const overlaps = (x: number, z: number, a: number, b: number, rot: number): boolean => {
    const rr = Math.hypot(a, b);
    const seen = new Set<number>();
    for (let ix = Math.floor((x - rr) / RG); ix <= Math.floor((x + rr) / RG); ix++) {
      for (let iz = Math.floor((z - rr) / RG); iz <= Math.floor((z + rr) / RG); iz++) {
        for (const idx of rgrid.get(key(ix, iz)) ?? []) {
          if (seen.has(idx)) continue;
          seen.add(idx);
          const o = rects[idx];
          if (Math.hypot(o.x - x, o.z - z) > rr + Math.hypot(o.a, o.b)) continue;
          if (sat(x, z, a, b, rot, o.x, o.z, o.a, o.b, o.rot)) return true;
        }
      }
    }
    return false;
  };

  const body = new MeshBuilder();
  const det = hi ? new MeshBuilder() : body;

  // --- Häuserzeilen an den Gassen ----------------------------------------------------------------------
  // Jede Gasse (Fahrbahn am Boden) entlang, auf beiden Seiten: Haus an Haus, die Front an der Bande.
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length) % a.length];
  let houses = 0;
  const placeHouse = (x: number, z: number, rot: number, wv: number, d: number, h: number, yFront: number, opts: Partial<Haus> = {}): boolean => {
    const fx = Math.sin(rot);
    const fz = Math.cos(rot);
    // Mitte des Grundrisses (die Front liegt bei (x, z), das Haus reicht d nach hinten)
    const cx = x - fx * (d / 2);
    const cz = z - fz * (d / 2);
    const r = Math.max(wv, d) / 2;
    // Boden unter dem Grundriss: tiefste Ecke bestimmt den Sockel
    let low = yFront;
    for (const [u, v] of [
      [-0.5, 0],
      [0.5, 0],
      [-0.5, 1],
      [0.5, 1],
      [0, 0.5],
    ]) {
      const px = x + -fz * u * wv - fx * v * d;
      const pz = z + fx * u * wv - fz * v * d;
      low = Math.min(low, grund(px, pz));
    }
    const top = yFront + h + (opts.giebel ? wv / 2 : d / 2) * (opts.neigung ?? 0.9) + 1.5;
    if (platz(cx, cz, r * 0.8)) return false;
    // Prüfpunkte: Mitte und die vier Ecken (je etwas eingerückt)
    for (const [u, v] of [
      [0, 0.5],
      [-0.42, 0.08],
      [0.42, 0.08],
      [-0.42, 0.92],
      [0.42, 0.92],
    ]) {
      const px = x + -fz * u * wv - fx * v * d;
      const pz = z + fx * u * wv - fz * v * d;
      if (!frei(px, pz, Math.min(wv, d) * 0.12, low - 1, top)) return false;
    }
    if (overlaps(cx, cz, wv / 2 - 0.05, d / 2 - 0.05, rot)) return false;
    addRect(cx, cz, wv / 2, d / 2, rot);
    const fach = rnd() < 0.62;
    const haus: Haus = {
      x,
      z,
      rot,
      w: wv,
      d,
      h,
      y: yFront,
      sockel: yFront - low + 1.2,
      giebel: rnd() < 0.5,
      neigung: 0.85 + rnd() * 0.35,
      putz: fach ? pick(PUTZ.slice(0, 2).concat(PUTZ.slice(8))) : pick(PUTZ),
      balken: pick(BALKEN),
      ziegel: pick(ZIEGEL),
      laden: rnd() < 0.55 ? pick(LADEN) : null,
      fachwerk: fach,
      gaube: rnd() < 0.5,
      kamin: rnd() < 0.7,
      ...opts,
    };
    hausBau(body, det, haus, hi, rnd);
    houses++;
    return true;
  };

  // Gassen: alle Abschnitte am Boden (keine Stege, kein Wasser), je Seite eine Häuserzeile
  const isStreet = (i: number): boolean => (t.edge[i] & (EDGE_DECK | EDGE_GAP | EDGE_GLIDE)) === 0 && !(t.deep[i] && t.py[i] < 0.8);
  const runs: number[][] = [];
  {
    // Hauptstrecke, dann die Abzweigungen
    let cur: number[] = [];
    for (let i = 0; i < t.n; i++) {
      if (isStreet(i)) cur.push(i);
      else if (cur.length) {
        runs.push(cur);
        cur = [];
      }
    }
    if (cur.length) {
      if (runs.length && runs[0][0] === 0) runs[0] = cur.concat(runs[0]);
      else runs.push(cur);
    }
    for (const b of t.branches) {
      cur = [];
      for (let g = b.first; g < b.first + b.count; g++) {
        if (isStreet(g) && t.twin[g] < 0) cur.push(g);
        else if (cur.length) {
          runs.push(cur);
          cur = [];
        }
      }
      if (cur.length) runs.push(cur);
    }
  }
  for (const run of runs) {
    for (const sd of [-1, 1]) {
      let k = 0;
      while (k < run.length) {
        const i = run[k];
        const wv = 6.5 + rnd() * 4;
        const d = 8.5 + rnd() * 4;
        const floors = 2 + Math.floor(rnd() * 3);
        const h = floors * (2.9 + rnd() * 0.3);
        const gap = WALL_GAP + rnd() * 0.6;
        const lat = sd * (t.wh[i] + gap);
        const rx = -t.tz[i];
        const rz = t.tx[i];
        // Die Front liegt an der Bande; die Hausmitte in Längsrichtung eine halbe Breite weiter.
        const j = run[Math.min(run.length - 1, k + Math.round(wv / 2 / t.step))];
        const x = t.px[j] + rx * lat;
        const z = t.pz[j] + rz * lat;
        const rot = Math.atan2(-sd * rx, -sd * rz);
        const yFront = t.py[j] + lat * t.bank[j];
        const ok = placeHouse(x, z, rot, wv, d, h, Math.max(yFront, grund(x, z)));
        k += ok ? Math.max(1, Math.round((wv + 0.15) / t.step)) : 3;
      }
    }
  }

  // --- Füllhäuser: die Dachlandschaft hinter den Gassen -------------------------------------------------
  {
    const cx = world.center.x;
    const cz = world.center.z;
    const R = world.radius + 30;
    let tries = 0;
    let made = 0;
    const want = hi ? 420 : 260;
    while (made < want && tries < want * 14) {
      tries++;
      const x = cx + (rnd() * 2 - 1) * R;
      const z = cz + (rnd() * 2 - 1) * R;
      // nur in der Stadt: innerhalb der Mauer (nördlich des Hafens) und nicht zu weit draußen
      if (polyDist(HAFEN, x, z) < 12) continue;
      if (world.clearance(x, z) > 85) continue;
      // Richtung: wie die nächste Gasse
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < t.total; i += 6) {
        const dd = (x - t.px[i]) ** 2 + (z - t.pz[i]) ** 2;
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      }
      const rot = Math.atan2(t.tx[best], t.tz[best]) + (rnd() < 0.5 ? 0 : Math.PI / 2);
      const wv = 7 + rnd() * 6;
      const d = 8 + rnd() * 5;
      const r = Math.hypot(wv, d) / 2;
      const y = grund(x, z);
      const h = 7 + rnd() * 6;
      if (platz(x, z, r)) continue;
      if (!frei(x, z, r, y - 2, y + h + d * 0.6)) continue;
      if (overlaps(x, z, wv / 2, d / 2, rot)) continue;
      addRect(x, z, wv / 2, d / 2, rot);
      let low = y;
      for (const [u, v] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        low = Math.min(low, grund(x + Math.cos(rot) * u * wv * 0.5 + Math.sin(rot) * v * d * 0.5, z - Math.sin(rot) * u * wv * 0.5 + Math.cos(rot) * v * d * 0.5));
      }
      blockBau(body, x, z, rot, wv, d, low - 1.5, y - low + 1.5 + h, pick(PUTZ), pick(ZIEGEL), 0.8 + rnd() * 0.3);
      made++;
    }
  }

  // --- Marktplatz: Rathaus mit Glockenspiel, Stände, Brunnen, Linden ------------------------------------
  const rh = rathaus;
  {
    // Rathaus: breiter Bau mit Treppengiebel zum Markt, Laubengang unten, Uhr und Glockenspiel im Giebel.
    const fx = Math.sin(rh.rot);
    const fz = Math.cos(rh.rot);
    const ux = -fz;
    const uz = fx;
    const L = (u: number, v: number, y: number): V3 => [rh.x + ux * u - fx * v, y, rh.z + uz * u - fz * v];
    const W = 22;
    const D = 14;
    const H = 13;
    const y0 = rh.y - 3;
    const top = rh.y + H;
    const FR: V3 = [fx, 0, fz];
    const C_RH = rgb(0xe8d0a0);
    const C_RH_D = rgb(0xc8a878);
    face(body, L(-W / 2, 0, y0), L(W / 2, 0, y0), L(W / 2, 0, top), L(-W / 2, 0, top), FR, C_RH);
    face(body, L(-W / 2, D, y0), L(W / 2, D, y0), L(W / 2, D, top), L(-W / 2, D, top), [-fx, 0, -fz], C_RH_D);
    face(body, L(W / 2, 0, y0), L(W / 2, D, y0), L(W / 2, D, top), L(W / 2, 0, top), [ux, 0, uz], C_RH_D);
    face(body, L(-W / 2, 0, y0), L(-W / 2, D, y0), L(-W / 2, D, top), L(-W / 2, 0, top), [-ux, 0, -uz], C_RH_D);
    // Dach (Satteldach, First quer) und Treppengiebel vorn
    const rise = 7;
    face(body, L(-W / 2 - 0.4, -0.3, top), L(-W / 2 - 0.4, D + 0.4, top), L(0, D + 0.4, top + rise), L(0, -0.3, top + rise), [-ux, 1, -uz], ZIEGEL[3]);
    face(body, L(W / 2 + 0.4, -0.3, top), L(W / 2 + 0.4, D + 0.4, top), L(0, D + 0.4, top + rise), L(0, -0.3, top + rise), [ux, 1, uz], shade(ZIEGEL[3], 0.82));
    const steps = 5;
    for (let s = 0; s < steps; s++) {
      const a = -W / 2 + (s * W) / (2 * steps);
      const b2 = W / 2 - (s * W) / (2 * steps);
      const yA = top + (s * (rise + 2)) / steps;
      const yB = top + ((s + 1) * (rise + 2)) / steps;
      face(body, L(a, -0.6, yA), L(b2, -0.6, yA), L(b2, -0.6, yB), L(a, -0.6, yB), FR, C_RH);
      face(body, L(a, -0.6, yB), L(a + W / (2 * steps), -0.6, yB), L(a + W / (2 * steps), 0.4, yB), L(a, 0.4, yB), [0, 1, 0], shade(C_RH, 1.08));
      face(body, L(b2 - W / (2 * steps), -0.6, yB), L(b2, -0.6, yB), L(b2, 0.4, yB), L(b2 - W / (2 * steps), 0.4, yB), [0, 1, 0], shade(C_RH, 1.08));
    }
    // Laubengang: Bögen unten (dunkel), Fensterreihen, Uhr und Glockenspielnische im Giebel
    for (let c = 0; c < 6; c++) {
      const u = -W / 2 + 1.8 + c * ((W - 3.6) / 5);
      face(det, L(u - 1.2, -0.05, rh.y), L(u + 1.2, -0.05, rh.y), L(u + 1.2, -0.05, rh.y + 3), L(u - 1.2, -0.05, rh.y + 3), FR, rgb(0x5a4a3a));
      tri(det, L(u - 1.2, -0.05, rh.y + 3), L(u + 1.2, -0.05, rh.y + 3), L(u, -0.05, rh.y + 4), FR, rgb(0x5a4a3a));
      for (const fy of [6, 9.5]) face(det, L(u - 0.6, -0.05, rh.y + fy), L(u + 0.6, -0.05, rh.y + fy), L(u + 0.6, -0.05, rh.y + fy + 2), L(u - 0.6, -0.05, rh.y + fy + 2), FR, (c + fy) % 2 === 0 ? rgb(0x34405e) : rgb(0x5a6a90));
    }
    const cy = top + 4.2;
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * TAU;
      const a1 = ((k + 1) / 12) * TAU;
      tri(det, L(0, -0.7, cy), L(Math.cos(a0) * 1.4, -0.7, cy + Math.sin(a0) * 1.4), L(Math.cos(a1) * 1.4, -0.7, cy + Math.sin(a1) * 1.4), FR, k % 3 === 0 ? C_GOLD : C_WEISS);
    }
    // Nische des Glockenspiels unter der Uhr
    face(det, L(-2.6, -0.65, top + 0.5), L(2.6, -0.65, top + 0.5), L(2.6, -0.65, top + 2.6), L(-2.6, -0.65, top + 2.6), FR, rgb(0x3a2a20));
    // Glöckchen über der Nische
    for (let k = 0; k < 5; k++) {
      const u = -2 + k;
      face(body, L(u - 0.25, -0.9, top + 2.7), L(u + 0.25, -0.9, top + 2.7), L(u + 0.15, -0.9, top + 3.2), L(u - 0.15, -0.9, top + 3.2), FR, C_GOLD);
    }
    addRect(rh.x - fx * D * 0.5, rh.z - fz * D * 0.5, W / 2, D / 2, rh.rot);
  }
  // Marktstände und Brunnen auf dem Platz (frei von den Fahrbahnen), Linden am Rand
  {
    const box = markt.reduce((a, p) => [Math.min(a[0], p[0]), Math.max(a[1], p[0]), Math.min(a[2], p[1]), Math.max(a[3], p[1])], [Infinity, -Infinity, Infinity, -Infinity]);
    let stalls = 0;
    for (let k = 0; k < 400 && stalls < (hi ? 16 : 10); k++) {
      const x = box[0] + rnd() * (box[1] - box[0]);
      const z = box[2] + rnd() * (box[3] - box[2]);
      if (polyDist(markt, x, z) > -3) continue;
      if (world.clearance(x, z) < 2.6) continue;
      if (overlaps(x, z, 2, 1.6, 0)) continue;
      const y = grund(x, z);
      const rot = Math.round(rnd() * 4) * (Math.PI / 2) + 0.2;
      stand(body, x, z, y, rot, C_STAND[stalls % C_STAND.length], rnd);
      addRect(x, z, 2.2, 1.8, rot);
      stalls++;
    }
    // Brunnen in der Mitte des Platzes
    let bx = 0;
    let bz = 0;
    for (const p of markt) {
      bx += p[0] / markt.length;
      bz += p[1] / markt.length;
    }
    if (world.clearance(bx, bz) > 4 && !overlaps(bx, bz, 3, 3, 0)) {
      const y = grund(bx, bz);
      ring(body, bx, bz, y - 0.5, y + 0.8, 3, 3.4, C_BRUNNEN, 12);
      disc(body, bx, bz, y + 0.55, 3, C_WASSER, 12);
      ring(body, bx, bz, y, y + 4, 0, 0.35, C_BRUNNEN, 6);
      disc(body, bx, bz, y + 2.2, 1.2, C_BRUNNEN, 8);
      ring(body, bx, bz, y + 4, y + 4.8, 0, 0.5, C_GOLD, 6);
      addRect(bx, bz, 3.5, 3.5, 0);
    }
  }
  // Linden: auf den Plätzen am Rand und in Gärten am Hang
  {
    let trees = 0;
    for (let k = 0; k < 1500 && trees < (hi ? 46 : 26); k++) {
      const i = Math.floor(rnd() * t.n);
      if (!isStreet(i)) continue;
      const sd = rnd() < 0.5 ? -1 : 1;
      const lat = sd * (t.wh[i] + 3 + rnd() * 10);
      const x = t.px[i] - t.tz[i] * lat;
      const z = t.pz[i] + t.tx[i] * lat;
      const y = grund(x, z);
      const r = 2.6 + rnd() * 1.4;
      const ht = 7 + rnd() * 3;
      if (!frei(x, z, r, y, y + ht + r)) continue;
      if (overlaps(x, z, r * 0.6, r * 0.6, 0)) continue;
      linde(body, x, z, y, r, ht, rnd);
      addRect(x, z, r * 0.6, r * 0.6, 0);
      trees++;
    }
  }

  // --- Weinberg am Hang unter dem Gleitflug: Rebzeilen quer zum Hang ------------------------------------
  {
    const C_REBE = [rgb(0x5e8a3a), rgb(0x6e9a40), rgb(0x52803a)];
    const C_PFAHL = rgb(0x7a5a3a);
    for (let k = 0; k < t.n; k += 5) {
      if ((t.edge[k] & EDGE_GLIDE) === 0) continue;
      for (let lat = -26; lat <= 26; lat += 3.2) {
        const x = t.px[k] - t.tz[k] * lat;
        const z = t.pz[k] + t.tx[k] * lat;
        const y = grund(x, z);
        if (y > t.py[k] - LUFT_FLUG - 3) continue;
        if (!frei(x, z, 1.8, y - 1, y + 1.6) || platz(x, z, 1.5) || overlaps(x, z, 1.8, 0.4, 0)) continue;
        // Zeile in Fahrtrichtung des Flugs (quer zum Hang), ein Pfahl am Ende
        const rot = Math.atan2(t.tx[k], t.tz[k]);
        body.box(x, y + 0.65, z, 0.7, 1.3, 3.6, C_REBE[(k + Math.round(lat)) % 3], rot);
        body.box(x + t.tx[k] * 1.9, y + 0.8, z + t.tz[k] * 1.9, 0.12, 1.6, 0.12, C_PFAHL, rot);
      }
    }
  }

  // --- Stadtmauer mit Türmen ---------------------------------------------------------------------------
  {
    const M = STADTMAUER(t);
    for (let k = 0; k + 1 < M.length; k++) {
      const [ax, az] = M[k];
      const [bx, bz] = M[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 7));
      for (let s = 0; s < n; s++) {
        const x0 = ax + ((bx - ax) * s) / n;
        const z0 = az + ((bz - az) * s) / n;
        const x1 = ax + ((bx - ax) * (s + 1)) / n;
        const z1 = az + ((bz - az) * (s + 1)) / n;
        const mx = (x0 + x1) / 2;
        const mz = (z0 + z1) / 2;
        const y0 = Math.min(grund(x0, z0), grund(x1, z1)) - 2;
        const yt = Math.max(grund(x0, z0), grund(x1, z1)) + 8.5;
        if (!frei(mx, mz, 1.6, y0, yt + 1.5) || platz(mx, mz, 1)) continue;
        mauerStueck(body, x0, z0, x1, z1, y0, yt, s);
      }
      // Turm an jedem Knick
      const y = grund(ax, az);
      if (frei(ax, az, 4.5, y - 2, y + 18) && !platz(ax, az, 4)) turmBau(body, ax, az, y - 2, y + 13, 4.2, k % 2 === 0);
    }
  }

  // --- Hügel am Horizont und das Meer -----------------------------------------------------------------
  {
    const cx = world.center.x;
    const cz = world.center.z;
    // Hügelkette im Norden, Westen und Osten (im Süden liegt das Meer)
    for (let k = 0; k < (hi ? 40 : 26); k++) {
      const a = Math.PI * (1.02 + (k / ((hi ? 40 : 26) - 1)) * 0.96) + (rnd() - 0.5) * 0.05;
      const R = 520 + rnd() * 160;
      const x = cx + Math.cos(a) * R;
      const z = cz + Math.sin(a) * R * 0.85 - 60;
      const ht = 50 + rnd() * 70 + Math.max(0, -Math.sin(a)) * 40;
      const rr = 110 + rnd() * 90;
      huegel(body, x, z, -4, ht, rr, C_HUEGEL[k % C_HUEGEL.length], rnd);
    }
    // Mole mit Leuchtturm an der Hafeneinfahrt
    const mx0 = 150;
    const mz0 = 218;
    const mx1 = 175;
    const mz1 = 330;
    const ml = Math.hypot(mx1 - mx0, mz1 - mz0);
    const ang = Math.atan2(mx1 - mx0, mz1 - mz0);
    body.box((mx0 + mx1) / 2, -2, (mz0 + mz1) / 2, 9, 8, ml, C_FELS, ang, shade(C_FELS, 1.1));
    ring(body, mx1, mz1, -2, 14, 3.6, 3.0, C_WEISS, 10);
    ring(body, mx1, mz1, 14, 16.5, 2.7, 2.7, rgb(0xd84a3a), 10);
    ring(body, mx1, mz1, 16.5, 19.5, 2.2, 0.2, rgb(0x3a3a44), 10);
    for (const yy of [4, 9]) ring(body, mx1, mz1, yy, yy + 1.8, 3.42, 3.18, rgb(0xd84a3a), 10);
  }

  // --- Wimpelketten an Giebeln über den Gassen und Wäscheleinen ------------------------------------------
  {
    let lines = 0;
    for (let k = 0; k < 900 && lines < (hi ? 26 : 14); k++) {
      const i = Math.floor(rnd() * t.n);
      if (!isStreet(i) || t.wh[i] > 9) continue;
      // nicht über Kurven der Straßenbahn-Oberleitung und nicht am Start (dort hängt die Festkette der Strecke)
      if (Math.abs(i - 0) < 30 || Math.abs(i - t.n) < 30) continue;
      const rx = -t.tz[i];
      const rz = t.tx[i];
      const L = t.wh[i] + 2.2;
      const ya = t.py[i] + 7.2 + rnd() * 1.5;
      const a: V3 = [t.px[i] - rx * L, ya, t.pz[i] - rz * L];
      const b2: V3 = [t.px[i] + rx * L, ya + (rnd() - 0.5), t.pz[i] + rz * L];
      // Häuser auf beiden Seiten? (sonst hinge die Leine in der Luft)
      if (!overlaps(a[0] - rx * 2, a[2] - rz * 2, 0.5, 0.5, 0) || !overlaps(b2[0] + rx * 2, b2[2] + rz * 2, 0.5, 0.5, 0)) continue;
      if (rnd() < 0.55) wimpelkette(det, a, b2, 1.2, rnd);
      else waescheleine(det, a, b2, rnd);
      lines++;
    }
  }

  // --- Netze ----------------------------------------------------------------------------------------------
  const bodyGeo = body.build();
  const bodyMat = toonMaterial({ vertexColors: true });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.name = 'Altstadt';
  group.add(bodyMesh);
  disposables.push(bodyGeo, bodyMat);
  if (hi) {
    addSmoothNormals(bodyGeo);
    const ol = new THREE.Mesh(bodyGeo, outlineMaterial(0.045));
    ol.name = 'outline';
    group.add(ol);
    const detGeo = det.build();
    const detMat = toonMaterial({ vertexColors: true });
    const detMesh = new THREE.Mesh(detGeo, detMat);
    detMesh.name = 'Fassaden';
    group.add(detMesh);
    disposables.push(detGeo, detMat);
  }

  // --- Bewegtes: Tauben, Möwen, Boote, Glockenspielfiguren – je Bild neu geschrieben -----------------------
  const MAXV = 3 * 2600;
  const pos = new Float32Array(MAXV * 3);
  const col = new Float32Array(MAXV * 3);
  const dynGeo = new THREE.BufferGeometry();
  const pa = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const ca = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
  dynGeo.setAttribute('position', pa);
  dynGeo.setAttribute('color', ca);
  dynGeo.setDrawRange(0, 0);
  dynGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const dynMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const dynMesh = new THREE.Mesh(dynGeo, dynMat);
  dynMesh.frustumCulled = false;
  dynMesh.name = 'Tauben und Boote';
  group.add(dynMesh);
  disposables.push(dynGeo, dynMat);
  let nv = 0;
  const T3 = (a: V3, b2: V3, c: V3, cl: RGB): void => {
    if (nv + 3 > MAXV) return;
    for (const p of [a, b2, c]) {
      pos[nv * 3] = p[0];
      pos[nv * 3 + 1] = p[1];
      pos[nv * 3 + 2] = p[2];
      col[nv * 3] = cl[0];
      col[nv * 3 + 1] = cl[1];
      col[nv * 3 + 2] = cl[2];
      nv++;
    }
  };

  // Tauben um den Kirchturm und über dem Markt, Möwen über dem Hafen
  const voegel: { x: number; z: number; y: number; r: number; w: number; ph: number; c: RGB; s: number }[] = [];
  for (let k = 0; k < (hi ? 22 : 12); k++) {
    const atMarkt = k % 3 === 2;
    const cx = atMarkt ? rh.x : turm.x;
    const cz = atMarkt ? rh.z + 30 : turm.z;
    voegel.push({ x: cx + (rnd() - 0.5) * 20, z: cz + (rnd() - 0.5) * 20, y: (atMarkt ? rh.y + 22 : turm.y + 20) + rnd() * 10, r: 14 + rnd() * 18, w: (0.35 + rnd() * 0.25) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * TAU, c: C_TAUBE, s: 0.7 });
  }
  for (let k = 0; k < (hi ? 10 : 6); k++) voegel.push({ x: -20 + (rnd() - 0.5) * 160, z: 250 + rnd() * 90, y: 14 + rnd() * 14, r: 20 + rnd() * 30, w: (0.2 + rnd() * 0.15) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * TAU, c: C_MOEWE, s: 1.1 });

  // Boote: im Hafen und im Kanal (auf dem Wasser – wer taucht, fährt darunter hindurch), nicht am Slip und an der Treppe
  const boote: { x: number; z: number; rot: number; L: number; c: RGB; ph: number; mast: boolean }[] = [];
  {
    for (let k = 0; k < 400 && boote.length < (hi ? 16 : 10); k++) {
      let x: number;
      let z: number;
      let rot: number;
      if (k % 3 === 0 && w.kanal.length > 10) {
        // im Kanal, an der Kaimauer vertäut
        const i = w.kanal[5 + Math.floor(rnd() * (w.kanal.length - 10))];
        const sd = rnd() < 0.5 ? -1 : 1;
        const lat = sd * (w.breite - 2.2);
        x = t.px[i] - t.tz[i] * lat;
        z = t.pz[i] + t.tx[i] * lat;
        rot = Math.atan2(t.tx[i], t.tz[i]);
      } else {
        x = -100 + rnd() * 260;
        z = 222 + rnd() * 70;
        rot = rnd() * TAU;
        if (polyDist(HAFEN, x, z) > -4) continue;
      }
      // nicht über der Tauchstrecke dicht am Ein- und Ausstieg
      let nearRoad = Infinity;
      for (let i = 0; i < t.n; i += 2) {
        if (!t.deep[i] || t.py[i] > -1.5) {
          if (t.deep[i] || (t.edge[i] & EDGE_DECK) === 0) nearRoad = Math.min(nearRoad, Math.hypot(x - t.px[i], z - t.pz[i]) - t.wh[i]);
        }
      }
      if (nearRoad < 9) continue;
      if (boote.some((b) => Math.hypot(b.x - x, b.z - z) < 8)) continue;
      boote.push({ x, z, rot, L: 4.5 + rnd() * 3, c: pick(C_RUMPF), ph: rnd() * TAU, mast: rnd() < 0.4 });
    }
  }

  return {
    group,
    update(time, _dt, cam, _fx, raceTime) {
      nv = 0;
      for (const b of voegel) {
        const a = b.ph + time * b.w;
        const x = b.x + Math.cos(a) * b.r;
        const z = b.z + Math.sin(a) * b.r;
        if (Math.hypot(x - cam.x, z - cam.z) > 320) continue;
        const y = b.y + Math.sin(time * 0.8 + b.ph) * 2;
        const hx = -Math.sin(a) * Math.sign(b.w);
        const hz = Math.cos(a) * Math.sign(b.w);
        const flap = Math.sin(time * 10 + b.ph) * 0.7 * b.s;
        const W = 1.2 * b.s;
        T3([x + hx * 0.5 * b.s, y, z + hz * 0.5 * b.s], [x - hx * 0.3 * b.s + hz * W, y + flap, z - hz * 0.3 * b.s - hx * W], [x - hx * 0.45 * b.s, y, z - hz * 0.45 * b.s], b.c);
        T3([x + hx * 0.5 * b.s, y, z + hz * 0.5 * b.s], [x - hx * 0.45 * b.s, y, z - hz * 0.45 * b.s], [x - hx * 0.3 * b.s - hz * W, y + flap, z - hz * 0.3 * b.s + hx * W], b.c);
      }
      for (const b of boote) {
        if (Math.hypot(b.x - cam.x, b.z - cam.z) > 260) continue;
        const bob = Math.sin(time * 1.3 + b.ph) * 0.12;
        const roll = Math.sin(time * 0.9 + b.ph * 2) * 0.06;
        bootBau(T3, b.x, 0.05 + bob, b.z, b.rot, b.L, roll, b.c, b.mast);
      }
      // Glockenspiel: Alle LAEUTEN s Rennzeit läuten die Glocken – dann ziehen die Figuren DAUER s lang im Kreis durch die Nische.
      const rt = raceTime ?? time * 60;
      const c = (((rt / 60) % LAEUTEN) + LAEUTEN) % LAEUTEN;
      if (Math.hypot(rh.x - cam.x, rh.z - cam.z) < 220) {
        const fx = Math.sin(rh.rot);
        const fz = Math.cos(rh.rot);
        const ux = -fz;
        const uz = fx;
        const spin = rt > 0 && c < DAUER ? c * 1.1 : 0;
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + spin;
          const u = Math.sin(a) * 1.9;
          const v = -1.3 - Math.cos(a) * 0.6;
          const x = rh.x + ux * u - fx * v;
          const z = rh.z + uz * u - fz * v;
          const y = rh.y + 13.5;
          figur(T3, x, y, z, C_STAND[k], C_WEISS);
        }
      }
      dynGeo.setDrawRange(0, nv);
      if (nv > 0) {
        pa.clearUpdateRanges();
        pa.addUpdateRange(0, nv * 3);
        pa.needsUpdate = true;
        ca.clearUpdateRanges();
        ca.addUpdateRange(0, nv * 3);
        ca.needsUpdate = true;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Abstand der Hausfront von der Fahrbahnkante (Bande, Gehweg). */
const WALL_GAP = 1.4;

/** Stadtmauer: Linienzug über den Hang (Weltkoordinaten), von der Bastei im Osten über den Domberg nach Westen. */
function STADTMAUER(t: Track): [number, number][] {
  const b = BASTEI(t);
  return [
    [b.x + 20, b.z + 40],
    [b.x + 28, b.z - 10],
    [b.x + 12, b.z - 58],
    [160, -120],
    [110, -196],
    [40, -222],
    [-40, -224],
    [-110, -206],
    [-176, -168],
    [-236, -116],
    [-268, -40],
    [-276, 40],
    [-252, 110],
    [-212, 160],
  ];
}

/** Trennachsen-Test zweier gedrehter Rechtecke (Mitte, Halbachsen a quer, b längs der Blickrichtung rot). */
function sat(x1: number, z1: number, a1: number, b1: number, r1: number, x2: number, z2: number, a2: number, b2: number, r2: number): boolean {
  const axes = [
    [Math.cos(r1), -Math.sin(r1)],
    [Math.sin(r1), Math.cos(r1)],
    [Math.cos(r2), -Math.sin(r2)],
    [Math.sin(r2), Math.cos(r2)],
  ];
  const corners = (x: number, z: number, a: number, b: number, r: number): number[][] => {
    const ux = Math.cos(r);
    const uz = -Math.sin(r);
    const vx = Math.sin(r);
    const vz = Math.cos(r);
    return [
      [x + ux * a + vx * b, z + uz * a + vz * b],
      [x - ux * a + vx * b, z - uz * a + vz * b],
      [x - ux * a - vx * b, z - uz * a - vz * b],
      [x + ux * a - vx * b, z + uz * a - vz * b],
    ];
  };
  const c1 = corners(x1, z1, a1, b1, r1);
  const c2 = corners(x2, z2, a2, b2, r2);
  for (const [ax, az] of axes) {
    let min1 = Infinity;
    let max1 = -Infinity;
    let min2 = Infinity;
    let max2 = -Infinity;
    for (const [x, z] of c1) {
      const p = x * ax + z * az;
      min1 = Math.min(min1, p);
      max1 = Math.max(max1, p);
    }
    for (const [x, z] of c2) {
      const p = x * ax + z * az;
      min2 = Math.min(min2, p);
      max2 = Math.max(max2, p);
    }
    if (max1 < min2 || max2 < min1) return false;
  }
  return true;
}

/** Senkrechter Ring (Zylindermantel) um (x, z) von y0 bis y1, Halbmesser unten r0, oben r1. r0 = 0: Stab mit r1. */
function ring(b: MeshBuilder, x: number, z: number, y0: number, y1: number, r0: number, r1: number, c: RGB, n: number): void {
  const ra = r0 === 0 ? r1 : r0;
  const rb = r1;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * TAU;
    const a1 = ((k + 1) / n) * TAU;
    const p0: V3 = [x + Math.cos(a0) * ra, y0, z + Math.sin(a0) * ra];
    const p1: V3 = [x + Math.cos(a1) * ra, y0, z + Math.sin(a1) * ra];
    const q1: V3 = [x + Math.cos(a1) * rb, y1, z + Math.sin(a1) * rb];
    const q0: V3 = [x + Math.cos(a0) * rb, y1, z + Math.sin(a0) * rb];
    face(b, p0, p1, q1, q0, [Math.cos((a0 + a1) / 2), 0.2, Math.sin((a0 + a1) / 2)], k % 2 === 0 ? c : shade(c, 0.92));
  }
}

/** Waagerechte Scheibe. */
function disc(b: MeshBuilder, x: number, z: number, y: number, r: number, c: RGB, n: number): void {
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * TAU;
    const a1 = ((k + 1) / n) * TAU;
    tri(b, [x, y, z], [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], [0, 1, 0], c);
  }
}

/** Marktstand: Tisch mit Obst, vier Pfosten, gestreiftes Satteldach. */
function stand(b: MeshBuilder, x: number, z: number, y: number, rot: number, c: RGB, rnd: () => number): void {
  const fx = Math.sin(rot);
  const fz = Math.cos(rot);
  const L = (u: number, v: number, yy: number): V3 => [x - fz * u + fx * v, yy, z + fx * u + fz * v];
  b.box(x, y + 0.45, z, 3.4, 0.9, 2.2, C_HOLZ, rot);
  for (let k = 0; k < 6; k++) {
    const u = -1.4 + (k % 3) * 1.4;
    const v = k < 3 ? -0.5 : 0.5;
    const p = L(u, v, y + 1.05);
    b.box(p[0], p[1], p[2], 0.9, 0.3, 0.8, C_OBST[Math.floor(rnd() * C_OBST.length)], rot);
  }
  for (const [u, v] of [
    [-1.6, -1],
    [1.6, -1],
    [1.6, 1],
    [-1.6, 1],
  ]) {
    const p = L(u, v, y);
    b.box(p[0], y + 1.25, p[2], 0.12, 2.5, 0.12, C_HOLZ_D, rot);
  }
  const n = 6;
  for (let k = 0; k < n; k++) {
    const u0 = -1.9 + (3.8 * k) / n;
    const u1 = -1.9 + (3.8 * (k + 1)) / n;
    const cc = k % 2 === 0 ? c : C_WEISS;
    face(b, L(u0, -1.3, y + 2.4), L(u1, -1.3, y + 2.4), L(u1, 0, y + 3.1), L(u0, 0, y + 3.1), [fx * -0.5, 1, fz * -0.5], cc);
    face(b, L(u0, 1.3, y + 2.4), L(u1, 1.3, y + 2.4), L(u1, 0, y + 3.1), L(u0, 0, y + 3.1), [fx * 0.5, 1, fz * 0.5], cc);
  }
}

/** Linde: Stamm und eine runde Krone aus drei Ballen. */
function linde(b: MeshBuilder, x: number, z: number, y: number, r: number, h: number, rnd: () => number): void {
  ring(b, x, z, y - 0.5, y + h * 0.55, 0.42, 0.3, C_STAMM, 5);
  const c = C_LINDE[Math.floor(rnd() * C_LINDE.length)];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + rnd();
    ballen(b, x + Math.cos(a) * r * 0.35, y + h * 0.62 + k * r * 0.25, z + Math.sin(a) * r * 0.35, r * (0.8 - k * 0.08), k === 2 ? shade(c, 1.08) : c);
  }
}

/** Ballen (achteckiger Doppelkegel – ein grobes Laubbündel). */
function ballen(b: MeshBuilder, x: number, y: number, z: number, r: number, c: RGB): void {
  const n = 7;
  const top: V3 = [x, y + r * 0.85, z];
  const bot: V3 = [x, y - r * 0.7, z];
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * TAU;
    const a1 = ((k + 1) / n) * TAU;
    const p0: V3 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r];
    const p1: V3 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
    const o: V3 = [Math.cos((a0 + a1) / 2), 0.5, Math.sin((a0 + a1) / 2)];
    tri(b, p0, p1, top, o, shade(c, 1.05));
    tri(b, p0, p1, bot, [o[0], -0.5, o[2]], shade(c, 0.8));
  }
}

/** Ein Stück Stadtmauer mit Wehrgang und Zinnen. */
function mauerStueck(b: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y0: number, yt: number, s: number): void {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const l = Math.hypot(dx, dz);
  const nx = -dz / l;
  const nz = dx / l;
  const T = 1.2;
  const P = (x: number, z: number, o: number, y: number): V3 => [x + nx * o, y, z + nz * o];
  face(b, P(x0, z0, T, y0), P(x1, z1, T, y0), P(x1, z1, T, yt), P(x0, z0, T, yt), [nx, 0, nz], C_MAUER);
  face(b, P(x0, z0, -T, y0), P(x1, z1, -T, y0), P(x1, z1, -T, yt), P(x0, z0, -T, yt), [-nx, 0, -nz], C_MAUER_D);
  face(b, P(x0, z0, -T, yt), P(x1, z1, -T, yt), P(x1, z1, T, yt), P(x0, z0, T, yt), [0, 1, 0], C_ZINNE);
  // Zinnen außen
  const n = Math.max(1, Math.round(l / 2.4));
  for (let k = 0; k < n; k += 2) {
    const a = k / n;
    const c = Math.min(1, (k + 1) / n);
    const ax = x0 + dx * a;
    const az = z0 + dz * a;
    const cx = x0 + dx * c;
    const cz = z0 + dz * c;
    face(b, P(ax, az, T, yt), P(cx, cz, T, yt), P(cx, cz, T, yt + 1.3), P(ax, az, T, yt + 1.3), [nx, 0, nz], s % 2 === 0 ? C_ZINNE : C_MAUER);
    face(b, P(ax, az, T - 0.7, yt + 1.3), P(cx, cz, T - 0.7, yt + 1.3), P(cx, cz, T, yt + 1.3), P(ax, az, T, yt + 1.3), [0, 1, 0], C_ZINNE);
    face(b, P(ax, az, T - 0.7, yt), P(cx, cz, T - 0.7, yt), P(cx, cz, T - 0.7, yt + 1.3), P(ax, az, T - 0.7, yt + 1.3), [-nx, 0, -nz], C_MAUER_D);
  }
}

/** Mauerturm: runder Turm mit Kegeldach (spitz) oder Zinnenkranz. */
function turmBau(b: MeshBuilder, x: number, z: number, y0: number, y1: number, r: number, spitz: boolean): void {
  ring(b, x, z, y0, y1, r, r, C_MAUER, 10);
  if (spitz) {
    for (let k = 0; k < 10; k++) {
      const a0 = (k / 10) * TAU;
      const a1 = ((k + 1) / 10) * TAU;
      tri(b, [x + Math.cos(a0) * (r + 0.6), y1, z + Math.sin(a0) * (r + 0.6)], [x + Math.cos(a1) * (r + 0.6), y1, z + Math.sin(a1) * (r + 0.6)], [x, y1 + r * 1.9, z], [Math.cos(a0), 0.6, Math.sin(a0)], k % 2 ? C_TURMDACH : shade(C_TURMDACH, 0.9));
    }
  } else {
    disc(b, x, z, y1, r, C_ZINNE, 10);
    for (let k = 0; k < 10; k += 2) {
      const a0 = (k / 10) * TAU;
      const a1 = ((k + 1) / 10) * TAU;
      face(b, [x + Math.cos(a0) * r, y1, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y1, z + Math.sin(a1) * r], [x + Math.cos(a1) * r, y1 + 1.4, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y1 + 1.4, z + Math.sin(a0) * r], [Math.cos(a0), 0, Math.sin(a0)], C_ZINNE);
    }
  }
}

/** Hügel am Horizont: flacher Kegel mit Wald auf der Kuppe (weit weg, wenige Flächen). */
function huegel(b: MeshBuilder, x: number, z: number, y: number, h: number, r: number, c: RGB, rnd: () => number): void {
  const n = 9;
  const top: V3 = [x + (rnd() - 0.5) * r * 0.3, y + h, z + (rnd() - 0.5) * r * 0.3];
  const mid: V3[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    const rr = r * (0.42 + noise(x * 0.01 + k, z * 0.01) * 0.25);
    mid.push([x + Math.cos(a) * rr, y + h * (0.55 + rnd() * 0.15), z + Math.sin(a) * rr]);
  }
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * TAU;
    const a1 = ((k + 1) / n) * TAU;
    const p0: V3 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r];
    const p1: V3 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
    const m0 = mid[k];
    const m1 = mid[(k + 1) % n];
    const o: V3 = [Math.cos((a0 + a1) / 2), 0.6, Math.sin((a0 + a1) / 2)];
    face(b, p0, p1, m1, m0, o, k % 2 ? c : shade(c, 0.94));
    tri(b, m0, m1, top, [o[0], 1.4, o[2]], k % 3 === 0 ? C_WALD : shade(c, 0.88));
  }
}

/** Wimpelkette zwischen a und b, durchhängend. */
function wimpelkette(b: MeshBuilder, a: V3, c: V3, sag: number, rnd: () => number): void {
  const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
  const n = Math.max(4, Math.round(len / 1.1));
  const dx = (c[0] - a[0]) / len;
  const dz = (c[2] - a[2]) / len;
  const off = Math.floor(rnd() * C_WIMPEL.length);
  const at = (k: number): V3 => {
    const u = k / n;
    return [a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u - sag * 4 * u * (1 - u), a[2] + (c[2] - a[2]) * u];
  };
  for (let k = 0; k < n; k++) {
    const p = at(k);
    const q = at(k + 1);
    // Schnur
    face(b, p, q, [q[0], q[1] - 0.05, q[2]], [p[0], p[1] - 0.05, p[2]], [-dz, 0, dx], C_HOLZ_D);
    // Wimpel: Dreieck nach unten
    const m: V3 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 0.85, (p[2] + q[2]) / 2];
    b.tri(p, q, m, C_WIMPEL[(k + off) % C_WIMPEL.length]);
    b.tri(p, m, q, C_WIMPEL[(k + off) % C_WIMPEL.length]);
  }
}

/** Wäscheleine zwischen a und b mit ein paar Stücken Wäsche. */
function waescheleine(b: MeshBuilder, a: V3, c: V3, rnd: () => number): void {
  const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
  const dx = (c[0] - a[0]) / len;
  const dz = (c[2] - a[2]) / len;
  const at = (u: number): V3 => [a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u - 0.7 * 4 * u * (1 - u), a[2] + (c[2] - a[2]) * u];
  const n = 8;
  for (let k = 0; k < n; k++) {
    const p = at(k / n);
    const q = at((k + 1) / n);
    face(b, p, q, [q[0], q[1] - 0.04, q[2]], [p[0], p[1] - 0.04, p[2]], [-dz, 0, dx], C_WEISS);
  }
  for (let k = 1; k < 7; k++) {
    if (rnd() < 0.3) continue;
    const u = k / 7;
    const p = at(u);
    const wv = 0.5 + rnd() * 0.5;
    const h = 0.6 + rnd() * 0.6;
    const cc = C_WAESCHE[Math.floor(rnd() * C_WAESCHE.length)];
    const p0: V3 = [p[0] - dx * wv * 0.5, p[1], p[2] - dz * wv * 0.5];
    const p1: V3 = [p[0] + dx * wv * 0.5, p[1], p[2] + dz * wv * 0.5];
    b.quad(p0, p1, [p1[0], p1[1] - h, p1[2]], [p0[0], p0[1] - h, p0[2]], cc);
    b.quad(p1, p0, [p0[0], p0[1] - h, p0[2]], [p1[0], p1[1] - h, p1[2]], cc);
  }
}

/** Boot (Rumpf als Keil, Ruderbank; mit Mast und Segel), für das Bewegte. */
function bootBau(T3: (a: V3, b: V3, c: V3, cl: RGB) => void, x: number, y: number, z: number, rot: number, L: number, roll: number, c: RGB, mast: boolean): void {
  const fx = Math.sin(rot);
  const fz = Math.cos(rot);
  const ux = -fz;
  const uz = fx;
  const W = L * 0.22;
  const P = (u: number, v: number, h: number): V3 => [x + ux * u + fx * v, y + h + u * roll, z + uz * u + fz * v];
  const bow = P(0, L / 2, 0.55);
  const kiel = P(0, 0, -0.5);
  const sl = P(-W, -L / 2, 0.45);
  const sr = P(W, -L / 2, 0.45);
  const ml = P(-W, 0, 0.5);
  const mr = P(W, 0, 0.5);
  const kh = P(0, -L / 2, -0.3);
  T3(bow, ml, kiel, c);
  T3(bow, kiel, mr, shade(c, 0.85));
  T3(ml, sl, kh, c);
  T3(ml, kh, kiel, c);
  T3(mr, kh, sr, shade(c, 0.85));
  T3(mr, kiel, kh, shade(c, 0.85));
  T3(sl, sr, kh, shade(c, 0.7));
  // Deck
  T3(bow, mr, ml, C_HOLZ);
  T3(ml, mr, sr, C_HOLZ);
  T3(ml, sr, sl, C_HOLZ);
  if (mast) {
    const m0 = P(0, L * 0.08, 0.5);
    const m1 = P(0, L * 0.08, 0.5 + L * 1.1);
    T3(m0, P(0.06, L * 0.08, 0.5), m1, C_HOLZ_D);
    T3(m1, P(0, -L * 0.35, 0.9), P(0, L * 0.06, 1.0), C_SEGEL);
  }
}

/** Glockenspielfigur: kleiner Körper mit Kopf (für das Bewegte). */
function figur(T3: (a: V3, b: V3, c: V3, cl: RGB) => void, x: number, y: number, z: number, c: RGB, kopf: RGB): void {
  T3([x - 0.35, y, z], [x + 0.35, y, z], [x, y + 1.1, z], c);
  T3([x, y, z - 0.35], [x, y, z + 0.35], [x, y + 1.1, z], c);
  T3([x - 0.22, y + 1.05, z], [x + 0.22, y + 1.05, z], [x, y + 1.5, z], kopf);
  T3([x, y + 1.05, z - 0.22], [x, y + 1.05, z + 0.22], [x, y + 1.5, z], kopf);
}


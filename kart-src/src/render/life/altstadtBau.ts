// Dächerjagd: Baukasten für die Häuser der Altstadt – Fachwerk und Putz, Ziegeldächer, Fenster mit Läden, Gauben und
// Schornsteine. Die Kulisse (life/daecher.ts) stellt damit die Häuserzeilen an die Gassen; die Häuser unter dem Dachweg
// der Strecke baut mechanics/altstadt.ts selbst (deren First ist die Fahrbahn), mit denselben Farben und Fassaden.
//
// Ein Haus besteht aus zwei Teilen: dem Körper (Wände, Dach, Schornstein – bekommt eine Tuschekontur) und den Einzelheiten
// auf den Wänden (Fenster, Balken, Türen – flach davor, ohne Kontur, sonst würde jedes Fenster umrandet).

import { MeshBuilder, shade, type RGB, type V3 } from '../build';
import { rgb } from '../toon';

export const PUTZ: RGB[] = [0xf4e8cc, 0xf6f0e2, 0xecc87e, 0xeab8a2, 0xbcd0e2, 0xc8dcc0, 0xeca07e, 0xf2da7c, 0xe6d2b0, 0xd8b8d8].map(rgb);
export const BALKEN: RGB[] = [0x5a3a2a, 0x7a2e24, 0x34333c, 0x6a4a30].map(rgb);
export const ZIEGEL: RGB[] = [0xc4583a, 0xb04a30, 0xd06a44, 0x9e4632, 0xb85a3a].map(rgb);
export const SCHIEFER = rgb(0x4e5464);
export const SOCKEL = rgb(0x9a9080);
export const GLAS = rgb(0x34405e);
export const GLAS_HELL = rgb(0x6a7aa0);
export const RAHMEN = rgb(0xf6f2e6);
export const LADEN: RGB[] = [0x3e7a4a, 0x3a5a8a, 0xa83a2e, 0x6a5a2a].map(rgb);
export const TUER = rgb(0x6a4428);
export const KAMIN = rgb(0xa86a50);
export const KAMIN_KOPF = rgb(0x5a4038);

/** Ein Haus: Mitte der Vorderkante (x, z), Blickrichtung der Front (rot: Winkel wie Fahrtrichtung, atan2(dx, dz)). */
export interface Haus {
  x: number;
  z: number;
  /** Richtung, in die die Front schaut (Normale der Front, als atan2(nx, nz)). */
  rot: number;
  /** Breite der Front, Tiefe, Höhe bis zur Traufe (ab Boden). */
  w: number;
  d: number;
  h: number;
  /** Boden an der Front (y) und wie weit der Sockel darunter reicht (Hanglage). */
  y: number;
  sockel: number;
  /** true: der Giebel zeigt zur Gasse (First quer zur Gasse), sonst die Traufe. */
  giebel: boolean;
  /** Dachneigung (Steigung, 1 = 45°). */
  neigung: number;
  putz: RGB;
  balken: RGB;
  ziegel: RGB;
  laden: RGB | null;
  fachwerk: boolean;
  gaube: boolean;
  kamin: boolean;
  /** Erdgeschoss als Laden mit Markise (Farbe) – nur an Plätzen. */
  markise?: RGB;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Viereck a-b-c-d, sichtbar von der Seite out (Dreiecke werden passend gedreht). */
export function face(b: MeshBuilder, a: V3, p: V3, c: V3, d: V3, out: V3, col: RGB): void {
  if (dot(cross(sub(p, a), sub(c, a)), out) >= 0) b.quad(a, p, c, d, col);
  else b.quad(a, d, c, p, col);
}

/** Dreieck, sichtbar von der Seite out. */
export function tri(b: MeshBuilder, a: V3, p: V3, c: V3, out: V3, col: RGB): void {
  if (dot(cross(sub(p, a), sub(c, a)), out) >= 0) b.tri(a, p, c, col);
  else b.tri(a, c, p, col);
}

/** Höhe des Firsts über der Traufe. */
export function firstHoehe(h: Haus): number {
  return ((h.giebel ? h.w : h.d) / 2) * h.neigung;
}

/**
 * Ein Haus bauen. body: Körper (mit Kontur), det: Einzelheiten auf den Wänden (ohne Kontur); hi = volle Qualität
 * (Fachwerk, Läden, Gauben). rnd: fester Zufall.
 */
export function hausBau(body: MeshBuilder, det: MeshBuilder, h: Haus, hi: boolean, rnd: () => number): void {
  const fx = Math.sin(h.rot);
  const fz = Math.cos(h.rot);
  // Lokale Achsen: u nach rechts (von der Gasse aus gesehen), v nach hinten (weg von der Gasse), y nach oben.
  const ux = -fz;
  const uz = fx;
  const vx = -fx;
  const vz = -fz;
  const L = (u: number, v: number, y: number): V3 => [h.x + ux * u + vx * v, y, h.z + uz * u + vz * v];
  const hw = h.w / 2;
  const y0 = h.y - h.sockel;
  const yE = h.y + h.h;
  const rise = firstHoehe(h);
  const yF = yE + rise;
  const over = 0.45;
  const FRONT: V3 = [fx, 0, fz];
  const BACK: V3 = [-fx, 0, -fz];
  const RIGHT: V3 = [ux, 0, uz];
  const LEFT: V3 = [-ux, 0, -uz];
  const wallC = h.putz;
  const sideC = shade(h.putz, 0.9);
  // Sockel (Naturstein) bis 0,6 m über dem Boden an der Front
  const yS = h.y + 0.6;
  face(body, L(-hw, 0, y0), L(hw, 0, y0), L(hw, 0, yS), L(-hw, 0, yS), FRONT, SOCKEL);
  face(body, L(-hw, h.d, y0), L(hw, h.d, y0), L(hw, h.d, yS), L(-hw, h.d, yS), BACK, shade(SOCKEL, 0.9));
  face(body, L(hw, 0, y0), L(hw, h.d, y0), L(hw, h.d, yS), L(hw, 0, yS), RIGHT, shade(SOCKEL, 0.95));
  face(body, L(-hw, 0, y0), L(-hw, h.d, y0), L(-hw, h.d, yS), L(-hw, 0, yS), LEFT, shade(SOCKEL, 0.95));
  // Wände bis zur Traufe
  face(body, L(-hw, 0, yS), L(hw, 0, yS), L(hw, 0, yE), L(-hw, 0, yE), FRONT, wallC);
  face(body, L(-hw, h.d, yS), L(hw, h.d, yS), L(hw, h.d, yE), L(-hw, h.d, yE), BACK, shade(wallC, 0.86));
  face(body, L(hw, 0, yS), L(hw, h.d, yS), L(hw, h.d, yE), L(hw, 0, yE), RIGHT, sideC);
  face(body, L(-hw, 0, yS), L(-hw, h.d, yS), L(-hw, h.d, yE), L(-hw, 0, yE), LEFT, sideC);
  const roofA = h.ziegel;
  const roofB = shade(h.ziegel, 0.82);
  if (h.giebel) {
    // Giebel vorn und hinten, First quer zur Gasse (entlang v)
    tri(body, L(-hw, 0, yE), L(hw, 0, yE), L(0, 0, yF), FRONT, wallC);
    tri(body, L(-hw, h.d, yE), L(hw, h.d, yE), L(0, h.d, yF), BACK, shade(wallC, 0.86));
    const e = over * h.neigung;
    face(body, L(-hw - over, -over, yE - e), L(0, -over, yF), L(0, h.d + over, yF), L(-hw - over, h.d + over, yE - e), [-ux, 1, -uz], roofA);
    face(body, L(hw + over, -over, yE - e), L(0, -over, yF), L(0, h.d + over, yF), L(hw + over, h.d + over, yE - e), [ux, 1, uz], roofB);
    // Ortgang (Stirnbrett) vorn
    if (hi) {
      face(det, L(-hw - over, -over - 0.02, yE - e), L(0, -over - 0.02, yF + 0.05), L(0, -over - 0.02, yF - 0.3), L(-hw - over, -over - 0.02, yE - e - 0.3), FRONT, shade(roofA, 0.6));
      face(det, L(hw + over, -over - 0.02, yE - e), L(0, -over - 0.02, yF + 0.05), L(0, -over - 0.02, yF - 0.3), L(hw + over, -over - 0.02, yE - e - 0.3), FRONT, shade(roofA, 0.6));
    }
  } else {
    // Traufe zur Gasse, First längs (entlang u), Giebel an den Seiten
    const hd = h.d / 2;
    tri(body, L(hw, 0, yE), L(hw, h.d, yE), L(hw, hd, yF), RIGHT, sideC);
    tri(body, L(-hw, 0, yE), L(-hw, h.d, yE), L(-hw, hd, yF), LEFT, sideC);
    const e = over * h.neigung;
    face(body, L(-hw - over, -over, yE - e), L(hw + over, -over, yE - e), L(hw + over, hd, yF), L(-hw - over, hd, yF), [fx, 1, fz], roofA);
    face(body, L(-hw - over, h.d + over, yE - e), L(hw + over, h.d + over, yE - e), L(hw + over, hd, yF), L(-hw - over, hd, yF), [-fx, 1, -fz], roofB);
    // Gaube zur Gasse
    if (hi && h.gaube && h.w > 6) {
      const gw = 1.1;
      const gv = hd * 0.45;
      const gy = yE + (gv / hd) * rise;
      const gt = gy + 1.5;
      face(body, L(-gw, gv, gy - 0.4), L(gw, gv, gy - 0.4), L(gw, gv, gt), L(-gw, gv, gt), FRONT, wallC);
      tri(body, L(-gw - 0.2, gv, gt), L(gw + 0.2, gv, gt), L(0, gv, gt + 0.9), FRONT, wallC);
      face(body, L(-gw - 0.25, gv - 0.2, gt - 0.05), L(0, gv - 0.2, gt + 0.95), L(0, hd, gt + 0.95), L(-gw - 0.25, hd, gt - 0.05), [-ux, 1, -uz], roofA);
      face(body, L(gw + 0.25, gv - 0.2, gt - 0.05), L(0, gv - 0.2, gt + 0.95), L(0, hd, gt + 0.95), L(gw + 0.25, hd, gt - 0.05), [ux, 1, uz], roofB);
      face(det, L(-0.55, gv - 0.03, gy + 0.1), L(0.55, gv - 0.03, gy + 0.1), L(0.55, gv - 0.03, gy + 1.2), L(-0.55, gv - 0.03, gy + 1.2), FRONT, GLAS);
    }
  }
  // Schornstein
  if (h.kamin) {
    const cu = (rnd() - 0.5) * h.w * 0.5;
    const cv = h.d * (0.3 + rnd() * 0.4);
    const top = yF + 1.2;
    const c0 = yE + 0.5;
    const s = 0.4;
    face(body, L(cu - s, cv - s, c0), L(cu + s, cv - s, c0), L(cu + s, cv - s, top), L(cu - s, cv - s, top), FRONT, KAMIN);
    face(body, L(cu - s, cv + s, c0), L(cu + s, cv + s, c0), L(cu + s, cv + s, top), L(cu - s, cv + s, top), BACK, shade(KAMIN, 0.85));
    face(body, L(cu + s, cv - s, c0), L(cu + s, cv + s, c0), L(cu + s, cv + s, top), L(cu + s, cv - s, top), RIGHT, shade(KAMIN, 0.92));
    face(body, L(cu - s, cv - s, c0), L(cu - s, cv + s, c0), L(cu - s, cv + s, top), L(cu - s, cv - s, top), LEFT, shade(KAMIN, 0.92));
    face(body, L(cu - s - 0.08, cv - s - 0.08, top), L(cu + s + 0.08, cv - s - 0.08, top), L(cu + s + 0.08, cv + s + 0.08, top), L(cu - s - 0.08, cv + s + 0.08, top), [0, 1, 0], KAMIN_KOPF);
  }

  // --- Front: Fenster, Tür, Fachwerk ---
  const floors = Math.max(2, Math.round(h.h / 3));
  const fh = h.h / floors;
  const cols = Math.max(1, Math.round(h.w / 2.4));
  const cw = h.w / cols;
  const o = -0.04;
  const door = Math.floor(rnd() * cols);
  for (let f = 0; f < floors; f++) {
    const fy = h.y + f * fh;
    for (let c = 0; c < cols; c++) {
      const cu = -hw + (c + 0.5) * cw;
      if (f === 0 && c === door) {
        face(det, L(cu - 0.55, o, fy), L(cu + 0.55, o, fy), L(cu + 0.55, o, fy + 2.1), L(cu - 0.55, o, fy + 2.1), FRONT, TUER);
        continue;
      }
      if (f === 0 && h.markise) continue;
      const wy0 = fy + fh * 0.32;
      const wy1 = fy + fh * 0.82;
      const ww = Math.min(0.6, cw * 0.28);
      if (hi) face(det, L(cu - ww - 0.1, o, wy0 - 0.1), L(cu + ww + 0.1, o, wy0 - 0.1), L(cu + ww + 0.1, o, wy1 + 0.1), L(cu - ww - 0.1, o, wy1 + 0.1), FRONT, RAHMEN);
      face(det, L(cu - ww, o * 1.6, wy0), L(cu + ww, o * 1.6, wy0), L(cu + ww, o * 1.6, wy1), L(cu - ww, o * 1.6, wy1), FRONT, (c + f) % 3 === 0 ? GLAS_HELL : GLAS);
      if (hi && h.laden) {
        for (const sd of [-1, 1]) {
          const a = cu + sd * (ww + 0.12);
          const b2 = cu + sd * (ww + 0.12 + ww * 0.9);
          face(det, L(Math.min(a, b2), o, wy0), L(Math.max(a, b2), o, wy0), L(Math.max(a, b2), o, wy1), L(Math.min(a, b2), o, wy1), FRONT, h.laden);
        }
      }
    }
  }
  if (h.markise) {
    // Laden im Erdgeschoss: Schaufenster und gestreifte Markise
    face(det, L(-hw + 0.5, o, h.y + 0.6), L(hw - 0.5, o, h.y + 0.6), L(hw - 0.5, o, h.y + 2.3), L(-hw + 0.5, o, h.y + 2.3), FRONT, GLAS_HELL);
    const n = Math.max(2, Math.round(h.w / 0.9));
    for (let k = 0; k < n; k++) {
      const a = -hw + 0.3 + ((h.w - 0.6) * k) / n;
      const b2 = -hw + 0.3 + ((h.w - 0.6) * (k + 1)) / n;
      face(body, L(a, 0, h.y + 3), L(b2, 0, h.y + 3), L(b2, -1.4, h.y + 2.4), L(a, -1.4, h.y + 2.4), [fx, 1, fz], k % 2 === 0 ? h.markise : RAHMEN);
    }
  }
  if (hi && h.fachwerk) {
    // Balken: Schwelle und Rähm je Geschoss, Ständer an den Ecken und zwischen den Fenstern, Streben in den Eckfeldern.
    const bo = -0.025;
    const t = 0.16;
    for (let f = 1; f <= floors; f++) {
      const by = h.y + f * fh;
      face(det, L(-hw, bo, by - t), L(hw, bo, by - t), L(hw, bo, by + t), L(-hw, bo, by + t), FRONT, h.balken);
    }
    for (let c = 0; c <= cols; c++) {
      const cu = -hw + c * cw;
      const a = Math.max(-hw, cu - t);
      const b2 = Math.min(hw, cu + t);
      face(det, L(a, bo, h.y + fh), L(b2, bo, h.y + fh), L(b2, bo, yE), L(a, bo, yE), FRONT, h.balken);
    }
    for (let f = 1; f < floors; f++) {
      const by = h.y + f * fh;
      for (const sd of [-1, 1]) {
        const cx0 = sd * hw;
        const cx1 = sd * (hw - cw * 0.45);
        face(det, L(cx0, bo, by + t), L(cx0, bo, by + t + 0.3), L(cx1, bo, by + fh - t), L(cx1, bo, by + fh - t - 0.3), FRONT, h.balken);
      }
    }
    if (h.giebel) {
      // Giebeldreieck: Kehlbalken und Mittelständer
      const gy = yE + rise * 0.45;
      const gu = hw * 0.55;
      face(det, L(-gu, bo, gy - t), L(gu, bo, gy - t), L(gu, bo, gy + t), L(-gu, bo, gy + t), FRONT, h.balken);
      face(det, L(-t, bo, yE), L(t, bo, yE), L(t, bo, yF - 0.4), L(-t, bo, yF - 0.4), FRONT, h.balken);
    }
  }
  // Rückseite: ein paar Fenster
  for (let f = 1; f < floors; f++) {
    const fy = h.y + f * fh;
    for (let c = 0; c < cols; c += 2) {
      const cu = -hw + (c + 0.5) * cw;
      face(det, L(cu - 0.45, h.d + 0.04, fy + fh * 0.32), L(cu + 0.45, h.d + 0.04, fy + fh * 0.32), L(cu + 0.45, h.d + 0.04, fy + fh * 0.8), L(cu - 0.45, h.d + 0.04, fy + fh * 0.8), BACK, GLAS);
    }
  }
}

/** Einfaches Füllhaus für die Dachlandschaft hinter den Gassen: Kasten und Satteldach, ohne Einzelheiten. */
export function blockBau(body: MeshBuilder, x: number, z: number, rot: number, w: number, d: number, y: number, h: number, putz: RGB, ziegel: RGB, neigung: number): void {
  const fx = Math.sin(rot);
  const fz = Math.cos(rot);
  const ux = -fz;
  const uz = fx;
  const L = (u: number, v: number, yy: number): V3 => [x + ux * u - fx * v, yy, z + uz * u - fz * v];
  const hw = w / 2;
  const hd = d / 2;
  const yE = y + h;
  const yF = yE + hd * neigung;
  const FRONT: V3 = [fx, 0, fz];
  const BACK: V3 = [-fx, 0, -fz];
  const RIGHT: V3 = [ux, 0, uz];
  const LEFT: V3 = [-ux, 0, -uz];
  face(body, L(-hw, -hd, y), L(hw, -hd, y), L(hw, -hd, yE), L(-hw, -hd, yE), FRONT, putz);
  face(body, L(-hw, hd, y), L(hw, hd, y), L(hw, hd, yE), L(-hw, hd, yE), BACK, shade(putz, 0.86));
  face(body, L(hw, -hd, y), L(hw, hd, y), L(hw, hd, yE), L(hw, -hd, yE), RIGHT, shade(putz, 0.92));
  face(body, L(-hw, -hd, y), L(-hw, hd, y), L(-hw, hd, yE), L(-hw, -hd, yE), LEFT, shade(putz, 0.92));
  tri(body, L(hw, -hd, yE), L(hw, hd, yE), L(hw, 0, yF), RIGHT, shade(putz, 0.92));
  tri(body, L(-hw, -hd, yE), L(-hw, hd, yE), L(-hw, 0, yF), LEFT, shade(putz, 0.92));
  const o = 0.4;
  const e = o * neigung;
  face(body, L(-hw - o, -hd - o, yE - e), L(hw + o, -hd - o, yE - e), L(hw + o, 0, yF), L(-hw - o, 0, yF), [fx, 1, fz], ziegel);
  face(body, L(-hw - o, hd + o, yE - e), L(hw + o, hd + o, yE - e), L(hw + o, 0, yF), L(-hw - o, 0, yF), [-fx, 1, -fz], shade(ziegel, 0.82));
}

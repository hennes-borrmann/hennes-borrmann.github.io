// Talsperre: Darstellung der Bauwerke, die ins Rennen eingreifen – die Staumauer (an ihrer Luftseite hängt das
// Schwebeband, das mechanics/band.ts zeichnet), die Überlaufrinne (Abkürzung 'risk': Wasser strömt über die Wehrkrone
// und stürzt in die Sammelrinne), die Schleuse (Abkürzung 'window': Stemmtore und Signal folgen dem Fahrplan des Tors)
// und das Krafthaus (die Turbinenläufer am Hallenkran zeichnet things.ts als Hindernis; hier Halle, Kranbahn und die
// drehenden Wellen der Maschinensätze).
//
// Lesbarkeit geht vor: Das Wasser auf der Wehrkrone fließt sichtbar zur Rinne hin (dorthin drückt es auch das Kart);
// die Schleuse zeigt an der Einfahrt zwei Lampen – rot = zu, grün = offen, gelb blinkend = schließt gleich –, und ihre
// Tore schwenken auf und zu, genau so, wie die Physik sie sperrt (Rennzeit, auf jedem Bildschirm gleich).
//
// Zeichentechnik ohne eigene Shader und ohne Lichtquelle: stehende Netze mit Eckenfarben (Toon-Körper, Leuchtendes),
// fließendes Wasser als Textur, deren Versatz je Bild mitwandert, die Tore und die Wellen als Instanzen, die Lampen als
// Instanzen mit eigener Farbe. Zusammen sieben Zeichenaufrufe.

import * as THREE from 'three';
import { GATE_WARN, planActive, planUntil, type Plan } from '../../game/mechanics';
import { EDGE_OPEN_L, EDGE_TUNNEL, rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, mixRgb, noise, seeded, shade, type RGB, type V3 } from '../build';
import { CHANNEL, CHANNEL_FLOOR, CHANNEL_HALF, CHANNEL_SLAB, DAM_AIR, DAM_CZ, DAM_FOOT, DAM_TOP, DAM_WATER, DAM_X0, DAM_X1, RIVER, RIVER_Y } from '../life/talsperreLand';
import type { MechanicView } from '../mechanics';
import { rgb, toonMaterial } from '../toon';
import type { World } from '../world';

const CONCRETE = rgb(0xddd6c9);
const CONCRETE_D = rgb(0xc2bbae);
const CONCRETE_W = rgb(0x8f8a80);
const STREAK = rgb(0x9e9688);
const WET = rgb(0x6f7a72);
const STEEL = rgb(0x5d6470);
const STEEL_D = rgb(0x3a3f48);
const YELLOW = rgb(0xffcf3a);
const BLACK = rgb(0x1e1c22);
const WARM = rgb(0xffd89a);
const WINDOW = rgb(0x2f3a48);
const PLASTER = rgb(0xd8c7a3);
const PLASTER_D = rgb(0xbfae8b);
const ROOF = rgb(0x6d5a4c);
const RED = rgb(0xc8432e);
const FOAM = rgb(0xeef7f4);

/** Wasser fließt in der Textur entlang v; ein Meter Wasser sind WATER_M Einheiten v. */
const WATER_M = 0.25;

export function buildDam(t: Track, detail: boolean, world: World): MechanicView {
  const group = new THREE.Group();
  group.name = 'Talsperre';
  const disposables: { dispose(): void }[] = [];
  const solid = new MeshBuilder();
  const glow = new MeshBuilder();
  const water = new MeshBuilder();
  const rnd = seeded(2121);
  const white: RGB = [1, 1, 1];
  // (das gezeichnete Gelände kann an steilen Hängen unter heightAt liegen – das Tiefere zählt)
  const ground = (x: number, z: number): number => Math.min(world.heightAt(x, z), world.groundY(x, z));

  // --- Staumauer ------------------------------------------------------------------------------
  // Bogen um (0, DAM_CZ). Winkel th: x = r·sin th, z = DAM_CZ − r·cos th.
  const A = (r: number, th: number, y: number): V3 => [r * Math.sin(th), y, DAM_CZ - r * Math.cos(th)];
  const th0 = Math.asin(DAM_X0 / DAM_AIR);
  const th1 = Math.asin(DAM_X1 / DAM_AIR);
  const cols = Math.ceil(((th1 - th0) * DAM_AIR) / 4);
  const ROW = 3;
  // Kalkfahnen: einige Spalten sind von der Krone herab dunkler.
  const streak = new Float32Array(cols);
  for (let c = 0; c < cols; c++) streak[c] = rnd() < 0.28 ? 6 + rnd() * 14 : 0;
  for (let c = 0; c < cols; c++) {
    const a = th0 + ((th1 - th0) * c) / cols;
    const b = th0 + ((th1 - th0) * (c + 1)) / cols;
    const pa = A(DAM_AIR, a, 0);
    const pb = A(DAM_AIR, b, 0);
    const foot = Math.min(ground(pa[0], pa[2] + 2), ground(pb[0], pb[2] + 2)) - 3;
    const top = DAM_TOP - 0.06;
    if (foot >= top - 0.5) continue;
    // Luftseite: senkrecht, in Betonierabschnitten (Fugen alle 16 m, Lagen alle 3 m)
    const joint = c % 4 === 0;
    for (let y0 = Math.floor(foot / ROW) * ROW; y0 < top; y0 += ROW) {
      const lo = Math.max(foot, y0);
      const hi = Math.min(top, y0 + ROW);
      if (hi - lo < 0.01) continue;
      let col = Math.floor(y0 / ROW) % 2 === 0 ? CONCRETE : shade(CONCRETE, 0.965);
      if (joint) col = CONCRETE_D;
      if (streak[c] > 0 && hi > top - streak[c]) col = mixRgb(col, STREAK, 0.5 * Math.min(1, (hi - (top - streak[c])) / 6));
      solid.quad(A(DAM_AIR, b, lo), A(DAM_AIR, a, lo), A(DAM_AIR, a, hi), A(DAM_AIR, b, hi), col);
    }
    // Blockfugen (alle 16 m) als dunkle Linien vor der Fläche – an der Mauer zeigen sie, wie schnell man ist
    if (joint) {
      const wj = 0.35 / DAM_AIR;
      glow.quad(A(DAM_AIR + 0.06, a + wj, foot), A(DAM_AIR + 0.06, a - wj, foot), A(DAM_AIR + 0.06, a - wj, top - 1.3), A(DAM_AIR + 0.06, a + wj, top - 1.3), rgb(0x8d877c));
    }
    // nasser, dunkler Fuß
    if (foot < 30) solid.quad(A(DAM_AIR + 0.04, b, foot), A(DAM_AIR + 0.04, a, foot), A(DAM_AIR + 0.04, a, foot + 5.5), A(DAM_AIR + 0.04, b, foot + 5.5), WET);
    // Gesims unter der Krone: ein vorspringendes Band (wirft eine Schattenkante)
    const g0 = A(DAM_AIR + 0.05, a, top - 1.2);
    const g1 = A(DAM_AIR + 0.05, b, top - 1.2);
    const g2 = A(DAM_AIR - 0.7, b, top - 1.2);
    const g3 = A(DAM_AIR - 0.7, a, top - 1.2);
    solid.quad(g3, g2, g1, g0, CONCRETE_W);
    solid.quad(A(DAM_AIR - 0.7, b, top - 1.2), A(DAM_AIR - 0.7, a, top - 1.2), A(DAM_AIR - 0.7, a, top - 0.3), A(DAM_AIR - 0.7, b, top - 0.3), CONCRETE_D);
    // Wasserseite: vom Kronenrand schräg hinab zum Seegrund; unter dem Spiegel grünlich nass.
    // (Nicht dort, wo der Stollen durch das Widerlager führt – da ist Fels.)
    const wa = A(DAM_WATER + DAM_FOOT, a, 0);
    let rock = false;
    for (let i = 0; i < t.n && !rock; i += 3) if ((t.edge[i] & EDGE_TUNNEL) !== 0 && Math.hypot(wa[0] - t.px[i], wa[2] - t.pz[i]) < t.wh[i] + 9) rock = true;
    if (rock) continue;
    const wb = A(DAM_WATER + DAM_FOOT, b, 0);
    const bed = Math.min(ground(wa[0], wa[2]), ground(wb[0], wb[2])) - 2;
    const lake = t.sea;
    const k = (y: number): number => DAM_WATER + DAM_FOOT * Math.max(0, Math.min(1, (top - y) / Math.max(1, top - bed)));
    for (const [y0, y1, cc] of [
      [lake + 0.6, top, CONCRETE],
      [lake - 0.4, lake + 0.6, WET],
      [bed, lake - 0.4, mixRgb(WET, rgb(0x3f5a4a), 0.5)],
    ] as [number, number, RGB][]) {
      if (y1 <= y0) continue;
      solid.quad(A(k(y0), a, y0), A(k(y0), b, y0), A(k(y1), b, y1), A(k(y1), a, y1), cc);
    }
    // Kronenoberfläche zwischen den Fahrbahnrändern ist Straße (world.ts); außen die Brüstungen.
  }
  // Grundablass: zwei Auslässe am Mauerfuß, aus denen das Wasser ins Tosbecken schießt
  for (const x of [-9, 9]) {
    const th = Math.asin(x / DAM_AIR);
    const p = A(DAM_AIR + 0.05, th, 0);
    const y = Math.max(ground(p[0], p[2] + 3), RIVER_Y) + 2.2;
    const yaw = th;
    // Rahmen und dunkle Öffnung
    solid.box(p[0], y + 1.6, p[2] + 0.3, 4.6, 4.4, 0.8, STEEL_D, yaw);
    glow.box(p[0], y + 1.6, p[2] + 0.75, 3.2, 3, 0.1, BLACK, yaw);
    // Wasserstrahl: weit hinaus, dann hinab ins Becken
    const dir: V3 = [Math.sin(th), 0, Math.cos(th)];
    let prev: V3 | null = null;
    let v = 0;
    for (let s = 0; s <= 10; s++) {
      const u = s / 10;
      const out = 1 + u * 16;
      const yy = y + 1.4 - u * u * (y + 1.4 - RIVER_Y);
      const c: V3 = [p[0] + dir[0] * out, yy, p[2] + dir[2] * out];
      if (prev) {
        const w0 = 1.3 + (s - 1) * 0.12;
        const w1 = 1.3 + s * 0.12;
        const dv = Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]) * WATER_M;
        const side = (q: V3, w: number, h: number): V3 => [q[0] + Math.cos(th) * w, q[1] + h, q[2] - Math.sin(th) * w];
        water.quadUv(side(prev, -w0, 0.6), side(prev, w0, 0.6), side(c, w1, 0.6), side(c, -w1, 0.6), white, 0, v, 1, v + dv);
        water.quadUv(side(prev, w0, -0.6), side(prev, -w0, -0.6), side(c, -w1, -0.6), side(c, w1, -0.6), white, 0, v, 1, v + dv);
        v += dv;
      }
      prev = c;
    }
    // Gischt im Becken
    glow.box(p[0] + dir[0] * 17, RIVER_Y + 0.25, p[2] + dir[2] * 17, 7, 0.5, 7, FOAM, yaw);
  }
  // Leuchten auf der Krone: Mast an beiden Brüstungen alle 24 m, warmes Licht
  {
    const seen = new Set<number>();
    for (let i = 0; i < t.n; i++) {
      const p = [t.px[i], t.pz[i]];
      const r = Math.hypot(p[0], p[1] - DAM_CZ);
      if (Math.abs(r - (DAM_AIR + DAM_WATER) / 2) > 2 || p[0] < DAM_X0 + 6 || p[0] > DAM_X1 - 6) continue;
      const slot = Math.round(p[0] / 24);
      if (seen.has(slot) || Math.abs(p[0] - slot * 24) > 1) continue;
      seen.add(slot);
      for (const sgn of [-1, 1]) {
        const lat = sgn * (t.wh[i] + 0.25);
        const x = t.px[i] + rightX(t, i) * lat;
        const z = t.pz[i] + rightZ(t, i) * lat;
        const y = t.py[i] + 0.95;
        solid.box(x, y + 2.4, z, 0.22, 4.8, 0.22, STEEL_D);
        solid.box(x - rightX(t, i) * sgn * 0.5, y + 4.8, z - rightZ(t, i) * sgn * 0.5, 0.25, 0.18, 1.2, STEEL_D, Math.atan2(rightX(t, i), rightZ(t, i)));
        glow.box(x - rightX(t, i) * sgn * 0.9, y + 4.65, z - rightZ(t, i) * sgn * 0.9, 0.5, 0.2, 0.5, WARM);
      }
    }
  }

  // --- Überlaufrinne (Abkürzung 'risk') ----------------------------------------------------------
  const kRisk = t.def.branches?.findIndex((b) => b.shortcut === 'risk') ?? -1;
  if (kRisk >= 0) {
    const b = t.branches[kRisk];
    const P = (i: number, lat: number, h: number): V3 => [t.px[i] + rightX(t, i) * lat, t.py[i] + lat * t.bank[i] + h, t.pz[i] + rightZ(t, i) * lat];
    let vSheet = 0;
    for (let k = 0; k < b.count - 1; k++) {
      const i = b.first + k;
      const j = i + 1;
      if ((t.edge[i] & EDGE_OPEN_L) === 0 || (t.edge[j] & EDGE_OPEN_L) === 0) continue;
      const wi = t.wh[i] + 0.05;
      const wj = t.wh[j] + 0.05;
      // Wehrkörper: Seeseite senkrecht bis zum Grund, Rinnenseite als geschwungener Rücken bis zur Sohle
      const deep = t.sea - 7;
      solid.quad(P(j, wj, -0.02), P(i, wi, -0.02), [P(i, wi + 0.4, 0)[0], deep, P(i, wi + 0.4, 0)[2]], [P(j, wj + 0.4, 0)[0], deep, P(j, wj + 0.4, 0)[2]], k % 6 < 3 ? WET : shade(WET, 0.94));
      const ogee = (i2: number, w: number, s: number): V3 => {
        // s = 0 … 1 vom Kronenrand zur Sohle; der Rücken wölbt sich erst und fällt dann steil
        const top = t.py[i2] - w * t.bank[i2];
        const drop = top - CHANNEL_FLOOR;
        return P(i2, -w - 2.4 * s * s, -drop * (s * 0.55 + s * s * 0.45) - 0.02);
      };
      for (let q = 0; q < 4; q++) {
        const s0 = q / 4;
        const s1 = (q + 1) / 4;
        solid.quad(ogee(i, wi, s0), ogee(j, wj, s0), ogee(j, wj, s1), ogee(i, wi, s1), q === 0 ? CONCRETE : CONCRETE_D);
        // Wasservorhang über den Rücken hinab
        const off = (p: V3): V3 => [p[0] - rightX(t, i) * 0.12, p[1] + 0.06, p[2] - rightZ(t, i) * 0.12];
        const va = vSheet + 2.6 * WATER_M + s0 * 9 * WATER_M;
        const vb = vSheet + 2.6 * WATER_M + s1 * 9 * WATER_M;
        water.quadUv(off(ogee(i, wi, s0)), off(ogee(j, wj, s0)), off(ogee(j, wj, s1)), off(ogee(i, wi, s1)), white, 0, va, 1, vb);
      }
      // Wasserfilm über die Krone, vom See zur Rinne (nach links): v wächst in Fließrichtung
      const lip = 1.4;
      water.quadUv(P(i, wi + lip, t.sea + 0.02 - t.py[i]), P(j, wj + lip, t.sea + 0.02 - t.py[j]), P(j, wj, 0.05), P(i, wi, 0.05), white, 0, 0, 1, lip * WATER_M);
      water.quadUv(P(i, wi, 0.05), P(j, wj, 0.05), P(j, -wj, 0.05), P(i, -wi, 0.05), white, 0, lip * WATER_M, 1, (lip + 2 * wi) * WATER_M);
      vSheet = (lip + 2 * wi) * WATER_M - 2.6 * WATER_M;
      // Gelbe Kantenmarkierung zur Rinne hin (zeigt: hier geht es hinunter)
      if (k % 2 === 0) glow.quad(P(i, -wi + 0.35, 0.06), P(i, -wi + 0.05, 0.06), P(j, -wj + 0.05, 0.06), P(j, -wj + 0.35, 0.06), Math.floor(k / 2) % 2 === 0 ? YELLOW : BLACK);
    }
    // Sammelrinne: Sohle, Wasser (fließt nach Süden), Wand und Betonwanne auf der Westseite
    let v = 0;
    const L = CHANNEL;
    const samples: { p: V3; n: [number, number] }[] = [];
    for (let s = 0; s + 1 < L.length; s++) {
      const [ax, az] = L[s];
      const [bx, bz] = L[s + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const steps = Math.max(1, Math.round(len / 3));
      for (let q = 0; q < steps; q++) {
        const u = q / steps;
        // rechts in Fließrichtung = Westen (fort vom Wehr)
        samples.push({ p: [ax + (bx - ax) * u, 0, az + (bz - az) * u], n: [-(bz - az) / len, (bx - ax) / len] });
      }
    }
    const last = L[L.length - 1];
    const lp = L[L.length - 2];
    const ll = Math.hypot(last[0] - lp[0], last[1] - lp[1]);
    samples.push({ p: [last[0], 0, last[1]], n: [-(last[1] - lp[1]) / ll, (last[0] - lp[0]) / ll] });
    const C = (q: { p: V3; n: [number, number] }, side: number, y: number): V3 => [q.p[0] + q.n[0] * side, y, q.p[2] + q.n[1] * side];
    const wy = CHANNEL_FLOOR + 1.6;
    const wallTop = 61.3;
    for (let s = 0; s + 1 < samples.length; s++) {
      const a = samples[s];
      const c = samples[s + 1];
      const dv = Math.hypot(c.p[0] - a.p[0], c.p[2] - a.p[2]) * WATER_M;
      solid.quad(C(a, -CHANNEL_HALF - 1, CHANNEL_FLOOR), C(a, CHANNEL_HALF + 0.4, CHANNEL_FLOOR), C(c, CHANNEL_HALF + 0.4, CHANNEL_FLOOR), C(c, -CHANNEL_HALF - 1, CHANNEL_FLOOR), CONCRETE_W);
      water.quadUv(C(a, -CHANNEL_HALF - 0.8, wy), C(a, CHANNEL_HALF + 0.3, wy), C(c, CHANNEL_HALF + 0.3, wy), C(c, -CHANNEL_HALF - 0.8, wy), white, 0, v, 1, v + dv);
      // Gischt, wo der Vorhang aufschlägt (Ostseite)
      glow.quad(C(a, -CHANNEL_HALF - 0.6, wy + 0.04), C(a, -CHANNEL_HALF + 1.2, wy + 0.04), C(c, -CHANNEL_HALF + 1.2, wy + 0.04), C(c, -CHANNEL_HALF - 0.6, wy + 0.04), FOAM);
      v += dv;
      // Westwand (innen und oben) und Wanne bis zum Gelände – die Wanne endet vor der Uferstraße
      const wx = CHANNEL_HALF + 0.4;
      let room = Infinity;
      for (const q of [a, c]) {
        const px = q.p[0] + q.n[0] * wx;
        const pz = q.p[2] + q.n[1] * wx;
        for (let k = 0; k < t.n; k += 2) room = Math.min(room, Math.hypot(px - t.px[k], pz - t.pz[k]) - t.wh[k] - 0.8);
      }
      const slab = Math.max(0.6, Math.min(CHANNEL_SLAB + 1.2, room));
      solid.quad(C(c, wx, CHANNEL_FLOOR), C(a, wx, CHANNEL_FLOOR), C(a, wx, wallTop), C(c, wx, wallTop), s % 5 === 0 ? CONCRETE_D : CONCRETE);
      solid.quad(C(c, wx, wallTop), C(a, wx, wallTop), C(a, wx + slab, wallTop), C(c, wx + slab, wallTop), CONCRETE_D);
      solid.quad(C(a, wx + slab, wallTop), C(c, wx + slab, wallTop), C(c, wx + slab, wallTop - 4), C(a, wx + slab, wallTop - 4), CONCRETE_W);
      // Geländer auf der Wand
      if (s % 2 === 0) solid.box(...C(a, wx + 0.3, wallTop + 0.55), 0.12, 1.1, 0.12, YELLOW);
    }
    // Geländerholm
    for (let s = 0; s + 1 < samples.length; s++) {
      const a = C(samples[s], CHANNEL_HALF + 0.7, wallTop + 1.05);
      const c = C(samples[s + 1], CHANNEL_HALF + 0.7, wallTop + 1.05);
      beam(solid, a, c, 0.12, YELLOW);
    }
    // Kopf der Rinne (Nordende) und Einlauf in den Entlastungsstollen (Südende)
    const head = samples[0];
    solid.quad(C(head, CHANNEL_HALF + 0.4, CHANNEL_FLOOR), C(head, -CHANNEL_HALF - 1, CHANNEL_FLOOR), C(head, -CHANNEL_HALF - 1, wallTop), C(head, CHANNEL_HALF + 0.4, wallTop), CONCRETE_D);
    const end = samples[samples.length - 1];
    const fw: V3 = [end.n[1], 0, -end.n[0]];
    const E = (side: number, y: number, ahead = 0): V3 => {
      const q = C(end, side, y);
      return [q[0] + fw[0] * ahead, y, q[2] + fw[2] * ahead];
    };
    solid.quad(E(-CHANNEL_HALF - 3, CHANNEL_FLOOR, 0.2), E(CHANNEL_HALF + 3, CHANNEL_FLOOR, 0.2), E(CHANNEL_HALF + 3, wallTop + 1, 0.2), E(-CHANNEL_HALF - 3, wallTop + 1, 0.2), CONCRETE_D);
    glow.quad(E(-CHANNEL_HALF + 0.3, CHANNEL_FLOOR, 0.1), E(CHANNEL_HALF - 0.3, CHANNEL_FLOOR, 0.1), E(CHANNEL_HALF - 0.3, wy + 3.4, 0.1), E(-CHANNEL_HALF + 0.3, wy + 3.4, 0.1), BLACK);
    for (let k = -2; k <= 2; k++) glow.quad(E(k * 1.8 - 0.4, wy + 3.6, 0.05), E(k * 1.8 + 0.4, wy + 3.6, 0.05), E(k * 1.8 + 0.4, wy + 4.2, 0.05), E(k * 1.8 - 0.4, wy + 4.2, 0.05), k % 2 === 0 ? YELLOW : BLACK);
  }

  // --- Schleuse (Abkürzung 'window') ----------------------------------------------------------
  const kWin = t.def.branches?.findIndex((b) => b.shortcut === 'window') ?? -1;
  let gatePlan: Plan | null = null;
  const leaves: { hx: number; hz: number; y: number; yaw: number; sign: number; at: 0 | 1 }[] = [];
  const lamps: V3[] = [];
  if (kWin >= 0) {
    const b = t.branches[kWin];
    const gate = t.gates.find((g) => t.branchOf[g.first] === kWin) ?? null;
    gatePlan = gate ? gate.plan : null;
    let mouth = 0;
    while (mouth < b.count && t.twin[b.first + mouth] >= 0) mouth++;
    let end = b.count - 1;
    while (end > 0 && t.twin[b.first + end] >= 0) end--;
    const k0 = Math.min(end - 4, mouth + 3);
    const k1 = end - 1;
    const P = (i: number, lat: number, h: number): V3 => [t.px[i] + rightX(t, i) * lat, t.py[i] + h, t.pz[i] + rightZ(t, i) * lat];
    const H = 3.6;
    for (let k = k0; k < k1; k++) {
      const i = b.first + k;
      const j = i + 1;
      for (const sgn of [-1, 1]) {
        const w0 = t.wh[i] + 0.55;
        const w1 = w0 + 1.6;
        const top = H;
        // Innenwand (zur Kammer), Krone, Außenwand bis unter das Gelände
        const inA = P(i, sgn * w0, -1.2);
        const inB = P(j, sgn * w0, -1.2);
        const inC = P(j, sgn * w0, top);
        const inD = P(i, sgn * w0, top);
        if (sgn < 0) solid.quad(inB, inA, inD, inC, k % 8 === 0 ? CONCRETE_D : CONCRETE);
        else solid.quad(inA, inB, inC, inD, k % 8 === 0 ? CONCRETE_D : CONCRETE);
        const outA = P(i, sgn * w1, top);
        const outB = P(j, sgn * w1, top);
        if (sgn < 0) solid.quad(inD, inC, outB, outA, rgb(0xd9d3c6));
        else solid.quad(inC, inD, outA, outB, rgb(0xd9d3c6));
        const gy = ground(outA[0], outA[2]) - 1;
        if (sgn < 0) solid.quad([outB[0], gy, outB[2]], [outA[0], gy, outA[2]], outA, outB, CONCRETE_D);
        else solid.quad([outA[0], gy, outA[2]], [outB[0], gy, outB[2]], outB, outA, CONCRETE_D);
        // gelb-schwarze Kante, Poller, Leitern
        if (k % 3 === 0) glow.quad(P(i, sgn * (w0 + 0.02), top - 0.35), P(j, sgn * (w0 + 0.02), top - 0.35), P(j, sgn * (w0 + 0.02), top - 0.05), P(i, sgn * (w0 + 0.02), top - 0.05), Math.floor(k / 3) % 2 === 0 ? YELLOW : BLACK);
        if (k % 9 === 4) solid.box(...P(i, sgn * (w0 + 0.8), top + 0.35), 0.5, 0.7, 0.5, BLACK);
        if (k % 12 === 7) {
          for (let r = 0; r < 6; r++) glow.box(...P(i, sgn * (w0 - 0.04), -0.6 + r * 0.7), 0.08, 0.08, 0.9, YELLOW, Math.atan2(t.tx[i], t.tz[i]));
        }
      }
    }
    // Stemmtore: je zwei Flügel am Ein- und Ausgang, angeschlagen an den Kammerwänden
    for (const [k, at] of [
      [k0 + 1, 0],
      [k1 - 1, 1],
    ] as [number, 0 | 1][]) {
      const i = b.first + k;
      const w = t.wh[i] + 0.5;
      for (const sgn of [-1, 1]) {
        const h = P(i, sgn * w, 0);
        leaves.push({ hx: h[0], hz: h[2], y: t.py[i] - 1.2, yaw: Math.atan2(t.tx[i], t.tz[i]), sign: sgn, at });
      }
      // Torbalken mit Laufsteg oben (fest), Warnschilder
      const yaw = Math.atan2(t.tx[i], t.tz[i]);
      for (const sgn of [-1, 1]) {
        const p = P(i, sgn * (w + 1.2), H + 2.6);
        solid.box(p[0], p[1] - 1.3, p[2], 1.4, 2.6 + 0.4, 1.4, CONCRETE_D, yaw);
      }
      const c = P(i, 0, H + 4.1);
      solid.box(c[0], c[1], c[2], 2 * w + 4.2, 0.8, 1.2, STEEL, yaw);
      glow.box(c[0], c[1] - 0.55, c[2], 2 * w + 2, 0.3, 1.25, YELLOW, yaw);
    }
    // Signal an der Einfahrt: Mast links mit zwei Lampen (rot oben, grün unten), zur Einfahrt hin
    {
      const i = b.first + k0;
      const w = t.wh[i] + 2.6;
      const m = P(i, -w, 0);
      const yaw = Math.atan2(t.tx[i], t.tz[i]);
      solid.box(m[0], m[1] + H + 2.2, m[2], 0.35, 4.4, 0.35, STEEL_D);
      solid.box(m[0], m[1] + H + 4.6, m[2], 1.0, 2.4, 0.5, BLACK, yaw);
      const back = 0.3;
      lamps.push([m[0] - t.tx[i] * back, m[1] + H + 5.25, m[2] - t.tz[i] * back]);
      lamps.push([m[0] - t.tx[i] * back, m[1] + H + 4.0, m[2] - t.tz[i] * back]);
    }
    // Schleusenwärterhaus rechts neben dem Oberhaupt
    {
      const i = b.first + Math.round((k0 + k1) / 2);
      const p = P(i, t.wh[i] + 7, 0);
      const yaw = Math.atan2(t.tx[i], t.tz[i]);
      const gy = ground(p[0], p[2]);
      solid.box(p[0], gy + 4.5, p[2], 6, 9, 6, PLASTER, yaw, PLASTER_D);
      solid.box(p[0], gy + 9.4, p[2], 7, 0.8, 7, ROOF, yaw);
      solid.box(p[0], gy + 11.2, p[2], 4.6, 3, 4.6, WINDOW, yaw, ROOF);
      solid.box(p[0], gy + 12.9, p[2], 5.4, 0.5, 5.4, ROOF, yaw);
      for (const dy of [3, 6.5]) {
        glow.box(p[0] - rightX(t, i) * 3.05, gy + dy, p[2] - rightZ(t, i) * 3.05, 0.1, 1.4, 1.6, WARM, yaw);
      }
      glow.box(p[0], gy + 11.2, p[2], 4.7, 1.2, 4.7, shade(WARM, 0.85), yaw);
    }
  }

  // --- Krafthaus -----------------------------------------------------------------------------------
  // Halle über der Straße zwischen den beiden Turbinenläufern (Hindernisse), Maschinensätze auf der linken Seite.
  const shafts: { x: number; y: number; z: number }[] = [];
  if (t.hazards.length > 0) {
    let a = Infinity;
    let z = -Infinity;
    for (const h of t.hazards) {
      a = Math.min(a, h.seg);
      z = Math.max(z, h.seg);
    }
    const s0 = a - 14;
    const s1 = z + 14;
    const W = 15;
    const HH = 14;
    const P = (i: number, lat: number, y: number): V3 => [t.px[i] + rightX(t, i) * lat, y, t.pz[i] + rightZ(t, i) * lat];
    const floor = (i: number): number => t.py[i] - 0.4;
    for (let i = s0; i < s1; i++) {
      const j = i + 1;
      const yi = floor(i);
      const yj = floor(j);
      // Seitenwände: außen Putz mit hohen Fenstern, innen hell; Dach mit Oberlicht
      for (const sgn of [-1, 1]) {
        const o0 = P(i, sgn * W, yi - 2);
        const o1 = P(j, sgn * W, yj - 2);
        const o2 = P(j, sgn * W, yj + HH);
        const o3 = P(i, sgn * W, yi + HH);
        const win = (i - s0) % 7 >= 2 && (i - s0) % 7 <= 5;
        const c = (i - s0) % 7 === 0 ? PLASTER_D : PLASTER;
        if (sgn > 0) solid.quad(o0, o1, o2, o3, c);
        else solid.quad(o1, o0, o3, o2, c);
        // innen (zur Straße)
        const n0 = P(i, sgn * (W - 0.6), yi);
        const n1 = P(j, sgn * (W - 0.6), yj);
        const n2 = P(j, sgn * (W - 0.6), yj + HH);
        const n3 = P(i, sgn * (W - 0.6), yi + HH);
        if (sgn > 0) solid.quad(n1, n0, n3, n2, shade(PLASTER, 0.82));
        else solid.quad(n0, n1, n2, n3, shade(PLASTER, 0.82));
        if (win) {
          // Fenster leuchten warm (innen wie außen)
          glow.quad(P(i, sgn * (W + 0.05), yi + 3), P(j, sgn * (W + 0.05), yj + 3), P(j, sgn * (W + 0.05), yj + 11), P(i, sgn * (W + 0.05), yi + 11), sgn > 0 ? WARM : shade(WARM, 0.9));
          glow.quad(P(j, sgn * (W - 0.65), yj + 3), P(i, sgn * (W - 0.65), yi + 3), P(i, sgn * (W - 0.65), yi + 11), P(j, sgn * (W - 0.65), yj + 11), shade(WARM, 0.75));
        }
        // Kranbahn: Konsolen und Schiene auf 11 m
        if ((i - s0) % 5 === 0) solid.box(...P(i, sgn * (W - 1.1), yi + 10.4), 1.0, 0.9, 0.8, CONCRETE_D, Math.atan2(t.tx[i], t.tz[i]));
        beam(solid, P(i, sgn * (W - 1.1), yi + 11), P(j, sgn * (W - 1.1), yj + 11), 0.45, STEEL_D);
      }
      // Dach (von unten hell, von oben dunkel) mit Oberlicht
      const r0 = P(i, -W - 0.4, yi + HH);
      const r1 = P(j, -W - 0.4, yj + HH);
      const r2 = P(j, W + 0.4, yj + HH);
      const r3 = P(i, W + 0.4, yi + HH);
      solid.quad(r0, r3, r2, r1, ROOF);
      solid.quad(r1, r2, r3, r0, shade(PLASTER, 0.7));
      if ((i - s0) % 4 < 2) glow.quad(P(i, -3, yi + HH - 0.05), P(j, -3, yj + HH - 0.05), P(j, 3, yj + HH - 0.05), P(i, 3, yi + HH - 0.05), shade(WARM, 0.6));
    }
    // Stirnwände mit großem Tor über der Straße
    for (const [i, s] of [
      [s0, -1],
      [s1, 1],
    ] as [number, number][]) {
      const y = floor(i);
      const door = t.wh[i] + 1.2;
      const fl = (a: number, bq: number, y0: number, y1: number): void => {
        const q = [P(i, a, y0), P(i, bq, y0), P(i, bq, y1), P(i, a, y1)];
        if (s > 0) solid.quad(q[0], q[1], q[2], q[3], PLASTER);
        else solid.quad(q[1], q[0], q[3], q[2], PLASTER);
      };
      fl(-W, -door, y - 2, y + HH);
      fl(door, W, y - 2, y + HH);
      fl(-door, door, y + 9.5, y + HH);
      // Torrahmen gelb-schwarz und Schild
      for (let k = 0; k < 8; k++) {
        const l0 = -door + (2 * door * k) / 8;
        const l1 = -door + (2 * door * (k + 1)) / 8;
        const q = [P(i, l0, y + 9.5), P(i, l1, y + 9.5), P(i, l1, y + 10.2), P(i, l0, y + 10.2)];
        if (s > 0) glow.quad(q[0], q[1], q[2], q[3], k % 2 === 0 ? YELLOW : BLACK);
        else glow.quad(q[1], q[0], q[3], q[2], k % 2 === 0 ? YELLOW : BLACK);
      }
    }
    // Kranbrücken an den Turbinenläufern (die Läufer selbst samt Laufkatze zeichnet things.ts)
    for (const h of t.hazards) {
      const i = h.seg;
      const y = floor(i) + 11.6;
      beam(solid, P(i, -W + 1.1, y), P(i, W - 1.1, y), 1.1, YELLOW);
      for (const sgn of [-1, 1]) solid.box(...P(i, sgn * (W - 1.1), y + 0.2), 1.6, 1.5, 3, STEEL_D, Math.atan2(t.tx[i], t.tz[i]));
      // schwarze Warnstreifen auf der Brücke
      for (let k = -6; k <= 6; k += 2) glow.box(...P(i, k * 1.6, y + 0.58), 0.7, 0.04, 1.12, BLACK, Math.atan2(t.tx[i], t.tz[i]));
    }
    // Maschinensätze links: Generatorgehäuse mit rotem Deckel; obendrauf dreht sich die Welle (Instanzen)
    for (let k = 0; k < 3; k++) {
      const i = Math.round(s0 + ((s1 - s0) * (k + 0.5)) / 3);
      const lat = -(t.wh[i] + 3.6);
      const p = P(i, lat, floor(i));
      const cyl = new THREE.CylinderGeometry(2.6, 2.9, 2.2, 14);
      const m = new THREE.Matrix4().makeTranslation(p[0], p[1] + 1.1, p[2]);
      solid.add(cyl, RED, m);
      cyl.dispose();
      const cap = new THREE.CylinderGeometry(1.9, 2.6, 0.7, 14);
      solid.add(cap, shade(RED, 0.8), new THREE.Matrix4().makeTranslation(p[0], p[1] + 2.55, p[2]));
      cap.dispose();
      const ring = new THREE.CylinderGeometry(2.95, 2.95, 0.3, 14);
      glow.add(ring, YELLOW, new THREE.Matrix4().makeTranslation(p[0], p[1] + 1.6, p[2]));
      ring.dispose();
      shafts.push({ x: p[0], y: p[1] + 3.2, z: p[2] });
    }
  }

  // --- Stollenportale: Betonfassade um die Röhre (world.ts) an beiden Enden ---------------------------
  for (let i = 0; i < t.n; i++) {
    const inT = (t.edge[i] & EDGE_TUNNEL) !== 0;
    const prevT = (t.edge[t.prev[i]] & EDGE_TUNNEL) !== 0;
    const nextT = (t.edge[t.next[i]] & EDGE_TUNNEL) !== 0;
    if (!inT || (prevT && nextT)) continue;
    const P = (lat: number, y: number, ahead: number): V3 => [t.px[i] + rightX(t, i) * lat + t.tx[i] * ahead, t.py[i] + y, t.pz[i] + rightZ(t, i) * lat + t.tz[i] * ahead];
    const out = prevT ? 0.5 : -0.5;
    const w = t.wh[i] + 0.8;
    const yaw = Math.atan2(t.tx[i], t.tz[i]);
    const c = P(0, 0, out);
    // Pfeiler, Sturz mit Namensband, Flügelmauern
    for (const sgn of [-1, 1]) {
      const p = P(sgn * (w + 1.2), 0, out);
      solid.box(p[0], p[1] + 4.6, p[2], 2.4, 11, 1.6, CONCRETE_D, yaw);
      const f = P(sgn * (w + 5), 0, out * 6);
      solid.box(f[0], f[1] + 2.5, f[2], 7, 7, 1.2, CONCRETE, yaw + sgn * 0.5 * Math.sign(out));
    }
    solid.box(c[0], c[1] + 9.3, c[2], 2 * w + 4.8, 2.6, 1.8, CONCRETE, yaw);
    for (let k = 0; k < 10; k++) {
      const l = -w + (2 * w * (k + 0.5)) / 10;
      const p = P(l, 7.85, out - Math.sign(out) * 0.95);
      glow.box(p[0], p[1], p[2], (2 * w) / 10, 0.35, 0.1, k % 2 === 0 ? YELLOW : BLACK, yaw);
    }
  }

  // --- Netze ----------------------------------------------------------------------------------------
  const solidMat = toonMaterial({ vertexColors: true });
  solidMat.side = THREE.DoubleSide;
  const solidMesh = new THREE.Mesh(solid.build(), solidMat);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const glowMesh = new THREE.Mesh(glow.build(), glowMat);
  group.add(solidMesh, glowMesh);
  disposables.push(solidMesh.geometry, solidMat, glowMesh.geometry, glowMat);

  // Fließendes Wasser: Streifen hellen Schaums auf grünlichem Blau, wandern entlang v.
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#5aa6a0';
  g.fillRect(0, 0, 64, 128);
  const r2 = seeded(77);
  for (let k = 0; k < 26; k++) {
    const x = Math.floor(r2() * 64);
    const y = Math.floor(r2() * 128);
    const l = 14 + r2() * 40;
    g.fillStyle = k % 3 === 0 ? '#eaf8f4' : '#9fd8cf';
    g.fillRect(x, y, 2 + Math.floor(r2() * 3), l);
    if (y + l > 128) g.fillRect(x, y - 128, 3, l);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  disposables.push(tex);
  const waterMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const waterMesh = new THREE.Mesh(water.build(), waterMat);
  waterMesh.renderOrder = 2;
  group.add(waterMesh);
  disposables.push(waterMesh.geometry, waterMat);

  // Torflügel (Instanzen): Ursprung am Anschlag, Flügel reicht in +x bis zur Mitte
  const leafGeo = new MeshBuilder();
  const kWinB = kWin >= 0 ? t.branches[kWin] : null;
  const leafLen = ((kWinB ? t.wh[kWinB.first + 30] : 4.6) + 0.5) / Math.cos(0.25);
  leafGeo.box(leafLen / 2, 2.6, 0, leafLen, 5.2, 0.6, rgb(0x4a5260));
  for (let k = 0; k < 4; k++) leafGeo.box(leafLen / 2, 0.8 + k * 1.3, 0.32, leafLen - 0.3, 0.16, 0.08, STEEL_D);
  leafGeo.box(leafLen / 2, 5.3, 0, leafLen, 0.25, 0.9, YELLOW);
  leafGeo.box(leafLen - 0.3, 2.6, 0.35, 0.6, 5, 0.06, RED);
  const leafG = leafGeo.build();
  const leafMat = toonMaterial({ vertexColors: true });
  const leafMesh = new THREE.InstancedMesh(leafG, leafMat, Math.max(1, leaves.length));
  leafMesh.frustumCulled = false;
  leafMesh.count = leaves.length;
  group.add(leafMesh);
  disposables.push(leafG, leafMat);

  // Signallampen (Instanzen mit eigener Farbe)
  const lampGeo = new THREE.SphereGeometry(0.42, 10, 8);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, Math.max(1, lamps.length));
  lampMesh.count = lamps.length;
  lampMesh.frustumCulled = false;
  const m4 = new THREE.Matrix4();
  lamps.forEach((p, k) => {
    m4.makeTranslation(p[0], p[1], p[2]);
    lampMesh.setMatrixAt(k, m4);
    lampMesh.setColorAt(k, new THREE.Color(0x330000));
  });
  group.add(lampMesh);
  disposables.push(lampGeo, lampMat);

  // Wellen der Maschinensätze: Kupplungsscheibe mit Speichen, dreht sich
  const wheel = new MeshBuilder();
  const hub = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 10);
  wheel.add(hub, STEEL);
  hub.dispose();
  const disc = new THREE.CylinderGeometry(1.5, 1.5, 0.35, 16);
  wheel.add(disc, STEEL_D, new THREE.Matrix4().makeTranslation(0, 0.2, 0));
  disc.dispose();
  for (let k = 0; k < 4; k++) wheel.box(Math.cos((k * Math.PI) / 2) * 0.9, 0.42, Math.sin((k * Math.PI) / 2) * 0.9, k % 2 === 0 ? 1.4 : 0.3, 0.12, k % 2 === 0 ? 0.3 : 1.4, YELLOW);
  const wheelG = wheel.build();
  const wheelMat = toonMaterial({ vertexColors: true });
  const wheelMesh = new THREE.InstancedMesh(wheelG, wheelMat, Math.max(1, shafts.length));
  wheelMesh.count = shafts.length;
  wheelMesh.frustumCulled = false;
  group.add(wheelMesh);
  disposables.push(wheelG, wheelMat);

  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  /** Wie weit ein Tor offen steht (0 zu … 1 offen): schwenkt in der Sekunde vor dem Schließen zu und vor dem Öffnen auf. */
  const openness = (plan: Plan, time: number): number => {
    if (planActive(plan, time)) {
      // zu – bis zum Öffnen: so lange, bis der Plan nicht mehr gilt
      let left = 0;
      for (let d = 6; d <= 60; d += 6) if (!planActive(plan, time + d)) {
        left = d;
        break;
      }
      return left === 0 ? 0 : 1 - left / 60;
    }
    const until = planUntil(plan, time);
    return Math.min(1, until / 60);
  };
  void detail;

  return {
    group,
    update(time, _seconds, dt) {
      // Wasser fließt: gut 3 m/s
      tex.offset.y -= dt * 3.2 * WATER_M;
      if (tex.offset.y < -1) tex.offset.y += 1;
      // Schleusentore und Signal
      if (gatePlan) {
        const o0 = openness(gatePlan, time);
        // Das Ausfahrtstor bleibt offen, solange noch jemand in der Kammer sein kann (gut vier Sekunden länger).
        const o1 = Math.max(o0, openness(gatePlan, time - 250));
        leaves.forEach((l, k) => {
          const o = l.at === 0 ? o0 : o1;
          // Mit der Drehung yaw zeigt ein Flügel nach links. Geschlossen stehen beide als flaches V quer über der Kammer,
          // offen liegen sie in Fahrtrichtung an den Wänden.
          const shut = l.sign > 0 ? l.yaw + 0.25 : l.yaw + Math.PI - 0.25;
          const open = l.sign > 0 ? l.yaw - Math.PI / 2 + 0.04 : l.yaw + 1.5 * Math.PI - 0.04;
          e.set(0, shut + (open - shut) * smoothK(o), 0);
          q.setFromEuler(e);
          m4.compose(pos.set(l.hx, l.y, l.hz), q, one);
          leafMesh.setMatrixAt(k, m4);
        });
        leafMesh.instanceMatrix.needsUpdate = true;
        const shutNow = planActive(gatePlan, time);
        const until = shutNow ? 0 : planUntil(gatePlan, time);
        // oben: rot = zu; gelb blinkend (immer schneller) = schließt gleich. unten: grün = offen.
        let top = shutNow ? col.setRGB(1, 0.12, 0.08) : col.setRGB(0.12, 0.04, 0.03);
        if (!shutNow && until < GATE_WARN * 0.6) {
          const rate = 2 + 6 * (1 - until / (GATE_WARN * 0.6));
          top = Math.floor((time / 60) * rate * 2) % 2 === 0 ? col.setRGB(1, 0.82, 0.15) : col.setRGB(0.2, 0.15, 0.03);
        }
        if (lamps.length >= 2) {
          lampMesh.setColorAt(0, top);
          lampMesh.setColorAt(1, shutNow ? col.setRGB(0.03, 0.12, 0.05) : col.setRGB(0.25, 1, 0.42));
          if (lampMesh.instanceColor) lampMesh.instanceColor.needsUpdate = true;
        }
      }
      // Maschinensätze drehen (Zierde, Uhr des Bildschirms genügt)
      shafts.forEach((s, k) => {
        e.set(0, time * 0.25 + k, 0);
        q.setFromEuler(e);
        m4.compose(pos.set(s.x, s.y, s.z), q, one);
        wheelMesh.setMatrixAt(k, m4);
      });
      wheelMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      for (const d of disposables) d.dispose();
      leafMesh.dispose();
      lampMesh.dispose();
      wheelMesh.dispose();
    },
  };
}

function smoothK(k: number): number {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x);
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
  const ring = (p: V3): V3[] => [corner(p, -1, -1), corner(p, 1, -1), corner(p, 1, 1), corner(p, -1, 1)];
  const A = ring(a);
  const C = ring(c);
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    b.quad(A[k], A[n], C[n], C[k], k % 2 === 0 ? color : shade(color, 0.8));
  }
}

// (noise und RIVER bleiben für spätere Zierde verfügbar)
void noise;
void RIVER;

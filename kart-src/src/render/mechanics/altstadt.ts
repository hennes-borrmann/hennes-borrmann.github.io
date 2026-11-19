// Dächerjagd: Darstellung von allem, was die Strecke trägt und was ins Rennen eingreift.
//
//   * Die Häuser unter dem Dachweg: Ihr First IST die Fahrbahn (Dachziegel, gezeichnet von world.ts) – hier kommen die
//     Dachflächen links und rechts dazu, Traufe, Fachwerkwände bis hinunter in die Gassen, Giebel an jeder Lücke zwischen
//     zwei Häusern (dort springt man über die Gasse), Schornsteine. Die Dachrampe hinunter in die Treppengasse steht auf
//     Holzböcken.
//   * Die Kirche auf dem Domberg: Festrampe auf Böcken, das Kirchenschiff unter dem Laufsteg auf dem First (Strebepfeiler,
//     Spitzbogenfenster), der Turm mit der Glockenstube, durch die die Fahrbahn führt – aus ihrem Westbogen springt man in
//     den Gleitflug –, Uhr, Turmhelm mit Kugel und Wetterhahn. Drei Glocken schwingen, wenn sie läuten (alle 15 s
//     Rennzeit, wie das Glockenspiel am Rathaus).
//   * Die Markthalle über der Abkürzung: Gusseisensäulen, Satteldach mit Dachreiter, Stände zwischen Säulen und Fahrbahn.
//   * Kanal und Hafen: Kaimauern bis auf den Grund, die Kaikante obenauf (so breit, dass sie den Hang des groben
//     Geländerasters deckt), Poller; die Brücke der Langen Gasse als steinerner Bogen über den Kanal (darunter taucht man
//     hindurch), ein Fußgängersteg und die Hafenbrücke an der Mündung.
//   * Die Bastei im Innern der Kehre: runder Mauerturm mit Zinnen und Stadtfahne.
//   * Die Straßenbahn (mechanics.ts: VEH_STADTBAHN): Zweiwagenzug in Rot und Elfenbein mit Bügel, genau dort, wo die
//     Physik ihn hat (vehiclePose); das Gleis entlang ihrer Linie, Oberleitung an Masten, die Haltestelle, Remise und
//     Torhaus, aus denen sie kommt und in die sie verschwindet.
//   * Festschmuck: Wimpelketten über dem Start, Stufen auf der Treppengasse.
//
// Keine eigenen Shader, keine Lichtquelle. Zeichenaufrufe (detail): Bauten (Toon) + Kontur, Einzelheiten (Toon), Gleis und
// Stufen (flach), Straßenbahn (instanziert) + Kontur, Glocken = 7; ohne detail: Bauten, Gleis, Straßenbahn, Glocken = 4.

import * as THREE from 'three';
import { VEH_STADTBAHN } from '../../game/mechanics';
import { SURFACE_INDEX } from '../../game/surface';
import { EDGE_DECK, EDGE_GAP, EDGE_GLIDE, EDGE_RAMP, newVehiclePose, rightX, rightZ, vehiclePose, type Track } from '../../game/track';
import { MeshBuilder, seeded, shade, type RGB, type V3 } from '../build';
import type { MechanicView } from '../mechanics';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import { DECK_D, type World } from '../world';
import { BALKEN, GLAS, GLAS_HELL, KAMIN, KAMIN_KOPF, PUTZ, RAHMEN, ZIEGEL, face, tri } from '../life/altstadtBau';
import { BASTEI, DAUER, HAFEN, KAI_Y, KANAL_GRUND, LAEUTEN, TURM, kaiBreite, polyDist, spots, wasser } from '../life/daecherLand';

const TAU = Math.PI * 2;
const WALL_T = 0.5;

const C_STEIN = rgb(0xc8b89a);
const C_STEIN_D = rgb(0xa8987c);
const C_STEIN_H = rgb(0xdccca8);
const C_KAI = rgb(0xb4a890);
const C_KAI_D = rgb(0x8e8270);
const C_POLLER = rgb(0x34323a);
const C_HOLZ = rgb(0xa8784a);
const C_HOLZ_D = rgb(0x7a5434);
const C_KIRCHE = rgb(0xd8c8a4);
const C_KIRCHE_D = rgb(0xb8a684);
const C_KIRCHE_H = rgb(0xe8dcc0);
const C_KUPFER = rgb(0x5aa088);
const C_KUPFER_D = rgb(0x46866e);
const C_GOLD = rgb(0xf2c84a);
const C_BLEI = rgb(0x6a5a8a);
const C_ROSE = [0x3a5ab0, 0xc83a3a, 0xe8b83a, 0x3a9a6a].map(rgb);
const C_UHR = rgb(0xf6f0e0);
const C_EISEN = rgb(0x3a5a4a);
const C_EISEN_D = rgb(0x2a4236);
const C_HALLE = rgb(0xb4503a);
const C_MARKISE = [0xd84a3a, 0x3a8a5a, 0x3a6ab0, 0xe8a83a].map(rgb);
const C_WEISS = rgb(0xf6f2e6);
const C_OBST = [0xe84a2a, 0xf0c03a, 0x7ab84a, 0xe8822a, 0x9a3a6a].map(rgb);
const C_SCHIENE = rgb(0xd8dce6);
const C_RILLE = rgb(0x3a3640);
const C_BETT = rgb(0x7e766c);
const C_DRAHT = rgb(0x2a2830);
const C_MAST = rgb(0x4a6a5a);
const C_STUFE = rgb(0x6e665c);
const C_STUFE_H = rgb(0xc4bcae);
const C_WIMPEL = [0xe8402e, 0xf2c83a, 0x3a7ad8, 0x3ab06a, 0xf6f2e6, 0xe86ab0].map(rgb);
const C_FAHNE = rgb(0xd83a2e);
const C_REMISE = rgb(0x9a5a40);
const C_TOR = rgb(0x2a2026);
const C_GLOCKE = rgb(0xb88a3a);
const C_GLOCKE_D = rgb(0x8a6428);
// Straßenbahn
const C_TRAM_ROT = rgb(0xc8382a);
const C_TRAM_HELL = rgb(0xf2e2b8);
const C_TRAM_DACH = rgb(0x8a8a92);
const C_TRAM_GLAS = rgb(0x3a4a6a);
const C_TRAM_DUNKEL = rgb(0x2a2830);


export function buildAltstadt(t: Track, detail: boolean, world: World): MechanicView {
  const group = new THREE.Group();
  group.name = 'Altstadt';
  const disposables: { dispose(): void }[] = [];
  const body = new MeshBuilder();
  const det = detail ? new MeshBuilder() : body;
  const flat = new MeshBuilder();
  const rnd = seeded(2525);
  const sp = spots(t);
  const ground = (x: number, z: number): number => Math.min(world.heightAt(x, z), world.groundY(x, z));
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length) % a.length];
  const UP: V3 = [0, 1, 0];

  /** Punkt auf der Fahrbahn: Abschnitt i, Anteil f zum nächsten, seitlich lat, dy darüber. */
  const P = (i: number, f: number, lat: number, dy: number): V3 => {
    const b = t.next[i];
    const ax = t.px[i] + rightX(t, i) * lat;
    const ay = t.py[i] + lat * t.bank[i] + dy;
    const az = t.pz[i] + rightZ(t, i) * lat;
    if (f === 0) return [ax, ay, az];
    const bx = t.px[b] + rightX(t, b) * lat;
    const by = t.py[b] + lat * t.bank[b] + dy;
    const bz = t.pz[b] + rightZ(t, b) * lat;
    return [ax + (bx - ax) * f, ay + (by - ay) * f, az + (bz - az) * f];
  };
  const out = (i: number, sd: number): V3 => [rightX(t, i) * sd, 0, rightZ(t, i) * sd];
  const fwd = (i: number, s = 1): V3 => [t.tx[i] * s, 0, t.tz[i] * s];
  /** Abschnitte von a bis b auf einem Weg (über next), höchstens max. */
  const walkTo = (a: number, b: number, max = 4000): number[] => {
    const l: number[] = [];
    for (let i = a, k = 0; k < max; i = t.next[i], k++) {
      l.push(i);
      if (i === b) break;
    }
    return l;
  };
  /** Senkrechter Stab (achteckig) von y0 bis y1. */
  const pfosten = (b: MeshBuilder, x: number, z: number, y0: number, y1: number, r: number, c: RGB, n = 6): void => {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * TAU;
      const a1 = ((k + 1) / n) * TAU;
      face(b, [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r], [x + Math.cos(a1) * r, y1, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y1, z + Math.sin(a0) * r], [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)], k % 2 ? c : shade(c, 0.9));
    }
  };
  /** Balken von a nach c (vierkantig, Kantenlänge s). */
  const balken = (b: MeshBuilder, a: V3, c: V3, s: number, col: RGB): void => {
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const dz = c[2] - a[2];
    const L = Math.hypot(dx, dy, dz);
    if (L < 1e-4) return;
    const ux = dx / L;
    const uy = dy / L;
    const uz = dz / L;
    let px = -uz;
    let py = 0;
    let pz = ux;
    if (Math.abs(uy) > 0.95) {
      px = 1;
      pz = 0;
    }
    const pl = Math.hypot(px, py, pz);
    px /= pl;
    py /= pl;
    pz /= pl;
    const qx = uy * pz - uz * py;
    const qy = uz * px - ux * pz;
    const qz = ux * py - uy * px;
    const h = s / 2;
    const corner = (p: V3, a1: number, a2: number): V3 => [p[0] + (px * a1 + qx * a2) * h, p[1] + (py * a1 + qy * a2) * h, p[2] + (pz * a1 + qz * a2) * h];
    const sides: [number, number, number, number][] = [
      [1, 1, 1, -1],
      [1, -1, -1, -1],
      [-1, -1, -1, 1],
      [-1, 1, 1, 1],
    ];
    for (const [a1, a2, b1, b2] of sides) {
      const o: V3 = [(px * (a1 + b1) + qx * (a2 + b2)) / 2, (py * (a1 + b1) + qy * (a2 + b2)) / 2, (pz * (a1 + b1) + qz * (a2 + b2)) / 2];
      face(b, corner(a, a1, a2), corner(a, b1, b2), corner(c, b1, b2), corner(c, a1, a2), o, col);
    }
  };

  // =====================================================================================================
  // Häuser unter dem Dachweg
  // =====================================================================================================
  const roofSegs: number[] = [];
  {
    const tiles = SURFACE_INDEX.tiles;
    for (const i of walkTo(sp.at(22.5), sp.at(32.1))) if ((t.edge[i] & EDGE_DECK) && t.surf[i] === tiles) roofSegs.push(i);
    const b = t.branches[0];
    if (b) for (let g = b.first; g < b.first + b.count; g++) if ((t.edge[g] & EDGE_DECK) && t.surf[g] === tiles) roofSegs.push(g);
  }
  const isRoof = new Uint8Array(t.total);
  for (const i of roofSegs) if ((t.edge[i] & (EDGE_GAP | EDGE_GLIDE)) === 0) isRoof[i] = 1;
  // Läufe ohne Lücke, in Häuser von 9–13 m geteilt
  const houses: number[][] = [];
  {
    const seen = new Uint8Array(t.total);
    for (const s0 of roofSegs) {
      if (!isRoof[s0] || seen[s0] || isRoof[t.prev[s0]]) continue;
      let cur: number[] = [];
      let want = 9 + rnd() * 4;
      for (let i = s0; isRoof[i] && !seen[i]; i = t.next[i]) {
        seen[i] = 1;
        cur.push(i);
        if (cur.length * t.step >= want && isRoof[t.next[i]] && isRoof[t.next[t.next[t.next[i]]]]) {
          houses.push(cur);
          cur = [i];
          want = 9 + rnd() * 4;
        }
      }
      if (cur.length > 1) houses.push(cur);
    }
  }
  const EAVE = 2.5;
  const DROP = 2.6;
  for (const h of houses) {
    const putz = pick(PUTZ);
    const balk = pick(BALKEN);
    const ziegel = shade(pick(ZIEGEL), 1);
    const fach = rnd() < 0.7;
    const a = h[0];
    const z = h[h.length - 1];
    // Boden unter dem Haus (die tiefste Stelle unter den Wänden)
    let low = Infinity;
    for (const i of h) {
      for (const sd of [-1, 1]) {
        const p = P(i, 0, sd * (t.wh[i] + WALL_T + EAVE - 0.4), 0);
        low = Math.min(low, ground(p[0], p[2]));
      }
    }
    const foot = low - 1.2;
    for (let k = 0; k + 1 < h.length; k++) {
      const i = h[k];
      const j = h[k + 1];
      for (const sd of [-1, 1]) {
        const Wi = t.wh[i] + WALL_T;
        const Wj = t.wh[j] + WALL_T;
        const o = out(i, sd);
        // Dachfläche von der Kante der Fahrbahn hinunter zur Traufe
        face(body, P(i, 0, sd * Wi, -0.06), P(j, 0, sd * Wj, -0.06), P(j, 0, sd * (Wj + EAVE), -DROP), P(i, 0, sd * (Wi + EAVE), -DROP), [o[0], 1, o[2]], k % 2 ? ziegel : shade(ziegel, 0.95));
        // Unterseite der Traufe
        face(body, P(i, 0, sd * (Wi + EAVE - 0.4), -DROP + 0.05), P(j, 0, sd * (Wj + EAVE - 0.4), -DROP + 0.05), P(j, 0, sd * (Wj + EAVE), -DROP), P(i, 0, sd * (Wi + EAVE), -DROP), [0, -1, 0], shade(ziegel, 0.6));
        // Wand von der Traufe bis in die Gasse
        const wi = P(i, 0, sd * (Wi + EAVE - 0.4), -DROP + 0.05);
        const wj = P(j, 0, sd * (Wj + EAVE - 0.4), -DROP + 0.05);
        face(body, [wi[0], foot, wi[2]], [wj[0], foot, wj[2]], wj, wi, o, sd > 0 ? putz : shade(putz, 0.9));
      }
    }
    // Fenster und Fachwerk auf den Längswänden (alle 2,6 m, je Geschoss)
    for (let k = 1; k + 1 < h.length; k += 3) {
      const i = h[k];
      for (const sd of [-1, 1]) {
        const W = t.wh[i] + WALL_T + EAVE - 0.4 + 0.04;
        const top = P(i, 0, sd * W, -DROP + 0.05)[1];
        const o = out(i, sd);
        for (let y = top - 2.4; y > low + 1; y -= 3) {
          const c0 = P(i, 0, sd * W, 0);
          const ax = t.tx[i];
          const az = t.tz[i];
          const q = (u: number, yy: number): V3 => [c0[0] + ax * u, yy, c0[2] + az * u];
          if (detail) face(det, q(-0.65, y - 0.1), q(0.65, y - 0.1), q(0.65, y + 1.5), q(-0.65, y + 1.5), o, RAHMEN);
          face(det, q(-0.5, y), q(0.5, y), q(0.5, y + 1.4), q(-0.5, y + 1.4), o, (k + Math.round(y)) % 3 === 0 ? GLAS_HELL : GLAS);
          if (detail && fach) {
            face(det, q(-1.3, y - 0.65), q(1.3, y - 0.65), q(1.3, y - 0.4), q(-1.3, y - 0.4), o, balk);
            face(det, q(-1.32, y - 0.6), q(-1.1, y - 0.6), q(-1.1, y + 2.3), q(-1.32, y + 2.3), o, balk);
          }
        }
      }
    }
    // Giebel an beiden Enden
    for (const [i, s] of [
      [a, -1],
      [z, 1],
    ] as [number, number][]) {
      const W = t.wh[i] + WALL_T;
      const L = P(i, 0, -(W + EAVE - 0.4), -DROP + 0.05);
      const R = P(i, 0, W + EAVE - 0.4, -DROP + 0.05);
      const l2 = P(i, 0, -W, -0.1);
      const r2 = P(i, 0, W, -0.1);
      const o = fwd(i, s);
      face(body, [L[0], foot, L[2]], [R[0], foot, R[2]], R, L, o, shade(putz, 0.95));
      face(body, L, R, r2, l2, o, shade(putz, 0.95));
      // Stirnbrett der Dachflächen
      face(body, l2, L, P(i, 0, -(W + EAVE), -DROP), P(i, 0, -W, 0), o, shade(ziegel, 0.55));
      face(body, r2, R, P(i, 0, W + EAVE, -DROP), P(i, 0, W, 0), o, shade(ziegel, 0.55));
      // Fenster im Giebel
      const c = P(i, 0, 0, 0);
      const ox = rightX(t, i);
      const oz = rightZ(t, i);
      const q = (u: number, yy: number): V3 => [c[0] + ox * u + t.tx[i] * s * 0.05, yy, c[2] + oz * u + t.tz[i] * s * 0.05];
      for (let y = L[1] - 2.6; y > low + 1; y -= 3) {
        for (const u of [-W * 0.5, W * 0.5]) face(det, q(u - 0.5, y), q(u + 0.5, y), q(u + 0.5, y + 1.4), q(u - 0.5, y + 1.4), o, GLAS);
        if (detail && fach) face(det, q(-W - EAVE + 0.4, y - 0.6), q(W + EAVE - 0.4, y - 0.6), q(W + EAVE - 0.4, y - 0.35), q(-W - EAVE + 0.4, y - 0.35), o, balk);
      }
    }
    // Schornstein auf einer Dachfläche
    if (h.length > 6 && rnd() < 0.8) {
      const i = h[Math.floor(h.length / 2)];
      const sd = rnd() < 0.5 ? -1 : 1;
      const W = t.wh[i] + WALL_T;
      const c = P(i, 0, sd * (W + 1.3), -1.35);
      const top = P(i, 0, 0, 0)[1] + 1.6;
      body.box(c[0], (c[1] + top) / 2 - 0.3, c[2], 0.9, top - c[1] + 0.6, 0.9, KAMIN, Math.atan2(t.tx[i], t.tz[i]));
      body.box(c[0], top + 0.1, c[2], 1.1, 0.25, 1.1, KAMIN_KOPF, Math.atan2(t.tx[i], t.tz[i]));
    }
  }
  // Dachrampe hinunter zur Treppengasse: Holzböcke
  {
    const wood = SURFACE_INDEX.wood;
    for (const i of walkTo(sp.at(30.5), sp.at(32.2))) {
      if ((t.edge[i] & EDGE_DECK) === 0 || t.surf[i] !== wood || i % 3 !== 0) continue;
      for (const sd of [-1, 1]) {
        const p = P(i, 0, sd * (t.wh[i] + 0.2), -DECK_D);
        const g = ground(p[0], p[2]) - 0.5;
        if (p[1] - g < 0.4) continue;
        balken(body, [p[0], g, p[2]], p, 0.32, C_HOLZ_D);
      }
      const l = P(i, 0, -(t.wh[i] + 0.2), -DECK_D - 0.2);
      const r = P(i, 0, t.wh[i] + 0.2, -DECK_D - 0.2);
      balken(body, l, r, 0.3, C_HOLZ);
    }
  }

  // =====================================================================================================
  // Kirche: Festrampe, Kirchenschiff, Turm mit Glockenstube
  // =====================================================================================================
  const turm = TURM(t);
  // Der Turm steht so, dass seine Westseite genau an der Absprungkante liegt (dort beginnt der Gleitflug).
  const TH = 9; // halbe Seite des Turms
  const tSeg = (() => {
    let j = turm.seg;
    for (let k = 0; k < 60 && (t.edge[t.next[j]] & EDGE_GLIDE) === 0; k++) j = t.next[j];
    for (let k = 0; k < TH - 0.5; k++) j = t.prev[j];
    return j;
  })();
  const tA = (() => {
    let i = tSeg;
    for (let k = 0; k < TH; k++) i = t.prev[i];
    return i;
  })();
  const roadT = t.py[tSeg];
  const tFoot = turm.y - 2;
  const glocken: { x: number; y: number; z: number; rot: number; s: number; ph: number }[] = [];
  {
    // Turm: Ecken im Rahmen des Mittelabschnitts
    const rx = rightX(t, tSeg);
    const rz = rightZ(t, tSeg);
    const fx = t.tx[tSeg];
    const fz = t.tz[tSeg];
    const C = (u: number, v: number, y: number): V3 => [t.px[tSeg] + rx * u + fx * v, y, t.pz[tSeg] + rz * u + fz * v];
    const S = TH;
    const yB = roadT - DECK_D;
    const yO = roadT + 7.8;
    const yU = roadT + 13.5;
    const sides: [number, number, V3][] = [
      [1, 0, [rx, 0, rz]],
      [-1, 0, [-rx, 0, -rz]],
      [0, 1, [fx, 0, fz]],
      [0, -1, [-fx, 0, -fz]],
    ];
    const rot = Math.atan2(fx, fz);
    /** Quader im Rahmen des Turms: u quer, v längs, y Höhe (von – bis). */
    const kasten = (u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, col: RGB): void => {
      const c = C((u0 + u1) / 2, (v0 + v1) / 2, (y0 + y1) / 2);
      body.box(c[0], c[1], c[2], u1 - u0, y1 - y0, v1 - v0, col, rot);
    };
    // (body.box dreht um die Hochachse: Kantenlänge sx liegt quer zur Fahrbahn, sz längs – die Kästen sind symmetrisch.)
    const yL = roadT + 6.0;
    const P2 = 2.2;
    const open = t.wh[tSeg] + 0.6;
    for (const su of [-1, 1]) {
      for (const sv of [-1, 1]) {
        // Eckpfeiler der Glockenstube
        kasten(su > 0 ? S - P2 : -S, su > 0 ? S : -S + P2, sv > 0 ? S - P2 : -S, sv > 0 ? S : -S + P2, yB, yO, C_KIRCHE);
      }
      // Längsseiten (Nord, Süd): Mauer zwischen den Pfeilern mit einem schmalen Schallbogen
      kasten(su > 0 ? S - 1.1 : -S, su > 0 ? S : -S + 1.1, -S + P2, -2.2, yB, yO, C_KIRCHE_D);
      kasten(su > 0 ? S - 1.1 : -S, su > 0 ? S : -S + 1.1, 2.2, S - P2, yB, yO, C_KIRCHE_D);
      kasten(su > 0 ? S - 1.1 : -S, su > 0 ? S : -S + 1.1, -2.2, 2.2, yB, roadT + 1.2, C_KIRCHE_D);
      kasten(su > 0 ? S - 1.1 : -S, su > 0 ? S : -S + 1.1, -2.2, 2.2, roadT + 5.2, yO, C_KIRCHE_D);
    }
    // Ost- und Westseite: Pfeiler bis an die Fahrbahn, Sturz darüber, die Ecken des Bogens gerundet
    for (const sv of [-1, 1]) {
      const v0 = sv > 0 ? S - 1.1 : -S;
      const v1 = sv > 0 ? S : -S + 1.1;
      kasten(-S + P2, -open, v0, v1, yB, yO, C_KIRCHE);
      kasten(open, S - P2, v0, v1, yB, yO, C_KIRCHE);
      kasten(-open, open, v0, v1, yL, yO, C_KIRCHE);
      const o: V3 = [fx * sv, 0, fz * sv];
      for (const vv of [sv > 0 ? S + 0.01 : -S - 0.01, sv > 0 ? S - 1.11 : -S + 1.11]) {
        const oo: V3 = vv === (sv > 0 ? S + 0.01 : -S - 0.01) ? o : [-o[0], 0, -o[2]];
        for (const uu of [-1, 1]) {
          const steps = 4;
          for (let q = 0; q < steps; q++) {
            const a0 = (q / steps) * (Math.PI / 2);
            const a1 = ((q + 1) / steps) * (Math.PI / 2);
            const R = 2.6;
            const cu = uu * (open - R);
            const cy = yL - R;
            const p0 = C(cu + uu * Math.sin(a0) * R, vv, cy + Math.cos(a0) * R);
            const p1 = C(cu + uu * Math.sin(a1) * R, vv, cy + Math.cos(a1) * R);
            const corner = C(uu * open, vv, yL);
            tri(body, p0, p1, corner, oo, C_KIRCHE_H);
          }
        }
      }
      // Gesims unter der Glockenstube
      kasten(-S - 0.3, S + 0.3, sv > 0 ? S - 0.2 : -S - 0.3, sv > 0 ? S + 0.3 : -S + 0.2, yB - 0.6, yB, C_KIRCHE_D);
    }
    for (const [su, sv, o] of sides) {
      // Ecken der Seite (von links nach rechts von außen gesehen)
      const p0 = su !== 0 ? C(su * S, -S * su, 0) : C(S * sv, sv * S, 0);
      const p1 = su !== 0 ? C(su * S, S * su, 0) : C(-S * sv, sv * S, 0);
      const at = (k: number, y: number): V3 => [p0[0] + (p1[0] - p0[0]) * k, y, p0[2] + (p1[2] - p0[2]) * k];
      const col = su !== 0 ? C_KIRCHE : C_KIRCHE_D;
      // Schaft bis unter die Glockenstube
      face(body, at(0, tFoot), at(1, tFoot), at(1, yB), at(0, yB), o, col);
      // Uhrgeschoss
      face(body, at(0, yO), at(1, yO), at(1, yU), at(0, yU), o, shade(col, 1.04));
      face(body, at(-0.02, yO - 0.4), at(1.02, yO - 0.4), at(1.02, yO + 0.3), at(-0.02, yO + 0.3), o, C_KIRCHE_D);
      // Zifferblatt
      const cc = at(0.5, yO + 2.8);
      const ox = o[0] * 0.08;
      const oz = o[2] * 0.08;
      const ax = (p1[0] - p0[0]) / (2 * S);
      const az = (p1[2] - p0[2]) / (2 * S);
      const rr = 2.1;
      for (let k = 0; k < 16; k++) {
        const a0 = (k / 16) * TAU;
        const a1 = ((k + 1) / 16) * TAU;
        tri(det, [cc[0] + ox, cc[1], cc[2] + oz], [cc[0] + ox + ax * Math.cos(a0) * rr, cc[1] + Math.sin(a0) * rr, cc[2] + oz + az * Math.cos(a0) * rr], [cc[0] + ox + ax * Math.cos(a1) * rr, cc[1] + Math.sin(a1) * rr, cc[2] + oz + az * Math.cos(a1) * rr], o, k % 4 === 0 ? C_GOLD : C_UHR);
      }
      // Zeiger (zehn vor zwei – wie auf jedem Prospekt)
      for (const [ang, len] of [
        [Math.PI * 0.62, 1.6],
        [Math.PI * 0.17, 1.2],
      ] as [number, number][]) {
        const ex = ax * Math.cos(ang) * len;
        const ey = Math.sin(ang) * len;
        const ez = az * Math.cos(ang) * len;
        const nx = -ax * Math.sin(ang) * 0.09;
        const ny = Math.cos(ang) * 0.09;
        const nz = -az * Math.sin(ang) * 0.09;
        face(det, [cc[0] + ox * 2 - nx, cc[1] - ny, cc[2] + oz * 2 - nz], [cc[0] + ox * 2 + nx, cc[1] + ny, cc[2] + oz * 2 + nz], [cc[0] + ox * 2 + ex + nx, cc[1] + ey + ny, cc[2] + oz * 2 + ez + nz], [cc[0] + ox * 2 + ex - nx, cc[1] + ey - ny, cc[2] + oz * 2 + ez - nz], o, C_TRAM_DUNKEL);
      }
    }
    // Decke der Glockenstube und Gesims
    face(body, C(-S, -S, yO - 0.1), C(S, -S, yO - 0.1), C(S, S, yO - 0.1), C(-S, S, yO - 0.1), [0, -1, 0], C_KIRCHE_D);
    // Turmhelm: achteckige Pyramide mit Kugel und Wetterhahn
    const top = yU + 22;
    const n = 8;
    const ring: V3[] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + Math.PI / 8;
      ring.push(C(Math.cos(a) * S * 1.08, Math.sin(a) * S * 1.08, yU));
    }
    for (let k = 0; k < n; k++) {
      const p = ring[k];
      const q = ring[(k + 1) % n];
      const mx = (p[0] + q[0]) / 2 - t.px[tSeg];
      const mz = (p[2] + q[2]) / 2 - t.pz[tSeg];
      tri(body, p, q, C(0, 0, top), [mx, 2.5, mz], k % 2 ? C_KUPFER : C_KUPFER_D);
      // Traufkranz
      face(body, [p[0], yU - 0.6, p[2]], [q[0], yU - 0.6, q[2]], q, p, [mx, 0, mz], C_KIRCHE_D);
    }
    for (let k = 0; k < 4; k++) {
      // vier Eckspitzen
      const cu = (k < 2 ? 1 : -1) * S * 0.95;
      const cv = (k % 2 ? 1 : -1) * S * 0.95;
      const b = C(cu, cv, yU);
      const pk = C(cu, cv, yU + 5);
      for (let q = 0; q < 4; q++) {
        const a0 = (q / 4) * TAU;
        const a1 = ((q + 1) / 4) * TAU;
        tri(body, [b[0] + Math.cos(a0) * 0.9, yU, b[2] + Math.sin(a0) * 0.9], [b[0] + Math.cos(a1) * 0.9, yU, b[2] + Math.sin(a1) * 0.9], pk, [Math.cos((a0 + a1) / 2), 0.5, Math.sin((a0 + a1) / 2)], C_KUPFER_D);
      }
    }
    const kugel = C(0, 0, top + 0.6);
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * TAU;
      const a1 = ((k + 1) / 6) * TAU;
      tri(body, [kugel[0] + Math.cos(a0) * 0.7, kugel[1], kugel[2] + Math.sin(a0) * 0.7], [kugel[0] + Math.cos(a1) * 0.7, kugel[1], kugel[2] + Math.sin(a1) * 0.7], [kugel[0], kugel[1] + 0.8, kugel[2]], [Math.cos(a0), 1, Math.sin(a0)], C_GOLD);
      tri(body, [kugel[0] + Math.cos(a0) * 0.7, kugel[1], kugel[2] + Math.sin(a0) * 0.7], [kugel[0] + Math.cos(a1) * 0.7, kugel[1], kugel[2] + Math.sin(a1) * 0.7], [kugel[0], kugel[1] - 0.8, kugel[2]], [Math.cos(a0), -1, Math.sin(a0)], C_GOLD);
    }
    balken(body, C(0, 0, top), C(0, 0, top + 4), 0.14, C_GOLD);
    // Wetterhahn
    const h0 = C(0, 0, top + 3.2);
    tri(body, [h0[0] - fx * 1.1, h0[1], h0[2] - fz * 1.1], [h0[0] + fx * 1.1, h0[1], h0[2] + fz * 1.1], [h0[0] + fx * 0.6, h0[1] + 1.2, h0[2] + fz * 0.6], [rx, 0, rz], C_GOLD);
    tri(body, [h0[0] - fx * 1.1, h0[1], h0[2] - fz * 1.1], [h0[0] + fx * 0.6, h0[1] + 1.2, h0[2] + fz * 0.6], [h0[0] + fx * 1.1, h0[1], h0[2] + fz * 1.1], [-rx, 0, -rz], C_GOLD);
    // Glocken in der Glockenstube: eine große über der Mitte, zwei kleine darüber seitlich
    glocken.push({ ...xyz(C(0, 0, roadT + 6.6)), rot: Math.atan2(fx, fz), s: 1.35, ph: 0 });
    glocken.push({ ...xyz(C(-3.6, 0, roadT + 6.9)), rot: Math.atan2(fx, fz), s: 0.95, ph: 1.7 });
    glocken.push({ ...xyz(C(3.6, 0, roadT + 6.9)), rot: Math.atan2(fx, fz), s: 0.95, ph: 3.1 });
    // Glockenstuhl: Balken quer über die Stube
    balken(body, C(-S + 2.2, 0, roadT + 7.4), C(S - 2.2, 0, roadT + 7.4), 0.45, C_HOLZ_D);
  }
  {
    // Kirchenschiff unter dem Laufsteg auf dem First: vom Ostgiebel bis an den Turm
    const nave = walkTo(sp.at(16.7), tA);
    const SH = 6.6;
    const SW = 6.4;
    const navFoot = turm.y - 2;
    for (let k = 0; k + 1 < nave.length; k++) {
      const i = nave[k];
      const j = nave[k + 1];
      for (const sd of [-1, 1]) {
        const Wi = t.wh[i] + WALL_T;
        const Wj = t.wh[j] + WALL_T;
        const o = out(i, sd);
        face(body, P(i, 0, sd * Wi, -0.08), P(j, 0, sd * Wj, -0.08), P(j, 0, sd * (Wj + SW + 0.6), -SH - 0.5), P(i, 0, sd * (Wi + SW + 0.6), -SH - 0.5), [o[0], 1, o[2]], k % 2 ? C_BLEI : shade(C_BLEI, 0.94));
        const wi = P(i, 0, sd * (Wi + SW), -SH);
        const wj = P(j, 0, sd * (Wj + SW), -SH);
        face(body, [wi[0], navFoot, wi[2]], [wj[0], navFoot, wj[2]], wj, wi, o, sd > 0 ? C_KIRCHE : C_KIRCHE_D);
      }
    }
    // Strebepfeiler und Spitzbogenfenster
    for (let k = 2; k + 2 < nave.length; k += 6) {
      const i = nave[k];
      for (const sd of [-1, 1]) {
        const W = t.wh[i] + WALL_T + SW;
        const top = P(i, 0, sd * W, -SH)[1];
        const o = out(i, sd);
        const b = P(i, 0, sd * (W + 0.7), 0);
        body.box(b[0], (navFoot + top - 1) / 2, b[2], 1.4, top - 1 - navFoot, 1.1, C_KIRCHE_D, Math.atan2(t.tx[i], t.tz[i]));
        const c = P(t.next[t.next[t.next[i]]], 0, sd * (W + 0.05), 0);
        const q = (u: number, y: number): V3 => [c[0] + t.tx[i] * u, y, c[2] + t.tz[i] * u];
        const y0 = navFoot + 3;
        const y1 = top - 2.4;
        face(det, q(-0.9, y0), q(0.9, y0), q(0.9, y1), q(-0.9, y1), o, pick(C_ROSE));
        tri(det, q(-0.9, y1), q(0.9, y1), q(0, y1 + 1.4), o, C_ROSE[0]);
        face(det, q(-0.08, y0), q(0.08, y0), q(0.08, y1 + 1), q(-0.08, y1 + 1), o, C_KIRCHE_D);
      }
    }
    // Ostgiebel mit Rosette
    const i = nave[0];
    const W = t.wh[i] + WALL_T;
    const o = fwd(i, -1);
    const L = P(i, 0, -(W + SW), -SH);
    const R = P(i, 0, W + SW, -SH);
    face(body, [L[0], navFoot, L[2]], [R[0], navFoot, R[2]], R, L, o, C_KIRCHE);
    face(body, L, R, P(i, 0, W, -0.2), P(i, 0, -W, -0.2), o, C_KIRCHE);
    const c = P(i, 0, 0, -SH - 1);
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * TAU;
      const a1 = ((k + 1) / 12) * TAU;
      const rx = rightX(t, i);
      const rz = rightZ(t, i);
      tri(det, [c[0] - t.tx[i] * 0.06, c[1], c[2] - t.tz[i] * 0.06], [c[0] - t.tx[i] * 0.06 + rx * Math.cos(a0) * 2.4, c[1] + Math.sin(a0) * 2.4, c[2] - t.tz[i] * 0.06 + rz * Math.cos(a0) * 2.4], [c[0] - t.tx[i] * 0.06 + rx * Math.cos(a1) * 2.4, c[1] + Math.sin(a1) * 2.4, c[2] - t.tz[i] * 0.06 + rz * Math.cos(a1) * 2.4], o, C_ROSE[k % 4]);
    }
  }
  {
    // Festrampe: Holzböcke vom Domplatz bis an den Ostgiebel, mit Wimpeln am Geländer
    const ramp = walkTo(sp.at(15.8), sp.at(16.75));
    for (let k = 0; k < ramp.length; k += 4) {
      const i = ramp[k];
      const L = P(i, 0, -(t.wh[i] + 0.3), -DECK_D);
      const R = P(i, 0, t.wh[i] + 0.3, -DECK_D);
      const gl = ground(L[0], L[2]) - 0.4;
      const gr = ground(R[0], R[2]) - 0.4;
      if (L[1] - gl > 0.5) balken(body, [L[0], gl, L[2]], L, 0.34, C_HOLZ_D);
      if (R[1] - gr > 0.5) balken(body, [R[0], gr, R[2]], R, 0.34, C_HOLZ_D);
      balken(body, P(i, 0, -(t.wh[i] + 0.3), -DECK_D - 0.25), P(i, 0, t.wh[i] + 0.3, -DECK_D - 0.25), 0.3, C_HOLZ);
      if (k % 8 === 0 && L[1] - gl > 3) balken(body, [L[0], gl + 0.5, L[2]], [R[0], R[1] - 0.6, R[2]], 0.22, C_HOLZ);
    }
    // Wimpelkette von Pfosten zu Pfosten längs der Rampe (beide Seiten)
    for (const sd of [-1, 1]) {
      for (let k = 0; k + 8 < ramp.length; k += 8) {
        const a = P(ramp[k], 0, sd * (t.wh[ramp[k]] + 0.6), 2.4);
        const b = P(ramp[k + 8], 0, sd * (t.wh[ramp[k + 8]] + 0.6), 2.4);
        wimpel(det, a, b, 0.5, k / 8 + (sd > 0 ? 3 : 0));
        pfosten(body, a[0], a[2], a[1] - 2.6, a[1] + 0.2, 0.08, C_HOLZ_D);
      }
    }
  }

  // =====================================================================================================
  // Markthalle über der Abkürzung durch sie
  // =====================================================================================================
  {
    const b = t.branches[1];
    const straw = SURFACE_INDEX.straw;
    const segs: number[] = [];
    if (b) for (let g = b.first; g < b.first + b.count; g++) if (t.surf[g] === straw) segs.push(g);
    if (segs.length > 4) {
      // ein Stück davor und dahinter
      for (let k = 0; k < 3; k++) {
        segs.unshift(t.prev[segs[0]]);
        segs.push(t.next[segs[segs.length - 1]]);
      }
      const mainNear = (x: number, z: number, m: number): boolean => {
        for (let i = 0; i < t.total; i += 2) {
          if (t.branchOf[i] === 1) continue;
          if (Math.hypot(x - t.px[i], z - t.pz[i]) < t.wh[i] + m) return true;
        }
        return false;
      };
      const H0 = 6.2;
      const H1 = 11.5;
      for (let k = 0; k + 1 < segs.length; k++) {
        const i = segs[k];
        const j = segs[k + 1];
        for (const sd of [-1, 1]) {
          const Wi = t.wh[i] + 3.4;
          const Wj = t.wh[j] + 3.4;
          const o = out(i, sd);
          face(body, P(i, 0, sd * Wi, H0), P(j, 0, sd * Wj, H0), P(j, 0, 0, H1), P(i, 0, 0, H1), [o[0], 1, o[2]], k % 2 ? C_HALLE : shade(C_HALLE, 0.94));
          face(body, P(i, 0, sd * Wi, H0 - 0.05), P(j, 0, sd * Wj, H0 - 0.05), P(j, 0, 0, H1 - 0.3), P(i, 0, 0, H1 - 0.3), [-o[0], -1, -o[2]], rgb(0x6a4030));
        }
        // Dachreiter: Laterne auf dem First
        if (k > 4 && k + 5 < segs.length) {
          for (const sd of [-1, 1]) face(body, P(i, 0, sd * 1.6, H1 - 0.2), P(j, 0, sd * 1.6, H1 - 0.2), P(j, 0, sd * 1.6, H1 + 1.2), P(i, 0, sd * 1.6, H1 + 1.2), out(i, sd), k % 2 ? C_EISEN : GLAS_HELL);
          face(body, P(i, 0, -2, H1 + 1.2), P(j, 0, -2, H1 + 1.2), P(j, 0, 0, H1 + 2.2), P(i, 0, 0, H1 + 2.2), [-rightX(t, i), 1, -rightZ(t, i)], C_HALLE);
          face(body, P(i, 0, 2, H1 + 1.2), P(j, 0, 2, H1 + 1.2), P(j, 0, 0, H1 + 2.2), P(i, 0, 0, H1 + 2.2), [rightX(t, i), 1, rightZ(t, i)], shade(C_HALLE, 0.9));
        }
        // Säulen alle 6 m, Stände dazwischen
        if (k % 6 === 0) {
          for (const sd of [-1, 1]) {
            const p = P(i, 0, sd * (t.wh[i] + 3), 0);
            if (mainNear(p[0], p[2], 0.9)) continue;
            pfosten(body, p[0], p[2], ground(p[0], p[2]) - 0.5, p[1] + H0, 0.22, C_EISEN, 8);
            balken(body, P(i, 0, sd * (t.wh[i] + 3), H0 - 0.6), P(i, 0, 0, H1 - 0.8), 0.18, C_EISEN_D);
          }
        }
        if (k % 4 === 2 && k + 3 < segs.length) {
          for (const sd of [-1, 1]) {
            const p = P(i, 0, sd * (t.wh[i] + 1.5), 0);
            if (mainNear(p[0], p[2], 1.5)) continue;
            const rot = Math.atan2(t.tx[i], t.tz[i]);
            body.box(p[0], p[1] + 0.45, p[2], 1.2, 0.9, 3, C_HOLZ, rot);
            for (let q = 0; q < 3; q++) {
              const c = P(t.next[i], q / 3 - 0.33, sd * (t.wh[i] + 1.5), 0);
              det.box(c[0], p[1] + 1.05, c[2], 0.9, 0.3, 0.8, C_OBST[(k + q) % C_OBST.length], rot);
            }
            const m = C_MARKISE[(k + (sd > 0 ? 1 : 0)) % C_MARKISE.length];
            const a0 = P(i, 0, sd * (t.wh[i] + 0.9), 2.3);
            const a1 = P(j, 2, sd * (t.wh[i] + 0.9), 2.3);
            const b0 = P(i, 0, sd * (t.wh[i] + 2.3), 2.9);
            const b1 = P(j, 2, sd * (t.wh[i] + 2.3), 2.9);
            face(det, a0, a1, b1, b0, [0, 1, 0], m);
          }
        }
      }
      // Giebeldreiecke über den Toren
      for (const [i, s] of [
        [segs[0], -1],
        [segs[segs.length - 1], 1],
      ] as [number, number][]) {
        const W = t.wh[i] + 3.4;
        const o = fwd(i, s);
        tri(body, P(i, 0, -W, H0), P(i, 0, W, H0), P(i, 0, 0, H1), o, C_STEIN_H);
        face(body, P(i, 0, -W, H0 - 1.2), P(i, 0, W, H0 - 1.2), P(i, 0, W, H0), P(i, 0, -W, H0), o, C_STEIN);
        // Uhr im Giebel
        const c = P(i, 0, 0, H0 + 2.2);
        const rx = rightX(t, i);
        const rz = rightZ(t, i);
        for (let k = 0; k < 10; k++) {
          const a0 = (k / 10) * TAU;
          const a1 = ((k + 1) / 10) * TAU;
          tri(det, [c[0] + o[0] * 0.05, c[1], c[2] + o[2] * 0.05], [c[0] + o[0] * 0.05 + rx * Math.cos(a0), c[1] + Math.sin(a0), c[2] + o[2] * 0.05 + rz * Math.cos(a0)], [c[0] + o[0] * 0.05 + rx * Math.cos(a1), c[1] + Math.sin(a1), c[2] + o[2] * 0.05 + rz * Math.cos(a1)], o, k % 5 === 0 ? C_GOLD : C_UHR);
        }
        // Wimpel quer über das Tor
        // (hoch genug, dass die Kamera hinter einem Kart darunter durchpasst)
        wimpel(det, P(i, 0, -W + 0.5, H0 - 0.4), P(i, 0, W - 0.5, H0 - 0.4), 0.4, s > 0 ? 1 : 4);
      }
    }
  }

  // =====================================================================================================
  // Kanal und Hafen: Kaimauern, Kaikante, Poller, Brücken
  // =====================================================================================================
  const w = wasser(t);
  const KB = kaiBreite(world.terrainCell);
  /** Liegt hier eine Fahrbahn am Boden, tief genug, dass die Kaikante sie bedeckte (Treppe, Slip)? */
  const lowRoad = (x: number, z: number, m: number): boolean => {
    for (let i = 0; i < t.total; i += 2) {
      if ((t.edge[i] & (EDGE_DECK | EDGE_GLIDE)) !== 0 || t.py[i] > KAI_Y + 1.6) continue;
      if (t.deep[i] && t.py[i] < -1.2) continue;
      if (Math.hypot(x - t.px[i], z - t.pz[i]) < t.wh[i] + m) return true;
    }
    return false;
  };
  {
    const ks = w.kanal;
    for (let k = 0; k + 2 < ks.length; k += 2) {
      const i = ks[k];
      const j = ks[k + 2];
      if (j - i > 4) continue;
      for (const sd of [-1, 1]) {
        const o = out(i, sd);
        const io: V3 = [-o[0], 0, -o[2]];
        const B = w.breite;
        const pts = [P(i, 0, sd * B, 0), P(j, 0, sd * B, 0), P(j, 0, sd * (B + KB), 0), P(i, 0, sd * (B + KB), 0)];
        if (pts.some((p) => lowRoad(p[0], p[2], 0.6)) || lowRoad((pts[0][0] + pts[2][0]) / 2, (pts[0][2] + pts[2][2]) / 2, 0.6)) continue;
        if (pts.some((p) => polyDist(HAFEN, p[0], p[2]) < -1)) continue;
        const [a, b2, c, d] = pts.map((p): V3 => [p[0], KAI_Y, p[2]]);
        // Mauer zum Wasser
        face(body, [a[0], KANAL_GRUND - 0.5, a[2]], [b2[0], KANAL_GRUND - 0.5, b2[2]], b2, a, io, k % 4 ? C_STEIN : C_STEIN_D);
        // Kaikante: Pflaster, ein heller Rand an der Mauer
        face(body, a, b2, c, d, UP, C_KAI);
        face(det, [a[0], KAI_Y + 0.02, a[2]], [b2[0], KAI_Y + 0.02, b2[2]], P(j, 0, sd * (B + 0.7), KAI_Y + 0.02 - t.py[j]), P(i, 0, sd * (B + 0.7), KAI_Y + 0.02 - t.py[i]), UP, C_STEIN_H);
        // Außenkante (zum Gelände hin, meist darunter)
        face(body, [d[0], KANAL_GRUND, d[2]], [c[0], KANAL_GRUND, c[2]], c, d, o, C_KAI_D);
        // Poller
        if (k % 14 === 0) pfosten(body, a[0] + o[0] * 0.8, a[2] + o[2] * 0.8, KAI_Y, KAI_Y + 0.75, 0.22, C_POLLER);
      }
    }
    // Hafen: Kaimauer an der Nordkante des Beckens (vom Slip bis zur Mole)
    for (let e = 0; e + 1 < HAFEN.length; e++) {
      const [ax, az] = HAFEN[e];
      const [bx, bz] = HAFEN[e + 1];
      if (az > 300 || bz > 300 || ax > 330 || bx > 330) continue;
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 3));
      let nx = -(bz - az) / len;
      let nz = (bx - ax) / len;
      // zum Land hin (außerhalb des Beckens)
      if (polyDist(HAFEN, (ax + bx) / 2 + nx * 2, (az + bz) / 2 + nz * 2) < 0) {
        nx = -nx;
        nz = -nz;
      }
      for (let s = 0; s < n; s++) {
        const x0 = ax + ((bx - ax) * s) / n;
        const z0 = az + ((bz - az) * s) / n;
        const x1 = ax + ((bx - ax) * (s + 1)) / n;
        const z1 = az + ((bz - az) * (s + 1)) / n;
        const pts: V3[] = [
          [x0, KAI_Y, z0],
          [x1, KAI_Y, z1],
          [x1 + nx * KB, KAI_Y, z1 + nz * KB],
          [x0 + nx * KB, KAI_Y, z0 + nz * KB],
        ];
        if (pts.some((p) => lowRoad(p[0], p[2], 0.8)) || w.kanalRand(x0, z0) < 0 || w.kanalRand(x1, z1) < 0) continue;
        face(body, [x0, KANAL_GRUND - 0.5, z0], [x1, KANAL_GRUND - 0.5, z1], pts[1], pts[0], [-nx, 0, -nz], s % 2 ? C_STEIN : C_STEIN_D);
        face(body, pts[0], pts[1], pts[2], pts[3], UP, C_KAI);
        face(body, [pts[3][0], KANAL_GRUND, pts[3][2]], [pts[2][0], KANAL_GRUND, pts[2][2]], pts[2], pts[3], [nx, 0, nz], C_KAI_D);
        if (s % 5 === 0) pfosten(body, x0 + nx * 0.8, z0 + nz * 0.8, KAI_Y, KAI_Y + 0.75, 0.22, C_POLLER);
      }
    }
    // Brücke der Langen Gasse: steinerner Bogen unter der Fahrbahn (darunter taucht man hindurch)
    const bridge = walkTo(sp.at(45.4), sp.at(46.25)).filter((i) => (t.edge[i] & EDGE_DECK) !== 0);
    if (bridge.length > 4) {
      const n = bridge.length;
      const crown = t.py[bridge[n >> 1]] - DECK_D - 0.7;
      const spring = KAI_Y - 1.8;
      const arch = (u: number): number => spring + (crown - spring) * Math.sin(Math.PI * Math.max(0, Math.min(1, u))) ** 0.55;
      for (let k = 0; k + 1 < n; k++) {
        const i = bridge[k];
        const j = bridge[k + 1];
        const yi = arch(k / (n - 1));
        const yj = arch((k + 1) / (n - 1));
        const W = t.wh[i] + WALL_T;
        for (const sd of [-1, 1]) {
          const o = out(i, sd);
          const ti = P(i, 0, sd * W, -DECK_D);
          const tj = P(j, 0, sd * W, -DECK_D);
          face(body, [ti[0], yi, ti[2]], [tj[0], yj, tj[2]], tj, ti, o, k % 3 ? C_STEIN : C_STEIN_H);
        }
        // Gewölbe
        const li = P(i, 0, -W, 0);
        const ri = P(i, 0, W, 0);
        const lj = P(j, 0, -W, 0);
        const rj = P(j, 0, W, 0);
        face(body, [li[0], yi, li[2]], [ri[0], yi, ri[2]], [rj[0], yj, rj[2]], [lj[0], yj, lj[2]], [0, -1, 0], C_STEIN_D);
      }
      // Schlussstein mit Stadtwappen (rot-weiß) über dem Bogen
      for (const sd of [-1, 1]) {
        const i = bridge[n >> 1];
        const c = P(i, 0, sd * (t.wh[i] + WALL_T + 0.05), -DECK_D - 0.5);
        const o = out(i, sd);
        const q = (u: number, y: number): V3 => [c[0] + t.tx[i] * u, c[1] + y, c[2] + t.tz[i] * u];
        face(det, q(-0.8, -0.9), q(0.8, -0.9), q(0.8, 0.5), q(-0.8, 0.5), o, C_FAHNE);
        face(det, q(-0.25, -0.9), q(0.25, -0.9), q(0.25, 0.5), q(-0.25, 0.5), [o[0] * 1.01, 0, o[2] * 1.01], C_WEISS);
      }
    }
    // Fußgängersteg über den Kanal (leichter Bogen, hoch über dem Wasser)
    if (ks.length > 40) {
      const i = ks[Math.floor(ks.length * 0.42)];
      const B = w.breite + 1;
      const n = 10;
      const at = (u: number, l: number, y: number): V3 => P(i, 0, -B + 2 * B * u, 0).map((v, q) => (q === 1 ? KAI_Y + 0.6 + Math.sin(Math.PI * u) * 1.8 + y : v + (q === 0 ? t.tx[i] * l : t.tz[i] * l))) as V3;
      for (let k = 0; k < n; k++) {
        const u0 = k / n;
        const u1 = (k + 1) / n;
        face(body, at(u0, -1.6, 0), at(u1, -1.6, 0), at(u1, 1.6, 0), at(u0, 1.6, 0), UP, C_HOLZ);
        face(body, at(u0, -1.6, -0.35), at(u1, -1.6, -0.35), at(u1, 1.6, -0.35), at(u0, 1.6, -0.35), [0, -1, 0], C_HOLZ_D);
        for (const l of [-1.6, 1.6]) {
          face(det, at(u0, l, 1.0), at(u1, l, 1.0), at(u1, l, 1.12), at(u0, l, 1.12), fwd(i, l), C_EISEN);
          if (k % 2 === 0) balken(body, at(u0, l, 0), at(u0, l, 1.1), 0.1, C_EISEN);
        }
      }
    }
    // Hafenbrücke an der Mündung: ein flacher Steinbogen, auf dem der Kai über den Kanal läuft
    {
      let mouth = -1;
      for (const i of ks) if (polyDist(HAFEN, t.px[i], t.pz[i]) < 9) mouth = i;
      if (mouth >= 0) {
        const B = w.breite;
        const D = 4.5;
        const n = 12;
        const at = (u: number, l: number, y: number): V3 => {
          const p = P(mouth, 0, -B + 2 * B * u, 0);
          return [p[0] + t.tx[mouth] * l, y, p[2] + t.tz[mouth] * l];
        };
        const archY = (u: number): number => KAI_Y - 0.6 + 0.0 * u - (1 - Math.sin(Math.PI * u) ** 0.5) * 3.2 + 0.9;
        for (let k = 0; k < n; k++) {
          const u0 = k / n;
          const u1 = (k + 1) / n;
          face(body, at(u0, -D, KAI_Y + 0.3), at(u1, -D, KAI_Y + 0.3), at(u1, D, KAI_Y + 0.3), at(u0, D, KAI_Y + 0.3), UP, C_KAI);
          for (const l of [-D, D]) {
            const o = fwd(mouth, l);
            face(body, at(u0, l, archY(u0)), at(u1, l, archY(u1)), at(u1, l, KAI_Y + 1.2), at(u0, l, KAI_Y + 1.2), o, k % 3 ? C_STEIN : C_STEIN_H);
          }
          face(body, at(u0, -D, archY(u0)), at(u1, -D, archY(u1)), at(u1, D, archY(u1)), at(u0, D, archY(u0)), [0, -1, 0], C_STEIN_D);
        }
      }
    }
  }

  // =====================================================================================================
  // Bastei: runder Mauerturm im Innern der Kehre, mit Zinnen und Stadtfahne
  // =====================================================================================================
  {
    const b = BASTEI(t);
    const g = ground(b.x, b.z);
    const y0 = g - 3;
    const y1 = g + 9;
    const n = 24;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * TAU;
      const a1 = ((k + 1) / n) * TAU;
      const p0: V3 = [b.x + Math.cos(a0) * b.r, y0, b.z + Math.sin(a0) * b.r];
      const p1: V3 = [b.x + Math.cos(a1) * b.r, y0, b.z + Math.sin(a1) * b.r];
      // leicht geböschte Mauer
      const q1: V3 = [b.x + Math.cos(a1) * (b.r - 0.8), y1, b.z + Math.sin(a1) * (b.r - 0.8)];
      const q0: V3 = [b.x + Math.cos(a0) * (b.r - 0.8), y1, b.z + Math.sin(a0) * (b.r - 0.8)];
      const o: V3 = [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)];
      face(body, p0, p1, q1, q0, o, k % 2 ? C_STEIN : C_STEIN_D);
      // Zinnen
      if (k % 2 === 0) face(body, q0, q1, [q1[0], y1 + 1.4, q1[2]], [q0[0], y1 + 1.4, q0[2]], o, C_STEIN_H);
      // Wehrgang (Boden oben)
      tri(body, [b.x, y1 - 0.4, b.z], q0, q1, UP, rgb(0x9a8e78));
      // Gesims
      face(det, [b.x + Math.cos(a0) * (b.r - 0.55), y1 - 1.4, b.z + Math.sin(a0) * (b.r - 0.55)], [b.x + Math.cos(a1) * (b.r - 0.55), y1 - 1.4, b.z + Math.sin(a1) * (b.r - 0.55)], [b.x + Math.cos(a1) * (b.r - 0.55), y1 - 1.0, b.z + Math.sin(a1) * (b.r - 0.55)], [b.x + Math.cos(a0) * (b.r - 0.55), y1 - 1.0, b.z + Math.sin(a0) * (b.r - 0.55)], o, C_STEIN_H);
    }
    // Fahnenmast mit großer Stadtfahne (rot-weiß)
    pfosten(body, b.x, b.z, y1 - 0.4, y1 + 16, 0.18, C_WEISS);
    const fy = y1 + 15.5;
    face(body, [b.x, fy, b.z], [b.x + 6.5, fy - 0.4, b.z + 1], [b.x + 6.5, fy - 2.4, b.z + 1], [b.x, fy - 2.8, b.z], [0, 0, 1], C_FAHNE);
    face(body, [b.x, fy - 2.8, b.z], [b.x + 6.5, fy - 2.4, b.z + 1], [b.x + 6.5, fy - 4.4, b.z + 1], [b.x, fy - 5.6, b.z], [0, 0, 1], C_WEISS);
    // Wimpelketten vom Mast hinunter zum Rand (Festschmuck)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.3;
      wimpel(det, [b.x, y1 + 12, b.z], [b.x + Math.cos(a) * (b.r - 1.5), y1 + 1.2, b.z + Math.sin(a) * (b.r - 1.5)], 0.8, k);
    }
  }

  // =====================================================================================================
  // Straßenbahn: Gleis, Oberleitung, Haltestelle, Remise, Torhaus
  // =====================================================================================================
  const trams = t.vehicles.filter((v) => v.kind === VEH_STADTBAHN && v.line);
  {
    const v = trams[0];
    const l = v?.line;
    if (l) {
      const GAUGE = 0.72;
      // Gleis: Bett, zwei Schienen mit Rille, alle 2 m ein Stück
      const pt = (i: number, off: number, dy: number): V3 => {
        const a = Math.max(0, i - 1);
        const b = Math.min(l.n - 1, i + 1);
        const hx = l.x[b] - l.x[a];
        const hz = l.z[b] - l.z[a];
        const hl = Math.hypot(hx, hz) || 1;
        const rx = -hz / hl;
        const rz = hx / hl;
        // auf der Fahrbahn: deren Höhe an dieser Stelle (Querneigung), daneben die Höhe der Linie
        return [l.x[i] + rx * off, l.y[i] + dy, l.z[i] + rz * off];
      };
      for (let i = 0; i + 2 < l.n; i += 2) {
        const j = i + 2;
        const onRoad = Math.abs(l.lat[i] - v.lat) < 0.6;
        const dy = 0.035;
        if (!onRoad) face(flat, pt(i, -1.6, 0.02), pt(j, -1.6, 0.02), pt(j, 1.6, 0.02), pt(i, 1.6, 0.02), UP, C_BETT);
        for (const s of [-1, 1]) {
          face(flat, pt(i, s * GAUGE - 0.05, dy), pt(j, s * GAUGE - 0.05, dy), pt(j, s * GAUGE + 0.05, dy), pt(i, s * GAUGE + 0.05, dy), UP, C_SCHIENE);
          const g0 = s * GAUGE - s * 0.1;
          face(flat, pt(i, g0 - 0.03, dy), pt(j, g0 - 0.03, dy), pt(j, g0 + 0.03, dy), pt(i, g0 + 0.03, dy), UP, C_RILLE);
        }
      }
      // Oberleitung: Fahrdraht über dem Gleis, Masten rechts außerhalb der Bande (auf der Gasse) bzw. neben dem Gleis
      const WIRE = 5.7;
      for (let i = 0; i + 4 < l.n; i += 4) {
        const a = pt(i, 0, WIRE);
        const b = pt(i + 4, 0, WIRE);
        face(det, a, b, [b[0], b[1] + 0.07, b[2]], [a[0], a[1] + 0.07, a[2]], [1, 0, 0], C_DRAHT);
        face(det, a, b, [b[0], b[1] + 0.07, b[2]], [a[0], a[1] + 0.07, a[2]], [-1, 0, 0], C_DRAHT);
      }
      for (let i = 4; i < l.n - 2; i += 24) {
        const s = l.seg[i];
        const onRoad = Math.abs(l.lat[i] - v.lat) < 0.6;
        // Mast: rechts außen neben der Bande (Gasse) bzw. 3 m neben dem Gleis
        const off = onRoad ? t.wh[s] + WALL_T + 0.5 - l.lat[i] : 3;
        const m = pt(i, off, -0.2);
        // (kein Mast im Kanal oder im Hafenbecken)
        if (w.im(m[0], m[2], 1)) continue;
        const top = l.y[i] + WIRE + 0.9;
        pfosten(body, m[0], m[2], ground(m[0], m[2]) - 0.5, top, 0.17, C_MAST, 6);
        balken(body, [m[0], top - 0.3, m[2]], pt(i, -0.3, WIRE + 0.6), 0.1, C_MAST);
        balken(body, pt(i, 0, WIRE + 0.6), pt(i, 0, WIRE + 0.05), 0.06, C_DRAHT);
        // Laterne am Mast
        det.box(m[0], top - 1.4, m[2], 0.45, 0.6, 0.45, rgb(0xffe6a0), 0);
      }
      // Haltestelle: Schild mit grünem H, Bank
      {
        const at = Math.max(0, Math.min(l.n - 1, Math.round(l.plan.stop - 2)));
        const s = l.seg[at];
        const off = t.wh[s] + WALL_T + 0.55 - l.lat[at];
        const p = pt(at, off, 0);
        pfosten(body, p[0], p[2], p[1] - 0.6, p[1] + 3.2, 0.07, C_MAST, 5);
        const c: V3 = [p[0], p[1] + 2.9, p[2]];
        for (let k = 0; k < 12; k++) {
          const a0 = (k / 12) * TAU;
          const a1 = ((k + 1) / 12) * TAU;
          const P0: V3 = [c[0] + rightX(t, s) * Math.cos(a0) * 0.45, c[1] + Math.sin(a0) * 0.45, c[2] + rightZ(t, s) * Math.cos(a0) * 0.45];
          const P1: V3 = [c[0] + rightX(t, s) * Math.cos(a1) * 0.45, c[1] + Math.sin(a1) * 0.45, c[2] + rightZ(t, s) * Math.cos(a1) * 0.45];
          body.tri(c, P0, P1, rgb(0xf2d23a));
          body.tri(c, P1, P0, rgb(0x2e8a4a));
        }
      }
      // Remise am Anfang der Linie und Torhaus am Ende
      const bauTor = (i0: number, i1: number, W: number, D: number, H: number, col: RGB): void => {
        // Bau über dem Ende der Linie: i0 → i1 zeigt aus dem Tor heraus
        const hx = l.x[i1] - l.x[i0];
        const hz = l.z[i1] - l.z[i0];
        const hl = Math.hypot(hx, hz) || 1;
        const fx = hx / hl;
        const fz = hz / hl;
        const rx = -fz;
        const rz = fx;
        const ox = l.x[i0];
        const oz = l.z[i0];
        const y0 = Math.min(ground(ox, oz), l.y[i0]) - 2;
        const L = (u: number, vv: number, y: number): V3 => [ox + rx * u - fx * vv, y, oz + rz * u - fz * vv];
        const yT = l.y[i0] + H;
        face(body, L(-W, D, y0), L(W, D, y0), L(W, D, yT), L(-W, D, yT), [-fx, 0, -fz], shade(col, 0.85));
        face(body, L(W, 0, y0), L(W, D, y0), L(W, D, yT), L(W, 0, yT), [rx, 0, rz], shade(col, 0.92));
        face(body, L(-W, 0, y0), L(-W, D, y0), L(-W, D, yT), L(-W, 0, yT), [-rx, 0, -rz], shade(col, 0.92));
        // Front mit Torbogen
        const yA = l.y[i0] + 4.6;
        face(body, L(-W, 0, y0), L(-2.2, 0, y0), L(-2.2, 0, yT), L(-W, 0, yT), [fx, 0, fz], col);
        face(body, L(2.2, 0, y0), L(W, 0, y0), L(W, 0, yT), L(2.2, 0, yT), [fx, 0, fz], col);
        face(body, L(-2.2, 0, yA), L(2.2, 0, yA), L(2.2, 0, yT), L(-2.2, 0, yT), [fx, 0, fz], col);
        face(body, L(-2.2, 0.3, y0), L(2.2, 0.3, y0), L(2.2, 0.3, yA), L(-2.2, 0.3, yA), [fx, 0, fz], C_TOR);
        tri(det, L(-2.2, -0.04, yA), L(2.2, -0.04, yA), L(0, -0.04, yA + 0.9), [fx, 0, fz], C_STEIN_H);
        // Dach
        const rise = W * 0.7;
        face(body, L(-W - 0.4, -0.4, yT), L(-W - 0.4, D + 0.4, yT), L(0, D + 0.4, yT + rise), L(0, -0.4, yT + rise), [-rx, 1, -rz], ZIEGEL[1]);
        face(body, L(W + 0.4, -0.4, yT), L(W + 0.4, D + 0.4, yT), L(0, D + 0.4, yT + rise), L(0, -0.4, yT + rise), [rx, 1, rz], shade(ZIEGEL[1], 0.82));
        tri(body, L(-W, 0, yT), L(W, 0, yT), L(0, 0, yT + rise), [fx, 0, fz], col);
        tri(body, L(-W, D, yT), L(W, D, yT), L(0, D, yT + rise), [-fx, 0, -fz], shade(col, 0.85));
      };
      bauTor(0, 6, 5.5, 16, 7.5, C_REMISE);
      bauTor(l.n - 1, l.n - 7, 6, 10, 9, PUTZ[2]);
    }
  }

  // =====================================================================================================
  // Festschmuck am Start, Stufen der Treppengasse
  // =====================================================================================================
  {
    // Wimpelketten quer über den Start (zwischen den Häusern)
    for (const back of [-24, -8, 10, 26]) {
      const i = (((Math.round(back / t.step) % t.n) + t.n) % t.n);
      const L = t.wh[i] + 2.2;
      wimpel(det, P(i, 0, -L, 8.2), P(i, 0, L, 8.0), 1.4, back);
    }
    // Treppengasse: Stufenkanten quer über die Fahrbahn, wo sie steiler als 18 % fällt
    for (const i of walkTo(sp.at(32.0), sp.at(35.2))) {
      const j = t.next[i];
      const slope = (t.base[i] - t.base[j]) / t.step;
      if (slope < 0.18 || (t.edge[i] & EDGE_RAMP) !== 0) continue;
      const W = t.rh[i];
      for (const f of [0.15, 0.65]) {
        face(flat, P(i, f, -W, 0.03), P(i, f, W, 0.03), P(i, f + 0.12, W, 0.03), P(i, f + 0.12, -W, 0.03), UP, C_STUFE);
        face(flat, P(i, f + 0.12, -W, 0.03), P(i, f + 0.12, W, 0.03), P(i, f + 0.2, W, 0.03), P(i, f + 0.2, -W, 0.03), UP, C_STUFE_H);
      }
    }
  }

  // --- Netze -------------------------------------------------------------------------------------------
  const bodyGeo = body.build();
  const bodyMat = toonMaterial({ vertexColors: true });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.name = 'Bauten';
  group.add(bodyMesh);
  disposables.push(bodyGeo, bodyMat);
  if (detail) {
    addSmoothNormals(bodyGeo);
    const ol = new THREE.Mesh(bodyGeo, outlineMaterial(0.045));
    ol.name = 'outline';
    group.add(ol);
    const detGeo = det.build();
    const detMat = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const detMesh = new THREE.Mesh(detGeo, detMat);
    detMesh.name = 'Einzelheiten';
    group.add(detMesh);
    disposables.push(detGeo, detMat);
  }
  const flatGeo = flat.build();
  const flatMat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const flatMesh = new THREE.Mesh(flatGeo, flatMat);
  flatMesh.name = 'Gleis und Stufen';
  group.add(flatMesh);
  disposables.push(flatGeo, flatMat);

  // --- Straßenbahn (je Wagen eine Instanz) -----------------------------------------------------------------
  const nCars = trams.reduce((s, v) => s + v.cars, 0);
  const tramGeo = tramWagen(trams[0]?.half ?? 4.4, trams[0]?.halfWidth ?? 1.15);
  const tramMat = toonMaterial({ vertexColors: true });
  const tramMesh = new THREE.InstancedMesh(tramGeo, tramMat, Math.max(1, nCars));
  tramMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tramMesh.frustumCulled = false;
  tramMesh.count = 0;
  tramMesh.name = 'Straßenbahn';
  group.add(tramMesh);
  disposables.push(tramGeo, tramMat, tramMesh);
  let tramOl: THREE.InstancedMesh | null = null;
  if (detail) {
    addSmoothNormals(tramGeo);
    tramOl = new THREE.InstancedMesh(tramGeo, outlineMaterial(0.05), Math.max(1, nCars));
    tramOl.instanceMatrix = tramMesh.instanceMatrix;
    tramOl.frustumCulled = false;
    tramOl.count = 0;
    tramOl.name = 'outline';
    group.add(tramOl);
    disposables.push(tramOl);
  }

  // --- Glocken (je Glocke eine Instanz) ---------------------------------------------------------------------
  const bellGeo = glocke();
  const bellMat = toonMaterial({ vertexColors: true });
  const bellMesh = new THREE.InstancedMesh(bellGeo, bellMat, Math.max(1, glocken.length));
  bellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bellMesh.frustumCulled = false;
  bellMesh.count = glocken.length;
  bellMesh.name = 'Glocken';
  group.add(bellMesh);
  disposables.push(bellGeo, bellMat, bellMesh);

  const pose = newVehiclePose();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const quat = new THREE.Quaternion();
  const posV = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  const m4 = new THREE.Matrix4();

  return {
    group,
    update(time, _seconds, _dt, cam) {
      // Straßenbahn: genau dort, wo die Physik sie hat
      let k = 0;
      for (const v of trams) {
        for (let car = 0; car < v.cars; car++) {
          const p = vehiclePose(t, v, car, time, pose);
          if (p.seg < 0) continue;
          if ((p.x - cam.x) ** 2 + (p.z - cam.z) ** 2 > 400 * 400) continue;
          posV.set(p.x, p.y, p.z);
          euler.set(-Math.atan(p.slope), p.heading, -Math.atan(p.bank));
          quat.setFromEuler(euler);
          m4.compose(posV, quat, scl);
          tramMesh.setMatrixAt(k++, m4);
        }
      }
      tramMesh.count = k;
      tramMesh.visible = k > 0;
      tramMesh.instanceMatrix.needsUpdate = true;
      if (tramOl) {
        tramOl.count = k;
        tramOl.visible = k > 0;
      }
      // Glocken: läuten alle LAEUTEN s Rennzeit DAUER s lang, schwingen an und aus
      const c = (((time / 60) % LAEUTEN) + LAEUTEN) % LAEUTEN;
      const env = time > 0 && c < DAUER ? Math.sin((Math.PI * c) / DAUER) : 0;
      for (let q = 0; q < glocken.length; q++) {
        const g = glocken[q];
        const sw = env * 0.55 * Math.sin((time / 60) * 3.4 + g.ph);
        posV.set(g.x, g.y, g.z);
        euler.set(sw, g.rot, 0);
        quat.setFromEuler(euler);
        scl.set(g.s, g.s, g.s);
        m4.compose(posV, quat, scl);
        bellMesh.setMatrixAt(q, m4);
      }
      scl.set(1, 1, 1);
      bellMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

function xyz(p: V3): { x: number; y: number; z: number } {
  return { x: p[0], y: p[1], z: p[2] };
}

/** Wimpelkette zwischen a und c (durchhängend um sag), Farben ab off. */
function wimpel(b: MeshBuilder, a: V3, c: V3, sag: number, off: number): void {
  const len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const n = Math.max(3, Math.round(len / 1.0));
  const at = (k: number): V3 => {
    const u = k / n;
    return [a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u - sag * 4 * u * (1 - u), a[2] + (c[2] - a[2]) * u];
  };
  const dx = (c[0] - a[0]) / len;
  const dz = (c[2] - a[2]) / len;
  for (let k = 0; k < n; k++) {
    const p = at(k);
    const q = at(k + 1);
    face(b, p, q, [q[0], q[1] - 0.05, q[2]], [p[0], p[1] - 0.05, p[2]], [-dz, 0, dx], C_DRAHT);
    const m: V3 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 0.8, (p[2] + q[2]) / 2];
    const col = C_WIMPEL[((k + Math.round(off)) % C_WIMPEL.length + C_WIMPEL.length) % C_WIMPEL.length];
    b.tri(p, q, m, col);
    b.tri(p, m, q, col);
  }
}

/** Ein Wagen der Straßenbahn (im eigenen Rahmen: z nach vorn, x nach rechts, y nach oben, Unterkante auf der Fahrbahn). */
function tramWagen(half: number, hw: number): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: RGB, top?: RGB): void => {
    b.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, c, 0, top);
  };
  const L = half;
  // Fahrgestell und Räder (dunkel), Wagenkasten unten rot, oben elfenbein, Dach grau mit Laufsteg
  box(-hw + 0.25, hw - 0.25, 0.1, 0.55, -L + 0.8, L - 0.8, C_TRAM_DUNKEL);
  box(-hw, hw, 0.55, 1.45, -L, L, C_TRAM_ROT);
  box(-hw, hw, 1.45, 2.55, -L + 0.15, L - 0.15, C_TRAM_HELL);
  box(-hw + 0.05, hw - 0.05, 2.55, 2.85, -L + 0.1, L - 0.1, C_TRAM_DACH, rgb(0xa8a8b0));
  // Dachaufbau (Laterne) und Bügel
  box(-0.6, 0.6, 2.85, 3.0, -L + 1.5, L - 1.5, C_TRAM_DACH);
  const pole = (x0: number, z0: number, x1: number, y1: number, z1: number): void => {
    const s = 0.05;
    b.quad([x0 - s, 3.0, z0], [x0 + s, 3.0, z0], [x1 + s, y1, z1], [x1 - s, y1, z1], C_TRAM_DUNKEL);
    b.quad([x0 + s, 3.0, z0], [x0 - s, 3.0, z0], [x1 - s, y1, z1], [x1 + s, y1, z1], C_TRAM_DUNKEL);
    b.quad([x0, 3.0, z0 - s], [x0, 3.0, z0 + s], [x1, y1, z1 + s], [x1, y1, z1 - s], C_TRAM_DUNKEL);
    b.quad([x0, 3.0, z0 + s], [x0, 3.0, z0 - s], [x1, y1, z1 - s], [x1, y1, z1 + s], C_TRAM_DUNKEL);
  };
  // Lyra-Bügel bis an den Fahrdraht (5,7 m über der Schiene)
  pole(-0.5, -0.4, -0.25, 5.65, -1.4);
  pole(0.5, -0.4, 0.25, 5.65, -1.4);
  box(-0.5, 0.5, 5.6, 5.72, -1.48, -1.32, C_TRAM_DUNKEL);
  // Fenster an beiden Seiten
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.01);
    const n = 5;
    for (let k = 0; k < n; k++) {
      const z0 = -L + 1.1 + (k * (2 * L - 2.2)) / n + 0.12;
      const z1 = -L + 1.1 + ((k + 1) * (2 * L - 2.2)) / n - 0.12;
      if (s > 0) b.quad([x, 1.65, z1], [x, 1.65, z0], [x, 2.4, z0], [x, 2.4, z1], C_TRAM_GLAS);
      else b.quad([x, 1.65, z0], [x, 1.65, z1], [x, 2.4, z1], [x, 2.4, z0], C_TRAM_GLAS);
    }
    // Zierlinie gold
    if (s > 0) b.quad([x, 1.38, -L + 0.2], [x, 1.38, L - 0.2], [x, 1.46, L - 0.2], [x, 1.46, -L + 0.2], C_GOLD);
    else b.quad([x, 1.38, L - 0.2], [x, 1.38, -L + 0.2], [x, 1.46, -L + 0.2], [x, 1.46, L - 0.2], C_GOLD);
  }
  // Stirnseiten: großes Fenster, Lampe, Liniennummer
  for (const s of [-1, 1]) {
    const z = s * (L + 0.01);
    const q = (x0: number, x1: number, y0: number, y1: number, c: RGB): void => {
      if (s > 0) b.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], c);
      else b.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], c);
    };
    q(-hw + 0.25, hw - 0.25, 1.65, 2.45, C_TRAM_GLAS);
    q(-0.3, 0.3, 0.8, 1.2, rgb(0xfff0c0));
    q(-0.45, 0.45, 2.58, 2.82, rgb(0xf6f0d0));
  }
  const g = b.build();
  return g;
}

/** Glocke (im eigenen Rahmen: Aufhängung oben bei y = 0, hängt nach unten, Mündung bei y = −1,4). */
function glocke(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const n = 10;
  const prof: [number, number][] = [
    [0.15, 0],
    [0.45, -0.1],
    [0.55, -0.5],
    [0.62, -0.95],
    [0.85, -1.3],
    [0.88, -1.4],
  ];
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * TAU;
    const a1 = ((k + 1) / n) * TAU;
    for (let q = 0; q + 1 < prof.length; q++) {
      const [r0, y0] = prof[q];
      const [r1, y1] = prof[q + 1];
      face(b, [Math.cos(a0) * r0, y0, Math.sin(a0) * r0], [Math.cos(a1) * r0, y0, Math.sin(a1) * r0], [Math.cos(a1) * r1, y1, Math.sin(a1) * r1], [Math.cos(a0) * r1, y1, Math.sin(a0) * r1], [Math.cos((a0 + a1) / 2), 0.3, Math.sin((a0 + a1) / 2)], q === 3 ? C_GLOCKE_D : C_GLOCKE);
    }
    tri(b, [0, 0, 0], [Math.cos(a0) * 0.15, 0, Math.sin(a0) * 0.15], [Math.cos(a1) * 0.15, 0, Math.sin(a1) * 0.15], [0, 1, 0], C_GLOCKE);
  }
  // Klöppel
  b.box(0, -1.2, 0, 0.22, 0.4, 0.22, C_GLOCKE_D);
  const geo = b.build();
  return geo;
}

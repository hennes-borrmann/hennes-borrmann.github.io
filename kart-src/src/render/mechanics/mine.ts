// Kristallmine: Darstellung der Sprengungen und der Weiche zum Sprengort.
//
// Sprengladungen (PULSE_BLAST): Auf der Sohle markiert ein gelb-schwarzer Ring den Umkreis, den die Explosion erfasst
// (immer sichtbar – man sieht, wo es knallt). Zweieinhalb Sekunden vorher (warn) steigt eine Kiste Sprengstoff aus der
// Sohle, ihre Zündschnur brennt (Funken), die Sprenglampe an der Wand blinkt rot; im Augenblick der Explosion (Zyklus 0)
// verschwindet die Kiste in einem Feuerball aus Funken, Staub quillt auf und Brocken fliegen (Teilchen, nur Zierde).
//
// Weiche (Abkürzung 'window'): Vor der Weiche steht ein Signal mit roter und grüner Lampe und einer Reihe von Lichtern, die
// die Sekunden bis zum nächsten Wechsel zählen (grün: noch so lange offen; rot: so lange noch verschüttet). Kurz vor dem
// Schließen blinkt Gelb; kurz vor dem Öffnen rot. An der Weiche selbst zeigt ein Weichensignal die Stellung: ein
// schräger Pfeil (abzweigend, grün) oder ein senkrechter Balken (geradeaus, weiß). Im Sprengort liegt, solange er zu ist,
// ein Haufen Geröll im Gleis: Er bricht beim Schließen aus der Firste nach (Staub), beim Öffnen wird er freigesprengt.
//
// Querschlag der pendelnden Lore (TrackDef.hazards): zwei Schienen quer über die Fahrbahn.
//
// Alles, was die Physik betrifft, ist eine reine Funktion der Rennzeit (Ticks); Teilchen kommen nur bei stetig laufender
// Zeit dazu. Keine eigenen Shader, keine Lichtquellen. Zeichenaufrufe: Feststehendes (Toon), Bodenmarken, bewegliche
// Flächen (Lampen, Kisten), Geröll = 4.

import * as THREE from 'three';
import { PULSE_BLAST, planActive, pulseCycle, type Gate, type Pulse } from '../../game/mechanics';
import { rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, seeded, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { rgb, toonMaterial } from '../toon';

const GELB = rgb(0xffcf3a);
const SCHWARZ = rgb(0x1e1b22);
const STAHL = rgb(0x4a5266);
const STAHL_D = rgb(0x2c3140);
const HOLZ = rgb(0x6a4a2c);
const ROT = rgb(0xff3a2a);
const ROT_D = rgb(0x3a1414);
const GRUEN = rgb(0x46ff7a);
const GRUEN_D = rgb(0x123a1e);
const GELB_L = rgb(0xffd23a);
const GELB_D = rgb(0x3a3010);
const WEISS = rgb(0xf4f0e6);
const KISTE = rgb(0xb8342a);
const KISTE_H = rgb(0xf0e6d2);
const AUS: RGB = [0.06, 0.05, 0.07];

/** Flächen, deren Ecken und Farben je Bild neu gesetzt werden. */
class Dyn {
  pos: number[] = [];
  col: number[] = [];
  geo = new THREE.BufferGeometry();
  posAttr!: THREE.BufferAttribute;
  colAttr!: THREE.BufferAttribute;
  add(): number {
    const q = this.pos.length / 18;
    for (let k = 0; k < 18; k++) {
      this.pos.push(0);
      this.col.push(0);
    }
    return q;
  }
  finish(): void {
    this.posAttr = new THREE.BufferAttribute(new Float32Array(this.pos), 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(new Float32Array(this.col), 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('color', this.colAttr);
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
  }
  color(q: number, c: RGB): void {
    const a = this.colAttr.array as Float32Array;
    for (let k = 0; k < 6; k++) {
      a[q * 18 + k * 3] = c[0];
      a[q * 18 + k * 3 + 1] = c[1];
      a[q * 18 + k * 3 + 2] = c[2];
    }
  }
}

interface Ladung {
  p: Pulse;
  /** Vierecke der Kiste (6) und der Lampe (1). */
  kiste: number;
  lampe: number;
  /** Mitte und Achsen der Kiste: Fahrtrichtung, rechts. */
  fx: number;
  fz: number;
  rx: number;
  rz: number;
}

export function buildMine(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  group.name = 'Bergwerk';
  const rnd = seeded(2207);
  const fest = new MeshBuilder();
  const boden = new MeshBuilder();
  const dyn = new Dyn();
  const disposables: { dispose(): void }[] = [];

  const P = (seg: number, lat: number, up: number, along = 0): V3 => [
    t.px[seg] + rightX(t, seg) * lat + t.tx[seg] * along,
    t.py[seg] + lat * t.bank[seg] + up,
    t.pz[seg] + rightZ(t, seg) * lat + t.tz[seg] * along,
  ];

  // --- Sprengladungen -------------------------------------------------------------
  const ladungen: Ladung[] = [];
  for (const p of t.pulses) {
    if (p.kind !== PULSE_BLAST) continue;
    const seg = p.seg;
    const rx = rightX(t, seg);
    const rz = rightZ(t, seg);
    // Gefahrenring auf der Sohle (gelb-schwarz gestrichelt)
    const N = 20;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2;
      const a1 = ((k + 1) / N) * Math.PI * 2;
      const r0 = p.radius - 0.18;
      const r1 = p.radius + 0.18;
      const Q = (a: number, r: number): V3 => {
        const x = p.x + (Math.cos(a) * rx + Math.sin(a) * t.tx[seg]) * r;
        const z = p.z + (Math.cos(a) * rz + Math.sin(a) * t.tz[seg]) * r;
        const lat = p.lat + Math.cos(a) * r;
        return [x, t.py[seg] + lat * t.bank[seg] + 0.05, z];
      };
      boden.quad(Q(a0, r1), Q(a1, r1), Q(a1, r0), Q(a0, r0), k % 2 === 0 ? GELB : SCHWARZ);
    }
    // Kreuz in der Mitte (Bohrloch)
    const c = P(seg, p.lat, 0.05);
    boden.quad([c[0] - 0.45, c[1], c[2] - 0.45], [c[0] + 0.45, c[1], c[2] - 0.45], [c[0] + 0.45, c[1], c[2] + 0.45], [c[0] - 0.45, c[1], c[2] + 0.45], SCHWARZ);
    // Sprenglampe an der Wand auf der Seite der Ladung (bei Ladungen in der Mitte links)
    const side = p.lat > 0.5 ? 1 : -1;
    const wl = side * (t.wh[seg] + 0.65);
    const lp = P(seg, wl, 2.7);
    fest.box(lp[0], lp[1] - 1.45, lp[2], 0.22, 2.9, 0.22, STAHL_D);
    fest.box(lp[0], lp[1], lp[2], 0.7, 0.9, 0.7, STAHL, Math.atan2(t.tx[seg], t.tz[seg]));
    const kiste = dyn.add();
    for (let k = 1; k < 6; k++) dyn.add();
    const lampe = dyn.add();
    dyn.add();
    ladungen.push({ p, kiste, lampe, fx: t.tx[seg], fz: t.tz[seg], rx, rz });
  }

  // --- Weiche zum Sprengort ---------------------------------------------------------
  const kWin = t.def.branches?.findIndex((b) => b.shortcut === 'window') ?? -1;
  const branch = kWin >= 0 ? t.branches[kWin] : null;
  const gate: Gate | null = branch ? (t.gates.find((g) => t.branchOf[g.first] === kWin) ?? null) : null;
  let sig: { rot: number; gruen: number; dots: number; n: number; zeichen: number; at: V3; ax: number; az: number; bx: number; bz: number } | null = null;
  let geroell: THREE.Mesh | null = null;
  let geroellAt: V3 = [0, 0, 0];
  const sigLampen: { q: number; c: V3; r: number }[] = [];
  let zeichenAt: { c: V3; rx: number; rz: number } = { c: [0, 0, 0], rx: 1, rz: 0 };
  if (branch && gate) {
    const side = branch.side;
    // Signal 26 m vor der Weiche, außen auf der Seite der Abzweigung
    let s = branch.from;
    for (let k = 0; k < 26; k++) s = t.prev[s];
    const lat = side * (t.wh[s] + 1.0);
    const foot = P(s, lat, -0.6);
    const top = P(s, lat, 3.4);
    const rot = Math.atan2(t.tx[s], t.tz[s]);
    fest.box(foot[0], (foot[1] + top[1]) / 2, foot[2], 0.26, top[1] - foot[1], 0.26, STAHL_D);
    // Schirm, quer zur Fahrt, zeigt den Ankommenden entgegen
    fest.box(top[0], top[1] + 0.2, top[2], 1.5, 2.3, 0.2, SCHWARZ, rot + Math.PI / 2);
    const fx = -t.tx[s] * 0.13;
    const fz = -t.tz[s] * 0.13;
    const rx = rightX(t, s);
    const rz = rightZ(t, s);
    const at: V3 = [top[0] + fx, top[1] + 0.2, top[2] + fz];
    /** Eine Lampe des Signals (Viereck quer zur Fahrt; die Ecken setzt der Aufbau unten). */
    const lamp = (dx: number, dy: number, r: number): number => {
      const q = dyn.add();
      sigLampen.push({ q, c: [at[0] + rx * dx, at[1] + dy, at[2] + rz * dx], r });
      return q;
    };
    const rotQ = lamp(0, 0.6, 0.36);
    const gruenQ = lamp(0, -0.25, 0.36);
    const n = 8;
    const dots = dyn.pos.length / 18;
    for (let k = 0; k < n; k++) lamp(-0.56 + (k * 1.12) / (n - 1), -0.88, 0.07);
    sig = { rot: rotQ, gruen: gruenQ, dots, n, zeichen: -1, at, ax: rx, az: rz, bx: fx, bz: fz };
    // Weichensignal an der Weiche: Kasten, darin Pfeil (schräg) oder Balken (senkrecht)
    const w = branch.from;
    const wl = side * (t.wh[w] + 0.9);
    const wp = P(w, wl, 1.2);
    fest.box(wp[0], wp[1] - 0.8, wp[2], 0.2, 1.6, 0.2, STAHL_D);
    fest.box(wp[0], wp[1] + 0.25, wp[2], 1.0, 1.0, 0.18, SCHWARZ, Math.atan2(t.tx[w], t.tz[w]) + Math.PI / 2);
    const zeichen = dyn.add();
    sig.zeichen = zeichen;
    zeichenAt = { c: [wp[0] - t.tx[w] * 0.11, wp[1] + 0.25, wp[2] - t.tz[w] * 0.11], rx: rightX(t, w), rz: rightZ(t, w) };
    // Geröll im Sprengort: hinter dem Stück, das das Tor sperrt
    let g = gate.first + gate.count + 10;
    g = Math.min(g, branch.first + branch.count - 1);
    const gb = new MeshBuilder();
    const ico = new THREE.DodecahedronGeometry(1, 0);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const half = t.wh[g] + 0.6;
    for (let k = 0; k < (detail ? 26 : 14); k++) {
      const lat = (rnd() * 2 - 1) * half;
      const along = (rnd() - 0.5) * 5;
      const hgt = 3.6 * (1 - (lat / (half + 0.8)) ** 2) * (1 - Math.abs(along) / 4);
      const sz = 0.7 + rnd() * 1.1;
      e.set(rnd() * 3, rnd() * 3, rnd() * 3);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(lat, Math.max(sz * 0.5, hgt * rnd()), along), q, new THREE.Vector3(sz, sz * 0.8, sz));
      gb.add(ico, rnd() < 0.5 ? rgb(0x4a3e48) : rgb(0x5a4c52), m4);
    }
    // ein paar Kristallsplitter im Schutt
    for (let k = 0; k < 4; k++) {
      m4.compose(new THREE.Vector3((rnd() * 2 - 1) * half * 0.7, 1 + rnd() * 1.5, (rnd() - 0.5) * 3), q.setFromEuler(e.set(rnd(), rnd(), rnd())), new THREE.Vector3(0.25, 0.8, 0.25));
      gb.add(new THREE.OctahedronGeometry(1, 0), rgb(0xffb02e), m4);
    }
    ico.dispose();
    geroell = new THREE.Mesh(gb.build(), toonMaterial({ vertexColors: true }));
    geroell.name = 'Geröll';
    geroellAt = [t.px[g], t.py[g], t.pz[g]];
    geroell.position.set(t.px[g], t.py[g], t.pz[g]);
    geroell.rotation.y = Math.atan2(rightX(t, g), rightZ(t, g)) - Math.PI / 2;
    group.add(geroell);
    disposables.push(geroell.geometry, geroell.material as THREE.Material);
    // Rot-weiße Sperrbalken links und rechts an der Wand neben dem Geröll
    for (const sg of [-1, 1]) {
      const b = P(g, sg * (t.wh[g] + 0.9), 1.4);
      fest.box(b[0], b[1], b[2], 0.3, 2.8, 0.3, sg < 0 ? ROT : WEISS);
    }
  }

  // --- Querschlag der Lore: zwei Schienen quer über die Fahrbahn ------------------------------
  for (const h of t.hazards) {
    const seg = h.seg;
    const reach = h.amp + 3;
    for (const off of [-0.55, 0.55]) {
      const a = P(seg, -reach, 0.02, off);
      const b = P(seg, reach, 0.02, off);
      const rot = Math.atan2(rightX(t, seg), rightZ(t, seg));
      fest.box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.06, (a[2] + b[2]) / 2, 0.12, 0.12, 2 * reach, STAHL, rot);
    }
    for (let l = -reach + 0.5; l < reach; l += 1.2) {
      const c = P(seg, l, 0.01);
      fest.box(c[0], c[1], c[2], 0.3, 0.06, 1.7, HOLZ, Math.atan2(rightX(t, seg), rightZ(t, seg)));
    }
  }

  // --- Netze -----------------------------------------------------------------------
  dyn.finish();
  // Signal: Ecken der Lampen fest (quer zur Fahrt)
  if (sig) {
    for (const l of sigLampen) {
      const { c, r } = l;
      dyn.set(l.q, [c[0] - sig.ax * r, c[1] - r, c[2] - sig.az * r], [c[0] + sig.ax * r, c[1] - r, c[2] + sig.az * r], [c[0] + sig.ax * r, c[1] + r, c[2] + sig.az * r], [c[0] - sig.ax * r, c[1] + r, c[2] - sig.az * r]);
    }
  }
  const festMesh = new THREE.Mesh(fest.build(), toonMaterial({ vertexColors: true }));
  festMesh.name = 'Bergwerk fest';
  const bodenMat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  bodenMat.color.setScalar(0.85);
  const bodenMesh = new THREE.Mesh(boden.build(), bodenMat);
  bodenMesh.name = 'Gefahrenringe';
  const dynMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const dynMesh = new THREE.Mesh(dyn.geo, dynMat);
  dynMesh.frustumCulled = false;
  dynMesh.name = 'Sprenglampen';
  group.add(festMesh, bodenMesh, dynMesh);
  disposables.push(festMesh.geometry, festMesh.material as THREE.Material, bodenMesh.geometry, bodenMat, dyn.geo, dynMat);

  // --- je Bild -----------------------------------------------------------------------
  const v: V3[] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const zero: V3 = [0, -9999, 0];
  /** Kiste einer Ladung: Mitte (x, y, z), halbe Maße; s = 0 verschwunden. */
  const kiste = (l: Ladung, y: number, s: number): void => {
    if (s <= 0) {
      for (let k = 0; k < 6; k++) dyn.set(l.kiste + k, zero, zero, zero, zero);
      return;
    }
    const hx = 0.55 * s;
    const hy = 0.4 * s;
    const hz = 0.45 * s;
    const cx = l.p.x;
    const cz = l.p.z;
    let n = 0;
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (const sx of [-1, 1]) {
          const o = v[n++];
          o[0] = cx + l.rx * sx * hx + l.fx * sz * hz;
          o[1] = y + hy + sy * hy;
          o[2] = cz + l.rz * sx * hx + l.fz * sz * hz;
        }
      }
    }
    // v: Index = (sy>0)*4 + (sz>0)*2 + (sx>0)
    const f = (a: number, b: number, c: number, d: number, q: number, col: RGB): void => {
      dyn.set(l.kiste + q, v[a], v[b], v[c], v[d]);
      dyn.color(l.kiste + q, col);
    };
    f(4, 5, 7, 6, 0, KISTE_H); // oben
    f(0, 1, 5, 4, 1, KISTE); // vorn (gegen die Fahrt)
    f(2, 3, 7, 6, 2, KISTE);
    f(0, 2, 6, 4, 3, KISTE_H);
    f(1, 3, 7, 5, 4, KISTE_H);
    f(0, 1, 3, 2, 5, KISTE);
  };

  let last = -1e9;
  const lampSet = (q: number, col: RGB): void => dyn.color(q, col);

  function update(time: number, fx: FxSink | null): void {
    const steady = time > last && time - last < 30;
    // Sprengladungen
    for (const l of ladungen) {
      const p = l.p;
      const c = pulseCycle(p, time);
      const warn = c >= p.period - p.warn;
      const y = t.py[p.seg] + p.lat * t.bank[p.seg];
      if (warn) {
        const u = (c - (p.period - p.warn)) / 18;
        kiste(l, y - 0.8 * Math.max(0, 1 - u), 1);
      } else kiste(l, y, 0);
      // Sprenglampe: blinkt rot (schneller zum Ende), beim Knall weiß
      const left = p.period - c;
      const blink = warn && Math.floor(left / (left < 50 ? 6 : 12)) % 2 === 0;
      const lc = c < 8 ? WEISS : blink ? ROT : ROT_D;
      // (Lampe: zwei Vierecke über Kreuz an der Wand)
      const side = p.lat > 0.5 ? 1 : -1;
      const lp: V3 = [t.px[p.seg] + l.rx * side * (t.wh[p.seg] + 0.65), t.py[p.seg] + 2.7 + 0.1, t.pz[p.seg] + l.rz * side * (t.wh[p.seg] + 0.65)];
      const r = 0.42;
      dyn.set(l.lampe, [lp[0] - l.fx * r, lp[1] - r, lp[2] - l.fz * r], [lp[0] + l.fx * r, lp[1] - r, lp[2] + l.fz * r], [lp[0] + l.fx * r, lp[1] + r, lp[2] + l.fz * r], [lp[0] - l.fx * r, lp[1] + r, lp[2] - l.fz * r]);
      dyn.set(l.lampe + 1, [lp[0] - l.rx * r, lp[1] - r, lp[2] - l.rz * r], [lp[0] + l.rx * r, lp[1] - r, lp[2] + l.rz * r], [lp[0] + l.rx * r, lp[1] + r, lp[2] + l.rz * r], [lp[0] - l.rx * r, lp[1] + r, lp[2] - l.rz * r]);
      lampSet(l.lampe, lc);
      lampSet(l.lampe + 1, lc);
      if (!fx || !steady) continue;
      // Zündschnur: Funken an der Kiste
      if (warn && Math.random() < 0.8) fx.spark(p.x + (Math.random() - 0.5) * 0.3, y + 0.95, p.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 1.5, 0.35, 0.18, Math.random() < 0.5 ? 0xffe27a : 0xff8a2a, 6);
      // Explosion
      if (pulseCycle(p, time) < pulseCycle(p, last)) explode(fx, p.x, y, p.z, 1);
    }
    // Weiche und Sprengort
    if (sig && gate) {
      const shut = planActive(gate.plan, time);
      const P0 = gate.plan.period;
      const clock = time <= 0 ? 0 : time % P0;
      const closeAt = gate.plan.spans[0];
      const openAt = gate.plan.spans[1] % P0;
      // Ticks bis zum nächsten Wechsel
      const until = shut ? (openAt - clock + P0) % P0 || P0 : (closeAt - clock + P0) % P0 || P0;
      const soon = until < 150;
      const blink = Math.floor(until / 9) % 2 === 0;
      lampSet(sig.rot, shut ? (soon && !blink ? ROT_D : ROT) : soon && blink ? GELB_L : ROT_D);
      lampSet(sig.gruen, shut ? GRUEN_D : soon && blink ? GELB_D : GRUEN);
      const secs = Math.ceil(until / 60);
      for (let k = 0; k < sig.n; k++) lampSet(sig.dots + k, k < secs ? (shut ? ROT : GRUEN) : AUS);
      // Weichensignal: Pfeil schräg (abzweigend) oder Balken senkrecht (geradeaus)
      const z = zeichenAt;
      const w = 0.12;
      if (!shut) {
        const a: V3 = [z.c[0] - z.rx * 0.32, z.c[1] - 0.32, z.c[2] - z.rz * 0.32];
        const b: V3 = [z.c[0] + z.rx * 0.32 * branch!.side, z.c[1] + 0.32, z.c[2] + z.rz * 0.32 * branch!.side];
        if (branch!.side < 0) {
          a[0] = z.c[0] + z.rx * 0.32;
          a[2] = z.c[2] + z.rz * 0.32;
        }
        dyn.set(sig.zeichen, [a[0], a[1] - w, a[2]], [b[0], b[1] - w, b[2]], [b[0], b[1] + w, b[2]], [a[0], a[1] + w, a[2]]);
        lampSet(sig.zeichen, GRUEN);
      } else {
        dyn.set(sig.zeichen, [z.c[0] - z.rx * w, z.c[1] - 0.36, z.c[2] - z.rz * w], [z.c[0] + z.rx * w, z.c[1] - 0.36, z.c[2] + z.rz * w], [z.c[0] + z.rx * w, z.c[1] + 0.36, z.c[2] + z.rz * w], [z.c[0] - z.rx * w, z.c[1] + 0.36, z.c[2] - z.rz * w]);
        lampSet(sig.zeichen, WEISS);
      }
      // Geröll: bricht 0,5 s nach dem Schließen aus der Firste nach (fällt 0,4 s), wird beim Öffnen freigesprengt
      if (geroell) {
        const since = shut ? (clock - closeAt + P0) % P0 : -1;
        const fall = since < 0 ? 0 : Math.max(0, Math.min(1, (since - 30) / 24));
        geroell.visible = shut && since >= 30;
        geroell.position.y = geroellAt[1] + 6 * (1 - fall) * (1 - fall);
        geroell.scale.setScalar(0.6 + 0.4 * fall);
        if (fx && steady) {
          const was = planActive(gate.plan, last);
          const sinceLast = was ? (((last <= 0 ? 0 : last % P0) - closeAt + P0) % P0) : -1;
          // Nachbruch: Staub, wenn der Haufen aufschlägt
          if (shut && since >= 54 && sinceLast >= 0 && sinceLast < 54) explode(fx, geroellAt[0], geroellAt[1], geroellAt[2], 0);
          // Kurz vor dem Schließen rieselt es aus der Firste
          if (!shut && until < 120 && Math.random() < 0.3) fx.puff(geroellAt[0] + (Math.random() - 0.5) * 6, geroellAt[1] + 5.5, geroellAt[2] + (Math.random() - 0.5) * 6, 0, -2, 0, 0.9, 0.35, 0x8a7a6a, 0.3, 6);
          // Vor dem Freisprengen brennt die Zündschnur am Haufen
          if (shut && until < 150 && Math.random() < 0.8) fx.spark(geroellAt[0], geroellAt[1] + 2.4, geroellAt[2], (Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.5, 0.35, 0.18, 0xffe27a, 6);
          // Freisprengen
          if (!shut && was) explode(fx, geroellAt[0], geroellAt[1] + 1, geroellAt[2], 1.3);
        }
      }
    }
    dyn.posAttr.needsUpdate = true;
    dyn.colAttr.needsUpdate = true;
    last = time;
  }

  /** Feuerball, Funken, Staub und Brocken (power 0 = nur Staub und Brocken). */
  function explode(fx: FxSink, x: number, y: number, z: number, power: number): void {
    if (power > 0) {
      for (let k = 0; k < 3; k++) fx.spark(x, y + 1 + k * 0.4, z, 0, 0.5, 0, 0.22 + 0.06 * k, 5.5 * power, k === 0 ? 0xfff2c0 : 0xffb24a, 0);
      for (let k = 0; k < (detail ? 26 : 14); k++) {
        const a = Math.random() * Math.PI * 2;
        const s = 4 + Math.random() * 9;
        fx.spark(x, y + 0.6, z, Math.cos(a) * s, 4 + Math.random() * 8, Math.sin(a) * s, 0.4 + Math.random() * 0.4, 0.25 + Math.random() * 0.35, Math.random() < 0.5 ? 0xffd27a : 0xff7a2a, 12);
      }
    }
    for (let k = 0; k < (detail ? 14 : 8); k++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 3;
      fx.puff(x + Math.cos(a) * 1.5, y + 0.6 + Math.random() * 2, z + Math.sin(a) * 1.5, Math.cos(a) * s, 0.6 + Math.random(), Math.sin(a) * s, 1.4 + Math.random() * 0.8, 1.2 + Math.random() * 1.2, Math.random() < 0.5 ? 0x8a7a6a : 0x6a5e56, 1.6, -0.4);
    }
    for (let k = 0; k < (detail ? 8 : 4); k++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 5;
      fx.puff(x, y + 1, z, Math.cos(a) * s, 5 + Math.random() * 5, Math.sin(a) * s, 0.9, 0.35 + Math.random() * 0.3, 0x3a3236, 0, 14);
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


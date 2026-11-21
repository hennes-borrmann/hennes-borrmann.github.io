// Teile, die nur in der Cockpit-Ansicht zu sehen sind (firstPerson.ts): Handschuhe mit Fingern, ein ausgearbeitetes
// Lenkrad und Armaturen mit Tacho und Drift-Lampen. (Der Rückspiegel ist kein Teil des Karts, sondern ein schmaler
// Streifen oben in der Bildmitte – firstPerson.ts.) Alles prozedural im Comic-Stil der Karts – Farbstufen
// und Tuschekontur (toon.ts) –, keine fremden Modelle oder Bilder.
//
// Die Teile hängen an den Knochen des eigenen Karts (kartModel.ts, CockpitRig): Lenkrad am Lenkrad-Knochen, Armaturen an
// der Karosserie, die Handschuhe an der Karosserie neben den (ausgeblendeten) Kugelhänden. Jeder Handschuh ist
// EIN Netz an einem eigenen kleinen Skelett (Gelenk, Handfläche, je drei Glieder für vier Finger und den Daumen): ein
// Zeichenaufruf plus einer für die Kontur.
//
// Handschuh-Raum (rechte Hand): Ursprung im Handgelenk, +y zu den Fingerknöcheln, Handfläche nach +z, Daumen nach +x.
// Die linke Hand ist das Spiegelbild (x → −x).

import * as THREE from 'three';
import type { CockpitRig } from './kartModel';
import { addSmoothNormals, outlineMaterial, rgb, setOutlinesVisible, toonMaterial, withSkinnedOutline } from './toon';

// ───────────────────────────── Handschuh ─────────────────────────────

interface FingerSpec {
  /** Grundgelenk (Knöchel) im Handschuh-Raum der rechten Hand. */
  x: number;
  y: number;
  r: number;
  /** Länge der drei Glieder. */
  l: readonly [number, number, number];
}

/** Zeige-, Mittel-, Ring-, kleiner Finger (rechte Hand, Daumen bei +x). Maße eines kräftigen Comic-Handschuhs. */
const FINGERS: readonly FingerSpec[] = [
  { x: 0.03, y: 0.088, r: 0.0108, l: [0.04, 0.025, 0.021] },
  { x: 0.0098, y: 0.093, r: 0.0114, l: [0.044, 0.028, 0.022] },
  { x: -0.0102, y: 0.09, r: 0.0108, l: [0.041, 0.026, 0.021] },
  { x: -0.0295, y: 0.083, r: 0.0098, l: [0.033, 0.021, 0.018] },
];
/**
 * Daumen: Wurzel, Richtung abgespreizt und quer über die geschlossene Faust (vom Handgelenk weg), Dicke, Glieder. Das
 * Grundglied dreht zwischen beiden Richtungen (HandPose.t[0]); die anderen Glieder krümmen sich um ihre x-Achse.
 */
const THUMB = {
  at: [0.033, 0.026, 0.009] as const,
  dir: [0.66, 0.64, 0.4] as const,
  across: [-0.42, 0.5, 0.76] as const,
  r: 0.0125,
  l: [0.029, 0.026, 0.022] as const,
};
/** Handfläche: Breite, Länge, Dicke. */
const PALM = { w: 0.083, h: 0.094, d: 0.034 };
/** Stulpe: ab Handgelenk so weit zum Ellbogen, Radius am Gelenk und hinten. */
const CUFF = { len: 0.048, r0: 0.037, r1: 0.043 };

/** Knochen: 0 Gelenk, 1 Handfläche, 2 + 3·f + j Finger f Glied j, 14 + j Daumen. */
const BONE_PALM = 1;
const fingerBone = (f: number, j: number): number => 2 + 3 * f + j;
const thumbBone = (j: number): number => 14 + j;
const GLOVE_BONES = 17;

/** Haltungen: Krümmung je Fingerglied (rad) und Daumen. */
export interface HandPose {
  /** Fingerglieder: Grund-, Mittel-, Endgelenk. */
  f: readonly [number, number, number];
  /** Daumenglieder. */
  t: readonly [number, number, number];
  /** Spreizung der Finger (rad, je Finger vom Mittelfinger weg). */
  spread: number;
}
/** Um den Lenkradkranz geschlossen. */
export const GRIP: HandPose = { f: [1.2, 1.5, 0.95], t: [1, 0.35, 0.3], spread: 0 };
/** Um einen Gegenstand (Item) geschlossen – etwas weiter offen. */
export const HOLD: HandPose = { f: [0.95, 1.2, 0.75], t: [0.75, 0.3, 0.25], spread: 0.02 };
/** Locker geöffnet (nach einem Wurf, beim Winken). */
export const OPEN: HandPose = { f: [0.18, 0.22, 0.12], t: [0, 0.08, 0.05], spread: 0.09 };

const Y = new THREE.Vector3(0, 1, 0);

/** Ein Teil des Handschuhs: Geometrie im Raum seines Knochens, Farbe. */
interface Part {
  geo: THREE.BufferGeometry;
  bone: number;
  color: number;
  outline: boolean;
}

function capsule(r: number, len: number, segs = 8): THREE.BufferGeometry {
  // Kapsel vom Gelenk (y = 0) bis zur Spitze (y = len), Halbkugeln an beiden Enden.
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 0.6), 3, segs);
  g.translate(0, len / 2, 0);
  return g;
}

function roundBox(w: number, h: number, d: number): THREE.BufferGeometry {
  // Abgerundeter Quader: eine Kugel, auf den Quader gezogen (Ecken weich, wenig Ecken).
  const g = new THREE.SphereGeometry(1, 12, 8);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Superellipsoid: Würfel mit runden Kanten.
    const k = (a: number): number => Math.sign(a) * Math.pow(Math.abs(a), 0.45);
    p.setXYZ(i, k(v.x) * (w / 2), k(v.y) * (h / 2), k(v.z) * (d / 2));
  }
  g.computeVertexNormals();
  return g;
}

/** Fügt Teile zu einem Netz mit Vertexfarben und starrer Knochen-Zuordnung zusammen (Ruhelage aus den Knochen). */
function mergeParts(parts: Part[], bones: THREE.Bone[]): { geo: THREE.BufferGeometry; outline: THREE.BufferGeometry } {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const si: number[] = [];
  const sw: number[] = [];
  const idx: number[] = [];
  const oPos: number[] = [];
  const oSi: number[] = [];
  const oSw: number[] = [];
  const oIdx: number[] = [];
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  for (const part of parts) {
    const g = part.geo.index ? part.geo : part.geo;
    m.copy(bones[part.bone].matrixWorld);
    nm.getNormalMatrix(m);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const n = g.getAttribute('normal') as THREE.BufferAttribute;
    const c = rgb(part.color);
    const base = pos.length / 3;
    const oBase = oPos.length / 3;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
      if (part.outline) oPos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      nor.push(v.x, v.y, v.z);
      col.push(c[0], c[1], c[2]);
      si.push(part.bone, 0, 0, 0);
      sw.push(1, 0, 0, 0);
      if (part.outline) {
        oSi.push(part.bone, 0, 0, 0);
        oSw.push(1, 0, 0, 0);
      }
    }
    const ix = g.index;
    const count = ix ? ix.count : p.count;
    for (let i = 0; i < count; i++) {
      const k = ix ? ix.getX(i) : i;
      idx.push(base + k);
      if (part.outline) oIdx.push(oBase + k);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx);
  const outline = new THREE.BufferGeometry();
  outline.setAttribute('position', new THREE.Float32BufferAttribute(oPos, 3));
  outline.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(oSi, 4));
  outline.setAttribute('skinWeight', new THREE.Float32BufferAttribute(oSw, 4));
  outline.setIndex(oIdx);
  outline.computeVertexNormals();
  addSmoothNormals(outline);
  // Dünne Linie an den Fingern: die Kontur-Normalen etwas kürzer.
  const on = outline.getAttribute('onormal') as THREE.BufferAttribute;
  for (let i = 0; i < on.count; i++) on.setXYZ(i, on.getX(i) * 0.55, on.getY(i) * 0.55, on.getZ(i) * 0.55);
  return { geo, outline };
}

/** Ein Handschuh: Netz, Skelett, Haltung. side = 1 rechts, −1 links. */
export class Glove {
  readonly group = new THREE.Group();
  readonly bones: THREE.Bone[] = [];
  readonly mesh: THREE.SkinnedMesh;
  /** Mitte der geschlossenen Faust (dort liegt der Lenkradkranz bzw. der Griff eines Items), Handschuh-Raum. */
  readonly gripCenter = new THREE.Vector3();
  private readonly side: number;

  constructor(side: number, glove: number, accent: number, palm: number) {
    this.side = side;
    for (let i = 0; i < GLOVE_BONES; i++) this.bones.push(new THREE.Bone());
    const b = this.bones;
    const sx = side;
    // Stulpe (Knochen 0) und Handfläche hängen beide direkt am Handschuh: Die Stulpe folgt dem Unterarm, die Hand dem
    // Griff – dazwischen knickt das Handgelenk.
    this.group.add(b[0], b[BONE_PALM]);
    const parts: Part[] = [];
    // Handfläche: kräftiger, weicher Block; darauf Knöchelpolster (Akzentfarbe) und eine griffige Innenfläche.
    parts.push({ geo: roundBox(PALM.w, PALM.h, PALM.d).translate(0, PALM.h / 2, 0), bone: BONE_PALM, color: glove, outline: true });
    parts.push({ geo: roundBox(PALM.w * 0.86, 0.022, 0.012).translate(0, PALM.h - 0.012, -PALM.d / 2 + 0.002), bone: BONE_PALM, color: accent, outline: false });
    parts.push({ geo: roundBox(PALM.w * 0.62, PALM.h * 0.58, 0.008).translate(-0.004 * sx, PALM.h * 0.5, PALM.d / 2 - 0.001), bone: BONE_PALM, color: palm, outline: false });
    // Lüftungsschlitze auf dem Handrücken (drei schmale Streifen).
    for (let i = 0; i < 3; i++) {
      parts.push({ geo: roundBox(0.006, 0.03, 0.005).translate((-0.016 + i * 0.016) * sx, PALM.h * 0.45, -PALM.d / 2 - 0.0005), bone: BONE_PALM, color: palm, outline: false });
    }
    // Stulpe mit Klettverschluss.
    const cuff = new THREE.CylinderGeometry(CUFF.r0, CUFF.r1, CUFF.len, 14, 1, true);
    cuff.translate(0, -CUFF.len / 2 + 0.006, 0);
    parts.push({ geo: cuff, bone: 0, color: accent, outline: true });
    const cuffCap = new THREE.CylinderGeometry(CUFF.r1, CUFF.r1, 0.006, 14);
    cuffCap.translate(0, -CUFF.len + 0.006, 0);
    parts.push({ geo: cuffCap, bone: 0, color: accent, outline: false });
    const strap = roundBox(0.05, 0.022, 0.012);
    strap.translate(0.004 * sx, -0.024, -CUFF.r0 - 0.003);
    parts.push({ geo: strap, bone: 0, color: glove, outline: false });
    // Finger
    FINGERS.forEach((f, fi) => {
      let parent = b[BONE_PALM];
      let at = new THREE.Vector3(f.x * sx, f.y, 0);
      for (let j = 0; j < 3; j++) {
        const bone = b[fingerBone(fi, j)];
        bone.position.copy(at);
        parent.add(bone);
        const r = f.r * (1 - j * 0.07);
        parts.push({ geo: capsule(r, f.l[j]), bone: fingerBone(fi, j), color: glove, outline: true });
        // Polster auf dem Rücken des ersten Glieds.
        if (j === 0) parts.push({ geo: roundBox(r * 1.5, f.l[0] * 0.5, 0.006).translate(0, f.l[0] * 0.5, -r * 0.92), bone: fingerBone(fi, j), color: accent, outline: false });
        parent = bone;
        at = new THREE.Vector3(0, f.l[j], 0);
      }
    });
    // Daumen
    const tdir = new THREE.Vector3(THUMB.dir[0] * sx, THUMB.dir[1], THUMB.dir[2]).normalize();
    let parent = b[BONE_PALM];
    let at = new THREE.Vector3(THUMB.at[0] * sx, THUMB.at[1], THUMB.at[2]);
    for (let j = 0; j < 3; j++) {
      const bone = b[thumbBone(j)];
      bone.position.copy(at);
      if (j === 0) {
        bone.quaternion.setFromUnitVectors(Y, tdir);
        const across = new THREE.Vector3(THUMB.across[0] * sx, THUMB.across[1], THUMB.across[2]).normalize();
        this.thumbAcross.setFromUnitVectors(Y, across);
      }
      parent.add(bone);
      parts.push({ geo: capsule(THUMB.r * (1 - j * 0.08), THUMB.l[j]), bone: thumbBone(j), color: glove, outline: true });
      parent = bone;
      at = new THREE.Vector3(0, THUMB.l[j], 0);
    }
    // Ruhelage festhalten, Netz bauen, binden.
    this.group.updateMatrixWorld(true);
    const { geo, outline } = mergeParts(parts, b);
    for (const p of parts) p.geo.dispose();
    const mat = toonMaterial({ vertexColors: true });
    this.mesh = new THREE.SkinnedMesh(geo, mat);
    this.mesh.name = side > 0 ? 'Handschuh rechts' : 'Handschuh links';
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    const skeleton = new THREE.Skeleton(b);
    this.mesh.bind(skeleton);
    withSkinnedOutline(this.mesh, outline, 0.012);
    this.restQ = b.map((x) => x.quaternion.clone());
    // Faustmitte: Mittelfinger in Griffhaltung, Mittel aus Knöchel, Gelenken und Spitze.
    this.pose(GRIP, GRIP, 1);
    this.group.updateMatrixWorld(true);
    const mid = new THREE.Vector3();
    const pts = [fingerBone(1, 0), fingerBone(1, 1), fingerBone(1, 2)].map((i) => b[i].getWorldPosition(new THREE.Vector3()));
    const tip = new THREE.Vector3(0, FINGERS[1].l[2], 0).applyMatrix4(b[fingerBone(1, 2)].matrixWorld);
    for (const p of [...pts, tip]) mid.add(p);
    this.gripCenter.copy(mid.multiplyScalar(0.25));
    this.gripCenter.x = 0;
  }

  private readonly restQ: THREE.Quaternion[];
  /** Daumen-Grundglied quer über der Faust. */
  private readonly thumbAcross = new THREE.Quaternion();
  private readonly _q = new THREE.Quaternion();
  private readonly _e = new THREE.Euler();

  /** Haltung zwischen a und b (k = 0 … 1). */
  pose(a: HandPose, b: HandPose, k: number): void {
    const bn = this.bones;
    const lerp = (x: number, y: number): number => x + (y - x) * k;
    const spread = lerp(a.spread, b.spread);
    for (let f = 0; f < 4; f++) {
      for (let j = 0; j < 3; j++) {
        const bone = bn[fingerBone(f, j)];
        // Krümmen um x (zur Handfläche, +z); das Grundglied zusätzlich etwas gespreizt (um z).
        const curl = lerp(a.f[j], b.f[j]) * (f === 3 ? 1.05 : 1);
        this._e.set(curl, 0, j === 0 ? -(f - 1.5) * spread * this.side : 0);
        bone.quaternion.copy(this.restQ[fingerBone(f, j)]).multiply(this._q.setFromEuler(this._e));
      }
    }
    // Daumen: Grundglied von abgespreizt zu quer über die Faust, die beiden anderen Glieder krümmen sich zur Faust.
    bn[thumbBone(0)].quaternion.copy(this.restQ[thumbBone(0)]).slerp(this.thumbAcross, lerp(a.t[0], b.t[0]));
    for (let j = 1; j < 3; j++) {
      const bone = bn[thumbBone(j)];
      this._q.setFromAxisAngle(XAXIS, lerp(a.t[j], b.t[j]));
      bone.quaternion.copy(this.restQ[thumbBone(j)]).multiply(this._q);
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    for (const c of this.mesh.children) (c as THREE.Mesh).geometry?.dispose();
  }
}
const XAXIS = new THREE.Vector3(1, 0, 0);
const GOLD_TINT = new THREE.Color(0xffc93a);
const GOLD_GLOW = new THREE.Color(0x4a2e00);


// ───────────────────────────── Lenkrad und Armaturen ─────────────────────────────

/** Tachoscheibe als Bild (einmal gezeichnet): Skala bis 140 km/h, rote Zone ab 110. */
function gaugeTexture(accent: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbf6ea';
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = '#16131c';
  g.stroke();
  // Skala: von unten links (225°) im Uhrzeigersinn bis unten rechts (−45°).
  for (let i = 0; i <= 14; i++) {
    const a = ((225 - (i / 14) * 270) * Math.PI) / 180;
    const big = i % 2 === 0;
    const r0 = big ? 40 : 46;
    g.strokeStyle = i >= 11 ? '#e5413a' : '#16131c';
    g.lineWidth = big ? 5 : 3;
    g.beginPath();
    g.moveTo(64 + Math.cos(a) * r0, 64 - Math.sin(a) * r0);
    g.lineTo(64 + Math.cos(a) * 54, 64 - Math.sin(a) * 54);
    g.stroke();
  }
  g.fillStyle = accent;
  g.beginPath();
  g.arc(64, 64, 11, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Am Lenkrad: so weit kippen die Knöchel von „gerade nach vorn“ nach innen über den Kranz (rad). */
export let GRIP_LEAN = 0.45;
/** Anteil des Unterarms an der Richtung der Faust am Lenkrad (0 = nur Lenkrad). */
export let GRIP_ARM = 0;
export function setGrip(lean: number, arm: number): void {
  GRIP_LEAN = lean;
  GRIP_ARM = arm;
}
const _fa = new THREE.Vector3();
const _qi = new THREE.Quaternion();

/** Armaturen relativ zur Lenkrad-Mitte: höher, weiter vorn (Meter), Neigung zur Figur (rad). */
export const DASH: [number, number, number] = [-0.02, 0.17, 0.5];

export interface CockpitState {
  /** Tempo (m/s, Betrag) und Anteil des Höchsttempos. */
  speed: number;
  speed01: number;
  /** Drift: Richtung, aufgeladene Turbo-Stufe (0 … 3), Ladung als Anteil bis zur nächsten Stufe. */
  driftDir: number;
  stage: number;
  /** Schub aktiv. */
  boost: boolean;
  /** Ein Item wartet auf den Einsatz (Lampe). */
  itemReady: boolean;
}

/** Die Teile für ein Kart (Figur und Platz bestimmen Farben und Maße). */
export class CockpitKit {
  readonly gloves: [Glove, Glove];
  readonly wheel = new THREE.Group();
  readonly dash = new THREE.Group();
  private readonly needle = new THREE.Group();
  private readonly leds: THREE.MeshBasicMaterial[] = [];
  private readonly itemLamp: THREE.MeshBasicMaterial;
  private readonly owned: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];
  private readonly gauge: THREE.CanvasTexture;
  private rig: CockpitRig | null = null;
  private needleA = 0;
  private goldK = 0;
  private readonly tinted: THREE.MeshToonMaterial[] = [];
  private gripK = [1, 1];
  private readonly _m = new THREE.Matrix4();
  private readonly _q = new THREE.Quaternion();
  private readonly _q2 = new THREE.Quaternion();
  private readonly _v = new THREE.Vector3();
  private readonly _t = new THREE.Vector3();
  private readonly _x = new THREE.Vector3();
  private readonly _y = new THREE.Vector3();
  private readonly _z = new THREE.Vector3();

  constructor(
    readonly character: number,
    readonly slot: number,
    accent: number,
  ) {
    const glove = 0xf6f1e7;
    const palm = 0x4a4556;
    this.gloves = [new Glove(1, glove, accent, palm), new Glove(-1, glove, accent, palm)];
    this.gauge = gaugeTexture(`#${accent.toString(16).padStart(6, '0')}`);
    this.itemLamp = new THREE.MeshBasicMaterial({ color: 0x3a3646 });
    this.buildWheel(accent);
    this.buildDash(accent);
    for (const g of [this.wheel, this.needle, this.dash.children[0]]) this.flush(g);
  }

  /** Teile sammeln (je Gruppe) – flush() fügt sie zu einem Netz mit Eckenfarben zusammen: ein Aufruf plus Kontur. */
  private readonly pending = new Map<THREE.Object3D, { geo: THREE.BufferGeometry; color: number; outline: boolean }[]>();

  private mesh(geo: THREE.BufferGeometry, color: number, outline = 0, parent: THREE.Object3D = this.wheel): void {
    let list = this.pending.get(parent);
    if (!list) this.pending.set(parent, (list = []));
    list.push({ geo, color, outline: outline > 0 });
  }

  private flush(parent: THREE.Object3D): void {
    const list = this.pending.get(parent);
    if (!list) return;
    this.pending.delete(parent);
    const pos: number[] = [];
    const nor: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const oPos: number[] = [];
    const oIdx: number[] = [];
    for (const part of list) {
      const g = part.geo;
      const p = g.getAttribute('position') as THREE.BufferAttribute;
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      const n = g.getAttribute('normal') as THREE.BufferAttribute;
      const c = rgb(part.color);
      const base = pos.length / 3;
      const oBase = oPos.length / 3;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nor.push(n.getX(i), n.getY(i), n.getZ(i));
        col.push(c[0], c[1], c[2]);
        if (part.outline) oPos.push(p.getX(i), p.getY(i), p.getZ(i));
      }
      const ix = g.index;
      const count = ix ? ix.count : p.count;
      for (let i = 0; i < count; i++) {
        const k = ix ? ix.getX(i) : i;
        idx.push(base + k);
        if (part.outline) oIdx.push(oBase + k);
      }
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mat = toonMaterial({ vertexColors: true });
    this.owned.push(geo);
    this.mats.push(mat);
    this.tinted.push(mat);
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    if (oIdx.length > 0) {
      const og = new THREE.BufferGeometry();
      og.setAttribute('position', new THREE.Float32BufferAttribute(oPos, 3));
      og.setIndex(oIdx);
      og.computeVertexNormals();
      addSmoothNormals(og);
      this.owned.push(og);
      const o = new THREE.Mesh(og, outlineMaterial(0.01));
      o.name = 'outline';
      m.add(o);
    }
  }

  /**
   * Lenkrad-Aufsatz: dicker Kranz mit Griffwülsten an den Haltepunkten, drei Speichen, Nabe mit Startnummer-Plakette
   * und zwei Knöpfen. Liegt im Raum des Lenkrad-Knochens (Kranz in der x-y-Ebene, wie das Lenkrad des Karts).
   */
  private buildWheel(accent: number): void {
    // (Größe wird beim Anhängen an das Lenkrad der Figur angepasst: Maße hier für Radius 1.)
    const rim = new THREE.TorusGeometry(1, 0.15, 8, 40);
    this.mesh(rim, 0x2f2b38, 0.012);
    // Griffwülste dort, wo die Hände liegen (bei etwa −31° und 211°), und oben eine Markierung in Akzentfarbe.
    for (const a of [-0.54, Math.PI + 0.54]) {
      const g = new THREE.TorusGeometry(1, 0.19, 8, 10, 0.75);
      g.rotateZ(a - 0.375);
      this.mesh(g, 0x3e394a, 0.01);
    }
    const mark = new THREE.TorusGeometry(1, 0.165, 8, 4, 0.16);
    mark.rotateZ(Math.PI / 2 - 0.08);
    this.mesh(mark, accent);
    // Speichen: links, rechts, unten (zur Mitte flacher).
    for (const a of [0, Math.PI, -Math.PI / 2]) {
      const s = new THREE.BoxGeometry(0.86, 0.17, 0.08);
      s.translate(0.5, 0, 0.02);
      s.rotateZ(a);
      this.mesh(s, 0x8d95a6, 0.008);
    }
    const hub = new THREE.CylinderGeometry(0.34, 0.38, 0.16, 18);
    hub.rotateX(Math.PI / 2);
    hub.translate(0, 0, 0.06);
    this.mesh(hub, 0x2f2b38, 0.01);
    const badge = new THREE.CylinderGeometry(0.24, 0.24, 0.05, 18);
    badge.rotateX(Math.PI / 2);
    badge.translate(0, 0, 0.15);
    this.mesh(badge, accent);
    for (const x of [-0.55, 0.55]) {
      const btn = new THREE.CylinderGeometry(0.075, 0.075, 0.06, 10);
      btn.rotateX(Math.PI / 2);
      btn.translate(x, 0.12, 0.08);
      this.mesh(btn, x < 0 ? 0xe5413a : 0x1fc8b6);
    }
  }

  /** Armaturen: Gehäuse mit Tacho (Nadel), drei Drift-Lampen und einer Item-Lampe. Raum: Tacho-Mitte, Fläche zeigt nach +z. */
  private buildDash(accent: number): void {
    const pod = new THREE.Group();
    this.dash.add(pod);
    const box = roundBox(0.26, 0.105, 0.07);
    box.translate(0, 0, -0.03);
    this.mesh(box, 0x2f2b38, 0.012, pod);
    const faceMat = new THREE.MeshBasicMaterial({ map: this.gauge });
    this.mats.push(faceMat);
    const faceGeo = new THREE.CircleGeometry(0.043, 24);
    this.owned.push(faceGeo);
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(-0.05, 0, 0.007);
    pod.add(face);
    const bezel = new THREE.TorusGeometry(0.045, 0.006, 6, 24);
    bezel.translate(-0.05, 0, 0.008);
    this.mesh(bezel, 0xc9d0dc, 0, pod);
    this.needle.position.set(-0.05, 0, 0.012);
    pod.add(this.needle);
    const n = new THREE.BoxGeometry(0.0055, 0.036, 0.003);
    n.translate(0, 0.016, 0);
    this.mesh(n, 0xe5413a, 0, this.needle);
    // Drift-Lampen: Türkis, Gelb, Magenta wie die Funken (übereinander rechts), darunter die Item-Lampe.
    const ledGeo = new THREE.CylinderGeometry(0.0095, 0.0095, 0.008, 12);
    ledGeo.rotateX(Math.PI / 2);
    this.owned.push(ledGeo);
    [0x2ee6d6, 0xffd23f, 0xff4fd8].forEach((c, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0x3a3646 });
      mat.userData.on = c;
      this.leds.push(mat);
      this.mats.push(mat);
      const m = new THREE.Mesh(ledGeo, mat);
      m.position.set(0.03 + i * 0.028, 0.018, 0.008);
      pod.add(m);
    });
    this.mats.push(this.itemLamp);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.016, 0.006), this.itemLamp);
    this.owned.push(lamp.geometry);
    lamp.position.set(0.058, -0.022, 0.006);
    pod.add(lamp);
    const trim = roundBox(0.27, 0.012, 0.075);
    trim.translate(0, 0.056, -0.03);
    this.mesh(trim, accent, 0, pod);
  }

  /** An die Knochen des eigenen Karts hängen (bzw. abnehmen mit null). */
  attach(rig: CockpitRig | null): void {
    if (this.rig === rig) return;
    for (const o of [this.wheel, this.dash, this.gloves[0].group, this.gloves[1].group]) o.removeFromParent();
    this.rig = rig;
    if (!rig) return;
    // Lenkrad: Aufsatz in der Ebene des Kranzes, auf dessen Radius gebracht.
    const R = rig.steerR;
    this.wheel.scale.setScalar(R);
    this.wheel.position.set(0, 0, 0.004);
    rig.steer.add(this.wheel);
    // Armaturen hinter dem Lenkrad (Lage je Bild in update), zur Figur gedreht.
    this.dash.rotation.set(-DASH[2], Math.PI, 0);
    rig.chassis.add(this.dash);
    // Handschuhe: an der Karosserie, Größe nach der Kugelhand der Figur.
    for (const g of this.gloves) {
      g.group.scale.setScalar(rig.hand / 0.068);
      rig.chassis.add(g.group);
    }
  }

  /** Jedes Bild nach KartVisual.update: Handschuhe an Lenkrad bzw. Item, Tacho, Lampen. */
  update(rig: CockpitRig, st: CockpitState, dt: number): void {
    // Die Armaturen folgen dem Lenkrad (es rückt in der Cockpit-Ansicht höher, kartModel.ts COCKPIT_STEER).
    const sp = rig.steer.position;
    this.dash.position.set(sp.x, sp.y + DASH[0], sp.z + DASH[1]);
    this.placeGlove(0, rig, rig.handR, rig.holdR, dt);
    this.placeGlove(1, rig, rig.handL, rig.holdL, dt);
    // Tacho: 0 … 140 km/h über 270°, Nadel federt leicht nach.
    const kmh = st.speed * 3.6;
    const want = (Math.min(kmh, 150) / 140) * 1.5 * Math.PI;
    this.needleA += (want - this.needleA) * Math.min(1, dt * 12);
    this.needle.rotation.z = (225 * Math.PI) / 180 - Math.PI / 2 - this.needleA;
    for (let i = 0; i < 3; i++) this.leds[i].color.setHex(st.stage > i ? (this.leds[i].userData.on as number) : 0x3a3646);
    this.itemLamp.color.setHex(st.itemReady ? 0xffd23f : 0x3a3646);
    this.paintGold(rig.gold);
  }

  /** Get Gold: Handschuhe, Lenkrad und Armaturen werden mit dem Kart gold (k = 0 … 1). */
  private paintGold(k: number): void {
    if (Math.abs(k - this.goldK) < 0.004) return;
    this.goldK = k;
    // (Alles mit Eckenfarben: die Materialfarbe wirkt als Faktor – Weiß bleibt Weiß, mit Gold wird alles gold getönt.)
    for (const mat of [...this.tinted, ...this.gloves.map((g) => g.mesh.material as THREE.MeshToonMaterial)]) {
      mat.color.set(0xffffff).lerp(GOLD_TINT, k);
      mat.emissive.copy(GOLD_GLOW).multiplyScalar(k);
    }
  }

  /**
   * Handschuh i (0 rechts, 1 links) an die Kugelhand setzen. Am Lenkrad liegt die Faust außen um den Kranz: Fingerachse
   * entlang des Kranzes, Handgelenk zur Figur, Knöchel nach vorn und etwas nach innen über den Kranz, Handfläche zur
   * Lenkradmitte; die Faustmitte genau auf dem Kranz. (Aus dem Unterarm lässt sich das nicht ableiten: Bei „zehn vor
   * zwei“ läuft er fast entlang des Kranzes.) Weg vom Lenkrad (free > 0) folgt der Handschuh dem Unterarm und hält,
   * was in der Hand ist.
   */
  private placeGlove(i: number, rig: CockpitRig, hand: THREE.Bone, free: number, dt: number): void {
    const g = this.gloves[i];
    const side = i === 0 ? -1 : 1; // Karosserie: links = +x
    const steer = rig.steer;
    steer.updateMatrix();
    const R = rig.steerR;
    // Griffpunkt wie in kartModel.ts (solveArm): bei (±0,82 R, −0,5 R) im Raum des Lenkrads.
    const phi = Math.atan2(-0.5, side * 0.82);
    const cphi = Math.cos(phi);
    const sphi = Math.sin(phi);
    this._v.set(cphi * R, sphi * R, 0).applyMatrix4(steer.matrix);
    // Im Raum des Lenkrads: u = vom Kranz nach außen, t = entlang des Kranzes, −z = von der Figur weg. Dazu ein Anteil
    // des Unterarms (quer zum Kranz), damit Stulpe und Unterarm in einer Linie liegen.
    const lean = GRIP_LEAN;
    this._y.set(-cphi * Math.sin(lean), -sphi * Math.sin(lean), -Math.cos(lean));
    this._x.set(-sphi, cphi, 0);
    _fa.set(0, 1, 0).applyQuaternion(hand.quaternion).applyQuaternion(_qi.copy(steer.quaternion).invert());
    _fa.addScaledVector(this._x, -_fa.dot(this._x));
    this._y.multiplyScalar(1 - GRIP_ARM).addScaledVector(_fa, GRIP_ARM).normalize();
    this._z.crossVectors(this._x, this._y);
    // Handfläche zur Lenkradmitte (−u).
    if (this._z.x * -cphi + this._z.y * -sphi < 0) {
      this._x.negate();
      this._z.negate();
    }
    this._m.makeBasis(this._x, this._y, this._z);
    this._q.setFromRotationMatrix(this._m).premultiply(steer.quaternion);
    // Frei: entlang des Unterarms, Handfläche nach innen (zur Mitte des Karts).
    const fy = this._t.set(0, 1, 0).applyQuaternion(hand.quaternion);
    const inward = new THREE.Vector3(-side, 0, 0);
    const fz = inward.addScaledVector(fy, -inward.dot(fy)).normalize();
    const fx = new THREE.Vector3().crossVectors(fy, fz);
    this._m.makeBasis(fx, fy, fz);
    this._q2.setFromRotationMatrix(this._m);
    const k = Math.max(0, Math.min(1, free));
    this._q.slerp(this._q2, k);
    // Faustmitte auf den Kranz bzw. auf die Hand.
    const sc = g.group.scale.x;
    const center = this._t.copy(g.gripCenter).multiplyScalar(sc).applyQuaternion(this._q);
    const at = this._v.lerp(hand.position, k);
    g.group.position.copy(at).sub(center);
    g.group.quaternion.copy(this._q);
    // Stulpe entlang des Unterarms (im Raum des Handschuhs).
    _fa.set(0, 1, 0).applyQuaternion(hand.quaternion).applyQuaternion(_qi.copy(this._q).invert());
    g.bones[0].quaternion.setFromUnitVectors(Y, _fa);
    // Finger: am Lenkrad geschlossen, mit Item gehalten, sonst locker.
    const holding = i === 0 && rig.held > 0;
    const target = k < 0.5 ? 1 : holding ? 0.6 : 0;
    this.gripK[i] += (target - this.gripK[i]) * Math.min(1, dt * 14);
    const c = this.gripK[i];
    if (c >= 0.6) g.pose(HOLD, GRIP, (c - 0.6) / 0.4);
    else g.pose(OPEN, HOLD, c / 0.6);
  }

  /** Qualitätsstufe „niedrig“: ohne Konturen (wie die Karts). */
  setOutlines(on: boolean): void {
    for (const o of [this.wheel, this.dash, this.gloves[0].group, this.gloves[1].group]) setOutlinesVisible(o, on);
  }

  setVisible(v: boolean): void {
    for (const o of [this.wheel, this.dash, this.gloves[0].group, this.gloves[1].group]) o.visible = v;
  }

  dispose(): void {
    this.attach(null);
    for (const g of this.owned) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const g of this.gloves) g.dispose();
    this.gauge.dispose();
  }
}

// Enterhaken: Haken und Leine in der Welt – vom Lasso über dem Kopf der Figur über den hohen Bogen des Wurfs bis zur
// straffen Leine, an der sich das Kart heranzieht. Comic-Tusche wie alles andere: Toon-Material, umgestülpte Hülle als Kontur.
//
// Wo Hand und Haken in jedem Bild sind, rechnet raceScene.ts aus dem Spielstand (Zeit seit dem Auslösen, Ziel) und aus der
// Figur (kartModel.ts: Hand, Lasso). Hier wird nur gezeichnet: der Haken (dasselbe Netz, das die Figur in der Hand hatte,
// nur größer) und die Leine als gedrehtes Seil – ein Schlauch entlang einer Kurve durch drei Punkte (Hand, Mitte, Haken),
// dessen Ecken jedes Bild neu gesetzt werden.
//
// Kosten: je Haken vier Aufrufe (Haken, Leine, je mit Kontur), höchstens einer je Kart – und nur, solange er unterwegs ist.
// Damit der erste Wurf nicht ruckelt, liegt bis zum Übersetzen der Grafikprogramme einer unsichtbar weit unter der Welt
// (park/unpark).

import * as THREE from 'three';
import { ROPE, getHookGeo } from './kartModel';
import { outlineMaterial, rgb, toonMaterial } from './toon';

/** Dunklere Schläge des Seils. */
const ROPE_D = 0xb98a45;
/** Leine: Stützstellen längs, Ecken im Querschnitt, Radius (Meter). */
const SEGS = 22;
const SIDES = 6;
const RADIUS = 0.055;
/** So groß ist der fliegende Haken gegenüber dem in der Hand – aus der Fahrkamera muss er auffallen. */
export const HOOK_SIZE = 2.3;

interface Rig {
  hook: THREE.Mesh;
  rope: THREE.Mesh;
  geo: THREE.BufferGeometry;
  pos: THREE.BufferAttribute;
  nor: THREE.BufferAttribute;
  onor: THREE.BufferAttribute;
  used: boolean;
  layer: number;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export class Grapples {
  readonly group = new THREE.Group();
  private readonly rigs = new Map<number, Rig>();
  private readonly free: Rig[] = [];
  private parked: Rig | null = null;
  private readonly toon = toonMaterial({ vertexColors: true });
  private readonly index: number[] = [];
  private readonly colors: Float32Array;
  private readonly p = new THREE.Vector3();
  private readonly prev = new THREE.Vector3();
  private readonly t = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly mid = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();

  constructor(private readonly outlines: boolean) {
    this.group.name = 'enterhaken';
    // Flächen des Schlauchs und seine Farben stehen fest: schräg umlaufende Schläge wie bei einem gedrehten Seil.
    for (let i = 0; i < SEGS; i++) {
      for (let j = 0; j < SIDES; j++) {
        const a = i * SIDES + j;
        const b = i * SIDES + ((j + 1) % SIDES);
        const c = a + SIDES;
        const d = b + SIDES;
        // (Umlaufsinn so, dass die Flächen nach außen zeigen.)
        this.index.push(a, b, c, b, d, c);
      }
    }
    const light = rgb(ROPE);
    const dark = rgb(ROPE_D);
    this.colors = new Float32Array((SEGS + 1) * SIDES * 3);
    for (let i = 0; i <= SEGS; i++) {
      for (let j = 0; j < SIDES; j++) {
        const c = (i + j) % 3 === 0 ? dark : light;
        this.colors.set(c, (i * SIDES + j) * 3);
      }
    }
  }

  /**
   * Haken und Leine des Karts slot in diesem Bild (alles Welt): hand = wo die Leine die Hand verlässt, tip = Öse des Hakens,
   * dir = wohin seine Krallen zeigen, bend = um so viel hängt bzw. bauscht die Mitte der Leine gegenüber der Geraden,
   * size = Maßstab des Hakens (1 = volle Größe), spin = Drehung um seine Achse (rad). layer: Zeichenebene – das eigene Kart
   * in der Cockpit-Ansicht wird in einem zweiten Durchgang gezeichnet, und seine Leine gehört dazu (sonst läge die
   * Karosserie immer über ihr).
   */
  set(slot: number, hand: THREE.Vector3, tip: THREE.Vector3, dir: THREE.Vector3, bend: THREE.Vector3, size: number, spin: number, layer = 0): void {
    let r = this.rigs.get(slot);
    if (!r) {
      r = this.free.pop() ?? this.makeRig();
      this.rigs.set(slot, r);
      this.group.add(r.hook, r.rope);
    }
    r.used = true;
    if (r.layer !== layer) {
      r.layer = layer;
      r.hook.traverse((o) => o.layers.set(layer));
      r.rope.traverse((o) => o.layers.set(layer));
    }
    this.place(r, hand, tip, dir, bend, size, spin);
  }

  /** Nach allen set()-Aufrufen eines Bildes: Wer keinen Haken mehr unterwegs hat, gibt seinen zurück. */
  update(): void {
    for (const [slot, r] of this.rigs) {
      if (r.used) {
        r.used = false;
        continue;
      }
      this.group.remove(r.hook, r.rope);
      this.rigs.delete(slot);
      this.free.push(r);
    }
  }

  /** Einen Haken samt Leine unsichtbar unter die Welt legen – so übersetzt die Szene ihre Grafikprogramme gleich mit. */
  park(): void {
    if (this.parked) return;
    const r = this.makeRig();
    this.place(r, this.p.set(0, -5000, 0), this.mid.set(0, -5000, 3), Y_AXIS, this.t.set(0, 0, 0), 1, 0);
    this.parked = r;
    this.group.add(r.hook, r.rope);
  }

  unpark(): void {
    const r = this.parked;
    if (!r) return;
    this.parked = null;
    this.group.remove(r.hook, r.rope);
    this.free.push(r);
  }

  /** Alles weg (neues Rennen). */
  clear(): void {
    for (const r of this.rigs.values()) {
      this.group.remove(r.hook, r.rope);
      this.free.push(r);
    }
    this.rigs.clear();
  }

  dispose(): void {
    this.clear();
    this.unpark();
    for (const r of this.free) r.geo.dispose();
    this.free.length = 0;
    this.toon.dispose();
  }

  private place(r: Rig, hand: THREE.Vector3, tip: THREE.Vector3, dir: THREE.Vector3, bend: THREE.Vector3, size: number, spin: number): void {
    // Haken: Öse an der Leine, Achse nach dir, dazu die Drehung um die Achse.
    this.t.copy(dir);
    if (this.t.lengthSq() < 1e-8) this.t.set(0, 1, 0);
    this.t.normalize();
    this.q.setFromUnitVectors(Y_AXIS, this.t);
    this.q2.setFromAxisAngle(Y_AXIS, spin);
    r.hook.position.copy(tip);
    r.hook.quaternion.copy(this.q).multiply(this.q2);
    r.hook.scale.setScalar(Math.max(0.001, size * HOOK_SIZE));

    // Leine: Kurve durch Hand, Mitte (um bend versetzt) und Öse; rundherum ein Schlauch. Der Querschnitt wird von Ring zu
    // Ring mitgeführt (ohne Verdrehen), die Normalen zeigen nach außen – daraus nimmt auch die Kontur ihre Richtung.
    this.mid.addVectors(hand, tip).multiplyScalar(0.5).add(bend);
    const pos = r.pos.array as Float32Array;
    const nor = r.nor.array as Float32Array;
    const onor = r.onor.array as Float32Array;
    this.prev.copy(hand);
    let first = true;
    for (let i = 0; i <= SEGS; i++) {
      const u = i / SEGS;
      // Bézier durch drei Punkte: Die Steuerstelle liegt so, dass die Kurve bei u = 0,5 durch die Mitte geht.
      const a = (1 - u) * (1 - u);
      const c = u * u;
      const m = 2 * u * (1 - u);
      const cx = 2 * this.mid.x - 0.5 * (hand.x + tip.x);
      const cy = 2 * this.mid.y - 0.5 * (hand.y + tip.y);
      const cz = 2 * this.mid.z - 0.5 * (hand.z + tip.z);
      this.p.set(a * hand.x + m * cx + c * tip.x, a * hand.y + m * cy + c * tip.y, a * hand.z + m * cz + c * tip.z);
      // Richtung der Kurve an dieser Stelle
      this.t.set(
        2 * (1 - u) * (cx - hand.x) + 2 * u * (tip.x - cx),
        2 * (1 - u) * (cy - hand.y) + 2 * u * (tip.y - cy),
        2 * (1 - u) * (cz - hand.z) + 2 * u * (tip.z - cz),
      );
      if (this.t.lengthSq() < 1e-10) this.t.subVectors(tip, hand);
      if (this.t.lengthSq() < 1e-10) this.t.set(0, 0, 1);
      this.t.normalize();
      if (first) {
        // Erste Querrichtung: irgendeine, die nicht längs liegt.
        this.n.set(0, 1, 0);
        if (Math.abs(this.t.y) > 0.9) this.n.set(1, 0, 0);
        first = false;
      }
      this.n.addScaledVector(this.t, -this.n.dot(this.t));
      if (this.n.lengthSq() < 1e-10) this.n.set(this.t.z, 0, -this.t.x);
      this.n.normalize();
      this.b.crossVectors(this.t, this.n);
      for (let j = 0; j < SIDES; j++) {
        const ang = (j / SIDES) * Math.PI * 2;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const nx = this.n.x * ca + this.b.x * sa;
        const ny = this.n.y * ca + this.b.y * sa;
        const nz = this.n.z * ca + this.b.z * sa;
        const o = (i * SIDES + j) * 3;
        pos[o] = this.p.x + nx * RADIUS;
        pos[o + 1] = this.p.y + ny * RADIUS;
        pos[o + 2] = this.p.z + nz * RADIUS;
        nor[o] = onor[o] = nx;
        nor[o + 1] = onor[o + 1] = ny;
        nor[o + 2] = onor[o + 2] = nz;
      }
    }
    r.pos.needsUpdate = true;
    r.nor.needsUpdate = true;
    r.onor.needsUpdate = true;
  }

  private makeRig(): Rig {
    const hg = getHookGeo();
    const hook = new THREE.Mesh(hg.main, this.toon);
    hook.name = 'enterhaken';
    hook.frustumCulled = false;
    if (this.outlines && hg.line) {
      const ol = new THREE.Mesh(hg.line, outlineMaterial());
      ol.name = 'outline';
      ol.frustumCulled = false;
      hook.add(ol);
    }
    const count = (SEGS + 1) * SIDES;
    const geo = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    const nor = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    const onor = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    pos.setUsage(THREE.DynamicDrawUsage);
    nor.setUsage(THREE.DynamicDrawUsage);
    onor.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', pos);
    geo.setAttribute('normal', nor);
    geo.setAttribute('onormal', onor);
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setIndex(this.index);
    // Die Leine liegt jedes Bild woanders: nie nach ihrer (veralteten) Hülle wegschneiden.
    const rope = new THREE.Mesh(geo, this.toon);
    rope.name = 'leine';
    rope.frustumCulled = false;
    if (this.outlines) {
      const ol = new THREE.Mesh(geo, outlineMaterial(0.03));
      ol.name = 'outline';
      ol.frustumCulled = false;
      rope.add(ol);
    }
    return { hook, rope, geo, pos, nor, onor, used: false, layer: 0 };
  }
}

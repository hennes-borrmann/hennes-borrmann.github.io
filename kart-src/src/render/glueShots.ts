// Kleber: der Klumpen auf dem Weg von der Klebepistole zum Ziel – und der Klecks, den er auf der Fahrbahn hinterlässt,
// wenn hinter dem Schützen niemand in Reichweite war. Comic-Tusche wie alles andere: Toon-Material, umgestülpte Hülle
// als Kontur, ein Klecks mit Tuscherand.
//
// Wohin der Klumpen fliegt, rechnet raceScene.ts aus dem Spielstand (Pistole des Schützen, Ziel, Zeit seit dem Schuss);
// hier wird er nur gezeichnet: gestreckt in Flugrichtung, dahinter eine Spur aus Tropfen, die kleiner werden.
//
// Kosten: je fliegendem Klumpen zwei Aufrufe (Körper und Kontur) und fünf kleine für die Tropfen; je Klecks auf der
// Fahrbahn zwei (Klecks und Rand). Höchstens vier von jedem (ein Schuss je Kart) – alles nur, solange es zu sehen ist.
// Damit der erste Schuss nicht ruckelt, liegen bis zum Übersetzen der Grafikprogramme je ein Klumpen und ein Klecks
// unsichtbar weit unter der Welt (park/unpark).

import * as THREE from 'three';
import { INK, addSmoothNormals, outlineMaterial, toonMaterial } from './toon';

/** Rahmweiß wie der Kleber an Pistole und Gesicht (kartModel.ts). */
const GLUE = 0xfff1c2;
/** Tropfen der Spur hinter dem Klumpen. */
const DROPS = 5;
/** So lange bleibt ein Klecks auf der Fahrbahn liegen (Sekunden), die letzte halbe Sekunde schrumpft er weg. */
const SPLAT_LIFE = 2.6;
const MAX = 4;

/** Klumpen: Kugel mit Beulen – fest verdrehte Sinuswellen statt Zufall, damit er auf jedem Bildschirm gleich aussieht. */
function lumpGeo(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.3, 14, 10);
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const bump = 1 + 0.16 * Math.sin(n.x * 5.1 + 1.3) * Math.cos(n.y * 4.3) + 0.1 * Math.sin(n.z * 7.7 + n.x * 2.1);
    v.copy(n).multiplyScalar(0.3 * bump);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return addSmoothNormals(g);
}

/** Klecks: flacher Umriss mit Beulen und Spritzern (in der x-z-Ebene); scale > 1 ergibt den Tuscherand darunter. */
function splatGeo(scale: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = (0.9 + 0.16 * Math.sin(a * 5 + 0.7) + 0.1 * Math.sin(a * 9 + 2.1) + 0.22 * Math.pow(Math.max(0, Math.sin(a * 3 + 0.4)), 8)) * scale;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const g = new THREE.ShapeGeometry(shape);
  // Drei Spritzer rundherum
  const parts: THREE.BufferGeometry[] = [g];
  for (const [a, d, r] of [
    [0.6, 1.45, 0.16],
    [2.5, 1.38, 0.12],
    [4.4, 1.5, 0.14],
  ] as const) {
    const c = new THREE.CircleGeometry(r * scale + (scale - 1) * 0.6, 10);
    c.translate(Math.cos(a) * d, Math.sin(a) * d, 0);
    parts.push(c);
  }
  const merged = mergeFlat(parts);
  merged.rotateX(-Math.PI / 2);
  return merged;
}

/** Einfache Zusammenführung flacher Geometrien (nur Lage und Normale). */
function mergeFlat(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const g of parts) {
    const base = pos.length / 3;
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    const index = g.getIndex();
    if (index) for (let i = 0; i < index.count; i++) idx.push(base + index.getX(i));
    else for (let i = 0; i < p.count; i++) idx.push(base + i);
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}

interface Flight {
  blob: THREE.Mesh;
  drops: THREE.Mesh[];
  /** Letzte Lagen des Klumpens (für die Tropfenspur), neueste zuerst. */
  trail: THREE.Vector3[];
  used: boolean;
}

interface Splat {
  mesh: THREE.Group;
  age: number;
  size: number;
}

export class GlueShots {
  readonly group = new THREE.Group();
  private readonly flights = new Map<number, Flight>();
  private parked: Flight | null = null;
  private readonly free: Flight[] = [];
  private readonly splats: Splat[] = [];
  private readonly lump: THREE.BufferGeometry;
  private readonly drop: THREE.BufferGeometry;
  private readonly splatTop: THREE.BufferGeometry;
  private readonly splatRim: THREE.BufferGeometry;
  private readonly mat = toonMaterial({ color: GLUE });
  private readonly splatMat = new THREE.MeshBasicMaterial({ color: GLUE, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -10 });
  private readonly rimMat = new THREE.MeshBasicMaterial({ color: INK, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 });
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(private readonly outlines: boolean) {
    this.group.name = 'kleber';
    this.lump = lumpGeo();
    this.drop = addSmoothNormals(new THREE.SphereGeometry(0.1, 8, 6));
    this.splatTop = splatGeo(1);
    this.splatRim = splatGeo(1.12);
  }

  /**
   * Der Klumpen des Karts slot steht in diesem Bild bei pos und fliegt in Richtung dir (beides Welt). u: Anteil des Flugs
   * (0 … 1) – beim Abschuss quillt er aus der Düse, am Ende wird er länger.
   */
  fly(slot: number, pos: THREE.Vector3, dir: THREE.Vector3, u: number): void {
    let f = this.flights.get(slot);
    if (!f) {
      f = this.free.pop() ?? this.makeFlight();
      f.trail.forEach((t) => t.copy(pos));
      this.flights.set(slot, f);
      this.group.add(f.blob, ...f.drops);
    }
    f.used = true;
    // Spur: die Lagen der letzten Bilder nachziehen
    for (let i = f.trail.length - 1; i > 0; i--) f.trail[i].lerp(f.trail[i - 1], 0.55);
    f.trail[0].copy(pos);
    const grow = Math.min(1, 0.35 + u * 4);
    const stretch = 1 + 0.9 * Math.min(1, u * 3) * (1 - 0.4 * u);
    this.q.setFromUnitVectors(this.up, this.v.copy(dir).normalize());
    f.blob.position.copy(pos);
    f.blob.quaternion.copy(this.q);
    f.blob.scale.set(grow / Math.sqrt(stretch), grow * stretch, grow / Math.sqrt(stretch));
    for (let i = 0; i < DROPS; i++) {
      const k = 1 - (i + 1) / (DROPS + 1);
      const d = f.drops[i];
      d.position.copy(f.trail[Math.min(f.trail.length - 1, i + 1)]);
      d.scale.setScalar(Math.max(0.001, k * 1.1 * Math.min(1, u * 6)));
    }
  }

  /** Je einen Klumpen und Klecks unsichtbar unter die Welt legen – so übersetzt die Szene ihre Grafikprogramme gleich mit. */
  park(): void {
    if (this.parked) return;
    const f = this.makeFlight();
    f.blob.position.set(0, -5000, 0);
    for (const d of f.drops) d.position.set(0, -5000, 0);
    this.splat(f.blob.position, this.q.identity());
    this.parked = f;
    this.group.add(f.blob, ...f.drops);
  }

  /** Nach dem Übersetzen: das Geparkte wieder weg. */
  unpark(): void {
    const f = this.parked;
    if (!f) return;
    this.parked = null;
    this.group.remove(f.blob, ...f.drops);
    this.free.push(f);
    for (const s of this.splats) {
      s.age = SPLAT_LIFE;
      this.group.remove(s.mesh);
    }
  }

  /** Klecks auf der Fahrbahn bei pos (Welt), q legt ihn auf den Boden. */
  splat(pos: THREE.Vector3, q: THREE.Quaternion, size = 1.3): void {
    let s = this.splats.find((x) => x.age >= SPLAT_LIFE);
    if (!s) {
      if (this.splats.length >= MAX) s = this.splats.reduce((a, b) => (a.age > b.age ? a : b));
      else {
        const mesh = new THREE.Group();
        const top = new THREE.Mesh(this.splatTop, this.splatMat);
        top.position.y = 0.03;
        const rim = new THREE.Mesh(this.splatRim, this.rimMat);
        rim.position.y = 0.02;
        mesh.add(rim, top);
        s = { mesh, age: 0, size };
        this.splats.push(s);
      }
    }
    s.age = 0;
    s.size = size;
    s.mesh.position.copy(pos);
    s.mesh.quaternion.copy(q);
    s.mesh.rotateY(pos.x * 1.7 + pos.z);
    this.group.add(s.mesh);
  }

  /** Nach allen fly()-Aufrufen eines Bildes: was nicht mehr fliegt, verschwindet; Kleckse altern. */
  update(dt: number): void {
    for (const [slot, f] of this.flights) {
      if (f.used) {
        f.used = false;
        continue;
      }
      this.group.remove(f.blob, ...f.drops);
      this.flights.delete(slot);
      this.free.push(f);
    }
    for (const s of this.splats) {
      if (s.age >= SPLAT_LIFE) continue;
      s.age += dt;
      // Aufklatschen mit Überschwinger, dann liegen, am Ende wegschrumpfen
      const a = Math.min(1, s.age / 0.12);
      const pop = a < 1 ? a * (1 + 0.35 * Math.sin(a * Math.PI)) : 1;
      const out = Math.max(0, Math.min(1, (SPLAT_LIFE - s.age) / 0.5));
      const k = s.size * pop * out;
      s.mesh.scale.set(k, 1, k);
      if (s.age >= SPLAT_LIFE) this.group.remove(s.mesh);
    }
  }

  /** Alles weg (neues Rennen). */
  clear(): void {
    for (const f of this.flights.values()) {
      this.group.remove(f.blob, ...f.drops);
      this.free.push(f);
    }
    this.flights.clear();
    for (const s of this.splats) {
      s.age = SPLAT_LIFE;
      this.group.remove(s.mesh);
    }
  }

  dispose(): void {
    this.clear();
    for (const g of [this.lump, this.drop, this.splatTop, this.splatRim]) g.dispose();
    for (const m of [this.mat, this.splatMat, this.rimMat]) m.dispose();
  }

  private makeFlight(): Flight {
    const blob = new THREE.Mesh(this.lump, this.mat);
    blob.name = 'kleberklumpen';
    blob.frustumCulled = false;
    if (this.outlines) {
      const ol = new THREE.Mesh(this.lump, outlineMaterial(0.05));
      ol.name = 'outline';
      ol.frustumCulled = false;
      blob.add(ol);
    }
    const drops: THREE.Mesh[] = [];
    for (let i = 0; i < DROPS; i++) {
      const d = new THREE.Mesh(this.drop, this.mat);
      d.name = 'klebertropfen';
      d.frustumCulled = false;
      drops.push(d);
    }
    const trail: THREE.Vector3[] = [];
    for (let i = 0; i < DROPS + 2; i++) trail.push(new THREE.Vector3());
    return { blob, drops, trail, used: false };
  }
}

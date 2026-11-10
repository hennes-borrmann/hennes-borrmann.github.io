// Werkzeug zum Zusammensetzen von Geometrie aus einzelnen Flächen.
//
// Alles Statische der Welt (Fahrbahn, Banden, Gelände, Kulissen) entsteht aus
// eingefärbten Drei- und Vierecken, die am Ende zu wenigen großen Netzen
// zusammengefasst werden: wenige Zeichenaufrufe, kantige Flächen, Farbe pro
// Fläche – genau richtig für den Comic-Look.

import * as THREE from 'three';

export type V3 = [number, number, number];
export type RGB = [number, number, number];

export class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly uvs: number[] = [];
  private hasUv = false;

  get triangles(): number {
    return this.pos.length / 9;
  }

  /** Dreieck; gegen den Uhrzeigersinn von der sichtbaren Seite. */
  tri(a: V3, b: V3, c: V3, color: RGB): void {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) this.col.push(color[0], color[1], color[2]);
    this.uvs.push(0, 0, 0, 0, 0, 0);
  }

  /** Viereck a→b→c→d gegen den Uhrzeigersinn von der sichtbaren Seite. */
  quad(a: V3, b: V3, c: V3, d: V3, color: RGB): void {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Viereck mit Texturkoordinaten (u0,v0 bei a … u1,v1 bei c). */
  quadUv(a: V3, b: V3, c: V3, d: V3, color: RGB, u0: number, v0: number, u1: number, v1: number): void {
    this.hasUv = true;
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    for (let i = 0; i < 6; i++) this.col.push(color[0], color[1], color[2]);
    this.uvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  }

  /** Quader um (cx, cy, cz) mit Kantenlängen sx, sy, sz, um die Hochachse gedreht. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: RGB, rotY = 0, top?: RGB): void {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const p = (x: number, y: number, z: number): V3 => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const v = [
      p(-hx, -hy, -hz),
      p(hx, -hy, -hz),
      p(hx, hy, -hz),
      p(-hx, hy, -hz),
      p(-hx, -hy, hz),
      p(hx, -hy, hz),
      p(hx, hy, hz),
      p(-hx, hy, hz),
    ];
    this.quad(v[4], v[5], v[6], v[7], color); // +z
    this.quad(v[1], v[0], v[3], v[2], color); // -z
    this.quad(v[5], v[1], v[2], v[6], color); // +x
    this.quad(v[0], v[4], v[7], v[3], color); // -x
    this.quad(v[7], v[6], v[2], v[3], top ?? color); // oben
    this.quad(v[0], v[1], v[5], v[4], color); // unten
  }

  /** Fügt eine fertige Geometrie ein (einfarbig), verschoben, gedreht und skaliert. */
  add(geo: THREE.BufferGeometry, color: RGB, matrix?: THREE.Matrix4): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (matrix) v.applyMatrix4(matrix);
      this.pos.push(v.x, v.y, v.z);
      this.col.push(color[0], color[1], color[2]);
      this.uvs.push(0, 0);
    }
    if (g !== geo) g.dispose();
  }

  get empty(): boolean {
    return this.pos.length === 0;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.hasUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** Wiederholbarer Zufall – dieselbe Strecke sieht auf jedem Gerät gleich aus. */
export function seeded(seed: number): () => number {
  let s = (seed % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Weiches Rauschen 0..1 für Gelände und Farbabweichungen. */
export function noise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function smooth(k: number): number {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x);
}

export function mixRgb(a: RGB, b: RGB, k: number): RGB {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export function shade(c: RGB, f: number): RGB {
  return [c[0] * f, c[1] * f, c[2] * f];
}

/** Beschriftete Fläche als Textur (Schilder, Banner, Leuchtreklame). */
export function textTexture(
  text: string,
  opts: { w?: number; h?: number; bg?: string; fg?: string; font?: string; border?: string } = {},
): THREE.CanvasTexture {
  const w = opts.w ?? 256;
  const h = opts.h ?? 96;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  if (opts.bg) {
    g.fillStyle = opts.bg;
    g.fillRect(0, 0, w, h);
  }
  if (opts.border) {
    g.strokeStyle = opts.border;
    g.lineWidth = Math.round(h * 0.1);
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
  }
  g.fillStyle = opts.fg ?? '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = Math.round(h * 0.62);
  const font = opts.font ?? '900 SIZEpx "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  g.font = font.replace('SIZE', String(size));
  const max = w * 0.86;
  const measured = g.measureText(text).width;
  if (measured > max) {
    size = Math.floor((size * max) / measured);
    g.font = font.replace('SIZE', String(size));
  }
  g.fillText(text, w / 2, h / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

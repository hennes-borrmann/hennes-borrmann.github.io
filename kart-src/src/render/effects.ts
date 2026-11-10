// Alles Flüchtige: Funken, Staub, Flammen, Bremsspuren, Tempostriche, Schatten
// und die Comic-Wörter ("KRACH!"), die bei Ereignissen aufploppen.
//
// Jede Art nutzt einen festen Vorrat, der im Kreis wiederverwendet wird – im
// laufenden Rennen wird nichts neu angelegt.

import * as THREE from 'three';

// --- Teilchen ----------------------------------------------------------------

const P_VERT = /* glsl */ `
attribute float size;
attribute float alpha;
attribute vec3 tint;
uniform float scale;
varying float vAlpha;
varying vec3 vTint;
void main() {
  vTint = tint;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

/** Deckende Bällchen mit dunklem Rand – Staub, Rauch, Konfetti. */
const P_FRAG_PUFF = /* glsl */ `
varying float vAlpha;
varying vec3 vTint;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0 || vAlpha < 0.02) discard;
  float rim = smoothstep(0.6, 0.78, d);
  gl_FragColor = vec4(mix(vTint, vTint * 0.3, rim), vAlpha);
  #include <colorspace_fragment>
}`;

/** Leuchtende Punkte – Funken, Flammen. */
const P_FRAG_GLOW = /* glsl */ `
varying float vAlpha;
varying vec3 vTint;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float core = 1.0 - smoothstep(0.0, 0.55, d);
  gl_FragColor = vec4(mix(vTint, vec3(1.0), core * 0.7) * vAlpha, 1.0);
  #include <colorspace_fragment>
}`;

export class Particles {
  readonly points: THREE.Points;
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly tint: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly grow: Float32Array;
  private readonly grav: Float32Array;
  private readonly drag: Float32Array;
  private readonly baseAlpha: Float32Array;
  private next = 0;
  private readonly geo = new THREE.BufferGeometry();
  private readonly mat: THREE.ShaderMaterial;

  constructor(capacity: number, glow: boolean) {
    this.n = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.tint = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.baseAlpha = new Float32Array(capacity);
    for (const [name, arr, items] of [
      ['position', this.pos, 3],
      ['tint', this.tint, 3],
      ['size', this.size, 1],
      ['alpha', this.alpha, 1],
    ] as [string, Float32Array, number][]) {
      const a = new THREE.BufferAttribute(arr, items);
      a.setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(name, a);
    }
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 } },
      vertexShader: P_VERT,
      fragmentShader: glow ? P_FRAG_GLOW : P_FRAG_PUFF,
      transparent: true,
      depthWrite: false,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = glow ? 6 : 5;
  }

  /** Bildhöhe in Pixeln und Öffnungswinkel – damit Größen in Metern stimmen. */
  setViewport(heightPx: number, fovDeg: number): void {
    this.mat.uniforms.scale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    color: THREE.Color,
    grow = 0,
    gravity = 0,
    drag = 0,
    alpha = 1,
  ): void {
    const i = this.next;
    this.next = (i + 1) % this.n;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.tint[i * 3] = color.r;
    this.tint[i * 3 + 1] = color.g;
    this.tint[i * 3 + 2] = color.b;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.grow[i] = grow;
    this.grav[i] = gravity;
    this.drag[i] = drag;
    this.baseAlpha[i] = alpha;
    this.alpha[i] = alpha;
  }

  update(dt: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      const k = Math.exp(-this.drag[i] * dt);
      const o = i * 3;
      this.vel[o] *= k;
      this.vel[o + 1] = this.vel[o + 1] * k - this.grav[i] * dt;
      this.vel[o + 2] *= k;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      // Erst im letzten Drittel ausblenden – vorher bleibt die Form klar.
      this.alpha[i] = this.baseAlpha[i] * Math.min(1, (this.life[i] / this.maxLife[i]) * 3);
    }
    for (const name of ['position', 'tint', 'size', 'alpha']) this.geo.getAttribute(name).needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    this.alpha.fill(0);
    this.size.fill(0);
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

// --- Bremsspuren ---------------------------------------------------------------

export class SkidMarks {
  readonly mesh: THREE.Mesh;
  private readonly pos: Float32Array;
  private readonly quads: number;
  private next = 0;
  private readonly geo = new THREE.BufferGeometry();

  constructor(quads: number) {
    this.quads = quads;
    this.pos = new Float32Array(quads * 18);
    const a = new THREE.BufferAttribute(this.pos, 3);
    a.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', a);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x16131c,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -8,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** Ein Stück Spur von (ax,ay,az) nach (bx,by,bz), quer dazu w breit. */
  add(ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number): void {
    const dx = bx - ax;
    const dz = bz - az;
    const l = Math.hypot(dx, dz);
    if (l < 0.02 || l > 3) return;
    const nx = (-dz / l) * w * 0.5;
    const nz = (dx / l) * w * 0.5;
    const o = this.next * 18;
    this.next = (this.next + 1) % this.quads;
    const p = this.pos;
    const y0 = ay + 0.04;
    const y1 = by + 0.04;
    // zwei Dreiecke, Oberseite nach oben
    p[o] = ax - nx;
    p[o + 1] = y0;
    p[o + 2] = az - nz;
    p[o + 3] = bx + nx;
    p[o + 4] = y1;
    p[o + 5] = bz + nz;
    p[o + 6] = ax + nx;
    p[o + 7] = y0;
    p[o + 8] = az + nz;
    p[o + 9] = ax - nx;
    p[o + 10] = y0;
    p[o + 11] = az - nz;
    p[o + 12] = bx - nx;
    p[o + 13] = y1;
    p[o + 14] = bz - nz;
    p[o + 15] = bx + nx;
    p[o + 16] = y1;
    p[o + 17] = bz + nz;
    this.geo.getAttribute('position').needsUpdate = true;
  }

  clear(): void {
    this.pos.fill(0);
    this.geo.getAttribute('position').needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

// --- Comic-Wörter ----------------------------------------------------------------

const POP_STYLES: Record<string, [string, string]> = {
  warm: ['#ffd23f', '#16131c'],
  hot: ['#ff5a4e', '#ffffff'],
  cool: ['#1fc8b6', '#16131c'],
  white: ['#ffffff', '#16131c'],
  violet: ['#9b87ff', '#ffffff'],
};

function popTexture(word: string, style: string): THREE.CanvasTexture {
  const [fill, text] = POP_STYLES[style] ?? POP_STYLES.warm;
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 192;
  const g = c.getContext('2d')!;
  // Gezackte Sprechblase
  const cx = 192;
  const cy = 96;
  const spikes = 13;
  g.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + 0.2;
    const wob = 0.88 + 0.12 * Math.sin(i * 2.7);
    const rx = (i % 2 === 0 ? 182 : 138) * wob;
    const ry = (i % 2 === 0 ? 90 : 64) * wob;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineJoin = 'round';
  g.lineWidth = 9;
  g.strokeStyle = '#16131c';
  g.stroke();
  // Rasterpunkte in der unteren Hälfte
  g.save();
  g.clip();
  g.fillStyle = 'rgba(22,19,28,0.16)';
  for (let y = 100; y < 192; y += 11) {
    for (let x = (y / 11) % 2 === 0 ? 0 : 5.5; x < 384; x += 11) {
      g.beginPath();
      g.arc(x, y, 1 + ((y - 100) / 92) * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 84;
  const font = (s: number): string => `italic 900 ${s}px "Arial Black", "Arial Narrow", Impact, Arial, sans-serif`;
  g.font = font(size);
  const w = g.measureText(word).width;
  if (w > 250) {
    size = Math.floor((size * 250) / w);
    g.font = font(size);
  }
  g.lineWidth = 12;
  g.strokeStyle = text === '#ffffff' ? '#16131c' : '#ffffff';
  g.strokeText(word, cx, cy + 4);
  g.fillStyle = text;
  g.fillText(word, cx, cy + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Pop {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  size: number;
  tilt: number;
}

export class ComicPops {
  readonly group = new THREE.Group();
  private readonly pops: Pop[] = [];
  private readonly textures = new Map<string, THREE.CanvasTexture>();
  private next = 0;

  constructor(count = 8) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 20;
      this.group.add(sprite);
      this.pops.push({ sprite, age: 0, life: 0, size: 1, tilt: 0 });
    }
  }

  show(word: string, x: number, y: number, z: number, style = 'warm', size = 3.4): void {
    const key = `${style}:${word}`;
    let tex = this.textures.get(key);
    if (!tex) {
      tex = popTexture(word, style);
      this.textures.set(key, tex);
    }
    const p = this.pops[this.next];
    this.next = (this.next + 1) % this.pops.length;
    const mat = p.sprite.material;
    mat.map = tex;
    mat.needsUpdate = true;
    p.sprite.position.set(x, y, z);
    p.sprite.visible = true;
    p.age = 0;
    p.life = 0.85;
    p.size = size;
    p.tilt = (Math.random() - 0.5) * 0.5;
  }

  update(dt: number): void {
    for (const p of this.pops) {
      if (!p.sprite.visible) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.sprite.visible = false;
        continue;
      }
      // Aufploppen mit Überschwinger, dann halten, am Ende schrumpfen.
      const k = p.age / 0.16;
      const out = Math.max(0, (p.age - p.life + 0.18) / 0.18);
      const s = (k < 1 ? k * (1.9 - 0.9 * k) + Math.sin(k * Math.PI) * 0.25 : 1) * (1 - out * out) * p.size;
      p.sprite.scale.set(s, s * 0.5, 1);
      p.sprite.position.y += dt * 0.9;
      p.sprite.material.rotation = p.tilt * (1 + Math.sin(p.age * 30) * 0.06);
      p.sprite.material.opacity = 1 - out;
    }
  }

  clear(): void {
    for (const p of this.pops) p.sprite.visible = false;
  }

  dispose(): void {
    for (const t of this.textures.values()) t.dispose();
    for (const p of this.pops) p.sprite.material.dispose();
  }
}

// --- Tempostriche ----------------------------------------------------------------

const SPEED_FRAG = /* glsl */ `
uniform float time;
uniform float strength;
uniform float aspect;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p.x *= aspect;
  float a = atan(p.y, p.x);
  float r = length(p);
  float cell = floor(a * 28.0);
  float n = fract(sin(cell * 91.7 + floor(time * 13.0) * 17.3) * 43758.5453);
  float inCell = abs(fract(a * 28.0) - 0.5) * 2.0;
  float start = 0.62 + n * 0.5;
  float streak = step(0.72, n) * smoothstep(start, start + 0.5, r) * (1.0 - smoothstep(0.2, 0.7, inCell));
  gl_FragColor = vec4(vec3(1.0), streak * strength * 0.5);
}`;

/** Weiße Striche vom Bildrand zur Mitte, solange Schub wirkt. */
export class SpeedLines {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private level = 0;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, strength: { value: 0 }, aspect: { value: 1.6 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: SPEED_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 30;
    this.mesh.visible = false;
  }

  update(dt: number, time: number, target: number, aspect: number): void {
    this.level += (target - this.level) * Math.min(1, dt * (target > this.level ? 14 : 4));
    this.mesh.visible = this.level > 0.02;
    this.mat.uniforms.time.value = time;
    this.mat.uniforms.strength.value = this.level;
    this.mat.uniforms.aspect.value = aspect;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

// --- Schatten ------------------------------------------------------------------

/** Gerasterter Fleck unter jedem Kart – zeigt bei Sprüngen, wo der Boden ist. */
export class BlobShadows {
  readonly mesh: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private count = 0;

  constructor(capacity: number) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 20, 64, 64, 62);
    grad.addColorStop(0, 'rgba(22,19,28,0.62)');
    grad.addColorStop(0.7, 'rgba(22,19,28,0.5)');
    grad.addColorStop(1, 'rgba(22,19,28,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    // Rasterpunkte am Rand: der Schatten läuft wie im Comic in Punkten aus.
    g.globalCompositeOperation = 'destination-out';
    for (let y = 0; y < 128; y += 8) {
      for (let x = (y / 8) % 2 === 0 ? 0 : 4; x < 128; x += 8) {
        const d = Math.hypot(x - 64, y - 64) / 64;
        if (d < 0.55) continue;
        g.beginPath();
        g.arc(x, y, Math.min(4.2, (d - 0.5) * 9), 0, Math.PI * 2);
        g.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -10,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.count = 0;
  }

  begin(): void {
    this.count = 0;
  }

  /** Schatten am Boden; q richtet ihn am Hang aus, height = Abstand des Körpers zum Boden. */
  add(x: number, groundY: number, z: number, q: THREE.Quaternion, size: number, height: number): void {
    if (this.count >= this.mesh.instanceMatrix.count) return;
    const k = Math.max(0.35, 1 - height * 0.09);
    this.m.compose(this.p.set(x, groundY + 0.05, z), q, this.s.set(size * k, 1, size * k * 1.25));
    this.mesh.setMatrixAt(this.count++, this.m);
  }

  end(): void {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.map?.dispose();
    mat.dispose();
    this.mesh.dispose();
  }
}

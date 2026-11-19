// Alles, was außer den Karts auf der Strecke unterwegs ist: Rollreifen,
// Ölflecken, Brummkreisel, Rauchwolken, Bohrer – und die pendelnden Hindernisse der
// jeweiligen Welt (Fass, Krabbe, Glutbrocken, Kehrroboter).
//
// Die Dinge sollen auch im Augenwinkel lesbar sein: der Kreisel trägt Spiralen
// und Wirbelstriche, der Reifen Profil und Felgenstern, dazu Spuren aus Staub
// und Funken. Teilchen werden je Ding über Zeitkonten getaktet, nicht pro Bild.

import * as THREE from 'three';
import { DRILL_DIG_TICKS, DRILL_RISE_TICKS } from '../game/sim';
import { EDGE_BAND, EDGE_DRUM, EDGE_GAP, EDGE_GLIDE, EDGE_RAIL, EDGE_RIVER, EDGE_TWIST, hazardLat, rightX, rightZ, type ThemeId, type Track } from '../game/track';
import { THING_DRILL, THING_OIL, THING_SMOKE, THING_TIRE, THING_TOP, type SnapshotThing } from '../net/protocol';
import { MeshBuilder, mixRgb, type RGB } from './build';
import type { FxSink } from './fxApi';
import { DRILL_GROW, DRILL_LEN, DRILL_SINK, getDrillGeo } from './kartModel';
import { THEMES } from './themes';
import { addSmoothNormals, INK, outlineMaterial, rgb, toonMaterial } from './toon';

interface Visual {
  kind: number;
  /** Halter: Lage und Fahrtrichtung. */
  obj: THREE.Object3D;
  /** Zwischenstufe: Neigen, Hüpfen, Stauchen. */
  mid: THREE.Object3D;
  /** Der Körper selbst (dreht bzw. rollt). */
  body: THREE.Object3D;
  /** Wirbelstriche des Kreisels. */
  swirl: THREE.Mesh | null;
  /** Einzelne Bällchen der Rauchwolke. */
  balls: THREE.Object3D[] | null;
  seen: boolean;
  age: number;
  spin: number;
  /** Zurückgelegter Weg (Reifen: Hüpfen im Takt des Rollens). */
  dist: number;
  heading: number;
  /** Zeitkonten für Teilchen. */
  acc: number;
  acc2: number;
  /** Rauch: Bitmaske der Bällchen, die schon zerfallen sind. */
  gone: number;
  /** Letzte Lage am Boden – für den Abschiedseffekt. */
  lx: number;
  ly: number;
  lz: number;
  /** Bohrer: Stufe im letzten Bild, Bruchteil eines Ticks seit dem letzten Stand (für weiche Bewegung), Weg seit dem letzten Erdbrocken bzw. Riss. */
  stage: number;
  sub: number;
  lastAge: number;
  lump: number;
  crack: number;
  /** Bohrer: Einmal-Ereignisse – Abtauchen, Ring beim Durchbruch; Abschnitt im letzten Bild. */
  done: number;
  seg: number;
}

/** Bällchen der Rauchwolke: x, y, z, Radius (von unten nach oben). */
const SMOKE_BALLS: readonly (readonly [number, number, number, number])[] = [
  [0, 2.2, 0, 3.4],
  [3.2, 1.8, 0.6, 2.7],
  [-3.0, 1.7, -0.5, 2.8],
  [0.8, 1.6, 3.1, 2.6],
  [-0.9, 1.7, -3.0, 2.6],
  [2.2, 4.0, -1.6, 2.3],
  [-2.0, 4.2, 1.4, 2.4],
  [0.2, 5.3, 0.2, 2.0],
];
/** So lange vor dem Ablaufen beginnt die Wolke zu zerfallen (Sekunden). */
const SMOKE_DISSOLVE = 2.0;
/** Sichtbare Drehzahl von Reifen und Kreisel (rad/s) – schneller wird es zum Flimmern. */
const TIRE_SPIN_MAX = 16;
const TOP_SPIN = 15;
const SPARK_HOT = [0xffe04a, 0xfff3b0, 0xff8a2a] as const;
/**
 * Das Spiel erzeugt ein Ding im Moment des Tastendrucks, die Figur holt aber
 * erst aus. So lange bleibt das Ding unsichtbar – es erscheint, wenn der
 * Gegenstand die Hand verlässt (Wurf nach vorn bzw. über die Schulter).
 */
const THROW_DELAY = 0.2;
const DROP_DELAY = 0.24;
/** Bohrer: Drehzahl des Bohrkopfs (rad/s) beim Eindrehen (von … bis) und beim Durchbruch. */
const DRILL_SPIN_DIG = [3, 46] as const;
const DRILL_SPIN_RISE = 44;
/** Bohrer: Farben der Erde (aufgeworfen, dunkel, Staub) und der Funken am Bohrkopf. */
const EARTH = [0x9a6438, 0xb47a44, 0x7c4e2c, 0xa66e3e] as const;
const EARTH_DARK = 0x4a2e1c;
const EARTH_DUST = 0xc4a37c;
/** Bohrer: so lange liegt der Erdwall bzw. ein Riss, bis er wieder verschwunden ist (Sekunden); die Zeit, in der er vergeht. */
const LUMP_LIFE = 2.3;
const LUMP_FADE = 0.7;
const CRACK_LIFE = 3.2;
const CRACK_FADE = 0.7;
/** Wo die Strecke kein Erdreich hat (Lücke, Flug, Wasser, Schiene, Trommel, Schwebeband), zieht der Bohrer keine Spur. */
const NO_EARTH = EDGE_GAP | EDGE_GLIDE | EDGE_RIVER | EDGE_RAIL | EDGE_DRUM | EDGE_TWIST | EDGE_BAND;

/**
 * Spuren des Bohrers – drei Vorräte fester Größe, je ein Zeichenaufruf (die Erdbrocken dazu ihre Kontur):
 * aufgeworfene Erdbrocken (der Erdwall, der über die Fahrbahn wandert, und der Krater), Sternrisse mit Loch (wo er
 * einsteigt und durchbricht) und lange Risse längs des Walls. Jeder Eintrag wächst kurz auf, bleibt liegen und vergeht
 * am Ende wieder (Maßstab gegen 0).
 */
class DrillMarks {
  readonly lumps: THREE.InstancedMesh;
  readonly lumpLines: THREE.InstancedMesh | null;
  readonly cracks: THREE.InstancedMesh;
  readonly fissures: THREE.InstancedMesh;
  private readonly lumpAt: Float32Array;
  private readonly crackAt: Float32Array;
  private readonly fissureAt: Float32Array;
  /** Je Eintrag: x, y, z, Quaternion (4), Maßstab x, y, z, Geburt, Lebensdauer, Überschwinger. */
  private static readonly W = 13;
  private nextLump = 0;
  private nextCrack = 0;
  private nextFissure = 0;
  private liveLumps = 0;
  private liveCracks = 0;
  private liveFissures = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private readonly tex: THREE.CanvasTexture;
  private readonly fissureTex: THREE.CanvasTexture;
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];

  constructor(
    private readonly track: Track,
    outlines: boolean,
    earthTint: number,
    lumpCount = 420,
    crackCount = 48,
    fissureCount = 200,
  ) {
    const lumpGeo = addSmoothNormals(new THREE.IcosahedronGeometry(1, 0));
    lumpGeo.translate(0, 0.15, 0);
    const lumpMat = toonMaterial({ color: 0xffffff });
    this.lumps = new THREE.InstancedMesh(lumpGeo, lumpMat, lumpCount);
    this.lumps.name = 'Bohrer-Erdwall';
    this.lumps.frustumCulled = false;
    this.lumps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const tint = new THREE.Color(earthTint);
    for (let i = 0; i < lumpCount; i++) {
      this.color.setHex(EARTH[i % EARTH.length]).lerp(tint, 0.22);
      this.lumps.setColorAt(i, this.color);
    }
    this.lumpLines = null;
    if (outlines) {
      const line = outlineMaterial(0.05);
      this.lumpLines = new THREE.InstancedMesh(lumpGeo, line, lumpCount);
      this.lumpLines.name = 'outline';
      this.lumpLines.frustumCulled = false;
      // Dieselben Lagen wie die Brocken selbst.
      this.lumpLines.instanceMatrix = this.lumps.instanceMatrix;
    }
    this.tex = crackTexture(true);
    this.fissureTex = crackTexture(false);
    const crackGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // (Durchscheinend wie die Bremsspuren, nicht mit Alpha-Schwelle: flach von der Seite gesehen mitteln die feinen Linien
    // in den kleinen Stufen der Textur unter jede Schwelle und verschwänden.)
    const decal = (map: THREE.Texture, count: number, name: string): THREE.InstancedMesh => {
      const mat = new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -10,
      });
      this.mats.push(mat);
      const m = new THREE.InstancedMesh(crackGeo, mat, count);
      m.name = name;
      m.frustumCulled = false;
      m.renderOrder = 1;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      return m;
    };
    this.cracks = decal(this.tex, crackCount, 'Bohrer-Krater');
    this.fissures = decal(this.fissureTex, fissureCount, 'Bohrer-Risse');
    this.geos.push(lumpGeo, crackGeo);
    this.mats.push(lumpMat);
    this.lumpAt = new Float32Array(lumpCount * DrillMarks.W);
    this.crackAt = new Float32Array(crackCount * DrillMarks.W);
    this.fissureAt = new Float32Array(fissureCount * DrillMarks.W);
    this.clear();
  }

  /** Neigung der Fahrbahn an Abschnitt seg (Quer- und Längsneigung) als Drehung von „oben“ dorthin, dazu die Gierung yaw. */
  private orient(seg: number, yaw: number): THREE.Quaternion {
    const t = this.track;
    const s = seg >= 0 && seg < t.total ? seg : 0;
    const slope = (t.py[t.next[s]] - t.py[s]) / t.step;
    const rx = rightX(t, s);
    const rz = rightZ(t, s);
    const bank = t.bank[s];
    // oben = rechts × vorn (rechts mit Querneigung, vorn mit Steigung)
    const fx = t.tx[s];
    const fy = slope;
    const fz = t.tz[s];
    const ux = bank * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - bank * fx;
    this.p.set(ux, uy, uz).normalize();
    if (this.p.y < 0) this.p.negate();
    this.q.setFromUnitVectors(UP, this.p);
    _yq.setFromAxisAngle(UP, yaw);
    return this.q.multiply(_yq);
  }

  /** Ein Erdbrocken: Lage, Gierung, Maße (Breite, Höhe, Länge in Metern), Lebensdauer, Überschwinger beim Aufwerfen. */
  lump(x: number, y: number, z: number, seg: number, yaw: number, w: number, h: number, l: number, now: number, life = LUMP_LIFE, pop = 0.35): void {
    const i = this.nextLump;
    this.nextLump = (i + 1) % (this.lumpAt.length / DrillMarks.W);
    this.put(this.lumpAt, i, x, y, z, this.orient(seg, yaw), w * 0.5, h, l * 0.5, now, life, pop);
    this.liveLumps = Math.max(this.liveLumps, 1);
  }

  /**
   * Ein Riss in der Fahrbahn (flach, knapp darüber): Sternriss mit Loch (star) oder ein langer Riss quer zu yaw … längs.
   * (Knapp über Fahrbahnfarbe und Schubfeldern, die ebenfalls etwas über der Fahrbahn liegen.)
   */
  crack(x: number, y: number, z: number, seg: number, yaw: number, w: number, l: number, now: number, life = CRACK_LIFE, star = true): void {
    if (star) {
      const i = this.nextCrack;
      this.nextCrack = (i + 1) % (this.crackAt.length / DrillMarks.W);
      this.put(this.crackAt, i, x, y + 0.08, z, this.orient(seg, yaw), w, 1, l, now, life, 0.15);
      this.liveCracks = Math.max(this.liveCracks, 1);
    } else {
      const i = this.nextFissure;
      this.nextFissure = (i + 1) % (this.fissureAt.length / DrillMarks.W);
      this.put(this.fissureAt, i, x, y + 0.08, z, this.orient(seg, yaw), w, 1, l, now, life, 0.15);
      this.liveFissures = Math.max(this.liveFissures, 1);
    }
  }

  private put(a: Float32Array, i: number, x: number, y: number, z: number, q: THREE.Quaternion, sx: number, sy: number, sz: number, now: number, life: number, pop: number): void {
    const o = i * DrillMarks.W;
    a[o] = x;
    a[o + 1] = y;
    a[o + 2] = z;
    a[o + 3] = q.x;
    a[o + 4] = q.y;
    a[o + 5] = q.z;
    a[o + 6] = q.w;
    a[o + 7] = sx;
    a[o + 8] = sy;
    a[o + 9] = sz;
    a[o + 10] = now;
    a[o + 11] = life;
    a[o + 12] = pop;
  }

  /** Alle Einträge auf den Stand von now bringen (aufwerfen, liegen, vergehen). */
  update(now: number): void {
    this.liveLumps = this.step(this.lumps, this.lumpAt, now, this.liveLumps, LUMP_FADE, true);
    this.liveCracks = this.step(this.cracks, this.crackAt, now, this.liveCracks, CRACK_FADE, false);
    this.liveFissures = this.step(this.fissures, this.fissureAt, now, this.liveFissures, CRACK_FADE, false);
    if (this.lumpLines) this.lumpLines.visible = this.lumps.visible;
  }

  private step(mesh: THREE.InstancedMesh, a: Float32Array, now: number, live: number, fade: number, grow: boolean): number {
    if (live === 0) {
      mesh.visible = false;
      return 0;
    }
    const n = a.length / DrillMarks.W;
    let alive = 0;
    for (let i = 0; i < n; i++) {
      const o = i * DrillMarks.W;
      const life = a[o + 11];
      let k = 0;
      if (life > 0) {
        const age = now - a[o + 10];
        if (age >= life) a[o + 11] = 0;
        else {
          alive++;
          // Aufwerfen mit Überschwinger, am Ende zusammensacken (Brocken) bzw. zuwachsen (Risse).
          const inT = grow ? 0.09 : 0.12;
          const u = Math.min(1, Math.max(0, age) / inT);
          const pop = a[o + 12];
          k = u < 1 ? u * (1 + pop * Math.sin(u * Math.PI)) : 1 + pop * 0.6 * Math.max(0, 1 - (age - inT) / 0.25) * Math.sin(((age - inT) / 0.25) * Math.PI);
          const left = life - age;
          if (left < fade) k *= left / fade;
        }
      }
      this.p.set(a[o], a[o + 1], a[o + 2]);
      this.q.set(a[o + 3], a[o + 4], a[o + 5], a[o + 6]);
      // Brocken sinken beim Vergehen in den Boden zurück: die Höhe schrumpft schneller als die Breite.
      this.sc.set(a[o + 7] * Math.sqrt(k), a[o + 8] * k, a[o + 9] * Math.sqrt(k));
      if (k <= 0) this.sc.setScalar(0);
      this.m.compose(this.p, this.q, this.sc);
      mesh.setMatrixAt(i, this.m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = alive > 0;
    return alive;
  }

  clear(): void {
    this.lumpAt.fill(0);
    this.crackAt.fill(0);
    this.fissureAt.fill(0);
    this.liveLumps = 1;
    this.liveCracks = 1;
    this.liveFissures = 1;
    this.update(0);
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.tex.dispose();
    this.fissureTex.dispose();
    this.lumps.dispose();
    this.cracks.dispose();
    this.fissures.dispose();
    this.lumpLines?.dispose();
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const _yq = new THREE.Quaternion();

/**
 * Riss-Bild, außen durchsichtig. star: dunkles Loch in der Mitte, davon zackige Tuschesprünge mit Verästelungen; sonst
 * ein langer Zickzack-Riss von oben nach unten (längs) mit kurzen Ästen. Unter jeder Tuschelinie liegt ein heller Rand
 * (aufgebrochene Kante) – so sind die Risse auf dunklem Asphalt wie auf hellem Grund zu sehen.
 */
function crackTexture(star: boolean): THREE.CanvasTexture {
  const n = 256;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const g = c.getContext('2d')!;
  const ink = `#${INK.toString(16).padStart(6, '0')}`;
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Erst alle Stücke sammeln, dann in zwei Durchgängen zeichnen: heller Rand, darüber die Tusche.
  const lines: number[] = [];
  const crackLine = (x: number, y: number, a: number, len: number, w: number, depth: number): void => {
    let px = x;
    let py = y;
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const ang = a + (rnd() - 0.5) * 0.9;
      const d = len / steps;
      const nx = px + Math.cos(ang) * d;
      const ny = py + Math.sin(ang) * d;
      lines.push(px, py, nx, ny, Math.max(2, w * (1 - i / steps)));
      if (depth > 0 && rnd() < 0.35) crackLine(nx, ny, ang + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.5), len * 0.4, w * 0.6, depth - 1);
      px = nx;
      py = ny;
    }
  };
  const cx = n / 2;
  if (star) {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + rnd() * 0.4;
      crackLine(cx + Math.cos(a) * 18, cx + Math.sin(a) * 18, a, 70 + rnd() * 34, 13, 2);
    }
  } else {
    // Längs (Bildhöhe = Länge des Risses), von der Mitte nach beiden Seiten
    crackLine(cx, cx, Math.PI / 2, 116, 18, 3);
    crackLine(cx, cx, -Math.PI / 2, 116, 18, 3);
  }
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [color, extra] of [
    ['#e6dccb', 11],
    [ink, 0],
  ] as const) {
    g.strokeStyle = color;
    for (let i = 0; i < lines.length; i += 5) {
      g.lineWidth = lines[i + 4] + extra;
      g.beginPath();
      g.moveTo(lines[i], lines[i + 1]);
      g.lineTo(lines[i + 2], lines[i + 3]);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  // Flach von der Seite gesehen (Verfolgerkamera) verschwämmen die Linien sonst in den kleinen Stufen der Textur
  // (three.js begrenzt den Wert auf das, was das Gerät kann).
  tex.anisotropy = 8;
  if (!star) return tex;
  // Loch: dunkle Erde mit hellem Rand und Tuschekante
  g.beginPath();
  for (let k = 0; k <= 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const r = 26 + rnd() * 9;
    if (k === 0) g.moveTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
    else g.lineTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = '#3d281a';
  g.fill();
  g.strokeStyle = '#e6dccb';
  g.lineWidth = 12;
  g.stroke();
  g.strokeStyle = ink;
  g.lineWidth = 6;
  g.stroke();
  return tex;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Herausschnellen mit Überschwinger: 0 → 1 (über 1 hinaus und zurück). */
function easeOutBack(x: number): number {
  const c = 1.9;
  const u = x - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

/** Aufploppen mit kleinem Überschwinger: 0 → 1. */
function popCurve(t: number): number {
  const p = clamp01(t);
  return p * (1 + 0.3 * Math.sin(p * Math.PI));
}

function wrapAngle(a: number): number {
  return a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
}

export class ThingVisuals {
  readonly group = new THREE.Group();
  /** Hindernisse mit ihrer aktuellen Lage – für Schatten. */
  readonly hazards: THREE.Object3D[] = [];
  private readonly live = new Map<number, Visual>();
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly toon = toonMaterial({ vertexColors: true });
  private readonly oilMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -8,
  });
  /** Wirbelstriche: helle Bänder ohne Licht und Kontur. */
  private readonly swirlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  /** … und angriffslustig, wenn der Kreisel ein Ziel hat. */
  private readonly swirlHot = new THREE.MeshBasicMaterial({ color: 0xffe866, side: THREE.DoubleSide });
  private readonly tireGeo: THREE.BufferGeometry;
  private readonly oilGeo: THREE.BufferGeometry;
  private readonly topGeo: THREE.BufferGeometry;
  private readonly swirlGeo: THREE.BufferGeometry;
  private readonly smokeGeoA: THREE.BufferGeometry;
  private readonly smokeGeoB: THREE.BufferGeometry;
  private readonly hazardGeo: THREE.BufferGeometry;
  private readonly theme: ThemeId;
  /** Staubfarbe der Spuren (aufgehellter Randstreifen der Welt). */
  private readonly dust: number;
  /** Erst nach dem ersten Abgleich lösen neue Dinge Auftritts-Effekte aus. */
  private primed = false;
  /** Bohrer: Erdwall und Risse; Farbe der Erde dieser Welt; Uhr der Spuren (Sekunden, wie time in update). */
  private readonly marks: DrillMarks;
  private readonly earth: number;
  private now = 0;

  constructor(
    private readonly track: Track,
    private readonly outlines: boolean,
  ) {
    this.theme = track.def.theme;
    const d = mixRgb(rgb(0xe9e6f2), rgb(THEMES[this.theme].shoulder), 0.35);
    this.dust = new THREE.Color(d[0], d[1], d[2]).getHex();
    this.earth = new THREE.Color(THEMES[this.theme].shoulder).getHex();
    this.marks = new DrillMarks(track, outlines, this.earth);
    this.group.add(this.marks.lumps, this.marks.cracks, this.marks.fissures);
    if (this.marks.lumpLines) this.group.add(this.marks.lumpLines);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const put = (b: MeshBuilder, geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0): void => {
      q.setFromEuler(new THREE.Euler(rx, ry, rz));
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
      b.add(geo, rgb(color), m);
      geo.dispose();
    };

    // Rollreifen: Achse quer (x), rollt nach +z. Helle Profilklötze und ein
    // dreiarmiger Felgenstern machen das Rollen sichtbar.
    let b = new MeshBuilder();
    put(b, new THREE.TorusGeometry(0.56, 0.27, 7, 16), 0x2a2733, 0, 0, 0, 1, 1, 1, 0, Math.PI / 2, 0);
    put(b, new THREE.CylinderGeometry(0.34, 0.34, 0.42, 10), 0xffd23f, 0, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      put(b, new THREE.BoxGeometry(0.4, 0.22, 0.08), 0x77718e, 0, Math.sin(a) * 0.8, Math.cos(a) * 0.8, 1, 1, 1, -a, 0, 0);
    }
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        put(b, new THREE.BoxGeometry(0.06, 0.1, 0.52), k === 0 ? 0xff5a4e : 0xfff6d8, s * 0.215, Math.sin(a) * 0.17, Math.cos(a) * 0.17, 1, 1, 1, -a, 0, 0);
      }
      put(b, new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8), 0xff5a4e, s * 0.23, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2);
    }
    this.tireGeo = this.keep(addSmoothNormals(b.build()));

    // Ölfleck: unregelmäßiger dunkler Fleck mit Glanzlichtern
    b = new MeshBuilder();
    const blob = (cx: number, cz: number, r: number, color: number, y: number, seed: number): void => {
      const n = 11;
      const c = rgb(color);
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        const r0 = r * (0.8 + 0.25 * Math.sin(i * 2.3 + seed));
        const r1 = r * (0.8 + 0.25 * Math.sin((i + 1) * 2.3 + seed));
        b.tri([cx, y, cz], [cx + Math.sin(a0) * r0, y, cz + Math.cos(a0) * r0], [cx + Math.sin(a1) * r1, y, cz + Math.cos(a1) * r1], c);
      }
    };
    blob(0, 0, 1.75, 0x16131c, 0.05, 0);
    blob(0, 0, 1.45, 0x2c2440, 0.06, 1);
    blob(-0.45, 0.35, 0.34, 0x8f7fc0, 0.07, 2);
    blob(0.5, -0.4, 0.2, 0xcfc6ee, 0.07, 3);
    this.oilGeo = this.keep(b.build());

    // Brummkreisel: gedrechselt, aber mit Spiralstreifen und Windrad-Deckel,
    // damit man die Drehung lesen kann.
    b = new MeshBuilder();
    const SEG = 24;
    // Drechselprofil; "twist" verdreht jede Höhenstufe, sodass die Spalten des
    // Netzes selbst zu Spiralbändern werden – Farbe je Spalte, glatte Kanten.
    const lathe = (pts: [number, number][], sub: number, color: (i: number) => RGB, twist: (y: number, r: number) => number = () => 0): void => {
      for (let p = 0; p < pts.length - 1; p++) {
        const [ra, ya] = pts[p];
        const [rb, yb] = pts[p + 1];
        for (let s = 0; s < sub; s++) {
          const r0 = ra + ((rb - ra) * s) / sub;
          const y0 = ya + ((yb - ya) * s) / sub;
          const r1 = ra + ((rb - ra) * (s + 1)) / sub;
          const y1 = ya + ((yb - ya) * (s + 1)) / sub;
          const w0 = twist(y0, r0);
          const w1 = twist(y1, r1);
          for (let i = 0; i < SEG; i++) {
            const a0 = (i / SEG) * Math.PI * 2;
            const a1 = ((i + 1) / SEG) * Math.PI * 2;
            const c = color(i);
            b.quad(
              [Math.sin(a0 + w0) * r0, y0, Math.cos(a0 + w0) * r0],
              [Math.sin(a1 + w0) * r0, y0, Math.cos(a1 + w0) * r0],
              [Math.sin(a1 + w1) * r1, y1, Math.cos(a1 + w1) * r1],
              [Math.sin(a0 + w1) * r1, y1, Math.cos(a0 + w1) * r1],
              c,
            );
          }
        }
      }
    };
    const RED = rgb(0xff5a4e);
    const YELLOW = rgb(0xffd23f);
    const TEAL = rgb(0x1fc8b6);
    const PALE = rgb(0xeafcf9);
    /** Abwechselnde Bänder aus je w Spalten. */
    const band = (i: number, w: number): boolean => Math.floor(i / w) % 2 === 1;
    // Spitze aus Metall
    lathe(
      [
        [0.001, 0],
        [0.13, 0.13],
      ],
      1,
      () => rgb(0x4a4658),
    );
    // Kegel: rot-gelbe Spirale
    lathe(
      [
        [0.13, 0.13],
        [0.5, 0.45],
        [0.78, 0.72],
      ],
      4,
      (i) => (band(i, 4) ? YELLOW : RED),
      (y) => -y * 2.2,
    );
    // Wulst: gelb mit türkisen Blöcken
    lathe(
      [
        [0.78, 0.72],
        [0.8, 0.86],
      ],
      1,
      (i) => (band(i, 2) ? TEAL : YELLOW),
      () => -0.72 * 2.2,
    );
    // Deckel: türkis-helles Windrad
    lathe(
      [
        [0.8, 0.86],
        [0.6, 1.02],
        [0.14, 1.1],
      ],
      3,
      (i) => (band(i, 6) ? PALE : TEAL),
      (_y, r) => r * 2.6,
    );
    // Griff mit rotem Knopf
    lathe(
      [
        [0.14, 1.1],
        [0.11, 1.5],
      ],
      1,
      () => TEAL,
    );
    lathe(
      [
        [0.11, 1.5],
        [0.2, 1.56],
        [0.001, 1.64],
      ],
      1,
      () => RED,
    );
    this.topGeo = this.keep(addSmoothNormals(b.build()));

    // Wirbelstriche: zwei Paar gebogene, spitz auslaufende Bänder um den
    // Kreisel (Kopf voraus in Drehrichtung, leicht ansteigend).
    b = new MeshBuilder();
    const white = rgb(0xffffff);
    const arc = (r: number, y: number, a0: number, len: number, h: number, rise: number): void => {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const aa = a0 + len * t0;
        const ab = a0 + len * t1;
        const h0 = h * Math.pow(t0, 0.7);
        const h1 = h * Math.pow(t1, 0.7);
        const yb0 = y + rise * t0;
        const yb1 = y + rise * t1;
        const ra = r * (1 - 0.12 * (1 - t0));
        const rb = r * (1 - 0.12 * (1 - t1));
        b.quad(
          [Math.sin(aa) * ra, yb0 - h0 / 2, Math.cos(aa) * ra],
          [Math.sin(ab) * rb, yb1 - h1 / 2, Math.cos(ab) * rb],
          [Math.sin(ab) * rb, yb1 + h1 / 2, Math.cos(ab) * rb],
          [Math.sin(aa) * ra, yb0 + h0 / 2, Math.cos(aa) * ra],
          white,
        );
      }
    };
    for (let k = 0; k < 2; k++) {
      arc(1.22, 0.62, k * Math.PI, 2.2, 0.15, 0.2);
      arc(1.02, 1.15, k * Math.PI + Math.PI / 2, 1.7, 0.1, 0.12);
    }
    this.swirlGeo = this.keep(b.build());

    // Rauchwolke: einzelne Bällchen (zwei Grautöne), damit sie nacheinander
    // aufquellen und zerfallen können.
    const ball = (color: number): THREE.BufferGeometry => {
      const bb = new MeshBuilder();
      put(bb, new THREE.IcosahedronGeometry(1, 1), color);
      return this.keep(addSmoothNormals(bb.build()));
    };
    this.smokeGeoA = ball(0xe9e6f2);
    this.smokeGeoB = ball(0xc9c5d8);

    // Hindernis der jeweiligen Welt
    b = new MeshBuilder();
    if (this.theme === 'werkshof') {
      // Ölfass, liegt quer und rollt
      for (let k = 0; k < 5; k++) put(b, new THREE.CylinderGeometry(1, 1, 0.5, 12), k % 2 === 0 ? 0xffd23f : 0x2a2733, 0, 0, -1 + k * 0.5, 1, 1, 1, Math.PI / 2);
      put(b, new THREE.TorusGeometry(1.0, 0.09, 5, 12), 0x2a2733, 0, 0, -1.2);
      put(b, new THREE.TorusGeometry(1.0, 0.09, 5, 12), 0x2a2733, 0, 0, 1.2);
    } else if (this.theme === 'klippe') {
      // Krabbe
      put(b, new THREE.IcosahedronGeometry(1, 1), 0xff5a4e, 0, 0.75, 0, 1.25, 0.6, 0.95);
      for (const s of [-1, 1]) {
        put(b, new THREE.IcosahedronGeometry(0.5, 1), 0xff7a59, s * 1.55, 1.05, -0.5, 1, 0.8, 0.8);
        put(b, new THREE.CylinderGeometry(0.07, 0.07, 0.6, 5), 0xff5a4e, s * 0.4, 1.4, -0.6);
        put(b, new THREE.IcosahedronGeometry(0.2, 1), 0xffffff, s * 0.4, 1.75, -0.62);
        put(b, new THREE.IcosahedronGeometry(0.1, 0), 0x16131c, s * 0.4, 1.77, -0.8);
        for (let k = 0; k < 3; k++) put(b, new THREE.BoxGeometry(0.75, 0.12, 0.14), 0xd9483e, s * 1.35, 0.42, -0.2 + k * 0.4, 1, 1, 1, 0, 0, -s * 0.6);
      }
    } else if (this.theme === 'glut') {
      // Glutbrocken
      put(b, new THREE.IcosahedronGeometry(1.45, 0), 0x2a2030);
      put(b, new THREE.IcosahedronGeometry(1.2, 0), 0xff7a1f, 0, 0, 0, 1.08, 1.08, 1.08, 0.6, 0.4, 0.2);
    } else if (this.theme === 'riff') {
      // Qualle: Schirm mit hellem Saum, Tupfen, Augen und Fangarmen
      put(b, new THREE.IcosahedronGeometry(1.25, 1), 0xff8fc8, 0, 1.55, 0, 1, 0.72, 1);
      put(b, new THREE.TorusGeometry(1.08, 0.2, 5, 12), 0xffd3ec, 0, 1.08, 0, 1, 1, 1, Math.PI / 2);
      put(b, new THREE.IcosahedronGeometry(0.75, 1), 0xffb3dc, 0, 0.95, 0, 1, 0.5, 1);
      for (const [x, y, z] of [
        [0.45, 2.28, 0.2],
        [-0.5, 2.2, -0.15],
        [0.05, 2.36, -0.45],
      ]) put(b, new THREE.IcosahedronGeometry(0.2, 0), 0xfff2a8, x, y, z, 1, 0.6, 1);
      for (const sgn of [-1, 1]) {
        put(b, new THREE.IcosahedronGeometry(0.24, 1), 0xffffff, sgn * 0.45, 1.5, -1.05);
        put(b, new THREE.IcosahedronGeometry(0.12, 0), 0x16131c, sgn * 0.45, 1.5, -1.25);
      }
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + 0.3;
        const len = 0.8 + (k % 3) * 0.22;
        put(b, new THREE.CylinderGeometry(0.1, 0.05, len, 5), k % 2 === 0 ? 0xc46ad6 : 0xff8fc8, Math.cos(a) * 0.7, 0.9 - len / 2, Math.sin(a) * 0.7);
      }
    } else if (this.theme === 'dschungel') {
      // Treibender Baumstamm: liegt längs zur Fahrtrichtung, pendelt quer durch die Furt; Aststümpfe, ein Büschel Blätter.
      put(b, new THREE.CylinderGeometry(0.85, 0.95, 3.4, 9), 0x7a5230, 0, 0.75, 0, 1, 1, 1, Math.PI / 2);
      put(b, new THREE.CylinderGeometry(0.87, 0.87, 0.5, 9), 0x5e3f24, 0, 0.75, -1.2, 1, 1, 1, Math.PI / 2);
      put(b, new THREE.CylinderGeometry(0.89, 0.89, 0.4, 9), 0x5e3f24, 0, 0.75, 0.9, 1, 1, 1, Math.PI / 2);
      // Schnittflächen mit hellen Jahresringen
      put(b, new THREE.CylinderGeometry(0.7, 0.7, 0.06, 9), 0xe2c08a, 0, 0.75, 1.72, 1, 1, 1, Math.PI / 2);
      put(b, new THREE.CylinderGeometry(0.62, 0.62, 0.06, 9), 0xe2c08a, 0, 0.75, -1.72, 1, 1, 1, Math.PI / 2);
      // Aststümpfe und Blätter
      put(b, new THREE.CylinderGeometry(0.16, 0.22, 0.9, 6), 0x6a4628, 0.55, 1.55, 0.4, 1, 1, 1, 0, 0, -0.5);
      put(b, new THREE.CylinderGeometry(0.14, 0.2, 0.7, 6), 0x6a4628, -0.5, 1.45, -0.7, 1, 1, 1, 0, 0, 0.6);
      put(b, new THREE.IcosahedronGeometry(0.42, 0), 0x4fae4a, 0.85, 2.05, 0.4, 1.2, 0.5, 1);
      put(b, new THREE.IcosahedronGeometry(0.34, 0), 0x6fc85a, -0.8, 1.85, -0.7, 1.1, 0.5, 1);
      // Warnband, damit er sich vom Wasser abhebt
      put(b, new THREE.TorusGeometry(0.93, 0.08, 5, 10), 0xffd23f, 0, 0.75, 0.15);
    } else if (this.theme === 'hafen') {
      // Container am Kranhaken: pendelt knapp über dem Boden quer über die Bahn, die Seile laufen hinauf zur Laufkatze.
      b.box(0, 1.15, 0, 2.5, 1.7, 2.2, rgb(0xe8552e), 0, rgb(0xb93f20));
      // Riffelung und Türriegel
      for (let k = -2; k <= 2; k++) b.box(k * 0.5, 1.15, 1.11, 0.12, 1.5, 0.04, rgb(0xb93f20));
      for (let k = -2; k <= 2; k++) b.box(k * 0.5, 1.15, -1.11, 0.12, 1.5, 0.04, rgb(0xb93f20));
      // Warnschraffur unten rundum – das, was man vom Kart aus zuerst sieht
      for (let k = 0; k < 6; k++) b.box(-1.05 + k * 0.42, 0.42, -1.12, 0.21, 0.24, 0.05, rgb(k % 2 === 0 ? 0xffd23f : 0x16131c));
      // Ladegeschirr und vier Seile
      b.box(0, 2.12, 0, 2.7, 0.16, 2.4, rgb(0xffd23f));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * 1.15, 10.6, sz * 1.0, 0.07, 17, 0.07, rgb(0x2a2733));
      b.box(0, 2.35, 0, 0.5, 0.3, 0.5, rgb(0x2a2733));
    } else if (this.theme === 'gipfel') {
      // Seilbahngondel: rote Kabine mit großen Fenstern und weißem Band, Dach, Gehänge hinauf zum Laufwerk am Seil.
      // Sie pendelt knapp über der Straße quer über die Fahrbahn (das Seil selbst steht fest, siehe buildCableway).
      const RED = rgb(0xd8382e);
      const RED_D = rgb(0xa8261f);
      const GLASS = rgb(0x9fd8f0);
      b.box(0, 1.2, 0, 2.3, 1.9, 2.0, RED, 0, RED_D);
      // Fensterband rundum (etwas vor der Wand)
      b.box(0, 1.45, 1.01, 1.9, 0.8, 0.04, GLASS);
      b.box(0, 1.45, -1.01, 1.9, 0.8, 0.04, GLASS);
      b.box(1.16, 1.45, 0, 0.04, 0.8, 1.6, GLASS);
      b.box(-1.16, 1.45, 0, 0.04, 0.8, 1.6, GLASS);
      // weißes Zierband und Boden
      b.box(0, 0.78, 0, 2.34, 0.14, 2.04, rgb(0xfdf9f0));
      b.box(0, 0.25, 0, 2.1, 0.12, 1.8, rgb(0x2a2733));
      // Dach mit Rand
      b.box(0, 2.23, 0, 2.5, 0.16, 2.2, rgb(0x3a3f4a));
      b.box(0, 2.38, 0, 1.6, 0.14, 1.4, rgb(0x3a3f4a));
      // Gehänge: Bügel hinauf zum Laufwerk am Seil (Seil 9,5 m über der Straße)
      b.box(0.9, 2.5, 0, 0.12, 0.3, 0.12, rgb(0x5a5f6a));
      b.box(0.45, 2.7, 0, 1.0, 0.12, 0.12, rgb(0x5a5f6a));
      b.box(0, 6.0, 0, 0.14, 6.6, 0.14, rgb(0x5a5f6a));
      b.box(0, 9.35, 0, 0.9, 0.35, 0.5, rgb(0x2a2733));
      for (const sz of [-0.32, 0.32]) put(b, new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8), 0x9aa0ae, 0, 9.5, sz, 1, 1, 1, Math.PI / 2);
    } else if (this.theme === 'talsperre') {
      // Turbinenläufer (Francis-Laufrad) am Haken des Hallenkrans: Kranz, Deckscheibe und geschwungene Schaufeln aus
      // Bronze, darüber Welle, Seil und die Laufkatze auf der Kranbrücke (11,2 m über der Straße, die Brücke selbst steht
      // fest – mechanics/dam.ts). Er dreht sich, während ihn die Katze quer über die Straße fährt.
      const BRONZE = 0xc99a52;
      const STEEL = 0x8e97a3;
      put(b, new THREE.CylinderGeometry(1.7, 1.8, 0.42, 16), STEEL, 0, 2.55, 0);
      put(b, new THREE.CylinderGeometry(1.45, 1.25, 0.5, 16, 1, true), BRONZE, 0, 0.75, 0);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        put(b, new THREE.BoxGeometry(0.16, 1.7, 0.95), BRONZE, Math.cos(a) * 1.15, 1.65, Math.sin(a) * 1.15, 1, 1, 1, 0.35, -a + 0.6, 0.25);
      }
      put(b, new THREE.ConeGeometry(0.55, 1.4, 10), 0xc8432e, 0, 1.2, 0, 1, 1, 1, Math.PI);
      // Warnring gelb-schwarz an der Deckscheibe
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        put(b, new THREE.BoxGeometry(0.85, 0.2, 0.12), k % 2 === 0 ? 0xffcf3a : 0x1e1c22, Math.cos(a) * 1.78, 2.55, Math.sin(a) * 1.78, 1, 1, 1, 0, -a + Math.PI / 2, 0);
      }
      put(b, new THREE.CylinderGeometry(0.2, 0.2, 2.2, 8), STEEL, 0, 3.8, 0);
      put(b, new THREE.CylinderGeometry(0.5, 0.35, 0.7, 8), 0x2a2733, 0, 5.1, 0);
      put(b, new THREE.CylinderGeometry(0.06, 0.06, 5.6, 5), 0x2a2733, 0, 8.2, 0);
      put(b, new THREE.CylinderGeometry(0.85, 0.85, 0.9, 12), 0xffcf3a, 0, 11.25, 0);
      put(b, new THREE.CylinderGeometry(0.95, 0.95, 0.12, 12), 0x2a2733, 0, 10.75, 0);
    } else if (this.theme === 'kristall') {
      // Lore (Förderwagen) voller Erz und leuchtender Kristalle: rollt auf dem Querschlag quer über die Fahrbahn (Längsachse
      // quer zur Strecke); rostroter Kasten mit dunklen Bändern, vier Räder, vorn und hinten Puffer, oben eine Warnleuchte.
      const RUST = 0x9a4a2a;
      const BAND = 0x2a2830;
      put(b, new THREE.BoxGeometry(2.7, 1.25, 1.55), RUST, 0, 1.15, 0);
      for (const x of [-1.1, 0, 1.1]) put(b, new THREE.BoxGeometry(0.14, 1.3, 1.6), BAND, x, 1.15, 0);
      put(b, new THREE.BoxGeometry(2.8, 0.14, 1.65), BAND, 0, 1.78, 0);
      // Erz und Kristalle obenauf
      put(b, new THREE.DodecahedronGeometry(0.62, 0), 0x3a3238, -0.6, 1.85, 0.1);
      put(b, new THREE.DodecahedronGeometry(0.55, 0), 0x463c42, 0.55, 1.85, -0.15);
      put(b, new THREE.OctahedronGeometry(1, 0), 0xc77dff, -0.2, 2.25, 0.2, 0.28, 0.75, 0.28, 0.3, 0, 0.2);
      put(b, new THREE.OctahedronGeometry(1, 0), 0x3fe8ff, 0.5, 2.15, 0.25, 0.22, 0.6, 0.22, -0.4, 0, -0.3);
      put(b, new THREE.OctahedronGeometry(1, 0), 0xff4fd8, 0.1, 2.1, -0.35, 0.2, 0.5, 0.2, 0.2, 0, -0.5);
      // Fahrgestell, Räder, Puffer
      put(b, new THREE.BoxGeometry(2.4, 0.22, 1.1), BAND, 0, 0.45, 0);
      for (const x of [-0.85, 0.85]) for (const z of [-0.62, 0.62]) put(b, new THREE.CylinderGeometry(0.34, 0.34, 0.16, 10), 0x5a5f6a, x, 0.36, z, 1, 1, 1, Math.PI / 2);
      for (const x of [-1.5, 1.5]) put(b, new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8), 0xffcf3a, x, 0.75, 0, 1, 1, 1, 0, 0, Math.PI / 2);
      put(b, new THREE.SphereGeometry(0.2, 8, 6), 0xffb02e, 1.2, 1.95, 0.6);
    } else {
      // Kehrroboter mit Warnlicht
      b.box(0, 0.75, 0, 2.3, 1.0, 1.9, rgb(0x1fd6c8), 0, rgb(0x16a79c));
      b.box(0, 0.3, 0, 2.6, 0.3, 2.2, rgb(0x12142a));
      put(b, new THREE.CylinderGeometry(0.42, 0.42, 2.5, 8), 0xff3d9a, 0, 0.42, -1.15, 1, 1, 1, 0, 0, Math.PI / 2);
      put(b, new THREE.SphereGeometry(0.36, 8, 6), 0xffd23f, 0, 1.5, 0);
      for (const s of [-1, 1]) put(b, new THREE.IcosahedronGeometry(0.2, 1), 0xffffff, s * 0.55, 0.95, -0.97);
    }
    this.hazardGeo = this.keep(addSmoothNormals(b.build()));

    for (let i = 0; i < track.hazards.length; i++) {
      const obj = this.make(this.hazardGeo, this.toon, 0.06);
      this.hazards.push(obj);
      this.group.add(obj);
    }
    if (this.theme === 'gipfel') this.buildCableway(track);
  }

  /**
   * Gipfelbahn: das feste Seil quer über die Straße an jeder Gondel, mit je einer Gitterstütze links und rechts außerhalb
   * der Bande. Die Gondel pendelt darunter hin und her (updateHazards).
   */
  private buildCableway(track: Track): void {
    const b = new MeshBuilder();
    const STEEL = rgb(0x8a909c);
    const STEEL_D = rgb(0x5a5f6a);
    for (const h of track.hazards) {
      const seg = h.seg;
      const out = Math.max(track.wh[seg] + 3, h.amp + 6);
      const rx = rightX(track, seg);
      const rz = rightZ(track, seg);
      const y0 = track.py[seg];
      const yaw = Math.atan2(rx, rz);
      for (const side of [-1, 1]) {
        const x = track.px[seg] + rx * out * side;
        const z = track.pz[seg] + rz * out * side;
        // Stütze: vier Eckpfosten, Querstreben, oben ein Ausleger mit Seilrolle
        for (const [dx, dz] of [
          [-0.6, -0.6],
          [0.6, -0.6],
          [-0.6, 0.6],
          [0.6, 0.6],
        ])
          b.box(x + dx, y0 + 5, z + dz, 0.18, 10.5, 0.18, STEEL);
        for (let k = 1; k < 5; k++) b.box(x, y0 + k * 2.1, z, 1.4, 0.12, 1.4, STEEL_D, yaw);
        b.box(x, y0 + 10.3, z, 1.8, 0.4, 2.6, STEEL_D, yaw);
      }
      // das Seil: quer über die Straße, leicht durchhängend (drei Stücke)
      const P = (f: number): [number, number, number] => [track.px[seg] + rx * out * f, y0 + 9.6 - (1 - f * f) * 0.5, track.pz[seg] + rz * out * f];
      for (const [f0, f1] of [
        [-1, -0.33],
        [-0.33, 0.33],
        [0.33, 1],
      ]) {
        const a = P(f0);
        const c = P(f1);
        const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
        b.box((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2, 0.08, 0.08, len, rgb(0x2a2733), yaw);
      }
    }
    const mesh = new THREE.Mesh(this.keep(b.build()), this.toon);
    mesh.name = 'Seilbahn';
    this.group.add(mesh);
  }

  private keep(g: THREE.BufferGeometry): THREE.BufferGeometry {
    this.geos.push(g);
    return g;
  }

  private make(geo: THREE.BufferGeometry, mat: THREE.Material, outline: number): THREE.Object3D {
    const holder = new THREE.Group();
    holder.add(this.mesh(geo, mat, outline));
    return holder;
  }

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, outline: number): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mat);
    if (outline > 0 && this.outlines) {
      const ol = new THREE.Mesh(geo, outlineMaterial(outline));
      ol.name = 'outline';
      mesh.add(ol);
    }
    return mesh;
  }

  /** Legt die Darstellung eines neu aufgetauchten Dings an. */
  private create(th: SnapshotThing): Visual {
    const obj = new THREE.Group();
    const mid = new THREE.Group();
    obj.add(mid);
    let body: THREE.Object3D;
    let swirl: THREE.Mesh | null = null;
    let balls: THREE.Object3D[] | null = null;
    if (th.kind === THING_TIRE) {
      body = this.mesh(this.tireGeo, this.toon, 0.05);
    } else if (th.kind === THING_OIL) {
      body = this.mesh(this.oilGeo, this.oilMat, 0);
    } else if (th.kind === THING_TOP) {
      body = this.mesh(this.topGeo, this.toon, 0.05);
      swirl = new THREE.Mesh(this.swirlGeo, this.swirlMat);
      mid.add(swirl);
    } else if (th.kind === THING_DRILL) {
      // Derselbe Bohrer, den die Figur in der Hand hatte – so groß, wie sie ihn eingesteckt hat.
      const g = getDrillGeo();
      const m = new THREE.Mesh(g.main, this.toon);
      if (this.outlines && g.line) {
        const ol = new THREE.Mesh(g.line, outlineMaterial());
        ol.name = 'outline';
        m.add(ol);
      }
      m.scale.setScalar(DRILL_GROW);
      body = m;
    } else {
      body = new THREE.Group();
      balls = [];
      for (let i = 0; i < SMOKE_BALLS.length; i++) {
        const ball = this.mesh(i % 2 === 0 ? this.smokeGeoA : this.smokeGeoB, this.toon, 0.12);
        ball.scale.setScalar(0);
        body.add(ball);
        balls.push(ball);
      }
    }
    mid.add(body);
    const heading = Math.hypot(th.vx, th.vz) > 0.5 ? Math.atan2(th.vx, th.vz) : th.id * 1.3;
    return {
      kind: th.kind,
      obj,
      mid,
      body,
      swirl,
      balls,
      seen: true,
      age: 0,
      spin: Math.random() * 6,
      dist: 0,
      heading,
      acc: 0,
      acc2: Math.random(),
      gone: 0,
      lx: th.x,
      ly: th.y,
      lz: th.z,
      stage: th.stage,
      sub: 0,
      lastAge: th.age,
      lump: 0,
      crack: 0,
      done: 0,
      seg: th.seg,
    };
  }

  /** Gleicht die sichtbaren Dinge mit der Liste vom Spiel ab und bewegt sie. */
  /** Wird nach dem Platzieren jedes sichtbaren Dings gerufen (Magnettrommel: an die Trommelwand drehen). */
  afterPlace: ((o: THREE.Object3D) => void) | null = null;

  update(things: SnapshotThing[], dt: number, time: number, fx: FxSink): void {
    this.now = time;
    for (const v of this.live.values()) v.seen = false;
    for (const th of things) {
      const key = th.kind * 1000 + th.id;
      let v = this.live.get(key);
      if (!v) {
        v = this.create(th);
        this.live.set(key, v);
        this.group.add(v.obj);
        // Beim ersten Abgleich (Szenenwechsel, Beitritt mitten im Rennen)
        // liegt alles schon da: kein Aufploppen, kein Platsch.
        if (!this.primed) v.age = 30;
        else if (th.kind === THING_DRILL) {
          // Der Bohrer steckt schon, wenn er erscheint (die Figur hat ihn eben hineingerammt).
          v.age = 0;
          this.arrive(th, fx);
        } else {
          v.age = -(th.kind === THING_TIRE || th.kind === THING_TOP ? THROW_DELAY : DROP_DELAY);
          v.obj.visible = false;
        }
      }
      v.seen = true;
      const hidden = v.age < 0;
      v.age += dt;
      if (v.age < 0) continue;
      if (hidden) {
        v.age = 0;
        v.obj.visible = true;
        this.arrive(th, fx);
      }
      if (th.kind === THING_TIRE) this.tire(v, th, dt, fx);
      else if (th.kind === THING_OIL) this.oil(v, th, dt, time, fx);
      else if (th.kind === THING_TOP) this.top(v, th, dt, time, fx);
      else if (th.kind === THING_SMOKE) this.smoke(v, th, dt, time, fx);
      else if (th.kind === THING_DRILL) this.drill(v, th, dt, time, fx);
      this.afterPlace?.(v.obj);
    }
    this.primed = true;
    for (const [key, v] of this.live) {
      if (v.seen) continue;
      if (v.age >= 0) this.farewell(v, fx);
      this.group.remove(v.obj);
      this.live.delete(key);
    }
    this.marks.update(time);
  }

  /**
   * Bohrer kurz vor dem Durchbruch: Risse auf der Fahrbahn vor dem Kart, das er sucht – vorn bei (x, z) auf Abschnitt seg,
   * Fahrtrichtung yaw, Stärke k (0 … 1). Wird pro Bild gerufen; neue Risse entstehen umso dichter, je näher er ist.
   */
  warnCracks(x: number, y: number, z: number, seg: number, yaw: number, k: number, dt: number, fx: FxSink): void {
    if (this.track.edge[seg] & NO_EARTH) return;
    if (Math.random() > dt * (6 + 22 * k)) return;
    const a = yaw + (Math.random() - 0.5) * 1.2;
    const side = (Math.random() - 0.5) * 3.2;
    const cx = x + Math.cos(yaw) * side;
    const cz = z - Math.sin(yaw) * side;
    const size = 1.1 + 1.5 * k * Math.random();
    this.marks.crack(cx, y, cz, seg, a, size * 0.8, size * (1.5 + Math.random()), this.now, 1.4, false);
    fx.puff(cx, y + 0.15, cz, (Math.random() - 0.5) * 1.5, 1.4 + Math.random() * 2 * k, (Math.random() - 0.5) * 1.5, 0.45, 0.35 + 0.3 * k, EARTH[(Math.random() * 4) | 0], 0.8, 3);
  }

  /** Ist das Ding schon zu sehen – oder holt die Figur noch aus? (Für den Schatten.) */
  shown(th: SnapshotThing): boolean {
    const v = this.live.get(th.kind * 1000 + th.id);
    return !v || v.age >= 0;
  }

  /** Auftritt: der Ölfleck landet mit Platsch, die Rauchwolke pafft los, der Bohrer fährt mit Erdspritzern in den Boden. */
  private arrive(th: SnapshotThing, fx: FxSink): void {
    if (th.kind === THING_DRILL) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
        const sp = 2.5 + Math.random() * 3;
        fx.puff(th.x + Math.sin(a) * 0.4, th.y + 0.15, th.z + Math.cos(a) * 0.4, Math.sin(a) * sp, 3 + Math.random() * 3, Math.cos(a) * sp, 0.5, 0.3 + Math.random() * 0.2, EARTH[i % 4], 0.3, 14);
      }
      this.marks.crack(th.x, th.y, th.z, th.seg, Math.random() * 6.3, 1.6, 1.6, this.now, 3.5);
    } else if (th.kind === THING_OIL) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
        const s = 3.5 + Math.random() * 2.5;
        fx.puff(th.x + Math.sin(a) * 0.9, th.y + 0.2, th.z + Math.cos(a) * 0.9, Math.sin(a) * s, 2.2 + Math.random() * 1.5, Math.cos(a) * s, 0.4, 0.45 + Math.random() * 0.2, i % 3 === 0 ? 0x2c2440 : 0x16131c, -0.3, 14);
      }
    } else if (th.kind === THING_SMOKE) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        fx.puff(th.x + Math.sin(a) * 1.5, th.y + 0.5, th.z + Math.cos(a) * 1.5, Math.sin(a) * 7, 1.2, Math.cos(a) * 7, 0.55, 0.85, 0xe9e6f2, 1.2, -1);
      }
    }
  }

  /** Abschied an der letzten Stelle: Funken- und Staubstoß bzw. kleiner Platsch – beim Bohrer die Explosion samt Krater. */
  private farewell(v: Visual, fx: FxSink): void {
    if (v.kind === THING_DRILL) {
      if (v.stage <= 0) return;
      const x = v.lx;
      const y = v.ly;
      const z = v.lz;
      // Feuerball und Funken
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 6 + Math.random() * 10;
        fx.spark(x, y + 1 + Math.random(), z, Math.sin(a) * s, 4 + Math.random() * 9, Math.cos(a) * s, 0.45 + Math.random() * 0.35, 0.9 + Math.random() * 0.8, SPARK_HOT[i % 3], 7);
      }
      // Erdbrocken fliegen hoch und fallen zurück
      for (let i = 0; i < 22; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 3 + Math.random() * 7;
        fx.puff(x + Math.sin(a) * 0.6, y + 0.6, z + Math.cos(a) * 0.6, Math.sin(a) * s, 7 + Math.random() * 9, Math.cos(a) * s, 0.9 + Math.random() * 0.5, 0.35 + Math.random() * 0.4, i % 3 === 0 ? EARTH_DARK : EARTH[i % 4], 0, 22);
      }
      // Rauchpilz
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.6;
        fx.puff(x + Math.sin(a) * r, y + 0.6 + Math.random() * 2.2, z + Math.cos(a) * r, Math.sin(a) * 2.4, 2.2 + Math.random() * 2.5, Math.cos(a) * 2.4, 1 + Math.random() * 0.6, 1.1 + Math.random() * 0.8, i % 2 === 0 ? 0x8d8597 : 0xc9c3d3, 1.8, -1.5);
      }
      // Krater: ein großer Riss und ein Ring aus aufgeworfener Erde
      this.marks.crack(x, y, z, v.seg, Math.random() * 6.3, 4.6, 4.6, this.now, 4.5);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + Math.random() * 0.3;
        const r = 1.9 + Math.random() * 0.5;
        this.marks.lump(x + Math.sin(a) * r, y - 0.05, z + Math.cos(a) * r, v.seg, a, 1 + Math.random() * 0.5, 0.45 + Math.random() * 0.25, 1.4, this.now, 3.6, 0.6);
      }
      return;
    }
    if (v.kind === THING_TIRE || v.kind === THING_TOP) {
      const top = v.kind === THING_TOP;
      const cy = v.ly + (top ? 0.7 : 0.1);
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 4 + Math.random() * 5;
        const color = top ? (i % 3 === 0 ? 0xff5a4e : i % 3 === 1 ? 0xffe04a : 0x3ff2e2) : SPARK_HOT[i % 3];
        fx.spark(v.lx, cy, v.lz, Math.sin(a) * s, 3 + Math.random() * 5, Math.cos(a) * s, 0.35 + Math.random() * 0.2, 0.3 + Math.random() * 0.15, color);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
        fx.puff(v.lx + Math.sin(a) * 0.5, v.ly + 0.3, v.lz + Math.cos(a) * 0.5, Math.sin(a) * 3, 1 + Math.random(), Math.cos(a) * 3, 0.5, 0.7, i % 2 === 0 ? this.dust : 0x6a6580, 1.2, -0.5);
      }
    } else if (v.kind === THING_OIL) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.random();
        fx.puff(v.lx + Math.sin(a) * 0.6, v.ly + 0.15, v.lz + Math.cos(a) * 0.6, Math.sin(a) * 2.5, 2, Math.cos(a) * 2.5, 0.3, 0.4, 0x16131c, -0.4, 12);
      }
    }
  }

  private turnTo(v: Visual, th: SnapshotThing, dt: number, rate: number): number {
    const speed = Math.hypot(th.vx, th.vz);
    if (speed > 0.5) v.heading += wrapAngle(Math.atan2(th.vx, th.vz) - v.heading) * (1 - Math.exp(-rate * dt));
    return speed;
  }

  private tire(v: Visual, th: SnapshotThing, dt: number, fx: FxSink): void {
    const speed = this.turnTo(v, th, dt, 18);
    const o = v.obj;
    o.position.set(th.x, th.y, th.z);
    o.rotation.y = v.heading;
    o.scale.setScalar(popCurve(v.age * 7));
    v.dist += speed * dt;
    v.spin += Math.min(speed / 0.8, TIRE_SPIN_MAX) * dt;
    v.body.rotation.x = v.spin;
    // Kleine Hopser im Takt des Rollens; beim Aufsetzen kurz gestaucht.
    const s = Math.abs(Math.sin(v.dist * 0.32));
    const squash = 0.09 * Math.pow(1 - s, 6) * Math.min(1, speed / 10);
    v.mid.position.y = 0.11 * s * Math.min(1, speed / 10) - squash * 0.8;
    v.mid.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.4);
    const gy = th.y - 0.8;
    v.lx = th.x;
    v.ly = gy;
    v.lz = th.z;
    // Staubspur
    if (speed > 3) {
      v.acc += dt * 15;
      while (v.acc >= 1) {
        v.acc -= 1;
        const side = (Math.random() - 0.5) * 2;
        const cx = Math.cos(v.heading);
        const sx = Math.sin(v.heading);
        fx.puff(th.x + cx * side * 0.3, gy + 0.2, th.z - sx * side * 0.3, th.vx * 0.15 + cx * side * 1.6, 0.8 + Math.random() * 0.8, th.vz * 0.15 - sx * side * 1.6, 0.42, 0.42, this.dust, 0.9, -0.5);
      }
    }
  }

  private oil(v: Visual, th: SnapshotThing, dt: number, time: number, fx: FxSink): void {
    const o = v.obj;
    o.position.set(th.x, th.y, th.z);
    o.rotation.y = v.heading;
    // Landen: flach breitgedrückt mit Nachschwingen, dann leichtes Wabern
    const p = clamp01(v.age * 5);
    const land = p < 1 ? p * (1 + 0.45 * Math.sin(p * Math.PI)) : 1;
    const end = clamp01(th.ttl * 2);
    const w = 0.035;
    o.scale.set(land * end * (1 + w * Math.sin(time * 2.1 + th.id)), 1, land * end * (1 + w * Math.cos(time * 1.7 + th.id * 2)));
    v.body.rotation.y = 0.06 * Math.sin(time * 0.9 + th.id);
    v.lx = th.x;
    v.ly = th.y;
    v.lz = th.z;
    // ab und zu steigt eine Blase auf
    v.acc += dt * 0.45;
    if (v.acc >= 1 && v.age > 0.6) {
      v.acc = -Math.random() * 1.2;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.9;
      fx.puff(th.x + Math.sin(a) * r, th.y + 0.15, th.z + Math.cos(a) * r, 0, 0.9, 0, 0.55, 0.3, 0x2c2440, 0.5, -0.6);
    }
  }

  private top(v: Visual, th: SnapshotThing, dt: number, time: number, fx: FxSink): void {
    const speed = this.turnTo(v, th, dt, 10);
    const hunt = th.target >= 0;
    const o = v.obj;
    const foot = th.y - 0.6;
    o.position.set(th.x, foot + 0.04 * Math.abs(Math.sin(time * 11)), th.z);
    o.rotation.y = v.heading;
    o.scale.setScalar(popCurve(v.age * 7) * 1.15);
    // In Fahrtrichtung geneigt, dazu ein leichtes Taumeln
    const lean = 0.2 * Math.min(1, speed / 20);
    const wob = 0.1;
    v.mid.rotation.set(lean + wob * Math.sin(time * 6), 0, wob * Math.cos(time * 6));
    v.spin += dt * TOP_SPIN;
    v.body.rotation.y = v.spin;
    const sw = v.swirl!;
    sw.rotation.y = v.spin * (hunt ? 1.5 : 1.15);
    const pulse = hunt ? 1 + 0.13 * Math.sin(time * 26) : 1 + 0.05 * Math.sin(time * 9);
    sw.scale.set(pulse, 1, pulse);
    sw.material = hunt ? this.swirlHot : this.swirlMat;
    v.lx = th.x;
    v.ly = foot;
    v.lz = th.z;
    // Funken an der Spitze, Staubbällchen als Spur
    v.acc += dt * (hunt ? 20 : 15);
    while (v.acc >= 1) {
      v.acc -= 1;
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 3;
      fx.spark(th.x, foot + 0.05, th.z, th.vx * 0.2 + Math.sin(a) * s, 2 + Math.random() * 3, th.vz * 0.2 + Math.cos(a) * s, 0.25 + Math.random() * 0.12, 0.28 + Math.random() * 0.12, SPARK_HOT[(Math.random() * 3) | 0]);
    }
    if (speed > 3) {
      v.acc2 += dt * 8;
      while (v.acc2 >= 1) {
        v.acc2 -= 1;
        fx.puff(th.x + (Math.random() - 0.5) * 0.6, foot + 0.2, th.z + (Math.random() - 0.5) * 0.6, th.vx * 0.12 + (Math.random() - 0.5) * 2, 0.7 + Math.random() * 0.6, th.vz * 0.12 + (Math.random() - 0.5) * 2, 0.45, 0.5, this.dust, 1.0, -0.4);
      }
    }
  }

  /**
   * Bohrer: steckt im Boden und dreht sich ein – erst langsam, dann immer schneller – und versinkt dabei (Erde spritzt, ein
   * Erdring häuft sich um das Loch). Unter der Erde ist er selbst nicht zu sehen, nur seine Spur: ein Erdwall, der hinter
   * ihm aufgeworfen wird und wieder zusammensackt, Risse daneben und Erde, die vorn hochspritzt. Vor seinem Ziel reißt der
   * Boden sternförmig auf, und er bricht mit der Spitze voran heraus, rasend schnell drehend, bis er explodiert (farewell).
   */
  private drill(v: Visual, th: SnapshotThing, dt: number, time: number, fx: FxSink): void {
    const t = this.track;
    // Bruchteil eines Ticks seit dem letzten Stand – damit Eindrehen und Durchbruch zwischen zwei Ständen weich weiterlaufen.
    if (th.age !== v.lastAge) {
      v.lastAge = th.age;
      v.sub = 0;
    } else v.sub = Math.min(2, v.sub + dt * 60);
    const age = th.age + v.sub;
    const stage = th.stage > 0 ? th.stage + v.sub : 0;
    const seg = th.seg < t.total ? th.seg : 0;
    const o = v.obj;
    const mid = v.mid;
    const L = DRILL_LEN * DRILL_GROW;
    v.seg = seg;
    v.stage = th.stage;
    if (stage <= 0 && age <= DRILL_DIG_TICKS + 1) {
      // — Eindrehen —
      const u = Math.min(1, age / DRILL_DIG_TICKS);
      o.visible = true;
      o.position.set(th.x, th.y, th.z);
      // Erst dreht er sich fast an Ort und Stelle, dann frisst er sich immer schneller hinein.
      const sink = (L + 0.45) * Math.pow(u, 2.3);
      mid.position.y = L - DRILL_SINK - sink;
      mid.rotation.set(0.08 * (1 - u) * Math.sin(time * 10), 0, 0.08 * (1 - u) * Math.cos(time * 10));
      mid.scale.setScalar(1);
      v.spin += dt * (DRILL_SPIN_DIG[0] + (DRILL_SPIN_DIG[1] - DRILL_SPIN_DIG[0]) * u * u);
      v.body.rotation.set(0, v.spin, 0);
      // Erde spritzt aus dem Loch, immer heftiger
      v.acc += dt * (4 + 50 * u * u);
      while (v.acc >= 1) {
        v.acc -= 1;
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * (2 + 4 * u);
        fx.puff(th.x + Math.sin(a) * 0.35, th.y + 0.15, th.z + Math.cos(a) * 0.35, Math.sin(a) * sp, 2 + Math.random() * (2 + 5 * u), Math.cos(a) * sp, 0.45 + Math.random() * 0.3, 0.2 + Math.random() * 0.25, EARTH[(Math.random() * 4) | 0], 0.2, 16);
      }
      // Erdring um das Loch
      if (u > 0.2) {
        v.acc2 += dt * 8;
        while (v.acc2 >= 1) {
          v.acc2 -= 1;
          const a = Math.random() * Math.PI * 2;
          const r = 0.62 + Math.random() * 0.3;
          this.marks.lump(th.x + Math.sin(a) * r, th.y - 0.04, th.z + Math.cos(a) * r, seg, a, 0.38 + Math.random() * 0.25, 0.16 + Math.random() * 0.14, 0.5, this.now, 3.2, 0.5);
        }
      }
      // Ganz versunken: ein letzter Erdstoß
      if (u >= 1 && !(v.done & 1)) {
        v.done |= 1;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          fx.puff(th.x, th.y + 0.3, th.z, Math.sin(a) * 4, 4 + Math.random() * 3, Math.cos(a) * 4, 0.6, 0.45, EARTH[i % 4], 0.6, 12);
        }
      }
      v.lx = th.x;
      v.ly = th.y;
      v.lz = th.z;
      return;
    }
    if (stage <= 0) {
      // — Unter der Erde: Erdwall, Risse, Erde spritzt vorn hoch —
      o.visible = false;
      const dx = th.x - v.lx;
      const dz = th.z - v.lz;
      const dist = Math.hypot(dx, dz);
      const speed = Math.hypot(th.vx, th.vz);
      const earth = (t.edge[seg] & NO_EARTH) === 0;
      if (dist > 1e-3 && dist < 60 && earth) {
        const yaw = Math.atan2(dx, dz);
        const nx = dz / dist;
        const nz = -dx / dist;
        // Erdwall: Brocken dicht hintereinander (bei hohem Tempo weiter auseinander und länger gezogen), dazwischen je ein
        // großer Haufen – frisch aufgeworfen schießen sie über ihre Größe hinaus (der Buckel über dem Kopf des Bohrers).
        const sp = Math.max(0.6, speed / 120);
        let d = sp - v.lump;
        for (; d <= dist; d += sp) {
          const f = Math.max(0, d / dist);
          const j = (Math.random() - 0.5) * 0.35;
          const heap = (v.dist++ & 3) === 0;
          const w = heap ? 1.2 + Math.random() * 0.3 : 0.8 + Math.random() * 0.3;
          const h = heap ? 0.5 + Math.random() * 0.15 : 0.32 + Math.random() * 0.16;
          this.marks.lump(v.lx + dx * f + nx * j, v.ly + (th.y - v.ly) * f - 0.06, v.lz + dz * f + nz * j, seg, yaw + (Math.random() - 0.5) * 0.35, w, h, Math.max(1.1, sp * 1.8), this.now, LUMP_LIFE, 0.75);
        }
        v.lump = dist - (d - sp);
        // Risse links und rechts des Walls
        const csp = Math.max(2.2, speed / 40);
        d = csp - v.crack;
        for (; d <= dist; d += csp) {
          const f = Math.max(0, d / dist);
          const side = ((v.dist++ & 1) === 0 ? 1 : -1) * (0.8 + Math.random() * 0.6);
          const w = 1.2 + Math.random() * 0.8;
          this.marks.crack(v.lx + dx * f + nx * side, v.ly + (th.y - v.ly) * f, v.lz + dz * f + nz * side, seg, yaw + (Math.random() - 0.5) * 0.7, w * 0.8, w * (1.6 + Math.random() * 0.8), this.now, CRACK_LIFE, false);
        }
        v.crack = dist - (d - csp);
        // Vorn spritzt Erde hoch (nach hinten weg)
        v.acc += dt * 30;
        while (v.acc >= 1) {
          v.acc -= 1;
          const a = Math.random() * Math.PI * 2;
          const sp2 = 1 + Math.random() * 2.5;
          fx.puff(th.x + Math.sin(a) * 0.4, th.y + 0.35, th.z + Math.cos(a) * 0.4, -dx / dist * Math.min(8, speed * 0.05) + Math.sin(a) * sp2, 3 + Math.random() * 4, -dz / dist * Math.min(8, speed * 0.05) + Math.cos(a) * sp2, 0.5 + Math.random() * 0.3, 0.25 + Math.random() * 0.25, EARTH[(Math.random() * 4) | 0], 0.3, 15);
        }
        v.acc2 += dt * 7;
        while (v.acc2 >= 1) {
          v.acc2 -= 1;
          fx.puff(th.x, th.y + 0.3, th.z, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, 0.6, 0.45, EARTH_DUST, 0.9, -0.4);
        }
      } else if (dist >= 60 || !earth) {
        // Sprung (auf die andere Seite einer Abzweigung) oder kein Erdreich: die Spur beginnt danach neu.
        v.lump = 0;
        v.crack = 0;
      }
      // (Hat er sich seit dem letzten Bild nicht bewegt – zwei Bilder im selben Takt –, zählt der Weg einfach weiter.)
      v.lx = th.x;
      v.ly = th.y;
      v.lz = th.z;
      return;
    }
    // — Durchbruch: der Boden reißt auf, die Spitze bricht heraus, er steigt rasend drehend hoch und schwillt an —
    const u = Math.min(1, stage / DRILL_RISE_TICKS);
    o.visible = true;
    o.position.set(th.x, th.y, th.z);
    if (!(v.done & 2)) {
      v.done |= 2;
      this.marks.crack(th.x, th.y, th.z, seg, Math.random() * 6.3, 3.8, 3.8, this.now, 4);
      // Aufgeworfene Asphaltschollen rings um das Loch (niedrig – der Bohrer soll darüber zu sehen sein)
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + Math.random() * 0.3;
        const r = 1.05 + Math.random() * 0.3;
        this.marks.lump(th.x + Math.sin(a) * r, th.y - 0.05, th.z + Math.cos(a) * r, seg, a, 0.55 + Math.random() * 0.25, 0.2 + Math.random() * 0.12, 0.8, this.now, 3.4, 0.7);
      }
    }
    // Er kommt ganz heraus (ein Stück größer als beim Einstecken – Comic-Übertreibung) und schwebt dann bebend über dem Loch.
    const big = 1.25;
    const e = u < 0.12 ? 0 : easeOutBack(Math.min(1, (u - 0.12) / 0.55));
    const tip = -0.4 + (L * big + 0.75) * e;
    const shake = 0.06 * Math.sin(time * 47) * Math.min(1, e);
    mid.rotation.set(Math.PI + shake, 0, shake * 0.8);
    mid.position.y = tip - L * big;
    // Kurz vor der Explosion schwillt er im Takt an.
    const swell = u > 0.62 ? 1 + 0.18 * ((u - 0.62) / 0.38) * (0.5 + 0.5 * Math.sin(time * 70)) : 1;
    mid.scale.setScalar(big * swell);
    v.spin += dt * DRILL_SPIN_RISE;
    v.body.rotation.set(0, v.spin, 0);
    // Erdfontäne (seitlich weg, damit der Bohrer zu sehen bleibt) und Funken, wo er durch den Asphalt reißt
    v.acc += dt * (u < 0.5 ? 46 : 20);
    while (v.acc >= 1) {
      v.acc -= 1;
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 5;
      fx.puff(th.x + Math.sin(a) * 0.6, th.y + 0.15, th.z + Math.cos(a) * 0.6, Math.sin(a) * sp, 4 + Math.random() * 6, Math.cos(a) * sp, 0.55 + Math.random() * 0.3, 0.18 + Math.random() * 0.22, Math.random() < 0.3 ? EARTH_DARK : EARTH[(Math.random() * 4) | 0], 0.1, 18);
    }
    if (tip > 0 && e < 0.85) {
      v.acc2 += dt * 26;
      while (v.acc2 >= 1) {
        v.acc2 -= 1;
        const a = Math.random() * Math.PI * 2;
        const sp = 4 + Math.random() * 5;
        fx.spark(th.x + Math.sin(a) * 0.3, th.y + 0.15, th.z + Math.cos(a) * 0.3, Math.sin(a) * sp, 2 + Math.random() * 4, Math.cos(a) * sp, 0.2 + Math.random() * 0.12, 0.18 + Math.random() * 0.1, SPARK_HOT[(Math.random() * 3) | 0]);
      }
    }
    v.lx = th.x;
    v.ly = th.y;
    v.lz = th.z;
  }

  private smoke(v: Visual, th: SnapshotThing, dt: number, time: number, fx: FxSink): void {
    const o = v.obj;
    o.position.set(th.x, th.y, th.z);
    const turn = time * 0.25 + th.id;
    v.mid.rotation.y = turn;
    v.mid.scale.set(1, 0.95 + 0.05 * Math.sin(time * 2.2 + th.id), 1);
    v.lx = th.x;
    v.ly = th.y;
    v.lz = th.z;
    const cs = Math.cos(turn);
    const sn = Math.sin(turn);
    const balls = v.balls!;
    // Zerfall: von oben nach unten, je Bällchen leicht versetzt
    const fall = SMOKE_DISSOLVE - th.ttl;
    let dissolving = -1;
    for (let i = 0; i < balls.length; i++) {
      const [bx, by, bz, br] = SMOKE_BALLS[i];
      const ball = balls[i];
      // Aufquellen: Bällchen erscheinen nacheinander und rücken nach außen
      const t = (v.age - i * 0.07) / 0.35;
      const pop = popCurve(t);
      const out = 0.35 + 0.65 * clamp01(t);
      const k = clamp01((fall - (balls.length - 1 - i) * 0.17) / 0.5);
      const keep = (1 - k) * (1 - k);
      const wob = 1 + 0.06 * Math.sin(time * 2.3 + i * 1.7);
      ball.scale.setScalar(br * pop * keep * wob);
      const spread = out + k * 0.35;
      const lx = bx * spread;
      const ly = by * out + 0.15 * Math.sin(time * 1.4 + i) + k * 1.8;
      const lz = bz * spread;
      ball.position.set(lx, ly, lz);
      if (k > 0) {
        if (k < 1) dissolving = i;
        if (!(v.gone & (1 << i))) {
          // Bällchen platzt: vier Rauchbällchen an seiner Stelle
          v.gone |= 1 << i;
          const wx = th.x + lx * cs + lz * sn;
          const wz = th.z - lx * sn + lz * cs;
          for (let n = 0; n < 4; n++) {
            const a = Math.random() * Math.PI * 2;
            fx.puff(wx + Math.sin(a) * br * 0.5, th.y + ly, wz + Math.cos(a) * br * 0.5, Math.sin(a) * 2.5, 1.5, Math.cos(a) * 2.5, 0.6, 1.2, n === 0 ? 0xc9c5d8 : 0xe9e6f2, 1.8, -1.2);
          }
        }
      }
    }
    // Während des Zerfalls weitere Fetzen; sonst steigen am Rand Bällchen auf
    if (dissolving >= 0) {
      v.acc += dt * 14;
      while (v.acc >= 1) {
        v.acc -= 1;
        const [bx, by, bz, br] = SMOKE_BALLS[(Math.random() * balls.length) | 0];
        const lx = bx * 1.2;
        const lz = bz * 1.2;
        const a = Math.random() * Math.PI * 2;
        fx.puff(th.x + lx * cs + lz * sn + Math.sin(a) * br * 0.5, th.y + by + 1, th.z - lx * sn + lz * cs + Math.cos(a) * br * 0.5, Math.sin(a) * 1.5, 1.8, Math.cos(a) * 1.5, 0.55, 0.8, 0xe9e6f2, 1.4, -1);
      }
    } else if (fall < 0 && v.age > 0.5) {
      v.acc += dt * 6;
      while (v.acc >= 1) {
        v.acc -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = 4.2 + Math.random() * 0.8;
        fx.puff(th.x + Math.sin(a) * r, th.y + 0.6 + Math.random() * 2.2, th.z + Math.cos(a) * r, Math.sin(a) * 0.8, 1.3, Math.cos(a) * 0.8, 0.6, 0.85, Math.random() < 0.5 ? 0xe9e6f2 : 0xc9c5d8, 1.2, -0.8);
      }
    }
  }

  updateHazards(hostTick: number, time: number): void {
    const t = this.track;
    for (let i = 0; i < t.hazards.length; i++) {
      const h = t.hazards[i];
      const lat = hazardLat(h, hostTick);
      const o = this.hazards[i];
      o.position.set(t.px[h.seg] + rightX(t, h.seg) * lat, t.py[h.seg] + lat * t.bank[h.seg], t.pz[h.seg] + rightZ(t, h.seg) * lat);
      o.rotation.y = Math.atan2(t.tx[h.seg], t.tz[h.seg]);
      const inner = o.children[0];
      if (this.theme === 'werkshof') {
        // Das Fass rollt um seine Längsachse (zeigt in Fahrtrichtung).
        inner.position.y = 1;
        inner.rotation.z = -lat;
      } else if (this.theme === 'glut') {
        inner.position.y = 1.35;
        inner.rotation.set(time * 1.1, 0, -lat * 0.7);
      } else if (this.theme === 'klippe') {
        inner.position.y = Math.abs(Math.sin(time * 14)) * 0.12;
        inner.rotation.z = Math.sin(time * 14) * 0.06;
      } else if (this.theme === 'riff') {
        // Die Qualle schwebt und pumpt: der Schirm zieht sich zusammen und weitet sich.
        const pump = Math.sin(time * 3.4 + i * 1.7);
        inner.position.y = 0.45 + 0.3 * Math.sin(time * 1.7 + i);
        inner.scale.set(1 + 0.09 * pump, 1 - 0.12 * pump, 1 + 0.09 * pump);
        inner.rotation.z = Math.sin(time * 1.1 + i) * 0.12;
      } else if (this.theme === 'dschungel') {
        // Der Stamm treibt: er rollt mit der Bewegung um seine Längsachse und dümpelt.
        inner.position.y = -0.25 + 0.08 * Math.sin(time * 2.1 + i * 1.3);
        inner.rotation.z = -lat * 0.35;
        inner.rotation.y = Math.sin(time * 0.6 + i) * 0.12;
      } else if (this.theme === 'gipfel') {
        // Die Gondel schaukelt am Gehänge: am Umkehrpunkt schräg, dazu ein leichtes Wiegen.
        inner.position.y = 0.15;
        inner.rotation.z = -(lat / Math.max(1, h.amp)) * 0.08 + Math.sin(time * 1.6 + i) * 0.02;
      } else if (this.theme === 'talsperre') {
        // Der Läufer dreht sich am Haken (Seil und Katze sind rund – sie drehen unsichtbar mit) und pendelt leicht.
        inner.position.y = 0.02 * Math.sin(time * 1.3 + i);
        inner.rotation.y = time * 2.4 + i;
        inner.rotation.z = -(lat / Math.max(1, h.amp)) * 0.035;
      } else if (this.theme === 'hafen') {
        // Die Last hängt: am Umkehrpunkt steht sie schräg, in der Mitte gerade; dazu dreht sie leicht am Seil.
        inner.position.y = 0.12 + 0.05 * Math.sin(time * 1.3 + i);
        inner.rotation.z = -(lat / Math.max(1, h.amp)) * 0.1;
        inner.rotation.y = Math.sin(time * 0.7 + i * 2.1) * 0.08;
      } else if (this.theme === 'kristall') {
        // Die Lore rumpelt über die Schienenstöße: leichtes Rucken und Schaukeln.
        inner.position.y = 0.03 * Math.abs(Math.sin(time * 9 + i));
        inner.rotation.z = Math.sin(time * 7 + i) * 0.025;
      } else {
        inner.position.y = 0.04 * Math.sin(time * 20);
      }
    }
  }

  /** Szenenwechsel: alles weg, ohne Abschiedseffekte. */
  clear(): void {
    for (const v of this.live.values()) this.group.remove(v.obj);
    this.live.clear();
    this.primed = false;
    this.marks.clear();
  }

  dispose(): void {
    this.clear();
    for (const g of this.geos) g.dispose();
    this.toon.dispose();
    this.oilMat.dispose();
    this.swirlMat.dispose();
    this.swirlHot.dispose();
    this.marks.dispose();
  }
}

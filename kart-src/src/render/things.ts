// Alles, was außer den Karts auf der Strecke unterwegs ist: Rollreifen,
// Ölflecken, Brummkreisel, Rauchwolken – und die pendelnden Hindernisse der
// jeweiligen Welt (Fass, Krabbe, Glutbrocken, Kehrroboter).
//
// Die Dinge sollen auch im Augenwinkel lesbar sein: der Kreisel trägt Spiralen
// und Wirbelstriche, der Reifen Profil und Felgenstern, dazu Spuren aus Staub
// und Funken. Teilchen werden je Ding über Zeitkonten getaktet, nicht pro Bild.

import * as THREE from 'three';
import { hazardLat, rightX, rightZ, type ThemeId, type Track } from '../game/track';
import { THING_OIL, THING_SMOKE, THING_TIRE, THING_TOP, type SnapshotThing } from '../net/protocol';
import { MeshBuilder, mixRgb, type RGB } from './build';
import type { FxSink } from './fxApi';
import { THEMES } from './themes';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from './toon';

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

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
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

  constructor(
    private readonly track: Track,
    private readonly outlines: boolean,
  ) {
    this.theme = track.def.theme;
    const d = mixRgb(rgb(0xe9e6f2), rgb(THEMES[this.theme].shoulder), 0.35);
    this.dust = new THREE.Color(d[0], d[1], d[2]).getHex();
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
    };
  }

  /** Gleicht die sichtbaren Dinge mit der Liste vom Spiel ab und bewegt sie. */
  update(things: SnapshotThing[], dt: number, time: number, fx: FxSink): void {
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
        else {
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
    }
    this.primed = true;
    for (const [key, v] of this.live) {
      if (v.seen) continue;
      if (v.age >= 0) this.farewell(v, fx);
      this.group.remove(v.obj);
      this.live.delete(key);
    }
  }

  /** Ist das Ding schon zu sehen – oder holt die Figur noch aus? (Für den Schatten.) */
  shown(th: SnapshotThing): boolean {
    const v = this.live.get(th.kind * 1000 + th.id);
    return !v || v.age >= 0;
  }

  /** Auftritt: der Ölfleck landet mit Platsch, die Rauchwolke pafft los. */
  private arrive(th: SnapshotThing, fx: FxSink): void {
    if (th.kind === THING_OIL) {
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

  /** Abschied an der letzten Stelle: Funken- und Staubstoß bzw. kleiner Platsch. */
  private farewell(v: Visual, fx: FxSink): void {
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
  }

  dispose(): void {
    this.clear();
    for (const g of this.geos) g.dispose();
    this.toon.dispose();
    this.oilMat.dispose();
    this.swirlMat.dispose();
    this.swirlHot.dispose();
  }
}

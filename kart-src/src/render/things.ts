// Alles, was außer den Karts auf der Strecke unterwegs ist: Rollreifen,
// Ölflecken, Brummkreisel, Rauchwolken – und die pendelnden Hindernisse der
// jeweiligen Welt (Fass, Krabbe, Glutbrocken, Kehrroboter).

import * as THREE from 'three';
import { hazardLat, rightX, rightZ, type ThemeId, type Track } from '../game/track';
import { THING_OIL, THING_SMOKE, THING_TIRE, THING_TOP, type SnapshotThing } from '../net/protocol';
import { MeshBuilder } from './build';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from './toon';

interface Visual {
  kind: number;
  obj: THREE.Object3D;
  seen: boolean;
  age: number;
  spin: number;
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
  private readonly tireGeo: THREE.BufferGeometry;
  private readonly oilGeo: THREE.BufferGeometry;
  private readonly topGeo: THREE.BufferGeometry;
  private readonly smokeGeo: THREE.BufferGeometry;
  private readonly hazardGeo: THREE.BufferGeometry;
  private readonly theme: ThemeId;

  constructor(
    private readonly track: Track,
    private readonly outlines: boolean,
  ) {
    this.theme = track.def.theme;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const put = (b: MeshBuilder, geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0): void => {
      q.setFromEuler(new THREE.Euler(rx, ry, rz));
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
      b.add(geo, rgb(color), m);
      geo.dispose();
    };

    // Rollreifen: Achse quer (x), rollt nach +z
    let b = new MeshBuilder();
    put(b, new THREE.TorusGeometry(0.56, 0.27, 7, 14), 0x2a2733, 0, 0, 0, 1, 1, 1, 0, Math.PI / 2, 0);
    put(b, new THREE.CylinderGeometry(0.3, 0.3, 0.3, 8), 0xffd23f, 0, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2);
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

    // Brummkreisel
    b = new MeshBuilder();
    const lathe = (pts: [number, number][], color: number): void => {
      put(b, new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 12), color);
    };
    lathe(
      [
        [0.001, 0],
        [0.5, 0.45],
        [0.78, 0.72],
      ],
      0xff5a4e,
    );
    lathe(
      [
        [0.78, 0.72],
        [0.8, 0.86],
        [0.6, 1.02],
      ],
      0xffd23f,
    );
    lathe(
      [
        [0.6, 1.02],
        [0.14, 1.1],
        [0.11, 1.5],
        [0.2, 1.56],
        [0.001, 1.62],
      ],
      0x1fc8b6,
    );
    this.topGeo = this.keep(addSmoothNormals(b.build()));

    // Rauchwolke: zusammengeschobene Bällchen
    b = new MeshBuilder();
    const puffs: [number, number, number, number][] = [
      [0, 2.2, 0, 3.4],
      [3.2, 1.8, 0.6, 2.7],
      [-3.0, 1.7, -0.5, 2.8],
      [0.8, 1.6, 3.1, 2.6],
      [-0.9, 1.7, -3.0, 2.6],
      [2.2, 4.0, -1.6, 2.3],
      [-2.0, 4.2, 1.4, 2.4],
      [0.2, 5.3, 0.2, 2.0],
    ];
    puffs.forEach(([x, y, z, r], i) => put(b, new THREE.IcosahedronGeometry(1, 1), i % 2 === 0 ? 0xe9e6f2 : 0xc9c5d8, x, y, z, r));
    this.smokeGeo = this.keep(addSmoothNormals(b.build()));

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
    const mesh = new THREE.Mesh(geo, mat);
    holder.add(mesh);
    if (outline > 0 && this.outlines) {
      const ol = new THREE.Mesh(geo, outlineMaterial(outline));
      ol.name = 'outline';
      mesh.add(ol);
    }
    return holder;
  }

  /** Gleicht die sichtbaren Dinge mit der Liste vom Spiel ab und bewegt sie. */
  update(things: SnapshotThing[], dt: number, time: number): void {
    for (const v of this.live.values()) v.seen = false;
    for (const th of things) {
      const key = th.kind * 1000 + th.id;
      let v = this.live.get(key);
      if (!v) {
        let obj: THREE.Object3D;
        if (th.kind === THING_TIRE) obj = this.make(this.tireGeo, this.toon, 0.05);
        else if (th.kind === THING_OIL) obj = this.make(this.oilGeo, this.oilMat, 0);
        else if (th.kind === THING_TOP) obj = this.make(this.topGeo, this.toon, 0.05);
        else obj = this.make(this.smokeGeo, this.toon, 0.12);
        v = { kind: th.kind, obj, seen: true, age: 0, spin: 0 };
        this.live.set(key, v);
        this.group.add(obj);
      }
      v.seen = true;
      v.age += dt;
      const o = v.obj;
      const inner = o.children[0];
      // Aufploppen beim Erscheinen
      const pop = Math.min(1, v.age * 7);
      const grow = pop * (1 + 0.3 * Math.sin(pop * Math.PI));
      if (th.kind === THING_TIRE) {
        o.position.set(th.x, th.y, th.z);
        o.rotation.y = Math.atan2(th.vx, th.vz);
        v.spin += (Math.hypot(th.vx, th.vz) / 0.8) * dt;
        inner.rotation.x = v.spin;
        o.scale.setScalar(grow);
      } else if (th.kind === THING_OIL) {
        o.position.set(th.x, th.y, th.z);
        o.rotation.y = th.id * 1.3;
        o.scale.setScalar(grow);
      } else if (th.kind === THING_TOP) {
        o.position.set(th.x, th.y - 0.6 + 0.08 * Math.sin(time * 9), th.z);
        v.spin += dt * 38;
        inner.rotation.y = v.spin;
        o.rotation.set(Math.sin(time * 5) * 0.16, 0, Math.cos(time * 5) * 0.16);
        o.scale.setScalar(grow * 1.15);
      } else if (th.kind === THING_SMOKE) {
        o.position.set(th.x, th.y, th.z);
        o.rotation.y = time * 0.25 + th.id;
        const fade = Math.min(1, th.ttl * 1.4);
        const s = grow * fade * (1 + 0.04 * Math.sin(time * 3 + th.id));
        o.scale.set(s, s * (0.95 + 0.05 * Math.sin(time * 2.2)), s);
      }
    }
    for (const [key, v] of this.live) {
      if (v.seen) continue;
      this.group.remove(v.obj);
      this.live.delete(key);
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

  clear(): void {
    for (const v of this.live.values()) this.group.remove(v.obj);
    this.live.clear();
  }

  dispose(): void {
    this.clear();
    for (const g of this.geos) g.dispose();
    this.toon.dispose();
    this.oilMat.dispose();
  }
}

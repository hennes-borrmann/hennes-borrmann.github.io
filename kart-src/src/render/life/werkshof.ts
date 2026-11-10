// Leben im Werkshof: ein Betrieb, in dem gearbeitet wird. Turmdrehkräne
// schwenken mit pendelnder Last, ein Güterzug zieht auf einem großen Gleisbogen
// um das Gelände, die Schornsteine der Kulisse rauchen, an den Hallen sprühen
// Schweißfunken und zischt Dampf, Warnlampen blinken.
//
// Platziert wird nur per Verfahren: aus Mitte, Ausdehnung und Bande der Strecke
// und aus der Belegung durch die schon stehende Kulisse (Belegung, unten). So
// passt alles auch zu längeren oder anders geformten Strecken.

import * as THREE from 'three';
import { EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { MeshBuilder, seeded, shade, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

// --- Belegung: wo steht schon Kulisse? -------------------------------------------

/**
 * Die Gruppe der unbewegten Kulisse. Die Welt hängt sie unmittelbar vor dem
 * Aufbau des Lebens als letzte an (siehe World-Konstruktor).
 */
export function kulisse(world: World): THREE.Group | null {
  const kids = world.group.children;
  const g = kids[kids.length - 1];
  return g instanceof THREE.Group ? g : null;
}

/**
 * Grobes Höhenraster der vorhandenen Kulisse (Hallen, Container, Häuser …):
 * je Zelle der höchste Punkt, der dort steht. Damit fährt nichts durch ein
 * Requisit, ohne dass feste Koordinaten nötig wären. Wird beim Aufbau einmal
 * aus der fertigen Kulissengruppe der Welt gelesen.
 */
export class Belegung {
  readonly x0: number;
  readonly z0: number;
  readonly n: number;
  /** Höchster Punkt je Zelle; -Infinity = frei. */
  readonly top: Float32Array;

  constructor(
    world: World,
    readonly cell: number,
    margin: number,
  ) {
    const half = world.radius + margin;
    this.x0 = world.center.x - half;
    this.z0 = world.center.z - half;
    this.n = Math.ceil((half * 2) / cell);
    this.top = new Float32Array(this.n * this.n).fill(-Infinity);
    this.bande = this.abstandZurBande(world);
    const scenery = kulisse(world);
    if (!scenery) return;
    const m = new THREE.Matrix4();
    const im = new THREE.Matrix4();
    const v = new THREE.Vector3();
    const box = new THREE.Box3();
    const corner = new THREE.Vector3();
    scenery.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.name === 'outline') return;
      const geo = o.geometry as THREE.BufferGeometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      // Horizont-Ring und anderes Riesiges gehört nicht zur Kulisse am Boden.
      if (bb.max.x - bb.min.x > 1200 || bb.max.z - bb.min.z > 1200) return;
      o.updateMatrix();
      if (o instanceof THREE.InstancedMesh) {
        for (let k = 0; k < o.count; k++) {
          o.getMatrixAt(k, im);
          m.multiplyMatrices(o.matrix, im);
          box.makeEmpty();
          for (let c = 0; c < 8; c++) {
            corner.set(c & 1 ? bb.max.x : bb.min.x, c & 2 ? bb.max.y : bb.min.y, c & 4 ? bb.max.z : bb.min.z).applyMatrix4(m);
            box.expandByPoint(corner);
          }
          this.mark(box.min.x, box.max.x, box.min.z, box.max.z, box.max.y);
        }
      } else {
        // Zusammengefasste Netze (z. B. die Häuser der Nacht): Dreieck für Dreieck.
        const pos = geo.getAttribute('position');
        const idx = geo.index;
        const cnt = idx ? idx.count : pos.count;
        for (let i = 0; i + 2 < cnt; i += 3) {
          box.makeEmpty();
          for (let k = 0; k < 3; k++) {
            v.fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k).applyMatrix4(o.matrix);
            box.expandByPoint(v);
          }
          this.mark(box.min.x, box.max.x, box.min.z, box.max.z, box.max.y);
        }
      }
    });
  }

  /**
   * Abstand jeder Zelle zur nächsten Bande in Metern (wie World.clearance, aber
   * für das ganze Raster auf einmal – per Chamfer-Distanztransformation, auf
   * wenige Prozent genau).
   */
  readonly bande: Float32Array;

  private abstandZurBande(world: World): Float32Array {
    const t = world.track;
    const N = this.n;
    const C = this.cell;
    const tdist = new Float32Array(N * N).fill(1e9);
    for (let i = 0; i < t.total; i++) {
      const ix = Math.min(N - 1, Math.max(0, Math.floor((t.px[i] - this.x0) / C)));
      const iz = Math.min(N - 1, Math.max(0, Math.floor((t.pz[i] - this.z0) / C)));
      const c = iz * N + ix;
      // Um einen Tunnel liegt Fels (siehe World.clearance): dort erst weiter draußen frei.
      tdist[c] = Math.min(tdist[c], -t.wh[i] - (t.edge[i] & EDGE_TUNNEL ? 12 : 0));
    }
    {
      const D = C * Math.SQRT2;
      for (let iz = 0; iz < N; iz++) {
        for (let ix = 0; ix < N; ix++) {
          const k = iz * N + ix;
          let d = tdist[k];
          if (ix > 0) d = Math.min(d, tdist[k - 1] + C);
          if (iz > 0) {
            d = Math.min(d, tdist[k - N] + C);
            if (ix > 0) d = Math.min(d, tdist[k - N - 1] + D);
            if (ix < N - 1) d = Math.min(d, tdist[k - N + 1] + D);
          }
          tdist[k] = d;
        }
      }
      for (let iz = N - 1; iz >= 0; iz--) {
        for (let ix = N - 1; ix >= 0; ix--) {
          const k = iz * N + ix;
          let d = tdist[k];
          if (ix < N - 1) d = Math.min(d, tdist[k + 1] + C);
          if (iz < N - 1) {
            d = Math.min(d, tdist[k + N] + C);
            if (ix < N - 1) d = Math.min(d, tdist[k + N + 1] + D);
            if (ix > 0) d = Math.min(d, tdist[k + N - 1] + D);
          }
          tdist[k] = d;
        }
      }
    }
    return tdist;
  }

  /** Abstand zur Bande an (x, z) aus dem Raster; außerhalb: weit weg. */
  bandeAt(x: number, z: number): number {
    const ix = Math.floor((x - this.x0) / this.cell);
    const iz = Math.floor((z - this.z0) / this.cell);
    if (ix < 0 || iz < 0 || ix >= this.n || iz >= this.n) return 1e9;
    return this.bande[iz * this.n + ix];
  }

  mark(minX: number, maxX: number, minZ: number, maxZ: number, y: number): void {
    const a = Math.max(0, Math.floor((minX - this.x0) / this.cell));
    const b = Math.min(this.n - 1, Math.floor((maxX - this.x0) / this.cell));
    const c = Math.max(0, Math.floor((minZ - this.z0) / this.cell));
    const d = Math.min(this.n - 1, Math.floor((maxZ - this.z0) / this.cell));
    for (let iz = c; iz <= d; iz++) {
      for (let ix = a; ix <= b; ix++) {
        const k = iz * this.n + ix;
        if (y > this.top[k]) this.top[k] = y;
      }
    }
  }

  /** Höchster Punkt im Quadrat mit Halbweite r um (x, z); außerhalb des Rasters frei. */
  maxIn(x: number, z: number, r: number): number {
    return this.maxRect(x - r, x + r, z - r, z + r);
  }

  /** Höchster Punkt im achsenparallelen Rechteck; außerhalb des Rasters frei. */
  maxRect(minX: number, maxX: number, minZ: number, maxZ: number): number {
    const a = Math.max(0, Math.floor((minX - this.x0) / this.cell));
    const b = Math.min(this.n - 1, Math.floor((maxX - this.x0) / this.cell));
    const c = Math.max(0, Math.floor((minZ - this.z0) / this.cell));
    const d = Math.min(this.n - 1, Math.floor((maxZ - this.z0) / this.cell));
    let best = -Infinity;
    for (let iz = c; iz <= d; iz++) {
      for (let ix = a; ix <= b; ix++) {
        const y = this.top[iz * this.n + ix];
        if (y > best) best = y;
      }
    }
    return best;
  }
}

// --- Bausteine -------------------------------------------------------------------

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Balken von a nach c mit quadratischem Querschnitt (für Abspannseile, Streben). */
function stab(b: MeshBuilder, a: V3, c: V3, dick: number, color: RGB): void {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const dz = c[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const g = new THREE.BoxGeometry(dick, len, dick);
  tmpQ.setFromUnitVectors(UP, tmpV.set(dx / len, dy / len, dz / len));
  tmpM.compose(tmpS.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), tmpQ, new THREE.Vector3(1, 1, 1));
  b.add(g, color, tmpM);
  g.dispose();
}

/** Bewegtes Instanzen-Netz samt Kontur, die dieselben Matrizen nutzt. */
function instanced(
  group: THREE.Group,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  count: number,
  outline: number,
): { mesh: THREE.InstancedMesh; ol: THREE.InstancedMesh | null } {
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(mesh);
  let ol: THREE.InstancedMesh | null = null;
  if (outline > 0) {
    addSmoothNormals(geo);
    ol = new THREE.InstancedMesh(geo, outlineMaterial(outline), count);
    ol.instanceMatrix = mesh.instanceMatrix;
    ol.frustumCulled = false;
    ol.name = 'outline';
    group.add(ol);
  }
  return { mesh, ol };
}

// --- Werkshof --------------------------------------------------------------------

export function buildWerkshofLife(world: World): Life {
  const t = world.track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const rnd = seeded(4400 + t.index * 31);
  const detail = world.detail;
  const lines = detail > 0; // Konturen an großen Teilen
  const fine = detail === 2; // Konturen auch an Kleinteilen
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);
  const cx = world.center.x;
  const cz = world.center.z;
  const bel = new Belegung(world, 3, 320);

  // --- Gleisbogen um das Gelände -------------------------------------------------
  // Je Richtung von der Mitte aus: hinter dem äußersten Streckenpunkt so weit
  // hinaus, bis der Platz frei ist und genug Abstand zur Bande bleibt. Danach
  // geglättet, damit der Zug in weiten Bögen fährt.
  const NA = 120;
  const rTrack = new Float32Array(NA);
  for (let i = 0; i < t.total; i += 2) {
    const dx = t.px[i] - cx;
    const dz = t.pz[i] - cz;
    const b = Math.round(((Math.atan2(dz, dx) / (Math.PI * 2)) * NA + NA) % NA);
    const d = Math.hypot(dx, dz) + t.wh[i];
    for (let k = -2; k <= 2; k++) {
      const j = (b + k + NA) % NA;
      if (d > rTrack[j]) rTrack[j] = d;
    }
  }
  const railOk = (x: number, z: number): boolean => bel.bandeAt(x, z) >= 25 && bel.maxIn(x, z, 4.5) === -Infinity;
  const need = new Float32Array(NA);
  for (let i = 0; i < NA; i++) {
    const a = (i / NA) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    let r = rTrack[i] + 18;
    const rMax = rTrack[i] + 240;
    while (r < rMax && !railOk(cx + ca * r, cz + sa * r)) r += 2;
    need[i] = r;
  }
  const rr = Float32Array.from(need);
  for (let iter = 0; iter < 40; iter++) {
    for (let pass = 0; pass < 24; pass++) {
      const prev = Float32Array.from(rr);
      for (let i = 0; i < NA; i++) {
        let s = 0;
        for (let k = -3; k <= 3; k++) s += prev[(i + k + NA) % NA];
        rr[i] = Math.max(need[i], s / 7);
      }
    }
    // Zwischen den Stützstellen nachprüfen; wo es eng wird, weiter hinaus.
    let changed = false;
    for (let i = 0; i < NA; i++) {
      const j = (i + 1) % NA;
      for (let f = 0; f <= 1; f += 0.25) {
        const a = ((i + f) / NA) * Math.PI * 2;
        const r = rr[i] + (rr[j] - rr[i]) * f;
        if (!railOk(cx + Math.cos(a) * r, cz + Math.sin(a) * r)) {
          need[i] += 3;
          need[j] += 3;
          changed = true;
          break;
        }
      }
    }
    if (!changed) break;
  }
  const ctrl: THREE.Vector3[] = [];
  for (let i = 0; i < NA; i += 2) {
    const a = (i / NA) * Math.PI * 2;
    ctrl.push(new THREE.Vector3(cx + Math.cos(a) * rr[i], 0, cz + Math.sin(a) * rr[i]));
  }
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  const STEP = 2;
  const RN = Math.max(60, Math.round(curve.getLength() / STEP));
  const pts = curve.getSpacedPoints(RN);
  const railLen = curve.getLength();
  const rx = new Float32Array(RN);
  const rz = new Float32Array(RN);
  const ryRaw = new Float32Array(RN);
  const ry = new Float32Array(RN);
  for (let k = 0; k < RN; k++) {
    rx[k] = pts[k].x;
    rz[k] = pts[k].z;
    ryRaw[k] = world.heightAt(rx[k], rz[k]);
  }
  // Bahndamm: Höhe weich über 30 m gemittelt, mindestens aber so hoch wie der Boden.
  for (let k = 0; k < RN; k++) {
    let s = 0;
    for (let q = -7; q <= 7; q++) s += ryRaw[(k + q + RN) % RN];
    ry[k] = Math.max(s / 15, ryRaw[k]) + 0.45;
  }
  for (let k = 0; k < RN; k++) bel.mark(rx[k] - 3, rx[k] + 3, rz[k] - 3, rz[k] + 3, ry[k] + 4);

  {
    const b = new MeshBuilder();
    const gravel = rgb(0x8d7f73);
    const gravelD = shade(gravel, 0.78);
    const steel = rgb(0xd8d4dc);
    const sleeper = rgb(0x5a4436);
    // Stützpunkte je Gleisstück: 8 m, bei sehr langem Ring länger – höchstens 150 Stücke.
    const SEG = Math.max(4, Math.ceil(RN / 150));
    const at = (k: number, lat: number, dy: number): V3 => {
      const i = k % RN;
      const j = (i + 1) % RN;
      const dx = rx[j] - rx[(i - 1 + RN) % RN];
      const dz = rz[j] - rz[(i - 1 + RN) % RN];
      const l = Math.hypot(dx, dz) || 1;
      return [rx[i] - (dz / l) * lat, ry[i] + dy, rz[i] + (dx / l) * lat];
    };
    for (let k = 0; k < RN; k += SEG) {
      const k2 = Math.min(k + SEG, RN);
      // Schotterbett mit schrägen Flanken
      b.quad(at(k, -2, 0), at(k2, -2, 0), at(k2, 2, 0), at(k, 2, 0), (k / SEG) % 2 === 0 ? gravel : shade(gravel, 0.94));
      b.quad(at(k, -3.4, -0.9), at(k2, -3.4, -0.9), at(k2, -2, 0), at(k, -2, 0), gravelD);
      b.quad(at(k, 2, 0), at(k2, 2, 0), at(k2, 3.4, -0.9), at(k, 3.4, -0.9), gravelD);
      // Schwellen als dunkle Bänder, darauf zwei Schienen
      b.quad(at(k, -1.25, 0.04), at(k + 1, -1.25, 0.04), at(k + 1, 1.25, 0.04), at(k, 1.25, 0.04), sleeper);
      for (const l of [-0.75, 0.75]) b.quad(at(k, l - 0.09, 0.2), at(k2, l - 0.09, 0.2), at(k2, l + 0.09, 0.2), at(k, l + 0.09, 0.2), steel);
    }
    // Die Fläche zeigt nach oben, wenn sie im Uhrzeigersinn um die Mitte läuft; sonst umdrehen.
    const geo = b.build();
    const p = geo.getAttribute('position');
    const n = geo.getAttribute('normal');
    if (n.getY(0) < 0) {
      for (let i = 0; i < p.count; i += 3) {
        for (const attr of [p, geo.getAttribute('color')]) {
          const x = attr.getX(i + 1);
          const y = attr.getY(i + 1);
          const z = attr.getZ(i + 1);
          attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2));
          attr.setXYZ(i + 2, x, y, z);
        }
      }
      geo.computeVertexNormals();
    }
    const rails = new THREE.Mesh(geo, toon);
    group.add(rails);
    disposables.push(geo);
  }

  // --- Turmdrehkräne -------------------------------------------------------------
  const MAST = 30;
  const JIB = 20;
  const JIB_Y = MAST + 2;
  const ROPE = 11;
  interface Kran {
    x: number;
    y: number;
    z: number;
    phase: number;
    speed: number;
    base: number;
  }
  const kraene: Kran[] = [];
  {
    const want = detail === 0 ? 2 : 3;
    for (let tries = 0; kraene.length < want && tries < 600; tries++) {
      const i = Math.floor(rnd() * t.total);
      const sgn = rnd() < 0.5 ? -1 : 1;
      const lat = sgn * (t.wh[i] + 32 + rnd() * 45);
      const x = t.px[i] + rightX(t, i) * lat;
      const z = t.pz[i] + rightZ(t, i) * lat;
      // Mast mindestens 30 m hinter der Bande: der Ausleger (20 m) reicht nie über die Fahrbahn.
      if (world.clearance(x, z) < 30 + (tries > 400 ? 0 : 2)) continue;
      if (bel.maxIn(x, z, 5) !== -Infinity) continue;
      const y = world.heightAt(x, z);
      // Unter dem Schwenkkreis darf nichts so hoch stehen, dass die Last hindurchstreift.
      if (bel.maxIn(x, z, JIB + 3) > y + (tries > 300 ? 15 : 12)) continue;
      if (kraene.some((k) => Math.hypot(k.x - x, k.z - z) < 85)) continue;
      // Ausleger zeigt anfangs von der Strecke weg.
      const away = Math.atan2(-(rightZ(t, i) * sgn), rightX(t, i) * sgn);
      kraene.push({ x, y, z, phase: rnd() * 100, speed: 0.6 + rnd() * 0.5, base: away });
      bel.mark(x - 3, x + 3, z - 3, z + 3, y + MAST + 6);
    }
  }
  const yel = rgb(0xffc72e);
  const yelD = rgb(0xe0a21c);
  const dark = rgb(0x2f2c39);
  const concrete = rgb(0x9a958f);
  let kranMesh: ReturnType<typeof instanced> | null = null;
  let lastMesh: ReturnType<typeof instanced> | null = null;
  if (kraene.length > 0) {
    const b = new MeshBuilder();
    b.box(0, 0.6, 0, 4.4, 1.2, 4.4, concrete);
    for (let k = 0; k < 6; k++) b.box(0, 1.2 + k * 5 + 2.5, 0, 1.8, 5, 1.8, k % 2 === 0 ? yel : yelD);
    // Drehkranz und Führerhaus
    b.box(0, MAST + 0.6, 0, 2.6, 1.2, 2.6, dark);
    b.box(1.4, MAST - 0.6, 1.2, 2, 1.8, 1.6, rgb(0xf7f2e4));
    b.box(2.42, MAST - 0.4, 1.2, 0.06, 0.8, 1.4, rgb(0x6fd0e6));
    // Turmspitze, Ausleger, Gegenausleger mit Ballast
    stab(b, [0, MAST + 1.2, 0], [0, MAST + 8, 0], 0.7, yel);
    b.box(JIB / 2, JIB_Y, 0, JIB, 1.1, 1.3, yel);
    b.box(-4.5, JIB_Y - 0.1, 0, 9, 0.8, 1.6, yel);
    b.box(-8, JIB_Y - 1.3, 0, 2, 2.8, 2.2, concrete);
    stab(b, [0, MAST + 8, 0], [JIB - 1, JIB_Y + 0.5, 0], 0.18, dark);
    stab(b, [0, MAST + 8, 0], [-8, JIB_Y + 0.4, 0], 0.18, dark);
    const geo = b.build();
    kranMesh = instanced(group, geo, toon, kraene.length, lines ? 0.05 : 0);
    disposables.push(geo, kranMesh.mesh);

    // Katze, Seil, Haken und Last (Stahlträger-Bündel oder Container) – pendeln um die Katze.
    const lb = new MeshBuilder();
    lb.box(0, -0.75, 0, 1.6, 0.6, 1.4, dark);
    lb.box(0, -1.05 - ROPE / 2, 0, 0.12, ROPE, 0.12, dark);
    lb.box(0, -1.4 - ROPE, 0, 0.7, 0.7, 0.5, rgb(0xff5a4e));
    stab(lb, [0, -1.75 - ROPE, 0], [-2.4, -3.4 - ROPE, 0], 0.08, dark);
    stab(lb, [0, -1.75 - ROPE, 0], [2.4, -3.4 - ROPE, 0], 0.08, dark);
    lb.box(0, -4.6 - ROPE, 0, 6, 2.4, 2.4, [1, 1, 1]);
    const lgeo = lb.build();
    lastMesh = instanced(group, lgeo, toon, kraene.length, fine ? 0.05 : 0);
    const loads = [0x1fc8b6, 0xff5a4e, 0x4f7bd8, 0xff9a3c];
    const col = new THREE.Color();
    // Nur die Last bekommt die Farbe: Seil und Katze sind dunkel genug, dass sie mitgetönt nicht auffallen.
    for (let k = 0; k < kraene.length; k++) lastMesh.mesh.setColorAt(k, col.set(loads[k % loads.length]));
    disposables.push(lgeo, lastMesh.mesh);
  }

  // --- Güterzug ------------------------------------------------------------------
  const WAGEN = detail === 0 ? 8 : 12;
  const WL = 13; // Abstand der Wagen
  const TEMPO = 10.5;
  let zug: ReturnType<typeof instanced>;
  let lok: THREE.Mesh;
  {
    const b = new MeshBuilder();
    const under = rgb(0x3a3640);
    // Längs entlang +x; Fahrgestell, Drehgestelle, Aufbau (wird je Wagen eingefärbt)
    b.box(0, 1.25, 0, 12, 0.6, 2.7, under);
    for (const x of [-4.2, 4.2]) b.box(x, 0.55, 0, 2.6, 0.9, 2.3, rgb(0x24212b));
    b.box(0, 2.95, 0, 11.6, 2.8, 2.55, [1, 1, 1], 0, shade([1, 1, 1], 0.82));
    for (let k = -2; k <= 2; k++) b.box(k * 2.2, 2.95, 0, 0.14, 2.6, 2.64, [0.82, 0.82, 0.86]);
    const geo = b.build();
    zug = instanced(group, geo, toon, WAGEN - 1, lines ? 0.05 : 0);
    const paint = [0xff5a4e, 0x1fc8b6, 0xffd23f, 0x4f7bd8, 0xf2efe6, 0xff9a3c];
    const col = new THREE.Color();
    for (let k = 0; k < WAGEN - 1; k++) zug.mesh.setColorAt(k, col.set(paint[Math.floor(rnd() * paint.length)]));
    disposables.push(geo, zug.mesh);

    // Diesellok: langer Vorbau, Führerhaus, kurze Nase mit Warnstreifen.
    const lb = new MeshBuilder();
    const green = rgb(0x2f7a50);
    const greenD = rgb(0x235c3d);
    lb.box(0, 1.25, 0, 14.6, 0.6, 2.8, under);
    for (const x of [-4.6, 4.6]) lb.box(x, 0.55, 0, 3, 0.9, 2.3, rgb(0x24212b));
    lb.box(-1.6, 2.75, 0, 9.6, 2.4, 2.2, green, 0, greenD);
    for (let k = 0; k < 4; k++) lb.box(-5.4 + k * 2.4, 2.9, 0, 0.5, 1.4, 2.26, greenD);
    lb.box(4.5, 3.15, 0, 3.2, 3.2, 2.7, green);
    lb.box(4.5, 3.85, 0, 3.26, 0.8, 2.76, rgb(0x9fe3f2));
    lb.box(4.5, 4.85, 0, 3.5, 0.25, 2.95, rgb(0x2a2733));
    lb.box(6.75, 2.4, 0, 1.4, 1.7, 2.2, green, 0, greenD);
    for (let k = 0; k < 4; k++) lb.box(7.47, 1.25, -1.05 + k * 0.7, 0.1, 0.58, 0.35, k % 2 === 0 ? rgb(0xffd23f) : rgb(0x2a2733));
    lb.box(-4, 4.2, 0, 0.6, 0.6, 0.6, rgb(0x2a2733));
    const lgeo = lb.build();
    lok = new THREE.Mesh(lgeo, toon);
    lok.matrixAutoUpdate = false;
    lok.frustumCulled = false;
    group.add(lok);
    if (lines) {
      addSmoothNormals(lgeo);
      const ol = new THREE.Mesh(lgeo, outlineMaterial(0.05));
      ol.name = 'outline';
      ol.matrixAutoUpdate = false;
      ol.frustumCulled = false;
      lok.add(ol);
    }
    disposables.push(lgeo);
  }

  // --- Schornsteine und Hallen der Kulisse finden ---------------------------------
  // Hohe, schlanke Requisiten rauchen; große, flache Requisiten sind Hallen.
  const schlote: number[] = []; // x, y, z
  const hallen: { fx: number; fy: number; fz: number; nx: number; nz: number; rx: number; ry: number; rz: number }[] = [];
  {
    const im = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    kulisse(world)?.traverse((m) => {
      if (!(m instanceof THREE.InstancedMesh) || m.name === 'outline') return;
      const g = m.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox!;
      const w = bb.max.x - bb.min.x;
      const d = bb.max.z - bb.min.z;
      const h = bb.max.y - bb.min.y;
      if (h > 25 && w < 6 && d < 6) {
        for (let k = 0; k < m.count; k++) {
          m.getMatrixAt(k, im);
          p.set(0, bb.max.y, 0).applyMatrix4(im);
          schlote.push(p.x, p.y, p.z);
        }
      } else if (w > 20 && d > 12 && h < 20 && h > 6) {
        for (let k = 0; k < m.count; k++) {
          m.getMatrixAt(k, im);
          // Geschweißt wird vor der Längsseite, die der Strecke näher liegt.
          const front = new THREE.Vector3(bb.min.x * 0.45, 1.1, bb.max.z + 0.5).applyMatrix4(im);
          const back = new THREE.Vector3(bb.min.x * 0.45, 1.1, -(bb.max.z + 0.5)).applyMatrix4(im);
          const useFront = world.clearance(front.x, front.z) <= world.clearance(back.x, back.z);
          const f = useFront ? front : back;
          n.set(0, 0, useFront ? 1 : -1).transformDirection(im);
          const roof = new THREE.Vector3(bb.max.x * 0.4, bb.max.y + 0.5, 0).applyMatrix4(im);
          hallen.push({ fx: f.x, fy: world.heightAt(f.x, f.z) + 1.1, fz: f.z, nx: n.x, nz: n.z, rx: roof.x, ry: roof.y, rz: roof.z });
        }
      }
    });
    // Am nächsten zur Strecke zuerst – dort sieht man es.
    hallen.sort((a, b2) => world.clearance(a.fx, a.fz) - world.clearance(b2.fx, b2.fz));
    hallen.length = Math.min(hallen.length, detail === 0 ? 1 : 2);
  }

  // --- Leuchten: Warnlampen, Lok-Scheinwerfer, Schweißlicht ------------------------
  // Reihenfolge der Instanzen: je Kran Spitze + Auslegerende, je Schlot eine
  // Lampe, die Lok (Scheinwerfer, Rundumleuchte), je Halle das Schweißlicht.
  const nSchlot = schlote.length / 3;
  const iKran = 0;
  const iSchlot = kraene.length * 2;
  const iLok = iSchlot + nSchlot;
  const iHalle = iLok + 2;
  const nGlow = iHalle + hallen.length;
  const glowGeo = new THREE.IcosahedronGeometry(0.5, 0);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const glow = new THREE.InstancedMesh(glowGeo, glowMat, nGlow);
  glow.frustumCulled = false;
  glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  {
    const col = new THREE.Color();
    for (let k = 0; k < nGlow; k++) {
      let c = 0xff3b30;
      if (k === iLok) c = 0xfff3b0;
      else if (k === iLok + 1) c = 0xff9a1f;
      else if (k >= iHalle) c = 0xcff6ff;
      glow.setColorAt(k, col.set(c));
    }
  }
  group.add(glow);
  disposables.push(glowGeo, glowMat, glow);

  // --- Pro Bild ------------------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s1 = new THREE.Vector3(1, 1, 1);

  const setGlow = (k: number, x: number, y: number, z: number, size: number): void => {
    // Aus = auf null geschrumpft (am selben Ort).
    const z0 = Math.max(0, size);
    m4.makeScale(z0, z0, z0);
    m4.setPosition(x, y, z);
    glow.setMatrixAt(k, m4);
  };

  /** Lage auf dem Gleis bei Bogenlänge d (Meter); schreibt x, y, z in v. */
  const railAt = (d: number): void => {
    const f = ((((d / railLen) * RN) % RN) + RN) % RN;
    const i = Math.floor(f);
    const j = (i + 1) % RN;
    const k = f - i;
    v.set(rx[i] + (rx[j] - rx[i]) * k, ry[i] + (ry[j] - ry[i]) * k, rz[i] + (rz[j] - rz[i]) * k);
  };
  const front = new THREE.Vector3();
  const rear = new THREE.Vector3();

  // Teilchen-Takt je Quelle
  const smokeT = new Float32Array(nSchlot).map(() => rnd());
  const smokeEvery = detail === 0 ? 0.8 : 0.5;
  let lokT = 0;
  let weldT = 0;
  const steamT = hallen.map(() => rnd() * 4);
  const windX = 2.2;
  const windZ = 0.9;
  const smokeCols = [0xd9cfc6, 0xbdb1aa, 0xe8ded3];

  return {
    group,
    update(time: number, dt: number, _cam: THREE.Vector3, fx: FxSink): void {
      // Kräne: langsames Schwenken mit Pausen, Katze fährt, Last pendelt nach.
      for (let k = 0; k < kraene.length; k++) {
        const c = kraene[k];
        const u = time * 0.05 * c.speed + c.phase;
        // Schwenkwinkel: ruhige Fahrt hin und her, dazwischen Stillstand (smoothstep der Sägezahnphase).
        const cyc = u - Math.floor(u);
        const ramp = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
        const sm = Math.min(1, Math.max(0, ramp * 1.6 - 0.3));
        const yaw = c.base + (sm * sm * (3 - 2 * sm) - 0.5) * 2.4;
        const yawRate = Math.cos(cyc * Math.PI * 2) * 0.1;
        q.setFromAxisAngle(UP, yaw);
        m4.compose(v.set(c.x, c.y, c.z), q, s1);
        kranMesh!.mesh.setMatrixAt(k, m4);
        const r = 10 + Math.sin(time * 0.11 * c.speed + c.phase * 2) * 6;
        const cs = Math.cos(yaw);
        const sn = Math.sin(yaw);
        const tx = c.x + cs * r;
        const tz = c.z - sn * r;
        // Pendeln: quer zum Ausleger aus der Drehbewegung, längs etwas leiser.
        e.set(Math.sin(time * 0.95 + c.phase) * (0.05 + Math.abs(yawRate) * 0.6), yaw, Math.sin(time * 0.77 + c.phase * 3) * 0.05, 'YXZ');
        q.setFromEuler(e);
        m4.compose(v.set(tx, c.y + JIB_Y - 0.55, tz), q, s1);
        lastMesh!.mesh.setMatrixAt(k, m4);
        const blink = Math.sin(time * 4 + k * 1.3) > 0 ? 1.4 : 0;
        setGlow(iKran + k * 2, c.x, c.y + MAST + 8.5, c.z, blink);
        setGlow(iKran + k * 2 + 1, c.x + cs * JIB, c.y + JIB_Y + 0.9, c.z - sn * JIB, blink);
      }
      if (kranMesh) kranMesh.mesh.instanceMatrix.needsUpdate = true;
      if (lastMesh) lastMesh.mesh.instanceMatrix.needsUpdate = true;

      // Zug: jeder Wagen sitzt mit beiden Drehgestellen auf dem Gleis.
      const head = time * TEMPO;
      for (let k = 0; k < WAGEN; k++) {
        const d = k === 0 ? head : head - 1 - k * WL;
        const bogie = k === 0 ? 4.6 : 4.2;
        railAt(d + bogie);
        front.copy(v);
        railAt(d - bogie);
        rear.copy(v);
        const dx = front.x - rear.x;
        const dz = front.z - rear.z;
        q.setFromAxisAngle(UP, Math.atan2(-dz, dx));
        m4.compose(v.addVectors(front, rear).multiplyScalar(0.5), q, s1);
        if (k > 0) zug.mesh.setMatrixAt(k - 1, m4);
        else lok.matrix.copy(m4);
        if (k === 0) {
          const l = Math.hypot(dx, dz) || 1;
          const ux = dx / l;
          const uz = dz / l;
          setGlow(iLok, v.x + ux * 7.5, v.y + 2.5, v.z + uz * 7.5, 1.2);
          setGlow(iLok + 1, v.x + ux * 4.3, v.y + 5.2, v.z + uz * 4.3, Math.sin(time * 9) > 0.2 ? 1.1 : 0.5);
          lokT += dt;
          if (lokT > 0.5) {
            lokT = 0;
            fx.puff(v.x - ux * 4, v.y + 4.6, v.z - uz * 4, -ux * TEMPO * 0.8 + windX, 3, -uz * TEMPO * 0.8 + windZ, 3.2, 1.8, 0x8f8790, 1.4, -2.5);
          }
        }
      }
      zug.mesh.instanceMatrix.needsUpdate = true;

      // Schornsteine: dicke Comic-Bällchen, die steigen, wachsen und mit dem Wind ziehen.
      for (let k = 0; k < nSchlot; k++) {
        const x = schlote[k * 3];
        const y = schlote[k * 3 + 1];
        const z = schlote[k * 3 + 2];
        setGlow(iSchlot + k, x, y + 0.6, z, Math.sin(time * 2.2 + k) > 0.3 ? 1.1 : 0);
        smokeT[k] += dt;
        if (smokeT[k] > smokeEvery) {
          smokeT[k] = 0;
          const j = (k * 7 + Math.floor(time * 2.3)) % 3;
          const w = Math.sin(time * 0.7 + k) + Math.sin(time * 1.9 + k * 3) * 0.5;
          fx.puff(x + w * 0.5, y + 1.4, z, windX * 4.5 + w * 3, 1.2 + j * 0.4, windZ * 4.5 + w * 1.5, 7.5, 3 + j * 0.7, smokeCols[j], 1.1 + j * 0.25, -2.1);
        }
      }

      // Hallen: Schweißen in Schüben (Funkenregen und flackerndes Licht), ab und zu ein Dampfstoß übers Dach.
      weldT += dt;
      for (let k = 0; k < hallen.length; k++) {
        const h = hallen[k];
        const on = Math.sin(time * 0.9 + k * 2.1) > -0.1;
        const flick = on && Math.sin(time * 37 + k * 5) + Math.sin(time * 23) > -0.4;
        setGlow(iHalle + k, h.fx + h.nx * 0.2, h.fy + 0.3, h.fz + h.nz * 0.2, flick ? 1.1 + Math.sin(time * 51) * 0.3 : 0);
        if (on && weldT > 0.09) {
          for (let n = 0; n < 2; n++) {
            const a = (n - 0.5) * 2.4 + Math.sin(time * 13 + n) * 0.8;
            fx.spark(h.fx, h.fy + 0.3, h.fz, h.nx * 3 + -h.nz * a, 2.5 + Math.abs(a), h.nz * 3 + h.nx * a, 0.7, 0.9, n === 0 ? 0xffe27a : 0xfff7d6, 11);
          }
        }
        steamT[k] += dt;
        if (steamT[k] > 4.6) {
          steamT[k] = 0;
          for (let n = 0; n < 3; n++) fx.puff(h.rx + n * 0.8, h.ry + n * 0.9, h.rz, windX * 0.8, 6 + n * 2, windZ * 0.8, 2.6, 2.6, 0xfbf6ee, 2.2, -6);
        }
      }
      if (weldT > 0.09) weldT = 0;
      glow.instanceMatrix.needsUpdate = true;
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}

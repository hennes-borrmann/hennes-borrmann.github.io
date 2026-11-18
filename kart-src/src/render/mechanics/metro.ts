// Neonhochbahn: Darstellung der U-Bahn (game/mechanics.ts: MetroPlan, track.ts: Track.metro) – Züge, Gleisgraben,
// Tunnelmünder, Signal und Lichtschranke an der Einfahrt zur Abkürzung über das Zugdach.
//
// Lesbarkeit geht vor: Von der Gabelung aus soll man sehen, ob ein Zug im Bahnhof steht (helles Dach mit gelben Kanten
// und Mittellinie: das ist eine Fahrbahn), ob das Tor offen ist (Signal grün, die rote Lichtschranke ist weg) oder
// bald schließt (gelb, blinkt immer schneller). Ohne Zug klafft der Graben: dunkel, unten nur die leuchtende Magnetschiene.
//
// Zeichentechnik: alle Wagen in zwei Instanz-Netzen (Körper beleuchtet, Leuchtflächen unbeleuchtet, dazu die Kontur nur
// mit detail), Graben und Bahnhof als stehendes Netz, Signal und Lichtschranke als kleine eigene Netze. Lage der Wagen
// allein aus der Rennzeit (vehiclePose) – wie die Physik. Kein eigener Shader, keine Lichtquelle.

import * as THREE from 'three';
import { GATE_WARN, planActive, planUntil } from '../../game/mechanics';
import { newVehiclePose, rightX, rightZ, vehiclePose, type Track } from '../../game/track';
import { MeshBuilder, textTexture, type RGB, type V3 } from '../build';
import type { MechanicView } from '../mechanics';
import { outlineMaterial, rgb, toonMaterial } from '../toon';

const BODY = rgb(0x262c5c);
const BODY_LOW = rgb(0x1a1e40);
const ROOF = rgb(0xc9d0e6);
const ROOF_SEAM = rgb(0x8f97b8);
const YELLOW = rgb(0xffd23f);
const CYAN = rgb(0x5ff3ff);
const PINK = rgb(0xff3fae);
const WINDOW = rgb(0x8fe8ff);
const WINDOW_WARM = rgb(0xffd9a0);
const BLACK = rgb(0x07070f);
const WALL = rgb(0x2b2f58);
const FLOOR = rgb(0x11132a);

export function buildMetro(t: Track, detail: boolean): MechanicView {
  const group = new THREE.Group();
  group.name = 'U-Bahn';
  const m = t.metro!;
  const disposables: { dispose(): void }[] = [];
  const cars = t.vehicles.filter((v) => v.plan);
  const spec = cars[0];
  const half = spec.half;
  const hw = spec.halfWidth;
  const roofH = spec.roofs![0][0];

  // --- Ein Wagen (x nach links, y nach oben, z nach vorn; Ursprung auf der Schiene) ---------
  const body = new MeshBuilder();
  const lit = new MeshBuilder();
  // Körper: über der Schiene schwebend, unten schmaler (Schürze), oben das Dach als Fahrbahn
  body.box(0, 0.75, 0, hw * 1.7, 0.7, half * 2 - 0.4, BODY_LOW);
  body.box(0, 1.45, 0, hw * 2, 1.1, half * 2 - 0.1, BODY);
  body.box(0, roofH - 0.05, 0, hw * 2 + 0.06, 0.1, half * 2 + 0.06, ROOF);
  // Übergang zum Nachbarwagen (Dach geschlossen: die Fahrbahn läuft durch)
  body.box(0, roofH - 0.05, half + 0.12, hw * 1.9, 0.1, 0.5, ROOF_SEAM);
  body.box(0, roofH - 0.05, -half - 0.12, hw * 1.9, 0.1, 0.5, ROOF_SEAM);
  // Fensterband links und rechts, Schwebespalt mit Leuchtstreifen, gelbe Bordkanten und Mittellinie auf dem Dach
  for (const s of [-1, 1]) {
    lit.box(s * (hw + 0.01), 1.55, 0, 0.04, 0.6, half * 2 - 1.4, s > 0 ? WINDOW : WINDOW_WARM);
    lit.box(s * (hw * 0.86), 0.33, 0, 0.05, 0.12, half * 2 - 0.6, CYAN);
    lit.box(s * (hw - 0.1), roofH + 0.012, 0, 0.18, 0.02, half * 2 - 0.2, YELLOW);
    lit.box(s * (hw + 0.02), 1.0, 0, 0.04, 0.08, half * 2 - 0.2, PINK);
  }
  for (let k = -2; k <= 2; k++) lit.box(0, roofH + 0.012, k * 2.4, 0.22, 0.02, 1.3, YELLOW);
  // Stirnseiten: Leuchten (jeder Wagen kann vorn oder hinten sein – die Linie hat nur eine Richtung, aber gleiche Wagen
  // sind billiger: alle Stirnen bekommen ein schmales Lichtband)
  for (const s of [-1, 1]) lit.box(0, 1.2, s * (half - 0.04), hw * 1.4, 0.16, 0.06, s > 0 ? rgb(0xfff4d8) : PINK);
  const bodyGeo = body.build();
  const litGeo = lit.build();
  const bodyMat = toonMaterial({ vertexColors: true });
  const litMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const count = cars.length * spec.cars;
  const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
  const litMesh = new THREE.InstancedMesh(litGeo, litMat, count);
  bodyMesh.frustumCulled = false;
  litMesh.frustumCulled = false;
  group.add(bodyMesh, litMesh);
  disposables.push(bodyGeo, litGeo, bodyMat, litMat);
  let outline: THREE.InstancedMesh | null = null;
  if (detail) {
    const hull = new THREE.BoxGeometry(hw * 2, roofH - 0.35, half * 2);
    hull.translate(0, 0.35 + (roofH - 0.35) / 2, 0);
    outline = new THREE.InstancedMesh(hull, outlineMaterial(0.06), count);
    outline.frustumCulled = false;
    outline.name = 'outline';
    group.add(outline);
    disposables.push(hull);
  }

  // --- Graben, Tunnelmünder, Bahnhof ------------------------------------------------------
  const solid = new MeshBuilder();
  const glow = new MeshBuilder();
  const n = m.n;
  /** Punkt der Linie bei s Metern, seitlich lat (rechts positiv), in Höhe y. */
  const L = (s: number, lat: number, y: number): V3 => {
    const i = Math.max(0, Math.min(n, Math.round(s)));
    return [m.x[i] - m.tz * lat, y, m.z[i] + m.tx * lat];
  };
  const road = t.py[m.first];
  const roadEnd = t.py[m.last];
  const roadAt = (s: number): number => road + ((roadEnd - road) * Math.max(0, Math.min(1, (s - m.s0) / (m.s1 - m.s0))));
  const W = hw + 0.45;
  const floor = road - roofH - 0.9;
  // Wände und Boden des Grabens (je 2 m ein Stück), mit gelb-schwarzer Bahnsteigkante oben
  for (let s = m.s0; s < m.s1 - 0.01; s += 2) {
    const e = Math.min(m.s1, s + 2);
    const y0 = roadAt(s);
    const y1 = roadAt(e);
    for (const sgn of [-1, 1]) {
      const a = L(s, sgn * W, y0 - 0.02);
      const b = L(e, sgn * W, y1 - 0.02);
      const c = L(e, sgn * W, floor);
      const d = L(s, sgn * W, floor);
      if (sgn < 0) solid.quad(d, c, b, a, WALL);
      else solid.quad(a, b, c, d, WALL);
      const k = Math.floor(s / 2) % 2 === 0 ? YELLOW : BLACK;
      const o = sgn * (W + 0.5);
      glow.quad(L(s, sgn * W, y0 + 0.02), L(s, o, y0 + 0.02), L(e, o, y1 + 0.02), L(e, sgn * W, y1 + 0.02), k);
    }
    solid.quad(L(s, -W, floor), L(s, W, floor), L(e, W, floor), L(e, -W, floor), FLOOR);
    // Magnetschiene: die leuchtende Linie, über der die Züge schweben
    glow.quad(L(s, -0.35, floor + 0.3), L(s, 0.35, floor + 0.3), L(e, 0.35, floor + 0.3), L(e, -0.35, floor + 0.3), CYAN);
    solid.box(...L((s + e) / 2, 0, floor + 0.14), 1.1, 0.28, e - s, BLACK, Math.atan2(m.tx, m.tz));
  }
  // Tunnelmünder an beiden Enden: dunkle Schächte unter der Fahrbahn, in denen die Züge auf- und abtauchen
  for (const [s, dir] of [
    [m.s0, -1],
    [m.s1, 1],
  ] as [number, number][]) {
    const y = roadAt(s) - 0.12;
    const far = s + dir * 14;
    const a = L(s, -W, y);
    const b = L(s, W, y);
    const c = L(far, W, y);
    const d = L(far, -W, y);
    const lo = (p: V3): V3 => [p[0], floor - 6, p[2]];
    // Decke, Seiten und Rückwand des Schachts – innen schwarz
    solid.quad(a, b, c, d, BLACK);
    solid.quad(b, lo(b), lo(c), c, BLACK);
    solid.quad(lo(a), a, d, lo(d), BLACK);
    solid.quad(lo(c), lo(d), d, c, BLACK);
    // Leuchtrahmen um die Öffnung
    const fy = floor;
    glow.quad(L(s, -W - 0.3, fy), L(s, -W, fy), L(s, -W, y), L(s, -W - 0.3, y), PINK);
    glow.quad(L(s, W, fy), L(s, W + 0.3, fy), L(s, W + 0.3, y), L(s, W, y), PINK);
  }
  // Bahnhofsschilder an der linken Hallenwand, in Fahrtrichtung lesbar
  const sign = textTexture('U  TURMPLATZ', { w: 512, h: 96, bg: '#14163a', fg: '#5ff3ff', border: '#ff3fae' });
  disposables.push(sign);
  const signMat = new THREE.MeshBasicMaterial({ map: sign, side: THREE.DoubleSide });
  disposables.push(signMat);
  const signGeo = new THREE.PlaneGeometry(4.4, 0.85);
  disposables.push(signGeo);
  for (const s of [m.s0 + 12, (m.s0 + m.s1) / 2, m.s1 - 12]) {
    const p = L(s, -(t.wh[m.first] + 0.6), roadAt(s) + 4.2);
    const mesh = new THREE.Mesh(signGeo, signMat);
    mesh.position.set(p[0], p[1], p[2]);
    // (zur Bahn hin gewandt, also lesbar von dort)
    mesh.rotation.y = Math.atan2(m.tx, m.tz) - Math.PI / 2;
    group.add(mesh);
  }
  const solidMat = toonMaterial({ vertexColors: true });
  solidMat.side = THREE.DoubleSide;
  const solidMesh = new THREE.Mesh(solid.build(), solidMat);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const glowMesh = new THREE.Mesh(glow.build(), glowMat);
  group.add(solidMesh, glowMesh);
  disposables.push(solidMesh.geometry, solidMat, glowMesh.geometry, glowMat);

  // --- Tor: Signal und Lichtschranke ----------------------------------------------------------
  const gate = t.gates.find((g) => t.branchOf[g.first] === m.branch) ?? null;
  let lamp: THREE.Mesh | null = null;
  let fence: THREE.Mesh | null = null;
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x3dff7a });
  const fenceMat = new THREE.MeshBasicMaterial({ color: 0xff2a4a, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  disposables.push(lampMat, fenceMat);
  if (gate) {
    const b = t.branches[m.branch];
    // Signalmast rechts neben der Mündung (außerhalb beider Fahrbahnen), Lampe in 5 m Höhe
    const g = b.first + Math.min(b.count - 1, gate.count + 2);
    const out = t.wh[g] + 1.4;
    const mx = t.px[g] + rightX(t, g) * out;
    const mz = t.pz[g] + rightZ(t, g) * out;
    const mast = new MeshBuilder();
    mast.box(mx, t.py[g] + 2.6, mz, 0.35, 5.2, 0.35, rgb(0x2a2d50));
    mast.box(mx, t.py[g] + 5.3, mz, 1.2, 1.6, 0.6, BLACK, Math.atan2(t.tx[g], t.tz[g]));
    const mastMat = toonMaterial({ vertexColors: true });
    const mastMesh = new THREE.Mesh(mast.build(), mastMat);
    group.add(mastMesh);
    disposables.push(mastMesh.geometry, mastMat);
    const lampGeo = new THREE.SphereGeometry(0.55, 12, 8);
    disposables.push(lampGeo);
    lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(mx - t.tx[g] * 0.35, t.py[g] + 5.3, mz - t.tz[g] * 0.35);
    group.add(lamp);
    // Lichtschranke: rote Stäbe dort, wo die Bande der Hauptstrecke durchläuft, solange das Tor zu ist
    const f = new MeshBuilder();
    const white: RGB = [1, 1, 1];
    for (let k = 0; k < gate.count; k += 2) {
      const bs = gate.first + k;
      const ms = t.twin[bs];
      if (ms < 0) continue;
      const side = (t.px[bs] - t.px[ms]) * rightX(t, ms) + (t.pz[bs] - t.pz[ms]) * rightZ(t, ms) >= 0 ? 1 : -1;
      const w = t.wh[ms] - 0.1;
      const x = t.px[ms] + rightX(t, ms) * w * side;
      const z = t.pz[ms] + rightZ(t, ms) * w * side;
      const y = t.py[ms] + w * side * t.bank[ms];
      for (const h of [0.35, 0.8, 1.25]) f.box(x, y + h, z, 0.12, 0.09, 2.1, white, Math.atan2(t.tx[ms], t.tz[ms]));
      f.box(x, y + 0.75, z, 0.18, 1.5, 0.18, white);
    }
    fence = new THREE.Mesh(f.build(), fenceMat);
    group.add(fence);
    disposables.push(fence.geometry);
  }

  const pose = newVehiclePose();
  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  const tmpCol = new THREE.Color();

  return {
    group,
    update(time) {
      let k = 0;
      for (const v of cars) {
        for (let car = 0; car < v.cars; car++, k++) {
          vehiclePose(t, v, car, time, pose);
          if (pose.seg < 0) {
            mat.compose(pos.set(m.x[0], -500, m.z[0]), q.identity(), zero);
          } else {
            e.set(-Math.atan(pose.slope), pose.heading, 0);
            q.setFromEuler(e);
            mat.compose(pos.set(pose.x, pose.y, pose.z), q, one);
          }
          bodyMesh.setMatrixAt(k, mat);
          litMesh.setMatrixAt(k, mat);
          outline?.setMatrixAt(k, mat);
        }
      }
      bodyMesh.instanceMatrix.needsUpdate = true;
      litMesh.instanceMatrix.needsUpdate = true;
      if (outline) outline.instanceMatrix.needsUpdate = true;
      if (gate && lamp && fence) {
        const shut = planActive(gate.plan, time);
        const until = shut ? 0 : planUntil(gate.plan, time);
        let c = 0x3dff7a;
        if (shut) c = 0xff2a4a;
        else if (until < GATE_WARN * 0.6) {
          // Blinkt gelb, je näher das Schließen, desto schneller (Rennzeit: auf allen Bildschirmen gleich)
          const rate = 2 + 6 * (1 - until / (GATE_WARN * 0.6));
          c = Math.floor((time / 60) * rate * 2) % 2 === 0 ? 0xffd23f : 0x3a3000;
        }
        lampMat.color.copy(tmpCol.setHex(c));
        fence.visible = shut;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
      bodyMesh.dispose();
      litMesh.dispose();
      outline?.dispose();
    },
  };
}

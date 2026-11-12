// Bild des Gewitters auf dem Gewitterkamm (render/mechanics/storm.ts).
//
// Die Darstellung legt in group.userData.storm offen, welche Teile das letzte update() wo
// gezeichnet hat (Eckenbereiche in den je Bild geschriebenen Netzen). Geprüft werden die
// Ecken selbst, nicht nur die Buchführung:
//   (a) Zielkreis/Leitblitz bzw. Vorglühen genau während der Vorwarnung, Blitz bzw. Ladefeld genau
//       während pulseCycle < on – Stichproben in jedem Zustand und kurz vor/nach jedem Wechsel.
//   (b) Der Zielkreis liegt um (p.x, p.z) auf Fahrbahnhöhe (±5 cm) mit Radius p.radius (±10 %); das
//       Ladefeld deckt die Fahrbahn von −wh bis +wh und von 6 m vor bis 6 m hinter dem Mast (±0,5 m) und
//       liegt auf Fahrbahnhöhe; der Mast steht außerhalb der Bande.
//   (c) Licht der Welt: Himmels- und Sonnenlicht und die Sichtweite des Dunsts wachsen mit stormLight und
//       stehen nach dispose exakt auf den Ausgangswerten.
//   (d) Zeitsprünge: 100 s, 3 s, 100 s – der zweite Zustand bei 100 s gleicht dem ersten.
//   (e) Leitpfosten links und rechts jeder Fahrbahn, keiner auf der Fahrbahn, keiner in Tunnel/Stollen.
//   (f) Keine Ecke im Unendlichen; die Datei nutzt keinen eigenen Shader, keine Textur, keine Lichtquelle.
// Über das Aussehen auf einem Gerät sagt der Test nichts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PULSE_BOLT, PULSE_ROD, pulseCycle, stormLight, type Pulse } from '../../src/game/mechanics';
import { EDGE_FREE_L, EDGE_FREE_R, EDGE_GAP, EDGE_RAMP, EDGE_TUNNEL, getTrack, groundAt, projectOnTrack, rightX, rightZ } from '../../src/game/track';
import type { FxSink } from '../../src/render/fxApi';
import {
  PART_BLITZ,
  PART_FELD,
  PART_GLIMM,
  PART_LADUNG,
  PART_VOR,
  PART_ZIEL,
  PART_ZIEL_LICHT,
  buildStorm,
  type StormPart,
  type StormProbe,
} from '../../src/render/mechanics/storm';
import type { World } from '../../src/render/world';

const KAMM = 11;
const t = getTrack(KAMM);
const fx: FxSink = { spark() {}, puff() {} };

/** Schlanker Ersatz für die Welt: nur, was storm.ts anfasst (wie im Thema „gewitter“). */
function fakeWorld(): World {
  return {
    fog: new THREE.Fog(0x0a0f1c, 22, 135),
    hemi: new THREE.HemisphereLight(0x55668f, 0x1a1f33, 0.7),
    sun: new THREE.DirectionalLight(0x9db4e8, 0.55),
    background: new THREE.Color(0x1c2740),
  } as unknown as World;
}

function build(detail = true) {
  const world = fakeWorld();
  const view = buildStorm(t, detail, world);
  const probe = view.group.userData.storm as StormProbe;
  return { world, view, probe };
}

const bolts = t.pulses.map((p, i) => ({ p, i })).filter((e) => e.p.kind === PULSE_BOLT);
const rods = t.pulses.map((p, i) => ({ p, i })).filter((e) => e.p.kind === PULSE_ROD);

/** Rennzeit (Ticks), zu der der Puls im Zyklus bei c steht (einige Zyklen nach dem Start). */
const at = (p: Pulse, c: number, cycles = 3): number => c - p.phase + cycles * p.period;
/** Kamera nahe bei einer Stelle (etwas davor und darüber). */
const camAt = (p: Pulse): THREE.Vector3 => new THREE.Vector3(p.x - t.tx[p.seg] * 25, p.y + 4, p.z - t.tz[p.seg] * 25);

function partsOf(probe: StormProbe, pulse: number, kind: number): StormPart[] {
  const out: StormPart[] = [];
  for (let i = 0; i < probe.count; i++) {
    const pt = probe.parts[i];
    if (pt.pulse === pulse && pt.kind === kind) out.push(pt);
  }
  return out;
}
function kindsOf(probe: StormProbe, pulse: number): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < probe.count; i++) if (probe.parts[i].pulse === pulse) s.add(probe.parts[i].kind);
  return s;
}
/** Ecken eines Teils: [x, y, z] je Ecke. */
function verts(pt: StormPart): number[][] {
  const a = pt.mesh.geometry.getAttribute('position').array as Float32Array;
  const out: number[][] = [];
  for (let v = pt.a; v < pt.b; v++) out.push([a[v * 3], a[v * 3 + 1], a[v * 3 + 2]]);
  return out;
}
/** Höhe der Fahrbahn unter (x, z) – so, wie die Physik sie rechnet. */
function roadY(x: number, z: number, hint: number): number {
  const p = projectOnTrack(t, x, z, hint);
  return groundAt(t, p.seg, p.along, p.lat);
}

describe('Gewitterkamm: Bild des Gewitters', () => {
  it('es gibt neun Blitze und sechs Blitzableiter', () => {
    expect(bolts.length).toBe(9);
    expect(rods.length).toBe(6);
  });

  it.each([true, false])('(a) Vorwarnung, Einschlag und Ladung sind genau dann zu sehen, wenn die Physik es sagt (Zierde: %s)', (detail) => {
    const { view, probe } = build(detail);
    let checked = 0;
    for (const { p, i } of [...bolts, ...rods]) {
      const ws = p.period - p.warn;
      // Stichproben: ruhig, kurz vor/nach jedem Wechsel, mitten in jedem Zustand.
      const cs = [p.on + 70, (p.on + ws) / 2, ws - 0.5, ws, ws + 0.4, ws + 45, p.period - 0.4, p.period - 0.01, 0, 0.3, p.on / 2, p.on - 0.4, p.on, p.on + 0.4];
      for (const c of cs) {
        const time = at(p, c);
        const cyc = pulseCycle(p, time);
        const warn = cyc >= ws;
        const active = cyc < p.on;
        view.update(time, time / 60, 1 / 60, camAt(p), fx);
        const k = kindsOf(probe, i);
        if (p.kind === PULSE_BOLT) {
          expect(k.has(PART_ZIEL), `Zielkreis ${p.seg} bei Zyklus ${cyc}`).toBe(warn);
          expect(k.has(PART_ZIEL_LICHT), `Leitblitz ${p.seg} bei Zyklus ${cyc}`).toBe(warn);
          expect(k.has(PART_BLITZ), `Blitz ${p.seg} bei Zyklus ${cyc}`).toBe(active);
          if (k.has(PART_GLIMM)) expect(active || warn, `Nachglühen ${p.seg} bei Zyklus ${cyc}`).toBe(false);
        } else {
          expect(k.has(PART_VOR), `Vorglühen ${p.seg} bei Zyklus ${cyc}`).toBe(warn);
          expect(k.has(PART_FELD), `Ladefeld ${p.seg} bei Zyklus ${cyc}`).toBe(active);
          expect(k.has(PART_LADUNG), `Ladung ${p.seg} bei Zyklus ${cyc}`).toBe(active);
        }
        checked++;
      }
    }
    expect(checked).toBe(15 * 14);
    view.dispose();
  });

  it('(b) der Zielkreis liegt auf der Fahrbahn, mit dem Radius des Treffers', () => {
    const { view, probe } = build();
    for (const { p, i } of bolts) {
      for (const w of [0.02, 0.5, 0.99]) {
        const time = at(p, p.period - p.warn + w * p.warn);
        view.update(time, time / 60, 1 / 60, camAt(p), fx);
        const parts = partsOf(probe, i, PART_ZIEL);
        expect(parts.length).toBeGreaterThan(0);
        let rMax = 0;
        let rMin = Infinity;
        for (const pt of parts) {
          for (const [x, y, z] of verts(pt)) {
            const r = Math.hypot(x - p.x, z - p.z);
            rMax = Math.max(rMax, r);
            rMin = Math.min(rMin, r);
            const g = roadY(x, z, p.seg);
            if (Math.abs(y - g) > 0.05) throw new Error(`Zielkreis ${p.seg}: Ecke ${y.toFixed(3)} über Fahrbahn ${g.toFixed(3)}`);
          }
        }
        expect(rMax, `Radius ${p.seg}`).toBeGreaterThanOrEqual(p.radius * 0.9);
        expect(rMax, `Radius ${p.seg}`).toBeLessThanOrEqual(p.radius * 1.1);
        // Kurz vor dem Einschlag hat sich der Kreis bis zur Mitte zugezogen.
        if (w > 0.9) expect(rMin).toBeLessThan(0.5);
      }
    }
    view.dispose();
  });

  it('(b) das Ladefeld deckt die ganze Fahrbahn zwischen den Schienen und liegt auf ihr; der Mast steht hinter der Bande', () => {
    const { view, probe } = build();
    rods.forEach(({ p, i }, n) => {
      // Mast: genau an der Stelle der Physik, außerhalb der Bande.
      const mx = probe.masts[n * 3];
      const mz = probe.masts[n * 3 + 2];
      expect(Math.hypot(mx - p.x, mz - p.z)).toBeLessThan(1e-3);
      const mLat = (mx - t.px[p.seg]) * rightX(t, p.seg) + (mz - t.pz[p.seg]) * rightZ(t, p.seg);
      expect(Math.abs(mLat)).toBeGreaterThan(t.wh[p.seg] + 0.5);
      for (const c of [0, 20, p.on - 1]) {
        const time = at(p, c);
        view.update(time, time / 60, 1 / 60, camAt(p), fx);
        const parts = partsOf(probe, i, PART_FELD);
        expect(parts.length).toBe(1);
        const v = verts(parts[0]);
        const wh = t.wh[p.seg];
        let aMin = Infinity;
        let aMax = -Infinity;
        let lMin = Infinity;
        let lMax = -Infinity;
        for (const [x, y, z] of v) {
          const dx = x - p.x;
          const dz = z - p.z;
          const along = dx * t.tx[p.seg] + dz * t.tz[p.seg];
          // seitlich, gemessen von der Fahrbahnmitte (der Mast steht bei p.lat)
          const lat = dx * rightX(t, p.seg) + dz * rightZ(t, p.seg) + p.lat;
          aMin = Math.min(aMin, along);
          aMax = Math.max(aMax, along);
          lMin = Math.min(lMin, lat);
          lMax = Math.max(lMax, lat);
          const g = roadY(x, z, p.seg);
          if (Math.abs(y - g) > 0.05) throw new Error(`Ladefeld ${p.seg}: Ecke ${y.toFixed(3)} über Fahrbahn ${g.toFixed(3)}`);
        }
        expect(aMin).toBeGreaterThanOrEqual(-6.5);
        expect(aMin).toBeLessThanOrEqual(-5.5);
        expect(aMax).toBeLessThanOrEqual(6.5);
        expect(aMax).toBeGreaterThanOrEqual(5.5);
        expect(lMin).toBeGreaterThanOrEqual(-wh - 0.5);
        expect(lMin).toBeLessThanOrEqual(-wh + 0.5);
        expect(lMax).toBeLessThanOrEqual(wh + 0.5);
        expect(lMax).toBeGreaterThanOrEqual(wh - 0.5);
        // lückenlos: jeder Punkt im Feld liegt (im Grundriss) in einem seiner Dreiecke
        for (let a = -5.5; a <= 5.5; a += 0.5) {
          for (let l = -wh + 0.2; l <= wh - 0.2; l += 0.6) {
            const lat = l - p.lat;
            const x = p.x + t.tx[p.seg] * a + rightX(t, p.seg) * lat;
            const z = p.z + t.tz[p.seg] * a + rightZ(t, p.seg) * lat;
            if (!covered(v, x, z)) throw new Error(`Ladefeld ${p.seg}: Lücke bei ${a} m, seitlich ${l.toFixed(1)} m`);
          }
        }
      }
    });
    view.dispose();
  });

  it('(c) Licht und Dunst wachsen mit stormLight und stehen nach dispose wieder auf den Ausgangswerten', () => {
    const { world, view } = build();
    const start = { color: world.fog.color.getHex(), near: world.fog.near, far: world.fog.far, hemi: world.hemi.intensity, sun: world.sun.intensity, bg: world.background.getHex() };
    const cam = camAt(t.pulses[0]);
    const rows: { k: number; hemi: number; sun: number; far: number }[] = [];
    for (let time = 0; time <= 3600; time += 1.5) {
      view.update(time, time / 60, 1 / 60, cam, fx);
      rows.push({ k: stormLight(t.pulses, t.flashes, time), hemi: world.hemi.intensity, sun: world.sun.intensity, far: world.fog.far });
    }
    rows.sort((a, b) => a.k - b.k);
    expect(rows[0].k).toBe(0);
    expect(rows[rows.length - 1].k).toBeGreaterThan(0.7);
    for (let i = 1; i < rows.length; i++) {
      for (const f of ['hemi', 'sun', 'far'] as const) {
        if (rows[i][f] < rows[i - 1][f] - 1e-9) throw new Error(`${f} fällt bei stormLight ${rows[i - 1].k} → ${rows[i].k}`);
      }
    }
    // Finster ist es bei 0 wie im Thema; beim Wetterleuchten deutlich heller und weiter.
    const dark = rows[0];
    const lit = rows[rows.length - 1];
    expect(dark.hemi).toBeCloseTo(start.hemi, 9);
    expect(dark.far).toBeCloseTo(start.far, 9);
    expect(lit.hemi).toBeGreaterThan(dark.hemi * 2);
    expect(lit.far).toBeGreaterThan(dark.far * 5);
    view.dispose();
    expect(world.fog.color.getHex()).toBe(start.color);
    expect(world.fog.near).toBe(start.near);
    expect(world.fog.far).toBe(start.far);
    expect(world.hemi.intensity).toBe(start.hemi);
    expect(world.sun.intensity).toBe(start.sun);
    expect(world.background.getHex()).toBe(start.bg);
  });

  it('(d) Zeitsprünge: 100 s, 3 s, 100 s – der zweite Zustand bei 100 s gleicht dem ersten', () => {
    for (const camPulse of [bolts[3].p, rods[2].p, bolts[0].p]) {
      const { world, view, probe } = build();
      const cam = camAt(camPulse);
      const snap = (time: number) => {
        view.update(time, time / 60, 1 / 60, cam, fx);
        const meshes = view.group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
        return {
          parts: probe.parts.slice(0, probe.count).map((p) => [p.kind, p.pulse, p.a, p.b, p.mesh.name]),
          visible: view.group.children.map((c) => c.visible),
          geo: meshes.map((m) => {
            const a = m.geometry.getAttribute('position').array as Float32Array;
            const n = Math.min(a.length, m.geometry.drawRange.count === Infinity ? a.length : m.geometry.drawRange.count * 3);
            return Array.from(a.slice(0, n));
          }),
          light: [world.hemi.intensity, world.sun.intensity, world.fog.far, world.fog.color.getHex()],
        };
      };
      // Zu jeder dieser Zeiten passiert in der Nähe der Kamera etwas.
      for (const T of [6000, 6000 + 41, 6000 + 133]) {
        const a = snap(T);
        expect(a.parts.length).toBeGreaterThan(0);
        snap(180);
        const b = snap(T);
        expect(b).toEqual(a);
      }
      view.dispose();
    }
  });

  it('(e) Leitpfosten: links und rechts jeder Fahrbahn, keiner auf der Fahrbahn, keiner in Tunnel oder Stollen', () => {
    const { view, probe } = build();
    const posts = probe.posts;
    const n = posts.length / 5;
    // je Weg (Hauptstrecke, Galerie) und Seite: Anzahl und Länge, auf der Pfosten stehen dürfen
    const roads = [{ from: 0, count: t.n }, ...t.branches.map((b) => ({ from: b.first, count: b.count }))];
    for (const r of roads) {
      for (const sgn of [-1, 1]) {
        let count = 0;
        for (let k = 0; k < n; k++) {
          const seg = posts[k * 5 + 3];
          if (seg >= r.from && seg < r.from + r.count && Math.sign(posts[k * 5 + 4]) === sgn) count++;
        }
        let open = 0;
        for (let i = r.from; i < r.from + r.count; i++) {
          if (t.edge[i] & (EDGE_TUNNEL | EDGE_GAP | EDGE_RAMP | (sgn < 0 ? EDGE_FREE_L : EDGE_FREE_R))) continue;
          open++;
        }
        expect(count, `Weg ab ${r.from}, Seite ${sgn}`).toBeGreaterThanOrEqual(Math.floor((open * t.step) / 12));
        // auf der Hauptstrecke sogar mehr als die ganze Rundenlänge / 12
        if (r.from === 0) expect(count).toBeGreaterThanOrEqual(Math.floor(t.length / 12));
      }
    }
    for (let k = 0; k < n; k++) {
      const [x, y, z, seg, lat] = [posts[k * 5], posts[k * 5 + 1], posts[k * 5 + 2], posts[k * 5 + 3], posts[k * 5 + 4]];
      expect(Math.abs(lat)).toBeGreaterThanOrEqual(t.wh[seg]);
      expect(t.edge[seg] & EDGE_TUNNEL).toBe(0);
      // tatsächlich dort: Abstand zur Mitte des eigenen Abschnitts
      const dl = (x - t.px[seg]) * rightX(t, seg) + (z - t.pz[seg]) * rightZ(t, seg);
      expect(Math.abs(dl - lat)).toBeLessThan(1e-3);
      // und nicht im Tunnel eines anderen Wegs, der hier vorbeiführt
      const p = projectOnTrack(t, x, z, seg);
      if (Math.abs(p.lat) < t.wh[p.seg]) throw new Error(`Pfosten ${k} steht auf der Fahrbahn von Abschnitt ${p.seg}`);
      expect(t.edge[p.seg] & EDGE_TUNNEL, `Pfosten ${k} bei Abschnitt ${p.seg}`).toBe(0);
      expect(Number.isFinite(y)).toBe(true);
    }
    // Die Reflektoren sind genau diese Pfosten (eine Instanz je Pfosten).
    const refl = view.group.getObjectByName('leitpfosten') as THREE.InstancedMesh;
    expect(refl.count).toBe(n);
    view.update(0, 0, 1 / 60, camAt(t.pulses[0]), fx);
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      refl.getMatrixAt(k, m);
      pos.setFromMatrixPosition(m);
      expect(pos.distanceTo(new THREE.Vector3(posts[k * 5], posts[k * 5 + 1], posts[k * 5 + 2]))).toBeLessThan(1e-3);
    }
    view.dispose();
  });

  it.each([true, false])('(f) keine Ecke im Unendlichen (Zierde: %s)', (detail) => {
    const { view } = build(detail);
    const check = () => {
      view.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const a = o.geometry.getAttribute('position').array as Float32Array;
        const n = o.geometry.drawRange.count === Infinity ? a.length : Math.min(a.length, o.geometry.drawRange.count * 3);
        for (let i = 0; i < n; i++) if (!Number.isFinite(a[i])) throw new Error(`${o.name}: Ecke ${i} nicht endlich`);
        if (o instanceof THREE.InstancedMesh) {
          const m = o.instanceMatrix.array;
          for (let i = 0; i < o.count * 16; i++) if (!Number.isFinite(m[i])) throw new Error(`${o.name}: Instanz nicht endlich`);
        }
      });
    };
    check();
    for (const { p } of [...bolts, ...rods]) {
      for (const c of [p.period - 30, 3, 40]) {
        const time = at(p, c);
        view.update(time, time / 60, 1 / 60, camAt(p), fx);
        check();
      }
    }
    // ohne Zierde keine Konturen
    if (!detail) expect(view.group.getObjectByName('outline')).toBeUndefined();
    view.dispose();
  });

  it('(f) kein eigener Shader, keine Textur, keine Lichtquelle', () => {
    const src = readFileSync(join(import.meta.dirname, '../../src/render/mechanics/storm.ts'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');
    for (const bad of [/ShaderMaterial/, /onBeforeCompile/, /Texture/, /\bmap\s*:/, /PointLight/, /SpotLight/, /RectAreaLight/, /new THREE\.\w*Light\(/, /gl_Position|gl_FragColor/]) {
      expect(src, String(bad)).not.toMatch(bad);
    }
    // und im Bau entsteht auch nichts davon
    const { view } = build();
    view.group.traverse((o) => {
      expect(o instanceof THREE.Light).toBe(false);
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          expect((mat as THREE.MeshBasicMaterial).map ?? null).toBeNull();
        }
      }
    });
    view.dispose();
  });
});

/** Liegt (x, z) im Grundriss in einem der Dreiecke (Ecken je drei hintereinander)? */
function covered(v: number[][], x: number, z: number): boolean {
  for (let i = 0; i + 2 < v.length; i += 3) {
    const [ax, , az] = v[i];
    const [bx, , bz] = v[i + 1];
    const [cx, , cz] = v[i + 2];
    const d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz);
    const d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz);
    const d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
    const neg = d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9;
    const pos = d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9;
    if (!(neg && pos)) return true;
  }
  return false;
}

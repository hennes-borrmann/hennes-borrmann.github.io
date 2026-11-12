// Bild der Züge und des Gleises im Wüstenexpress (Strecke 14).
//
// Die Züge sind Geometrie, deren Ecken je Bild neu gesetzt werden (render/mechanics/train.ts). Geprüft wird,
// was ein Fehler dabei sichtbar machen würde: Die Fahrfläche jedes Wagens muss genau dort liegen, wo die
// Physik das Dach hat (vehiclePose + roofTop) – sonst stünde ein Kart auf dem Bild sichtbar in oder über dem
// Wagen; das Bild muss eine reine Funktion der Rennzeit sein (Zeitsprünge); das Gleis muss auf der rechten
// Spur knapp über der Fahrbahn liegen; und die Grenzen für Dreiecke und Zeichenaufrufe gelten.
// Über das Aussehen auf einem echten Gerät sagt der Test nichts.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { roofTop } from '../../src/game/mechanics';
import { groundAt, newVehiclePose, rightX, rightZ, setTrack, TRACK, vehiclePose } from '../../src/game/track';
import type { FxSink } from '../../src/render/fxApi';
import { buildTrain, type ZugDach } from '../../src/render/mechanics/train';

const fx: FxSink = { spark() {}, puff() {} };
const cam = new THREE.Vector3(0, 50, 0);

function koerper(group: THREE.Group): Float32Array {
  return ((group.userData.zugKoerper as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
}

/** Alle beweglichen Ecken aller Netze der Züge (für Vergleiche bei Zeitsprüngen). */
function allePositionen(group: THREE.Group): number[] {
  const out: number[] = [];
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = o.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (p.usage !== THREE.DynamicDrawUsage) return;
    for (let i = 0; i < p.array.length; i++) out.push(p.array[i]);
    const n = (o.geometry.getAttribute('normal') ?? o.geometry.getAttribute('onormal')) as THREE.BufferAttribute | undefined;
    if (n) for (let i = 0; i < n.array.length; i++) out.push(n.array[i]);
  });
  return out;
}

function zaehle(group: THREE.Group): { calls: number; tris: number } {
  let calls = 0;
  let tris = 0;
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.visible) return;
    calls++;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  return { calls, tris };
}

describe('Wüstenexpress: Bild der Züge', () => {
  it('die Fahrfläche jedes Wagens liegt genau auf dem Dach der Physik', () => {
    setTrack(14);
    const t = TRACK;
    const view = buildTrain(t, true);
    const daecher = view.group.userData.zugDaecher as ZugDach[];
    expect(daecher.length).toBe(28);
    const pos = koerper(view.group);
    const pose = newVehiclePose();
    let schlimmsteLage = 0;
    let schlimmsteHoehe = 0;
    for (const time of [-200, 0, 317, 1234, 5000, 20000]) {
      view.update(time, time / 60, 1 / 60, cam, fx);
      for (const d of daecher) {
        const p = vehiclePose(t, d.v, d.car, time, pose);
        const hx = Math.sin(p.heading);
        const hz = Math.cos(p.heading);
        // Soll: Mitte ± half in Fahrtrichtung, ± halfWidth nach rechts (rechts = (−hz, hx))
        const soll = (du: number, dw: number): [number, number] => [p.x + du * hx - dw * hz, p.z + du * hz + dw * hx];
        const ecken: [number, number, number][] = [
          [d.ecken[0], -d.v.half, d.v.halfWidth],
          [d.ecken[1], -d.v.half, -d.v.halfWidth],
          [d.ecken[2], d.v.half, d.v.halfWidth],
          [d.ecken[3], d.v.half, -d.v.halfWidth],
          [d.mitte[0], 0, d.v.halfWidth],
          [d.mitte[1], 0, -d.v.halfWidth],
        ];
        for (const [i, du, dw] of ecken) {
          const [sx, sz] = soll(du, dw);
          const lage = Math.hypot(pos[i * 3] - sx, pos[i * 3 + 2] - sz);
          const hoehe = Math.abs(pos[i * 3 + 1] - (p.y + roofTop(d.v, d.car, du) + p.slope * du));
          schlimmsteLage = Math.max(schlimmsteLage, lage);
          schlimmsteHoehe = Math.max(schlimmsteHoehe, hoehe);
          if (lage > 0.05) throw new Error(`Zug ${d.zug} Wagen ${d.car} bei ${time}: Ecke um ${lage.toFixed(3)} m verschoben`);
          if (hoehe > 0.03) throw new Error(`Zug ${d.zug} Wagen ${d.car} bei ${time}: Dach um ${hoehe.toFixed(3)} m daneben`);
        }
      }
    }
    expect(schlimmsteLage).toBeLessThan(0.05);
    expect(schlimmsteHoehe).toBeLessThan(0.03);
    view.dispose();
  });

  it('ist eine reine Funktion der Rennzeit (Sprünge vor und zurück)', () => {
    setTrack(14);
    const a = buildTrain(TRACK, true);
    a.update(20000, 1, 1 / 60, cam, fx);
    const erst = allePositionen(a.group);
    a.update(317, 2, 1 / 60, cam, fx);
    const zurueck = allePositionen(a.group);
    const frisch = buildTrain(TRACK, true);
    frisch.update(317, 0, 1 / 60, cam, fx);
    const soll = allePositionen(frisch.group);
    expect(zurueck.length).toBe(soll.length);
    let d = 0;
    for (let i = 0; i < soll.length; i++) d = Math.max(d, Math.abs(zurueck[i] - soll[i]));
    expect(d).toBeLessThan(1e-4);
    a.update(20000, 3, 1 / 60, cam, fx);
    const wieder = allePositionen(a.group);
    let e = 0;
    for (let i = 0; i < erst.length; i++) e = Math.max(e, Math.abs(wieder[i] - erst[i]));
    expect(e).toBeLessThan(1e-4);
    // Im Countdown fahren die Züge schon: bei −200 Ticks steht das Bild woanders als bei 0
    frisch.update(-200, 0, 1 / 60, cam, fx);
    const vorher = allePositionen(frisch.group);
    frisch.update(0, 0, 1 / 60, cam, fx);
    const los = allePositionen(frisch.group);
    let m = 0;
    for (let i = 0; i < los.length; i++) m = Math.max(m, Math.abs(los[i] - vorher[i]));
    expect(m).toBeGreaterThan(10);
    a.dispose();
    frisch.dispose();
  });

  it('das Gleis liegt rund um die Runde auf der rechten Spur, knapp über der Fahrbahn', () => {
    setTrack(14);
    const t = TRACK;
    const view = buildTrain(t, true);
    const g = view.group.userData.gleis as { mesh: THREE.Mesh; von: number; bis: number };
    const pos = g.mesh.geometry.getAttribute('position');
    expect(g.bis - g.von).toBeGreaterThan(1000);
    // Ecken nach Abschnitt sortieren (nächster Abschnitt der Mittellinie)
    const naechster = (x: number, z: number): number => {
      let best = 0;
      let bd = Infinity;
      for (let s = 0; s < t.n; s++) {
        const d = (x - t.px[s]) ** 2 + (z - t.pz[s]) ** 2;
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      return best;
    };
    const proben = new Map<number, number>();
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minH = Infinity;
    let maxH = -Infinity;
    for (let i = g.von; i < g.bis; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
      const s = naechster(x, z);
      const dx = x - t.px[s];
      const dz = z - t.pz[s];
      const along = dx * t.tx[s] + dz * t.tz[s];
      const lat = dx * rightX(t, s) + dz * rightZ(t, s);
      const h = y - groundAt(t, s, along, lat);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h);
      const bucket = Math.floor(s / 25);
      proben.set(bucket, (proben.get(bucket) ?? 0) + 1);
    }
    expect(minLat).toBeGreaterThanOrEqual(5.8);
    expect(maxLat).toBeLessThanOrEqual(7.6);
    expect(minH).toBeGreaterThanOrEqual(-0.005);
    expect(maxH).toBeLessThanOrEqual(0.06);
    // Stichproben alle 25 m rund um die Runde: überall liegt Gleis
    for (let b = 0; b < Math.floor(t.n / 25); b++) expect(proben.get(b) ?? 0).toBeGreaterThan(20);
    view.dispose();
  });

  for (const detail of [true, false]) {
    it(`bleibt in den Grenzen und kommt ohne Shader, Textur und Lichtquelle aus (detail = ${detail})`, () => {
      setTrack(14);
      const view = buildTrain(TRACK, detail);
      for (const time of [-200, 0, 317, 5000]) view.update(time, time / 60, 1 / 60, cam, fx);
      view.group.traverse((o) => {
        expect(o instanceof THREE.Light).toBe(false);
        if (!(o instanceof THREE.Mesh)) return;
        expect(o instanceof THREE.InstancedMesh).toBe(false);
        const m = o.material as THREE.Material & { map?: THREE.Texture | null };
        expect(m.map ?? null).toBeNull();
        expect(m.onBeforeCompile.toString()).toBe(new THREE.Material().onBeforeCompile.toString());
        // Erlaubt: Eckenfarben (Basic), Toon mit der gemeinsamen Schattierungsstufe, die gemeinsame Kontur
        if (m instanceof THREE.ShaderMaterial) expect(o.name).toBe('outline');
        const p = o.geometry.getAttribute('position');
        for (let i = 0; i < p.array.length; i++) if (!Number.isFinite(p.array[i])) throw new Error(`${o.name}: nicht endliche Koordinate`);
      });
      const { calls, tris } = zaehle(view.group);
      console.log(`detail=${detail}: ${calls} Zeichenaufrufe, ${tris} Dreiecke`);
      expect(calls).toBeLessThanOrEqual(detail ? 12 : 8);
      expect(tris).toBeLessThanOrEqual(detail ? 22000 : 11000);
      view.dispose();
    });
  }

  it('die Quelldatei nutzt keinen eigenen Shader, keine Textur, keine Lichtquelle', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(import.meta.dirname, '../../src/render/mechanics/train.ts'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n');
    expect(src).not.toMatch(/ShaderMaterial|onBeforeCompile|Texture|PointLight|SpotLight|DirectionalLight|AmbientLight|HemisphereLight|map:/);
  });
});

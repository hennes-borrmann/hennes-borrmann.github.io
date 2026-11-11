// Bild der Förderbänder im Werkshof.
//
// Das Muster der Bänder ist Geometrie, deren Ecken je Bild neu gesetzt werden
// (render/mechanics/machines.ts). Geprüft wird hier, was ein Fehler dabei sichtbar
// machen würde: Das Muster muss jedes Band zu jeder Zeit lückenlos und ohne
// Überstand bedecken – die Summe seiner Dreiecksflächen ist also immer genau die
// Fläche der Bänder – und keine Ecke darf außerhalb der Bänder oder im Unendlichen
// landen. Über das Aussehen auf einem echten Gerät sagt der Test nichts.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TRACK, rightX, rightZ, setTrack } from '../../src/game/track';
import { buildMachines } from '../../src/render/mechanics/machines';
import type { FxSink } from '../../src/render/fxApi';

const fx: FxSink = { spark() {}, puff() {} };

/** Das Netz des Musters: das einzige, dessen Ecken beweglich angelegt sind. */
function patternMesh(group: THREE.Group): THREE.Mesh {
  const found = group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && (c.geometry.getAttribute('position') as THREE.BufferAttribute).usage === THREE.DynamicDrawUsage);
  expect(found.length).toBe(1);
  return found[0];
}

/** Summe der Flächen aller Dreiecke, von oben gesehen (Bänder liegen nahezu waagrecht). */
function areaFromAbove(mesh: THREE.Mesh): number {
  const pos = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.index!;
  let sum = 0;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    // Vorzeichen: alle Dreiecke zeigen nach oben – ein verdrehtes würde abgezogen und fiele auf.
    sum += ((pos.getZ(b) - pos.getZ(a)) * (pos.getX(c) - pos.getX(a)) - (pos.getX(b) - pos.getX(a)) * (pos.getZ(c) - pos.getZ(a))) / 2;
  }
  return sum;
}

/** Fläche aller Förderbänder der Strecke, von oben gesehen, direkt aus der Streckenbeschreibung. */
function beltArea(): { area: number; box: THREE.Box3 } {
  const t = TRACK;
  const box = new THREE.Box3();
  let area = 0;
  for (const b of t.belts) {
    if (b.swim) continue;
    for (let i = 0; i < b.count; i++) {
      const s = b.first + i;
      const n = t.next[s];
      const corner = (seg: number, lat: number): [number, number] => [t.px[seg] + rightX(t, seg) * lat, t.pz[seg] + rightZ(t, seg) * lat];
      const q = [corner(s, b.lat0), corner(s, b.lat1), corner(n, b.lat1), corner(n, b.lat0)];
      // Viereck als zwei Dreiecke (Schuhband-Formel)
      let twice = 0;
      for (let k = 0; k < 4; k++) {
        const [x0, z0] = q[k];
        const [x1, z1] = q[(k + 1) % 4];
        twice += x0 * z1 - x1 * z0;
        box.expandByPoint(new THREE.Vector3(x0, t.py[s], z0));
      }
      area += Math.abs(twice) / 2;
    }
  }
  return { area, box };
}

describe('Werkshof: Bild der Förderbänder', () => {
  it('das wandernde Muster bedeckt die Bänder zu jeder Zeit genau – ohne Lücke, ohne Überstand', () => {
    setTrack(0);
    expect(TRACK.belts.filter((b) => !b.swim).length).toBeGreaterThan(0);
    const view = buildMachines(TRACK, true);
    const mesh = patternMesh(view.group);
    const { area, box } = beltArea();
    box.expandByScalar(0.05);
    box.min.y = -Infinity;
    box.max.y = Infinity;
    const pos = mesh.geometry.getAttribute('position');
    const p = new THREE.Vector3();
    // Kamera reihum an jedes Band, damit keines als "zu weit weg" stehen bleibt
    const cams = TRACK.belts.filter((b) => !b.swim).map((b) => new THREE.Vector3(TRACK.px[b.first], TRACK.py[b.first] + 3, TRACK.pz[b.first]));
    for (const seconds of [0, 0.004, 0.37, 1.9, 7.25, 12.345, 59.999, 600.01, 3599.5]) {
      for (const cam of cams) view.update(seconds * 60, seconds, 1 / 60, cam, fx);
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i);
        expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
        if (!box.containsPoint(p)) throw new Error(`Ecke ${i} liegt bei ${seconds} s außerhalb der Bänder: ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`);
      }
      // Die Bänder liegen fast eben; die Abbildung des Musters ist stückweise linear wie die Bandfläche selbst.
      expect(Math.abs(areaFromAbove(mesh) - area) / area).toBeLessThan(0.002);
    }
    view.dispose();
  });

  it('kommt ohne eigenen Shader, ohne Textur und ohne Instanzen aus', () => {
    setTrack(0);
    const view = buildMachines(TRACK, true);
    let meshes = 0;
    view.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      meshes++;
      expect(o instanceof THREE.InstancedMesh).toBe(false);
      const m = o.material as THREE.Material & { map?: THREE.Texture | null };
      // Erlaubt: Flächen mit Eckenfarbe, Toon-Körper (mit der gemeinsamen Schattierungsstufe) und die gemeinsame Kontur.
      expect(m.map ?? null).toBeNull();
      expect(m.onBeforeCompile.toString()).toBe(new THREE.Material().onBeforeCompile.toString());
      if (m instanceof THREE.ShaderMaterial) expect(o.name).toBe('outline');
    });
    expect(meshes).toBeGreaterThan(10);
    view.dispose();
  });
});

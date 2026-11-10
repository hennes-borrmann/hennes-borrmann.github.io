// Gemeinsame Bausteine für den Comic-Look: Farbstufen statt weicher Verläufe
// und eine Tuschekontur um alles, was Charakter haben soll.
//
// Kontur: jedes Objekt wird ein zweites Mal gezeichnet – nur die Rückseiten,
// ein Stück entlang der Flächennormalen aufgeblasen und in Tuschefarbe. Damit
// kantige Körper dabei nicht aufreißen, bekommen sie zusätzlich geglättete
// Normalen (Attribut "onormal").

import * as THREE from 'three';

/** Tuschefarbe der Konturen. */
export const INK = 0x16131c;

let gradient: THREE.DataTexture | null = null;

/** Drei Helligkeitsstufen: Schatten, Mittelton, Licht. */
function gradientMap(): THREE.DataTexture {
  if (!gradient) {
    const data = new Uint8Array([118, 118, 190, 190, 255, 255]);
    gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export interface ToonOptions {
  color?: number;
  vertexColors?: boolean;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}

export function toonMaterial(o: ToonOptions = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: o.color ?? 0xffffff,
    vertexColors: o.vertexColors ?? false,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
    gradientMap: gradientMap(),
  });
}

const OUTLINE_VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
attribute vec3 onormal;
uniform float thickness;
void main() {
  // "transformed"/"objectNormal" heißen so, damit die Skinning-Bausteine von
  // three.js greifen: die Kontur macht dann jede Knochenbewegung mit.
  vec3 transformed = position;
  vec3 objectNormal = onormal;
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  #ifdef USE_INSTANCING
    mat4 m = modelMatrix * instanceMatrix;
  #else
    mat4 m = modelMatrix;
  #endif
  vec4 world = m * vec4(transformed, 1.0);
  // Richtung aus der (bewegten) Normalen, Länge aus dem Attribut: onormal mit
  // Länge 1 ergibt die volle Dicke, kürzere Normalen eine dünnere Linie, 0 gar
  // keine. Ohne Schutz würde normalize() bei Länge 0 (auf null skalierte Teile)
  // NaN liefern.
  vec3 wn = mat3(m) * objectNormal;
  float wl = length(wn);
  wn = wl > 1e-6 ? wn * (length(onormal) / wl) : vec3(0.0);
  // Mit der Entfernung etwas dicker, damit die Linie auch hinten sichtbar bleibt.
  float d = distance(cameraPosition, world.xyz);
  world.xyz += wn * thickness * clamp(d * 0.055, 0.75, 3.5);
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const OUTLINE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 ink;
void main() {
  gl_FragColor = vec4(ink, 1.0);
  // Wie bei den eingebauten Materialien: erst in den Ausgabefarbraum, dann
  // Nebel. Ohne die Umrechnung käme die Tusche fast rein schwarz heraus.
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const outlineCache = new Map<string, THREE.ShaderMaterial>();

/** Material der Kontur; gleiche Dicke und Farbe teilen sich ein Material. */
export function outlineMaterial(thickness = 0.045, color = INK): THREE.ShaderMaterial {
  const key = `${thickness}:${color}`;
  let m = outlineCache.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { thickness: { value: thickness }, ink: { value: new THREE.Color(color) } },
      ]),
      vertexShader: OUTLINE_VERT,
      fragmentShader: OUTLINE_FRAG,
      side: THREE.BackSide,
      fog: true,
    });
    outlineCache.set(key, m);
  }
  return m;
}

/**
 * Ergänzt geglättete Normalen ("onormal"): alle Ecken am selben Ort bekommen
 * denselben Mittelwert. Nötig für Konturen an kantigen Körpern.
 */
export function addSmoothNormals(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const sums = new Map<string, [number, number, number]>();
  const keys: string[] = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    keys.push(key);
    const s = sums.get(key);
    if (s) {
      s[0] += nor.getX(i);
      s[1] += nor.getY(i);
      s[2] += nor.getZ(i);
    } else sums.set(key, [nor.getX(i), nor.getY(i), nor.getZ(i)]);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const s = sums.get(keys[i])!;
    const l = Math.hypot(s[0], s[1], s[2]) || 1;
    out[i * 3] = s[0] / l;
    out[i * 3 + 1] = s[1] / l;
    out[i * 3 + 2] = s[2] / l;
  }
  geo.setAttribute('onormal', new THREE.BufferAttribute(out, 3));
  return geo;
}

/**
 * Hängt einem Mesh seine Tuschekontur an (als Kind, damit sie alle Bewegungen
 * mitmacht) und gibt die Kontur zurück.
 */
export function withOutline(mesh: THREE.Mesh, thickness = 0.045, color = INK): THREE.Mesh {
  if (!mesh.geometry.getAttribute('onormal')) addSmoothNormals(mesh.geometry);
  const outline = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness, color));
  outline.name = 'outline';
  outline.matrixAutoUpdate = false;
  mesh.add(outline);
  return outline;
}

/**
 * Kontur für ein SkinnedMesh: hängt am selben Skelett und macht damit jede
 * Knochenbewegung mit. "geometry" darf eine abgespeckte Fassung sein (nur die
 * Teile, die eine Kontur bekommen sollen); sie braucht "onormal" – fehlt das
 * Attribut, wird es wie bei withOutline ergänzt.
 */
export function withSkinnedOutline(
  mesh: THREE.SkinnedMesh,
  geometry: THREE.BufferGeometry = mesh.geometry,
  thickness = 0.045,
  color = INK,
): THREE.SkinnedMesh {
  if (!geometry.getAttribute('onormal')) addSmoothNormals(geometry);
  const outline = new THREE.SkinnedMesh(geometry, outlineMaterial(thickness, color));
  outline.name = 'outline';
  outline.matrixAutoUpdate = false;
  mesh.add(outline);
  outline.bind(mesh.skeleton, mesh.bindMatrix);
  return outline;
}

/** Schaltet alle Konturen unterhalb von root ein oder aus (Qualitätsstufe). */
export function setOutlinesVisible(root: THREE.Object3D, visible: boolean): void {
  root.traverse((o) => {
    if (o.name === 'outline') o.visible = visible;
  });
}

/** Farbe als lineare RGB-Werte 0..1 – für Vertexfarben. */
export function rgb(hex: number): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

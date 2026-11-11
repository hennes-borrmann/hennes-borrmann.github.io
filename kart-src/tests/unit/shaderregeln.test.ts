// Regeln für eigene Shader.
//
// Auf einem iPad der 10. Generation (A14, Safari 26) ging die 3D-Grafik verloren, sobald
// der Werkshof mit seinem ersten Band-Shader gezeichnet wurde – einem Shader mit
// Uniform-Feld und Auswahlschleife. Welcher Teil davon der Auslöser war, ließ sich von
// außen nicht klären; seit beides entfernt ist, läuft das Gerät. Damit die Technik nicht
// unbemerkt zurückkommt, sucht dieser Test die Quelltexte der Darstellung danach ab.
// Er prüft Text, nicht Geräte: Über Safari sagt er nichts.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const root = join(import.meta.dirname, '../../src/render');
const sources = files(root).map((p) => ({ name: p.slice(root.length + 1), lines: readFileSync(p, 'utf8').split('\n') }));

function hits(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const f of sources) f.lines.forEach((l, i) => pattern.test(l) && !/^\s*(\/\/|\*)/.test(l) && found.push(`${f.name}:${i + 1}: ${l.trim().slice(0, 90)}`));
  return found;
}

describe('Eigene Shader', () => {
  it('die Suche findet überhaupt Shader', () => {
    expect(hits(/gl_Position|gl_FragColor/).length).toBeGreaterThan(5);
  });

  it('haben keine Schleifen', () => {
    // GLSL-Schleifen zählen über int oder float; TypeScript-Schleifen beginnen mit let oder const.
    expect(hits(/\b(for|while)\s*\(\s*(int|float|uint)\b/)).toEqual([]);
  });

  it('kommen in neuen Dateien nicht mehr hinzu', () => {
    // Auf dem iPad des Auftraggebers bestätigt ist nur, was der Werkshof zeichnet: Flächen mit
    // Eckenfarben, Toon-Körper mit Kontur, Instanzen, bewegte Ecken, Teilchen. Eigene Shader gibt es
    // nur noch dort, wo sie schon vor dieser Regel standen – neue Darstellung kommt ohne aus.
    const allowed = new Set(['toon.ts', 'world.ts', 'effects.ts', 'life/eis.ts', 'life/riff.ts', 'mechanics/dive.ts', 'mechanics/flight.ts', 'mechanics/tide.ts', 'mechanics/traffic.ts']);
    const withShader = new Set(hits(/\bShaderMaterial\b|\bonBeforeCompile\b|\bRawShaderMaterial\b/).map((h) => h.split(':')[0].replace(/\\/g, '/')));
    expect([...withShader].filter((f) => !allowed.has(f))).toEqual([]);
  });

  it('haben keine Uniform-Felder', () => {
    expect(hits(/\buniform\s+(lowp\s+|mediump\s+|highp\s+)?\w+\s+\w+\s*\[/)).toEqual([]);
  });
});

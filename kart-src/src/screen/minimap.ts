// Minikarte: der Streckenverlauf als Tuschelinie, darauf ein Punkt je Kart.
//
// Die Karte ist so gedreht wie die Welt von oben aussieht, wenn "vorwärts auf
// der Startgeraden" ungefähr nach oben zeigt – und nicht gespiegelt: wer rechts
// abbiegt, dessen Punkt wandert auch auf der Karte nach rechts.

import { EDGE_GAP, EDGE_GLIDE, type Track } from '../game/track';
import { playerColor } from '../util/players';

const INK = '#16131c';

/** Rechnet Streckenkoordinaten in ein Rechteck der Größe w × h um. */
export function mapTransform(t: Track, w: number, h: number, pad: number): (x: number, z: number) => [number, number] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < t.total; i++) {
    minX = Math.min(minX, t.px[i]);
    maxX = Math.max(maxX, t.px[i]);
    minZ = Math.min(minZ, t.pz[i]);
    maxZ = Math.max(maxZ, t.pz[i]);
  }
  const s = Math.min((w - 2 * pad) / (maxX - minX), (h - 2 * pad) / (maxZ - minZ));
  const ox = (w - (maxX - minX) * s) / 2;
  const oy = (h - (maxZ - minZ) * s) / 2;
  // +Z zeigt nach oben; +X nach links (in der 3D-Ansicht liegt +X links, wenn man nach +Z schaut).
  return (x, z) => [ox + (maxX - x) * s, oy + (maxZ - z) * s];
}

/** Streckenverlauf als SVG-Pfad (für die Streckenwahl). */
export function trackPath(t: Track, w: number, h: number, pad: number): string {
  const f = mapTransform(t, w, h, pad);
  let d = '';
  for (let i = 0; i < t.n; i += 3) {
    const [x, y] = f(t.px[i], t.pz[i]);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  d += 'Z';
  // Abzweigungen: von der Gabelung über die eigenen Abschnitte zur Einmündung
  for (const b of t.branches) {
    const [x0, y0] = f(t.px[b.from], t.pz[b.from]);
    d += `M${x0.toFixed(1)} ${y0.toFixed(1)}`;
    for (let k = 1; k < b.count; k += 3) {
      const [x, y] = f(t.px[b.first + k], t.pz[b.first + k]);
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const [x1, y1] = f(t.px[b.to], t.pz[b.to]);
    d += `L${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

export class Minimap {
  private readonly g: CanvasRenderingContext2D;
  private base: HTMLCanvasElement | null = null;
  private f: (x: number, z: number) => [number, number] = () => [0, 0];
  private track: Track | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.g = canvas.getContext('2d')!;
  }

  setTrack(t: Track): void {
    if (this.track === t) return;
    this.track = t;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.f = mapTransform(t, w, h, 26);
    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    const g = base.getContext('2d')!;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    // glide = false: die Fahrbahn (Lücken bleiben frei); glide = true: nur die Flugstrecken, gestrichelt.
    const stroke = (width: number, color: string, glide = false): void => {
      g.lineWidth = width;
      g.strokeStyle = color;
      g.setLineDash(glide ? [5, 13] : []);
      g.beginPath();
      let pen = false;
      const to = (k: number): void => {
        if (glide ? (t.edge[k] & EDGE_GLIDE) === 0 : (t.edge[k] & EDGE_GAP) !== 0) {
          pen = false;
          return;
        }
        const [x, y] = this.f(t.px[k], t.pz[k]);
        if (pen) g.lineTo(x, y);
        else g.moveTo(x, y);
        pen = true;
      };
      for (let i = 0; i <= t.n; i += 2) to(i % t.n);
      // Abzweigungen: von der Gabelung über die eigenen Abschnitte zur Einmündung
      for (const b of t.branches) {
        pen = false;
        to(b.from);
        for (let k = 1; k < b.count; k += 2) to(b.first + k);
        to(b.to);
      }
      g.stroke();
    };
    // Flugstrecken: gestrichelte Linie von der Absprungkante zur Landebahn
    stroke(9, INK, true);
    stroke(4, '#fff8e7', true);
    stroke(20, INK);
    stroke(11, '#fff8e7');
    g.setLineDash([]);
    // Startlinie
    const [sx, sy] = this.f(t.px[0], t.pz[0]);
    const [ax, ay] = this.f(t.px[0] - t.tz[0] * 12, t.pz[0] + t.tx[0] * 12);
    const [bx, by] = this.f(t.px[0] + t.tz[0] * 12, t.pz[0] - t.tx[0] * 12);
    g.lineWidth = 6;
    g.strokeStyle = INK;
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(sx, sy);
    g.lineTo(bx, by);
    g.stroke();
    this.base = base;
  }

  draw(karts: { x: number; z: number; slot: number }[], localSlot: number): void {
    if (!this.base) return;
    const g = this.g;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.base, 0, 0);
    // Das eigene Kart zuletzt, damit es obenauf liegt.
    for (let pass = 0; pass < 2; pass++) {
      for (const k of karts) {
        const me = k.slot === localSlot;
        if (me !== (pass === 1)) continue;
        const [x, y] = this.f(k.x, k.z);
        g.beginPath();
        g.arc(x, y, me ? 13 : 9, 0, Math.PI * 2);
        g.fillStyle = playerColor(k.slot);
        g.fill();
        g.lineWidth = me ? 5 : 4;
        g.strokeStyle = me ? '#ffffff' : INK;
        g.stroke();
        if (me) {
          g.lineWidth = 2.5;
          g.strokeStyle = INK;
          g.beginPath();
          g.arc(x, y, 16, 0, Math.PI * 2);
          g.stroke();
        }
      }
    }
  }
}

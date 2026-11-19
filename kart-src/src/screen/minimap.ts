// Minikarte: der Streckenverlauf als Tuschelinie, darauf ein Punkt je Kart –
// und je ein kleines Zeichen für alles, was sich über die Karte bewegt
// (Rollreifen, Brummkreisel, Bohrer, Raketen im Flug).
//
// Die Karte ist so gedreht wie die Welt von oben aussieht, wenn "vorwärts auf
// der Startgeraden" ungefähr nach oben zeigt – und nicht gespiegelt: wer rechts
// abbiegt, dessen Punkt wandert auch auf der Karte nach rechts.

import { ROCKET_MORPH_TICKS } from '../game/sim';
import { EDGE_GAP, EDGE_GLIDE, type Track } from '../game/track';
import { THING_DRILL, THING_TIRE, THING_TOP, type SnapshotThing } from '../net/protocol';
import { playerColor } from '../util/players';

const INK = '#16131c';
const PAPER = '#fff8e7';

/** Ein Kart, wie die Minikarte es braucht (Rakete: Ticks seit dem Zünden und Landepunkt). */
export interface MapKart {
  x: number;
  z: number;
  slot: number;
  rocket?: number;
  aimX?: number;
  aimZ?: number;
  vx?: number;
  vz?: number;
}

/**
 * Zeichen eines beweglichen Dings: Mitte (x, y) und Bewegungsrichtung dir (Radiant, 0 = nach rechts, im Bild gemessen;
 * NaN = steht), dazu das Ding selbst und die Uhr (Sekunden) für Blinken und Pulsieren.
 */
type ThingMark = (g: CanvasRenderingContext2D, x: number, y: number, dir: number, th: SnapshotThing, time: number) => void;

/** Rollreifen: dunkler Ring mit gelber Nabe. */
function markTire(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.beginPath();
  g.arc(x, y, 8.5, 0, Math.PI * 2);
  g.fillStyle = INK;
  g.fill();
  g.beginPath();
  g.arc(x, y, 5.4, 0, Math.PI * 2);
  g.lineWidth = 3.2;
  g.strokeStyle = '#9a94b4';
  g.stroke();
  g.beginPath();
  g.arc(x, y, 2.6, 0, Math.PI * 2);
  g.fillStyle = '#ffd23f';
  g.fill();
}

/** Brummkreisel: rot-gelber Kegel mit der Spitze nach unten; sucht er ein Kart, flackert ein gelber Kranz. */
function markTop(g: CanvasRenderingContext2D, x: number, y: number, _dir: number, th: SnapshotThing, time: number): void {
  if (th.target >= 0) {
    g.beginPath();
    g.arc(x, y, 13 + 2 * Math.sin(time * 18), 0, Math.PI * 2);
    g.lineWidth = 3;
    g.strokeStyle = '#ffe866';
    g.stroke();
  }
  g.beginPath();
  g.moveTo(x - 10, y - 6.5);
  g.lineTo(x + 10, y - 6.5);
  g.lineTo(x, y + 10.5);
  g.closePath();
  g.fillStyle = '#ff5a4e';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = '#ffd23f';
  g.fillRect(x - 6.5, y - 5, 13, 3.4);
}

/**
 * Bohrer: unter der Erde ein stählerner Bohrkopf, der in Fahrtrichtung zeigt, mit braunen Erdklumpen dahinter; steckt er
 * (Eindrehen) oder bricht er durch, ein brauner Erdstern mit Stahlkern – beim Durchbruch blinkend.
 */
function markDrill(g: CanvasRenderingContext2D, x: number, y: number, dir: number, th: SnapshotThing, time: number): void {
  if (dir !== dir || th.stage > 0) {
    const pulse = th.stage > 0 ? 1 + 0.25 * Math.sin(time * 30) : 1;
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = (i % 2 === 0 ? 13 : 7) * pulse;
      if (i === 0) g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = th.stage > 0 ? '#ff8a1c' : '#8a5a34';
    g.fill();
    g.lineWidth = 2.2;
    g.strokeStyle = INK;
    g.stroke();
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fillStyle = '#d3dbe6';
    g.fill();
    return;
  }
  const c = Math.cos(dir);
  const s = Math.sin(dir);
  // Erdklumpen hinter ihm (der Erdwall)
  g.fillStyle = '#8a5a34';
  g.strokeStyle = INK;
  g.lineWidth = 2.2;
  for (let i = 4; i >= 1; i--) {
    const r = 6 - i * 0.9;
    g.beginPath();
    g.arc(x - c * (7 + i * 7), y - s * (7 + i * 7), r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // Bohrkopf: Kegel mit der Spitze voraus, dunkle Spiralstreifen quer darüber, hinten das rote Motorgehäuse
  const P = (a: number, b: number): [number, number] => [x + c * a - s * b, y + s * a + c * b];
  g.beginPath();
  g.moveTo(...P(-12, 8));
  g.lineTo(...P(-6, 8));
  g.lineTo(...P(-6, -8));
  g.lineTo(...P(-12, -8));
  g.closePath();
  g.fillStyle = '#ff5a4e';
  g.fill();
  g.lineWidth = 2.6;
  g.stroke();
  g.beginPath();
  g.moveTo(...P(15, 0));
  g.lineTo(...P(-6, 8.5));
  g.lineTo(...P(-6, -8.5));
  g.closePath();
  g.fillStyle = '#d3dbe6';
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(...P(-2, 6.6));
  g.lineTo(...P(3, -5.2));
  g.moveTo(...P(5, 3.6));
  g.lineTo(...P(8.6, -2));
  g.lineWidth = 2.2;
  g.stroke();
}

/**
 * Zeichen je Art der Dinge – was hier fehlt (liegende Ölflecken, Rauchwolken), erscheint nicht auf der Karte.
 * Ein neues bewegliches Item kommt mit einer Zeile dazu.
 */
const THING_MARKS: Partial<Record<number, ThingMark>> = {
  [THING_TIRE]: markTire,
  [THING_TOP]: markTop,
  [THING_DRILL]: markDrill,
};

/** Rakete im Flug: in der Farbe ihres Karts, die Spitze in Flugrichtung, dazu gestrichelt der Weg zum Landepunkt (Fadenkreuz). */
function markRocket(g: CanvasRenderingContext2D, x: number, y: number, dir: number, color: string, ax: number, ay: number): void {
  g.setLineDash([4, 5]);
  g.lineWidth = 2;
  g.strokeStyle = INK;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(ax, ay);
  g.stroke();
  g.setLineDash([]);
  g.beginPath();
  g.arc(ax, ay, 6, 0, Math.PI * 2);
  g.moveTo(ax - 9, ay);
  g.lineTo(ax + 9, ay);
  g.moveTo(ax, ay - 9);
  g.lineTo(ax, ay + 9);
  g.lineWidth = 2.2;
  g.strokeStyle = '#ff5a4e';
  g.stroke();
  const c = Math.cos(dir);
  const s = Math.sin(dir);
  const P = (a: number, b: number): [number, number] => [x + c * a - s * b, y + s * a + c * b];
  // Flamme
  g.beginPath();
  g.moveTo(...P(-8, 3));
  g.lineTo(...P(-16, 0));
  g.lineTo(...P(-8, -3));
  g.closePath();
  g.fillStyle = '#ffb31f';
  g.fill();
  // Rumpf mit Flossen
  g.beginPath();
  g.moveTo(...P(13, 0));
  g.lineTo(...P(5, 5));
  g.lineTo(...P(-6, 5));
  g.lineTo(...P(-10, 9));
  g.lineTo(...P(-10, -9));
  g.lineTo(...P(-6, -5));
  g.lineTo(...P(5, -5));
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 2.6;
  g.strokeStyle = INK;
  g.stroke();
  g.beginPath();
  g.arc(...P(4, 0), 2.2, 0, Math.PI * 2);
  g.fillStyle = PAPER;
  g.fill();
}

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

  /** Richtung einer Bewegung (vx, vz) auf der Karte als Winkel – NaN, wenn es (fast) steht. */
  private dirOf(x: number, z: number, vx: number, vz: number): number {
    if (vx * vx + vz * vz < 1) return Number.NaN;
    const [ax, ay] = this.f(x, z);
    const [bx, by] = this.f(x + vx, z + vz);
    return Math.atan2(by - ay, bx - ax);
  }

  draw(karts: MapKart[], localSlot: number, things: SnapshotThing[] = []): void {
    if (!this.base) return;
    const g = this.g;
    const time = performance.now() / 1000;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.base, 0, 0);
    // Das eigene Kart zuletzt, damit es obenauf liegt. Eine fliegende Rakete ist ihr eigenes Zeichen.
    for (let pass = 0; pass < 2; pass++) {
      for (const k of karts) {
        const me = k.slot === localSlot;
        if (me !== (pass === 1)) continue;
        const [x, y] = this.f(k.x, k.z);
        if ((k.rocket ?? 0) > ROCKET_MORPH_TICKS) {
          const [ax, ay] = this.f(k.aimX ?? k.x, k.aimZ ?? k.z);
          const dir = this.dirOf(k.x, k.z, k.vx ?? 0, k.vz ?? 0);
          markRocket(g, x, y, dir === dir ? dir : Math.atan2(ay - y, ax - x), playerColor(k.slot), ax, ay);
          continue;
        }
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
    // Bewegliche Dinge obenauf (sie sind kleiner als die Karts und sollen nicht unter ihnen verschwinden).
    for (const th of things) {
      const mark = THING_MARKS[th.kind];
      if (!mark) continue;
      const [x, y] = this.f(th.x, th.z);
      mark(g, x, y, this.dirOf(th.x, th.z, th.vx, th.vz), th, time);
    }
  }
}

import { describe, expect, it } from 'vitest';
import { TRACK, gridPosition, projectOnTrack, segDelta, trackHeading, wrapSeg } from '../../src/game/track';

describe('Strecke Werkshof', () => {
  const t = TRACK;

  it('ist geschlossen und gleichmäßig unterteilt', () => {
    expect(t.n).toBeGreaterThan(500);
    for (let i = 0; i < t.n; i++) {
      const j = (i + 1) % t.n;
      const d = Math.hypot(t.px[j] - t.px[i], t.pz[j] - t.pz[i]);
      expect(Math.abs(d - t.step)).toBeLessThan(0.03);
    }
  });

  it('hat keine Kurve, die enger ist als die Bande erlaubt', () => {
    let maxCurv = 0;
    for (let i = 0; i < t.n; i++) maxCurv = Math.max(maxCurv, Math.abs(t.curv[i]));
    const minRadius = 1 / maxCurv;
    console.log(`Länge ${t.length.toFixed(0)} m, engster Radius ${minRadius.toFixed(1)} m`);
    // Innenkante der Bande braucht noch Platz: Radius deutlich über wallHalf.
    expect(minRadius).toBeGreaterThan(Math.max(...t.wh) + 3);
  });

  it('kommt sich selbst nirgends zu nahe (Banden überlappen nicht)', () => {
    let min = Infinity;
    let at = [0, 0];
    for (let i = 0; i < t.n; i++) {
      for (let j = i + 1; j < t.n; j++) {
        if (Math.abs(segDelta(t, i, j)) < 45) continue;
        const d = Math.hypot(t.px[i] - t.px[j], t.pz[i] - t.pz[j]);
        if (d < min) {
          min = d;
          at = [i, j];
        }
      }
    }
    console.log(`geringster Abstand zweier Streckenteile: ${min.toFixed(1)} m (Abschnitte ${at[0]} und ${at[1]})`);
    expect(min).toBeGreaterThan(2 * Math.max(...t.wh) + 3);
  });

  it('ordnet Punkte dem richtigen Abschnitt und der richtigen Seite zu', () => {
    for (const seg of [0, 100, 333, t.n - 1]) {
      const rx = -t.tz[seg];
      const rz = t.tx[seg];
      const p = projectOnTrack(t, t.px[seg] + rx * 3, t.pz[seg] + rz * 3, wrapSeg(t, seg + 5));
      expect(Math.abs(segDelta(t, seg, p.seg))).toBeLessThanOrEqual(1);
      expect(p.lat).toBeCloseTo(3, 0);
    }
  });

  it('stellt die Karts hinter der Startlinie in Fahrtrichtung auf', () => {
    for (let slot = 0; slot < 4; slot++) {
      const g = gridPosition(t, slot);
      expect(segDelta(t, 0, g.seg)).toBeLessThan(0);
      expect(Math.abs(g.heading - trackHeading(t, g.seg))).toBeLessThan(1e-9);
    }
  });

  it('Übersicht (nur zur Ansicht)', () => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < t.n; i++) {
      minX = Math.min(minX, t.px[i]); maxX = Math.max(maxX, t.px[i]);
      minZ = Math.min(minZ, t.pz[i]); maxZ = Math.max(maxZ, t.pz[i]);
    }
    const W = 110;
    // Zeichen sind etwa doppelt so hoch wie breit.
    const H = Math.round((W * (maxZ - minZ)) / (maxX - minX) / 2);
    const grid = Array.from({ length: H }, () => Array(W).fill(' '));
    const put = (x: number, z: number, ch: string): void => {
      // x gespiegelt: so sieht die Karte aus wie für den Fahrer (rechts ist -x).
      const c = Math.max(0, Math.min(W - 1, Math.round((1 - (x - minX) / (maxX - minX)) * (W - 1))));
      const r = Math.max(0, Math.min(H - 1, Math.round((1 - (z - minZ) / (maxZ - minZ)) * (H - 1))));
      if (grid[r][c] === ' ' || ch !== '.') grid[r][c] = ch;
    };
    for (let i = 0; i < t.n; i++) put(t.px[i], t.pz[i], i < 12 ? 'S' : Math.abs(t.curv[i]) > 1 / 22 ? '#' : i % 50 === 0 ? String((i / 50) % 10) : '.');
    // Radien der Kurven auflisten
    const parts: string[] = [];
    let i0 = -1;
    for (let i = 0; i <= t.n; i++) {
      const tight = i < t.n && Math.abs(t.curv[i]) > 1 / 60;
      if (tight && i0 < 0) i0 = i;
      if (!tight && i0 >= 0) {
        let peak = 0;
        let turn = 0;
        for (let k = i0; k < i; k++) {
          peak = Math.max(peak, Math.abs(t.curv[k]));
          turn += t.curv[k] * t.step;
        }
        parts.push(`${i0}–${i} m: ${turn > 0 ? 'rechts' : 'links'} ${Math.abs((turn * 180) / Math.PI).toFixed(0)}°, engster Radius ${(1 / peak).toFixed(0)} m`);
        i0 = -1;
      }
    }
    console.log(parts.join('\n'));
    for (const p of t.pads) put(t.px[p.seg], t.pz[p.seg], '>');
    for (const b of t.boxes) put(b.x, b.z, '?');
    console.log('\n' + grid.map((r) => r.join('')).join('\n') + `\n(${(maxX - minX).toFixed(0)} × ${(maxZ - minZ).toFixed(0)} m; # = Radius unter 22 m, S = Start, > = Boost, ? = Kisten)`);
  });
});

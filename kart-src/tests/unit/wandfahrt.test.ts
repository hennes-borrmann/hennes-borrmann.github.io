// Schwebeband an der Wand (Neonhochbahn, Talsperre, Kristallmine): Gerechnet wird flach, gezeigt wird die Bahn
// verdreht. Die Kurve, die die flache Bahn dort macht, sieht man an der Wand nicht – also fährt das Band sie selbst
// (sim.ts: twistYaw). Ohne das wurde man an der Wand ohne sichtbaren Grund an den Rand gedrückt, und in der Geode der
// Kristallmine (Radius bis unter 13 m) half nicht einmal voller Einschlag.

import { afterAll, describe, expect, it } from 'vitest';
import { TRACK_DEFS } from '../../src/game/tracks';
import { EDGE_TWIST, TRACK, proj, projectOnTrack, rightX, rightZ, setTrack, trackHeading } from '../../src/game/track';
import { gridState, stepKart, type KartState } from '../../src/game/sim';

afterAll(() => setTrack(0));

function at(seg: number, lat: number, v: number): KartState {
  const t = TRACK;
  const s = gridState(0);
  s.seg = seg;
  s.x = t.px[seg] + rightX(t, seg) * lat;
  s.z = t.pz[seg] + rightZ(t, seg) * lat;
  s.y = t.py[seg] + lat * t.bank[seg];
  s.heading = trackHeading(t, seg);
  s.vx = Math.sin(s.heading) * v;
  s.vz = Math.cos(s.heading) * v;
  return s;
}

/** Seitliche Lage nach ticks Ticks mit fester Lenkung (Vollgas), Start bei lat. */
function after(seg: number, lat: number, steer: number, ticks: number): number {
  const s = at(seg, lat, 24);
  for (let k = 1; k <= ticks; k++) stepKart(s, { steer, buttons: 1 }, { canDrive: true, speedFactor: 1, time: 3000 + k });
  projectOnTrack(TRACK, s.x, s.z, s.seg);
  return proj.lat;
}

describe('Schwebeband an der Wand', () => {
  for (const id of ['neon', 'talsperre', 'kristall']) {
    it(`${id}: ohne Lenken bleibt man an der Wand in seiner Spur, und Lenken wirkt nach beiden Seiten`, () => {
      setTrack(TRACK_DEFS.findIndex((d) => d.id === id));
      const t = TRACK;
      // Stellen an der senkrechten Wand (bis 2° daneben), hinter denen man noch mindestens 18 m an ihr bleibt (im Übergang ist die Kurve
      // zum Teil zu sehen und zu lenken).
      const onWall = (i: number): boolean => (t.edge[i] & EDGE_TWIST) !== 0 && Math.abs(Math.cos(t.roll[i])) < 0.04;
      const wall: number[] = [];
      for (let i = 0; i < t.n; i++) {
        let ok = true;
        for (let k = 0; k * t.step <= 18 && ok; k++) ok = onWall((i + k) % t.n);
        if (ok) wall.push(i);
      }
      expect(wall.length).toBeGreaterThan(5);
      let worst = 0;
      let weakest = Infinity;
      for (const seg of wall.filter((_, k) => k % 6 === 0)) {
        for (const lat0 of [-2.5, 0, 2.5]) worst = Math.max(worst, Math.abs(after(seg, lat0, 0, 40) - lat0));
        weakest = Math.min(weakest, after(seg, 0, 127, 30), -after(seg, 0, -127, 30));
      }
      console.log(`${t.def.name}: an der Wand ohne Lenken höchstens ${worst.toFixed(2)} m aus der Spur (2/3 s); voller Einschlag ½ s: mindestens ${weakest.toFixed(2)} m zur Seite`);
      expect(worst).toBeLessThan(0.6);
      expect(weakest).toBeGreaterThan(2);
    });
  }
});

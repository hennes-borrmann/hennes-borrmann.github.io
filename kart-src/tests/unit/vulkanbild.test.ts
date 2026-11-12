import { it } from 'vitest';
import { TRACK, setTrack, rightX, rightZ } from '../../src/game/track';
it('dump', () => {
  setTrack(9);
  const t = TRACK;
  for (const b of t.branches) {
    for (let i = b.from; i < b.from + 70; i += 2) {
      const k = t.twin[i];
      if (k < 0) { console.log('main', i, 'no twin'); continue; }
      const lat = (x: number, z: number) => (x - t.px[i]) * rightX(t, i) + (z - t.pz[i]) * rightZ(t, i);
      const ll = lat(t.px[k] - rightX(t, k) * t.wh[k], t.pz[k] - rightZ(t, k) * t.wh[k]);
      const rl = lat(t.px[k] + rightX(t, k) * t.wh[k], t.pz[k] + rightZ(t, k) * t.wh[k]);
      console.log('main', i, 'tw', k - b.first, 'll', ll.toFixed(2), 'rl', rl.toFixed(2), 'free', t.free[i].toFixed(2), 'dy', (t.py[k]-t.py[i]).toFixed(2), 'edgeTw', t.edge[k]);
    }
    console.log('sign seg', b.from - 35, 'edge', t.edge[b.from - 35], 'wh', t.wh[b.from-35]);
  }
});

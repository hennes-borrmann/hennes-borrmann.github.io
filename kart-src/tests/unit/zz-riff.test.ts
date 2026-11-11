import { it } from 'vitest';
import { AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import { EV_FALL, EV_WALL, EV_HIT, EV_TAKEOFF, FLAG_AIR, FLAG_OFFROAD, gridState, stepKart } from '../../src/game/sim';
import { TRACK, segDelta, setTrack, EDGE_GAP } from '../../src/game/track';

it('riff', () => {
  const t = setTrack(5);
  const out: string[] = [`Länge ${Math.round(t.length)} m, n ${t.n}, total ${t.total}, Abzweige ${t.branches.map((b) => `${b.from}→${b.to} (${b.count})`).join(', ')}`];
  for (const level of [AI_MEDIUM, AI_HARD]) {
    for (let route = 0; route < 4; route++) {
      const s = gridState(0);
      const brain = newBrain(0, level);
      brain.route = route;
      brain.routeLock = true;
      let progress = segDelta(TRACK, 0, s.seg);
      let lapStart = 0;
      const laps: string[] = [];
      let falls = 0, walls = 0, off = 0, air = 0, jumps = 0;
      const fellAt: number[] = [];
      for (let tick = 1; tick < 3 * 100 * 60 && laps.length < 2; tick++) {
        const before = s.seg;
        const ev = stepKart(s, botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false }), { canDrive: true, speedFactor: 1, time: tick });
        if (ev & EV_FALL) { falls++; fellAt.push(before); }
        if (ev & EV_WALL) walls++;
        if (ev & EV_TAKEOFF) jumps++;
        if (s.flags & FLAG_OFFROAD) off++;
        if (s.flags & FLAG_AIR) air++;
        progress += segDelta(TRACK, before, s.seg);
        if (progress >= (laps.length + 1) * TRACK.n) { laps.push(((tick - lapStart) / 60).toFixed(1)); lapStart = tick; }
      }
      out.push(`Stärke ${level} Weg ${route}: ${laps.join(' / ')} s · Stürze ${falls} ${fellAt.join(',')} · Bande ${walls} · Grün ${(off / 60).toFixed(1)} s · Sprünge ${jumps} · Luft ${(air / 60).toFixed(1)} s`);
    }
  }
  console.log(out.join('\n'));
});

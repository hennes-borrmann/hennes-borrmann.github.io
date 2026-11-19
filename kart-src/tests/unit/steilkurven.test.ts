// Steilkurven: kein Hüpfen, keine überzogene Lenkung.
//
// – Hüpfen: Wer quer zum Hang hinauffährt oder in eine steiler werdende Kurve hinein, steigt mit dem Boden – nimmt diese
//   Steiggeschwindigkeit aber nicht mit in die Luft (sim.ts). Und die Neigung verläuft zwischen zwei Abschnitten
//   gleichmäßig (track.ts: bankAt) – vorher war der Rand einer Steilkurve eine Treppe mit Stufen bis über einen halben Meter.
// – Lenkung: Die Steilkurve gibt mehr Halt, aber nur so viel, wie man einlenkt – ein Tipp lenkt so fein wie auf der Geraden.

import { afterAll, describe, expect, it } from 'vitest';
import { TRACK_DEFS } from '../../src/game/tracks';
import { AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { EV_TAKEOFF, FLAG_AIR, gridState, stepKart } from '../../src/game/sim';
import { TRACK, setTrack, trackHeading } from '../../src/game/track';

afterAll(() => setTrack(0));

const STEEP = ['gipfel', 'neon', 'talsperre', 'kristall', 'baum', 'daecher', 'rampe'];

function steepest(): number {
  let seg = 0;
  for (let i = 0; i < TRACK.n; i++) if (Math.abs(TRACK.bank[i]) > Math.abs(TRACK.bank[seg])) seg = i;
  return seg;
}

describe('Steilkurven', () => {
  for (const id of STEEP) {
    it(`${id}: kein Abheben in Steilkurven – weder bei der KI noch in Schlangenlinien`, () => {
      setTrack(TRACK_DEFS.findIndex((d) => d.id === id));
      const t = TRACK;
      const s = gridState(0);
      const brain = newBrain(0, AI_HARD);
      let hops = 0;
      for (let tick = 1; tick < 2 * 80 * 60; tick++) {
        const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
        const seg = s.seg;
        const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
        if (ev & EV_TAKEOFF && seg < t.total && Math.abs(t.bank[seg]) > 0.25) hops++;
      }
      const seg = (steepest() - 25 + t.n) % t.n;
      const k = gridState(0);
      k.seg = seg;
      k.x = t.px[seg];
      k.z = t.pz[seg];
      k.y = t.py[seg];
      k.heading = trackHeading(t, seg);
      k.vx = Math.sin(k.heading) * 20;
      k.vz = Math.cos(k.heading) * 20;
      let air = 0;
      for (let tick = 0; tick < 150; tick++) {
        stepKart(k, { steer: Math.floor(tick / 12) % 2 ? 127 : -127, buttons: 1 }, { canDrive: true, speedFactor: 1, time: 5000 + tick });
        if (k.flags & FLAG_AIR) air++;
      }
      expect(hops).toBe(0);
      expect(air).toBe(0);
    });
  }

  it('ein Tipp aufs Lenkrad lenkt in der Steilkurve so fein wie auf der Geraden; voller Einschlag höchstens anderthalbmal so stark', () => {
    setTrack(TRACK_DEFS.findIndex((d) => d.id === 'talsperre'));
    const seg = steepest();
    const dir = TRACK.bank[seg] > 0 ? -1 : 1; // zur tiefen Seite
    const turn = (bank: number, steer: number): number => {
      const keep = TRACK.bank[seg];
      TRACK.bank[seg] = bank;
      TRACK.bank[TRACK.next[seg]] = bank;
      const s = gridState(0);
      s.seg = seg;
      s.x = TRACK.px[seg];
      s.z = TRACK.pz[seg];
      s.y = TRACK.py[seg];
      s.heading = trackHeading(TRACK, seg);
      s.vx = Math.sin(s.heading) * 24;
      s.vz = Math.cos(s.heading) * 24;
      const h0 = s.heading;
      stepKart(s, { steer: dir * steer, buttons: 1 }, { canDrive: true, speedFactor: 1, time: 1 });
      TRACK.bank[seg] = keep;
      TRACK.bank[TRACK.next[seg]] = keep;
      return Math.abs(s.heading - h0);
    };
    const keepNext = TRACK.bank[TRACK.next[seg]];
    const bank = TRACK.bank[seg];
    expect(turn(bank, 20) / turn(0, 20)).toBeLessThan(1.1);
    expect(turn(bank, 127) / turn(0, 127)).toBeLessThan(1.55);
    expect(turn(bank, 127) / turn(0, 127)).toBeGreaterThan(1.2);
    TRACK.bank[TRACK.next[seg]] = keepNext;
  });
});

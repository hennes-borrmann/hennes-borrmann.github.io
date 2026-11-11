import { afterAll, describe, expect, it } from 'vitest';
import { AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { PULSE_METEOR } from '../../src/game/mechanics';
import { BTN_GAS, EV_FALL, EV_HIT, EV_LAUNCH, EV_PAD, FLAG_AIR, gridState, stepKart, type KartState } from '../../src/game/sim';
import { EDGE_GAP, TRACK, getTrack, rightX, rightZ, segDelta, setTrack, trackHeading, wrapSeg } from '../../src/game/track';

const MOND = 7;
const GAS = { steer: 0, buttons: BTN_GAS };

afterAll(() => {
  setTrack(0);
});

function at(seg: number, lat = 0, dy = 0, speed = 0): KartState {
  const t = TRACK;
  const s = gridState(0);
  s.seg = seg;
  s.x = t.px[seg] + rightX(t, seg) * lat;
  s.z = t.pz[seg] + rightZ(t, seg) * lat;
  s.y = t.py[seg] + lat * t.bank[seg] + dy;
  s.heading = trackHeading(t, seg);
  s.vx = Math.sin(s.heading) * speed;
  s.vz = Math.cos(s.heading) * speed;
  s.vy = 0;
  s.flags = dy > 0.2 ? FLAG_AIR : 0;
  return s;
}

/** Führt fn mit Erdschwerkraft aus. */
function earth<T>(fn: () => T): T {
  const t = TRACK;
  const g = t.gravity;
  t.gravity = 1;
  try {
    return fn();
  } finally {
    t.gravity = g;
  }
}

describe('Geringe Schwerkraft (Mondbasis)', () => {
  it('nur auf dem Mond gilt weniger Schwerkraft; die Strecke hat Sprungplatten, Meteoriten und Ringe', () => {
    const t = setTrack(MOND);
    expect(t.def.name).toBe('Mondbasis');
    expect(t.gravity).toBeGreaterThan(0.3);
    expect(t.gravity).toBeLessThan(0.5);
    for (let i = 0; i < MOND; i++) {
      expect(getTrack(i).gravity).toBe(1);
      expect(getTrack(i).launchers.length).toBe(0);
    }
    expect(t.launchers.length).toBe(2);
    expect(t.pulses.filter((p) => p.kind === PULSE_METEOR).length).toBeGreaterThanOrEqual(5);
    expect(t.rings.length).toBeGreaterThanOrEqual(3);
  });

  it('ein Fall aus drei Metern dauert auf dem Mond gut anderthalbmal so lang', () => {
    setTrack(MOND);
    const fall = (): number => {
      const s = at(20, 0, 3, 0);
      let ticks = 0;
      for (; ticks < 400 && (s.flags & FLAG_AIR) !== 0; ticks++) stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: 0 });
      return ticks;
    };
    const moon = fall();
    const home = earth(fall);
    console.log(`Drei Meter Fall: Mond ${(moon / 60).toFixed(2)} s, Erde ${(home / 60).toFixed(2)} s`);
    expect(moon).toBeGreaterThan(home * 1.5);
  });

  it('eine Sprungplatte schleudert über die Schlucht – ohne sie (oder mit Erdschwerkraft) reicht es nicht', () => {
    const t = setTrack(MOND);
    const l = t.launchers.find((x) => t.branchOf[x.seg] === -1)!;
    const jump = (): { ev: number; air: number; top: number; way: number } => {
      const s = at(wrapSeg(t, l.seg - 30), 0, 0, 24);
      const brain = newBrain(0, AI_HARD);
      brain.route = 0;
      brain.routeLock = true;
      let ev = 0;
      let air = 0;
      let top = 0;
      const x = s.x;
      const z = s.z;
      for (let i = 0; i < 330; i++) {
        ev |= stepKart(s, botCmd(s, brain, [], true, { tick: i, time: 0, place: 1, smoke: false }), { canDrive: true, speedFactor: 1, time: 0 });
        if (s.flags & FLAG_AIR) air++;
        top = Math.max(top, s.y - t.py[s.seg]);
        if (ev & EV_FALL) break;
      }
      return { ev, air, top, way: Math.hypot(s.x - x, s.z - z) };
    };
    const moon = jump();
    console.log(`Massenbeschleuniger: ${(moon.air / 60).toFixed(1)} s in der Luft, bis ${moon.top.toFixed(1)} m über der Bahn${moon.ev & EV_PAD ? ', durch einen Ring' : ''}`);
    expect(moon.ev & EV_LAUNCH).not.toBe(0);
    expect(moon.ev & EV_FALL).toBe(0);
    expect(moon.air).toBeGreaterThan(80);
    expect(moon.top).toBeGreaterThan(3);
    // Ringe hängen in der Flugbahn.
    expect(moon.ev & EV_PAD).not.toBe(0);
    // Mit Erdschwerkraft trägt dieselbe Platte nicht über die Lücke.
    expect(earth(jump).ev & EV_FALL).not.toBe(0);
    // Ohne Platte auch nicht.
    const keep = t.launchers;
    t.launchers = [];
    try {
      expect(jump().ev & EV_FALL).not.toBe(0);
    } finally {
      t.launchers = keep;
    }
    // Hinter jeder Platte liegt eine Lücke.
    for (const p of t.launchers) {
      let gap = false;
      for (let k = 1, g = p.seg; k < 30; k++) {
        g = t.next[g];
        if (t.edge[g] & EDGE_GAP) gap = true;
      }
      expect(gap).toBe(true);
    }
  });

  it('wer knapp über der Platte schwebt, wird trotzdem erfasst', () => {
    const t = setTrack(MOND);
    const l = t.launchers.find((x) => t.branchOf[x.seg] === -1)!;
    const s = at(wrapSeg(t, l.seg - 3), 0, 0.9, 24);
    let ev = 0;
    for (let i = 0; i < 20; i++) ev |= stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: 0 });
    expect(ev & EV_LAUNCH).not.toBe(0);
    // Hoch darüber hinweg (etwa am Abschleppdrachen vorbei) nicht.
    const high = at(wrapSeg(t, l.seg - 3), 0, 4, 24);
    let ev2 = 0;
    for (let i = 0; i < 8; i++) ev2 |= stepKart(high, GAS, { canDrive: true, speedFactor: 1, time: 0 });
    expect(ev2 & EV_LAUNCH).toBe(0);
  });

  it('Meteoriten treffen beim Einschlag; die KI kommt in drei Runden meist heil durch das Feld', () => {
    const t = setTrack(MOND);
    const p = t.pulses.find((q) => q.kind === PULSE_METEOR)!;
    const stand = (time: number): number => stepKart(at(p.seg, p.lat, 0, 0), { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time });
    expect(stand(5 - p.phase) & EV_HIT).not.toBe(0);
    expect(stand(p.on + 20 - p.phase) & EV_HIT).toBe(0);
    let hits = 0;
    let falls = 0;
    for (let slot = 0; slot < 4; slot++) {
      const s = gridState(slot);
      const brain = newBrain(slot, AI_HARD);
      let progress = segDelta(t, 0, s.seg);
      for (let tick = 1; tick < 4 * 80 * 60 && progress < 3 * t.n; tick++) {
        const before = s.seg;
        const ev = stepKart(s, botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false }), { canDrive: true, speedFactor: brain.skill, time: tick });
        if (ev & EV_HIT) hits++;
        if (ev & EV_FALL) falls++;
        progress += segDelta(t, before, s.seg);
      }
      expect(progress).toBeGreaterThanOrEqual(3 * t.n);
    }
    console.log(`Vier starke KI-Fahrer, je drei Runden: ${hits} Meteoritentreffer, ${falls} Stürze`);
    expect(hits).toBeLessThanOrEqual(6);
    expect(falls).toBeLessThanOrEqual(2);
  });
});

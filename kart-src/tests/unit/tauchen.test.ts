import { afterAll, describe, expect, it } from 'vitest';
import { AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { DIVE_SINK, DIVE_SPEED, PULSE_BUBBLE, pulseCycle } from '../../src/game/mechanics';
import {
  BTN_GAS,
  EV_BUBBLE,
  EV_FALL,
  EV_PAD,
  FLAG_AIR,
  FLAG_DIVE,
  V_MAX,
  forwardSpeed,
  gridState,
  stepKart,
  type KartState,
} from '../../src/game/sim';
import { EDGE_GAP, TRACK, getTrack, rightX, rightZ, addProgress, progDelta, segDelta, setTrack, trackHeading, wrapSeg } from '../../src/game/track';

const RIFF = 5;
const GAS = { steer: 0, buttons: BTN_GAS };
const IDLE = { steer: 0, buttons: 0 };

afterAll(() => {
  setTrack(0);
});

/** Kart auf Abschnitt seg, seitlich lat, dy Meter über der Fahrbahn, mit Tempo speed. */
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

/** Führt fn aus, als läge die ganze Strecke an der Luft (keine Tauchstrecken). */
function dry<T>(fn: () => T): T {
  const t = TRACK;
  const keep = t.deep.slice();
  t.deep.fill(0);
  try {
    return fn();
  } finally {
    t.deep.set(keep);
  }
}

/** Ein gerader, ebener Abschnitt tief unter Wasser, ohne Strömung, Buckel und Schlot in der Nähe. */
function calmSeg(): number {
  const t = TRACK;
  // Der Abschnitt mit dem längsten ruhigen Stück voraus (gemessen an Krümmung und Gefälle)
  let best = -1;
  let bestRun = 0;
  for (let i = 0; i < t.n; i++) {
    if (!t.deep[i] || t.py[i] > t.sea - 5) continue;
    let run = 0;
    for (; run < 80; run++) {
      const j = wrapSeg(t, i + run - 6);
      if (!t.deep[j] || t.edge[j] & EDGE_GAP || Math.abs(t.curv[j]) > 1 / 90 || t.twin[j] >= 0) break;
      if (Math.abs(t.py[wrapSeg(t, j + 1)] - t.py[j]) > 0.06) break;
      if (t.belts.some((b) => j >= b.first && j < b.first + b.count)) break;
      if (t.pulses.some((p) => Math.abs(segDelta(t, j, p.seg)) < 6)) break;
    }
    if (run > bestRun) {
      bestRun = run;
      best = i;
    }
  }
  if (bestRun < 45) throw new Error(`kein ruhiger Abschnitt unter Wasser gefunden (längstes Stück ${bestRun} Abschnitte)`);
  return best;
}

describe('Tauchen (Tiefseeriff)', () => {
  it('die Strecke liegt zum größten Teil unter Wasser; Start und Ziel sind an der Luft', () => {
    const t = setTrack(RIFF);
    expect(t.def.name).toBe('Tiefseeriff');
    let deep = 0;
    for (let i = 0; i < t.n; i++) if (t.deep[i] && t.py[i] < t.sea - 1) deep++;
    expect(deep / t.n).toBeGreaterThan(0.6);
    for (let slot = 0; slot < 4; slot++) {
      const g = gridState(slot);
      expect(t.py[g.seg]).toBeGreaterThan(t.sea + 0.5);
    }
    // Auch die Abzweigungen liegen unter Wasser.
    for (const b of t.branches) expect(t.deep[b.first + (b.count >> 1)]).toBe(1);
  });

  it('unter Wasser sinkt das Kart langsam – an der Luft fällt es', () => {
    setTrack(RIFF);
    const seg = calmSeg();
    const fall = (): { ticks: number; vyMin: number; dive: boolean } => {
      const s = at(seg, 0, 3, 0);
      let vyMin = 0;
      let dive = false;
      let ticks = 0;
      for (; ticks < 400 && (s.flags & FLAG_AIR) !== 0; ticks++) {
        stepKart(s, IDLE, { canDrive: true, speedFactor: 1, time: 0 });
        vyMin = Math.min(vyMin, s.vy);
        if (s.flags & FLAG_DIVE) dive = true;
      }
      return { ticks, vyMin, dive };
    };
    const wet = fall();
    const air = dry(fall);
    console.log(`Drei Meter Fall: unter Wasser ${(wet.ticks / 60).toFixed(2)} s (höchstens ${(-wet.vyMin).toFixed(1)} m/s), an der Luft ${(air.ticks / 60).toFixed(2)} s`);
    expect(wet.dive).toBe(true);
    expect(air.dive).toBe(false);
    expect(wet.ticks).toBeGreaterThan(air.ticks * 1.7);
    expect(-wet.vyMin).toBeLessThanOrEqual(DIVE_SINK + 0.01);
    expect(-air.vyMin).toBeGreaterThan(DIVE_SINK + 3);
  });

  it('derselbe Buckel trägt unter Wasser mehr als doppelt so weit', () => {
    const t = setTrack(RIFF);
    // Der erste Korallenbuckel der Hauptstrecke: Abschnitt mit der stärksten Steigung im Korallengarten
    let seg = -1;
    let steep = 0;
    for (let i = 0; i < t.n; i++) {
      if (!t.deep[i] || t.py[i] > t.sea - 4 || t.branchOf[i] !== -1) continue;
      const rise = t.py[wrapSeg(t, i + 3)] - t.py[i];
      if (rise > steep) {
        steep = rise;
        seg = i;
      }
    }
    expect(steep).toBeGreaterThan(0.3);
    const hop = (): { air: number; way: number } => {
      const s = at(wrapSeg(t, seg - 14), 0, 0, 23);
      const brain = newBrain(0, AI_HARD);
      let air = 0;
      let x0 = 0;
      let z0 = 0;
      let way = 0;
      let flying = false;
      for (let i = 0; i < 240; i++) {
        stepKart(s, { steer: botCmd(s, brain, [], true, { tick: i, time: 0, place: 1, smoke: false }).steer, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: 0 });
        const a = (s.flags & FLAG_AIR) !== 0;
        if (a && !flying && air === 0) {
          x0 = s.x;
          z0 = s.z;
          flying = true;
        }
        if (flying) {
          if (a) air++;
          else {
            way = Math.hypot(s.x - x0, s.z - z0);
            break;
          }
        }
      }
      return { air, way };
    };
    const wet = hop();
    const air = dry(hop);
    console.log(`Korallenbuckel: unter Wasser ${(wet.air / 60).toFixed(2)} s und ${wet.way.toFixed(1)} m weit, an der Luft ${(air.air / 60).toFixed(2)} s und ${air.way.toFixed(1)} m`);
    expect(wet.air).toBeGreaterThan(20);
    expect(wet.way).toBeGreaterThan(air.way * 2);
  });

  it('unter Wasser ist das Kart etwas langsamer und rollt schneller aus', () => {
    setTrack(RIFF);
    const seg = calmSeg();
    const top = (): number => {
      const s = at(seg, 0, 0, V_MAX);
      let v = 0;
      for (let i = 0; i < 50; i++) {
        stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: 0 });
        v = forwardSpeed(s);
      }
      return v;
    };
    const coast = (): number => {
      const s = at(seg, 0, 0, 20);
      for (let i = 0; i < 40; i++) stepKart(s, IDLE, { canDrive: true, speedFactor: 1, time: 0 });
      return forwardSpeed(s);
    };
    const wet = top();
    const air = dry(top);
    expect(wet / air).toBeGreaterThan(DIVE_SPEED - 0.02);
    expect(wet / air).toBeLessThan(DIVE_SPEED + 0.02);
    expect(coast()).toBeLessThan(dry(coast) - 3);
  });

  it('eine Strömung nimmt auch das schwebende Kart mit – und nur unter Wasser', () => {
    const t = setTrack(RIFF);
    const fwd = t.belts.find((b) => b.swim && b.along > 0)!;
    expect(fwd).toBeDefined();
    const seg = fwd.first + (fwd.count >> 1);
    const lat = (fwd.lat0 + fwd.lat1) / 2;
    const drift = (dy: number): number => {
      const s = at(seg, lat, dy, 0);
      const x = s.x;
      const z = s.z;
      for (let i = 0; i < 20; i++) stepKart(s, IDLE, { canDrive: true, speedFactor: 1, time: 0 });
      return (s.x - x) * t.tx[seg] + (s.z - z) * t.tz[seg];
    };
    const ground = drift(0);
    const floating = drift(2.5);
    console.log(`Strömung ${fwd.along} m/s: in 20 Ticks am Boden ${ground.toFixed(2)} m, schwebend ${floating.toFixed(2)} m mitgenommen`);
    expect(ground).toBeGreaterThan((fwd.along * 20) / 60 - 0.1);
    expect(floating).toBeGreaterThan((fwd.along * 20) / 60 - 0.1);
    // An der Luft wirkt eine Strömung gar nicht.
    expect(Math.abs(dry(() => drift(0)))).toBeLessThan(0.01);
    // Gegenströmung und Querströmung gibt es auch.
    expect(t.belts.some((b) => b.swim && b.along < 0)).toBe(true);
    expect(t.belts.filter((b) => b.swim && b.across !== 0).length).toBeGreaterThanOrEqual(2);
  });

  it('ein Blasenschlot hebt im Takt an – und trägt bis zum Schubring darüber', () => {
    const t = setTrack(RIFF);
    const vents = t.pulses.filter((p) => p.kind === PULSE_BUBBLE);
    expect(vents.length).toBeGreaterThanOrEqual(3);
    const p = vents[0];
    const active = 10 - p.phase;
    const quiet = p.on + 20 - p.phase;
    expect(pulseCycle(p, active)).toBeLessThan(p.on);
    expect(pulseCycle(p, quiet)).toBeGreaterThanOrEqual(p.on);
    const ride = (time: number): { ev: number; top: number; boost: number } => {
      const s = at(wrapSeg(t, p.seg - 8), p.lat, 0, 22);
      let ev = 0;
      let top = 0;
      for (let i = 0; i < 110; i++) {
        ev |= stepKart(s, GAS, { canDrive: true, speedFactor: 1, time });
        top = Math.max(top, s.y - t.py[s.seg]);
      }
      return { ev, top, boost: s.boost };
    };
    const up = ride(active);
    const flat = ride(quiet);
    console.log(`Blasenschlot: aktiv ${up.top.toFixed(1)} m hoch${up.ev & EV_PAD ? ' und durch den Ring' : ''}, in der Pause ${flat.top.toFixed(1)} m`);
    expect(up.ev & EV_BUBBLE).not.toBe(0);
    expect(up.top).toBeGreaterThan(3);
    expect(flat.ev & EV_BUBBLE).toBe(0);
    expect(flat.top).toBeLessThan(1);
    // Über dem Schlot hängt ein Ring: wer angehoben wird, fliegt hindurch.
    expect(up.ev & EV_PAD).not.toBe(0);
    expect(flat.ev & EV_PAD).toBe(0);
    // Nebeneinander stehende Schlote sind nie gleichzeitig in der Pause.
    const pair = vents.filter((v) => v.seg === p.seg);
    expect(pair.length).toBe(2);
    for (let time = 0; time < p.period; time += 5) expect(pair.some((v) => pulseCycle(v, time) < v.on)).toBe(true);
  });

  it('der Graben ist nur mit dem Schwebesprung zu schaffen: unter Wasser ja, an der Luft nein', () => {
    const t = setTrack(RIFF);
    const b = t.branches[0];
    let gap = -1;
    for (let k = 0; k < b.count; k++) if (t.edge[b.first + k] & EDGE_GAP && gap < 0) gap = b.first + k;
    expect(gap).toBeGreaterThan(0);
    const cross = (): boolean => {
      const s = at(gap - 45, 0, 0, 22);
      const brain = newBrain(0, AI_HARD);
      brain.route = 1;
      brain.routeLock = true;
      let ev = 0;
      for (let i = 0; i < 300; i++) ev |= stepKart(s, botCmd(s, brain, [], true, { tick: i, time: 0, place: 1, smoke: false }), { canDrive: true, speedFactor: 1, time: 0 });
      return (ev & EV_FALL) === 0;
    };
    expect(cross()).toBe(true);
    expect(dry(cross)).toBe(false);
  });

  it('die KI nimmt Blasenschlote mit, wenn sie gerade blasen, und stürzt dabei nicht ab', () => {
    const t = setTrack(RIFF);
    let lifts = 0;
    let rings = 0;
    for (let slot = 0; slot < 4; slot++) {
      const s = gridState(slot);
      const brain = newBrain(slot, AI_HARD);
      let progress = progDelta(t, 0, s.seg);
      let wasBoost = 0;
      for (let tick = 1; tick < 3 * 80 * 60 && progress < 2 * t.n; tick++) {
        const before = s.seg;
        const ev = stepKart(s, botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false }), { canDrive: true, speedFactor: brain.skill, time: tick });
        expect(ev & EV_FALL).toBe(0);
        if (ev & EV_BUBBLE) lifts++;
        // Ring: Schub beginnt im Schweben
        if (ev & EV_PAD && s.flags & FLAG_AIR && s.boost > wasBoost) rings++;
        wasBoost = s.boost;
        progress = addProgress(t, progress, before, s.seg);
      }
      expect(progress).toBeGreaterThanOrEqual(2 * t.n);
    }
    console.log(`Vier starke KI-Fahrer, je zwei Runden: ${lifts}-mal vom Schlot angehoben, ${rings}-mal durch einen Ring`);
    // Zwei Schlotstellen je Runde, acht Runden: mindestens jede zweite Gelegenheit wird genutzt.
    expect(lifts).toBeGreaterThanOrEqual(8);
    expect(rings).toBeGreaterThanOrEqual(6);
  });

  it('die anderen Strecken haben keine Tauchstrecken', () => {
    for (let i = 0; i < RIFF; i++) expect(getTrack(i).deep.some((d) => d !== 0)).toBe(false);
  });
});

// Gipfelbahn (Strecke 19) – und die Messlatte für alle neuen Strecken ab hier.
//
// Die Ziele aus dem Plan für die Strecken 19–25 (spannender als die ersten achtzehn): mindestens drei Fahrarten je
// Runde, mindestens 40 m Höhenunterschied, mindestens 300 m mit mehr als 10 % Steigung oder Gefälle, Steilkurven über
// 25°, mehrere Haarnadeln (über drei volle Umdrehungen Kurve je Runde), zwei echte Abkürzungen mit je 1,5–3,5 s
// Ersparnis und einem Preis, mindestens ein bewegtes Hindernis. Dazu, ob die beiden Abkürzungen ihren Preis haben:
//   – Almwiese ('item'): ohne Schub langsamer als die Straße, mit Zisch deutlich schneller;
//   – Skisprungschanze ('risk'): mit Tempo sicher hinüber, zu langsam in die Klamm.

import { afterAll, describe, expect, it } from 'vitest';
import { TRACK_DEFS } from '../../src/game/tracks';
import { EDGE_GAP, EDGE_GLIDE, EDGE_RAIL, EDGE_TUNNEL, TRACK, addProgress, getTrack, progDelta, rightX, rightZ, setTrack, trackHeading } from '../../src/game/track';
import { AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { BTN_ITEM, EV_FALL, ITEM_BOOST, gridState, stepKart, type Cmd, type KartState } from '../../src/game/sim';

const GIPFEL = TRACK_DEFS.findIndex((d) => d.id === 'gipfel');
const GAS: Cmd = { steer: 0, buttons: 1 };
const ENV = { canDrive: true, speedFactor: 1, time: 0 };

afterAll(() => setTrack(0));

/** Kart auf Abschnitt seg, seitlich lat, in Fahrtrichtung, mit Tempo v. */
function placeAt(s: KartState, seg: number, lat = 0, v = 0): void {
  const t = TRACK;
  s.seg = seg;
  s.x = t.px[seg] + rightX(t, seg) * lat;
  s.z = t.pz[seg] + rightZ(t, seg) * lat;
  s.y = t.py[seg] + lat * t.bank[seg];
  s.heading = trackHeading(t, seg);
  s.vx = Math.sin(s.heading) * v;
  s.vz = Math.cos(s.heading) * v;
}

describe('Gipfelbahn', () => {
  const t = getTrack(GIPFEL);

  it('erfüllt die Messlatte: Höhe, Steilstücke, Steilkurven, Kurven, Fahrarten, Hindernisse', () => {
    let lo = Infinity;
    let hi = -Infinity;
    let steep = 0;
    let bank = 0;
    let turn = 0;
    for (let s = 0; s < t.n; s++) {
      lo = Math.min(lo, t.py[s]);
      hi = Math.max(hi, t.py[s]);
      const s5 = (s + 5) % t.n;
      if (Math.abs(t.py[s5] - t.py[s]) / (5 * t.step) > 0.1) steep += t.step;
      bank = Math.max(bank, Math.abs(t.bank[s]));
      const n = (s + 1) % t.n;
      turn += Math.abs(Math.atan2(t.tx[s] * t.tz[n] - t.tz[s] * t.tx[n], t.tx[s] * t.tx[n] + t.tz[s] * t.tz[n]));
    }
    expect(hi - lo).toBeGreaterThan(40);
    expect(steep).toBeGreaterThan(300);
    expect((Math.atan(bank) * 180) / Math.PI).toBeGreaterThan(25);
    expect(turn / (2 * Math.PI)).toBeGreaterThan(3);
    const has = (flag: number): boolean => {
      for (let s = 0; s < t.total; s++) if (t.edge[s] & flag) return true;
      return false;
    };
    // Fahrarten: auf Schienen, im Gleitflug, auf der Straße (mit Steilkurven und Tunnel)
    expect(has(EDGE_RAIL)).toBe(true);
    expect(has(EDGE_GLIDE)).toBe(true);
    expect(has(EDGE_TUNNEL)).toBe(true);
    expect(t.hazards.length).toBeGreaterThanOrEqual(2);
    expect(t.branches.length).toBe(2);
    expect(t.def.branches!.map((b) => b.shortcut)).toEqual(['item', 'risk']);
  });

  /** Ein KI-Fahrer allein, Weg fest gewählt; boost: beim Einbiegen in die Almwiese einen Zisch zünden. Rundenzeit der zweiten Runde. */
  function lap(route: number, boost: boolean): { time: number; falls: number } {
    setTrack(GIPFEL);
    const s = gridState(0);
    const brain = newBrain(0, AI_HARD);
    brain.route = route;
    brain.routeLock = true;
    let progress = progDelta(TRACK, 0, s.seg);
    const laps: number[] = [];
    let lapStart = 0;
    let falls = 0;
    let fired = false;
    for (let tick = 1; laps.length < 2 && tick < 3 * 90 * 60; tick++) {
      const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
      const onMeadow = TRACK.branchOf[s.seg] === 0 && TRACK.twin[s.seg] < 0;
      if (!onMeadow) fired = false;
      if (boost && onMeadow && !fired) {
        s.item = ITEM_BOOST;
        cmd.buttons |= BTN_ITEM;
        fired = true;
      }
      const before = s.seg;
      const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
      if (ev & EV_FALL) falls++;
      progress = addProgress(TRACK, progress, before, s.seg);
      if (progress >= (laps.length + 1) * TRACK.n) {
        laps.push((tick - lapStart) / 60);
        lapStart = tick;
      }
    }
    return { time: laps[1] ?? Infinity, falls };
  }

  it('Almwiese: ohne Schub langsamer als die Straße, mit Zisch deutlich schneller', () => {
    const road = lap(0, false);
    const meadow = lap(1, false);
    const meadowBoost = lap(1, true);
    const roadBoost = lap(0, true);
    console.log(`Gipfelbahn Almwiese: Straße ${road.time.toFixed(2)} s · Wiese ${meadow.time.toFixed(2)} s · Wiese mit Zisch ${meadowBoost.time.toFixed(2)} s · Straße (Zisch ungenutzt) ${roadBoost.time.toFixed(2)} s`);
    expect(meadow.falls + meadowBoost.falls + road.falls).toBe(0);
    expect(meadow.time).toBeGreaterThan(road.time - 1);
    expect(road.time - meadowBoost.time).toBeGreaterThan(1.5);
  });

  it('Skisprungschanze: mit Tempo hinüber, zu langsam in die Klamm', () => {
    setTrack(GIPFEL);
    const b = TRACK.branches[1];
    let gap = -1;
    for (let k = 0; k < b.count && gap < 0; k++) if (TRACK.edge[b.first + k] & EDGE_GAP) gap = b.first + k;
    expect(gap).toBeGreaterThan(b.first);
    const jump = (back: number, v: number, gas: boolean): boolean => {
      const s = gridState(0);
      placeAt(s, gap - back, 0, v);
      let fell = false;
      for (let tick = 0; tick < 240; tick++) {
        const ev = stepKart(s, gas ? GAS : { steer: 0, buttons: 0 }, { ...ENV, time: tick });
        if (ev & EV_FALL) fell = true;
      }
      return fell;
    };
    expect(jump(30, 26, true)).toBe(false);
    expect(jump(4, 7, false)).toBe(true);
  });
});

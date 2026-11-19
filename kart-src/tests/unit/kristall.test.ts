// Kristallmine (Strecke 21) – Messlatte wie bei Gipfelbahn und Neonhochbahn, dazu, was die Mine verspricht.
//
// Die Ziele für neue Strecken: mindestens drei Fahrarten je Runde (hier Straße, Lorenbahn auf Schienen, Tauchen im Grubensee,
// Schwebeband an der Wand der Geode), mindestens 40 m Höhenunterschied, mindestens 300 m mit mehr als 10 % Steigung oder
// Gefälle, Steilkurven über 25°, über drei volle Umdrehungen Kurve, zwei echte Abkürzungen mit Preis, ein bewegtes Hindernis,
// eine Stelle, an der die Strecke sich selbst kreuzt. Dazu:
//   – die Weiche: offen führt das rechte Gleis in den Sprengort, zu (verschüttet) bleibt es auf dem langen Bogen;
//   – das Zeitfenster: die KI nimmt den Sprengort nur, wenn er bei der Ankunft offen ist, und spart dann 1,5–3,5 s;
//   – der Alte Mann ('risk'): spart 1,5–4 s, wer vom Bohlensteg abkommt, stürzt;
//   – die Sprengladungen werfen, wer daneben steht, und die KI weicht ihnen aus;
//   – an der Wand der Geode fährt man wie flach (nichts sackt ab), die Verdrehung ist weich;
//   – im Grubensee taucht man.

import { afterAll, describe, expect, it } from 'vitest';
import { TRACK_DEFS } from '../../src/game/tracks';
import { PULSE_BLAST, planActive, pulseCycle } from '../../src/game/mechanics';
import {
  EDGE_BAND,
  EDGE_GAP,
  EDGE_RAIL,
  EDGE_TWIST,
  TRACK,
  addProgress,
  getTrack,
  progDelta,
  proj,
  projectOnTrack,
  rightX,
  rightZ,
  setTrack,
  trackHeading,
  twistWarp,
} from '../../src/game/track';
import { AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { EV_FALL, EV_HIT, FLAG_AIR, gridState, stepKart, type Cmd, type KartState } from '../../src/game/sim';
import { withoutMechanics } from './helpers';

const KRISTALL = TRACK_DEFS.findIndex((d) => d.id === 'kristall');
const GAS: Cmd = { steer: 0, buttons: 1 };

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

/**
 * KI-Fahrer, Weg fest, von start bis goal (Abschnitte der Hauptstrecke) ab Rennzeit t0: Fahrzeit (s), Stürze, und ob er auf
 * der Abzweigung k war.
 */
function run(start: number, goal: number, route: number, t0: number, k: number): { time: number; falls: number; onBranch: boolean } {
  const t = TRACK;
  const s = gridState(0);
  placeAt(s, start, 0, 22);
  const brain = newBrain(0, AI_HARD);
  brain.route = route;
  brain.routeLock = true;
  let progress = t.prog[start];
  const need = progress + progDelta(t, start, goal);
  let falls = 0;
  let onBranch = false;
  for (let tick = t0; tick < t0 + 60 * 60; tick++) {
    const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
    const before = s.seg;
    if (stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick }) & EV_FALL) falls++;
    if (t.branchOf[s.seg] === k && t.twin[s.seg] < 0) onBranch = true;
    progress = addProgress(t, progress, before, s.seg);
    if (progress >= need) return { time: (tick - t0) / 60, falls, onBranch };
  }
  return { time: Infinity, falls, onBranch };
}

describe('Kristallmine', () => {
  const t = getTrack(KRISTALL);

  it('erfüllt die Messlatte: Länge, Höhe, Steilstücke, Steilkurven, Kurven, Fahrarten, Hindernisse, Kreuzung', () => {
    expect(t.length).toBeGreaterThan(1500);
    expect(t.length).toBeLessThan(1700);
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
    console.log(`Kristallmine: ${t.length.toFixed(0)} m, Höhe ${lo.toFixed(1)} … ${hi.toFixed(1)} m, steil ${steep.toFixed(0)} m, Steilkurve ${((Math.atan(bank) * 180) / Math.PI).toFixed(1)}°, ${(turn / (2 * Math.PI)).toFixed(2)} Umdrehungen`);
    expect(hi - lo).toBeGreaterThan(40);
    expect(steep).toBeGreaterThan(300);
    expect((Math.atan(bank) * 180) / Math.PI).toBeGreaterThan(25);
    expect(turn / (2 * Math.PI)).toBeGreaterThan(3);
    // Fahrarten je Runde (auf der Hauptstrecke): Straße, Lorenbahn, Tauchgang, Schwebeband an der Wand
    const main = (test: (s: number) => boolean): number => {
      let k = 0;
      for (let s = 0; s < t.n; s++) if (test(s)) k++;
      return k * t.step;
    };
    expect(main((s) => (t.edge[s] & EDGE_RAIL) !== 0)).toBeGreaterThan(250);
    expect(main((s) => t.deep[s] !== 0 && t.py[s] < t.sea - 1)).toBeGreaterThan(60);
    expect(main((s) => (t.edge[s] & EDGE_BAND) !== 0)).toBeGreaterThan(120);
    expect(main((s) => (t.edge[s] & (EDGE_RAIL | EDGE_BAND)) === 0 && t.deep[s] === 0)).toBeGreaterThan(600);
    // bewegte bzw. getaktete Hindernisse: die pendelnde Lore und die Sprengladungen
    expect(t.hazards.length).toBeGreaterThanOrEqual(1);
    expect(t.pulses.filter((p) => p.kind === PULSE_BLAST).length).toBeGreaterThanOrEqual(3);
    expect(t.def.branches!.map((b) => b.shortcut)).toEqual(['window', 'risk']);
    // Die Strecke kreuzt sich selbst: zwei Stellen der Hauptstrecke übereinander, gut eine Etage auseinander.
    let crossing = false;
    for (let a = 0; a < t.n && !crossing; a += 2) {
      for (let b = 0; b < t.n; b += 2) {
        if (Math.abs(progDelta(t, a, b)) < 80) continue;
        if (Math.hypot(t.px[a] - t.px[b], t.pz[a] - t.pz[b]) < 3 && Math.abs(t.py[a] - t.py[b]) > 8) crossing = true;
      }
    }
    expect(crossing).toBe(true);
  });

  it('Weiche: offen führt das rechte Gleis in den Sprengort, zu bleibt es auf dem Bogen', () => {
    setTrack(KRISTALL);
    const k = 0;
    const b = t.branches[k];
    const gate = t.gates.find((g) => t.branchOf[g.first] === k)!;
    expect(gate).toBeDefined();
    expect((t.edge[b.from] & EDGE_RAIL) !== 0 && (t.edge[b.first] & EDGE_RAIL) !== 0).toBe(true);
    // Zeiten, zu denen die Weiche offen bzw. zu ist (in den nächsten 2 s bleibt es so)
    let open = -1;
    let shut = -1;
    for (let time = 600; time < 600 + gate.plan.period && (open < 0 || shut < 0); time += 10) {
      if (!planActive(gate.plan, time) && !planActive(gate.plan, time + 120) && open < 0) open = time;
      if (planActive(gate.plan, time) && planActive(gate.plan, time + 120) && shut < 0) shut = time;
    }
    expect(open > 0 && shut > 0).toBe(true);
    // Auf dem rechten Gleis (b.side > 0) 30 m vor der Weiche, ohne zu lenken
    const roll = (t0: number, lane: number): boolean => {
      const s = gridState(0);
      placeAt(s, (b.from - 30 + t.n) % t.n, lane, 22);
      let inside = false;
      for (let tick = t0; tick < t0 + 240; tick++) {
        stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: tick });
        if (t.branchOf[s.seg] === k && t.twin[s.seg] < 0) inside = true;
      }
      return inside;
    };
    const right = b.side > 0 ? 2 : -2;
    expect(roll(open, right)).toBe(true);
    expect(roll(shut, right)).toBe(false);
    // Auf dem anderen Gleis bleibt man immer auf dem Bogen.
    expect(roll(open, -right)).toBe(false);
  });

  it('Sprengort: die KI nimmt ihn nur, wenn er offen ist – dann spart er 1,5–3,5 s', () => {
    setTrack(KRISTALL);
    const k = 0;
    const b = t.branches[k];
    const start = (b.from - 90 + t.n) % t.n;
    const goal = (b.to + 20) % t.n;
    const around = run(start, goal, 0, 600, k);
    let best = Infinity;
    let used = 0;
    // Mit freier Wahl (ohne festen Weg) entscheidet die KI selbst – nie in den verschütteten Sprengort.
    const gate = t.gates.find((g) => t.branchOf[g.first] === k)!;
    for (let t0 = 600; t0 < 600 + gate.plan.period; t0 += 20) {
      const s = gridState(0);
      placeAt(s, start, 0, 22);
      const brain = newBrain(0, AI_HARD);
      let progress = t.prog[start];
      const need = progress + progDelta(t, start, goal);
      let inside = false;
      let mouth = -1;
      for (let tick = t0; tick < t0 + 40 * 60; tick++) {
        const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
        const before = s.seg;
        expect(stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick }) & EV_FALL).toBe(0);
        if (mouth < 0 && t.branchOf[s.seg] === k) mouth = tick;
        if (t.branchOf[s.seg] === k && t.twin[s.seg] < 0) inside = true;
        progress = addProgress(t, progress, before, s.seg);
        if (progress >= need) {
          if (inside) {
            used++;
            best = Math.min(best, (tick - t0) / 60);
            // … und nur, wenn die Weiche offen war, als sie die Zungen erreichte
            expect(planActive(gate.plan, mouth)).toBe(false);
          }
          break;
        }
      }
    }
    console.log(`Kristallmine Sprengort: Bogen ${around.time.toFixed(2)} s · durch den Sprengort (bestes Zeitfenster) ${best.toFixed(2)} s · genommen in ${used} von ${Math.ceil(gate.plan.period / 20)} Anfahrten`);
    expect(used).toBeGreaterThan(0);
    expect(around.time - best).toBeGreaterThan(1.5);
    expect(around.time - best).toBeLessThan(3.5);
  });

  it('Alter Mann: spart 1,5–4 s – wer vom Bohlensteg abkommt, stürzt', () => {
    setTrack(KRISTALL);
    const k = 1;
    const b = t.branches[k];
    const start = (b.from - 60 + t.n) % t.n;
    const goal = (b.to + 20) % t.n;
    const r = withoutMechanics(() => ({ around: run(start, goal, 0, 600, k), cut: run(start, goal, 1 << k, 600, k) }));
    console.log(`Kristallmine Alter Mann: Bogen ${r.around.time.toFixed(2)} s · Bohlensteg ${r.cut.time.toFixed(2)} s`);
    expect(r.cut.onBranch).toBe(true);
    expect(r.cut.falls + r.around.falls).toBe(0);
    expect(r.around.time - r.cut.time).toBeGreaterThan(1.5);
    expect(r.around.time - r.cut.time).toBeLessThan(4);
    // Wer auf dem Steg zur Seite lenkt, stürzt ins Rolloch (links wie rechts) und wird erst nach einer Weile wieder aufgesetzt.
    const mid = b.first + (b.count >> 1);
    for (const steer of [-127, 127]) {
      const s = gridState(0);
      placeAt(s, mid, 0, 20);
      let fell = false;
      for (let tick = 0; tick < 200 && !fell; tick++) {
        if (stepKart(s, { steer, buttons: 1 }, { canDrive: true, speedFactor: 1, time: tick }) & EV_FALL) fell = true;
      }
      expect(fell).toBe(true);
      expect(s.respawn).toBeGreaterThan(0);
    }
  });

  it('Sprengladung: wirft, wer danebensteht – und die KI weicht ihr aus', () => {
    setTrack(KRISTALL);
    const p = t.pulses.find((q) => q.kind === PULSE_BLAST)!;
    // Ein Kart steht genau an der Ladung, als sie hochgeht.
    let boom = 600;
    while (pulseCycle(p, boom) !== 0) boom++;
    const s = gridState(0);
    placeAt(s, p.seg, p.lat, 0);
    let hit = false;
    for (let tick = boom - 2; tick < boom + 6; tick++) if (stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: tick }) & EV_HIT) hit = true;
    expect(hit).toBe(true);
    expect(s.flags & FLAG_AIR).not.toBe(0);
    // Die KI fährt viele Male durch die Sprengstrecke: selten getroffen.
    let hits = 0;
    let runs = 0;
    const first = Math.min(...t.pulses.filter((q) => q.kind === PULSE_BLAST).map((q) => q.seg));
    for (let t0 = 600; t0 < 600 + p.period; t0 += 23) {
      const k = gridState(1);
      placeAt(k, first - 70, 0, 22);
      const brain = newBrain(1, AI_HARD);
      for (let tick = t0; tick < t0 + 8 * 60; tick++) {
        const cmd = botCmd(k, brain, [], true, { tick, time: tick, place: 1, smoke: false });
        if (stepKart(k, cmd, { canDrive: true, speedFactor: brain.skill, time: tick }) & EV_HIT) hits++;
      }
      runs++;
    }
    console.log(`Kristallmine Sprengstrecke: KI ${hits} Treffer in ${runs} Durchfahrten`);
    expect(hits).toBeLessThanOrEqual(Math.ceil(runs * 0.2));
  });

  it('Geode: das Band dreht sich weich bis senkrecht an die Wand – und ist dort gerechnet wie flach', () => {
    setTrack(KRISTALL);
    let wall = 0;
    let maxStep = 0;
    let first = -1;
    for (let s = 0; s < t.n; s++) {
      if ((t.edge[s] & EDGE_TWIST) === 0) continue;
      if (first < 0) first = s;
      expect(t.edge[s] & EDGE_BAND).not.toBe(0);
      if (t.roll[s] > (85 * Math.PI) / 180) wall += t.step;
      maxStep = Math.max(maxStep, Math.abs(t.roll[t.next[s]] - t.roll[s]) / t.step);
    }
    console.log(`Kristallmine Geode: ${wall.toFixed(0)} m an der Wand, höchstens ${((maxStep * 180) / Math.PI).toFixed(2)}° Drehung je Meter`);
    expect(wall).toBeGreaterThan(40);
    expect((maxStep * 180) / Math.PI).toBeLessThan(4.5);
    // An der Wand steht die Fahrbahn senkrecht.
    let seg = first;
    while (t.roll[seg] < Math.PI / 2 - 1e-3) seg = t.next[seg];
    const a = { x: 0, y: 0, z: 0 };
    const c = { x: 0, y: 0, z: 0 };
    twistWarp(t, seg, 0, -4, 0, a);
    twistWarp(t, seg, 0, 4, 0, c);
    expect(Math.hypot(c.x - a.x, c.z - a.z)).toBeLessThan(1e-6);
    expect(c.y - a.y).toBeCloseTo(8, 6);
    // Fahren an der Wand = fahren auf flachem Band.
    const drive = (): KartState => {
      const s = gridState(0);
      placeAt(s, t.prev[t.prev[seg]], 1.5, 20);
      for (let tick = 0; tick < 50; tick++) stepKart(s, { steer: tick < 25 ? -50 : 30, buttons: 1 }, { canDrive: true, speedFactor: 1, time: tick });
      return s;
    };
    const onWall = drive();
    const keep = t.roll;
    t.roll = new Float32Array(t.total);
    const flat = drive();
    t.roll = keep;
    // Halt und Tempo mindestens wie flach: nichts sackt ab, nichts rutscht. (Die Bahn ist nicht mehr dieselbe: Den Teil
    // der Kurve, den man an der Wand nicht sieht, fährt das Band mit – siehe wandfahrt.test.ts. In der engen Geode der
    // Kristallmine landete man ohne das mit diesen Eingaben in der Bande.)
    expect(Math.hypot(onWall.vx, onWall.vz)).toBeGreaterThan(Math.hypot(flat.vx, flat.vz) - 0.5);
    expect(onWall.flags & 8).toBe(0);
  });

  it('Grubensee: unter Wasser taucht das Kart – es sinkt langsam und springt weit', () => {
    setTrack(KRISTALL);
    let deepest = -1;
    for (let s = 0; s < t.n; s++) if (t.deep[s] && (deepest < 0 || t.py[s] < t.py[deepest])) deepest = s;
    expect(t.py[deepest]).toBeLessThan(t.sea - 4);
    // Vom Grund hochgeworfen: unter Wasser bleibt es deutlich länger in der Schwebe als an der Luft.
    const air = (underwater: boolean): number => {
      const s = gridState(0);
      placeAt(s, deepest, 0, 10);
      s.y += 0.1;
      s.vy = 5;
      s.flags |= FLAG_AIR;
      const keep = t.deep[deepest];
      if (!underwater) for (let g = deepest - 20; g < deepest + 20; g++) t.deep[g] = 0;
      let ticks = 0;
      for (let tick = 0; tick < 600; tick++) {
        stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: tick });
        if ((s.flags & FLAG_AIR) === 0) break;
        ticks++;
      }
      if (!underwater) for (let g = deepest - 20; g < deepest + 20; g++) t.deep[g] = keep;
      return ticks;
    };
    expect(air(true)).toBeGreaterThan(air(false) * 2);
    projectOnTrack(t, t.px[deepest], t.pz[deepest], deepest);
    expect(proj.seg).toBe(deepest);
    expect(t.edge[deepest] & EDGE_GAP).toBe(0);
  });
});

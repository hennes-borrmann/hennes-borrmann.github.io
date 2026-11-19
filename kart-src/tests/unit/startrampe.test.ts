// Startrampe (Strecke 24) – Messlatte wie bei Gipfelbahn, Neonhochbahn und Kristallmine, dazu, was der Startplatz verspricht.
//
// Die Ziele für neue Strecken: mindestens drei Fahrarten je Runde (hier Straße, Steilkurven-Wendel um den Serviceturm,
// Schwebeband an der Wand des Magnetrings, Gleitflug), mindestens 40 m Höhenunterschied, mindestens 300 m mit mehr als 10 %
// Steigung oder Gefälle, Steilkurven über 25°, über drei volle Umdrehungen Kurve, zwei echte Abkürzungen mit Preis, ein
// bewegtes Hindernis, eine Stelle, an der die Strecke sich selbst kreuzt. Dazu:
//   – der Starttakt: alle 40 s ein Start; Abgasstrahl, Abgasstoß und das Tor des Flammengrabens folgen ihm;
//   – der Flammengraben ('window'): die KI nimmt ihn nur, wenn er bei der Ankunft offen ist, und spart dann 1,5–4 s;
//     beim Start ist niemand darin, und wer doch drin ist, wird getroffen;
//   – das Transporterdach ('train'): die Schranke ist nur offen, solange die Plattform den Graben überbrückt; die KI
//     nimmt es dann, stürzt nie und spart 1,5–4 s; ohne Transporter fällt man in den Graben;
//   – der Raupentransporter auf der Hauptstraße: seine Böcke sind fahrende Wände, unter der Plattform kommt man hindurch,
//     und die KI weicht ihnen aus;
//   – am Magnetring fährt man wie flach, die Verdrehung ist weich.

import { afterAll, describe, expect, it } from 'vitest';
import { TRACK_DEFS } from '../../src/game/tracks';
import { CRAWLER_HALF_WIDTH, CRAWLER_LEG_HALF, CRAWLER_LEG_U, PULSE_FLAME, crawlerAt, gustStrength, planActive, pulseCycle } from '../../src/game/mechanics';
import { EDGE_BAND, EDGE_GAP, EDGE_GLIDE, EDGE_TWIST, TRACK, addProgress, crawlerPose, getTrack, progDelta, proj, projectOnTrack, rightX, rightZ, setTrack, trackHeading, twistWarp } from '../../src/game/track';
import { RAKETE, STARTTAKT } from '../../src/game/tracks/rampe';
import { AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { EV_FALL, EV_HIT, EV_WALL, FLAG_AIR, gridState, stepKart, type Cmd, type KartState } from '../../src/game/sim';
import { withoutMechanics } from './helpers';

const RAMPE = TRACK_DEFS.findIndex((d) => d.id === 'rampe');
const GAS: Cmd = { steer: 0, buttons: 1 };
const COAST: Cmd = { steer: 0, buttons: 0 };

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

/** Lenkt das Kart auf die seitliche Lage lat (Meter) der Fahrbahn 10 m voraus – Gas, ohne Bremse. */
function follow(s: KartState, lat: number): Cmd {
  const t = TRACK;
  projectOnTrack(t, s.x, s.z, s.seg);
  let a = proj.seg;
  for (let k = 0; k < 10; k++) a = t.next[a];
  const tx = t.px[a] + rightX(t, a) * lat;
  const tz = t.pz[a] + rightZ(t, a) * lat;
  let err = Math.atan2(tx - s.x, tz - s.z) - s.heading;
  while (err > Math.PI) err -= 2 * Math.PI;
  while (err < -Math.PI) err += 2 * Math.PI;
  return { steer: Math.max(-127, Math.min(127, Math.round(-err * 400))), buttons: 1 };
}

/** Rennzeit (Ticks) des ersten Starts ab from. */
function launchAfter(from: number): number {
  const p = TRACK.pulses.find((q) => q.kind === PULSE_FLAME)!;
  let t = from;
  while (pulseCycle(p, t) !== 0) t++;
  return t;
}

/**
 * KI-Fahrer von start bis goal (Abschnitte der Hauptstrecke) ab Rennzeit t0, Weg fest (route ≥ 0) oder frei gewählt (−1):
 * Fahrzeit (s), Stürze, Treffer, ob er auf der Abzweigung k war und wann er ihre Mündung erreichte.
 */
function run(start: number, goal: number, route: number, t0: number, k: number): { time: number; falls: number; hits: number; onBranch: boolean; mouth: number } {
  const t = TRACK;
  const s = gridState(0);
  placeAt(s, start, 0, 22);
  const brain = newBrain(0, AI_HARD);
  if (route >= 0) {
    brain.route = route;
    brain.routeLock = true;
  }
  let progress = t.prog[start];
  const need = progress + progDelta(t, start, goal);
  let falls = 0;
  let hits = 0;
  let onBranch = false;
  let mouth = -1;
  for (let tick = t0; tick < t0 + 60 * 60; tick++) {
    const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
    const before = s.seg;
    const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
    if (ev & EV_FALL) falls++;
    if (ev & EV_HIT) hits++;
    if (mouth < 0 && t.branchOf[s.seg] === k) mouth = tick;
    if (t.branchOf[s.seg] === k && t.twin[s.seg] < 0) onBranch = true;
    progress = addProgress(t, progress, before, s.seg);
    if (progress >= need) return { time: (tick - t0) / 60, falls, hits, onBranch, mouth };
  }
  return { time: Infinity, falls, hits, onBranch, mouth };
}

describe('Startrampe', () => {
  const t = getTrack(RAMPE);

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
    console.log(`Startrampe: ${t.length.toFixed(0)} m, Höhe ${lo.toFixed(1)} … ${hi.toFixed(1)} m, steil ${steep.toFixed(0)} m, Steilkurve ${((Math.atan(bank) * 180) / Math.PI).toFixed(1)}°, ${(turn / (2 * Math.PI)).toFixed(2)} Umdrehungen`);
    expect(hi - lo).toBeGreaterThan(40);
    expect(steep).toBeGreaterThan(300);
    expect((Math.atan(bank) * 180) / Math.PI).toBeGreaterThan(25);
    expect(turn / (2 * Math.PI)).toBeGreaterThan(3);
    // Fahrarten je Runde (auf der Hauptstrecke): Steilkurven-Wendel, Schwebeband an der Wand, Gleitflug – und Straße
    const main = (test: (s: number) => boolean): number => {
      let k = 0;
      for (let s = 0; s < t.n; s++) if (test(s)) k++;
      return k * t.step;
    };
    const wendel = main((s) => Math.abs(t.bank[s]) > 0.42);
    const band = main((s) => (t.edge[s] & EDGE_BAND) !== 0);
    const glide = main((s) => (t.edge[s] & EDGE_GLIDE) !== 0);
    console.log(`Startrampe Fahrarten: Steilkurve ${wendel.toFixed(0)} m, Schwebeband ${band.toFixed(0)} m, Gleitflug ${glide.toFixed(0)} m`);
    expect(wendel).toBeGreaterThan(250);
    expect(band).toBeGreaterThan(150);
    expect(glide).toBeGreaterThan(120);
    expect(main((s) => (t.edge[s] & (EDGE_BAND | EDGE_GLIDE)) === 0 && Math.abs(t.bank[s]) < 0.3)).toBeGreaterThan(600);
    // bewegte bzw. getaktete Hindernisse: der Raupentransporter und der Abgasstrahl
    expect(t.crawler).not.toBeNull();
    expect(t.pulses.filter((p) => p.kind === PULSE_FLAME).length).toBeGreaterThanOrEqual(1);
    expect(t.winds.length).toBeGreaterThanOrEqual(1);
    expect(t.def.branches!.map((b) => b.shortcut)).toEqual(['window', 'train']);
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

  it('Starttakt: Abgasstrahl, Abgasstoß und das Tor des Flammengrabens folgen ihm', () => {
    setTrack(RAMPE);
    const P = STARTTAKT.period * 60;
    const flames = t.pulses.filter((p) => p.kind === PULSE_FLAME);
    for (const p of flames) {
      expect(p.period).toBe(P);
      expect(pulseCycle(p, STARTTAKT.first * 60)).toBe(0);
    }
    // Der Abgasstoß setzt mit dem Start ein.
    const w = t.winds[0];
    expect(gustStrength(w, STARTTAKT.first * 60 - 1)).toBe(0);
    expect(gustStrength(w, STARTTAKT.first * 60 + 40)).toBe(1);
    // Das Tor ist beim Start und kurz davor zu, eine Weile danach wieder offen.
    const gate = t.gates.find((g) => t.branchOf[g.first] === 0)!;
    for (let k = 0; k < 3; k++) {
      const launch = (STARTTAKT.first + k * STARTTAKT.period) * 60;
      expect(planActive(gate.plan, launch)).toBe(true);
      expect(planActive(gate.plan, launch - 8 * 60)).toBe(true);
      expect(planActive(gate.plan, launch + 6 * 60)).toBe(false);
      expect(planActive(gate.plan, launch - 12 * 60)).toBe(false);
    }
  });

  it('Flammengraben: die KI nimmt ihn nur, wenn er offen ist – dann spart er 1,5–4 s; beim Start brennt es darin', () => {
    setTrack(RAMPE);
    const k = 0;
    const b = t.branches[k];
    const start = (b.from - 90 + t.n) % t.n;
    const goal = (b.to + 20) % t.n;
    const around = withoutMechanics(() => run(start, goal, 0, 600, k));
    const gate = t.gates.find((g) => t.branchOf[g.first] === k)!;
    let best = Infinity;
    let used = 0;
    let runs = 0;
    let hits = 0;
    for (let t0 = 600; t0 < 600 + gate.plan.period; t0 += 30) {
      const r = run(start, goal, -1, t0, k);
      runs++;
      expect(r.falls).toBe(0);
      hits += r.hits;
      if (r.onBranch) {
        used++;
        best = Math.min(best, r.time);
        // … und nur, wenn das Tor offen war, als sie die Mündung erreichte
        expect(planActive(gate.plan, r.mouth)).toBe(false);
      }
    }
    console.log(`Startrampe Flammengraben: außen herum ${around.time.toFixed(2)} s · durch den Graben (bestes Zeitfenster) ${best.toFixed(2)} s · genommen in ${used} von ${runs} Anfahrten, ${hits} Treffer`);
    expect(used).toBeGreaterThan(0);
    expect(around.time - best).toBeGreaterThan(1.5);
    expect(around.time - best).toBeLessThan(4);
    expect(hits).toBeLessThanOrEqual(Math.ceil(runs * 0.15));
    // Wer beim Start im Graben steht, wird getroffen.
    const boom = launchAfter(600);
    const s = gridState(0);
    placeAt(s, b.first + (b.count >> 1), 0, 0);
    let hit = false;
    for (let tick = boom - 3; tick < boom + 6; tick++) if (stepKart(s, COAST, { canDrive: true, speedFactor: 1, time: tick }) & EV_HIT) hit = true;
    expect(hit).toBe(true);
  });

  it('Abgasstrahl: wer in der Flammenzone steht, wird geworfen; rings herum schiebt der Abgasstoß; die KI wird selten erwischt', () => {
    setTrack(RAMPE);
    const p = t.pulses.find((q) => q.kind === PULSE_FLAME && t.branchOf[q.seg] < 0)!;
    const boom = launchAfter(600);
    const s = gridState(0);
    placeAt(s, p.seg, p.lat, 0);
    let hit = false;
    for (let tick = boom - 3; tick < boom + 6; tick++) if (stepKart(s, COAST, { canDrive: true, speedFactor: 1, time: tick }) & EV_HIT) hit = true;
    expect(hit).toBe(true);
    expect(s.flags & FLAG_AIR).not.toBe(0);
    // Abgasstoß: rechts neben der Flammenzone, ohne zu lenken – das Kart wird nach rechts geschoben.
    const w = t.winds[0];
    const seg = w.first + Math.round(w.count * 0.6);
    const q = gridState(1);
    placeAt(q, seg, 2, 0);
    const x0 = q.x;
    const z0 = q.z;
    for (let tick = boom; tick < boom + 90; tick++) stepKart(q, COAST, { canDrive: true, speedFactor: 1, time: tick });
    const side = (q.x - x0) * rightX(t, seg) + (q.z - z0) * rightZ(t, seg);
    console.log(`Startrampe Abgasstoß: ${side.toFixed(2)} m zur Seite in 1,5 s`);
    expect(side).toBeGreaterThan(1.5);
    // Die KI fährt viele Male durch die Flammenzone: selten getroffen.
    let hits = 0;
    let runs = 0;
    for (let t0 = boom - 9 * 60; t0 < boom + 3 * 60; t0 += 17) {
      const k = gridState(2);
      placeAt(k, (p.seg - 120 + t.n) % t.n, 0, 22);
      const brain = newBrain(2, AI_HARD);
      brain.route = 0;
      brain.routeLock = true;
      for (let tick = t0; tick < t0 + 9 * 60; tick++) {
        const cmd = botCmd(k, brain, [], true, { tick, time: tick, place: 1, smoke: false });
        if (stepKart(k, cmd, { canDrive: true, speedFactor: brain.skill, time: tick }) & EV_HIT) hits++;
      }
      runs++;
    }
    console.log(`Startrampe Flammenzone: KI ${hits} Treffer in ${runs} Durchfahrten rund um den Start`);
    expect(hits).toBeLessThanOrEqual(Math.ceil(runs * 0.2));
  });

  it('Transporterdach: offen nur, solange die Plattform den Graben überbrückt – die KI spart dann 1,5–4 s und stürzt nie', () => {
    setTrack(RAMPE);
    const k = 1;
    const c = t.crawler!;
    const b = t.branches[k];
    const gate = t.gates.find((g) => t.branchOf[g.first] === k)!;
    // Die Plattform liegt genau auf Höhe der Fahrbahn und reicht über den ganzen Graben.
    expect(Math.abs(c.top - t.py[c.first])).toBeLessThan(0.15);
    for (const g of [c.first, c.last]) {
      expect(t.edge[g] & EDGE_GAP).not.toBe(0);
      const w = Math.abs(-(t.px[g] - c.x0) * c.uz + (t.pz[g] - c.z0) * c.ux);
      expect(w + t.step / 2).toBeLessThan(CRAWLER_HALF_WIDTH + 0.1);
    }
    // Ist die Schranke offen, steht die Plattform über dem Graben, wenn man dort ankommt.
    const toGap = (c.first - b.first) * t.step;
    for (let time = 600; time < 600 + c.plan.period; time += 5) {
      if (planActive(gate.plan, time)) continue;
      expect(crawlerAt(c.plan, time + (toGap / 26) * 60)).toBeLessThanOrEqual(c.cover);
    }
    const start = (b.from - 90 + t.n) % t.n;
    const goal = (b.to + 20) % t.n;
    const around = withoutMechanics(() => run(start, goal, 0, 600, k));
    let best = Infinity;
    let used = 0;
    let runs = 0;
    for (let t0 = 600; t0 < 600 + c.plan.period; t0 += 20) {
      const r = run(start, goal, -1, t0, k);
      runs++;
      expect(r.falls).toBe(0);
      if (r.onBranch) {
        used++;
        best = Math.min(best, r.time);
        expect(planActive(gate.plan, r.mouth)).toBe(false);
      }
    }
    console.log(`Startrampe Transporterdach: durch den Kriechweg ${around.time.toFixed(2)} s · über die Plattform (bestes Zeitfenster) ${best.toFixed(2)} s · genommen in ${used} von ${runs} Anfahrten`);
    expect(used).toBeGreaterThan(0);
    expect(around.time - best).toBeGreaterThan(1.5);
    expect(around.time - best).toBeLessThan(4);
    // Ohne Transporter ist dort ein Graben: wer hineinfährt, stürzt und wird vor der Gabelung neu aufgesetzt.
    let away = 600;
    while (crawlerAt(c.plan, away) < c.plan.length - 1) away++;
    const s = gridState(0);
    placeAt(s, c.first - 8, 0, 22);
    let fell = false;
    for (let tick = away; tick < away + 120 && !fell; tick++) if (stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: tick }) & EV_FALL) fell = true;
    expect(fell).toBe(true);
    expect(t.branchOf[s.seg]).toBe(-1);
  });

  it('Raupentransporter: die Böcke sind fahrende Wände, unter der Plattform kommt man hindurch, die KI weicht aus', () => {
    setTrack(RAMPE);
    const c = t.crawler!;
    // Die Stelle, an der die Hauptstraße den Kriechweg quert
    let m = -1;
    let best = Infinity;
    for (let i = 0; i < t.n; i++) {
      const d = Math.abs(-(t.px[i] - c.x0) * c.uz + (t.pz[i] - c.z0) * c.ux);
      if (d < best && t.py[i] < c.floor + 1) {
        best = d;
        m = i;
      }
    }
    expect(best).toBeLessThan(1);
    // Am Ende 1 steht die Plattform über der Straße, die Böcke daneben: In der Mitte fährt man ungehindert hindurch.
    let parked = 600;
    while (crawlerAt(c.plan, parked) < c.plan.length - 0.01) parked++;
    const pose = crawlerPose(c, parked, { x: 0, z: 0, vx: 0, vz: 0 });
    const lat = (pose.x - t.px[m]) * rightX(t, m) + (pose.z - t.pz[m]) * rightZ(t, m);
    expect(Math.abs(lat)).toBeLessThan(2);
    expect(CRAWLER_LEG_U - CRAWLER_LEG_HALF).toBeGreaterThan(t.rh[m]);
    const s = gridState(0);
    placeAt(s, (m - 14 + t.n) % t.n, lat, 20);
    let wall = false;
    for (let tick = parked; tick < parked + 80; tick++) if (stepKart(s, follow(s, lat), { canDrive: true, speedFactor: 1, time: tick }) & (EV_WALL | EV_HIT)) wall = true;
    expect(wall).toBe(false);
    expect(progDelta(t, m, s.seg)).toBeGreaterThan(5);
    // Wer geradewegs auf einen Bock zufährt, prallt ab und kommt nicht hindurch.
    const q = gridState(1);
    const legLat = lat + (CRAWLER_LEG_U * ((c.ux * rightX(t, m) + c.uz * rightZ(t, m)) > 0 ? 1 : -1));
    placeAt(q, (m - 14 + t.n) % t.n, legLat, 20);
    let bounced = false;
    for (let tick = parked; tick < parked + 90; tick++) if (stepKart(q, follow(q, legLat), { canDrive: true, speedFactor: 1, time: tick }) & EV_WALL) bounced = true;
    expect(bounced).toBe(true);
    // Die KI fährt über einen ganzen Umlauf hinweg viele Male über den Kriechweg: selten angeeckt, nie gestürzt.
    let walls = 0;
    let hits = 0;
    let runs = 0;
    for (let t0 = 600; t0 < 600 + c.plan.period; t0 += 23) {
      const r = gridState(2);
      placeAt(r, (m - 110 + t.n) % t.n, 0, 22);
      const brain = newBrain(2, AI_HARD);
      brain.route = 0;
      brain.routeLock = true;
      for (let tick = t0; tick < t0 + 8 * 60; tick++) {
        const cmd = botCmd(r, brain, [], true, { tick, time: tick, place: 1, smoke: false });
        const ev = stepKart(r, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
        if (ev & EV_WALL) walls++;
        if (ev & EV_HIT) hits++;
        expect(ev & EV_FALL).toBe(0);
      }
      runs++;
    }
    console.log(`Startrampe Kriechweg: KI ${walls}× an einem Bock, ${hits} Treffer in ${runs} Durchfahrten`);
    expect(walls + hits).toBeLessThanOrEqual(Math.ceil(runs * 0.3));
  });

  it('Magnetring: das Band dreht sich weich bis senkrecht an die Wand rings um die Rakete – und hält dort wie flach', () => {
    setTrack(RAMPE);
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
    console.log(`Startrampe Magnetring: ${wall.toFixed(0)} m an der Wand, höchstens ${((maxStep * 180) / Math.PI).toFixed(2)}° Drehung je Meter`);
    expect(wall).toBeGreaterThan(60);
    expect((maxStep * 180) / Math.PI).toBeLessThan(4.5);
    // An der Wand steht die Fahrbahn senkrecht, rings um die Rakete im Abstand des Rings.
    let seg = first;
    while (t.roll[seg] < Math.PI / 2 - 1e-3) seg = t.next[seg];
    const a = { x: 0, y: 0, z: 0 };
    const c = { x: 0, y: 0, z: 0 };
    twistWarp(t, seg, 0, -4, 0, a);
    twistWarp(t, seg, 0, 4, 0, c);
    expect(Math.hypot(c.x - a.x, c.z - a.z)).toBeLessThan(1e-6);
    expect(c.y - a.y).toBeCloseTo(8, 6);
    expect(Math.hypot(a.x - RAKETE.x, a.z - RAKETE.z)).toBeGreaterThan(RAKETE.r + RAKETE.axis - 1.5);
    expect(Math.hypot(a.x - RAKETE.x, a.z - RAKETE.z)).toBeLessThan(RAKETE.r + RAKETE.axis + 1.5);
    // Fahren an der Wand: mindestens so gut wie auf flachem Band.
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
    // Halt und Tempo mindestens wie flach: nichts sackt ab, nichts rutscht. (Die Bahn ist nicht dieselbe: Den Teil der
    // Kurve, den man an der Wand nicht sieht, fährt das Band mit – siehe wandfahrt.test.ts.)
    expect(Math.hypot(onWall.vx, onWall.vz)).toBeGreaterThan(Math.hypot(flat.vx, flat.vz) - 0.5);
    expect(onWall.flags & 8).toBe(0);
  });
});

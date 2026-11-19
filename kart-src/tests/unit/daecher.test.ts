// Dächerjagd (Strecke 24) – Messlatte wie bei Gipfelbahn, Neonhochbahn, Talsperre und Baumkronenpfad.
//
// Die Ziele für neue Strecken: mindestens drei Fahrarten je Runde (hier steile Gassen mit Steilkurve und Treppengasse,
// über die Dächer mit Sprüngen, Gleitflug vom Kirchturm, Tauchen im Kanal – dazu die Straßenbahn), mindestens 40 m
// Höhenunterschied, mindestens 300 m mit mehr als 10 % Steigung oder Gefälle (die Treppengasse: bis 40 %), Steilkurven
// über 25° (die Bastei-Kehre), über drei volle Umdrehungen Kurve, zwei echte Abkürzungen mit Preis, ein bewegtes Hindernis
// (die Straßenbahn nach Fahrplan), eine Stelle, an der die Strecke sich selbst kreuzt (der Kanal unter der Brücke der
// Langen Gasse). Dazu, was die Strecke verspricht:
//   – Dachsprung-Kette ('risk'): drei Sprünge hintereinander – mit Tempo und gerade hinüber, zu langsam oder schief in die
//     Gasse; die KI kommt durch und spart deutlich;
//   – Markthalle ('item'): ohne Schub langsamer als außen herum, mit einem Zisch deutlich schneller;
//   – die Straßenbahn fährt nach Fahrplan auf ihrer Linie, hält an der Haltestelle und ist dazwischen eine fahrende Wand.

import { afterAll, describe, expect, it } from 'vitest';
import { TRACK_DEFS } from '../../src/game/tracks';
import { VEH_STADTBAHN, lineFront, vehicleAt, vehicleSpeed } from '../../src/game/mechanics';
import {
  EDGE_DECK,
  EDGE_GAP,
  EDGE_GLIDE,
  EDGE_OPEN_L,
  EDGE_OPEN_R,
  TRACK,
  addProgress,
  getTrack,
  newVehiclePose,
  progDelta,
  proj,
  projectOnTrack,
  rightX,
  rightZ,
  setTrack,
  trackHeading,
  vehiclePose,
} from '../../src/game/track';
import { SURFACE_INDEX } from '../../src/game/surface';
import { AI_EASY, AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import { BTN_ITEM, EV_FALL, EV_HIT, EV_RESPAWNED, EV_WALL, FLAG_AIR, ITEM_BOOST, gridState, stepKart, type Cmd, type KartState } from '../../src/game/sim';
import { withoutMechanics } from './helpers';

const DAECHER = TRACK_DEFS.findIndex((d) => d.id === 'daecher');
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
 * KI (Weg fest) von 80 m vor der Gabelung der Abzweigung k bis 20 m hinter ihrer Einmündung: Zeit und Stürze.
 * t0 = Rennzeit beim Start (Ticks), level = Stärke.
 */
function stretch(k: number, route: number, t0 = 600, level = AI_HARD): { time: number; falls: number } {
  const t = TRACK;
  const b = t.branches[k];
  const start = (b.from - 80 + t.n) % t.n;
  const goal = (b.to + 20) % t.n;
  const s = gridState(0);
  placeAt(s, start, 0, 22);
  const brain = newBrain(0, level);
  brain.route = route;
  brain.routeLock = true;
  let progress = t.prog[start];
  const need = progress + progDelta(t, start, goal);
  let falls = 0;
  for (let tick = t0; tick < t0 + 60 * 60; tick++) {
    const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
    const before = s.seg;
    if (stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick }) & EV_FALL) falls++;
    progress = addProgress(t, progress, before, s.seg);
    if (progress >= need) return { time: (tick - t0) / 60, falls };
  }
  return { time: Infinity, falls };
}

/** Ersparnis einer Abkürzung mit der guten KI (bei verschiedenen Startzeiten) und die Stürze dabei. */
function gain(k: number): { around: number; best: number; worst: number; falls: number } {
  const around = stretch(k, 0);
  expect(around.falls).toBe(0);
  let falls = 0;
  let best = Infinity;
  let worst = 0;
  for (const t0 of [600, 1000, 1400, 1800]) {
    const r = stretch(k, 1 << k, t0);
    falls += r.falls;
    best = Math.min(best, r.time);
    worst = Math.max(worst, r.time);
  }
  return { around: around.time, best, worst, falls };
}

/** Ein KI-Fahrer allein, Weg fest gewählt; boost: beim Einbiegen in die Markthalle einen Zisch zünden. Rundenzeit der zweiten Runde. */
function lap(route: number, boost: boolean): { time: number; falls: number } {
  setTrack(DAECHER);
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
    const inHall = TRACK.branchOf[s.seg] === 1 && TRACK.twin[s.seg] < 0;
    if (!inHall) fired = false;
    if (boost && inHall && !fired) {
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

describe('Dächerjagd', () => {
  const t = getTrack(DAECHER);

  it('erfüllt die Messlatte: Länge, Höhe, Steilstücke, Steilkurve, Kurven, Fahrarten, Hindernis, Kreuzung', () => {
    expect(t.def.name).toBe('Dächerjagd');
    expect(t.length).toBeGreaterThan(1500);
    expect(t.length).toBeLessThan(1700);
    expect(t.laps).toBe(3);
    let lo = Infinity;
    let hi = -Infinity;
    let steep = 0;
    let steepest = 0;
    let bank = 0;
    let turn = 0;
    for (let s = 0; s < t.n; s++) {
      lo = Math.min(lo, t.py[s]);
      hi = Math.max(hi, t.py[s]);
      const s5 = (s + 5) % t.n;
      const slope = Math.abs(t.py[s5] - t.py[s]) / (5 * t.step);
      if (slope > 0.1) steep += t.step;
      // (ohne Flug, gemessen ohne die Absprungkanten – t.base ist der Verlauf vor Schanzen und Kuppen)
      if ((t.edge[s] & EDGE_GLIDE) === 0) steepest = Math.max(steepest, Math.abs(t.base[s5] - t.base[s]) / (5 * t.step));
      bank = Math.max(bank, Math.abs(t.bank[s]));
      const n = (s + 1) % t.n;
      turn += Math.abs(Math.atan2(t.tx[s] * t.tz[n] - t.tz[s] * t.tx[n], t.tx[s] * t.tx[n] + t.tz[s] * t.tz[n]));
    }
    const deg = (Math.atan(bank) * 180) / Math.PI;
    console.log(
      `Dächerjagd: ${t.length.toFixed(0)} m, Höhe ${lo.toFixed(1)}–${hi.toFixed(1)} m, ${steep.toFixed(0)} m über 10 %, steilste Gasse ${(steepest * 100).toFixed(0)} %, Steilkurve ${deg.toFixed(1)}°, ${(turn / (2 * Math.PI)).toFixed(2)} Umdrehungen`,
    );
    expect(hi - lo).toBeGreaterThan(40);
    expect(steep).toBeGreaterThan(300);
    // Die Treppengasse: steil wie eine Rampe (bis 40 %), aber nicht steiler.
    expect(steepest).toBeGreaterThan(0.35);
    expect(steepest).toBeLessThan(0.42);
    expect(deg).toBeGreaterThan(25);
    expect(deg).toBeLessThan(36);
    expect(turn / (2 * Math.PI)).toBeGreaterThan(3);
    // Fahrarten je Runde (auf der Hauptstrecke): Gassen (Pflaster), über die Dächer (Dachziegel, frei stehend, mit Sprung),
    // Gleitflug vom Kirchturm, Tauchen im Kanal.
    const main = (test: (s: number) => boolean): number => {
      let k = 0;
      for (let s = 0; s < t.n; s++) if (test(s)) k++;
      return k * t.step;
    };
    const roofs = main((s) => t.surf[s] === SURFACE_INDEX.tiles && (t.edge[s] & EDGE_DECK) !== 0);
    const alleys = main((s) => t.surf[s] === SURFACE_INDEX.cobble && (t.edge[s] & EDGE_DECK) === 0 && !t.deep[s]);
    const glide = main((s) => (t.edge[s] & EDGE_GLIDE) !== 0);
    const under = main((s) => t.deep[s] !== 0 && t.py[s] < t.sea - 1);
    const gaps = main((s) => (t.edge[s] & (EDGE_GAP | EDGE_GLIDE)) === EDGE_GAP);
    console.log(`Dächerjagd Fahrarten: Gassen ${alleys.toFixed(0)} m, Dächer ${roofs.toFixed(0)} m (Lücke ${gaps.toFixed(0)} m), Gleitflug ${glide.toFixed(0)} m, unter Wasser ${under.toFixed(0)} m`);
    expect(alleys).toBeGreaterThan(400);
    expect(roofs).toBeGreaterThan(100);
    expect(gaps).toBeGreaterThan(3);
    expect(glide).toBeGreaterThan(100);
    expect(under).toBeGreaterThan(80);
    // Der Gleitflug beginnt am Kirchturm – dem höchsten Punkt der Runde.
    let jump = -1;
    for (let s = 0; s < t.n && jump < 0; s++) if (t.edge[s] & EDGE_GLIDE) jump = s;
    expect(t.py[jump]).toBeGreaterThan(hi - 1.5);
    // bewegtes Hindernis: die Straßenbahn
    expect(t.vehicles.filter((v) => v.kind === VEH_STADTBAHN).length).toBeGreaterThanOrEqual(1);
    expect(t.def.branches!.map((b) => b.shortcut)).toEqual(['risk', 'item']);
    // Die Strecke kreuzt sich selbst: Der Kanal führt unter der Brücke der Langen Gasse hindurch.
    let crossing = false;
    for (let a = 0; a < t.n && !crossing; a++) {
      if (!t.deep[a] || t.py[a] > t.sea - 3) continue;
      for (let b = 0; b < t.n; b++) {
        if (Math.abs(progDelta(t, a, b)) < 80 || (t.edge[b] & EDGE_DECK) === 0) continue;
        if (Math.hypot(t.px[a] - t.px[b], t.pz[a] - t.pz[b]) < 3 && t.py[b] - t.py[a] > 6) crossing = true;
      }
    }
    expect(crossing).toBe(true);
  });

  it('Bastei-Kehre: eine Linkskurve, nach innen gut 30° geneigt', () => {
    let seg = 0;
    for (let i = 0; i < t.n; i++) if (Math.abs(t.bank[i]) > Math.abs(t.bank[seg])) seg = i;
    expect(t.bank[seg]).toBeGreaterThan(0);
    expect(t.curv[seg]).toBeLessThan(-1 / 45);
  });

  it('Straßenbahn: fährt nach Fahrplan auf ihrer Linie, hält an der Haltestelle, ist sonst weg', () => {
    setTrack(DAECHER);
    const trams = t.vehicles.filter((v) => v.line);
    expect(trams.length).toBeGreaterThanOrEqual(1);
    const v = trams[0];
    const line = v.line!;
    const lap = t.n * t.step;
    const pose = newVehiclePose();
    // Die Linie liegt fast ganz auf der Spur der Langen Gasse: Nur Anfang und Ende (Remise, Seitengasse) verlassen sie.
    let onLane = 0;
    for (let i = 0; i < line.n; i++) if (Math.abs(line.lat[i] - 2.4) < 0.5) onLane++;
    expect(onLane / line.n).toBeGreaterThan(0.5);
    let present = 0;
    let gone = 0;
    let halted = 0;
    let moving = 0;
    const plan = line.plan;
    for (let time = 0; time < plan.period * plan.trains * 2; time += 3) {
      const at = vehicleAt(v, time, lap);
      if (!Number.isFinite(at)) {
        gone++;
        expect(vehiclePose(t, v, 0, time, pose).seg).toBe(-1);
        continue;
      }
      present++;
      // auf der Linie: der vorderste Wagen liegt zwischen Remise und Seitengasse, gezählt auf der Hauptstrecke
      expect(vehiclePose(t, v, 0, time, pose).seg >= 0 || vehiclePose(t, v, v.cars - 1, time, pose).seg >= 0).toBe(true);
      const sp = vehicleSpeed(v, time);
      if (sp < 0.05) {
        halted++;
        // gehalten wird mit der Spitze an der Haltestelle
        expect(lineFront(v, time)).toBeCloseTo(plan.stop, 1);
      } else moving++;
      expect(sp).toBeLessThanOrEqual(plan.speed + 1e-6);
    }
    console.log(`Dächerjagd Straßenbahn: ${trams.length} Züge im Umlauf, Linie ${line.n} m, Haltestelle bei ${plan.stop.toFixed(0)} m · Stichproben: unterwegs ${moving}, hält ${halted}, nicht da ${gone}`);
    expect(halted).toBeGreaterThan(0);
    expect(moving).toBeGreaterThan(halted);
    expect(gone).toBeGreaterThan(0);
    // Nach festem Takt: dieselbe Rennzeit, derselbe Stand.
    expect(vehicleAt(v, 1234, lap)).toBe(vehicleAt(v, 1234 + plan.period * plan.trains, lap));
  });

  it('Straßenbahn: eine fahrende Wand – wer mit Tempo ins Heck der haltenden Bahn fährt, schleudert', () => {
    setTrack(DAECHER);
    const v = t.vehicles.find((x) => x.line)!;
    const plan = v.line!.plan;
    // Ein Augenblick, in dem der Zug an der Haltestelle steht.
    let t0 = 0;
    while (vehicleSpeed(v, t0) > 0.01 || !Number.isFinite(vehicleAt(v, t0, t.n * t.step))) t0++;
    expect(t0).toBeLessThan(plan.period * plan.trains);
    const pose = newVehiclePose();
    const tail = vehiclePose(t, v, v.cars - 1, t0, pose);
    const s = gridState(0);
    const seg = tail.seg;
    placeAt(s, (seg - 14 + t.n) % t.n, tail.lat, 24);
    let hit = false;
    for (let tick = t0; tick < t0 + 60; tick++) if (stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: tick }) & (EV_HIT | EV_WALL)) hit = true;
    expect(hit).toBe(true);
  });

  it('Dachsprung-Kette: drei Sprünge – mit Tempo gerade hinüber, zu langsam oder schief in die Gasse', () => {
    setTrack(DAECHER);
    const k = 0;
    const b = t.branches[k];
    const gaps: number[] = [];
    for (let i = 0; i < b.count; i++) {
      const g = b.first + i;
      if ((t.edge[g] & EDGE_GAP) !== 0 && (t.edge[g - 1] & EDGE_GAP) === 0) gaps.push(g);
    }
    expect(gaps.length).toBe(3);
    const mid = b.first + (b.count >> 1);
    expect(t.edge[mid] & EDGE_OPEN_L).not.toBe(0);
    expect(t.edge[mid] & EDGE_OPEN_R).not.toBe(0);
    // Ein Fahrer, der die Mitte hält, mit Vollgas oder ohne Gas. skew: so schief (Grad) springt er an der ersten Kante
    // ab – dann lenkt er nicht mehr gegen.
    const run = (back: number, v: number, gas: boolean, skew = 0): boolean => {
      const s = gridState(0);
      placeAt(s, gaps[0] - back, 0, v);
      if (skew !== 0) {
        s.heading += (skew * Math.PI) / 180;
        s.vx = Math.sin(s.heading) * v;
        s.vz = Math.cos(s.heading) * v;
      }
      let fell = false;
      for (let tick = 0; tick < 300 && !fell; tick++) {
        projectOnTrack(t, s.x, s.z, s.seg);
        let dh = trackHeading(t, proj.seg) - s.heading;
        while (dh > Math.PI) dh -= 2 * Math.PI;
        while (dh < -Math.PI) dh += 2 * Math.PI;
        const keep = skew !== 0 ? 0 : Math.max(-127, Math.min(127, Math.round((-proj.lat * 0.35 - dh * 2.5) * 127)));
        const ev = stepKart(s, { steer: keep, buttons: gas ? 1 : 0 }, { canDrive: true, speedFactor: 1, time: tick });
        if (ev & EV_FALL) fell = true;
        if (t.branchOf[s.seg] !== k && s.seg !== b.from && t.twin[s.seg] < 0 && tick > 30) break;
      }
      return fell;
    };
    console.log(`Dächerjagd Dachsprünge: gerade ${run(14, 24, true)}, langsam ${run(3, 8, false)}, schief ${run(6, 24, true, 14)}`);
    // Mit Tempo und gerade: über alle drei Gassen.
    expect(run(14, 24, true)).toBe(false);
    // Zu langsam (ohne Anlauf über die Kante gerollt): in die erste Gasse.
    expect(run(3, 8, false)).toBe(true);
    // Schief abgesprungen: neben dem nächsten Dach vorbei, in die Gasse.
    expect(run(6, 24, true, 14)).toBe(true);
    // Aufgesetzt wird mit Anlauf vor dem Sprung – auf festem Dach.
    for (const g of gaps) {
      expect(t.edge[t.respawn[g]] & EDGE_GAP).toBe(0);
      expect(progDelta(t, t.respawn[g], g)).toBeGreaterThan(10);
    }
    const r = gain(k);
    console.log(`Dächerjagd Dachsprung-Kette: Umweg ${r.around.toFixed(2)} s · über die Dächer ${r.best.toFixed(2)}–${r.worst.toFixed(2)} s · Stürze ${r.falls}`);
    expect(r.falls).toBe(0);
    expect(r.around - r.worst).toBeGreaterThan(1.5);
    expect(r.around - r.best).toBeLessThan(4);
    // Auch die vorsichtige KI fällt selten (von acht Fahrten höchstens eine).
    let easyFalls = 0;
    for (const level of [AI_EASY, AI_MEDIUM]) for (const t0 of [700, 1300, 1900, 2500]) easyFalls += stretch(k, 1 << k, t0, level).falls;
    expect(easyFalls).toBeLessThanOrEqual(1);
  });

  it('Markthalle: ohne Schub langsamer als außen herum, mit Zisch deutlich schneller', () => {
    // Verglichen wird der Weg, nicht das Glück mit der Straßenbahn: ohne Streckenmechanik.
    setTrack(DAECHER);
    const road = withoutMechanics(() => lap(0, false));
    const hall = withoutMechanics(() => lap(2, false));
    const hallBoost = withoutMechanics(() => lap(2, true));
    console.log(`Dächerjagd Markthalle: außen herum ${road.time.toFixed(2)} s · durch die Halle ${hall.time.toFixed(2)} s · mit Zisch ${hallBoost.time.toFixed(2)} s`);
    expect(road.falls + hall.falls + hallBoost.falls).toBe(0);
    expect(hall.time).toBeGreaterThan(road.time - 1);
    expect(road.time - hallBoost.time).toBeGreaterThan(1.5);
  });

  it('Treppengasse: steil hinab – mit Tempo hebt man oben an der Kante ab, unten geht es ins Wasser', () => {
    setTrack(DAECHER);
    // steilstes Stück der Runde (ohne Flug)
    let top = 0;
    let best = 0;
    for (let s = 0; s < t.n; s++) {
      if (t.edge[s] & EDGE_GLIDE) continue;
      const d = (t.base[s] - t.base[(s + 5) % t.n]) / (5 * t.step);
      if (d > best) {
        best = d;
        top = s;
      }
    }
    expect(best).toBeGreaterThan(0.35);
    // Die Treppe führt ins Wasser: nicht weit dahinter wird getaucht.
    let wet = -1;
    for (let k = 0; k < 120 && wet < 0; k++) if (t.deep[(top + k) % t.n] && t.py[(top + k) % t.n] < t.sea - 1) wet = k;
    expect(wet).toBeGreaterThan(0);
    // Von oben mit Tempo hinunter: kurz in der Luft, ohne Sturz.
    let start = top;
    while (t.py[t.prev[start]] - t.py[start] > 0.1) start = t.prev[start];
    const s = gridState(0);
    placeAt(s, (start - 12 + t.n) % t.n, 0, 24);
    let air = 0;
    let fell = false;
    for (let tick = 0; tick < 150; tick++) {
      if (stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: tick }) & EV_FALL) fell = true;
      if (s.flags & FLAG_AIR) air++;
    }
    expect(fell).toBe(false);
    expect(air).toBeGreaterThan(10);
  });

  it('jeder Weg ohne Mechanik fahrbar – die Dachsprung-Kette auch ohne Straßenbahn schneller', () => {
    setTrack(DAECHER);
    const plain = withoutMechanics(() => stretch(0, 0).time - stretch(0, 1).time);
    expect(plain).toBeGreaterThan(1.5);
    // Nach einem Sturz in die Gasse geht es weiter: aufgesetzt wird auf festem Dach.
    let gap = t.branches[0].first;
    while ((t.edge[gap] & EDGE_GAP) === 0) gap++;
    const s = gridState(0);
    placeAt(s, gap - 2, 0, 6);
    let back = false;
    for (let tick = 0; tick < 400 && !back; tick++) if (stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: tick }) & EV_RESPAWNED) back = true;
    expect(back).toBe(true);
  });
});

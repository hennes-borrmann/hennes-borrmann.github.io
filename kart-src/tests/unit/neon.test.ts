// Neonhochbahn (Strecke 20) – Messlatte wie bei der Gipfelbahn, dazu die neue Fahrart Schwebeband.
//
// Die Ziele für neue Strecken: mindestens drei Fahrarten je Runde (hier Straße, Schwebeband mit Wandfahrt, Gleitflug,
// dazu das Zugdach), mindestens 40 m Höhenunterschied, mindestens 300 m mit mehr als 10 % Steigung oder Gefälle,
// Steilkurven über 25°, über drei volle Umdrehungen Kurve, zwei echte Abkürzungen mit Preis, ein bewegtes Hindernis,
// eine Stelle, an der die Strecke sich selbst kreuzt. Dazu, was das Schwebeband verspricht:
//   – an der Fassade fährt man wie auf der Straße (gerechnet wird flach, nur das Bild ist gedreht – nichts sackt ab);
//   – die Magnetlinien ziehen, und die KI fährt auf ihnen;
//   – wer sich berührt, stößt sich ab, und beide bekommen Schub; ebenso an den Prallpollern;
// und was die Abkürzung über das Zugdach verspricht: ohne Zug ein Graben, mit haltendem Zug deutlich schneller.

import { afterAll, describe, expect, it } from 'vitest';
import { TRACK_DEFS } from '../../src/game/tracks';
import { BAND_LINE_HALF, bandLineLat, metroFront, planActive } from '../../src/game/mechanics';
import {
  EDGE_BAND,
  EDGE_GLIDE,
  EDGE_TUNNEL,
  EDGE_TWIST,
  TRACK,
  addProgress,
  bandMeters,
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
import { AI_EASY, AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { EV_FALL, FLAG_AIR, bandRepel, gridState, onBandLine, stepKart, type Cmd, type KartState } from '../../src/game/sim';
import { withoutMechanics } from './helpers';

const NEON = TRACK_DEFS.findIndex((d) => d.id === 'neon');
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

describe('Neonhochbahn', () => {
  const t = getTrack(NEON);

  it('erfüllt die Messlatte: Länge, Höhe, Steilstücke, Steilkurven, Kurven, Fahrarten, Hindernisse, Kreuzung', () => {
    expect(t.length).toBeGreaterThan(1500);
    expect(t.length).toBeLessThan(1750);
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
    // Fahrarten je Runde (auf der Hauptstrecke): Straße, Schwebeband, Gleitflug – dazu Tunnel und Zugdach
    const main = (flag: number): number => {
      let k = 0;
      for (let s = 0; s < t.n; s++) if (t.edge[s] & flag) k++;
      return k * t.step;
    };
    expect(main(EDGE_BAND)).toBeGreaterThan(300);
    expect(main(EDGE_GLIDE)).toBeGreaterThan(80);
    expect(main(EDGE_TUNNEL)).toBeGreaterThan(20);
    expect(t.roofed && t.metro !== null).toBe(true);
    // bewegte Hindernisse: pendelnde Kehrroboter und die U-Bahn
    expect(t.hazards.length).toBeGreaterThanOrEqual(1);
    expect(t.vehicles.some((v) => v.plan)).toBe(true);
    expect(t.def.branches!.map((b) => b.shortcut)).toEqual(['risk', 'train']);
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

  it('Wandfahrt: das Band dreht sich weich bis senkrecht an die Fassade – und ist dort gerechnet wie flach', () => {
    setTrack(NEON);
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
    // mindestens 40 m senkrecht an der Wand, nie mehr als 3,5° Drehung je Meter (bei 27 m/s gut 90°/s)
    expect(wall).toBeGreaterThan(40);
    expect((maxStep * 180) / Math.PI).toBeLessThan(3.5);
    // An der Wand steht die Fahrbahn senkrecht: quer über sie hinweg geht es nur nach oben.
    let seg = first;
    while (t.roll[seg] < Math.PI / 2 - 1e-3) seg = t.next[seg];
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    twistWarp(t, seg, 0, -4, 0, a);
    twistWarp(t, seg, 0, 4, 0, b);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(1e-6);
    expect(b.y - a.y).toBeCloseTo(8, 6);
    // Fahren an der Wand = fahren auf flachem Band: dieselben Eingaben, dieselbe Bahn (nichts sackt ab, nichts rutscht).
    const drive = (): KartState => {
      const s = gridState(0);
      placeAt(s, t.prev[t.prev[seg]], 1.5, 24);
      for (let tick = 0; tick < 50; tick++) stepKart(s, { steer: tick < 25 ? 60 : -40, buttons: 1 }, { canDrive: true, speedFactor: 1, time: tick });
      return s;
    };
    const onWall = drive();
    const keep = t.roll;
    t.roll = new Float32Array(t.total);
    const flat = drive();
    t.roll = keep;
    expect(onWall.x).toBeCloseTo(flat.x, 9);
    expect(onWall.z).toBeCloseTo(flat.z, 9);
    expect(onWall.heading).toBeCloseTo(flat.heading, 9);
  });

  it('Magnetlinien: wer auf einer bleibt, fährt schneller; sie liegen auf jedem Bildschirm gleich', () => {
    setTrack(NEON);
    const band = t.bands[0];
    // ein gerades Stück am Anfang der Steigung
    const seg0 = band.first + 20;
    const run = (onLine: boolean): number => {
      const s = gridState(0);
      placeAt(s, seg0, 0, 22);
      for (let tick = 0; tick < 240; tick++) {
        projectOnTrack(t, s.x, s.z, s.seg);
        const m = bandMeters(t, band, proj.seg, proj.along);
        // die Linie bzw. ein Stück neben beiden Linien (Mitte zwischen den Linien, wo sie auseinanderlaufen)
        const line = bandLineLat(t.rh[proj.seg], m, tick, 0);
        const want = onLine ? line : line >= 0 ? line - 2.4 : line + 2.4;
        s.x += rightX(t, proj.seg) * (want - proj.lat);
        s.z += rightZ(t, proj.seg) * (want - proj.lat);
        s.heading = trackHeading(t, proj.seg);
        stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: tick });
      }
      return Math.hypot(s.vx, s.vz);
    };
    const on = run(true);
    const off = run(false);
    expect(on).toBeGreaterThan(off * 1.05);
    // Die Linien sind Spiegelbilder, wandern mit der Zeit voran und hängen nur von Stelle und Rennzeit ab.
    expect(bandLineLat(5.6, 30, 600, 0)).toBeCloseTo(-bandLineLat(5.6, 30, 600, 1), 12);
    expect(bandLineLat(5.6, 30 + 11, 600 + 60, 0)).toBeCloseTo(bandLineLat(5.6, 30, 600, 0), 9);
    expect(onBandLine(t, seg0, 0, bandLineLat(t.rh[seg0], bandMeters(t, band, seg0, 0), 300, 1), 300)).toBe(true);
    expect(BAND_LINE_HALF).toBeLessThan(1.2);
  });

  it('die KI fährt auf den Magnetlinien – die gute öfter als die vorsichtige', () => {
    setTrack(NEON);
    const share = (level: number): number => {
      const s = gridState(0);
      const brain = newBrain(0, level);
      let onBand = 0;
      let onLine = 0;
      for (let tick = 1; tick < 75 * 60; tick++) {
        const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
        stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
        if ((t.edge[s.seg] & EDGE_BAND) === 0 || (s.flags & FLAG_AIR) !== 0) continue;
        onBand++;
        projectOnTrack(t, s.x, s.z, s.seg);
        if (onBandLine(t, proj.seg, proj.along, proj.lat, tick)) onLine++;
      }
      return onLine / onBand;
    };
    const hard = share(AI_HARD);
    const easy = share(AI_EASY);
    console.log(`Neonhochbahn: Anteil auf den Magnetlinien – schwer ${(hard * 100).toFixed(0)} %, leicht ${(easy * 100).toFixed(0)} %`);
    expect(hard).toBeGreaterThan(0.4);
    expect(hard).toBeGreaterThan(easy + 0.1);
  });

  it('Abstoßen: zwei schwebende Karts stoßen sich ab, und beide bekommen Schub', () => {
    setTrack(NEON);
    const seg = t.bands[0].first + 40;
    const a = gridState(0);
    const b = gridState(1);
    placeAt(a, seg, -0.8, 22);
    placeAt(b, seg, 0.8, 24);
    expect(bandRepel(t, a, b)).toBe(true);
    expect(a.boost).toBeGreaterThan(20);
    expect(b.boost).toBeGreaterThan(20);
    // auseinander: a nach links, b nach rechts – und keiner hat Tempo in Fahrtrichtung verloren
    const side = (s: KartState): number => s.vx * rightX(t, seg) + s.vz * rightZ(t, seg);
    expect(side(a)).toBeLessThan(-1);
    expect(side(b)).toBeGreaterThan(1);
    const fwd = (s: KartState): number => s.vx * t.tx[seg] + s.vz * t.tz[seg];
    expect(fwd(a)).toBeCloseTo(22, 6);
    expect(fwd(b)).toBeCloseTo(24, 6);
    // Auf der Straße gilt der gewöhnliche Rempler.
    const c = gridState(2);
    const d = gridState(3);
    placeAt(c, 30, -0.8, 22);
    placeAt(d, 30, 0.8, 24);
    expect(bandRepel(t, c, d)).toBe(false);
  });

  it('Prallpoller: wer ihn streift, prallt ab und bekommt Schub', () => {
    setTrack(NEON);
    const p = t.bumpers[0];
    const s = gridState(0);
    // schräg auf den Poller zu
    placeAt(s, p.seg - 14, p.lat * 0.5, 22);
    const toward = Math.atan2(p.x - s.x, p.z - s.z);
    s.heading = toward;
    s.vx = Math.sin(toward) * 22;
    s.vz = Math.cos(toward) * 22;
    let boosted = false;
    for (let tick = 0; tick < 60 && !boosted; tick++) {
      stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: tick });
      if (s.boost > 20) boosted = true;
    }
    expect(boosted).toBe(true);
    // danach vom Poller weg
    const away = (s.x - p.x) * s.vx + (s.z - p.z) * s.vz;
    expect(away).toBeGreaterThan(0);
  });

  it('Zugdach: ohne Zug ein Graben – mit haltendem Zug deutlich schneller als außen herum', () => {
    setTrack(NEON);
    const m = t.metro!;
    const k = m.branch;
    const b = t.branches[k];
    const gate = t.gates.find((g) => t.branchOf[g.first] === k)!;
    // Solange das Tor offen ist, steht ein Zug im Bahnhof – und noch lange genug, um über ihn zu kommen.
    const trains = t.vehicles.filter((v) => v.plan);
    // (Wer durchs offene Tor fährt, ist mit höchstens 26 m/s am Graben und mit wenigstens 22 m/s hinter ihm.)
    const standing = (time: number): boolean => trains.some((v) => Math.abs(metroFront(v.plan!, v.train!, time) - m.plan.stop) < 0.5);
    const toTrench = (m.first - b.first) * t.step;
    const across = toTrench + (m.s1 - m.s0);
    for (let time = 600; time < 600 + m.plan.period * 2; time += 5) {
      if (!planActive(gate.plan, time)) expect(standing(time + (toTrench / 26) * 60) && standing(time + (across / 22) * 60)).toBe(true);
    }
    // Von 80 m vor der Gabelung bis 20 m hinter der Einmündung: außen herum bzw. über das Zugdach (KI, Weg fest).
    const start = (b.from - 80 + t.n) % t.n;
    const goal = (b.to + 20) % t.n;
    const run = (route: number, t0: number): { time: number; falls: number } => {
      const s = gridState(0);
      placeAt(s, start, 0, 24);
      const brain = newBrain(0, AI_HARD);
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
    };
    const around = run(0, 600).time;
    // Über das Dach: bei verschiedenen Ankunftszeiten; die beste ist die, bei der man ohne Warten durchkommt.
    let best = Infinity;
    for (let t0 = 600; t0 < 600 + m.plan.period; t0 += 30) {
      const r = run(1 << k, t0);
      expect(r.falls).toBe(0);
      best = Math.min(best, r.time);
    }
    console.log(`Neonhochbahn Zugdach: außen herum ${around.toFixed(2)} s · über das Dach (bestes Zeitfenster) ${best.toFixed(2)} s`);
    expect(around - best).toBeGreaterThan(1.5);
    expect(around - best).toBeLessThan(4);
    // Ohne Zug (und ohne Tor) klafft der Graben: wer hineinfährt, fällt.
    const fell = withoutMechanics(() => run(1 << k, 600).falls);
    expect(fell).toBeGreaterThan(0);
    // Die Züge selbst sind nur rund um den Bahnhof unterwegs (sonst verborgen im Tunnel) und kommen pünktlich.
    let seen = 0;
    for (let time = 0; time < m.plan.period * 3; time += 10) if (standing(time)) seen++;
    expect(seen).toBeGreaterThan(0);
  });
});

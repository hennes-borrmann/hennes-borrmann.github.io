// Baumkronenpfad (Strecke 23) – Messlatte wie bei Gipfelbahn, Neonhochbahn und Talsperre.
//
// Die Ziele für neue Strecken: mindestens drei Fahrarten je Runde (hier Holzrampe und Waldweg, schwankende Hängebrücken,
// Gleitflug zwischen den Kronen, Tauchen im Waldteich), mindestens 40 m Höhenunterschied, mindestens 300 m mit mehr als
// 10 % Steigung oder Gefälle, Steilkurven über 25° (die Rampe um den Riesenstamm: bis 40°), über drei volle Umdrehungen
// Kurve, zwei echte Abkürzungen mit Preis, ein bewegtes Hindernis (fallende Tannenzapfen), eine Stelle, an der die Strecke
// sich selbst kreuzt (die erste Hängebrücke über dem Waldweg). Dazu, was die Strecke verspricht:
//   – die Hängebrücken heben sich und pendeln quer, nach festem Takt; an den Enden stehen sie fest; wer auf ihnen fährt,
//     pendelt mit, und das Geländer pendelt mit;
//   – Ast ohne Geländer ('risk'): schmal und hoch – wer abrutscht, fällt; die KI kommt durch und spart deutlich;
//   – hohler Baumriese ('risk'): mitten hinein und durch die Öffnung im Boden hinunter – mit Tempo landet man auf der
//     Rutsche, zu langsam fällt man in den Wurzelkeller; die KI kommt durch und spart deutlich.

import { afterAll, describe, expect, it } from 'vitest';
import { TRACK_DEFS } from '../../src/game/tracks';
import { PULSE_ICICLE, pontoonLift, pontoonShift, pulseCycle } from '../../src/game/mechanics';
import {
  EDGE_DECK,
  EDGE_FLOAT,
  EDGE_GAP,
  EDGE_GLIDE,
  EDGE_OPEN_L,
  EDGE_OPEN_R,
  TRACK,
  addProgress,
  getTrack,
  heaveAt,
  progDelta,
  rightX,
  rightZ,
  setTrack,
  swayAt,
  trackHeading,
} from '../../src/game/track';
import { AI_EASY, AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import { EV_FALL, EV_HIT, EV_RESPAWNED, FLAG_AIR, FLAG_WALL, gridState, stepKart, type Cmd, type KartState } from '../../src/game/sim';
import { withoutMechanics } from './helpers';

const BAUM = TRACK_DEFS.findIndex((d) => d.id === 'baum');
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
  placeAt(s, start, 0, 24);
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

describe('Baumkronenpfad', () => {
  const t = getTrack(BAUM);

  it('erfüllt die Messlatte: Länge, Höhe, Steilstücke, Steilkurven, Kurven, Fahrarten, Hindernisse, Kreuzung', () => {
    expect(t.def.name).toBe('Baumkronenpfad');
    expect(t.length).toBeGreaterThan(1500);
    expect(t.length).toBeLessThan(1700);
    expect(t.laps).toBe(3);
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
    const deg = (Math.atan(bank) * 180) / Math.PI;
    console.log(
      `Baumkronenpfad: ${t.length.toFixed(0)} m, Höhe ${lo.toFixed(1)}–${hi.toFixed(1)} m, ${steep.toFixed(0)} m über 10 %, Steilkurve ${deg.toFixed(1)}°, ${(turn / (2 * Math.PI)).toFixed(2)} Umdrehungen`,
    );
    expect(hi - lo).toBeGreaterThan(40);
    expect(steep).toBeGreaterThan(300);
    expect(deg).toBeGreaterThan(25);
    // Die Rampe um den Riesenstamm: bis 40° – und nicht mehr (kein Kopfüber, keine Wandfahrt).
    expect(deg).toBeGreaterThan(38);
    expect(deg).toBeLessThan(41);
    expect(turn / (2 * Math.PI)).toBeGreaterThan(3);
    // Fahrarten je Runde (auf der Hauptstrecke): Holzrampe und Stege, Hängebrücken, Gleitflug, Tauchen – dazu der Waldweg
    const main = (flag: number): number => {
      let k = 0;
      for (let s = 0; s < t.n; s++) if (t.edge[s] & flag) k++;
      return k * t.step;
    };
    let under = 0;
    for (let s = 0; s < t.n; s++) if (t.deep[s] && t.py[s] < t.sea - 1) under += t.step;
    expect(main(EDGE_FLOAT)).toBeGreaterThan(120);
    expect(main(EDGE_GLIDE)).toBeGreaterThan(100);
    expect(main(EDGE_DECK) - main(EDGE_GLIDE)).toBeGreaterThan(500);
    expect(under).toBeGreaterThan(60);
    expect(t.pontoons.length).toBeGreaterThanOrEqual(3);
    // bewegtes Hindernis: fallende Tannenzapfen
    expect(t.pulses.filter((p) => p.kind === PULSE_ICICLE).length).toBeGreaterThanOrEqual(2);
    expect(t.def.branches!.map((b) => b.shortcut)).toEqual(['risk', 'risk']);
    // Die Strecke kreuzt sich selbst: die erste Hängebrücke spannt sich hoch über den Waldweg.
    let crossing = false;
    for (let a = 0; a < t.n && !crossing; a++) {
      if ((t.edge[a] & EDGE_FLOAT) === 0) continue;
      for (let b = 0; b < t.n; b++) {
        if (Math.abs(progDelta(t, a, b)) < 80) continue;
        if (Math.hypot(t.px[a] - t.px[b], t.pz[a] - t.pz[b]) < 3 && t.py[a] - t.py[b] > 30) crossing = true;
      }
    }
    expect(crossing).toBe(true);
  });

  it('Rampe um den Riesenstamm: steigt in einer gleichmäßigen Linkskurve, nach innen bis 40° geneigt', () => {
    // Die steilste Stelle der Neigung liegt mitten in der Rampe – dort steigt die Fahrbahn, und die Kurve geht nach links.
    let seg = 0;
    for (let i = 0; i < t.n; i++) if (Math.abs(t.bank[i]) > Math.abs(t.bank[seg])) seg = i;
    expect(t.bank[seg]).toBeGreaterThan(0);
    expect(t.curv[seg]).toBeLessThan(-1 / 30);
    expect(t.edge[seg] & EDGE_DECK).not.toBe(0);
    // Unten, wo die Rampe vom Waldboden abhebt, ist sie noch flach: Die tiefe Innenkante bliebe sonst im Boden stecken.
    let first = -1;
    for (let i = 0; i < t.n && first < 0; i++) if (t.edge[i] & EDGE_DECK) first = i;
    for (let k = 0; k < 40; k++) expect(t.py[first + k] - 6.6 * Math.abs(t.bank[first + k])).toBeGreaterThan(t.py[first] - 0.5);
  });

  it('Hängebrücken: heben sich und pendeln quer nach festem Takt, an den Enden fest – wer darauf fährt, pendelt mit', () => {
    setTrack(BAUM);
    for (const p of t.pontoons) {
      expect(p.arch).toBe(true);
      expect(Math.abs(p.sway)).toBeGreaterThan(0.3);
      const mid = p.first + (p.count >> 1);
      // In der Mitte schwingt sie voll, an den Enden kaum.
      let swing = 0;
      let swingEnd = 0;
      let lift = 0;
      for (let time = 0; time < 2 * p.swayPeriod; time += 7) {
        swing = Math.max(swing, Math.abs(swayAt(t, mid, 0, time)));
        swingEnd = Math.max(swingEnd, Math.abs(swayAt(t, p.first, 0, time)), Math.abs(swayAt(t, p.first + p.count - 1, 0, time)));
        lift = Math.max(lift, Math.abs(heaveAt(t, mid, 0, time)));
        expect(swayAt(t, mid, 0, time)).toBeCloseTo(t.floatWA[mid] * pontoonShift(p, time), 9);
        expect(heaveAt(t, mid, 0, time)).toBeCloseTo(t.floatWA[mid] * pontoonLift(p, time), 9);
      }
      expect(swing).toBeGreaterThan(Math.abs(p.sway) * 0.95);
      expect(lift).toBeGreaterThan(p.amp * 0.95);
      expect(swingEnd).toBeLessThan(0.1);
      // Weich: von Abschnitt zu Abschnitt höchstens ein paar Zentimeter.
      for (let k = 1; k < p.count; k++) expect(Math.abs(t.floatWA[p.first + k] - t.floatWA[p.first + k - 1])).toBeLessThanOrEqual(Math.PI / p.count + 1e-9);
    }
    // Ein Kart steht ohne Gas mitten auf der ersten Brücke: es pendelt mit der Brücke (gegenüber der Brücke bleibt es,
    // wo es ist) – und fällt nicht herunter.
    const p = t.pontoons[0];
    const mid = p.first + (p.count >> 1);
    const s = gridState(0);
    let t0 = 0;
    while (Math.abs(swayAt(t, mid, 0, t0)) > 0.05) t0++;
    placeAt(s, mid, 0, 0);
    s.y += heaveAt(t, mid, 0, t0);
    let worst = 0;
    let moved = 0;
    for (let tick = t0; tick < t0 + p.swayPeriod; tick++) {
      expect(stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: tick }) & EV_FALL).toBe(0);
      const lat = (s.x - t.px[mid]) * rightX(t, mid) + (s.z - t.pz[mid]) * rightZ(t, mid);
      worst = Math.max(worst, Math.abs(lat - swayAt(t, mid, 0, tick)));
      moved = Math.max(moved, Math.abs(lat));
    }
    expect(moved).toBeGreaterThan(Math.abs(p.sway) * 0.8);
    expect(worst).toBeLessThan(0.15);
    // Das Geländer pendelt mit: Wer am rechten Seil anliegt, wird von ihm mitgenommen.
    const r = gridState(0);
    placeAt(r, mid, t.wh[mid] - 1.05, 0);
    let pressed = 0;
    for (let tick = t0; tick < t0 + p.swayPeriod; tick++) {
      stepKart(r, { steer: 127, buttons: 1 }, { canDrive: true, speedFactor: 0.15, time: tick });
      const lat = (r.x - t.px[r.seg]) * rightX(t, r.seg) + (r.z - t.pz[r.seg]) * rightZ(t, r.seg);
      expect(lat - swayAt(t, r.seg, 0, tick)).toBeLessThan(t.wh[r.seg] - 0.95);
      if (r.flags & FLAG_WALL) pressed++;
    }
    expect(pressed).toBeGreaterThan(10);
  });

  it('Ast ohne Geländer: schmal und hoch – wer abrutscht, fällt; die KI kommt durch und spart deutlich', () => {
    setTrack(BAUM);
    const k = 0;
    const b = t.branches[k];
    const mid = b.first + (b.count >> 1);
    expect(t.edge[mid] & EDGE_OPEN_L).not.toBe(0);
    expect(t.edge[mid] & EDGE_OPEN_R).not.toBe(0);
    expect(t.rh[mid]).toBeLessThan(3.2);
    expect(t.py[mid]).toBeGreaterThan(35);
    // Eine halbe Sekunde voll eingelenkt: vom Ast herunter.
    const s = gridState(0);
    placeAt(s, mid - 20, 0, 20);
    let fell = false;
    for (let tick = 0; tick < 150 && !fell; tick++) if (stepKart(s, { steer: tick < 30 ? 127 : 0, buttons: 1 }, { canDrive: true, speedFactor: 1, time: tick }) & EV_FALL) fell = true;
    expect(fell).toBe(true);
    // Auf der Hauptstrecke (an derselben Stelle der Runde, mit Geländer) hält das Seil.
    const m = gridState(0);
    placeAt(m, b.from + 70, 0, 20);
    let mainFell = false;
    for (let tick = 0; tick < 150; tick++) if (stepKart(m, { steer: tick < 30 ? 127 : 0, buttons: 1 }, { canDrive: true, speedFactor: 1, time: tick }) & EV_FALL) mainFell = true;
    expect(mainFell).toBe(false);
    const g = gain(k);
    console.log(`Baumkronenpfad Ast: außen herum ${g.around.toFixed(2)} s · über den Ast ${g.best.toFixed(2)}–${g.worst.toFixed(2)} s · Stürze ${g.falls}`);
    expect(g.falls).toBe(0);
    expect(g.around - g.worst).toBeGreaterThan(1.5);
    expect(g.around - g.best).toBeLessThan(4);
    // Auch die vorsichtige KI fällt selten (von acht Fahrten höchstens eine).
    let easyFalls = 0;
    for (const level of [AI_EASY, AI_MEDIUM]) for (const t0 of [700, 1300, 1900, 2500]) easyFalls += stretch(k, 1 << k, t0, level).falls;
    expect(easyFalls).toBeLessThanOrEqual(1);
  });

  it('Hohler Baumriese: durch die Öffnung im Boden hinunter – mit Tempo auf die Rutsche, zu langsam in den Wurzelkeller', () => {
    setTrack(BAUM);
    const k = 1;
    const b = t.branches[k];
    // Die Öffnung: ein Stück ohne Boden mitten im Stamm; dahinter liegt die Rutsche gut zehn Meter tiefer.
    let gap = -1;
    let gapEnd = -1;
    for (let i = 0; i < b.count; i++) {
      if ((t.edge[b.first + i] & EDGE_GAP) === 0) continue;
      if (gap < 0) gap = b.first + i;
      gapEnd = b.first + i;
    }
    expect(gap).toBeGreaterThan(b.first);
    expect((gapEnd - gap + 1) * t.step).toBeGreaterThan(6);
    expect(t.py[gap - 4] - t.py[b.first + b.count - 1]).toBeGreaterThan(10);
    const drop = (back: number, v: number, gas: boolean): { fell: boolean; landed: number } => {
      const s = gridState(0);
      placeAt(s, gap - back, 0, v);
      let fell = false;
      let landed = -1;
      for (let tick = 0; tick < 240 && !fell; tick++) {
        const ev = stepKart(s, gas ? GAS : { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: tick });
        if (ev & EV_FALL) fell = true;
        if (landed < 0 && t.branchOf[s.seg] === k && s.seg > gapEnd && (s.flags & FLAG_AIR) === 0) landed = s.seg;
      }
      return { fell, landed };
    };
    // Mit Tempo: hinüber und auf der Rutsche im Stamm gelandet (nicht erst draußen).
    const fast = drop(12, 24, true);
    expect(fast.fell).toBe(false);
    expect(fast.landed).toBeGreaterThan(gapEnd);
    expect(t.py[fast.landed]).toBeLessThan(t.py[gap - 4] - 6);
    // Zu langsam (ohne Anlauf über die Kante gerollt): in den Wurzelkeller – aufgesetzt wird mit gutem Anlauf davor.
    const slow = drop(3, 9, false);
    expect(slow.fell).toBe(true);
    const back = t.respawn[gap];
    expect(t.edge[back] & EDGE_GAP).toBe(0);
    expect((gap - back) * t.step).toBeGreaterThan(20);
    const g = gain(k);
    console.log(`Baumkronenpfad hohler Baumriese: außen herum ${g.around.toFixed(2)} s · durch den Stamm ${g.best.toFixed(2)}–${g.worst.toFixed(2)} s · Stürze ${g.falls}`);
    expect(g.falls).toBe(0);
    expect(g.around - g.worst).toBeGreaterThan(1.5);
    expect(g.around - g.best).toBeLessThan(4);
    let easyFalls = 0;
    for (const level of [AI_EASY, AI_MEDIUM]) for (const t0 of [700, 1300, 1900, 2500]) easyFalls += stretch(k, 1 << k, t0, level).falls;
    expect(easyFalls).toBeLessThanOrEqual(1);
  });

  it('Tannenzapfen: fallen im festen Takt mit Vorwarnung – die KI wird in drei Runden selten getroffen', () => {
    setTrack(BAUM);
    const cones = t.pulses.filter((p) => p.kind === PULSE_ICICLE);
    for (const p of cones) {
      expect(p.warn).toBeGreaterThan(60);
      // Ein Zapfen trifft nur einen Teil der Bahn – daneben kommt man vorbei.
      expect(p.radius * 2).toBeLessThan(t.rh[p.seg] * 2 - 3);
      // nach festem Takt: dieselbe Rennzeit, derselbe Stand
      expect(pulseCycle(p, 1234)).toBe(pulseCycle(p, 1234 + p.period));
    }
    let hits = 0;
    let falls = 0;
    const s = gridState(0);
    const brain = newBrain(0, AI_HARD);
    let progress = progDelta(t, 0, s.seg);
    for (let tick = 1; tick < 3 * 90 * 60 && progress < 3 * t.n; tick++) {
      const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
      const before = s.seg;
      const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
      if (ev & EV_HIT) hits++;
      if (ev & EV_FALL) falls++;
      progress = addProgress(t, progress, before, s.seg);
    }
    console.log(`Baumkronenpfad Tannenzapfen: ${hits} Treffer in drei Runden, ${falls} Stürze`);
    expect(hits).toBeLessThanOrEqual(2);
    expect(falls).toBe(0);
  });

  it('Teich: unter dem Wasserfall taucht man ein, am anderen Ufer wieder auf', () => {
    setTrack(BAUM);
    let deep = -1;
    for (let s = 0; s < t.n && deep < 0; s++) if (t.deep[s] && t.py[s] < t.sea - 4) deep = s;
    expect(deep).toBeGreaterThan(0);
    // Ein Hüpfer unter Wasser schwebt lange.
    const s = gridState(0);
    placeAt(s, deep, 0, 18);
    s.y += 1;
    s.vy = 3;
    s.flags = FLAG_AIR;
    let air = 0;
    for (let tick = 0; tick < 120; tick++) {
      stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: tick });
      if (s.flags & FLAG_AIR) air++;
    }
    expect(air).toBeGreaterThan(30);
    // Die Fahrt durch den Teich übersteht die KI ohne Sturz (geprüft in den Runden oben); und aufgetaucht wird vor dem Start.
    let last = -1;
    for (let s2 = 0; s2 < t.n; s2++) if (t.deep[s2]) last = s2;
    expect(last).toBeLessThan(t.n - 200);
  });

  it('jeder Weg ohne Mechanik fahrbar – und beide Abkürzungen auch ohne Schwanken der Brücken schneller', () => {
    setTrack(BAUM);
    for (const k of [0, 1]) {
      const plain = withoutMechanics(() => stretch(k, 0).time - stretch(k, 1 << k).time);
      expect(plain).toBeGreaterThan(1.5);
    }
    // Nach einem Sturz in den Wurzelkeller geht es weiter: aufgesetzt wird auf fester Fahrbahn.
    let gap = t.branches[1].first;
    while ((t.edge[gap] & EDGE_GAP) === 0) gap++;
    const s = gridState(0);
    placeAt(s, gap - 2, 0, 6);
    let back = false;
    for (let tick = 0; tick < 400 && !back; tick++) if (stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: tick }) & EV_RESPAWNED) back = true;
    expect(back).toBe(true);
  });
});

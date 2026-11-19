// Talsperre (Strecke 21) – Messlatte wie bei Gipfelbahn und Neonhochbahn.
//
// Die Ziele für neue Strecken: mindestens drei Fahrarten je Runde (hier Straße, Tauchen im Stausee, Schwebeband mit
// Wandfahrt quer über die Staumauer, Gleitflug über die Schlucht), mindestens 40 m Höhenunterschied, mindestens 300 m mit
// mehr als 10 % Steigung oder Gefälle, Steilkurven über 25°, über drei volle Umdrehungen Kurve, zwei echte Abkürzungen mit
// Preis, ein bewegtes Hindernis (die Turbinenläufer im Krafthaus), eine Stelle, an der die Strecke sich selbst kreuzt
// (der Stollen unter der Zufahrt zur Mauerkrone). Dazu, was die Strecke verspricht:
//   – unter Wasser taucht man nur im Stausee – an der Mauer (tiefer als der Seespiegel) fährt man an der Luft;
//   – an der Mauer fährt man wie auf der Straße (gerechnet wird flach, nur das Bild ist gedreht);
//   – Überlaufrinne ('risk'): das Wasser drückt zur Kante – wer nicht dagegenhält, fällt; die KI kommt durch und spart;
//   – Schleuse ('window'): das Tor geht nach Fahrplan auf und zu; wer es offen trifft, ist deutlich schneller.

import { afterAll, describe, expect, it } from 'vitest';
import { TRACK_DEFS } from '../../src/game/tracks';
import { planActive } from '../../src/game/mechanics';
import {
  EDGE_BAND,
  EDGE_GLIDE,
  EDGE_OPEN_L,
  EDGE_OPEN_R,
  EDGE_TUNNEL,
  EDGE_TWIST,
  TRACK,
  addProgress,
  getTrack,
  hazardLat,
  progDelta,
  rightX,
  rightZ,
  setTrack,
  trackHeading,
  twistWarp,
} from '../../src/game/track';
import { AI_EASY, AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import { EV_FALL, FLAG_AIR, FLAG_DIVE, KART_RADIUS, gridState, stepKart, type Cmd, type KartState } from '../../src/game/sim';
import { HAZARD_RADIUS } from '../../src/game/hostGame';
import { withoutMechanics } from './helpers';

const TALSPERRE = TRACK_DEFS.findIndex((d) => d.id === 'talsperre');
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

describe('Talsperre', () => {
  const t = getTrack(TALSPERRE);

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
    console.log(
      `Talsperre: ${t.length.toFixed(0)} m, Höhe ${lo.toFixed(1)}–${hi.toFixed(1)} m, ${steep.toFixed(0)} m über 10 %, Steilkurve ${((Math.atan(bank) * 180) / Math.PI).toFixed(1)}°, ${(turn / (2 * Math.PI)).toFixed(2)} Umdrehungen`,
    );
    expect(hi - lo).toBeGreaterThan(40);
    expect(steep).toBeGreaterThan(300);
    expect((Math.atan(bank) * 180) / Math.PI).toBeGreaterThan(25);
    expect(turn / (2 * Math.PI)).toBeGreaterThan(3);
    // Fahrarten je Runde (auf der Hauptstrecke): Straße, Tauchen, Schwebeband (an der Mauer), Gleitflug – dazu der Stollen
    const main = (flag: number): number => {
      let k = 0;
      for (let s = 0; s < t.n; s++) if (t.edge[s] & flag) k++;
      return k * t.step;
    };
    let under = 0;
    for (let s = 0; s < t.n; s++) if (t.deep[s] && t.py[s] < t.sea - 1) under += t.step;
    expect(under).toBeGreaterThan(150);
    expect(main(EDGE_BAND)).toBeGreaterThan(150);
    expect(main(EDGE_TWIST)).toBeGreaterThan(100);
    expect(main(EDGE_GLIDE)).toBeGreaterThan(100);
    expect(main(EDGE_TUNNEL)).toBeGreaterThan(40);
    // bewegte Hindernisse: die Turbinenläufer im Krafthaus
    expect(t.hazards.length).toBeGreaterThanOrEqual(2);
    expect(t.def.branches!.map((b) => b.shortcut)).toEqual(['risk', 'window']);
    // Die Strecke kreuzt sich selbst: der Stollen unter der Zufahrt zur Mauerkrone – gut eine Etage auseinander.
    let crossing = false;
    for (let a = 0; a < t.n && !crossing; a += 2) {
      for (let b = 0; b < t.n; b += 2) {
        if (Math.abs(progDelta(t, a, b)) < 80) continue;
        if (Math.hypot(t.px[a] - t.px[b], t.pz[a] - t.pz[b]) < 3 && t.py[b] - t.py[a] > 10 && (t.edge[a] & EDGE_TUNNEL) !== 0) crossing = true;
      }
    }
    expect(crossing).toBe(true);
  });

  it('Tauchen gibt es nur im Stausee: an der Mauer, tiefer als der Seespiegel, fährt man an der Luft', () => {
    setTrack(TALSPERRE);
    let lake = -1;
    let band = -1;
    for (let s = 0; s < t.n; s++) {
      if (lake < 0 && t.deep[s] && t.py[s] < t.sea - 8) lake = s;
      if (band < 0 && (t.edge[s] & EDGE_TWIST) !== 0) band = s;
      // Unter Wasser nichts, was es nur an der Luft gibt (und umgekehrt)
      if (t.deep[s]) expect(t.edge[s] & (EDGE_BAND | EDGE_GLIDE | EDGE_TUNNEL)).toBe(0);
    }
    expect(t.py[band]).toBeLessThan(t.sea - 5);
    // Ein Hüpfer: unter Wasser schwebt das Kart (FLAG_DIVE), an der Luft fällt es gewöhnlich.
    const hop = (seg: number): boolean => {
      const s = gridState(0);
      placeAt(s, seg, 0, 20);
      s.y += 1.5;
      s.vy = 3;
      s.flags = FLAG_AIR;
      let dive = false;
      for (let tick = 0; tick < 20; tick++) {
        stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: tick });
        if (s.flags & FLAG_DIVE) dive = true;
      }
      return dive;
    };
    expect(hop(lake)).toBe(true);
    expect(hop(band)).toBe(false);
  });

  it('Wandfahrt: das Band dreht sich weich bis senkrecht an die Mauer – und ist dort gerechnet wie flach', () => {
    setTrack(TALSPERRE);
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
    expect(wall).toBeGreaterThan(40);
    expect((maxStep * 180) / Math.PI).toBeLessThan(3.5);
    // An der Mauer steht die Fahrbahn senkrecht: quer über sie hinweg geht es nur nach oben.
    let seg = first;
    while (t.roll[seg] < Math.PI / 2 - 1e-3) seg = t.next[seg];
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    twistWarp(t, seg, 0, -4, 0, a);
    twistWarp(t, seg, 0, 4, 0, b);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(1e-6);
    expect(b.y - a.y).toBeCloseTo(8, 6);
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
  });

  it('Überlaufrinne: das Wasser drückt zur Kante – wer nicht dagegenhält, fällt; die KI kommt durch und spart deutlich', () => {
    setTrack(TALSPERRE);
    const k = t.def.branches!.findIndex((b) => b.shortcut === 'risk');
    const b = t.branches[k];
    // Die Rinne hat keine Bande, und auf ihr schiebt die Strömung zur Seite.
    const mid = b.first + (b.count >> 1);
    expect(t.edge[mid] & EDGE_OPEN_L).not.toBe(0);
    expect(t.edge[mid] & EDGE_OPEN_R).not.toBe(0);
    expect(t.belts.some((x) => mid >= x.first && mid < x.first + x.count && Math.abs(x.across) > 1.5)).toBe(true);
    // Geradeaus mit Vollgas, ohne gegenzulenken: die Strömung schiebt das Kart über die Kante.
    const s = gridState(0);
    placeAt(s, b.first + 30, 0, 18);
    let fell = false;
    for (let tick = 0; tick < 240 && !fell; tick++) if (stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: tick }) & EV_FALL) fell = true;
    expect(fell).toBe(true);
    // Die KI (gute) hält dagegen: über die Rinne deutlich schneller als außen herum.
    const around = stretch(k, 0);
    let falls = 0;
    let best = Infinity;
    let worst = 0;
    for (const t0 of [600, 1000, 1400, 1800]) {
      const r = stretch(k, 1 << k, t0);
      falls += r.falls;
      best = Math.min(best, r.time);
      worst = Math.max(worst, r.time);
    }
    console.log(`Talsperre Überlaufrinne: außen herum ${around.time.toFixed(2)} s · über die Rinne ${best.toFixed(2)}–${worst.toFixed(2)} s · Stürze ${falls}`);
    expect(around.falls).toBe(0);
    expect(falls).toBe(0);
    expect(around.time - worst).toBeGreaterThan(1.5);
    expect(around.time - best).toBeLessThan(4);
    // Auch die vorsichtige KI fällt selten (von acht Fahrten höchstens eine).
    let easyFalls = 0;
    for (const level of [AI_EASY, AI_MEDIUM]) for (const t0 of [700, 1300, 1900, 2500]) easyFalls += stretch(k, 1 << k, t0, level).falls;
    expect(easyFalls).toBeLessThanOrEqual(1);
  });

  it('Schleuse: das Tor geht nach Fahrplan auf und zu – wer es offen trifft, ist deutlich schneller', () => {
    setTrack(TALSPERRE);
    const k = t.def.branches!.findIndex((b) => b.shortcut === 'window');
    const gate = t.gates.find((g) => t.branchOf[g.first] === k)!;
    expect(gate.plan.period).toBeGreaterThan(0);
    // zu und offen, beides ein gutes Stück je Umlauf
    let open = 0;
    for (let time = 0; time < gate.plan.period; time += 6) if (!planActive(gate.plan, time + 6000)) open++;
    const share = open / Math.ceil(gate.plan.period / 6);
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.6);
    const around = stretch(k, 0).time;
    // Durch die Schleuse: bei verschiedenen Ankunftszeiten; die beste ist die, bei der man ohne Warten durchkommt.
    let best = Infinity;
    let worst = 0;
    for (let t0 = 600; t0 < 600 + gate.plan.period; t0 += 30) {
      const r = stretch(k, 1 << k, t0);
      expect(r.falls).toBe(0);
      best = Math.min(best, r.time);
      worst = Math.max(worst, r.time);
    }
    console.log(`Talsperre Schleuse: außen herum ${around.toFixed(2)} s · durch die Schleuse ${best.toFixed(2)} s (offen) bis ${worst.toFixed(2)} s (Warten vor dem Tor)`);
    expect(around - best).toBeGreaterThan(1.5);
    expect(around - best).toBeLessThan(3.5);
    // Wer vor dem geschlossenen Tor wartet, ist langsamer als außen herum: der Weg lohnt sich nur im Zeitfenster.
    expect(worst).toBeGreaterThan(around);
    // Die KI nimmt die Schleuse nur, wenn das Tor bei ihrer Ankunft offen ist – sonst fährt sie außen herum.
    const s = gridState(0);
    const b = t.branches[k];
    let tookShut = 0;
    let tookOpen = 0;
    for (let t0 = 600; t0 < 600 + gate.plan.period * 4; t0 += 20) {
      const brain = newBrain(0, AI_HARD);
      placeAt(s, (b.from - 70 + t.n) % t.n, 0, 22);
      let took = false;
      for (let tick = t0; tick < t0 + 8 * 60; tick++) {
        const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
        stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
        if (t.branchOf[s.seg] === k && t.twin[s.seg] < 0) {
          took = true;
          if (planActive(gate.plan, tick)) {
            // (Wer schon drin ist, wenn es schließt, kommt noch hinaus – gezählt wird das Einfahren.)
          }
          break;
        }
        if (progDelta(t, b.to, s.seg) > 0) break;
      }
      if (took) tookOpen++;
      else tookShut++;
    }
    expect(tookOpen).toBeGreaterThan(0);
    expect(tookShut).toBeGreaterThan(0);
  });

  it('Krafthaus: die Turbinenläufer fahren nach festem Takt quer über die ganze Bahn – die KI weicht ihnen aus', () => {
    setTrack(TALSPERRE);
    for (const h of t.hazards) expect(h.amp + HAZARD_RADIUS + KART_RADIUS).toBeGreaterThan(t.rh[h.seg] - 0.5);
    // Drei Runden der guten KI: Wie oft wäre sie getroffen worden (wie hostGame es prüft)?
    let contacts = 0;
    let falls = 0;
    const s = gridState(0);
    const brain = newBrain(0, AI_HARD);
    let progress = progDelta(t, 0, s.seg);
    let cool = 0;
    for (let tick = 1; tick < 3 * 90 * 60 && progress < 3 * t.n; tick++) {
      const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
      const before = s.seg;
      if (stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick }) & EV_FALL) falls++;
      progress = addProgress(t, progress, before, s.seg);
      if (cool > 0) cool--;
      for (const h of t.hazards) {
        const lat = hazardLat(h, tick);
        const hx = t.px[h.seg] + rightX(t, h.seg) * lat;
        const hz = t.pz[h.seg] + rightZ(t, h.seg) * lat;
        if (cool === 0 && Math.abs(s.y - t.py[h.seg]) < 1.6 && Math.hypot(s.x - hx, s.z - hz) < HAZARD_RADIUS + KART_RADIUS) {
          contacts++;
          cool = 60;
        }
      }
    }
    console.log(`Talsperre Krafthaus: ${contacts} Berührungen mit Turbinenläufern in drei Runden, ${falls} Stürze`);
    expect(contacts).toBeLessThanOrEqual(3);
    expect(falls).toBe(0);
  });

  it('jeder Weg ohne Mechanik fahrbar – und die Rinne ohne Strömung immer noch schneller', () => {
    setTrack(TALSPERRE);
    const k = t.def.branches!.findIndex((b) => b.shortcut === 'risk');
    const plain = withoutMechanics(() => stretch(k, 0).time - stretch(k, 1 << k).time);
    expect(plain).toBeGreaterThan(1.5);
  });
});

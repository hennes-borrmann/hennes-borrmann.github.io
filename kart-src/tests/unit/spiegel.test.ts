// Spiegelkabinett: Portale (mechanics.ts: Portal; track.ts; sim.ts; ai.ts).

import { afterAll, describe, expect, it } from 'vitest';
import { AI_EASY, AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import { PORTAL_WARN, portalLeft, portalOpen, portalUntil, type Portal } from '../../src/game/mechanics';
import { EV_FALL, EV_PORTAL, gridState, stepKart, type KartState } from '../../src/game/sim';
import { TRACK, TRACK_COUNT, addProgress, getTrack, proj, progDelta, projectOnTrack, rightX, rightZ, setTrack, trackHeading } from '../../src/game/track';

const SPIEGEL = 13;

afterAll(() => {
  setTrack(0);
});

function at(seg: number, lat = 0, speed = 0): KartState {
  const t = TRACK;
  const s = gridState(0);
  s.seg = seg;
  s.x = t.px[seg] + rightX(t, seg) * lat;
  s.z = t.pz[seg] + rightZ(t, seg) * lat;
  s.y = t.py[seg] + lat * t.bank[seg];
  s.heading = trackHeading(t, seg);
  s.vx = Math.sin(s.heading) * speed;
  s.vz = Math.cos(s.heading) * speed;
  s.vy = 0;
  s.flags = 0;
  return s;
}

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Rennzeit (Ticks), zu der das Portal seit mindestens einer halben Sekunde offen ist und es noch eine Sekunde bleibt (bzw. zu ist). */
function timeWhen(p: Portal, open: boolean): number {
  for (let time = 0; time < 60 * 60; time += 5) {
    if (open && portalOpen(p, time - 30) && portalOpen(p, time) && portalLeft(p, time) > 60) return time;
    if (!open && !portalOpen(p, time - 30) && !portalOpen(p, time) && portalUntil(p, time) > 60) return time;
  }
  return -1;
}

/**
 * Fährt von from Metern vor dem Rahmen geradeaus hindurch; liefert, ob es einen Sprung gab, den Zustand danach
 * und die seitliche Lage unmittelbar davor.
 */
function through(p: Portal, lat: number, time0: number, from = 8, speed = 24): { jumped: boolean; s: KartState; ticks: number; lat: number; speed: number; rel: number } {
  const t = TRACK;
  const s = at(p.seg - from, lat, speed);
  let last = lat;
  let v = speed;
  let rel = 0;
  for (let i = 0; i < 50; i++) {
    projectOnTrack(t, s.x, s.z, s.seg);
    last = proj.lat;
    v = Math.hypot(s.vx, s.vz);
    rel = wrap(s.heading - trackHeading(t, proj.seg));
    const ev = stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: time0 + i });
    if (ev & EV_PORTAL) return { jumped: true, s, ticks: i, lat: last, speed: v, rel };
    if (progDelta(t, p.seg, s.seg) > 3) break;
  }
  return { jumped: false, s, ticks: -1, lat: last, speed: v, rel };
}

describe('Portale', () => {
  it('nur das Spiegelkabinett hat welche: drei Stellen, jede führt auf die Hauptstrecke', () => {
    for (let i = 0; i < TRACK_COUNT; i++) {
      const t = getTrack(i);
      if (i !== SPIEGEL) {
        expect(t.portals.length).toBe(0);
        continue;
      }
      expect(t.def.name).toBe('Spiegelkabinett');
      expect(t.portals.length).toBe(6);
      const sites = new Set(t.portals.map((p) => p.seg));
      expect(sites.size).toBe(3);
      for (const p of t.portals) {
        expect(t.branchOf[p.seg]).toBeLessThan(0);
        expect(t.branchOf[p.to]).toBeLessThan(0);
        // der Rahmen steht in der Fahrbahn, mit Abstand zur Bande – am Eingang wie am Ausgang
        for (const seg of [p.seg, p.to]) {
          expect(p.lat0).toBeGreaterThan(-t.rh[seg]);
          expect(p.lat1).toBeLessThan(t.rh[seg]);
        }
        expect(p.lat1 - p.lat0).toBeGreaterThan(3);
        // Sprungweite: vorwärts 40–80 m, zurück 30–60 m
        const d = progDelta(t, p.seg, p.to) * t.step;
        if (p.kind === 0) {
          expect(d).toBeGreaterThan(40);
          expect(d).toBeLessThan(80);
        } else {
          expect(d).toBeLessThan(-30);
          expect(d).toBeGreaterThan(-60);
        }
        // Eingang und Ausgang liegen auf geraden Stücken (man kommt gerade heraus)
        expect(Math.abs(t.curv[p.seg])).toBeLessThan(0.02);
        expect(Math.abs(t.curv[p.to])).toBeLessThan(0.02);
      }
    }
  });

  it('die Zwillingsspiegel tauschen: nie führt ein Rahmen zugleich vor und zurück, und immer führt genau einer vorwärts oder keiner', () => {
    const t = setTrack(SPIEGEL);
    const twin = t.portals.filter((p) => t.portals.filter((q) => q.seg === p.seg).length === 4);
    expect(twin.length).toBe(4);
    const left = twin.filter((p) => p.lat1 < 0);
    const right = twin.filter((p) => p.lat0 > 0);
    expect(left.length).toBe(2);
    expect(right.length).toBe(2);
    let forwardLeft = 0;
    let forwardRight = 0;
    let none = 0;
    for (let time = 0; time < 60 * 48; time++) {
      const l = left.filter((p) => portalOpen(p, time));
      const r = right.filter((p) => portalOpen(p, time));
      expect(l.length).toBeLessThanOrEqual(1);
      expect(r.length).toBeLessThanOrEqual(1);
      // entweder beide leer oder einer vor, der andere zurück
      expect(l.length).toBe(r.length);
      if (l.length === 0) {
        none++;
        continue;
      }
      expect(l[0].kind).not.toBe(r[0].kind);
      if (l[0].kind === 0) forwardLeft++;
      else forwardRight++;
    }
    expect(forwardLeft).toBe(forwardRight);
    // leer sind sie nur kurz beim Tausch
    expect(none / (60 * 48)).toBeLessThan(0.12);
  });

  it('wer durch einen offenen Spiegel fährt, kommt am Ausgang heraus – gleiche Spur, gleiches Tempo, Richtung der Strecke dort', () => {
    const t = setTrack(SPIEGEL);
    for (const p of t.portals) {
      const time = timeWhen(p, true);
      expect(time).toBeGreaterThanOrEqual(0);
      const lat = (p.lat0 + p.lat1) / 2 + 0.7;
      const r = through(p, lat, time);
      expect(r.jumped).toBe(true);
      const s = r.s;
      projectOnTrack(t, s.x, s.z, s.seg);
      // am Ausgang (höchstens zwei Abschnitte dahinter)
      const d = progDelta(t, p.to, proj.seg);
      expect(d).toBeGreaterThanOrEqual(-1);
      expect(d).toBeLessThanOrEqual(2);
      // dieselbe Spur wie unmittelbar vor dem Rahmen (in einem Schritt wandert sie um Zentimeter)
      expect(Math.abs(proj.lat - r.lat)).toBeLessThan(0.12);
      expect(Math.abs(Math.hypot(s.vx, s.vz) - r.speed)).toBeLessThan(0.5);
      // Nase und Fahrt stehen zur Strecke wie unmittelbar vor dem Rahmen (dort fast genau geradeaus)
      expect(Math.abs(wrap(s.heading - trackHeading(t, proj.seg) - r.rel))).toBeLessThan(0.03);
      expect(Math.abs(wrap(Math.atan2(s.vx, s.vz) - s.heading))).toBeLessThan(0.03);
      expect(Math.abs(r.rel)).toBeLessThan(0.15);
      // auf dem Boden
      expect(Math.abs(s.y - (t.py[proj.seg] + proj.lat * t.bank[proj.seg]))).toBeLessThan(0.3);
      // und es bleibt dabei: im nächsten Schritt kein weiterer Sprung
      const ev = stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: time + r.ticks + 1 });
      expect(ev & EV_PORTAL).toBe(0);
    }
  });

  it('ein leerer Rahmen ist ein Tor: man fährt hindurch; und neben dem Rahmen wirkt auch ein offener Spiegel nicht', () => {
    const t = setTrack(SPIEGEL);
    for (const p of t.portals) {
      if (p.plan !== null) {
        // zu einer Zeit, zu der an diesem Rahmen kein Spiegel offen ist
        let time = -1;
        for (let c = 0; c < 60 * 60 && time < 0; c += 5) {
          let free = true;
          for (const q of t.portals) if (q.seg === p.seg && q.lat0 === p.lat0) for (let k = 0; k <= 24; k += 4) if (portalOpen(q, c + k)) free = false;
          if (free) time = c;
        }
        expect(time).toBeGreaterThanOrEqual(0);
        // (die Zwillinge sind nur eine halbe Sekunde leer: aus drei Metern Entfernung hindurch)
        const r = through(p, (p.lat0 + p.lat1) / 2, time, 3);
        expect(r.jumped).toBe(false);
        expect(progDelta(t, p.seg, r.s.seg)).toBeGreaterThan(0);
        expect(progDelta(t, p.seg, r.s.seg)).toBeLessThan(12);
      }
      // daneben vorbei (einen Meter neben dem Rahmen, zur Fahrbahnmitte hin)
      const beside = p.lat1 < 0 ? p.lat1 + 1 : p.lat0 > 0 ? p.lat0 - 1 : p.lat0 - 1;
      const open = timeWhen(p, true);
      const r = through(p, beside, open);
      expect(r.jumped).toBe(false);
    }
  });

  it('rückwärts durch den Rahmen passiert nichts', () => {
    const t = setTrack(SPIEGEL);
    const p = t.portals[0];
    const time = timeWhen(p, true);
    const s = at(p.seg + 6, (p.lat0 + p.lat1) / 2, 0);
    // gegen die Fahrtrichtung rollen
    s.heading = wrap(s.heading + Math.PI);
    s.vx = Math.sin(s.heading) * 15;
    s.vz = Math.cos(s.heading) * 15;
    let jumped = false;
    for (let i = 0; i < 60; i++) if (stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: time + i }) & EV_PORTAL) jumped = true;
    expect(jumped).toBe(false);
    expect(progDelta(t, p.seg, s.seg)).toBeLessThan(0);
  });

  it('der Rennfortschritt zählt den Sprung mit: vorwärts gewonnen, zurück verloren', () => {
    const t = setTrack(SPIEGEL);
    for (const p of t.portals) {
      const time = timeWhen(p, true);
      const s = at(p.seg - 8, (p.lat0 + p.lat1) / 2, 24);
      let progress = t.prog[s.seg] + t.n;
      const start = progress;
      for (let i = 0; i < 40; i++) {
        const before = s.seg;
        const ev = stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: time + i });
        progress = addProgress(t, progress, before, s.seg);
        if (ev & EV_PORTAL) break;
      }
      const jump = progDelta(t, p.seg, p.to);
      expect(progress - start).toBeGreaterThan(jump + 4);
      expect(progress - start).toBeLessThan(jump + 14);
    }
  });

  it('ein Spiegel kündigt den Wechsel an', () => {
    expect(PORTAL_WARN).toBeGreaterThanOrEqual(60);
    const t = setTrack(SPIEGEL);
    for (const p of t.portals) {
      if (p.plan === null) {
        expect(portalLeft(p, 1234)).toBe(Infinity);
        expect(portalUntil(p, 1234)).toBe(0);
        continue;
      }
      // offen mindestens drei Sekunden am Stück
      let run = 0;
      let best = 0;
      for (let time = 0; time < 60 * 40; time++) {
        if (portalOpen(p, time)) {
          run++;
          expect(portalUntil(p, time)).toBe(0);
          expect(portalLeft(p, time)).toBeGreaterThan(0);
          // genau dann zu, wenn die Restzeit abgelaufen ist
          expect(portalOpen(p, time + portalLeft(p, time))).toBe(false);
          expect(portalOpen(p, time + portalLeft(p, time) - 1)).toBe(true);
        } else {
          best = Math.max(best, run);
          run = 0;
          expect(portalLeft(p, time)).toBe(0);
          expect(portalOpen(p, time + portalUntil(p, time))).toBe(true);
        }
      }
      expect(best).toBeGreaterThanOrEqual(180);
    }
  });

  it('die KI fährt die Strecke: die gute nutzt die Spiegel, in die Falle gerät sie selten', () => {
    const t = setTrack(SPIEGEL);
    const forward = [0, 0, 0];
    const back = [0, 0, 0];
    const time = [0, 0, 0];
    let falls = 0;
    for (let slot = 0; slot < 4; slot++) {
      for (const level of [AI_EASY, AI_MEDIUM, AI_HARD]) {
        const s = gridState(slot);
        const brain = newBrain(slot + level * 4, level);
        let progress = progDelta(t, 0, s.seg);
        let tick = 1;
        for (; tick < 60 * 300 && progress < 3 * t.n; tick++) {
          const before = s.seg;
          const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
          const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
          if (ev & EV_FALL) falls++;
          if (ev & EV_PORTAL) {
            if (progDelta(t, before, s.seg) > 0) forward[level]++;
            else back[level]++;
          }
          progress = addProgress(t, progress, before, s.seg);
        }
        expect(progress).toBeGreaterThanOrEqual(3 * t.n);
        time[level] += tick / 60 / 3;
      }
    }
    console.log(
      `Spiegelkabinett, KI in je 12 Runden: Spiegel vorwärts leicht/mittel/schwer ${forward.join('/')}, zurück ${back.join('/')}, Stürze ${falls}; Rundenzeit ${time.map((x) => (x / 4).toFixed(1)).join(' / ')} s`,
    );
    expect(falls).toBeLessThanOrEqual(4);
    // schwer: im Schnitt mindestens ein Spiegel je Runde; leicht: deutlich seltener
    expect(forward[AI_HARD]).toBeGreaterThanOrEqual(12);
    expect(forward[AI_EASY]).toBeLessThan(forward[AI_HARD]);
    // in die Falle höchstens einmal in zwölf Runden je Stärke
    for (const n of back) expect(n).toBeLessThanOrEqual(1);
  });
});

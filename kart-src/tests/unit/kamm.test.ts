// Gewitterkamm: Blitzeinschläge, Blitzableiter mit Ladefeld, Wetterleuchten (mechanics.ts, sim.ts, ai.ts).

import { afterAll, describe, expect, it } from 'vitest';
import { AI_EASY, AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { FLASH_TICKS, PULSE_BOLT, PULSE_ROD, flashShape, pulseCycle, stormLight, type Pulse } from '../../src/game/mechanics';
import { BTN_GAS, EV_CHARGE, EV_FALL, EV_HIT, PAD_TICKS, gridState, stepKart, type KartState } from '../../src/game/sim';
import { TRACK, TRACK_COUNT, getTrack, rightX, rightZ, setTrack, trackHeading } from '../../src/game/track';

const KAMM = 11;

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

/** Rennzeit des n-ten Einschlags von p (Zyklus 0). */
function strike(p: Pulse, n = 2): number {
  return n * p.period - p.phase;
}

describe('Wetterleuchten', () => {
  it('ein Blitz ist ein heller Schlag mit leichtem Nachzucken, der in einer knappen halben Sekunde verlischt', () => {
    expect(flashShape(-1)).toBe(0);
    expect(flashShape(0)).toBe(1);
    // kein hartes Flackern: zwischen Schlag und Nachzucken bleibt es hell
    expect(flashShape(4)).toBeGreaterThanOrEqual(0.7);
    expect(flashShape(7)).toBeGreaterThan(flashShape(4));
    expect(flashShape(FLASH_TICKS)).toBe(0);
    for (let c = 9; c < FLASH_TICKS; c++) expect(flashShape(c + 1)).toBeLessThanOrEqual(flashShape(c));
    for (let c = 0; c < FLASH_TICKS; c++) {
      expect(flashShape(c)).toBeGreaterThanOrEqual(0);
      expect(flashShape(c)).toBeLessThanOrEqual(1);
    }
  });

  it('nur der Gewitterkamm ist dunkel; dort ist es meist finster – aber nie lange ohne Blitz', () => {
    for (let i = 0; i < TRACK_COUNT; i++) {
      const t = getTrack(i);
      expect(t.dark).toBe(i === KAMM);
      if (i !== KAMM) {
        expect(t.flashes.length).toBe(0);
        expect(t.pulses.some((p) => p.kind === PULSE_BOLT || p.kind === PULSE_ROD)).toBe(false);
      }
    }
    const t = setTrack(KAMM);
    expect(t.def.name).toBe('Gewitterkamm');
    let bright = 0;
    let strong = 0;
    let longestDark = 0;
    let dark = 0;
    let before = 0;
    const total = 180 * 60;
    for (let time = 0; time < total; time++) {
      const k = stormLight(t.pulses, t.flashes, time);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(1);
      if (k > 0.5) bright++;
      // ein starker Blitz beginnt
      if (k > 0.5 && before <= 0.5) strong++;
      if (k > 0.15) dark = 0;
      else {
        dark++;
        longestDark = Math.max(longestDark, dark);
      }
      before = k;
    }
    // Dunkel ist die Regel: taghell ist es nur einen Bruchteil der Zeit …
    expect(bright / total).toBeLessThan(0.08);
    // … starke Blitze kommen selten genug, dass nichts flackert (höchstens alle drei Sekunden einer im Schnitt) …
    expect(strong / 3).toBeLessThanOrEqual(20);
    expect(strong / 3).toBeGreaterThanOrEqual(6);
    // … aber irgendein Licht zeigt spätestens nach drei Sekunden wieder den Weg.
    expect(longestDark).toBeLessThan(180);
    // Vor dem Start gilt dieselbe Rechnung (kein Wert außerhalb 0…1).
    expect(stormLight(t.pulses, t.flashes, -400)).toBeGreaterThanOrEqual(0);
    expect(stormLight(t.pulses, t.flashes, -400)).toBeLessThanOrEqual(1);
  });
});

describe('Gewitterkamm: Blitze', () => {
  it('die Einschlagstellen liegen auf der Fahrbahn und lassen daneben eine Spur frei', () => {
    const t = setTrack(KAMM);
    const bolts = t.pulses.filter((p) => p.kind === PULSE_BOLT);
    expect(bolts.length).toBeGreaterThanOrEqual(8);
    for (const p of bolts) {
      expect(t.branchOf[p.seg]).toBe(-1);
      expect(Math.abs(p.lat) + p.radius).toBeLessThanOrEqual(t.rh[p.seg] + 0.2);
      // frei bleibt die Seite gegenüber: mehr als drei Meter
      expect(t.rh[p.seg] - (p.radius - Math.abs(p.lat))).toBeGreaterThan(3);
      expect(p.warn).toBeGreaterThanOrEqual(80);
      expect(p.period - p.on - p.warn).toBeGreaterThan(60);
    }
    // Die Lawinengalerie ist sicher: dort schlägt nichts ein.
    expect(t.pulses.every((p) => t.branchOf[p.seg] < 0)).toBe(true);
  });

  it('wer beim Einschlag auf der Stelle steht, wird getroffen – vorher und daneben nicht', () => {
    const t = setTrack(KAMM);
    for (const p of t.pulses.filter((q) => q.kind === PULSE_BOLT)) {
      const when = strike(p);
      expect(pulseCycle(p, when)).toBe(0);
      // auf der Stelle, während der Vorwarnung: nichts
      const early = at(p.seg, p.lat);
      let ev = 0;
      for (let i = 0; i < 60; i++) ev |= stepKart(early, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: when - 80 + i });
      expect(ev & EV_HIT).toBe(0);
      // auf der Stelle, beim Einschlag: Treffer
      const hit = at(p.seg, p.lat);
      ev = 0;
      for (let i = 0; i < 10; i++) ev |= stepKart(hit, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: when - 2 + i });
      expect(ev & EV_HIT).toBeTruthy();
      expect(hit.spin).toBeGreaterThan(0);
      // auf der freien Seite, beim Einschlag: nichts
      const side = p.lat > 0 ? -1 : 1;
      const safe = at(p.seg, side * (t.rh[p.seg] - 1.2));
      ev = 0;
      for (let i = 0; i < 40; i++) ev |= stepKart(safe, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: when - 2 + i });
      expect(ev & EV_HIT).toBe(0);
    }
  });
});

describe('Gewitterkamm: Blitzableiter', () => {
  it('der Mast steht neben der Bahn; sein Ladefeld reicht quer über die ganze Fahrbahn', () => {
    const t = setTrack(KAMM);
    const rods = t.pulses.filter((p) => p.kind === PULSE_ROD);
    expect(rods.length).toBeGreaterThanOrEqual(5);
    for (const p of rods) {
      expect(Math.abs(p.lat)).toBeGreaterThan(t.wh[p.seg] + 1);
      expect(Math.abs(p.lat)).toBeLessThan(t.wh[p.seg] + 4);
      const when = strike(p) + 5;
      for (const lat of [-t.rh[p.seg] + 0.5, 0, t.rh[p.seg] - 0.5]) {
        const s = at(p.seg, lat, 20);
        const ev = stepKart(s, { steer: 0, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: when });
        expect(ev & EV_CHARGE).toBeTruthy();
        expect(s.boost).toBe(PAD_TICKS);
        expect(s.spin).toBe(0);
      }
    }
  });

  it('nur solange er geladen ist, lädt er auf – und nur in seinem Feld', () => {
    const t = setTrack(KAMM);
    for (const p of t.pulses.filter((q) => q.kind === PULSE_ROD)) {
      const when = strike(p);
      // kurz vor dem Blitz und nachdem das Feld erloschen ist: kein Schub
      for (const time of [when - 5, when + p.on + 2, when + p.period - p.warn]) {
        const s = at(p.seg, 0, 20);
        const ev = stepKart(s, { steer: 0, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time });
        expect(ev & EV_CHARGE).toBe(0);
        expect(s.boost).toBe(0);
      }
      // geladen, aber 12 m vor dem Mast: außerhalb des Felds
      let before = p.seg;
      for (let k = 0; k < 12; k++) before = t.prev[before];
      const far = at(before, 0, 0);
      expect(stepKart(far, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: when + 5 }) & EV_CHARGE).toBe(0);
      // Wer mit Tempo ankommt, genau wenn der Blitz einschlägt, wird beim Durchfahren aufgeladen.
      let start = p.seg;
      for (let k = 0; k < 20; k++) start = t.prev[start];
      const s = at(start, 0, 24);
      let ev = 0;
      for (let i = 0; i < 70; i++) ev |= stepKart(s, { steer: 0, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: when - 40 + i });
      expect(ev & EV_CHARGE).toBeTruthy();
    }
  });
});

describe('Gewitterkamm: die KI', () => {
  it('fährt drei Runden durchs Gewitter: wird selten getroffen, stürzt nicht und erwischt Ladefelder', () => {
    const t = setTrack(KAMM);
    let hits = 0;
    let charges = 0;
    let falls = 0;
    for (let slot = 0; slot < 4; slot++) {
      for (const level of [AI_HARD, AI_EASY]) {
        const s = gridState(slot);
        const brain = newBrain(slot + (level === AI_HARD ? 0 : 4), level);
        let laps = -1;
        let before = s.seg;
        for (let tick = 1; tick < 60 * 280 && laps < 3; tick++) {
          const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
          const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
          if (ev & EV_HIT) hits++;
          if (ev & EV_CHARGE) charges++;
          if (ev & EV_FALL) falls++;
          if (t.branchOf[s.seg] < 0 && t.branchOf[before] < 0 && before > t.n - 40 && s.seg < 40) laps++;
          before = s.seg;
        }
        expect(laps).toBe(3);
      }
    }
    console.log(`Gewitterkamm, KI in 24 Runden: ${hits} Blitztreffer, ${charges}-mal aufgeladen, ${falls} Stürze`);
    expect(falls).toBeLessThanOrEqual(2);
    // Die Blitze kündigen sich an: wer aufpasst, weicht aus (höchstens ein Treffer je vier Runden).
    expect(hits).toBeLessThanOrEqual(6);
    // Ladefelder trifft man auch ohne Absicht ab und zu.
    expect(charges).toBeGreaterThanOrEqual(6);
  });
});

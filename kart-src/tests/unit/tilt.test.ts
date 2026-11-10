import { describe, expect, it } from 'vitest';
import { OneEuroFilter } from '../../src/controller/oneEuro';
import { DEFAULT_SETTINGS, maxAngle } from '../../src/controller/settings';
import { TiltSteering, applyDeadzone, upVector } from '../../src/controller/tilt';

const RAD = 180 / Math.PI;

/**
 * Erzeugt beta/gamma für eine Haltung im Querformat.
 * @param side   +1: Oberkante des Handys zeigt nach links, -1: nach rechts
 * @param back   wie weit das Display nach hinten gekippt ist (0 = senkrecht, 90 = flach)
 * @param wheel  Drehung wie ein Lenkrad, positiv = nach rechts
 *
 * Gerechnet wird direkt mit dem "oben"-Vektor in Gerätekoordinaten, daraus
 * folgen beta und gamma über die Umkehrung von upVector().
 */
function hold(side: 1 | -1, back: number, wheel: number): { beta: number; gamma: number } {
  const b = back / RAD;
  const w = wheel / RAD;
  // Senkrecht gehalten: oben = ±X. Lenkrad-Drehung kippt die lange Achse (Y).
  // Rechts lenken hebt bei side=+1 die Oberkante (linke Hand) an → y positiv.
  const up = {
    x: side * Math.cos(w) * Math.cos(b),
    y: side * Math.sin(w) * Math.cos(b),
    z: Math.sin(b),
  };
  const beta = Math.asin(up.y) * RAD;
  const gamma = Math.atan2(-up.x, up.z) * RAD;
  return { beta, gamma };
}

describe('upVector', () => {
  it('liegt flach: Display zeigt nach oben', () => {
    const u = upVector(0, 0);
    expect(u.z).toBeCloseTo(1);
  });
  it('hochkant aufrecht: Oberkante zeigt nach oben', () => {
    const u = upVector(90, 0);
    expect(u.y).toBeCloseTo(1);
  });
  it('hold() und upVector() passen zusammen', () => {
    const h = hold(1, 30, 20);
    const u = upVector(h.beta, h.gamma);
    expect(u.x).toBeGreaterThan(0.5);
    expect(u.y).toBeGreaterThan(0);
  });
});

describe('TiltSteering', () => {
  const feedHold = (t: TiltSteering, side: 1 | -1, back: number, wheel: number, ms: number): void => {
    const h = hold(side, back, wheel);
    t.feed(h.beta, h.gamma, ms);
  };

  const settle = (t: TiltSteering, side: 1 | -1, back: number, wheel: number, from: number): number => {
    let ms = from;
    for (let i = 0; i < 60; i++) {
      ms += 1000 / 60;
      feedHold(t, side, back, wheel, ms);
    }
    return ms;
  };

  for (const side of [1, -1] as const) {
    it(`lenkt in beiden Querlagen richtig herum (Seite ${side})`, () => {
      const t = new TiltSteering({ ...DEFAULT_SETTINGS });
      let ms = settle(t, side, 20, 0, 0);
      t.calibrate();
      ms = settle(t, side, 20, 25, ms);
      expect(t.value).toBeGreaterThan(0.4);
      ms = settle(t, side, 20, -25, ms);
      expect(t.value).toBeLessThan(-0.4);
      expect(t.side).toBe(side);
    });
  }

  it('Vollausschlag beim eingestellten Winkel, senkrecht gehalten', () => {
    const settings = { ...DEFAULT_SETTINGS, deadzone: 0 };
    const t = new TiltSteering(settings);
    let ms = settle(t, 1, 0, 0, 0);
    t.calibrate();
    ms = settle(t, 1, 0, maxAngle(settings.sensitivity), ms);
    expect(t.value).toBeCloseTo(1, 1);
    settle(t, 1, 0, maxAngle(settings.sensitivity) / 2, ms);
    expect(t.value).toBeCloseTo(0.5, 1);
  });

  it('Kalibrieren setzt die aktuelle Haltung als Mitte', () => {
    const t = new TiltSteering({ ...DEFAULT_SETTINGS });
    let ms = settle(t, 1, 30, 12, 0);
    t.calibrate();
    ms = settle(t, 1, 30, 12, ms);
    expect(Math.abs(t.value)).toBeLessThan(0.01);
  });

  it('bleibt in flacher Haltung stabil (kein Vorzeichen-Flattern)', () => {
    const t = new TiltSteering({ ...DEFAULT_SETTINGS });
    let ms = settle(t, 1, 20, 0, 0);
    t.calibrate();
    // Fast flach: die Seitenlage ist kaum noch messbar, darf aber nicht umspringen.
    let flips = 0;
    t.onSideChange = () => flips++;
    for (let i = 0; i < 120; i++) {
      ms += 1000 / 60;
      const h = hold(1, 86, 0);
      t.feed(h.beta + Math.sin(i) * 0.5, h.gamma + Math.cos(i * 1.3) * 3, ms);
    }
    expect(flips).toBe(0);
    expect(Math.abs(t.value)).toBeLessThan(0.1);
  });

  it('Invertieren dreht das Vorzeichen', () => {
    const t = new TiltSteering({ ...DEFAULT_SETTINGS, invert: true });
    let ms = settle(t, 1, 10, 0, 0);
    t.calibrate();
    settle(t, 1, 10, 25, ms);
    expect(t.value).toBeLessThan(-0.4);
  });
});

describe('applyDeadzone', () => {
  it('ist in der Mitte null und danach stetig', () => {
    expect(applyDeadzone(0.03, 0.05)).toBe(0);
    expect(applyDeadzone(-0.05, 0.05)).toBe(0);
    expect(applyDeadzone(0.051, 0.05)).toBeCloseTo(0.001, 2);
    expect(applyDeadzone(1, 0.05)).toBe(1);
    expect(applyDeadzone(-1, 0.05)).toBe(-1);
  });
});

describe('OneEuroFilter mit den Controller-Werten (6 Hz, 0.12, 4 Hz)', () => {
  const make = (): OneEuroFilter => new OneEuroFilter(6, 0.12, 4);

  /** Verzögerung in ms, mit der der Filter einer gleichmäßigen Drehung folgt. */
  function rampLag(degPerSec: number): number {
    const f = make();
    let out = 0;
    let t = 0;
    for (let i = 0; i < 30; i++) {
      t = i / 60;
      out = f.filter(degPerSec * t, t);
    }
    return ((degPerSec * t - out) / degPerSec) * 1000;
  }

  it('folgt einer zügigen Lenkbewegung (150°/s) mit unter 10 ms Verzögerung', () => {
    const lag = rampLag(150);
    console.log(`Verzögerung bei 150°/s: ${lag.toFixed(1)} ms`);
    expect(lag).toBeLessThan(10);
  });

  it('folgt einer langsamen Korrektur (20°/s) mit unter 25 ms Verzögerung', () => {
    const lag = rampLag(20);
    console.log(`Verzögerung bei 20°/s: ${lag.toFixed(1)} ms`);
    expect(lag).toBeLessThan(25);
  });

  it('dämpft Sensorrauschen im Stillstand deutlich', () => {
    const f = make();
    let seed = 1;
    const rand = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647 - 0.5;
    };
    let sumIn = 0;
    let sumOut = 0;
    for (let i = 0; i < 600; i++) {
      const noise = rand() * 0.6; // ±0,3°
      const out = f.filter(noise, i / 60);
      if (i > 60) {
        sumIn += noise * noise;
        sumOut += out * out;
      }
    }
    const ratio = Math.sqrt(sumOut / sumIn);
    console.log(`Rauschen nach Filter: ${(ratio * 100).toFixed(0)} % des Eingangs`);
    expect(ratio).toBeLessThan(0.65);
  });
});

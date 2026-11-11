import { afterAll, describe, expect, it } from 'vitest';
import { AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { AVALANCHE_PUSH, PULSE_AVALANCHE, PULSE_ICICLE, pulseCycle } from '../../src/game/mechanics';
import { BTN_BRAKE, BTN_GAS, EV_FALL, EV_HIT, EV_SNOW, V_MAX, forwardSpeed, gridState, stepKart, type KartState } from '../../src/game/sim';
import { SURFACES, SURFACE_INDEX } from '../../src/game/surface';
import { TRACK, proj, projectOnTrack, rightX, rightZ, addProgress, progDelta, setTrack, trackHeading, wrapSeg } from '../../src/game/track';

const EIS = 6;
const ICE = SURFACE_INDEX.ice;
const SNOW = SURFACE_INDEX.snow;

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

/** Führt fn auf einem geraden Stück der Startgeraden aus, dessen Untergrund vorübergehend surf ist. */
function onSurface<T>(surf: number, fn: (seg: number) => T): T {
  const t = TRACK;
  const keep = t.surf.slice();
  const seg = 12;
  for (let k = -6; k < 140; k++) t.surf[wrapSeg(t, seg + k)] = surf;
  try {
    return fn(seg);
  } finally {
    t.surf.set(keep);
  }
}

describe('Rutschen (Eiszapfen-Pass)', () => {
  it('die Strecke hat Schnee, Eis, zwei Lawinenstriche und Eiszapfen in der Höhle', () => {
    const t = setTrack(EIS);
    expect(t.def.name).toBe('Eiszapfen-Pass');
    let ice = 0;
    let snow = 0;
    for (let i = 0; i < t.n; i++) {
      if (t.surf[i] === ICE) ice++;
      else if (t.surf[i] === SNOW) snow++;
    }
    expect(ice / t.n).toBeGreaterThan(0.25);
    expect(snow / t.n).toBeGreaterThan(0.4);
    expect(t.pulses.filter((p) => p.kind === PULSE_AVALANCHE).length).toBe(2);
    expect(t.pulses.filter((p) => p.kind === PULSE_ICICLE).length).toBeGreaterThanOrEqual(4);
    // Start im Schnee, nicht auf Eis.
    for (let slot = 0; slot < 4; slot++) expect(t.surf[gridState(slot).seg]).toBe(SNOW);
  });

  it('auf Eis dreht die Nase fast wie im Schnee – aber das Kart rutscht weiter geradeaus', () => {
    setTrack(EIS);
    const turn = (surf: number): { nose: number; course: number; lat: number } =>
      onSurface(surf, (seg) => {
        const s = at(seg, 0, 22);
        const h0 = s.heading;
        for (let i = 0; i < 40; i++) stepKart(s, { steer: 127, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: 0 });
        projectOnTrack(TRACK, s.x, s.z, s.seg);
        const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
        return { nose: Math.abs(wrap(s.heading - h0)), course: Math.abs(wrap(Math.atan2(s.vx, s.vz) - h0)), lat: Math.abs(proj.lat) };
      });
    const snow = turn(SNOW);
    const ice = turn(ICE);
    console.log(
      `Volle Lenkung, 2/3 s bei 22 m/s: Schnee Nase ${snow.nose.toFixed(2)} rad / Fahrtrichtung ${snow.course.toFixed(2)} rad; Eis Nase ${ice.nose.toFixed(2)} rad / Fahrtrichtung ${ice.course.toFixed(2)} rad`,
    );
    // Die Nase kommt auf Eis fast so weit herum …
    expect(ice.nose).toBeGreaterThan(snow.nose * 0.8);
    // … die Fahrtrichtung aber deutlich weniger: das Kart steht quer zur Fahrt.
    expect(ice.course).toBeLessThan(snow.course * 0.85);
    expect(ice.nose - ice.course).toBeGreaterThan((snow.nose - snow.course) * 1.8);
  });

  it('auf Eis bremst und rollt es sich lang aus, und der Antritt ist zäh', () => {
    setTrack(EIS);
    const brake = (surf: number): number =>
      onSurface(surf, (seg) => {
        const s = at(seg, 0, 24);
        const x = s.x;
        const z = s.z;
        for (let i = 0; i < 240 && forwardSpeed(s) > 0.5; i++) stepKart(s, { steer: 0, buttons: BTN_BRAKE }, { canDrive: true, speedFactor: 1, time: 0 });
        return Math.hypot(s.x - x, s.z - z);
      });
    const sprint = (surf: number): number =>
      onSurface(surf, (seg) => {
        const s = at(seg, 0, 0);
        for (let i = 0; i < 90; i++) stepKart(s, { steer: 0, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: 0 });
        return forwardSpeed(s);
      });
    const bSnow = brake(SNOW);
    const bIce = brake(ICE);
    console.log(`Bremsweg aus 24 m/s: Schnee ${bSnow.toFixed(1)} m, Eis ${bIce.toFixed(1)} m · nach 1,5 s Vollgas: Schnee ${sprint(SNOW).toFixed(1)} m/s, Eis ${sprint(ICE).toFixed(1)} m/s`);
    expect(bIce).toBeGreaterThan(bSnow * 2.2);
    expect(sprint(ICE)).toBeLessThan(sprint(SNOW) * 0.85);
    // Dafür ist Eis in der Spitze schneller.
    expect(SURFACES[ICE].speed).toBeGreaterThan(SURFACES[SNOW].speed);
  });

  it('eine Lawine schiebt talwärts und bremst stark – außerhalb ihres Takts ist die Bahn frei', () => {
    const t = setTrack(EIS);
    const p = t.pulses.find((q) => q.kind === PULSE_AVALANCHE)!;
    const active = 10 - p.phase;
    const quiet = p.on + 30 - p.phase;
    expect(pulseCycle(p, active)).toBeLessThan(p.on);
    expect(pulseCycle(p, quiet)).toBeGreaterThanOrEqual(p.on);
    const cross = (time: number): { v: number; shift: number; ev: number } => {
      const s = at(wrapSeg(t, p.seg - 8), 0, 22);
      projectOnTrack(t, s.x, s.z, s.seg);
      const lat0 = proj.lat;
      let ev = 0;
      // Die Zeit steht: gemessen wird eine Durchfahrt bei laufender bzw. ruhender Lawine.
      for (let i = 0; i < 45; i++) ev |= stepKart(s, { steer: 0, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: time - (time % 12) });
      projectOnTrack(t, s.x, s.z, s.seg);
      return { v: forwardSpeed(s), shift: proj.lat - lat0, ev };
    };
    const hit = cross(active);
    const free = cross(quiet);
    console.log(`Lawine: Tempo danach ${hit.v.toFixed(1)} m/s (ohne ${free.v.toFixed(1)}), seitlich ${hit.shift.toFixed(1)} m verschoben`);
    expect(hit.ev & EV_SNOW).not.toBe(0);
    expect(hit.ev & EV_HIT).toBe(0);
    expect(free.ev & EV_SNOW).toBe(0);
    expect(hit.v).toBeLessThan(free.v * 0.7);
    // Schub weg von der Bergseite (p.lat nennt sie), aber nicht durch die Bande hindurch.
    expect(Math.sign(hit.shift)).toBe(-Math.sign(p.lat));
    expect(Math.abs(hit.shift)).toBeGreaterThan(1.5);
    expect(Math.abs(hit.shift)).toBeLessThan(AVALANCHE_PUSH);
    expect(hit.ev & EV_FALL).toBe(0);
  });

  it('die KI wartet eine Lawine ab oder ist vorher durch – in drei Runden gerät sie kaum hinein', () => {
    const t = setTrack(EIS);
    let snow = 0;
    let falls = 0;
    for (let slot = 0; slot < 4; slot++) {
      const s = gridState(slot);
      const brain = newBrain(slot, AI_HARD);
      let progress = progDelta(t, 0, s.seg);
      for (let tick = 1; tick < 4 * 80 * 60 && progress < 3 * t.n; tick++) {
        const before = s.seg;
        const ev = stepKart(s, botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false }), { canDrive: true, speedFactor: brain.skill, time: tick });
        if (ev & EV_SNOW) snow++;
        if (ev & EV_FALL) falls++;
        progress = addProgress(t, progress, before, s.seg);
      }
      expect(progress).toBeGreaterThanOrEqual(3 * t.n);
    }
    console.log(`Vier starke KI-Fahrer, je drei Runden: ${snow} Lawinen-Meldungen (eine je 12 Ticks im Schnee), ${falls} Stürze`);
    // 24 Durchfahrten unter Lawinenstrichen: höchstens ein, zwei Mal erwischt es einen (eine volle Durchfahrt im
    // Schnee sind etwa zehn Meldungen). Die zweite Lawine liegt auf blankem Eis im Gefälle – wer dort knapp
    // kalkuliert und vorher für die Kurve bremsen muss, kommt nicht mehr zum Stehen.
    expect(snow).toBeLessThanOrEqual(16);
    expect(falls).toBeLessThanOrEqual(2);
  });

  it('Eiszapfen treffen beim Einschlag – daneben und davor nicht', () => {
    const t = setTrack(EIS);
    const p = t.pulses.find((q) => q.kind === PULSE_ICICLE)!;
    const stand = (lat: number, time: number): number => {
      const s = at(p.seg, lat, 0);
      return stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time });
    };
    expect(stand(p.lat, 5 - p.phase) & EV_HIT).not.toBe(0);
    expect(stand(p.lat, p.on + 20 - p.phase) & EV_HIT).toBe(0);
    expect(stand(p.lat + p.radius + 2.2, 5 - p.phase) & EV_HIT).toBe(0);
    // In der Höhle bleibt neben jedem Zapfen Platz zum Vorbeifahren.
    for (const q of t.pulses) if (q.kind === PULSE_ICICLE) expect(t.rh[q.seg] - Math.abs(q.lat) - q.radius).toBeGreaterThan(-0.5);
    expect(V_MAX).toBeGreaterThan(0);
  });
});

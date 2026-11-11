import { afterAll, describe, expect, it } from 'vitest';
import { AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import {
  BELT_EDGE,
  BELT_RAMP,
  DRAFT_FULL,
  DRAFT_PULL_FROM,
  FLAT_FACTOR,
  FLOOD_FROM,
  GLIDE_CEILING,
  GLIDE_EDGE,
  GLIDE_FALL,
  GLIDE_SINK,
  GLIDE_SPEED,
  PRESS_STRIKE,
  PULSE_BOMB,
  PULSE_PRESS,
  PULSE_VENT,
  VEH_BUS,
  VEH_TAXI,
  VEH_TRAM,
  floodLevel,
  floodPeak,
  pressOpen,
  pulseCycle,
  pulseWarning,
  tideLevel,
  tidePhase,
  waterFactor,
  type Vehicle,
} from '../../src/game/mechanics';
import {
  BTN_BRAKE,
  BTN_GAS,
  BTN_ITEM,
  EV_BLOCK,
  EV_BURN,
  EV_DRAFT,
  EV_FLAT,
  EV_FALL,
  EV_HIT,
  EV_PAD,
  EV_SPLASH,
  EV_USE_BOOST,
  EV_WALL,
  FLAG_AIR,
  FLAG_GLIDE,
  GUARD_TICKS,
  ITEM_BOOST,
  PAD_TICKS,
  V_MAX,
  forwardSpeed,
  gridState,
  lavaAt,
  ringAt,
  stepKart,
  thermalLift,
  type KartState,
} from '../../src/game/sim';
import { EDGE_GAP, EDGE_GLIDE, TRACK, newVehiclePose, proj, projectOnTrack, rightX, rightZ, segDelta, setTrack, trackHeading, vehiclePose, wrapSeg } from '../../src/game/track';

afterAll(() => {
  setTrack(0);
});

const POSE = newVehiclePose();
const GAS = { steer: 0, buttons: BTN_GAS };

/** Kart relativ zu einem Fahrzeug aufstellen: back Meter hinter dessen Mitte, side Meter rechts daneben, mit Tempo speed. */
function behind(v: Vehicle, time: number, back: number, side: number, speed: number, car = 0): KartState {
  const t = TRACK;
  const p = vehiclePose(t, v, car, time, POSE);
  const hx = Math.sin(p.heading);
  const hz = Math.cos(p.heading);
  const s = gridState(0);
  s.x = p.x - hx * back - hz * side;
  s.z = p.z - hz * back + hx * side;
  s.y = p.y;
  s.seg = wrapSeg(t, p.seg - Math.round(back));
  s.heading = p.heading;
  s.vx = hx * speed;
  s.vz = hz * speed;
  s.vy = 0;
  s.flags = 0;
  return s;
}

/**
 * Sucht ein Fahrzeug der gewünschten Art und einen Zeitpunkt, zu dem es auf
 * einem geraden Stück fährt und in den Spuren bis clearLat Meter seitlich kein
 * anderes Fahrzeug im Bereich [−back, ahead] Meter um es herum unterwegs ist.
 */
function scene(kind: number, clearLat = 3, back = 30, ahead = 60): { v: Vehicle; time: number } {
  const t = TRACK;
  const lap = t.n * t.step;
  for (let time = 600; time < 9000; time += 45) {
    const at = (v: Vehicle): number => (((v.offset + (v.speed * time) / 60) % lap) + lap) % lap;
    for (const v of t.vehicles) {
      if (v.kind !== kind) continue;
      const p = vehiclePose(t, v, 0, time, POSE);
      let fine = true;
      for (let k = -40; k <= 90; k++) {
        const i = wrapSeg(t, p.seg + k);
        if (Math.abs(t.curv[i]) > 1 / 400 || t.branchOf[i] !== -1 || t.twin[i] >= 0) fine = false;
      }
      for (const o of t.vehicles) {
        if (o === v || Math.abs(o.lat - v.lat) > clearLat) continue;
        let d = at(o) - at(v);
        if (d > lap / 2) d -= lap;
        else if (d < -lap / 2) d += lap;
        if (d > -back - o.half - (o.cars - 1) * o.pitch && d < ahead + o.half) fine = false;
      }
      if (fine) return { v, time };
    }
  }
  throw new Error(`kein Fahrzeug der Art ${kind} frei auf einer Geraden gefunden`);
}

/** Das Kart `ticks` Schritte fahren lassen; gibt alle Ereignis-Bits zurück. */
function run(s: KartState, from: number, ticks: number, cmd = GAS): number {
  let ev = 0;
  for (let i = 0; i < ticks; i++) ev |= stepKart(s, cmd, { canDrive: true, speedFactor: 1, time: from + i });
  return ev;
}

describe('Verkehr (Nachtschicht)', () => {
  it('die Startaufstellung ist während des Countdowns und kurz danach frei', () => {
    const t = setTrack(3);
    expect(t.vehicles.length).toBeGreaterThan(30);
    let nearest = Infinity;
    let who = '';
    for (let time = -360; time <= 210; time += 6) {
      for (const v of t.vehicles) {
        for (let car = 0; car < v.cars; car++) {
          const p = vehiclePose(t, v, car, time, POSE);
          for (let slot = 0; slot < 4; slot++) {
            const g = gridState(slot);
            // Räumlicher Abstand: die Parkhaus-Spirale läuft unter der Startgeraden hindurch.
            // Die Parkhaus-Spirale läuft unter der Startgeraden hindurch: was mehr als ein
            // Stockwerk tiefer fährt, ist weder zu sehen noch im Weg.
            if (Math.abs(p.y - g.y) > 3) continue;
            const d = Math.hypot(p.x - g.x, p.z - g.z) - v.half;
            if (d < nearest) {
              nearest = d;
              who = `Art ${v.kind}, Spur ${v.lat}, Start bei ${v.offset} m, Zeit ${(time / 60).toFixed(1)} s, Höhe ${(p.y - g.y).toFixed(1)} m`;
            }
          }
        }
      }
    }
    console.log(`Verkehr: kleinster Abstand zur Startaufstellung von 6 s vor bis 3,5 s nach "Los": ${nearest.toFixed(0)} m (${who})`);
    expect(nearest).toBeGreaterThan(25);
  });

  it('nebeneinander fahren höchstens zwei Fahrzeuge – eine ganze Spur bleibt immer frei (zehn Minuten Rennen)', () => {
    const t = setTrack(3);
    const lap = t.n * t.step;
    const rh = t.def.roadHalf;
    let tightest = Infinity;
    let most = 0;
    for (let time = 0; time <= 36000; time += 30) {
      // Alle Wagen als Stück der Hauptstrecke [von, bis] mit seitlichem Streifen
      const cars: { a: number; b: number; lo: number; hi: number; lane: number }[] = [];
      for (const v of t.vehicles) {
        for (let car = 0; car < v.cars; car++) {
          // (In Kurven strecken sich die Wagen der Bahn bis auf das 1,25-Fache – 2 m Zugabe decken das ab.)
          const s = (((v.offset + (v.speed * time) / 60 - car * v.pitch * 1.12) % lap) + lap) % lap;
          cars.push({ a: s - v.half - 3, b: s + v.half + 3, lo: v.lat - v.halfWidth, hi: v.lat + v.halfWidth, lane: v.lat });
        }
      }
      for (const c of cars) {
        const side = cars.filter((o) => {
          const d = Math.abs((o.a + o.b) / 2 - (c.a + c.b) / 2);
          const gap = Math.min(d, lap - d);
          return gap < (o.b - o.a) / 2 + (c.b - c.a) / 2;
        });
        most = Math.max(most, new Set(side.map((o) => o.lane)).size);
        // Breiteste freie Lücke quer über die Fahrbahn an dieser Stelle
        const blocked = side.map((o) => [o.lo, o.hi]).sort((x, y) => x[0] - y[0]);
        let free = 0;
        let edge = -rh;
        for (const [lo, hi] of blocked) {
          free = Math.max(free, lo - edge);
          edge = Math.max(edge, hi);
        }
        free = Math.max(free, rh - edge);
        tightest = Math.min(tightest, free);
      }
    }
    console.log(`Verkehr: höchstens ${most} Spuren nebeneinander besetzt, schmalste freie Lücke ${tightest.toFixed(1)} m (Kart: 2 m)`);
    expect(most).toBeLessThanOrEqual(2);
    expect(tightest).toBeGreaterThan(3.6);
  });

  it('wer mit Tempo auffährt, schleudert – wer langsam aufschließt, wird nur gebremst', () => {
    setTrack(3);
    const { v: bus, time: T0 } = scene(VEH_BUS);
    // Vollgas ins Heck
    const fast = behind(bus, T0, bus.half + 14, 0, V_MAX);
    const ev = run(fast, T0, 120);
    expect(ev & EV_HIT).not.toBe(0);
    expect(fast.spin).toBeGreaterThan(0);
    // Mit wenig Überschuss: Kontakt, aber kein Dreher – das Kart wird auf das Tempo des Busses gebremst.
    const slow = behind(bus, T0, bus.half + 6, 0, bus.speed + 4);
    const ev2 = run(slow, T0, 180, { steer: 0, buttons: 0 });
    expect(ev2 & EV_HIT).toBe(0);
    expect(slow.spin).toBe(0);
    const p = vehiclePose(TRACK, bus, 0, T0 + 180, POSE);
    const gap = (p.x - slow.x) * Math.sin(p.heading) + (p.z - slow.z) * Math.cos(p.heading);
    // Es steckt nicht im Bus.
    expect(gap).toBeGreaterThan(bus.half + 0.9);
  });

  it('seitlich streift man nur entlang, und eine gestreifte Ecke ist kein Auffahrunfall', () => {
    setTrack(3);
    const { v: bus, time: T0 } = scene(VEH_BUS, 5);
    // Neben dem Bus, lenkt hinein
    const beside = behind(bus, T0, 0, -(bus.halfWidth + 1.6), bus.speed + 3);
    const ev = run(beside, T0, 120, { steer: 60, buttons: BTN_GAS });
    expect(ev & EV_HIT).toBe(0);
    const p = vehiclePose(TRACK, bus, 0, T0 + 120, POSE);
    const dw = -(beside.x - p.x) * Math.cos(p.heading) + (beside.z - p.z) * Math.sin(p.heading);
    const du = (beside.x - p.x) * Math.sin(p.heading) + (beside.z - p.z) * Math.cos(p.heading);
    // Entweder noch daneben (außerhalb des Blechs) oder längst vorbei.
    expect(Math.abs(du) > bus.half + 0.9 || Math.abs(dw) > bus.halfWidth + 0.9).toBe(true);
    // Von hinten nur die Ecke erwischt: Tempo weg, aber kein Dreher
    const clip = behind(bus, T0, bus.half + 12, bus.halfWidth + 0.7, V_MAX);
    const ev2 = run(clip, T0, 120);
    expect(ev2 & EV_HIT).toBe(0);
    expect(clip.spin).toBe(0);
  });

  it('an den Ecken zählt der Kreis des Karts, nicht ein vergrößertes Rechteck', () => {
    setTrack(3);
    const { v: bus, time: T0 } = scene(VEH_BUS, 5);
    // Schräg hinter der Ecke, 1,13 m von ihr entfernt (0,8 m längs und quer): kein Kontakt.
    const far = behind(bus, T0, bus.half + 0.8, bus.halfWidth + 0.8, bus.speed);
    const x = far.x;
    const z = far.z;
    const ev = stepKart(far, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: T0 });
    expect(ev & (EV_HIT | EV_WALL)).toBe(0);
    // Es rollt einfach weiter (ein Schritt bei Bustempo), ohne zur Seite geschoben zu werden.
    expect(Math.hypot(far.x - x, far.z - z)).toBeLessThan(bus.speed / 60 + 0.02);
    // 0,85 m von der Ecke (0,6 m längs und quer): Kontakt – hinausgeschoben, aber kein Dreher.
    const near = behind(bus, T0, bus.half + 0.6, bus.halfWidth + 0.6, bus.speed);
    const ev2 = stepKart(near, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: T0 });
    expect(ev2 & EV_HIT).toBe(0);
    expect(near.spin).toBe(0);
    const p = vehiclePose(TRACK, bus, 0, T0, POSE);
    const du = Math.abs((near.x - p.x) * Math.sin(p.heading) + (near.z - p.z) * Math.cos(p.heading)) - bus.half;
    const dw = Math.abs(-(near.x - p.x) * Math.cos(p.heading) + (near.z - p.z) * Math.sin(p.heading)) - bus.halfWidth;
    expect(Math.hypot(Math.max(0, du), Math.max(0, dw))).toBeGreaterThan(0.93);
  });

  it('der Stoßfänger fängt einen Auffahrunfall ab', () => {
    setTrack(3);
    const { v: taxi, time: T0 } = scene(VEH_TAXI);
    const s = behind(taxi, T0, taxi.half + 12, 0, V_MAX);
    s.guard = GUARD_TICKS;
    const ev = run(s, T0, 120);
    expect(ev & EV_BLOCK).not.toBe(0);
    expect(ev & EV_HIT).toBe(0);
    expect(s.spin).toBe(0);
    expect(s.guard).toBe(0);
  });

  it('wer über ein Taxi springt, wird nicht getroffen', () => {
    setTrack(3);
    const { v: taxi, time: T0 } = scene(VEH_TAXI);
    const s = behind(taxi, T0, taxi.half + 3, 0, V_MAX);
    s.y += taxi.height + 1.2;
    s.vy = 4;
    s.flags = FLAG_AIR;
    const ev = run(s, T0, 30);
    expect(ev & EV_HIT).toBe(0);
    expect(s.spin).toBe(0);
  });

  it('Windschatten: dicht hinter dem Bus lädt er, beim Ausscheren zieht es – und die Bremse geht vor', () => {
    const t = setTrack(3);
    // Die Nachbarspur muss frei sein: dorthin schert das Kart aus.
    const { v: bus, time: T0 } = scene(VEH_BUS, 5, 25, 70);
    const s = behind(bus, T0, bus.half + 6, 0, bus.speed);
    let time = T0;
    // Abstand halten: Gas nur, wenn der Bus davonzieht.
    for (; time < T0 + 90; time++) {
      const p = vehiclePose(t, bus, 0, time, POSE);
      const gap = (p.x - s.x) * Math.sin(p.heading) + (p.z - s.z) * Math.cos(p.heading) - bus.half;
      stepKart(s, { steer: 0, buttons: gap > 6 ? BTN_GAS : 0 }, { canDrive: true, speedFactor: 1, time });
    }
    expect(s.draft).toBe(DRAFT_FULL);
    // Ausscheren: eine Spur nach links versetzen
    const hz = Math.cos(s.heading);
    const hx = Math.sin(s.heading);
    s.x += hz * 4;
    s.z -= hx * 4;
    const out = { ...s };
    const ev = stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: time++ });
    expect(ev & EV_DRAFT).not.toBe(0);
    expect(s.draft).toBeGreaterThanOrEqual(DRAFT_PULL_FROM);
    run(s, time, 80);
    // Schneller als die gewöhnliche Höchstgeschwindigkeit auf diesem Belag
    expect(forwardSpeed(s)).toBeGreaterThan(V_MAX * 1.1);
    // Dasselbe mit der Bremse: kein Zug
    run(out, time, 20, { steer: 0, buttons: BTN_BRAKE });
    expect(forwardSpeed(out)).toBeLessThan(2);
  });

  it('die Bremse geht vor dem Schub (sonst schiebt ein Mini-Turbo ins Heck)', () => {
    setTrack(0);
    const s = gridState(0);
    s.vx = Math.sin(s.heading) * 20;
    s.vz = Math.cos(s.heading) * 20;
    s.boost = 60;
    run(s, 0, 30, { steer: 0, buttons: BTN_BRAKE });
    expect(forwardSpeed(s)).toBeLessThan(5);
  });

  it('wer im Ziel steht oder auf die Ampel wartet, wird vom Verkehr in Ruhe gelassen', () => {
    setTrack(3);
    const { v: bus, time: T0 } = scene(VEH_BUS);
    // Steht mitten in der Busspur, der Bus kommt von hinten.
    const s = behind(bus, T0, -(bus.half + 8), 0, 0);
    const x = s.x;
    const z = s.z;
    let ev = 0;
    for (let i = 0; i < 180; i++) ev |= stepKart(s, { steer: 0, buttons: 0 }, { canDrive: false, speedFactor: 1, time: T0 + i });
    expect(ev & EV_HIT).toBe(0);
    expect(s.spin).toBe(0);
    expect(Math.hypot(s.x - x, s.z - z)).toBeLessThan(0.5);
  });

  it('die Straßenbahn folgt mit allen Wagen der Kurve', () => {
    const t = setTrack(3);
    const tram = t.vehicles.find((v) => v.kind === VEH_TRAM)!;
    expect(tram.cars).toBe(3);
    for (let time = 0; time < 6000; time += 97) {
      const a = { ...vehiclePose(t, tram, 0, time, POSE) };
      const b = { ...vehiclePose(t, tram, 1, time, POSE) };
      // Wagenabstand bleibt der Kupplungsabstand (in Kurven minimal kürzer).
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      expect(d).toBeGreaterThan(tram.pitch * 0.88);
      expect(d).toBeLessThan(tram.pitch * 1.12);
    }
  });
});

describe('Geysire, Lavabomben und Lavaschwall (Glutkessel)', () => {
  it('ein Geysir trifft nur während des Ausbruchs und wirft das Kart hoch', () => {
    const t = setTrack(2);
    const p = t.pulses.find((x) => x.kind === PULSE_VENT)!;
    const at = (time: number): { ev: number; s: KartState } => {
      const s = gridState(0);
      s.seg = p.seg;
      s.x = p.x;
      s.y = p.y;
      s.z = p.z;
      s.heading = trackHeading(t, p.seg);
      s.flags = 0;
      return { ev: stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time }), s };
    };
    const erupt = 5 - p.phase; // Zyklus 5: mitten im Ausbruch
    expect(pulseCycle(p, erupt)).toBe(5);
    const hit = at(erupt);
    expect(hit.ev & EV_HIT).not.toBe(0);
    expect(hit.s.spin).toBeGreaterThan(0);
    expect(hit.s.vy).toBeGreaterThan(5);
    expect(hit.s.flags & FLAG_AIR).not.toBe(0);
    const quiet = at(erupt + p.on + 40);
    expect(quiet.ev & EV_HIT).toBe(0);
    expect(quiet.s.spin).toBe(0);
    // Die Vorwarnung läuft bis unmittelbar vor den Ausbruch.
    expect(pulseWarning(p, erupt - 6)).toBeGreaterThan(0.9);
    expect(pulseWarning(p, erupt - 5 - p.warn - 1)).toBe(0);
  });

  it('quer über die Bahn brechen nie alle Geysire einer Reihe zugleich aus', () => {
    const t = setTrack(2);
    const vents = t.pulses.filter((x) => x.kind === PULSE_VENT);
    // Reihen: Geysire, die höchstens 12 Abschnitte auseinanderliegen
    const rows: (typeof vents)[] = [];
    for (const v of vents) {
      const row = rows.find((r) => Math.abs(segDelta(t, r[0].seg, v.seg)) <= 12);
      if (row) row.push(v);
      else rows.push([v]);
    }
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const row of rows) {
      expect(row.length).toBeGreaterThanOrEqual(2);
      for (let time = 0; time < 3600; time += 3) {
        // "Dicht" heißt: gerade aktiv oder kurz davor (wer anfährt, muss eine Spur haben, die frei bleibt).
        const closed = row.filter((p) => pulseCycle(p, time) < p.on || pulseWarning(p, time) > 0.6).length;
        expect(closed).toBeLessThan(row.length);
      }
    }
  });

  it('eine Lavabombe trifft beim Einschlag und solange die Glut liegt – davor nicht', () => {
    const t = setTrack(2);
    const p = t.pulses.find((x) => x.kind === PULSE_BOMB)!;
    const at = (time: number): number => {
      const s = gridState(0);
      s.seg = p.seg;
      s.x = p.x + 1;
      s.y = p.y;
      s.z = p.z;
      s.flags = 0;
      return stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time });
    };
    expect(at(-p.phase + 2) & EV_HIT).not.toBe(0);
    expect(at(-p.phase + p.on - 3) & EV_HIT).not.toBe(0);
    expect(at(-p.phase - 20) & EV_HIT).toBe(0);
    expect(at(-p.phase + p.on + 5) & EV_HIT).toBe(0);
  });

  it('der Lavaschwall bremst in der Höhle und läuft an den Enden flach aus', () => {
    const t = setTrack(2);
    const f = t.floods[0];
    expect(f.branch).toBeGreaterThanOrEqual(0);
    const full = f.rise + 10 - f.phase;
    const dry = f.rise + f.hold + f.fall + 30 - f.phase;
    expect(floodLevel(f, full)).toBe(1);
    expect(floodLevel(f, dry)).toBe(0);
    const mid = f.first + (f.count >> 1);
    expect(lavaAt(t, mid, full)).toBe(1);
    expect(lavaAt(t, f.first, full)).toBeLessThan(0.3);
    expect(lavaAt(t, f.first - 1, full)).toBe(0);
    const drive = (time: number): { v: number; ev: number } => {
      const s = gridState(0);
      const seg = f.first + 8;
      s.seg = seg;
      s.x = t.px[seg];
      s.y = t.py[seg];
      s.z = t.pz[seg];
      s.heading = trackHeading(t, seg);
      s.vx = Math.sin(s.heading) * 20;
      s.vz = Math.cos(s.heading) * 20;
      s.flags = 0;
      let ev = 0;
      // Die Zeit bleibt stehen: gemessen wird das Tempo bei diesem Pegel.
      for (let i = 0; i < 50; i++) ev |= stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: time - (time % 24) });
      return { v: forwardSpeed(s), ev };
    };
    const wet = drive(full);
    const free = drive(dry);
    console.log(`Lavaschwall: ${wet.v.toFixed(1)} m/s in der Lava, ${free.v.toFixed(1)} m/s bei freier Höhle`);
    expect(wet.v).toBeLessThan(free.v * 0.7);
    expect(wet.ev & EV_BURN).not.toBe(0);
    expect(free.ev & EV_BURN).toBe(0);
  });

  it('die KI nimmt die Höhle genau dann, wenn sie bei der Durchfahrt frei ist', () => {
    const t = setTrack(2);
    const f = t.floods[0];
    const b = t.branches[f.branch];
    // Startet 120 m vor der Gabelung und fährt bis hinter die Entscheidung.
    const decide = (start: number): { route: number; arrive: number } => {
      const s = gridState(1);
      const seg = wrapSeg(t, b.from - 120);
      s.seg = seg;
      s.x = t.px[seg];
      s.y = t.py[seg];
      s.z = t.pz[seg];
      s.heading = trackHeading(t, seg);
      s.vx = Math.sin(s.heading) * 22;
      s.vz = Math.cos(s.heading) * 22;
      const brain = newBrain(1, AI_MEDIUM);
      let time = start;
      for (; segDelta(t, s.seg, b.from) > 40 && time < start + 600; time++) {
        const cmd = botCmd(s, brain, [], true, { tick: time, time, place: 1, smoke: false });
        stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time });
      }
      return { route: (brain.route >> f.branch) & 1, arrive: time + f.lead + 100 };
    };
    let took = 0;
    let avoided = 0;
    for (let start = 0; start < f.period; start += 97) {
      const d = decide(start);
      const wet = floodPeak(f, d.arrive - 60, d.arrive + 260) > FLOOD_FROM;
      const clear = floodPeak(f, d.arrive - 260, d.arrive + 460) <= FLOOD_FROM;
      if (d.route === 1) {
        took++;
        // Wer hineinfährt, trifft nicht auf den vollen Schwall.
        expect(floodPeak(f, d.arrive - 20, d.arrive + 120)).toBeLessThan(0.8);
      } else {
        avoided++;
        // Gemieden wird nur, wenn es wirklich nass würde (mit etwas Spielraum).
        expect(clear).toBe(false);
      }
      void wet;
    }
    console.log(`Höhle: ${took}-mal genommen, ${avoided}-mal gemieden (über einen ganzen Takt verteilt)`);
    expect(took).toBeGreaterThan(2);
    expect(avoided).toBeGreaterThan(2);
  });
});

describe('Förderband, Stampfpresse, Gezeiten (Grundgerüst, mit Testdaten auf dem Werkshof)', () => {
  /** Ein gerades Stück der Startgeraden. */
  const SEG = 20;

  /** Kart auf Abschnitt seg, seitlich lat, mit Tempo speed. */
  function at(seg: number, lat: number, speed: number): KartState {
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

  it('ein Förderband nimmt das Kart mit – vorwärts, rückwärts und quer', () => {
    const t = setTrack(0);
    const real = t.belts;
    const go = (along: number, across: number): { way: number; lat: number } => {
      t.belts = along === 0 && across === 0 ? [] : [{ first: SEG - 2, count: 60, lat0: -3, lat1: 3, along, across }];
      try {
        const s = at(SEG, 0, 20);
        const x = s.x;
        const z = s.z;
        for (let i = 0; i < 30; i++) stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: i });
        projectOnTrack(t, s.x, s.z, s.seg);
        return { way: Math.hypot(s.x - x, s.z - z), lat: proj.lat };
      } finally {
        t.belts = real;
      }
    };
    const plain = go(0, 0);
    const fwd = go(6, 0);
    const back = go(-5, 0);
    const side = go(0, 3);
    // 30 Ticks = eine halbe Sekunde: 3 m mehr, 2,5 m weniger, 1,5 m zur Seite
    expect(fwd.way - plain.way).toBeGreaterThan(2.8);
    expect(fwd.way - plain.way).toBeLessThan(3.2);
    expect(plain.way - back.way).toBeGreaterThan(2.3);
    expect(side.lat - plain.lat).toBeGreaterThan(1.3);
    expect(Math.abs(fwd.lat - plain.lat)).toBeLessThan(0.05);
  });

  it('eine Stampfpresse plättet: kein Dreher, aber eine Weile flach und langsam', () => {
    const t = setTrack(0);
    const real = t.pulses;
    t.pulses = [{ kind: PULSE_PRESS, seg: SEG, lat: 0, x: t.px[SEG], y: t.py[SEG], z: t.pz[SEG], radius: 2, period: 220, phase: 0, on: 34, warn: 60 }];
    try {
      const s = at(SEG, 0.5, V_MAX);
      const ev = stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: 10 });
      expect(ev & EV_FLAT).not.toBe(0);
      expect(ev & EV_HIT).toBe(0);
      expect(s.spin).toBe(0);
      expect(s.flat).toBeGreaterThan(100);
      // Platt fährt es nur gut halb so schnell …
      let top = 0;
      for (let i = 0; i < 100; i++) {
        stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: 100 + i });
        if (i > 40) top = Math.max(top, forwardSpeed(s));
      }
      expect(top).toBeLessThan(V_MAX * FLAT_FACTOR * 1.08);
      // … und danach wieder normal.
      for (let i = 0; i < 160; i++) stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: 100 });
      expect(s.flat).toBe(0);
      expect(forwardSpeed(s)).toBeGreaterThan(V_MAX * 0.9);
      // Neben der Presse und außerhalb ihres Takts passiert nichts.
      const beside = at(SEG, 5, V_MAX);
      expect(stepKart(beside, GAS, { canDrive: true, speedFactor: 1, time: 10 }) & EV_FLAT).toBe(0);
      const late = at(SEG, 0.5, V_MAX);
      expect(stepKart(late, GAS, { canDrive: true, speedFactor: 1, time: 80 }) & EV_FLAT).toBe(0);
    } finally {
      t.pulses = real;
    }
  });

  it('Ebbe und Flut: der Zyklus beginnt mit Ebbe, steigt, steht, fällt', () => {
    const tide = { low: -0.7, high: 0.6, period: 2400, phase: 0, wave: 0, wavePeriod: 250 };
    expect(tidePhase(tide, 0)).toBe(0);
    expect(tidePhase(tide, 700)).toBe(0);
    expect(tidePhase(tide, 1000)).toBeGreaterThan(0);
    expect(tidePhase(tide, 1000)).toBeLessThan(1);
    expect(tidePhase(tide, 1300)).toBe(1);
    expect(tidePhase(tide, 2390)).toBeLessThan(0.05);
    expect(tideLevel(tide, 1300)).toBeCloseTo(0.6);
    expect(tideLevel(tide, 100)).toBeCloseTo(-0.7);
    expect(waterFactor(0.03)).toBe(1);
    // Setzt an der Wasserlinie stetig ein: knapp darüber bremst es noch kaum.
    expect(waterFactor(0.07)).toBeGreaterThan(0.98);
    expect(waterFactor(0.3)).toBeCloseTo(0.76);
    expect(waterFactor(2)).toBeCloseTo(0.45);
  });

  it('bei Flut bremst das Wasser, wo die Fahrbahn tiefer liegt – auf der hohen Seite bleibt es trocken', () => {
    const t = setTrack(0);
    const bank = t.bank.slice();
    t.tide = { low: -1, high: 0.4, period: 2400, phase: 0, wave: 0, wavePeriod: 250 };
    for (let i = SEG - 5; i < SEG + 80; i++) {
      t.tidal[i] = 1;
      // rechte Seite höher: 8 cm je Meter
      t.bank[i] = 0.08;
    }
    try {
      const HIGH = 1300;
      const LOW = 100;
      const settle = (lat: number, time: number): { v: number; ev: number } => {
        const s = at(SEG, lat, 20);
        let ev = 0;
        for (let i = 0; i < 45; i++) ev |= stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: time - (time % 10) });
        return { v: forwardSpeed(s), ev };
      };
      const deep = settle(-4, HIGH); // 0,4 + 0,32 = 0,72 m tief
      const shallow = settle(2, HIGH); // 0,4 − 0,16 = 0,24 m
      const dry = settle(5.5, HIGH); // 0,4 − 0,44 < 0
      const ebb = settle(-4, LOW);
      console.log(`Flut: tief ${deep.v.toFixed(1)} m/s, flach ${shallow.v.toFixed(1)} m/s, trocken ${dry.v.toFixed(1)} m/s; bei Ebbe ${ebb.v.toFixed(1)} m/s`);
      expect(deep.v).toBeLessThan(dry.v * 0.6);
      expect(shallow.v).toBeLessThan(dry.v * 0.9);
      expect(shallow.v).toBeGreaterThan(deep.v + 3);
      expect(Math.abs(ebb.v - dry.v)).toBeLessThan(0.8);
      expect(deep.ev & EV_SPLASH).not.toBe(0);
      expect(dry.ev & EV_SPLASH).toBe(0);
    } finally {
      t.tide = null;
      t.tidal.fill(0);
      t.bank.set(bank);
    }
  });

  it('die KI sucht das Band, das vorwärts läuft, und bei Flut die trockene Seite', () => {
    const t = setTrack(0);
    const bank = t.bank.slice();
    const drive = (ticks: number, time: number): number => {
      const s = at(SEG, 0, 22);
      const brain = newBrain(2, AI_MEDIUM);
      for (let i = 0; i < ticks; i++) {
        const cmd = botCmd(s, brain, [], true, { tick: i, time, place: 1, smoke: false });
        stepKart(s, cmd, { canDrive: true, speedFactor: 1, time });
      }
      projectOnTrack(t, s.x, s.z, s.seg);
      return proj.lat;
    };
    // Drei Bänder nebeneinander: nur das rechte läuft vorwärts.
    const real = t.belts;
    t.belts = [
      { first: SEG, count: 90, lat0: -6, lat1: -2, along: -5, across: 0 },
      { first: SEG, count: 90, lat0: -2, lat1: 2, along: -5, across: 0 },
      { first: SEG, count: 90, lat0: 2, lat1: 6, along: 6, across: 0 },
    ];
    try {
      const lat = drive(110, 0);
      expect(lat).toBeGreaterThan(2.3);
    } finally {
      t.belts = real;
    }
    // Flut, linke Seite tief
    t.tide = { low: -1, high: 0.3, period: 2400, phase: 0, wave: 0, wavePeriod: 250 };
    for (let i = SEG - 5; i < SEG + 120; i++) {
      t.tidal[i] = 1;
      t.bank[i] = 0.08;
    }
    try {
      const wet = drive(80, 1300);
      const ebb = drive(80, 100);
      // Wasserlinie bei 0,3 / 0,08 = 3,75 m rechts der Mitte: die KI fährt rechts davon.
      expect(wet).toBeGreaterThan(3.2);
      expect(ebb).toBeLessThan(2.5);
    } finally {
      t.tide = null;
      t.tidal.fill(0);
      t.bank.set(bank);
    }
  });
});

describe('Werkshof: Förderbänder und Stampfpressen (Streckendaten)', () => {
  it('in jeder Pressenreihe ist höchstens ein Stempel unten oder kurz davor – zwei Spuren sind immer frei', () => {
    const t = setTrack(0);
    const rows = new Map<number, typeof t.pulses>();
    for (const p of t.pulses) {
      expect(p.kind).toBe(PULSE_PRESS);
      rows.set(p.seg, [...(rows.get(p.seg) ?? []), p]);
    }
    expect(rows.size).toBe(2);
    for (const row of rows.values()) {
      expect(row.length).toBe(3);
      // Zusammen decken die drei Stempel die Bahn fast ganz ab – ausweichen heißt: die richtige Spur wählen.
      const lats = row.map((p) => p.lat).sort((a, b) => a - b);
      expect(lats[0] - row[0].radius).toBeLessThan(-t.rh[row[0].seg] + 0.5);
      expect(lats[2] + row[0].radius).toBeGreaterThan(t.rh[row[0].seg] - 0.5);
      for (let time = 0; time < row[0].period * 3; time++) {
        let down = 0;
        for (const p of row) {
          const c = pulseCycle(p, time);
          // unten, oder schlägt in der nächsten halben Sekunde zu
          if (c < p.on || c >= p.period - 30) down++;
        }
        expect(down).toBeLessThanOrEqual(1);
      }
    }
  });

  it('unter der ganzen quadratischen Platte wird geplättet – auch unter den Ecken, aber nicht daneben', () => {
    const t = setTrack(0);
    const p = t.pulses[0];
    const hit = (alongOff: number, sideOff: number): boolean => {
      const s = gridState(0);
      s.seg = p.seg;
      s.x = p.x + t.tx[p.seg] * alongOff + rightX(t, p.seg) * sideOff;
      s.z = p.z + t.tz[p.seg] * alongOff + rightZ(t, p.seg) * sideOff;
      s.y = p.y;
      s.heading = trackHeading(t, p.seg);
      s.vx = 0;
      s.vz = 0;
      s.flags = 0;
      const time = 10 - p.phase;
      return (stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time }) & EV_FLAT) !== 0;
    };
    const R = p.radius;
    expect(hit(0, 0)).toBe(true);
    // Ecke der Platte: mit einer runden Trefferfläche bliebe man hier verschont.
    expect(hit(R - 0.05, R - 0.05)).toBe(true);
    expect(hit(-(R - 0.05), R - 0.05)).toBe(true);
    // Knapp daneben (Kartmitte mehr als einen halben Kartradius außerhalb der Platte) passiert nichts.
    expect(hit(R + 0.7, 0)).toBe(false);
    expect(hit(0, -(R + 0.7))).toBe(false);
    expect(hit(R + 0.7, R + 0.7)).toBe(false);
  });

  it('der Stempel steht genau so lange unter Karthöhe, wie die Presse gefährlich ist', () => {
    const t = setTrack(0);
    // Hub des Stempels in der Darstellung (machines.ts: REST ≈ 3,8 m) und Höhe eines Karts mit Fahrer
    const LIFT = 3.8;
    const KART = 1.5;
    for (const p of t.pulses) {
      for (let c = 0; c < p.period; c++) {
        const open = pressOpen(p, c - p.phase);
        expect(pulseCycle(p, c - p.phase)).toBe(c);
        if (c < p.on - 4) {
          // gefährlich: der Stempel liegt auf oder hebt sich gerade erst
          expect(open * LIFT).toBeLessThan(KART);
        } else if (c >= p.on && c < p.period - PRESS_STRIKE) {
          // frei: man passt darunter durch
          expect(open * LIFT).toBeGreaterThan(KART);
        }
      }
      // Aufschlag genau zum Beginn der Gefahr; einen Tick davor ist er fast unten, drei davor noch oben.
      expect(pressOpen(p, -p.phase)).toBe(0);
      expect(pressOpen(p, -p.phase - 1)).toBeLessThan(0.6);
      expect(pressOpen(p, -p.phase - PRESS_STRIKE)).toBe(1);
    }
  });

  it('an der Naht zweier Bänder springt das Tempo nicht (winzige Lageunterschiede bleiben winzig)', () => {
    const t = setTrack(0);
    const hall = t.belts.filter((b) => b.along !== 0);
    const mid = hall.find((b) => b.lat0 < 0 && b.lat1 > 0)!;
    const seg = mid.first + 8;
    const step = (lat: number): number => {
      const s = gridState(0);
      s.seg = seg;
      s.x = t.px[seg] + rightX(t, seg) * lat;
      s.z = t.pz[seg] + rightZ(t, seg) * lat;
      s.y = t.py[seg] + lat * t.bank[seg];
      s.heading = trackHeading(t, seg);
      s.vx = 0;
      s.vz = 0;
      s.flags = 0;
      const x = s.x;
      const z = s.z;
      stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: 100 });
      // Weg in Fahrtrichtung in diesem einen Schritt
      return (s.x - x) * t.tx[seg] + (s.z - z) * t.tz[seg];
    };
    // Genau an der Naht (links läuft das Band mit −5 m/s entgegen, rechts trägt es mit +7 m/s):
    const seam = mid.lat0;
    const a = step(seam - 1e-6);
    const b = step(seam + 1e-6);
    expect(Math.abs(a - b)).toBeLessThan(1e-4);
    expect(Math.abs(a)).toBeLessThan(1e-3);
    // Einen halben Meter weiter innen wirken die Bänder voll.
    expect(step(seam + BELT_EDGE + 0.05)).toBeCloseTo(mid.along / 60, 3);
    expect(step(seam - BELT_EDGE - 0.05)).toBeCloseTo(-5 / 60, 3);
    // Auch am Anfang des Bands setzt die Wirkung über BELT_RAMP Meter ein statt mit einem Ruck.
    const at = (k: number): number => {
      const sg = mid.first + k;
      const s = gridState(0);
      s.seg = sg;
      s.x = t.px[sg];
      s.z = t.pz[sg];
      s.y = t.py[sg];
      s.heading = trackHeading(t, sg);
      s.vx = 0;
      s.vz = 0;
      s.flags = 0;
      const x = s.x;
      const z = s.z;
      stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: 100 });
      return (s.x - x) * t.tx[sg] + (s.z - z) * t.tz[sg];
    };
    expect(at(0)).toBeLessThan((mid.along / 60) * 0.5);
    expect(at(0)).toBeGreaterThan(0);
    expect(at(Math.ceil(BELT_RAMP / t.step) + 1)).toBeCloseTo(mid.along / 60, 3);
  });

  it('in der Lagerhalle trägt das mittlere Band, die äußeren laufen entgegen', () => {
    const t = setTrack(0);
    const hall = t.belts.filter((b) => b.along !== 0);
    expect(hall.length).toBe(3);
    const real = t.belts;
    const way = (b: (typeof hall)[number], on: boolean): number => {
      t.belts = on ? real : [];
      try {
        const seg = b.first + 6;
        expect(t.branchOf[seg]).toBe(0);
        const lat = (b.lat0 + b.lat1) / 2;
        const s = gridState(0);
        s.seg = seg;
        s.x = t.px[seg] + rightX(t, seg) * lat;
        s.z = t.pz[seg] + rightZ(t, seg) * lat;
        s.y = t.py[seg] + lat * t.bank[seg];
        s.heading = trackHeading(t, seg);
        s.vx = Math.sin(s.heading) * 20;
        s.vz = Math.cos(s.heading) * 20;
        s.vy = 0;
        s.flags = 0;
        const x = s.x;
        const z = s.z;
        for (let i = 0; i < 30; i++) stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: i });
        return Math.hypot(s.x - x, s.z - z);
      } finally {
        t.belts = real;
      }
    };
    const gain = hall.map((b) => way(b, true) - way(b, false));
    const mid = hall.findIndex((b) => b.lat0 < 0 && b.lat1 > 0);
    expect(mid).toBeGreaterThanOrEqual(0);
    hall.forEach((b, i) => {
      if (i === mid) {
        expect(b.along).toBeGreaterThan(0);
        // eine halbe Sekunde auf dem Band: gut 3 m gewonnen
        expect(gain[i]).toBeGreaterThan(3);
      } else {
        expect(b.along).toBeLessThan(0);
        expect(gain[i]).toBeLessThan(-2);
      }
    });
    // Die Bänder liegen in der Halle (im Tunnel) und reichen über die ganze Breite.
    expect(Math.min(...hall.map((b) => b.lat0))).toBeLessThan(-t.rh[hall[0].first] + 0.3);
    expect(Math.max(...hall.map((b) => b.lat1))).toBeGreaterThan(t.rh[hall[0].first] - 0.3);
  });

  it('auf der Verladebrücke schieben die Querbänder abwechselnd – und keines schiebt bis an die Bande', () => {
    const t = setTrack(0);
    const cross = t.belts.filter((b) => b.across !== 0).sort((a, b) => a.first - b.first);
    expect(cross.length).toBe(3);
    for (let i = 0; i < cross.length; i++) {
      expect(t.branchOf[cross[i].first]).toBe(-1);
      if (i > 0) {
        expect(Math.sign(cross[i].across)).toBe(-Math.sign(cross[i - 1].across));
        // Dazwischen liegt ein Stück ruhige Fahrbahn zum Gegenlenken.
        expect(cross[i].first - (cross[i - 1].first + cross[i - 1].count)).toBeGreaterThan(8);
      }
      // Mit 22 m/s überquert: seitlicher Versatz deutlich spürbar, aber höchstens die halbe Fahrbahnbreite.
      const push = (Math.abs(cross[i].across) * cross[i].count * t.step) / 22;
      expect(push).toBeGreaterThan(1.2);
      expect(push).toBeLessThan(t.rh[cross[i].first] * 0.5);
    }
  });
});

describe('Möwenklippe: Ebbe und Flut (Streckendaten)', () => {
  it('bei Ebbe ist alles trocken; bei Flut stehen zwei Senken der Uferstraße unter Wasser, die Kuppe dazwischen und der Start nicht', () => {
    const t = setTrack(1);
    const tide = t.tide!;
    expect(tide).not.toBeNull();
    // Zeitpunkte ohne Welle rechnen: mitten in Ebbe und mitten in Flut
    const still = { ...tide, wave: 0 };
    const LOW = Math.round(tide.period * 0.1) - tide.phase;
    const HIGH = Math.round(tide.period * 0.65) - tide.phase;
    expect(tidePhase(tide, LOW)).toBe(0);
    expect(tidePhase(tide, HIGH)).toBe(1);
    let first = -1;
    let last = -1;
    let wetRuns = 0;
    let wasWet = false;
    let deepest = 0;
    for (let i = 0; i < t.n; i++) {
      if (!t.tidal[i]) {
        // Außerhalb der Uferstraße wirkt die Flut nicht – auch nicht auf der Startgeraden.
        continue;
      }
      if (first < 0) first = i;
      last = i;
      // Bei Ebbe liegt auch die tiefe (linke) Kante über dem Wasser – selbst mit Welle.
      const lowEdge = t.py[i] - Math.abs(t.bank[i]) * t.rh[i];
      expect(lowEdge - (tide.low + tide.wave)).toBeGreaterThan(0.5);
      const depth = tideLevel(still, HIGH) - t.py[i];
      deepest = Math.max(deepest, depth);
      const wet = depth > 0.06;
      if (wet && !wasWet) wetRuns++;
      wasWet = wet;
    }
    expect(first).toBeGreaterThan(0);
    // zwei Senken, dazwischen eine trockene Kuppe
    expect(wetRuns).toBe(2);
    expect(deepest).toBeGreaterThan(0.4);
    expect(deepest).toBeLessThan(0.7);
    console.log(`Möwenklippe: Uferstraße Abschnitt ${first}–${last}, bei Flut bis ${deepest.toFixed(2)} m tief (Tempo × ${waterFactor(deepest).toFixed(2)})`);
    // Start und Ziel liegen nicht im Gezeitenbereich.
    for (let slot = 0; slot < 4; slot++) expect(t.tidal[gridState(slot).seg]).toBe(0);
    expect(t.tidal[0]).toBe(0);
    // Die Uferstraße ist der Hauptweg hinter der zweiten Gabelung; der Steg (Abzweigung) bleibt trocken.
    expect(segDelta(t, t.branches[1].from, first)).toBeGreaterThan(0);
    expect(segDelta(t, last, t.branches[1].to)).toBeGreaterThan(-40);
    for (let i = t.n; i < t.total; i++) expect(t.tidal[i]).toBe(0);
  });

  /** Ein KI-Fahrer von 110 m vor der Bucht-Gabelung bis hinter die Einmündung; die Gezeit steht still. */
  function bay(slot: number, time: number, route: number): { ticks: number; route: number; splash: boolean } {
    const t = TRACK;
    const b = t.branches[1];
    const s = gridState(slot);
    const seg = wrapSeg(t, b.from - 110);
    s.seg = seg;
    s.x = t.px[seg];
    s.y = t.py[seg];
    s.z = t.pz[seg];
    s.heading = trackHeading(t, seg);
    s.vx = Math.sin(s.heading) * 22;
    s.vz = Math.cos(s.heading) * 22;
    s.flags = 0;
    const brain = newBrain(slot, AI_MEDIUM);
    if (route >= 0) {
      brain.route = route;
      brain.routeLock = true;
    }
    const goal = wrapSeg(t, b.to + 30);
    let ticks = 0;
    let splash = false;
    let took = 0;
    for (; ticks < 3000; ticks++) {
      const cmd = botCmd(s, brain, [], true, { tick: ticks, time, place: 1, smoke: false });
      const ev = stepKart(s, cmd, { canDrive: true, speedFactor: 1, time });
      if (ev & EV_SPLASH) splash = true;
      if (t.branchOf[s.seg] === 1 && t.twin[s.seg] < 0) took = 2;
      if (t.branchOf[s.seg] < 0) {
        const d = segDelta(t, s.seg, goal);
        if (d <= 0 && d > -60) break;
      }
    }
    return { ticks, route: took, splash };
  }

  it('bei Flut kostet die Uferstraße Zeit – der Steg ist dann der schnellere Weg', () => {
    const t = setTrack(1);
    const tide = t.tide!;
    // Die Gezeit steht still; die Zeit ist ein Vielfaches von zehn, weil es nur in jedem zehnten Tick spritzt.
    const LOW = Math.round((tide.period * 0.1 - tide.phase) / 10) * 10;
    const HIGH = Math.round((tide.period * 0.65 - tide.phase) / 10) * 10;
    const mean = (time: number, route: number): { s: number; splash: boolean } => {
      let sum = 0;
      let splash = false;
      for (let slot = 0; slot < 4; slot++) {
        const r = bay(slot, time, route);
        expect(r.ticks).toBeLessThan(3000);
        expect(r.route).toBe(route);
        sum += r.ticks;
        splash = splash || r.splash;
      }
      return { s: sum / 4 / 60, splash };
    };
    const shoreLow = mean(LOW, 0);
    const shoreHigh = mean(HIGH, 0);
    const pierHigh = mean(HIGH, 2);
    console.log(`Bucht: Uferstraße bei Ebbe ${shoreLow.s.toFixed(1)} s, bei Flut ${shoreHigh.s.toFixed(1)} s; Steg ${pierHigh.s.toFixed(1)} s`);
    expect(shoreLow.splash).toBe(false);
    expect(shoreHigh.splash).toBe(true);
    expect(pierHigh.splash).toBe(false);
    // Die Flut kostet auf der Uferstraße mindestens anderthalb Sekunden …
    expect(shoreHigh.s - shoreLow.s).toBeGreaterThan(1.5);
    // … und macht den Steg klar zum schnelleren Weg; bei Ebbe ist die Uferstraße nicht langsamer als er.
    expect(shoreHigh.s - pierHigh.s).toBeGreaterThan(1.2);
    expect(shoreLow.s - pierHigh.s).toBeLessThan(1);
  });

  it('die KI nimmt bei Flut den Steg und bei Ebbe die Uferstraße', () => {
    const t = setTrack(1);
    const tide = t.tide!;
    const LOW = Math.round(tide.period * 0.1) - tide.phase;
    const HIGH = Math.round(tide.period * 0.65) - tide.phase;
    for (let slot = 0; slot < 4; slot++) {
      expect(bay(slot, HIGH, -1).route).toBe(2);
      expect(bay(slot, LOW, -1).route).toBe(0);
    }
  });
});

describe('Fliegen (Wolkenwerft)', () => {
  /** Erste Flugstrecke der Hauptstrecke: erster und letzter Abschnitt. */
  function firstGlide(): { first: number; last: number } {
    const t = TRACK;
    let first = -1;
    let last = -1;
    for (let i = 0; i < t.n; i++) {
      if (t.edge[i] & EDGE_GLIDE) {
        if (first < 0) first = i;
        last = i;
      } else if (first >= 0) break;
    }
    return { first, last };
  }

  /** Kart in der Luft über Abschnitt seg, dy Meter über der Ideallinie, seitlich lat. */
  function airborne(seg: number, dy: number, lat = 0, speed = GLIDE_SPEED): KartState {
    const t = TRACK;
    const s = gridState(0);
    s.seg = seg;
    s.x = t.px[seg] - t.tz[seg] * lat;
    s.z = t.pz[seg] + t.tx[seg] * lat;
    s.y = t.py[seg] + dy;
    s.heading = trackHeading(t, seg);
    s.vx = Math.sin(s.heading) * speed;
    s.vz = Math.cos(s.heading) * speed;
    s.vy = 0;
    s.flags = FLAG_AIR;
    return s;
  }

  it('über einer Flugstrecke sinkt das Kart langsam, statt zu fallen', () => {
    const t = setTrack(4);
    const g = firstGlide();
    expect(g.first).toBeGreaterThan(0);
    expect(t.edge[g.first] & EDGE_GAP).not.toBe(0);
    // Mitten in der Luft, abseits von Aufwinden und Ringen
    const s = airborne(g.first + 20, 4, 11);
    const y0 = s.y;
    run(s, 0, 60);
    expect(s.flags & FLAG_GLIDE).not.toBe(0);
    const sunk = y0 - s.y;
    // Eine Sekunde: knapp die Sinkrate (sie stellt sich erst ein) – im freien Fall wären es 15 m.
    expect(sunk).toBeGreaterThan(GLIDE_SINK * 0.5);
    expect(sunk).toBeLessThan(GLIDE_SINK * 1.1);
    expect(s.vy).toBeCloseTo(-GLIDE_SINK, 0);
    // Das Tempo hält sich beim Reisetempo.
    expect(Math.hypot(s.vx, s.vz)).toBeGreaterThan(GLIDE_SPEED * 0.93);
  });

  it('ein Aufwind hebt, ein Ring gibt Schub', () => {
    const t = setTrack(4);
    const th = t.thermals[0];
    // Kurz vor dem Aufwind, auf seiner Spur
    const before = airborne(th.seg - 12, 2, th.lat);
    // Zum Vergleich: gleiche Höhe, aber neben der Säule (und noch im Korridor)
    const plain = airborne(th.seg - 12, 2, th.lat + th.radius + 6);
    expect(Math.abs(th.lat + th.radius + 6)).toBeLessThan(t.wh[th.seg] - 1);
    run(before, 0, 70);
    run(plain, 0, 70);
    const gain = before.y - t.py[before.seg] - (plain.y - t.py[plain.seg]);
    console.log(`Aufwind: ${gain.toFixed(1)} m höher als ohne`);
    expect(gain).toBeGreaterThan(3);
    const ring = t.rings[0];
    const dy = ring.y - t.py[ring.seg];
    const s = airborne(ring.seg - 6, dy - 0.3, ring.lat);
    const ev = run(s, 0, 30);
    expect(ev & EV_PAD).not.toBe(0);
    expect(s.boost).toBeGreaterThan(0);
    // Wer unter dem Ring durchfliegt, bekommt nichts.
    const low = airborne(ring.seg - 6, dy - 6, ring.lat);
    expect(run(low, 0, 30) & EV_PAD).toBe(0);
  });

  it('Anzeige und Rechnung fragen dasselbe: kein Aufwind über der Flugdecke, kein Ring ohne Ring (Funde aus C-008)', () => {
    const t = setTrack(4);
    const th = t.thermals[0];
    // In der Säule, in üblicher Flughöhe: Aufwind.
    const mid = airborne(th.seg, 2, th.lat);
    projectOnTrack(t, mid.x, mid.z, mid.seg);
    expect(thermalLift(t, proj.seg, proj.lat, mid.x, mid.y, mid.z)).toBe(th.lift);
    // Über der Decke reicht die Säule zwar noch hinauf, trägt aber nicht: das Kart sinkt – und so wird es auch gemeldet.
    const high = airborne(th.seg, GLIDE_CEILING + 1, th.lat);
    expect(thermalLift(t, proj.seg, proj.lat, high.x, high.y, high.z)).toBe(0);
    run(high, 0, 1, { steer: 0, buttons: 0 });
    expect(high.flags & FLAG_GLIDE).not.toBe(0);
    expect(high.vy).toBeLessThan(0);
    // Neben dem Korridor ebenso.
    expect(thermalLift(t, proj.seg, t.wh[proj.seg] + 0.5, mid.x, mid.y, mid.z)).toBe(0);
    // Ein Schub-Item mitten im Flug, weit weg von jedem Ring: Schub ja – aber höher als der eines Rings, und kein Ring in der Nähe.
    const g = firstGlide();
    const s = airborne(g.first + 20, 3);
    s.flags |= FLAG_GLIDE;
    s.item = ITEM_BOOST;
    const ev = stepKart(s, { steer: 0, buttons: BTN_GAS | BTN_ITEM }, { canDrive: true, speedFactor: 1, time: 0 });
    expect(ev & EV_USE_BOOST).not.toBe(0);
    expect(ev & EV_PAD).toBe(0);
    expect(s.boost).toBeGreaterThan(PAD_TICKS);
    expect(ringAt(t, s.x, s.y, s.z, 2.5)).toBe(false);
    // Am Ring selbst: ja, und der Schub ist genau der eines Boost-Felds.
    const ring = t.rings[0];
    expect(ringAt(t, ring.x, ring.y - 0.6, ring.z)).toBe(true);
    const through = airborne(ring.seg - 6, ring.y - t.py[ring.seg] - 0.3, ring.lat);
    let hit = 0;
    for (let i = 0; i < 30 && hit === 0; i++) hit = stepKart(through, GAS, { canDrive: true, speedFactor: 1, time: i }) & EV_PAD;
    expect(hit).not.toBe(0);
    expect(through.boost).toBe(PAD_TICKS);
    expect(ringAt(t, through.x, through.y, through.z, 2.5)).toBe(true);
  });

  it('neben dem Korridor trägt die Luft nicht: wer abdriftet, sackt durch', () => {
    const t = setTrack(4);
    const g = firstGlide();
    const seg = g.first + 30;
    const edge = t.wh[seg];
    const sink = (lat: number): number => {
      const s = airborne(seg, 3, lat);
      const y0 = s.y - t.py[s.seg];
      run(s, 0, 60);
      return y0 - (s.y - t.py[s.seg]);
    };
    const inside = sink(edge - 2);
    const justOut = sink(edge + GLIDE_EDGE / 2);
    const farOut = sink(edge + GLIDE_EDGE + 2);
    console.log(`Korridor ±${edge.toFixed(1)} m: in einer Sekunde ${inside.toFixed(1)} m gesunken, knapp draußen ${justOut.toFixed(1)} m, weit draußen ${farOut.toFixed(1)} m (jeweils gegenüber der Ideallinie)`);
    // Drinnen hält das Kart etwa die Ideallinie, draußen geht es mit jedem Meter schneller abwärts.
    expect(Math.abs(inside)).toBeLessThan(1.5);
    expect(justOut).toBeGreaterThan(inside + 2);
    expect(farOut).toBeGreaterThan(justOut + 1.5);
    // Weit draußen ist nach gut zwei Sekunden Schluss: abgestürzt.
    const lost = airborne(seg, 3, edge + GLIDE_EDGE + 2);
    let ev = 0;
    for (let i = 0; i < 170 && (ev & EV_FALL) === 0; i++) ev |= stepKart(lost, { steer: 0, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: i });
    expect(ev & EV_FALL).not.toBe(0);
    // Ein Aufwind außerhalb des Korridors hilft nicht (es gibt dort keinen – die Säulen stehen alle drinnen).
    for (const th of t.thermals) expect(Math.abs(th.lat) + th.radius * 0.5).toBeLessThan(t.wh[th.seg]);
  });

  it('wer zu tief sinkt, stürzt ab und startet wieder vor der Kante', () => {
    const t = setTrack(4);
    const g = firstGlide();
    // Knapp über der Grenze und im Sturzflug (die Ideallinie fällt selbst etwa so schnell, wie ein Kart sinkt).
    const s = airborne(g.first + 30, -GLIDE_FALL + 1.5, 12);
    s.vy = -9;
    let ev = 0;
    for (let i = 0; i < 90 && !(ev & EV_FALL); i++) ev |= stepKart(s, GAS, { canDrive: true, speedFactor: 1, time: i });
    expect(ev & EV_FALL).not.toBe(0);
    // Aufgesetzt wird vor dem Absprung, auf festem Boden.
    expect(segDelta(t, s.seg, g.first)).toBeGreaterThan(10);
    expect(t.edge[s.seg] & EDGE_GAP).toBe(0);
  });

  it('im Gleitflug lenkt das Kart weich: Vollausschlag dreht in einer Sekunde um gut 60 Grad', () => {
    const t = setTrack(4);
    const g = firstGlide();
    const s = airborne(g.first + 15, 6, 0);
    const h0 = s.heading;
    for (let i = 0; i < 60; i++) stepKart(s, { steer: 127, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: i });
    const turned = Math.abs(s.heading - h0);
    expect(turned).toBeGreaterThan(1.0);
    expect(turned).toBeLessThan(1.3);
    // Die Flugrichtung folgt der Nase mit Verzögerung: nach einer Sekunde noch nicht ganz.
    const course = Math.atan2(s.vx, s.vz);
    expect(Math.abs(course - h0)).toBeLessThan(turned);
    expect(Math.abs(course - h0)).toBeGreaterThan(turned * 0.4);
    void t;
  });
});

import { afterAll, describe, expect, it } from 'vitest';
import { AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import {
  DRAFT_FULL,
  DRAFT_PULL_FROM,
  FLOOD_FROM,
  PULSE_BOMB,
  PULSE_VENT,
  VEH_BUS,
  VEH_TAXI,
  VEH_TRAM,
  floodLevel,
  floodPeak,
  pulseCycle,
  pulseWarning,
  type Vehicle,
} from '../../src/game/mechanics';
import {
  BTN_BRAKE,
  BTN_GAS,
  EV_BLOCK,
  EV_BURN,
  EV_DRAFT,
  EV_HIT,
  FLAG_AIR,
  GUARD_TICKS,
  V_MAX,
  forwardSpeed,
  gridState,
  lavaAt,
  stepKart,
  type KartState,
} from '../../src/game/sim';
import { TRACK, newVehiclePose, segDelta, setTrack, trackHeading, vehiclePose, wrapSeg } from '../../src/game/track';

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

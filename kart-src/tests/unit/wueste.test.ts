// Wüstenexpress: Züge mit befahrbaren Dächern (mechanics.ts: VEH_TRAIN, roofTop; sim.ts: roofUnder; ai.ts).

import { afterAll, describe, expect, it } from 'vitest';
import { AI_EASY, AI_HARD, AI_MEDIUM, botCmd, newBrain } from '../../src/game/ai';
import { ROOF_STEP, VEH_TRAIN, VEHICLE_SPECS, roofTop, vehicleAt, type Vehicle } from '../../src/game/mechanics';
import { COUNTDOWN_TICKS } from '../../src/game/hostGame';
import { BTN_GAS, EV_FALL, EV_HIT, EV_WALL, FLAG_AIR, gridState, stepKart, type KartState } from '../../src/game/sim';
import { TRACK, TRACK_COUNT, addProgress, getTrack, newVehiclePose, proj, progDelta, projectOnTrack, rightX, rightZ, setTrack, trackHeading, vehiclePose } from '../../src/game/track';

const WUESTE = 14;
const P = newVehiclePose();

afterAll(() => {
  setTrack(0);
});

function at(seg: number, lat = 0, speed = 0, up = 0): KartState {
  const t = TRACK;
  const s = gridState(0);
  s.seg = seg;
  s.x = t.px[seg] + rightX(t, seg) * lat;
  s.z = t.pz[seg] + rightZ(t, seg) * lat;
  s.y = t.py[seg] + lat * t.bank[seg] + up;
  s.heading = trackHeading(t, seg);
  s.vx = Math.sin(s.heading) * speed;
  s.vz = Math.cos(s.heading) * speed;
  s.vy = 0;
  s.flags = 0;
  return s;
}

/** Wo steht das Kart relativ zum Zug? Wagen (−1 = neben/außerhalb), Lage längs und quer im Wagen. */
function onTrain(v: Vehicle, s: KartState, time: number): { car: number; du: number; dw: number } {
  for (let car = 0; car < v.cars; car++) {
    const p = vehiclePose(TRACK, v, car, time, P);
    const hx = Math.sin(p.heading);
    const hz = Math.cos(p.heading);
    const du = (s.x - p.x) * hx + (s.z - p.z) * hz;
    const dw = -(s.x - p.x) * hz + (s.z - p.z) * hx;
    if (Math.abs(du) <= v.half + 0.4 && Math.abs(dw) <= v.halfWidth + 0.2) return { car, du, dw };
  }
  return { car: -1, du: 0, dw: 0 };
}

/** Hält mit Gas die seitliche Lage want (einfacher Regler auf die Lage quer zur Strecke). */
function drive(s: KartState, want: number, time: number, last: { lat: number }): number {
  projectOnTrack(TRACK, s.x, s.z, s.seg);
  const rate = (proj.lat - last.lat) * 60;
  last.lat = proj.lat;
  const steer = Math.round(Math.max(-1, Math.min(1, (want - proj.lat) * 0.3 - rate * 0.12)) * 127);
  return stepKart(s, { steer, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time });
}

describe('Zug mit befahrbarem Dach', () => {
  it('das Dachprofil läuft von der Rampe am Zugende lückenlos bis auf die Lok', () => {
    const spec = VEHICLE_SPECS[VEH_TRAIN];
    expect(spec.roofs).toBeDefined();
    expect(spec.roofs!.length).toBe(spec.cars);
    // Rampenwagen: beginnt fast am Boden – niedriger als die Stufe, die ein Kart nimmt
    expect(roofTop(spec, spec.cars - 1, -spec.half)).toBeLessThan(ROOF_STEP);
    // von Wagen zu Wagen kein Absatz
    for (let car = 0; car + 1 < spec.cars; car++) expect(roofTop(spec, car, -spec.half)).toBeCloseTo(roofTop(spec, car + 1, spec.half), 6);
    // die Lok ist das höchste und so hoch wie die Angabe des Fahrzeugs
    expect(roofTop(spec, 0, 0)).toBeCloseTo(spec.height, 6);
    // nirgends steiler als 16 %
    for (let car = 0; car < spec.cars; car++) expect(Math.abs(roofTop(spec, car, spec.half) - roofTop(spec, car, -spec.half)) / (2 * spec.half)).toBeLessThan(0.16);
    // zwischen den Wagen bleibt nur eine schmale Kupplung
    expect(spec.pitch - 2 * spec.half).toBeLessThan(0.8);
  });
});

describe('Wüstenexpress', () => {
  it('nur hier fahren Züge: vier, gleichmäßig verteilt, auf dem Gleis links – und beim Start steht keiner in der Aufstellung', () => {
    for (let i = 0; i < TRACK_COUNT; i++) {
      const t = getTrack(i);
      if (i !== WUESTE) {
        expect(t.roofed).toBe(false);
        expect(t.vehicles.some((v) => v.roofs)).toBe(false);
        continue;
      }
      expect(t.def.name).toBe('Wüstenexpress');
      expect(t.roofed).toBe(true);
      const lap = t.n * t.step;
      const trains = t.vehicles.filter((v) => v.kind === VEH_TRAIN);
      expect(trains.length).toBe(4);
      expect(t.vehicles.length).toBe(4);
      const heads = trains.map((v) => vehicleAt(v, 0, lap)).sort((a, b) => a - b);
      for (let k = 0; k < 4; k++) {
        const gap = (heads[(k + 1) % 4] - heads[k] + lap) % lap;
        expect(gap).toBeGreaterThan(lap / 4 - 40);
        expect(gap).toBeLessThan(lap / 4 + 40);
      }
      for (const v of trains) {
        // langsamer als ein Kart, aber nicht im Schritt
        expect(v.speed).toBeGreaterThan(11);
        expect(v.speed).toBeLessThan(18);
        // links, unmittelbar an der Bande: zwischen Zug und Bande passt kein Kart
        expect(v.lat + v.halfWidth).toBeLessThan(-2);
        expect(v.lat - v.halfWidth - -t.wh[0]).toBeLessThan(0.3);
        expect(v.lat - v.halfWidth).toBeGreaterThanOrEqual(-t.wh[0] - 0.01);
        // Countdown bis kurz nach „Los“: kein Wagen näher als 25 m an der Startlinie
        for (let time = -COUNTDOWN_TICKS; time <= 60; time += 15) {
          for (let car = 0; car < v.cars; car++) {
            const p = vehiclePose(t, v, car, time, P);
            const d = progDelta(t, 0, p.seg) * t.step;
            expect(d > 25 || d < -40).toBe(true);
          }
        }
      }
      // Der Zug kommt überall durch: keine Kurve enger als 30 m, keine Schanze, keine Lücke, keine Abzweigung
      let maxC = 0;
      for (let k = 0; k < t.n; k++) maxC = Math.max(maxC, Math.abs(t.curv[k]));
      expect(1 / maxC).toBeGreaterThan(30);
      expect(t.branches.length).toBe(0);
      expect(t.total).toBe(t.n);
    }
  });

  it('von hinten auffahren: die Rampe hinauf, über die Dächer, über die Lok – und vorn hinunter', () => {
    const t = setTrack(WUESTE);
    for (const v of t.vehicles) {
      for (const time0 of [600, 2400]) {
        const rear = vehiclePose(t, v, v.cars - 1, time0, P);
        const lane = rear.lat;
        const s = at((rear.seg - 35 + t.n) % t.n, lane, 25);
        const last = { lat: lane };
        let top = 0;
        let roofTicks = 0;
        let roofWay = 0;
        let cars = 0;
        let landed = -1;
        let bad = 0;
        for (let i = 0; i < 60 * 10 && landed < 0; i++) {
          const x0 = s.x;
          const z0 = s.z;
          const ev = drive(s, lane, time0 + i, last);
          // (Wer in der Rechtskurve von der Lok springt, kann im Flug die Bande streifen – das zählt nicht.)
          if (ev & (EV_HIT | EV_FALL) || (ev & EV_WALL && !(s.flags & FLAG_AIR))) {
            bad++;
            console.log(`Auffahren: Zug ${v.id} Zeit ${time0} Tick ${i}: ${ev & EV_HIT ? 'Treffer ' : ''}${ev & EV_FALL ? 'Sturz ' : ''}${ev & EV_WALL ? 'Bande ' : ''}hoch ${(s.y - t.py[s.seg]).toFixed(2)} ${JSON.stringify(onTrain(v, s, time0 + i + 1))} lat ${last.lat.toFixed(2)}`);
          }
          const up = s.y - t.py[s.seg];
          const where = onTrain(v, s, time0 + i + 1);
          // (Höhe nur auf dem Zug messen: Nach dem Absprung fällt die Strecke unter dem Kart stellenweise ab.)
          if (where.car >= 0 && !(s.flags & FLAG_AIR)) top = Math.max(top, up);
          if (where.car >= 0 && up > 0.3 && !(s.flags & FLAG_AIR)) {
            roofTicks++;
            roofWay += Math.hypot(s.x - x0, s.z - z0);
            cars |= 1 << where.car;
          }
          if (roofTicks > 60 && where.car < 0 && up < 0.2 && !(s.flags & FLAG_AIR)) landed = i;
        }
        expect(bad).toBe(0);
        // über alle sieben Wagen, bis auf die Lok hinauf
        expect(cars).toBe((1 << v.cars) - 1);
        expect(top).toBeGreaterThan(2.9);
        expect(top).toBeLessThan(3.6);
        // auf dem Dach kommt zum eigenen Tempo das des Zugs
        const speed = (roofWay / roofTicks) * 60;
        // (innen in der Kurve fährt der Zug etwas langsamer als sein Nenntempo, und bergauf über Rampe und Keil kostet es Tempo)
        expect(speed).toBeGreaterThan(21 + v.speed * 0.85);
        // gelandet: vor der Lok, auf der Fahrbahn
        expect(landed).toBeGreaterThan(0);
        const head = vehiclePose(t, v, 0, time0 + landed + 1, P);
        expect(progDelta(t, head.seg, s.seg) * t.step).toBeGreaterThan(v.half);
      }
    }
  });

  it('von der Seite ist der Zug eine Wand – nur das flache Ende der Rampe lässt sich auch seitlich nehmen', () => {
    const t = setTrack(WUESTE);
    const v = t.vehicles[0];
    const time0 = 900;
    for (const car of [0, 2, 4]) {
      const p = vehiclePose(t, v, car, time0, P);
      // neben den Wagen, Kurs schräg auf ihn zu
      const s = at(p.seg, p.lat + v.halfWidth + 2.2, v.speed);
      const turn = 0.35;
      s.heading -= turn;
      s.vx = Math.sin(s.heading) * (v.speed + 3);
      s.vz = Math.cos(s.heading) * (v.speed + 3);
      let top = 0;
      let inside = 0;
      for (let i = 0; i < 90; i++) {
        stepKart(s, { steer: 0, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time: time0 + i });
        top = Math.max(top, s.y - t.py[s.seg]);
        const w = onTrain(v, s, time0 + i + 1);
        if (w.car >= 0 && Math.abs(w.dw) < v.halfWidth - 0.3) inside++;
      }
      // nie im Wagen, nie auf dem Dach
      expect(inside).toBe(0);
      expect(top).toBeLessThan(0.3);
    }
  });

  it('der Zug nimmt mit, was auf ihm steht – auch durch die Kurve', () => {
    const t = setTrack(WUESTE);
    const lap = t.n * t.step;
    for (const v of t.vehicles) {
      const time0 = 300;
      const car = 3;
      const p = vehiclePose(t, v, car, time0, P);
      const s = at(p.seg, p.lat, 0, roofTop(v, car, 0));
      // genau auf die Wagenmitte
      s.x = p.x;
      s.z = p.z;
      s.y = p.y + roofTop(v, car, 0);
      s.heading = p.heading;
      const ticks = 60 * 8;
      let air = 0;
      for (let i = 0; i < ticks; i++) {
        const ev = stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time: time0 + i });
        expect(ev & (EV_HIT | EV_FALL | EV_WALL)).toBe(0);
        if (s.flags & FLAG_AIR) air++;
      }
      // acht Sekunden später: noch auf demselben Wagen, nahe der Mitte, auf Dachhöhe
      const w = onTrain(v, s, time0 + ticks);
      expect(w.car).toBe(car);
      expect(Math.abs(w.dw)).toBeLessThan(1.0);
      expect(Math.abs(w.du)).toBeLessThan(3.0);
      const now = vehiclePose(t, v, car, time0 + ticks, P);
      expect(s.y - now.y).toBeGreaterThan(roofTop(v, car, 0) - 0.15);
      expect(air).toBeLessThan(12);
      // und der Zug ist in der Zeit 8 × Tempo weit gefahren
      const moved = (vehicleAt(v, time0 + ticks, lap) - vehicleAt(v, time0, lap) + lap) % lap;
      expect(moved).toBeCloseTo(v.speed * 8, 3);
    }
  });

  it('die KI kommt mit den Zügen zurecht: die gute fährt über die Dächer, niemand wird überrollt', () => {
    const t = setTrack(WUESTE);
    const roof = [0, 0, 0];
    const hits = [0, 0, 0];
    const walls = [0, 0, 0];
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
          if (ev & EV_HIT) hits[level]++;
          if (ev & EV_WALL) walls[level]++;
          if (!(s.flags & FLAG_AIR) && s.y - t.py[s.seg] > 1) roof[level]++;
          progress = addProgress(t, progress, before, s.seg);
        }
        expect(progress).toBeGreaterThanOrEqual(3 * t.n);
        time[level] += tick / 60 / 3;
      }
    }
    console.log(
      `Wüstenexpress, KI in je 12 Runden: Sekunden auf dem Dach leicht/mittel/schwer ${roof.map((x) => (x / 60).toFixed(0)).join('/')}, Treffer ${hits.join('/')}, Bandenstöße ${walls.join('/')}, Stürze ${falls}; Rundenzeit ${time.map((x) => (x / 4).toFixed(1)).join(' / ')} s`,
    );
    expect(falls).toBe(0);
    for (const n of hits) expect(n).toBeLessThanOrEqual(2);
    // schwer: in zwölf Runden zusammen mindestens 30 s auf den Dächern; leicht: kaum
    expect(roof[AI_HARD] / 60).toBeGreaterThan(30);
    expect(roof[AI_EASY]).toBeLessThan(roof[AI_HARD] / 3);
  });
});

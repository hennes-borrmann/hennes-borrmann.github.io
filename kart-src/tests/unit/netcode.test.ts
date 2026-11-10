import { describe, expect, it } from 'vitest';
import { botCmd, newBrain } from '../../src/game/ai';
import { ControllerInput } from '../../src/game/input';
import { EntityInterp } from '../../src/game/interp';
import { BTN_GAS, BTN_ITEM, DT, ITEM_OIL, gridState, newState, stepKart, type Cmd, type StepEnv } from '../../src/game/sim';
import {
  CTRL_INPUT_SIZE,
  RACE_RUNNING,
  decodeCmds,
  decodeSnapshot,
  encodeCmds,
  encodeSnapshot,
  seq16Newer,
  writeCtrlInput,
} from '../../src/net/protocol';
import { CODE_ALPHABET, isValidCode, normalizeCode, randomCode } from '../../src/net/codes';

const ENV: StepEnv = { canDrive: true, speedFactor: 1 };

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Lenkt in leichten Schlangenlinien mit Vollgas – deterministisch aus der Schrittnummer. */
function drive(i: number): Cmd {
  return { steer: Math.round(Math.sin(i / 37) * 40), buttons: BTN_GAS };
}

const CTX = { tick: 0, place: 1, smoke: false };

describe('Protokoll', () => {
  it('Eingabepakete überstehen Kodieren/Dekodieren', () => {
    const cmds: Cmd[] = [
      { steer: -127, buttons: 3 },
      { steer: 0, buttons: 0 },
      { steer: 127, buttons: 15 },
    ];
    const d = decodeCmds(new DataView(encodeCmds(4711, cmds)))!;
    expect(d.newestSeq).toBe(4711);
    expect(d.cmds).toEqual(cmds);
  });

  it('Snapshots überstehen Kodieren/Dekodieren (float32-genau)', () => {
    const s = gridState(2);
    s.vx = 3.25;
    s.vz = -17.5;
    s.boost = 42;
    s.driftDir = -1;
    s.driftCharge = 130;
    s.item = ITEM_OIL;
    s.nextItem = 2;
    s.roulette = 9;
    s.vy = 4.5;
    s.guard = 700;
    s.stall = 99;
    s.respawn = 12;
    s.char = 3;
    s.tow = 201;
    const snap = decodeSnapshot(
      new DataView(
        encodeSnapshot({
          tick: 99,
          raceId: 3,
          phase: RACE_RUNNING,
          goTick: 1234,
          laps: 3,
          boxes: 0b101101,
          track: 2,
          karts: [{ slot: 2, bot: true, ptick: 5, ack: 7, state: s, lap: 2, place: 3, finished: true, finishTicks: 4321 }],
          things: [
            { id: 9, kind: 1, ttl: 2.5, x: 1.5, y: 3.25, z: -2.5, vx: 40, vz: 0, target: -1 },
            { id: 4, kind: 2, ttl: 40, x: 7, y: 0, z: 8, vx: 0, vz: 0, target: 3 },
          ],
        }),
      ),
    )!;
    expect(snap.tick).toBe(99);
    expect(snap.raceId).toBe(3);
    expect(snap.phase).toBe(RACE_RUNNING);
    expect(snap.goTick).toBe(1234);
    expect(snap.boxes).toBe(0b101101);
    const k = snap.karts[0];
    expect([k.slot, k.bot, k.ack, k.lap, k.place, k.finished, k.finishTicks]).toEqual([2, true, 7, 2, 3, true, 4321]);
    expect(k.state.x).toBeCloseTo(s.x, 4);
    expect(k.state.vz).toBeCloseTo(-17.5, 5);
    expect([k.state.seg, k.state.boost, k.state.driftDir, k.state.driftCharge]).toEqual([s.seg, 42, -1, 130]);
    expect([k.state.item, k.state.nextItem, k.state.roulette]).toEqual([ITEM_OIL, 2, 9]);
    expect(snap.track).toBe(2);
    expect(k.state.char).toBe(3);
    expect(k.state.tow).toBe(201);
    expect([k.state.y, k.state.vy, k.state.guard, k.state.stall, k.state.respawn]).toEqual([Math.fround(s.y), 4.5, 700, 99, 12]);
    expect(snap.things[0]).toEqual({ id: 9, kind: 1, ttl: 2.5, x: 1.5, y: 3.25, z: -2.5, vx: 40, vz: 0, target: -1 });
    expect(snap.things[1]).toEqual({ id: 4, kind: 2, ttl: 40, x: 7, y: 0, z: 8, vx: 0, vz: 0, target: 3 });
  });

  it('16-Bit-Zähler erkennt "neuer" auch über den Überlauf', () => {
    expect(seq16Newer(5, 4)).toBe(true);
    expect(seq16Newer(4, 5)).toBe(false);
    expect(seq16Newer(2, 65534)).toBe(true);
    expect(seq16Newer(7, 7)).toBe(false);
  });
});

describe('Raumcodes', () => {
  it('enthalten keine verwechselbaren Zeichen und keine Vokale', () => {
    for (const ch of '0O1IL2Z5S8BAEU') expect(CODE_ALPHABET.includes(ch)).toBe(false);
    for (let i = 0; i < 200; i++) expect(isValidCode(randomCode(5), 5)).toBe(true);
  });
  it('Eingaben werden normalisiert', () => {
    expect(normalizeCode(' k7m-3q ')).toBe('K7M3Q');
    expect(isValidCode('K7M3Q', 5)).toBe(true);
    expect(isValidCode('K0M3Q', 5)).toBe(false);
  });
});

describe('Item-Taste am Bildschirm', () => {
  const packet = (seq: number, buttons: number, count: number): DataView => {
    const v = new DataView(new ArrayBuffer(CTRL_INPUT_SIZE));
    writeCtrlInput(v, seq, 0, buttons, count);
    return v;
  };

  it('ein kurzer Tipper zählt genau einmal – auch wenn Paket und Ereignis beide ankommen', () => {
    const c = new ControllerInput();
    c.onPacket(packet(1, 0, 0));
    c.onPacket(packet(2, BTN_ITEM, 1));
    c.onItemPress(1); // dieselbe Betätigung über den zuverlässigen Kanal
    c.onPacket(packet(3, 0, 1));
    const bits = [c.sample(), c.sample(), c.sample()].map((s) => (s.buttons & BTN_ITEM) !== 0);
    expect(bits).toEqual([true, false, false]);
  });

  it('ein Tipper kommt an, obwohl alle schnellen Pakete mit gedrückter Taste verloren gingen', () => {
    const c = new ControllerInput();
    c.onPacket(packet(1, 0, 0));
    c.onItemPress(1);
    c.onPacket(packet(5, 0, 1));
    expect((c.sample().buttons & BTN_ITEM) !== 0).toBe(true);
    expect((c.sample().buttons & BTN_ITEM) !== 0).toBe(false);
  });

  it('zwei schnelle Tipper ergeben zwei getrennte Flanken', () => {
    const c = new ControllerInput();
    c.onPacket(packet(1, 0, 0));
    c.onPacket(packet(2, 0, 2));
    const bits = [c.sample(), c.sample(), c.sample(), c.sample()].map((s) => (s.buttons & BTN_ITEM) !== 0);
    expect(bits).toEqual([true, false, true, false]);
  });

  it('Halten bleibt gehalten', () => {
    const c = new ControllerInput();
    c.onPacket(packet(1, 0, 0));
    c.onPacket(packet(2, BTN_ITEM, 1));
    const bits = [c.sample(), c.sample(), c.sample()].map((s) => (s.buttons & BTN_ITEM) !== 0);
    expect(bits).toEqual([true, true, true]);
  });
});

describe('Interpolation fremder Fahrzeuge', () => {
  it('bleibt gleichmäßig, obwohl der Host Eingaben stoßweise verarbeitet', () => {
    const interp = new EntityInterp(0.085);
    const s = gridState(1);
    // Ein KI-Fahrer lenkt, damit das Kart auf der Fahrbahn bleibt.
    const brain = newBrain(1);
    const rand = rng(7);
    const out = newState();
    let ptick = 0;
    let carry = 0;
    let hostTick = 0;
    let prevX = Number.NaN;
    let prevZ = Number.NaN;
    const speeds: number[] = [];
    const arrivals: { at: number; ptick: number; state: typeof s }[] = [];
    const stepMs = 1000 / 60;
    let acc = 0;
    for (let ms = 0; ms < 9000; ms++) {
      acc += 1;
      while (acc >= stepMs) {
        acc -= stepMs;
        hostTick++;
        // In einem Viertel der Ticks kommt keine Eingabe an, dafür im nächsten zwei.
        let n = 1;
        if (carry > 0) {
          n = 2;
          carry = 0;
        } else if (rand() < 0.25) {
          n = 0;
          carry = 1;
        }
        for (let i = 0; i < n; i++) {
          stepKart(s, botCmd(s, brain, [], true, CTX), ENV);
          ptick++;
        }
        // Jeder zweite Tick geht als Snapshot raus und ist 30–60 ms unterwegs.
        if (hostTick % 2 === 0) arrivals.push({ at: ms + 30 + rand() * 30, ptick, state: { ...s } });
      }
      arrivals.sort((a, b) => a.at - b.at);
      while (arrivals.length && arrivals[0].at <= ms) {
        const a = arrivals.shift()!;
        interp.push(a.ptick, a.state, ms / 1000);
      }
      if (ms % 16 === 0 && interp.sample(ms / 1000, 0.016, out)) {
        // Erst messen, wenn das Kart gleichmäßig schnell fährt.
        if (ms > 2400 && !Number.isNaN(prevX)) speeds.push(Math.hypot(out.x - prevX, out.z - prevZ) / 0.016);
        prevX = out.x;
        prevZ = out.z;
      }
    }
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const dev = Math.sqrt(speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length);
    console.log(
      `dargestelltes Tempo ${mean.toFixed(1)} m/s ± ${dev.toFixed(2)} m/s (${((dev / mean) * 100).toFixed(1)} %), Bilder über den letzten Stand hinaus: ${interp.underruns}`,
    );
    expect(mean).toBeGreaterThan(20);
    // Das Tempo ändert sich beim Fahren wirklich (Schub, Kurven); geprüft wird
    // deshalb der Sprung von Bild zu Bild, nicht die Streuung insgesamt.
    let jerk = 0;
    for (let i = 1; i < speeds.length; i++) jerk = Math.max(jerk, Math.abs(speeds[i] - speeds[i - 1]));
    console.log(`größter Tempo-Sprung zwischen zwei Bildern: ${jerk.toFixed(2)} m/s`);
    expect(jerk).toBeLessThan(2.5);
  });
});

describe('Simulation', () => {
  it('ist deterministisch: gleiche Eingaben, gleicher Verlauf', () => {
    const a = gridState(0);
    const b = gridState(0);
    const brainA = newBrain(0);
    const brainB = newBrain(0);
    for (let i = 0; i < 2000; i++) {
      stepKart(a, botCmd(a, brainA, [], true, CTX), ENV);
      stepKart(b, botCmd(b, brainB, [], true, CTX), ENV);
    }
    expect(a).toEqual(b);
    expect(Math.hypot(a.vx, a.vz)).toBeGreaterThan(15);
    expect(DT).toBeCloseTo(1 / 60);
    expect(drive(10).buttons).toBe(BTN_GAS);
  });
});

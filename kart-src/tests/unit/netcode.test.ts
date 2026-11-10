import { describe, expect, it } from 'vitest';
import { ClientGame } from '../../src/game/clientGame';
import { HostGame } from '../../src/game/hostGame';
import { ControllerInput } from '../../src/game/input';
import { EntityInterp } from '../../src/game/interp';
import { BTN_GAS, BTN_ITEM, DT, newState, spawnState, stepKart, type Cmd } from '../../src/game/sim';
import {
  CTRL_INPUT_SIZE,
  decodeCmds,
  decodeSnapshot,
  encodeCmds,
  encodeSnapshot,
  seq16Newer,
  writeCtrlInput,
} from '../../src/net/protocol';
import { CODE_ALPHABET, isValidCode, normalizeCode, randomCode } from '../../src/net/codes';

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Lenkt in Schlangenlinien mit Vollgas – deterministisch aus der Schrittnummer. */
function drive(i: number): Cmd {
  return { steer: Math.round(Math.sin(i / 37) * 110), buttons: BTN_GAS | (i % 240 === 100 ? BTN_ITEM : 0) };
}

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
    const s = spawnState(2);
    s.heading = 1.25;
    s.speed = 17.5;
    const d = decodeSnapshot(new DataView(encodeSnapshot({ tick: 99, players: [{ slot: 2, ptick: 5, ack: 7, state: s }] })))!;
    expect(d.tick).toBe(99);
    expect(d.players[0].slot).toBe(2);
    expect(d.players[0].ack).toBe(7);
    expect(d.players[0].state.x).toBeCloseTo(s.x, 5);
    expect(d.players[0].state.heading).toBeCloseTo(1.25, 5);
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

/** Größere Abweichungen würde der Client nicht mehr ausblenden, sondern hart übernehmen. */
const SNAP_LIMIT = 5;

interface Packet {
  at: number;
  data: ArrayBuffer;
}

/**
 * Spielt Host und einen Client gegeneinander, verbunden über eine simulierte
 * Leitung. Zeit läuft in Millisekunden-Schritten, beide ticken mit 60 Hz.
 */
function simulate(opts: { lag: number; jitter: number; loss: number; seconds: number; clientOffsetMs?: number }) {
  const rand = rng(42);
  const host = new HostGame(0);
  host.syncPlayers([0, 1]);
  const client = new ClientGame(1);
  const up: Packet[] = [];
  const down: Packet[] = [];
  const send = (queue: Packet[], now: number, data: ArrayBuffer): void => {
    if (rand() * 100 < opts.loss) return;
    queue.push({ at: now + opts.lag + rand() * opts.jitter, data });
  };
  const deliver = (queue: Packet[], now: number, fn: (d: ArrayBuffer) => void): void => {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].at <= now) {
        fn(queue[i].data);
        queue.splice(i, 1);
      }
    }
  };

  let hostAcc = 0;
  let clientAcc = opts.clientOffsetMs ?? 7;
  let clientStep = 0;
  let maxCorrection = 0;
  let sumCorrection = 0;
  let corrections = 0;
  const stepMs = 1000 / 60;

  for (let now = 0; now < opts.seconds * 1000; now++) {
    deliver(up, now, (d) => {
      const c = decodeCmds(new DataView(d))!;
      host.receiveCmds(1, c.newestSeq, c.cmds);
    });
    deliver(down, now, (d) => {
      client.onSnapshot(decodeSnapshot(new DataView(d))!, now / 1000);
      // Die ersten zwei Sekunden einschwingen lassen.
      if (now > 2000) {
        const c = client.stats.lastCorrection;
        maxCorrection = Math.max(maxCorrection, c);
        sumCorrection += c;
        corrections++;
      }
    });
    hostAcc += 1;
    while (hostAcc >= stepMs) {
      hostAcc -= stepMs;
      host.step({ steer: 0, buttons: 0 });
      if (host.tick % 2 === 0) send(down, now, host.snapshot());
    }
    clientAcc += 1;
    while (clientAcc >= stepMs) {
      clientAcc -= stepMs;
      const pkt = client.tick(drive(clientStep));
      if (pkt) {
        clientStep++;
        send(up, now, pkt);
      }
    }
  }
  return { host, client, maxCorrection, meanCorrection: sumCorrection / Math.max(1, corrections) };
}

describe('Vorhersage und Abgleich', () => {
  it('ohne Verlust stimmt die Vorhersage praktisch exakt (nur float32-Rundung)', () => {
    const r = simulate({ lag: 40, jitter: 0, loss: 0, seconds: 20 });
    console.log(`40 ms, kein Verlust: max. Korrektur ${(r.maxCorrection * 1000).toFixed(2)} mm`);
    expect(r.maxCorrection).toBeLessThan(0.002);
  });

  it('mit 80 ms Verzögerung, 30 ms Jitter und 5 % Verlust bleiben Korrekturen klein', () => {
    const r = simulate({ lag: 80, jitter: 30, loss: 5, seconds: 30 });
    console.log(
      `80 ms/30 ms/5 %: max. Korrektur ${(r.maxCorrection * 100).toFixed(1)} cm, im Mittel ${(r.meanCorrection * 100).toFixed(2)} cm`,
    );
    // Vier Eingaben pro Paket: erst vier verlorene Pakete in Folge reißen eine Lücke.
    expect(r.meanCorrection).toBeLessThan(0.02);
    expect(r.maxCorrection).toBeLessThan(1.5);
  });

  it('bei 40 % Verlust entstehen Lücken – der Abgleich fängt sie ab, ohne wegzulaufen', () => {
    const r = simulate({ lag: 60, jitter: 20, loss: 40, seconds: 30 });
    console.log(
      `60 ms/20 ms/40 %: max. Korrektur ${(r.maxCorrection * 100).toFixed(1)} cm, im Mittel ${(r.meanCorrection * 100).toFixed(2)} cm`,
    );
    expect(r.maxCorrection).toBeGreaterThan(0);
    expect(r.maxCorrection).toBeLessThan(SNAP_LIMIT);
  });

  it('Host und Client landen am selben Ort, sobald alles bestätigt ist', () => {
    const r = simulate({ lag: 60, jitter: 20, loss: 10, seconds: 12 });
    // Der Client ist dem Host um die noch unbestätigten Eingaben voraus;
    // bei höchstens ~22 m/s und <0,3 s Vorsprung sind das wenige Meter.
    const a = r.host.authoritative(1)!;
    const p = r.client.predictedState();
    const start = spawnState(1);
    // Es wurde wirklich gefahren ...
    expect(Math.hypot(a.x - start.x, a.z - start.z)).toBeGreaterThan(3);
    expect(r.client.ready).toBe(true);
    // ... und der Abstand entspricht nur dem Vorsprung der unbestätigten Eingaben.
    expect(Math.hypot(a.x - p.x, a.z - p.z)).toBeLessThan(8);
    expect(r.client.stats.pending).toBeLessThan(30);
  });
});

describe('Interpolation fremder Fahrzeuge', () => {
  it('bleibt gleichmäßig, obwohl der Host Eingaben stoßweise verarbeitet', () => {
    const interp = new EntityInterp(0.085);
    const s = spawnState(1);
    const rand = rng(7);
    const out = newState();
    // Fährt mit Vollgas im Kreis (Radius ca. 14 m), damit es die Bande nicht berührt.
    const cmd: Cmd = { steer: 80, buttons: BTN_GAS };
    let ptick = 0;
    let carry = 0;
    let hostTick = 0;
    let prevX = Number.NaN;
    let prevZ = Number.NaN;
    const speeds: number[] = [];
    const arrivals: { at: number; ptick: number; state: typeof s }[] = [];
    const stepMs = 1000 / 60;
    let acc = 0;
    for (let ms = 0; ms < 12000; ms++) {
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
          stepKart(s, cmd);
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
        if (ms > 4000 && !Number.isNaN(prevX)) speeds.push(Math.hypot(out.x - prevX, out.z - prevZ) / 0.016);
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
    expect(mean).toBeLessThan(23);
    expect(dev / mean).toBeLessThan(0.1);
  });
});

describe('Simulation', () => {
  it('ist deterministisch', () => {
    const a = spawnState(0);
    const b = spawnState(0);
    for (let i = 0; i < 2000; i++) {
      stepKart(a, drive(i));
      stepKart(b, drive(i));
    }
    expect(a).toEqual(b);
    expect(Math.abs(a.x) + Math.abs(a.z)).toBeGreaterThan(1);
    expect(DT).toBeCloseTo(1 / 60);
  });
});

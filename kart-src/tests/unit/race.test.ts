import { describe, expect, it } from 'vitest';
import { botCmd, newBrain } from '../../src/game/ai';
import { ClientGame } from '../../src/game/clientGame';
import { HostGame } from '../../src/game/hostGame';
import { ITEM_BOOST, ITEM_OIL, ITEM_TIRE, NEUTRAL, forwardSpeed, type Cmd } from '../../src/game/sim';
import { TRACK } from '../../src/game/track';
import { RACE_COUNTDOWN, RACE_RESULTS, RACE_RUNNING, THING_OIL, THING_TIRE, decodeCmds, decodeSnapshot } from '../../src/net/protocol';

const CTX = { tick: 0, place: 1, smoke: false };
const count = (host: HostGame, kind: number): number => host.things().filter((t) => t.kind === kind).length;

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('Rennen auf dem Host', () => {
  it('vier KI-Fahrer: Countdown, drei Runden, Ergebnisliste', () => {
    const host = new HostGame(-1);
    host.setRoster([], true);
    host.newRace();
    expect(host.phase).toBe(RACE_COUNTDOWN);
    let tires = 0;
    let oils = 0;
    let maxTires = 0;
    let lastTireCount = 0;
    let lastOilCount = 0;
    let moved = false;
    // Alles, was im Lauf des Rennens auf der Strecke lag oder flog (Reifen, Öl, Kreisel, Rauch).
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 200 && host.phase !== RACE_RESULTS; i++) {
      host.step(NEUTRAL);
      if (host.phase === RACE_COUNTDOWN) {
        for (let s = 0; s < 4; s++) if (Math.abs(forwardSpeed(host.authoritative(s)!)) > 0.01) moved = true;
      }
      const t = count(host, THING_TIRE);
      const o = count(host, THING_OIL);
      if (t > lastTireCount) tires += t - lastTireCount;
      if (o > lastOilCount) oils += o - lastOilCount;
      lastTireCount = t;
      lastOilCount = o;
      maxTires = Math.max(maxTires, t);
      for (const th of host.things()) seen.add(`${th.kind}:${th.id}`);
    }
    const st = host.standings();
    console.log(
      `Ergebnis: ${st.map((s) => `${s.place}. Fahrer ${s.slot + 1} (${(s.finishTicks / 60).toFixed(1)} s)`).join(', ')}; Rollreifen ${tires}, Ölflecken ${oils}`,
    );
    expect(moved).toBe(false);
    expect(host.phase).toBe(RACE_RESULTS);
    expect(st.map((s) => s.place)).toEqual([1, 2, 3, 4]);
    expect(st.every((s) => s.finished)).toBe(true);
    for (let i = 1; i < st.length; i++) expect(st[i].finishTicks).toBeGreaterThanOrEqual(st[i - 1].finishTicks);
    // Items wurden eingesammelt und benutzt. Welche, ist ausgelost – gezählt wird deshalb jede Art.
    expect(seen.size).toBeGreaterThan(2);
  });

  it('Items wirken: Schub, Rollreifen trifft, Ölfleck trifft', () => {
    const host = new HostGame(0);
    host.setRoster([0, 1], false);
    host.newRace();
    const press: Cmd = { steer: 0, buttons: 8 };
    const gas: Cmd = { steer: 0, buttons: 1 };
    while (host.phase !== RACE_RUNNING) host.step(NEUTRAL);
    const fx: string[] = [];
    host.onFx = (slot, kind) => fx.push(`${slot}:${kind}`);

    // Kart 1 steht direkt vor Kart 0 in dessen Blickrichtung.
    const a = host.authoritative(0)!;
    const b = host.authoritative(1)!;
    b.x = a.x + Math.sin(a.heading) * 14;
    b.z = a.z + Math.cos(a.heading) * 14;
    b.seg = a.seg + 14;

    host.giveItem(0, ITEM_TIRE);
    host.step(press);
    expect(count(host, THING_TIRE)).toBe(1);
    for (let i = 0; i < 40 && b.spin === 0; i++) host.step(NEUTRAL);
    expect(b.spin).toBeGreaterThan(0);
    expect(count(host, THING_TIRE)).toBe(0);
    expect(fx).toContain('1:hit');

    // Schub
    host.giveItem(0, ITEM_BOOST);
    host.step(NEUTRAL);
    host.step(press);
    expect(a.boost).toBeGreaterThan(80);
    expect(fx).toContain('0:boost');

    // Ölfleck: Kart 0 legt ihn ab, fährt weiter; später fährt jemand hinein.
    host.giveItem(0, ITEM_OIL);
    host.step(NEUTRAL);
    host.step(press);
    expect(count(host, THING_OIL)).toBe(1);
    const oil = host.things().find((t) => t.kind === THING_OIL)!;
    for (let i = 0; i < 400; i++) host.step(gas);
    const c = host.authoritative(1)!;
    c.spin = 0;
    c.shield = 0;
    c.x = oil.x;
    c.z = oil.z;
    host.step(gas);
    expect(c.spin).toBeGreaterThan(0);
    expect(count(host, THING_OIL)).toBe(0);
  });

  it('Rempler schieben Karts auseinander', () => {
    const host = new HostGame(0);
    host.setRoster([0, 1], false);
    host.newRace();
    while (host.phase !== RACE_RUNNING) host.step(NEUTRAL);
    const a = host.authoritative(0)!;
    const b = host.authoritative(1)!;
    b.x = a.x + 0.6;
    b.z = a.z;
    host.step(NEUTRAL);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(1.9);
  });
});

interface Packet {
  at: number;
  data: ArrayBuffer;
}

/** Host und ein Client (dessen Kart per KI gelenkt wird) über eine simulierte Leitung. */
function simulate(opts: { lag: number; jitter: number; loss: number; laps: number; maxSeconds: number }) {
  const rand = rng(99);
  const host = new HostGame(0, { laps: opts.laps });
  host.setRoster([0, 1], true);
  host.newRace();
  const client = new ClientGame(1, () => opts.lag * 2 + opts.jitter);
  const brainClient = newBrain(1);
  const brainHost = newBrain(0);
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
  const stepMs = 1000 / 60;
  let hostAcc = 0;
  let clientAcc = 7;
  const corrections: number[] = [];
  let startCorrection = 0;
  let movedEarly = false;
  let goSeenAt = -1;
  let now = 0;
  for (; now < opts.maxSeconds * 1000 && host.phase !== RACE_RESULTS; now++) {
    deliver(up, now, (d) => {
      const c = decodeCmds(new DataView(d))!;
      host.receiveCmds(1, c.newestSeq, c.cmds);
    });
    deliver(down, now, (d) => {
      const wasRunning = host.phase === RACE_RUNNING;
      client.onSnapshot(decodeSnapshot(new DataView(d))!, now / 1000);
      const c = client.stats.lastCorrection;
      if (wasRunning && goSeenAt >= 0 && now - goSeenAt < 1500) startCorrection = Math.max(startCorrection, c);
      else if (wasRunning && goSeenAt >= 0) corrections.push(c);
    });
    hostAcc += 1;
    while (hostAcc >= stepMs) {
      hostAcc -= stepMs;
      const before = host.phase;
      host.step(botCmd(host.authoritative(0)!, brainHost, [], host.localCanDrive(), CTX));
      if (before === RACE_COUNTDOWN && host.phase === RACE_RUNNING) goSeenAt = now;
      if (host.phase === RACE_COUNTDOWN && Math.abs(forwardSpeed(host.authoritative(1)!)) > 0.01) movedEarly = true;
      if (host.tick % 2 === 0) send(down, now, host.snapshot());
    }
    clientAcc += 1;
    while (clientAcc >= stepMs) {
      clientAcc -= stepMs;
      const t = now / 1000;
      const cmd = client.ready ? botCmd(client.predictedState(), brainClient, [], client.localCanDrive(t), CTX) : NEUTRAL;
      const pkt = client.tick(cmd, t);
      if (pkt) send(up, now, pkt);
    }
  }
  corrections.sort((a, b) => a - b);
  const pct = (p: number): number => corrections[Math.min(corrections.length - 1, Math.floor(corrections.length * p))] ?? 0;
  return {
    host,
    client,
    seconds: now / 1000,
    startCorrection,
    movedEarly,
    median: pct(0.5),
    p99: pct(0.99),
    max: corrections[corrections.length - 1] ?? 0,
    bigShare: corrections.filter((c) => c > 0.5).length / Math.max(1, corrections.length),
  };
}

describe('Rennen über das Netz (simuliert)', () => {
  it('gute Leitung (15 ms): ganzes Rennen, Vorhersage stimmt bis auf Rempler und Treffer', () => {
    const r = simulate({ lag: 15, jitter: 5, loss: 0, laps: 2, maxSeconds: 150 });
    console.log(
      `15 ms: Rennen ${r.seconds.toFixed(0)} s, Korrektur beim Start ${(r.startCorrection * 100).toFixed(1)} cm, danach Median ${(r.median * 100).toFixed(2)} cm, 99 % unter ${(r.p99 * 100).toFixed(1)} cm, größte ${(r.max * 100).toFixed(0)} cm, Anteil über 50 cm: ${(r.bigShare * 100).toFixed(2)} %`,
    );
    expect(r.host.phase).toBe(RACE_RESULTS);
    expect(r.movedEarly).toBe(false);
    expect(r.host.standings().find((s) => s.slot === 1)!.finished).toBe(true);
    // Der Client kennt denselben Endstand.
    expect(r.client.standings().map((s) => s.slot)).toEqual(r.host.standings().map((s) => s.slot));
    expect(r.median).toBeLessThan(0.01);
    expect(r.startCorrection).toBeLessThan(0.6);
    expect(r.bigShare).toBeLessThan(0.02);
  });

  it('schlechte Leitung (80 ms, Schwankung, 5 % Verlust): Rennen bleibt fahrbar', () => {
    const r = simulate({ lag: 80, jitter: 30, loss: 5, laps: 2, maxSeconds: 150 });
    console.log(
      `80 ms/30 ms/5 %: Rennen ${r.seconds.toFixed(0)} s, Korrektur beim Start ${(r.startCorrection * 100).toFixed(1)} cm, danach Median ${(r.median * 100).toFixed(2)} cm, 99 % unter ${(r.p99 * 100).toFixed(1)} cm, größte ${(r.max * 100).toFixed(0)} cm, Anteil über 50 cm: ${(r.bigShare * 100).toFixed(2)} %`,
    );
    expect(r.host.phase).toBe(RACE_RESULTS);
    expect(r.host.standings().find((s) => s.slot === 1)!.finished).toBe(true);
    expect(r.median).toBeLessThan(0.02);
    expect(r.bigShare).toBeLessThan(0.05);
  });

  it('Strecke hat Kisten und Boost-Felder an sinnvollen Stellen', () => {
    expect(TRACK.boxes.length).toBe(12);
    expect(TRACK.pads.length).toBe(3);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botCmd, newBrain } from '../../src/game/ai';
import { ClientGame } from '../../src/game/clientGame';
import { HostGame } from '../../src/game/hostGame';
import { PULSE_VENT, VEH_BUS, pulseCycle, type Vehicle } from '../../src/game/mechanics';
import {
  BTN_BRAKE, BTN_GAS, EV_HIT, KART_RADIUS, NEUTRAL, SPIN_TICKS,
  forwardSpeed, gridState, stepKart, type Cmd, type KartState,
} from '../../src/game/sim';
import { TRACK, newVehiclePose, setTrack, trackHeading, vehiclePose, wrapSeg } from '../../src/game/track';
import type { RenderEntity } from '../../src/game/view';
import { CMD_REDUNDANCY, RACE_COUNTDOWN, RACE_RUNNING, decodeCmds, decodeSnapshot } from '../../src/net/protocol';
import { withoutMechanics } from './helpers';

const PLATZ = 1;
const GAS: Cmd = { steer: 0, buttons: BTN_GAS };

beforeEach(() => {
  // Auch die internen Uhren/Item-Seeds des Hosts stehen fest; getestet wird in Ticks.
  vi.useFakeTimers({ toFake: ['Date', 'performance'] });
  vi.setSystemTime(0);
});
afterEach(() => vi.useRealTimers());

/** Keine zufälligen Items oder fremden Treffer; alle Streckenänderungen zurückgeben. */
function aufStrecke(index: number, pruefen: () => void): void {
  const vorher = TRACK.index;
  const t = setTrack(index);
  const behalten = { boxes: t.boxes, hazards: t.hazards, vehicles: t.vehicles, pulses: t.pulses, floods: t.floods };
  t.boxes = [];
  t.hazards = [];
  try {
    pruefen();
  } finally {
    Object.assign(t, behalten);
    setTrack(vorher);
  }
}

function ohneMechanik(pruefen: () => void): void {
  aufStrecke(0, () => withoutMechanics(pruefen));
}

function neuerHost(rennzeit = 100): HostGame {
  const host = new HostGame(-1);
  host.setRoster([PLATZ], false);
  host.newRace();
  host.tick = host.goTick + rennzeit;
  host.phase = rennzeit < 0 ? RACE_COUNTDOWN : RACE_RUNNING;
  host.debugPlace(PLATZ, 20);
  const s = host.authoritative(PLATZ)!;
  s.vx = Math.sin(s.heading) * 20;
  s.vz = Math.cos(s.heading) * 20;
  return host;
}

function stand(host: HostGame) {
  return decodeSnapshot(new DataView(host.snapshot()))!;
}

function kart(host: HostGame) {
  return stand(host).karts.find((k) => k.slot === PLATZ)!;
}

function abgleichen(host: HostGame, client: ClientGame): void {
  client.onSnapshot(stand(host), host.tick / 60);
}

function neuerClient(host: HostGame): ClientGame {
  const client = new ClientGame(PLATZ, () => 0);
  abgleichen(host, client);
  return client;
}

function zustellen(host: HostGame, paket: ArrayBuffer): void {
  const c = decodeCmds(new DataView(paket))!;
  host.receiveCmds(PLATZ, c.newestSeq, c.cmds, c.times, c.raceId);
}

function abstand(a: KartState, b: KartState): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function gleicherZustand(a: KartState, b: KartState): void {
  // Nur die räumlichen Werte dürfen durch float32 im Snapshot leicht abweichen.
  expect(abstand(a, b)).toBeLessThan(0.001);
  for (const feld of ['vx', 'vy', 'vz'] as const) expect(a[feld]).toBeCloseTo(b[feld], 3);
  // +π und −π sind dieselbe Richtung; float32 kann über diese Grenze runden.
  const winkel = a.heading - b.heading;
  expect(Math.abs(Math.atan2(Math.sin(winkel), Math.cos(winkel)))).toBeLessThan(0.001);
  for (const feld of ['spin', 'shield', 'flat', 'draft', 'flags', 'boost', 'item', 'roulette'] as const) {
    expect(a[feld], feld).toBe(b[feld]);
  }
}

/** Normale Leitung nach der Störung: neue Eingaben, Snapshot alle zwei Ticks. */
function erholtSich(host: HostGame, client: ClientGame): void {
  let ack = kart(host).ack;
  const bilder: RenderEntity[] = [];
  let bildFehler = Infinity;
  for (let i = 1; i <= 60; i++) {
    const paket = client.tick(GAS, (host.tick + 1) / 60)!;
    const seq = decodeCmds(new DataView(paket))!.newestSeq;
    zustellen(host, paket);
    host.step(NEUTRAL);
    const jetzt = kart(host);
    expect(jetzt.ack).toBeGreaterThanOrEqual(ack);
    expect(jetzt.ack).toBeLessThanOrEqual(seq);
    ack = jetzt.ack;
    if (i % 2 === 0) abgleichen(host, client);
    for (const s of [host.authoritative(PLATZ)!, client.predictedState()]) {
      expect(Object.values(s).every(Number.isFinite)).toBe(true);
      expect(s.item).toBe(0);
      expect(s.roulette).toBe(0);
    }
    client.entities(1, host.tick / 60, 1 / 60, bilder);
    bildFehler = abstand(bilder.find((b) => b.slot === PLATZ)!, host.authoritative(PLATZ)!);
  }
  expect(host.drainCmdCounts().get(PLATZ)!.queued).toBe(0);
  gleicherZustand(client.predictedState(), host.authoritative(PLATZ)!);
  // Auch die geglättete Darstellung muss innerhalb einer Sekunde aufgeholt haben.
  expect(bildFehler).toBeLessThan(0.5);
}

describe('Zeitklemme und erneutes Abspielen', () => {
  it.each([-41, -40, -39, 39, 40, 41])('Rennzeit mit Abstand %i zur Host-Zeit: Klemme und Abgleich', (delta) => {
    aufStrecke(2, () => {
      const p = TRACK.pulses.find((p) => p.kind === PULSE_VENT)!;
      TRACK.pulses = [p];
      TRACK.floods = [];
      // Hinter der unteren Grenze endet ein Ausbruch, vor der oberen beginnt einer.
      const gemeldet = p.period - p.phase + (delta < 0 ? p.on - 1 : 0);
      const hostZeit = gemeldet - delta;
      const wirksam = hostZeit + Math.max(-40, Math.min(40, delta));
      const host = neuerHost(Math.min(gemeldet, hostZeit) - 1);
      Object.assign(host.authoritative(PLATZ)!, {
        x: p.x, y: p.y, z: p.z, seg: p.seg, heading: trackHeading(TRACK, p.seg),
        vx: 0, vy: 0, vz: 0, flags: 0,
      });
      const anfang = { ...host.authoritative(PLATZ)! };
      const client = neuerClient(host);
      const erstes = client.tick(NEUTRAL, (host.goTick + gemeldet) / 60)!;
      expect(decodeCmds(new DataView(erstes))!.times).toEqual([gemeldet]);
      expect(client.predictedState().spin).toBe(SPIN_TICKS);
      const zweites = client.tick(NEUTRAL, (host.goTick + gemeldet + 1) / 60)!;

      zustellen(host, erstes);
      host.tick = host.goTick + hostZeit - 1;
      host.step(NEUTRAL);
      const erwartet = { ...anfang };
      stepKart(erwartet, NEUTRAL, { canDrive: true, speedFactor: 1, time: wirksam });
      gleicherZustand(host.authoritative(PLATZ)!, erwartet);
      expect(kart(host).ack).toBe(1);
      expect(host.authoritative(PLATZ)!.spin).toBe(Math.abs(delta) <= 40 ? SPIN_TICKS : 0);

      const erneut = { ...kart(host).state };
      stepKart(erneut, NEUTRAL, { canDrive: true, speedFactor: 1, time: gemeldet + 1 });
      client.onSnapshot(stand(host), (host.goTick + Math.max(hostZeit, gemeldet + 1)) / 60);
      gleicherZustand(client.predictedState(), erneut);
      // Gewollte Host-Autorität (C-001/R1): Pending benutzt weiter seine ursprüngliche Zeit.
      // Bei +41 kann deshalb bis zur Bestätigung noch einmal ein vorhergesagter Treffer entstehen.
      if (delta === 41) expect(client.predictedState().spin).toBe(SPIN_TICKS);
      zustellen(host, zweites);
      host.step(NEUTRAL);
      expect(kart(host).ack).toBe(2);
      client.onSnapshot(stand(host), (host.goTick + Math.max(hostZeit + 1, gemeldet + 1)) / 60);
      gleicherZustand(client.predictedState(), host.authoritative(PLATZ)!);
    });
  });
});

describe('Verlustserien, Ersatzschritte und Warteschlangen', () => {
  it('mehr als die Redundanz geht verloren; verspätete Duplikate setzen ack nicht zurück', () => {
    ohneMechanik(() => {
      const host = neuerHost();
      const client = neuerClient(host);
      const verloren: ArrayBuffer[] = [];
      for (let i = 0; i < CMD_REDUNDANCY + 2; i++) {
        verloren.push(client.tick(GAS, (host.tick + 1) / 60)!);
        host.step(NEUTRAL);
        expect(kart(host).ack).toBe(0);
      }
      const danach = client.tick(GAS, (host.tick + 1) / 60)!;
      expect(decodeCmds(new DataView(danach))!.cmds).toHaveLength(CMD_REDUNDANCY);
      zustellen(host, danach);
      host.step(NEUTRAL);
      // Die ersten drei Sequenzen sind endgültig verloren; der Host holt höchstens drei nach.
      expect(kart(host).ack).toBe(6);
      expect(kart(host).ptick).toBe(3);
      abgleichen(host, client);
      for (const paket of verloren.reverse()) zustellen(host, paket);
      expect(host.drainCmdCounts().get(PLATZ)!.queued).toBe(1);
      expect(kart(host).ack).toBe(6);
      erholtSich(host, client);
    });
  });

  it.each([12, 13, 90, 91, 92])('%i Ticks Pause: Ersatzschritte und genaue Grenze der KI-Übernahme', (pause) => {
    ohneMechanik(() => {
      const host = neuerHost();
      const ohneUebernahme = neuerHost();
      host.authoritative(PLATZ)!.shield = 200;
      ohneUebernahme.authoritative(PLATZ)!.shield = 200;
      const client = neuerClient(host);
      host.setOnline(PLATZ, false);
      for (let i = 1; i <= pause; i++) {
        host.step(NEUTRAL);
        ohneUebernahme.step(NEUTRAL);
        expect(kart(host).ack).toBe(0);
        expect(kart(host).ptick).toBe(Math.max(0, i - 12));
      }
      expect(host.authoritative(PLATZ)!.shield).toBe(200 - Math.max(0, pause - 12));
      if (pause <= 91) gleicherZustand(host.authoritative(PLATZ)!, ohneUebernahme.authoritative(PLATZ)!);
      else {
        // Ist-Verhalten: >90 wird vor dem Hochzählen geprüft, daher erster KI-Schritt bei 92.
        expect(forwardSpeed(host.authoritative(PLATZ)!)).toBeGreaterThan(forwardSpeed(ohneUebernahme.authoritative(PLATZ)!));
      }
      host.setOnline(PLATZ, true);
      erholtSich(host, client);
    });
  });

  it('eine nach dem ersten Ersatzschritt zugestellte Eingabe zählt zusätzlich, bis der Snapshot korrigiert', () => {
    ohneMechanik(() => {
      const host = neuerHost();
      host.authoritative(PLATZ)!.shield = 100;
      const client = neuerClient(host);
      const spaet = client.tick(NEUTRAL, (host.tick + 1) / 60)!;
      for (let i = 0; i < 13; i++) host.step(NEUTRAL);
      expect(kart(host)).toMatchObject({ ack: 0, ptick: 1 });
      expect(host.authoritative(PLATZ)!.shield).toBe(99);
      expect(client.predictedState().shield).toBe(99);
      zustellen(host, spaet);
      host.step(NEUTRAL);
      expect(kart(host)).toMatchObject({ ack: 1, ptick: 2 });
      expect(host.authoritative(PLATZ)!.shield).toBe(98);
      // Der Ersatzschritt gehört zu keiner Sequenz; erst der Zustand bestätigt auch seinen Timer-Abzug.
      abgleichen(host, client);
      expect(client.predictedState().shield).toBe(98);
      gleicherZustand(client.predictedState(), host.authoritative(PLATZ)!);
      erholtSich(host, client);
    });
  });

  it.each([
    { anzahl: 30, ack: 3, wartend: 27, verworfen: 0 },
    { anzahl: 31, ack: 26, wartend: 5, verworfen: 23 },
  ])('$anzahl wartende Eingaben: Kürzung, ack und Erholung', ({ anzahl, ack, wartend, verworfen }) => {
    ohneMechanik(() => {
      const host = neuerHost();
      const client = neuerClient(host);
      const zurueckgehalten: ArrayBuffer[] = [];
      for (let i = 0; i < anzahl; i++) {
        zurueckgehalten.push(client.tick(GAS, (host.tick + 1) / 60)!);
        host.step(NEUTRAL);
        expect(kart(host).ack).toBe(0);
      }
      // Eine verspätete Paketserie trifft auf einmal ein, während beide Uhren weiterliefen.
      for (const paket of zurueckgehalten) zustellen(host, paket);
      expect(host.drainCmdCounts().get(PLATZ)!.queued).toBe(anzahl);
      const vorher = kart(host).ptick;
      host.step(NEUTRAL);
      expect(kart(host).ack).toBe(ack);
      expect(kart(host).ptick - vorher).toBe(3);
      expect(host.drainCmdCounts().get(PLATZ)).toEqual({ received: 0, dropped: verworfen, queued: wartend });
      abgleichen(host, client);
      erholtSich(host, client);
    });
  });

  it.each([false, true])('Wiederkehr nach KI-Übernahme mit neuem Client: %s', (neu) => {
    ohneMechanik(() => {
      const host = neuerHost();
      let client = neuerClient(host);
      for (let i = 0; i < 5; i++) {
        zustellen(host, client.tick(GAS, (host.tick + 1) / 60)!);
        host.step(NEUTRAL);
        abgleichen(host, client);
      }
      expect(kart(host).ack).toBe(5);
      host.setOnline(PLATZ, false);
      client.resync();
      for (let i = 0; i < 100; i++) {
        host.step(NEUTRAL);
        expect(kart(host).ack).toBe(5);
      }
      if (neu) client = new ClientGame(PLATZ, () => 0);
      expect(client.tick(GAS, host.tick / 60)).toBeNull();
      host.setOnline(PLATZ, true);
      // Ein ausdrücklicher Verbindungsneustart ist eine neue ack-Zählung, kein Rücklauf im Rennen.
      host.resetInput(PLATZ);
      expect(kart(host).ack).toBe(0);
      abgleichen(host, client);
      const paket = client.tick(GAS, (host.tick + 1) / 60)!;
      const gelesen = decodeCmds(new DataView(paket))!;
      expect(gelesen.newestSeq).toBe(neu ? 1 : 6);
      expect(gelesen.times).toEqual([host.tick + 1 - host.goTick]);
      zustellen(host, paket);
      host.step(NEUTRAL);
      expect(kart(host).ack).toBe(gelesen.newestSeq);
      abgleichen(host, client);
      gleicherZustand(client.predictedState(), host.authoritative(PLATZ)!);
      erholtSich(host, client);
    });
  });
});

describe('Rennstart, Rennwechsel und Snapshot-Grenzen', () => {
  it('nachgeholte Countdown-Eingaben fahren auf dem Host; Pending behält sein ursprüngliches canDrive', () => {
    ohneMechanik(() => {
      const host = neuerHost(-5);
      host.authoritative(PLATZ)!.vx = host.authoritative(PLATZ)!.vz = 0;
      const client = neuerClient(host);
      const pakete: ArrayBuffer[] = [];
      for (let i = 0; i < 4; i++) {
        pakete.push(client.tick(GAS, (host.tick + 1) / 60)!);
        host.step(NEUTRAL);
        expect(host.phase).toBe(RACE_COUNTDOWN);
        expect(forwardSpeed(host.authoritative(PLATZ)!)).toBe(0);
      }
      expect(decodeCmds(new DataView(pakete[3]))!.times).toEqual([-4, -3, -2, -1]);
      expect(forwardSpeed(client.predictedState())).toBe(0);
      zustellen(host, pakete[2]);
      host.step(NEUTRAL);
      expect(host.phase).toBe(RACE_RUNNING);
      expect(kart(host).ack).toBe(3);
      expect(forwardSpeed(host.authoritative(PLATZ)!)).toBeGreaterThan(0);
      const erneut = { ...kart(host).state };
      stepKart(erneut, GAS, { canDrive: false, speedFactor: 1, time: -1 });
      const fahrend = { ...kart(host).state };
      stepKart(fahrend, GAS, { canDrive: true, speedFactor: 1, time: -1 });
      expect(forwardSpeed(fahrend)).toBeGreaterThan(forwardSpeed(erneut));
      abgleichen(host, client);
      gleicherZustand(client.predictedState(), erneut);
      // C-001/R2, gewolltes Ist-Verhalten: die letzte Bestätigung räumt die unterschiedliche Schrittfolge auf.
      zustellen(host, pakete[3]);
      host.step(NEUTRAL);
      expect(kart(host).ack).toBe(4);
      abgleichen(host, client);
      gleicherZustand(client.predictedState(), host.authoritative(PLATZ)!);
      erholtSich(host, client);
    });
  });

  it('Rennwechsel verwirft alte Pakete und alte Vorhersage, die Sequenz darf weiterlaufen', () => {
    ohneMechanik(() => {
      const host = neuerHost();
      const client = neuerClient(host);
      for (let i = 0; i < 4; i++) {
        zustellen(host, client.tick(GAS, (host.tick + 1) / 60)!);
        host.step(NEUTRAL);
        abgleichen(host, client);
      }
      const alterStand = stand(host);
      const alt = client.tick(GAS, (host.tick + 1) / 60)!;
      host.newRace();
      zustellen(host, alt);
      expect(host.drainCmdCounts().get(PLATZ)!.queued).toBe(0);
      host.step(NEUTRAL);
      expect(kart(host).ack).toBe(4);
      abgleichen(host, client);
      gleicherZustand(client.predictedState(), host.authoritative(PLATZ)!);
      client.onSnapshot(alterStand, host.tick / 60);
      expect(client.race(host.tick / 60).raceId).toBe(host.raceId);
      const neu = client.tick(GAS, (host.tick + 1) / 60)!;
      expect(decodeCmds(new DataView(neu))!.newestSeq).toBe(6);
      zustellen(host, neu);
      host.step(NEUTRAL);
      expect(kart(host).ack).toBe(6);
      abgleichen(host, client);
      gleicherZustand(client.predictedState(), host.authoritative(PLATZ)!);
    });
  });

  it('alle in C-001/H1 geprüften Timer-Obergrenzen passen gleichzeitig in den Snapshot', () => {
    ohneMechanik(() => {
      const host = neuerHost();
      const grenzen = {
        guard: 720, boost: 100, driftCharge: 255, spin: 75, shield: 205, stall: 150,
        respawn: 55, roulette: 70, tow: 240, draft: 185, flat: 130,
        driftDir: -1, item: 9, nextItem: 9, flags: 15, char: 3,
      };
      Object.assign(host.authoritative(PLATZ)!, grenzen);
      expect(kart(host).state).toMatchObject(grenzen);
      expect(neuerClient(host).predictedState()).toMatchObject(grenzen);
    });
  });
});

/** Das erste Paket fällt aus; das zweite muss seine beiden tatsächlichen Zeiten mitbringen. */
function verlorenerTreffer(host: HostGame, ersteZeit: number): void {
  const client = neuerClient(host);
  const verloren = client.tick(NEUTRAL, (host.goTick + ersteZeit) / 60)!;
  expect(decodeCmds(new DataView(verloren))!.times).toEqual([ersteZeit]);
  expect(client.predictedState().spin).toBe(SPIN_TICKS);
  host.step(NEUTRAL);
  expect(kart(host).ack).toBe(0);
  expect(host.authoritative(PLATZ)!.spin).toBe(0);
  // Uhrkorrektur: der nächste Schritt hat Abstand 2, nicht 1 (Regression zu C-001/F1).
  const wiederholt = client.tick(NEUTRAL, (host.goTick + ersteZeit + 3) / 60)!;
  expect(decodeCmds(new DataView(wiederholt))!.times).toEqual([ersteZeit, ersteZeit + 2]);
  const vorAbgleich = { ...client.predictedState() };
  zustellen(host, wiederholt);
  host.step(NEUTRAL);
  expect(kart(host).ack).toBe(2);
  expect(host.authoritative(PLATZ)!.spin).toBe(SPIN_TICKS - 1);
  // Schon vor dem Snapshot stimmen Treffer und Position; ein harter Abgleich könnte Fehler sonst verdecken.
  gleicherZustand(host.authoritative(PLATZ)!, vorAbgleich);
  abgleichen(host, client);
  gleicherZustand(client.predictedState(), host.authoritative(PLATZ)!);
}

describe('Paketverlust unmittelbar an einer Treffergrenze', () => {
  it('Glutkessel: die verlorene Eingabe im letzten Ausbruch-Tick trifft auch beim Nachholen', () => {
    aufStrecke(2, () => {
      const p = TRACK.pulses.find((p) => p.kind === PULSE_VENT)!;
      TRACK.pulses = [p];
      TRACK.floods = [];
      const zeit = p.period + p.on - p.phase - 1;
      expect(pulseCycle(p, zeit)).toBe(p.on - 1);
      expect(pulseCycle(p, zeit + 1)).toBe(p.on);
      const host = neuerHost(zeit - 1);
      Object.assign(host.authoritative(PLATZ)!, {
        x: p.x, y: p.y, z: p.z, seg: p.seg, heading: trackHeading(TRACK, p.seg),
        vx: 0, vy: 0, vz: 0, flags: 0,
      });
      verlorenerTreffer(host, zeit);
    });
  });

  it('Nachtschicht: die verlorene Eingabe am Busheck erhält Treffer und Position', () => {
    aufStrecke(3, () => {
      const bus = TRACK.vehicles.find((v) => v.kind === VEH_BUS)!;
      TRACK.vehicles = [bus];
      const pose = newVehiclePose();
      let zeit = 600;
      for (; zeit < 9000; zeit += 15) {
        vehiclePose(TRACK, bus, 0, zeit, pose);
        if (Array.from({ length: 41 }, (_, i) => wrapSeg(TRACK, pose.seg + i - 20))
          .every((seg) => Math.abs(TRACK.curv[seg]) < 1 / 400 && TRACK.twin[seg] < 0)) break;
      }
      expect(zeit).toBeLessThan(9000);
      const host = neuerHost(zeit - 1);
      const tempo = bus.speed + 12;
      const hinten = bus.half + KART_RADIUS + (tempo - bus.speed / 2) / 60;
      Object.assign(host.authoritative(PLATZ)!, {
        x: pose.x - Math.sin(pose.heading) * hinten,
        z: pose.z - Math.cos(pose.heading) * hinten,
        y: pose.y, seg: wrapSeg(TRACK, pose.seg - Math.round(hinten / TRACK.step)),
        heading: pose.heading, vx: Math.sin(pose.heading) * tempo, vz: Math.cos(pose.heading) * tempo,
        vy: 0, flags: 0,
      });
      const spaeter = { ...host.authoritative(PLATZ)! };
      stepKart(spaeter, NEUTRAL, { canDrive: true, speedFactor: 1, time: zeit + 1 });
      expect(spaeter.spin).toBe(0); // Ein Tick später ist das Heck bereits außer Reichweite.
      verlorenerTreffer(host, zeit);
    });
  });
});

describe('KI bei vollständig gesperrter Fahrbahn', () => {
  it('drei überlappende Fahrzeugstreifen erzwingen Bremsen; eine freie Spur erlaubt Weiterfahrt', () => {
    aufStrecke(3, () => {
      const bus = TRACK.vehicles.find((v) => v.kind === VEH_BUS)!;
      const seg = 20;
      const fahrer = gridState(PLATZ);
      Object.assign(fahrer, {
        seg, x: TRACK.px[seg], y: TRACK.py[seg], z: TRACK.pz[seg], heading: trackHeading(TRACK, seg),
        vx: TRACK.tx[seg] * 20, vz: TRACK.tz[seg] * 20, vy: 0, flags: 0,
      });
      // Noch weit genug weg, dass nicht schon die unmittelbare Auffahrbremse greift.
      const sperren: Vehicle[] = [-5, 0, 5].map((lat, id) => ({ ...bus, id, lat, speed: 0, offset: seg * TRACK.step + 30 }));
      const ctx = { tick: 100, time: 100, place: 1, smoke: false };
      TRACK.vehicles = sperren.slice(0, 2);
      const frei = botCmd(fahrer, newBrain(PLATZ), [], true, ctx);
      expect(frei.buttons & BTN_GAS).not.toBe(0);
      expect(frei.buttons & BTN_BRAKE).toBe(0);
      TRACK.vehicles = sperren;
      const brain = newBrain(PLATZ);
      const dicht = botCmd(fahrer, brain, [], true, ctx);
      expect(dicht.buttons & BTN_GAS).toBe(0);
      expect(dicht.buttons & BTN_BRAKE).not.toBe(0);
      let ereignisse = 0;
      for (let i = 0; i < 60; i++) {
        const cmd = botCmd(fahrer, brain, [], true, { ...ctx, tick: 100 + i, time: 100 + i });
        ereignisse |= stepKart(fahrer, cmd, { canDrive: true, speedFactor: 1, time: 100 + i });
      }
      expect(ereignisse & EV_HIT).toBe(0);
      expect(fahrer.spin).toBe(0);
      expect(forwardSpeed(fahrer)).toBeLessThan(13);
    });
  });
});

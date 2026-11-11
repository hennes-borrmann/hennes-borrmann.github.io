import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botCmd, newBrain } from '../../src/game/ai';
import { ClientGame } from '../../src/game/clientGame';
import { HostGame } from '../../src/game/hostGame';
import { BELT_EDGE, BELT_RAMP, FLAT_TICKS, PULSE_PRESS, WATER_FROM, pulseCycle, tideLevel } from '../../src/game/mechanics';
import {
  BTN_GAS, BTN_ITEM, CHARACTERS, EV_BLOCK, EV_FALL, EV_FLAT, EV_RESPAWNED,
  EV_USE_GUARD, EV_USE_KITE, EV_USE_SPRING, FLAG_AIR, ITEM_GUARD, ITEM_KITE,
  ITEM_NONE, ITEM_OIL, ITEM_SPRING, ITEM_TIRE, ITEM_TOP, NEUTRAL, RESPAWN_TICKS,
  V_MAX, forwardSpeed, gridState, stepKart, type Cmd, type KartState,
} from '../../src/game/sim';
import { TRACK, groundAt, proj, projectOnTrack, rightX, rightZ, segDelta, setTrack, trackHeading } from '../../src/game/track';
import { RACE_RUNNING, decodeCmds, decodeSnapshot, encodeSnapshot } from '../../src/net/protocol';

const PLATZ = 1;
const GAS: Cmd = { steer: 0, buttons: BTN_GAS };
const ITEM: Cmd = { steer: 0, buttons: BTN_ITEM };
const umgebung = (time: number) => ({ canDrive: true, speedFactor: 1, time });
const abstand = (a: KartState, b: KartState) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

beforeEach(() => {
  // Auch Host-Zeitbezug und Item-Seed bleiben fest; alle Abläufe benutzen gezählte Ticks.
  vi.useFakeTimers({ toFake: ['Date', 'performance'] });
  vi.setSystemTime(0);
});
afterEach(() => vi.useRealTimers());

function aufStrecke(index: number, pruefen: () => void): void {
  const vorher = TRACK.index;
  const t = setTrack(index);
  const behalten = { boxes: t.boxes, hazards: t.hazards, pads: t.pads, vehicles: t.vehicles,
    pulses: t.pulses, floods: t.floods, belts: t.belts, tide: t.tide };
  t.boxes = []; t.hazards = []; t.pads = []; t.vehicles = []; t.floods = [];
  try { pruefen(); } finally { Object.assign(t, behalten); setTrack(vorher); }
}

function anStelle(seg: number, lat = 0, tempo = 0, entlang = 0): KartState {
  const t = TRACK, s = gridState(0);
  Object.assign(s, {
    seg, x: t.px[seg] + rightX(t, seg) * lat + t.tx[seg] * entlang,
    z: t.pz[seg] + rightZ(t, seg) * lat + t.tz[seg] * entlang,
    y: groundAt(t, seg, entlang, lat), heading: trackHeading(t, seg),
    vx: t.tx[seg] * tempo, vz: t.tz[seg] * tempo, vy: 0, flags: 0,
  });
  return s;
}

function neuerHost(s: KartState, zeit: number, lokal = -1): HostGame {
  const host = new HostGame(lokal);
  host.setRoster([PLATZ], false);
  host.newRace();
  host.phase = RACE_RUNNING;
  host.tick = host.goTick + zeit;
  Object.assign(host.authoritative(PLATZ)!, s);
  return host;
}
const snapshot = (host: HostGame) => decodeSnapshot(new DataView(host.snapshot()))!;
function neuerClient(host: HostGame): ClientGame {
  const client = new ClientGame(PLATZ, () => 0);
  client.onSnapshot(snapshot(host), host.tick / 60);
  return client;
}
function zustellen(host: HostGame, paket: ArrayBuffer): void {
  const p = decodeCmds(new DataView(paket))!;
  host.receiveCmds(PLATZ, p.newestSeq, p.cmds, p.times, p.raceId);
}
function gleich(a: KartState, b: KartState): void {
  expect(abstand(a, b)).toBeLessThan(0.0001);
  for (const feld of ['vx', 'vy', 'vz'] as const) expect(Math.abs(a[feld] - b[feld])).toBeLessThan(0.0001);
  for (const feld of ['flat', 'shield', 'guard', 'spin', 'respawn', 'tow', 'boost', 'flags'] as const) {
    expect(a[feld], feld).toBe(b[feld]);
  }
}

/** Eine echte Eingabe mit abweichender Rennzeit, danach Bestätigung ohne offene Eingaben. */
function geklemmterSchritt(s: KartState, gemeldet: number, delta: number, cmd: Cmd) {
  const hostZeit = gemeldet - delta;
  const host = neuerHost(s, Math.min(gemeldet, hostZeit) - 1);
  const client = neuerClient(host);
  const paket = client.tick(cmd, (host.goTick + gemeldet) / 60)!;
  expect(decodeCmds(new DataView(paket))!.times).toEqual([gemeldet]);
  const vorhergesagt = { ...client.predictedState() };
  zustellen(host, paket);
  host.tick = host.goTick + hostZeit - 1;
  host.step(NEUTRAL);
  const wirksam = hostZeit + Math.max(-40, Math.min(40, delta));
  const erwartet = { ...s };
  stepKart(erwartet, cmd, umgebung(wirksam));
  gleich(host.authoritative(PLATZ)!, erwartet);
  const bestaetigt = snapshot(host);
  expect(bestaetigt.karts[0].ack).toBe(1);
  client.onSnapshot(bestaetigt, (host.goTick + Math.max(gemeldet, hostZeit)) / 60);
  gleich(client.predictedState(), host.authoritative(PLATZ)!);
  return { vorhergesagt, autoritativ: host.authoritative(PLATZ)!, wirksam };
}

describe('Zeitklemme an Presse und steigender Wasserlinie', () => {
  it.each([-41, -40, -39, 39, 40, 41])('Presse: Zeitabstand %i, letzter gefährlicher / erster freier Tick', (delta) => {
    aufStrecke(0, () => {
      const p = TRACK.pulses.find((p) => p.kind === PULSE_PRESS)!;
      TRACK.pulses = [p]; TRACK.belts = [];
      // Alte Eingabe: letzter gefährlicher Tick. Künftige Eingabe: erster freier Tick,
      // dessen Klemme bei +41 auf den letzten gefährlichen Tick zurückführt.
      const zeit = p.period - p.phase + p.on - (delta < 0 ? 1 : 0);
      const r = geklemmterSchritt(anStelle(p.seg, p.lat), zeit, delta, NEUTRAL);
      expect(r.vorhergesagt.flat).toBe(delta < 0 ? FLAT_TICKS : 0);
      expect(r.autoritativ.flat).toBe(pulseCycle(p, r.wirksam) < p.on ? FLAT_TICKS : 0);
      expect(r.autoritativ.flat === r.vorhergesagt.flat).toBe(Math.abs(delta) <= 40);
    });
  });

  it.each([-41, -40, -39, 39, 40, 41])('steigende Flut: Zeitabstand %i wird durch den nächsten Snapshot korrigiert', (delta) => {
    aufStrecke(1, () => {
      const t = TRACK, tide = t.tide!;
      const zeit = 1206, seg = 1430;
      expect(t.tidal[seg]).toBe(1);
      expect(tideLevel(tide, zeit + 1)).toBeGreaterThan(tideLevel(tide, zeit));
      // Bei alten Eingaben ist der gemeldete Schritt gerade trocken, bei künftigen
      // der geklemmte Vorgänger. So überschreiten beide ±41-Fälle wirklich die Grenze.
      const anLinie = zeit - (delta > 0 ? 1 : 0);
      const lat = (tideLevel(tide, anLinie) - WATER_FROM + 1e-5 - t.py[seg]) / t.bank[seg];
      expect(Math.abs(lat)).toBeLessThan(t.rh[seg] - 1);
      const s = anStelle(seg, lat, V_MAX * CHARACTERS[0].vmax);
      const r = geklemmterSchritt(s, zeit, delta, GAS);
      expect(r.wirksam).toBe(zeit + (delta === -41 ? 1 : delta === 41 ? -1 : 0));
      if (delta === -41) expect(forwardSpeed(r.autoritativ)).toBeLessThan(forwardSpeed(r.vorhergesagt) - 0.0001);
      if (delta === 41) expect(forwardSpeed(r.autoritativ)).toBeGreaterThan(forwardSpeed(r.vorhergesagt) + 0.0001);
      // Auch innerhalb der Toleranz darf allein die Snapshot-Rundung nichts aufschaukeln.
      if (Math.abs(delta) <= 40) gleich(r.vorhergesagt, r.autoritativ);
    });
  });
});

describe('Item-Tastendruck relativ zum Pressentreffer', () => {
  const faelle = [
    { name: 'Schutzschild', item: ITEM_GUARD, ereignis: EV_USE_GUARD },
    { name: 'Sprungfeder', item: ITEM_SPRING, ereignis: EV_USE_SPRING },
    { name: 'Abschleppdrache', item: ITEM_KITE, ereignis: EV_USE_KITE },
  ].flatMap((item) => [-1, 0, 1].map((versatz) => ({ ...item, versatz })));
  it.each(faelle)('$name: Tastendruck $versatz Tick relativ zum Aufschlag', ({ item, ereignis, versatz }) => {
    aufStrecke(0, () => {
      const p = TRACK.pulses[0]; TRACK.pulses = [p]; TRACK.belts = [];
      const s = anStelle(p.seg, p.lat); s.item = item;
      const start = p.period - p.phase;
      const events: number[] = [];
      for (let d = -1; d <= 1; d++) events.push(stepKart(s, d === versatz ? ITEM : NEUTRAL, umgebung(start + d)));
      expect(events[versatz + 1] & ereignis).not.toBe(0);
      expect(s.item).toBe(ITEM_NONE);
      // Ein Tick Vorsprung genügt beim Schild/Drachen; die Feder ist dann noch unter 2.5 m.
      // Im Trefferschritt kommt jedes Item zu spät: Presse steht im Ablauf vor Item-Nutzung.
      const geschuetzt = versatz === -1 && item !== ITEM_SPRING;
      expect(events[1] & EV_FLAT).toBe(geschuetzt ? 0 : EV_FLAT);
      expect(s.flat).toBe(geschuetzt ? 0 : FLAT_TICKS - 1);
      expect(s.spin).toBe(0);
      if (versatz === -1 && item === ITEM_GUARD) {
        expect(events[1] & EV_BLOCK).not.toBe(0);
        expect(s.guard).toBe(0);
      }
      if (item === ITEM_KITE) expect(s.tow).toBeGreaterThan(0);
    });
  });
});

describe('Rücksetzen und Flucht aus Mechanik', () => {
  function zuruecksetzen(s: KartState, zeit: number): void {
    s.y -= TRACK.fallDepth + 1; s.flags = FLAG_AIR;
    expect(stepKart(s, NEUTRAL, umgebung(zeit)) & EV_FALL).not.toBe(0);
    expect(s.respawn).toBe(RESPAWN_TICKS);
    for (let i = 1; i <= RESPAWN_TICKS; i++) {
      const ev = stepKart(s, GAS, umgebung(zeit + i));
      expect(ev & (EV_FALL | EV_FLAT)).toBe(0);
      expect(s.flat).toBe(0);
      expect(!!(ev & EV_RESPAWNED)).toBe(i === RESPAWN_TICKS);
    }
    expect(s.shield).toBe(70);
    expect(s.respawn).toBe(0);
  }

  it('unter einer Presse zurückgesetzt: Schutz deckt das Wegfahren ab', () => {
    aufStrecke(0, () => {
      const p = TRACK.pulses.find((p) => p.lat === 0)!;
      expect(p).toBeDefined();
      const s = anStelle(p.seg);
      const start = p.period - p.phase - RESPAWN_TICKS - 1;
      zuruecksetzen(s, start);
      expect(Math.hypot(s.x - p.x, s.z - p.z)).toBeLessThan(p.radius);
      const brain = newBrain(0), von = s.seg;
      let verlassen = -1;
      for (let i = 1; i <= 600; i++) {
        const zeit = start + RESPAWN_TICKS + i, schutz = s.shield;
        const ev = stepKart(s, botCmd(s, brain, [], true, { tick: zeit, time: zeit, place: 1, smoke: false }), umgebung(zeit));
        expect(ev & EV_FALL).toBe(0);
        if (schutz > 1) expect(ev & EV_FLAT).toBe(0);
        if (segDelta(TRACK, von, s.seg) > 40) { verlassen = i; break; }
      }
      expect(verlassen).toBeGreaterThan(0);
      expect(verlassen).toBeLessThanOrEqual(600);
      expect(s.flat).toBe(0);
    });
  });

  it('im tiefsten Rücksetzpunkt der Uferstraße: auch bei anhaltender Flut kommt die KI heraus', () => {
    aufStrecke(1, () => {
      const t = TRACK, tide = t.tide!;
      let startSeg = -1, boden = Infinity;
      for (let i = 0; i < t.n; i++) {
        const r = t.respawn[i];
        if (t.tidal[r] && t.py[r] < boden) { startSeg = i; boden = t.py[r]; }
      }
      expect(startSeg).toBeGreaterThanOrEqual(0);
      const s = anStelle(startSeg);
      const flut = Math.round(tide.period * 0.65) - tide.phase;
      zuruecksetzen(s, flut - RESPAWN_TICKS);
      expect(tideLevel(tide, flut) - s.y).toBeGreaterThan(0.4);
      expect(t.py[s.seg]).toBe(boden);
      const brain = newBrain(0);
      let verlassen = -1;
      for (let i = 1; i <= 1200; i++) {
        const schutz = s.shield;
        // Pegel festhalten: bestanden wird durch Wegfahren, nicht durch Warten auf Ebbe.
        const ev = stepKart(s, botCmd(s, brain, [], true, { tick: i, time: flut, place: 1, smoke: true }), umgebung(flut));
        expect(ev & EV_FALL).toBe(0);
        if (schutz > 1) expect(ev & EV_FLAT).toBe(0);
        if (!t.tidal[s.seg]) { verlassen = i; break; }
      }
      expect(verlassen).toBeGreaterThan(0);
      expect(verlassen).toBeLessThanOrEqual(1200);
      expect(s.respawn).toBe(0);
    });
  });

  it.each([false, true])('Gegenband an der Hallenwand nach Rempler, Rauch: %s', (smoke) => {
    aufStrecke(0, () => {
      const t = TRACK, band = t.belts.find((b) => b.along < 0)!;
      const s = anStelle(band.first + 10, -t.wh[band.first + 10] + 1.05);
      s.heading += 1; s.vx = -rightX(t, s.seg) * 5; s.vz = -rightZ(t, s.seg) * 5; s.spin = 45;
      const brain = newBrain(0); brain.route = 1; brain.routeLock = true;
      let verlassen = -1;
      for (let i = 1; i <= 600; i++) {
        const ev = stepKart(s, botCmd(s, brain, [], true, { tick: i, time: i, place: 1, smoke }), umgebung(i));
        expect(ev & EV_FALL).toBe(0);
        if (s.seg >= band.first + band.count && t.branchOf[s.seg] === 0) { verlassen = i; break; }
      }
      expect(verlassen).toBeGreaterThan(0);
      expect(verlassen).toBeLessThanOrEqual(600);
      expect(forwardSpeed(s)).toBeGreaterThan(5);
    });
  });
});

describe('Items ignorieren Bänder und Wasser (gewolltes Ist-Verhalten)', () => {
  it.each([0, 1].flatMap((strecke) => [ITEM_TIRE, ITEM_TOP, ITEM_OIL].map((item) => ({ strecke, item }))))(
    'Strecke $strecke, Item $item: gleiche Bahn mit und ohne Mechanik', ({ strecke, item }) => {
      aufStrecke(strecke, () => {
        const t = TRACK, belts = t.belts, tide = t.tide;
        const seg = strecke === 0 ? belts.find((b) => b.along > 0)!.first + 20 : 1330;
        if (strecke === 1) {
          expect(t.tidal[seg]).toBe(1);
          expect(tideLevel(tide!, 1601) - t.py[seg]).toBeGreaterThan(WATER_FROM);
        }
        const bahnen = [false, true].map((aktiv) => {
          t.belts = []; t.tide = null; t.pulses = [];
          const host = neuerHost(anStelle(seg), 1600, PLATZ);
          host.giveItem(PLATZ, item);
          host.step(ITEM);
          expect(host.things()).toHaveLength(1);
          const anfang = { ...host.things()[0] };
          if (aktiv) { t.belts = belts; t.tide = tide; }
          const bahn = [];
          for (let i = 0; i < 30; i++) {
            host.step(NEUTRAL);
            expect(host.things()).toHaveLength(1);
            bahn.push({ ...host.things()[0] });
          }
          const ende = bahn[bahn.length - 1];
          const weg = Math.hypot(ende.x - anfang.x, ende.z - anfang.z);
          if (item === ITEM_OIL) expect(weg).toBe(0);
          else expect(weg).toBeGreaterThan(10);
          return bahn;
        });
        expect(bahnen[1]).toEqual(bahnen[0]);
      });
    },
  );
});

/** Wie der Netzcode quantisiert, nicht per nachgebautem Math.fround. */
function durchSnapshot(s: KartState): KartState {
  return decodeSnapshot(new DataView(encodeSnapshot({
    tick: 100, raceId: 1, phase: RACE_RUNNING, goTick: 0, laps: 3, boxes: 0, track: TRACK.index,
    karts: [{ slot: PLATZ, bot: false, ptick: 0, ack: 0, state: s, lap: 1, place: 1, finished: false, finishTicks: 0 }], things: [],
  })))!.karts[0].state;
}

describe('Bandnaht, Landung und beide Bandenden', () => {
  it.each(['linke', 'rechte'])('float32 über die %s Bandnaht: Vorhersage und echter Snapshot bleiben nah', (seite) => {
    aufStrecke(0, () => {
      const t = TRACK, band = t.belts.find((b) => b.along > 0)!;
      t.pulses = [];
      const naht = seite === 'linke' ? band.lat0 : band.lat1;
      let anfang: KartState | undefined;
      for (let seg = band.first + 2; seg < band.first + band.count - 2 && !anfang; seg++) {
        const s = anStelle(seg, naht, 0, 0.37), rund = durchSnapshot(s);
        projectOnTrack(t, s.x, s.z, s.seg); const a = proj.lat;
        projectOnTrack(t, rund.x, rund.z, rund.seg);
        if ((a - naht) * (proj.lat - naht) < 0) anfang = s;
      }
      expect(anfang).toBeDefined();
      const host = neuerHost(anfang!, 100), client = neuerClient(host);
      expect(abstand(host.authoritative(PLATZ)!, client.predictedState())).toBeLessThan(0.0001);
      for (let i = 1; i <= 8; i++) {
        zustellen(host, client.tick(NEUTRAL, (host.tick + 1) / 60)!);
        host.step(NEUTRAL);
        // Vor dem Abgleich: die frühere Verstärkung auf 20 cm darf nicht wiederkehren.
        gleich(client.predictedState(), host.authoritative(PLATZ)!);
        client.onSnapshot(snapshot(host), host.tick / 60);
        gleich(client.predictedState(), host.authoritative(PLATZ)!);
      }
    });
  });

  it.each(['innen', 'aussen'])('Landung am seitlichen Bandrand: %s, Mitnahme erst im folgenden Bodenschritt', (lage) => {
    aufStrecke(0, () => {
      const t = TRACK, band = t.belts.find((b) => b.along > 0)!, belts = t.belts;
      t.pulses = [];
      // Rechter Außenrand aller Hallenbänder; innen liegt das Gegenband.
      const rand = Math.max(...belts.filter((b) => b.along !== 0).map((b) => b.lat1));
      const s = anStelle(band.first + 12, rand + (lage === 'innen' ? -BELT_EDGE / 2 : 0.1));
      s.y += 0.01; s.vy = -1; s.flags = FLAG_AIR;
      const ohne = { ...s };
      stepKart(s, NEUTRAL, umgebung(100));
      t.belts = []; stepKart(ohne, NEUTRAL, umgebung(100)); t.belts = belts;
      expect(s.flags & FLAG_AIR).toBe(0);
      expect(s).toEqual(ohne);
      stepKart(s, NEUTRAL, umgebung(101));
      t.belts = []; stepKart(ohne, NEUTRAL, umgebung(101));
      if (lage === 'innen') expect(abstand(s, ohne)).toBeGreaterThan(0.02);
      else expect(s).toEqual(ohne);
    });
  });

  it('vor Anfang und hinter Ende keine Wirkung; innerhalb beider Enden sanftes Anlaufen', () => {
    aufStrecke(0, () => {
      const t = TRACK, band = t.belts.find((b) => b.along > 0)!;
      t.pulses = [];
      const mitnahme = (seg: number) => {
        const s = anStelle(seg), ohne = { ...s };
        t.belts = [band]; stepKart(s, NEUTRAL, umgebung(100));
        t.belts = []; stepKart(ohne, NEUTRAL, umgebung(100));
        return (s.x - ohne.x) * t.tx[seg] + (s.z - ohne.z) * t.tz[seg];
      };
      const erster = mitnahme(band.first), letzter = mitnahme(band.first + band.count - 1);
      const innen = Math.ceil(BELT_RAMP / t.step) + 1;
      expect(mitnahme(band.first - 1)).toBeCloseTo(0, 10);
      expect(mitnahme(band.first + band.count)).toBeCloseTo(0, 10);
      expect(erster).toBeGreaterThan(0); expect(letzter).toBeGreaterThan(0);
      expect(erster).toBeLessThan(band.along / 120); expect(letzter).toBeLessThan(band.along / 120);
      expect(mitnahme(band.first + innen)).toBeCloseTo(band.along / 60, 4);
      expect(mitnahme(band.first + band.count - 1 - innen)).toBeCloseTo(band.along / 60, 4);
    });
  });
});

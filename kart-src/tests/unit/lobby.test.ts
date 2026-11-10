import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ClientLobby } from '../../src/lobby/clientLobby';
import { HostLobby } from '../../src/lobby/hostLobby';

// Die Lobby braucht nur die Zeitgeber des Browsers.
beforeAll(() => {
  (globalThis as unknown as { window: unknown }).window ??= globalThis;
});

const open: HostLobby[] = [];
function newLobby(saved?: ConstructorParameters<typeof HostLobby>[3]): HostLobby {
  const lobby = new HostLobby('ABCD', 'token-host', 'Anna', saved);
  open.push(lobby);
  return lobby;
}

afterEach(() => {
  for (const l of open.splice(0)) l.close();
});

describe('Rundenzahl in der Lobby', () => {
  it('steht anfangs auf 3 und steckt im Lobby-Zustand', () => {
    const lobby = newLobby();
    expect(lobby.laps).toBe(3);
    expect(lobby.state().laps).toBe(3);
  });

  it('bleibt beim Umstellen zwischen 2 und 5', () => {
    const lobby = newLobby();
    let changes = 0;
    lobby.onChange = () => changes++;
    lobby.setLaps(4);
    expect(lobby.state().laps).toBe(4);
    lobby.setLaps(9);
    expect(lobby.laps).toBe(5);
    lobby.setLaps(0);
    expect(lobby.laps).toBe(2);
    lobby.setLaps(-3);
    expect(lobby.laps).toBe(2);
    lobby.setLaps(Number.NaN);
    expect(lobby.laps).toBe(3);
    expect(changes).toBe(4);
    lobby.setLaps(3);
    expect(changes).toBe(4);
  });

  it('lässt sich nur in der Lobby-Phase ändern', () => {
    const lobby = newLobby();
    lobby.setPhase('game');
    lobby.setLaps(5);
    expect(lobby.laps).toBe(3);
    lobby.setPhase('lobby');
    lobby.setLaps(5);
    expect(lobby.laps).toBe(5);
  });

  it('wird mit den Einstellungen gemerkt und begrenzt wiederhergestellt', () => {
    const first = newLobby();
    first.setLaps(2);
    const save = first.toSave();
    expect(save.laps).toBe(2);
    expect(newLobby(save).laps).toBe(2);
    expect(newLobby({ ...save, laps: 12 }).laps).toBe(5);
    expect(newLobby({ ...save, laps: undefined }).laps).toBe(3);
  });

  it('kann nur der Host ändern', () => {
    expect('setLaps' in HostLobby.prototype).toBe(true);
    expect('setLaps' in ClientLobby.prototype).toBe(false);
  });
});

import { randomInt } from 'node:crypto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeRoomCode(lobbies) {
  let code;
  do { code = Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join(''); }
  while (lobbies.has(code));
  return code;
}

export function createLobby(code, hostId) {
  return {
    code, hostId, phase: 'lobby', secretWord: null, impostorId: null, winner: null, voteResolved: false,
    players: new Map(), clues: new Map(), votes: new Map(), round: 0,
    clueOpensAt: null, clueDeadline: null, timer: null, cleanupTimer: null
  };
}

export function publicState(lobby) {
  const players = [...lobby.players.values()].map(({ id, name, alive, connected }) => ({ id, name, alive, connected }));
  const alive = players.filter(p => p.alive);
  return {
    roomCode: lobby.code, hostId: lobby.hostId, phase: lobby.phase, round: lobby.round,
    players, aliveCount: alive.length, clueOpensAt: lobby.clueOpensAt, clueDeadline: lobby.clueDeadline,
    clues: lobby.phase === 'display' || lobby.phase === 'vote' || lobby.phase === 'ended'
      ? players.filter(p => lobby.clues.has(p.id)).map(p => ({ playerId: p.id, playerName: p.name, word: lobby.clues.get(p.id) })) : [],
    voteResolved: lobby.voteResolved,
    voteCounts: lobby.voteResolved || lobby.phase === 'ended' ? Object.fromEntries([...lobby.votes.values()].reduce((counts, id) => counts.set(id, (counts.get(id) || 0) + 1), new Map())) : {},
    winner: lobby.winner,
    impostorName: lobby.phase === 'ended' ? lobby.players.get(lobby.impostorId)?.name ?? null : null
  };
}

export function alivePlayers(lobby) { return [...lobby.players.values()].filter(player => player.alive); }

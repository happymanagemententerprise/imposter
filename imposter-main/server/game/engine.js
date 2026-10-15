import { chooseWord } from './words.js';
import { alivePlayers } from './lobby.js';

export const MIN_PLAYERS = 3;
export const IMPOSTOR_WIN_THRESHOLD = 3;
export const ROLE_REVEAL_MS = 7000;
export const CLUE_WINDOW_MS = 60000;

export function startRound(lobby, now = Date.now(), random = Math.random) {
  const alive = alivePlayers(lobby).filter(player => player.connected);
  if (alive.length < MIN_PLAYERS) throw new Error(`At least ${MIN_PLAYERS} players are required.`);
  lobby.round += 1;
  lobby.secretWord = chooseWord(random);
  const incumbent = lobby.players.get(lobby.impostorId);
  if (lobby.gameMode !== 'continuous' || !incumbent?.alive) {
    lobby.impostorId = alive[Math.floor(random() * alive.length)].id;
  }
  lobby.clues = new Map();
  lobby.votes = new Map();
  lobby.voteResolved = false;
  lobby.phase = 'clue';
  lobby.clueOpensAt = now + ROLE_REVEAL_MS;
  lobby.clueDeadline = lobby.clueOpensAt + CLUE_WINDOW_MS;
  return { opensAt: lobby.clueOpensAt, deadline: lobby.clueDeadline };
}

export function submitClue(lobby, playerId, rawWord, now = Date.now()) {
  if (lobby.phase !== 'clue') throw new Error('Clues are not being collected right now.');
  if (now < lobby.clueOpensAt) throw new Error('The clue round has not opened yet.');
  if (now >= lobby.clueDeadline) throw new Error('The clue round has ended.');
  const player = lobby.players.get(playerId);
  if (!player?.alive || !player.connected) throw new Error('Only connected players still in the game can submit a clue.');
  if (lobby.clues.has(playerId)) throw new Error('Your clue has already been submitted.');
  const word = typeof rawWord === 'string' ? rawWord.trim().replace(/\s+/g, ' ') : '';
  if (!word || word.length > 24 || /[\r\n]/.test(word)) throw new Error('Enter a clue between 1 and 24 characters.');
  const normalized = word.toLocaleLowerCase();
  if ([...lobby.clues.values()].some(value => value.toLocaleLowerCase() === normalized)) throw new Error('That clue has already been used. Choose another.');
  lobby.clues.set(playerId, word);
  return word;
}

export function submitVote(lobby, voterId, targetId) {
  if (lobby.phase !== 'vote') throw new Error('Voting is not open right now.');
  const voter = lobby.players.get(voterId);
  if (!voter?.alive || !voter.connected) throw new Error('Only connected players still in the game can vote.');
  if (!lobby.players.get(targetId)?.alive || voterId === targetId) throw new Error('Choose another living player.');
  if (lobby.votes.has(voterId)) throw new Error('Your vote has already been recorded.');
  lobby.votes.set(voterId, targetId);
  return lobby.votes.size === alivePlayers(lobby).filter(p => p.connected).length;
}

export function resolveVote(lobby) {
  const counts = new Map();
  for (const target of lobby.votes.values()) counts.set(target, (counts.get(target) || 0) + 1);
  const high = Math.max(0, ...counts.values());
  const leaders = [...counts].filter(([, count]) => count === high);
  const eliminatedId = leaders.length === 1 ? leaders[0][0] : null;
  if (eliminatedId) lobby.players.get(eliminatedId).alive = false;
  const caught = eliminatedId === lobby.impostorId;
  const impostorWins = !caught && alivePlayers(lobby).length <= IMPOSTOR_WIN_THRESHOLD;
  lobby.winner = caught ? 'players' : impostorWins ? 'impostor' : null;
  lobby.voteResolved = true;
  lobby.phase = lobby.winner ? 'ended' : 'display';
  return { eliminatedId, caught, tie: leaders.length > 1, voteCounts: Object.fromEntries(counts), winner: lobby.winner };
}

export function advanceAfterDisplay(lobby, now = Date.now(), random = Math.random) {
  if (lobby.phase !== 'display') throw new Error('Clues must be revealed before the next round.');
  if (alivePlayers(lobby).length <= IMPOSTOR_WIN_THRESHOLD) {
    lobby.phase = 'ended'; lobby.winner = 'impostor';
    return { winner: lobby.winner };
  }
  startRound(lobby, now, random);
  return { winner: null };
}

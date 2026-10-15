import { makeRoomCode, createLobby, publicState, alivePlayers } from './game/lobby.js';
import { startRound, submitClue, submitVote, resolveVote, advanceAfterDisplay } from './game/engine.js';

const IDLE_TTL = 30 * 60 * 1000;
const MAX_PLAYERS = 20;

export function attachSockets(io) {
  const lobbies = new Map();
  const socketPlayers = new Map();

  function broadcast(lobby) { io.to(lobby.code).emit('state-update', publicState(lobby)); }
  function error(socket, message) { socket.emit('game-error', { message }); }
  function resolvePlayer(socket, data) {
    const binding = socketPlayers.get(socket.id);
    if (binding && binding.roomCode === String(data?.roomCode || '').toUpperCase()) return { lobby: lobbies.get(binding.roomCode), playerId: binding.playerId };
    return { lobby: null, playerId: '' };
  }

  io.on('connection', socket => {
    socket.on('watch-room', ({ roomCode } = {}) => {
      const code = String(roomCode || '').trim().toUpperCase();
      const lobby = lobbies.get(code);
      if (!lobby) return socket.emit('game-error', { message: 'Room not found. Check the code and try again.' });
      socket.join(code);
      socket.emit('state-update', publicState(lobby));
    });
  });
  function toDisplay(lobby) {
    if (lobby.phase !== 'clue') return;
    lobby.phase = 'display';
    lobby.clueOpensAt = null; lobby.clueDeadline = null;
    broadcast(lobby);
  }
  function removeLobby(code) {
    const lobby = lobbies.get(code);
    if (!lobby) return;
    clearTimeout(lobby.timer); clearTimeout(lobby.cleanupTimer);
    io.to(code).emit('room-closed', { message: 'This room has closed.' });
    lobbies.delete(code);
  }
  function scheduleCleanup(lobby) {
    clearTimeout(lobby.cleanupTimer);
    if ([...lobby.players.values()].some(p => p.connected)) return;
    lobby.cleanupTimer = setTimeout(() => removeLobby(lobby.code), IDLE_TTL);
    lobby.cleanupTimer.unref?.();
  }

  io.on('connection', socket => {
    socket.on('join-lobby', (data = {}) => {
      try {
        const name = typeof data.name === 'string' ? data.name.trim().replace(/\s+/g, ' ') : '';
        if (!name || name.length > 20) return error(socket, 'Choose a name between 1 and 20 characters.');
        let lobby, player, isNewRoom = false;
        const code = String(data.roomCode || '').trim().toUpperCase();
        const playerId = typeof data.playerId === 'string' ? data.playerId : '';

        // Restore the same player after a refresh or lost connection.
        if (code && playerId) {
          lobby = lobbies.get(code);
          player = lobby?.players.get(playerId);
          if (player && lobby.phase !== 'ended') {
            const oldSocketId = player.socketId;
            if (oldSocketId) socketPlayers.delete(oldSocketId);
            player.name = name; player.connected = true; player.socketId = socket.id;
            socketPlayers.set(socket.id, { roomCode: code, playerId });
            socket.join(code); clearTimeout(lobby.cleanupTimer);
            socket.emit('lobby-joined', { roomCode: code, playerId, host: lobby.hostId === playerId });
            socket.emit('state-update', publicState(lobby));
            if (lobby.phase === 'clue') socket.emit('role-assigned', { role: playerId === lobby.impostorId ? 'impostor' : 'player', word: playerId === lobby.impostorId ? null : lobby.secretWord, opensAt: lobby.clueOpensAt, clueSubmitted: lobby.clues.has(playerId) });
            broadcast(lobby); return;
          }
        }
        if (code) {
          lobby = lobbies.get(code);
          if (!lobby) return error(socket, 'Room not found. Check the code and try again.');
          if (lobby.phase !== 'lobby') return error(socket, 'This game has already started.');
          if (lobby.players.size >= MAX_PLAYERS) return error(socket, 'This room is full.');
          const duplicate = [...lobby.players.values()].some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase());
          if (duplicate) return error(socket, 'That name is already in this room.');
          player = { id: playerId || socket.id, name, socketId: socket.id, alive: true, connected: true };
          lobby.players.set(player.id, player);
        } else {
          const id = playerId || socket.id;
          const newCode = makeRoomCode(lobbies);
          lobby = createLobby(newCode, id); isNewRoom = true;
          player = { id, name, socketId: socket.id, alive: true, connected: true };
          lobby.players.set(id, player); lobbies.set(newCode, lobby);
        }
        socketPlayers.set(socket.id, { roomCode: lobby.code, playerId: player.id });
        socket.join(lobby.code);
        socket.emit('lobby-joined', { roomCode: lobby.code, playerId: player.id, host: lobby.hostId === player.id, isNewRoom });
        broadcast(lobby);
      } catch { error(socket, 'Could not join the room. Please try again.'); }
    });

    socket.on('start-game', (data = {}) => {
      const { lobby, playerId } = resolvePlayer(socket, data);
      if (!lobby || !lobby.players.has(playerId)) return error(socket, 'Join a room before starting.');
      if (lobby.hostId !== playerId) return error(socket, 'Only the room host can start the game.');
      if (lobby.phase !== 'lobby') return error(socket, 'The game has already started.');
      if ([...lobby.players.values()].filter(p => p.connected).length < 3) return error(socket, 'At least 3 connected players are required.');
      try {
        const { opensAt, deadline } = startRound(lobby);
        for (const player of alivePlayers(lobby).filter(p => p.connected)) {
          io.to(player.socketId).emit('role-assigned', { role: player.id === lobby.impostorId ? 'impostor' : 'player', word: player.id === lobby.impostorId ? null : lobby.secretWord, opensAt });
        }
        lobby.timer = setTimeout(() => toDisplay(lobby), Math.max(0, deadline - Date.now()));
        lobby.timer.unref?.(); broadcast(lobby);
      } catch (e) { error(socket, e.message); }
    });

    socket.on('submit-word', (data = {}) => {
      const { lobby, playerId } = resolvePlayer(socket, data);
      if (!lobby || !lobby.players.has(playerId)) return error(socket, 'Join the room before submitting a clue.');
      try {
        submitClue(lobby, playerId, data.word);
        socket.emit('clue-accepted');
        if (alivePlayers(lobby).every(p => lobby.clues.has(p.id) || !p.connected)) {
          clearTimeout(lobby.timer); toDisplay(lobby);
        } else broadcast(lobby);
      } catch (e) { error(socket, e.message); }
    });

    socket.on('begin-vote', (data = {}) => {
      const { lobby, playerId } = resolvePlayer(socket, data);
      if (!lobby || !lobby.players.has(playerId)) return error(socket, 'Join the room before voting.');
      if (lobby.hostId !== playerId) return error(socket, 'Only the host can open voting.');
      if (lobby.phase !== 'display') return error(socket, 'Clues must be revealed before voting.');
      if (lobby.voteResolved) return error(socket, 'Continue to the next round first.');
      lobby.phase = 'vote'; lobby.votes = new Map(); broadcast(lobby);
    });

    socket.on('submit-vote', (data = {}) => {
      const { lobby, playerId } = resolvePlayer(socket, data);
      if (!lobby || !lobby.players.has(playerId)) return error(socket, 'Join the room before voting.');
      try {
        const allVoted = submitVote(lobby, playerId, data.targetPlayerId);
        socket.emit('vote-accepted');
        if (allVoted) {
          const result = resolveVote(lobby);
          clearTimeout(lobby.timer);
          io.to(lobby.code).emit('vote-result', { ...result, eliminated: result.eliminatedId ? lobby.players.get(result.eliminatedId)?.name : null });
          if (result.winner) io.to(lobby.code).emit('game-over', publicState(lobby));
        }
        broadcast(lobby);
      } catch (e) { error(socket, e.message); }
    });

    socket.on('next-round', (data = {}) => {
      const { lobby, playerId } = resolvePlayer(socket, data);
      if (!lobby || lobby.hostId !== playerId) return error(socket, 'Only the host can continue.');
      if (!lobby.voteResolved) return error(socket, 'Vote before starting the next round.');
      try {
        const { winner } = advanceAfterDisplay(lobby);
        if (!winner) {
          for (const player of alivePlayers(lobby).filter(p => p.connected)) io.to(player.socketId).emit('role-assigned', {
            role: player.id === lobby.impostorId ? 'impostor' : 'player',
            word: player.id === lobby.impostorId ? null : lobby.secretWord, opensAt: lobby.clueOpensAt
          });
          lobby.timer = setTimeout(() => toDisplay(lobby), Math.max(0, lobby.clueDeadline - Date.now()));
          lobby.timer.unref?.();
        }
        broadcast(lobby);
      } catch (e) { error(socket, e.message); }
    });

    socket.on('disconnect', () => {
      const binding = socketPlayers.get(socket.id);
      if (!binding) return;
      socketPlayers.delete(socket.id);
      const lobby = lobbies.get(binding.roomCode), player = lobby?.players.get(binding.playerId);
      if (!lobby || !player || player.socketId !== socket.id) return;
      player.connected = false; player.socketId = null;
      if (lobby.phase === 'lobby' && lobby.hostId === player.id) {
        const successor = [...lobby.players.values()].find(p => p.connected);
        if (successor) lobby.hostId = successor.id;
      }
      if (lobby.phase === 'clue' && alivePlayers(lobby).every(p => lobby.clues.has(p.id) || !p.connected)) {
        clearTimeout(lobby.timer); toDisplay(lobby);
      } else if (lobby.phase === 'vote' && alivePlayers(lobby).filter(p => p.connected).every(p => lobby.votes.has(p.id))) {
        const result = resolveVote(lobby);
        io.to(lobby.code).emit('vote-result', { ...result, eliminated: result.eliminatedId ? lobby.players.get(result.eliminatedId)?.name : null });
        if (result.winner) io.to(lobby.code).emit('game-over', publicState(lobby));
        broadcast(lobby);
      } else broadcast(lobby);
      scheduleCleanup(lobby);
    });
  });
  return lobbies;
}

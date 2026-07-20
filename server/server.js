const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const config = require('./config');
const catalog = require('./catalog');
const { rooms, createRoom, publicPlayers, broadcastLobby, freePlayerFaction } = require('./rooms');
const gameEngine = require('./gameEngine');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, '..', 'public')));

function getRoomOfSocket(socket) {
  const code = socket.data.roomCode;
  if (!code) return null;
  return rooms.get(code) || null;
}

function stopMatch(room) {
  if (room.tickInterval) {
    clearInterval(room.tickInterval);
    room.tickInterval = null;
  }
  if (room.countdownTimeout) {
    clearTimeout(room.countdownTimeout);
    room.countdownTimeout = null;
  }
}

function resetToLobby(room) {
  stopMatch(room);
  room.state = 'lobby';
  room.matchState = null;
  for (const f of catalog.FACTIONS) room.factions[f] = null;
  for (const player of room.players.values()) {
    player.faction = null;
    player.ready = false;
  }
}

function startTickLoop(room) {
  room.tickInterval = setInterval(() => {
    const { snapshot, newlyEliminated, matchEnd } = gameEngine.tick(room.matchState);
    io.to(room.code).emit('stateTick', snapshot);
    for (const playerId of newlyEliminated) {
      io.to(room.code).emit('playerEliminated', { playerId, atWave: room.matchState.waveNumber });
    }
    if (matchEnd) {
      room.state = 'ended';
      stopMatch(room);
      io.to(room.code).emit('matchEnd', matchEnd);
    }
  }, config.TICK_MS);
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name } = {}, cb) => {
    const room = createRoom(socket.id);
    room.players.set(socket.id, { id: socket.id, name: (name || 'Player').slice(0, 16), faction: null, ready: false });
    socket.join(room.code);
    socket.data.roomCode = room.code;

    cb && cb({ ok: true, code: room.code, playerId: socket.id });
    broadcastLobby(io, room.code);
  });

  socket.on('joinRoom', ({ name, code } = {}, cb) => {
    const room = rooms.get((code || '').toUpperCase());
    if (!room) { cb && cb({ ok: false, error: 'Room not found' }); return; }
    if (room.state !== 'lobby') { cb && cb({ ok: false, error: 'Match already in progress' }); return; }
    if (room.players.size >= catalog.FACTIONS.length) { cb && cb({ ok: false, error: 'Room is full' }); return; }

    room.players.set(socket.id, { id: socket.id, name: (name || 'Player').slice(0, 16), faction: null, ready: false });
    socket.join(room.code);
    socket.data.roomCode = room.code;

    cb && cb({ ok: true, code: room.code, playerId: socket.id });
    broadcastLobby(io, room.code);
  });

  socket.on('selectFaction', ({ faction } = {}, cb) => {
    const room = getRoomOfSocket(socket);
    if (!room || room.state !== 'lobby') { cb && cb({ ok: false, error: 'Not in lobby' }); return; }
    if (!catalog.FACTIONS.includes(faction)) { cb && cb({ ok: false, error: 'Unknown faction' }); return; }
    if (room.factions[faction] && room.factions[faction] !== socket.id) {
      cb && cb({ ok: false, error: 'Faction already taken' });
      return;
    }
    const player = room.players.get(socket.id);
    if (!player) { cb && cb({ ok: false, error: 'Unknown player' }); return; }

    freePlayerFaction(room, socket.id);
    room.factions[faction] = socket.id;
    player.faction = faction;
    player.ready = false;

    cb && cb({ ok: true });
    broadcastLobby(io, room.code);
  });

  socket.on('toggleReady', () => {
    const room = getRoomOfSocket(socket);
    if (!room || room.state !== 'lobby') return;
    const player = room.players.get(socket.id);
    if (!player || !player.faction) return;
    player.ready = !player.ready;
    broadcastLobby(io, room.code);
  });

  socket.on('startMatch', () => {
    const room = getRoomOfSocket(socket);
    if (!room || room.state !== 'lobby') return;
    if (room.hostId !== socket.id) return;
    if (room.players.size !== catalog.FACTIONS.length) return;
    const players = Array.from(room.players.values());
    if (!players.every((p) => p.faction && p.ready)) return;

    room.state = 'countdown';
    const startAt = Date.now() + config.COUNTDOWN_MS;
    io.to(room.code).emit('matchCountdown', { startAt });

    room.countdownTimeout = setTimeout(() => {
      room.countdownTimeout = null;
      if (!rooms.has(room.code)) return;
      room.state = 'active';
      room.matchState = gameEngine.createMatchState(room);
      io.to(room.code).emit('matchStart', {
        startAt,
        players: players.map((p) => ({ id: p.id, name: p.name, faction: p.faction })),
        towerCatalog: catalog.TOWER_TYPES,
        enemyCatalog: catalog.ENEMY_TYPES,
        config: { startingGold: config.STARTING_GOLD, startingBaseHp: config.STARTING_BASE_HP, tickMs: config.TICK_MS },
      });
      startTickLoop(room);
    }, config.COUNTDOWN_MS);
  });

  socket.on('placeTower', ({ slotId, towerType } = {}, cb) => {
    const room = getRoomOfSocket(socket);
    if (!room || room.state !== 'active' || !room.matchState) { cb && cb({ ok: false, error: 'Match is not active' }); return; }
    const result = gameEngine.placeTower(room.matchState, socket.id, slotId, towerType);
    cb && cb(result);
  });

  socket.on('sendEnemy', ({ targetPlayerId, enemyType } = {}, cb) => {
    const room = getRoomOfSocket(socket);
    if (!room || room.state !== 'active' || !room.matchState) { cb && cb({ ok: false, error: 'Match is not active' }); return; }
    const result = gameEngine.sendEnemy(room.matchState, socket.id, targetPlayerId, enemyType);
    if (result.ok) {
      io.to(room.code).emit('enemySent', { fromPlayerId: socket.id, toPlayerId: targetPlayerId, enemyType });
    }
    cb && cb(result);
  });

  socket.on('backToLobby', () => {
    const room = getRoomOfSocket(socket);
    if (!room) return;
    resetToLobby(room);
    broadcastLobby(io, room.code);
  });

  socket.on('disconnect', () => {
    const room = getRoomOfSocket(socket);
    if (!room) return;

    if (room.state === 'lobby' || room.state === 'countdown') {
      const wasCountdown = room.state === 'countdown';
      freePlayerFaction(room, socket.id);
      room.players.delete(socket.id);
      if (wasCountdown) resetToLobby(room);

      if (room.players.size === 0) {
        stopMatch(room);
        rooms.delete(room.code);
        return;
      }
      if (room.hostId === socket.id) {
        room.hostId = room.players.keys().next().value;
      }
      broadcastLobby(io, room.code);
      return;
    }

    if (room.state === 'active' && room.matchState) {
      const { newlyEliminated, matchEnd } = gameEngine.forceEliminate(room.matchState, socket.id);
      for (const playerId of newlyEliminated) {
        io.to(room.code).emit('playerEliminated', { playerId, atWave: room.matchState.waveNumber });
      }
      if (matchEnd) {
        room.state = 'ended';
        stopMatch(room);
        io.to(room.code).emit('matchEnd', matchEnd);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Paws & Claws Defense server running at http://localhost:${PORT}`);
});

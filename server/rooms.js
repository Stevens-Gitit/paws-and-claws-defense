const { FACTIONS } = require('./catalog');

/** rooms: code -> { players: Map(id -> playerState), state, hostId, factions, matchState, tickInterval } */
const rooms = new Map();

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom(hostSocketId) {
  const code = makeRoomCode();
  const factions = {};
  for (const f of FACTIONS) factions[f] = null;
  const room = {
    code,
    players: new Map(),
    state: 'lobby', // lobby | countdown | active | ended
    hostId: hostSocketId,
    factions,
    matchState: null,
    tickInterval: null,
  };
  rooms.set(code, room);
  return room;
}

function publicPlayers(room) {
  return Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    faction: p.faction,
    ready: p.ready,
    isHost: p.id === room.hostId,
  }));
}

function broadcastLobby(io, code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit('lobbyUpdate', { code, state: room.state, players: publicPlayers(room) });
}

function freePlayerFaction(room, playerId) {
  const player = room.players.get(playerId);
  if (player && player.faction && room.factions[player.faction] === playerId) {
    room.factions[player.faction] = null;
  }
  if (player) player.faction = null;
}

module.exports = {
  rooms,
  createRoom,
  publicPlayers,
  broadcastLobby,
  freePlayerFaction,
};

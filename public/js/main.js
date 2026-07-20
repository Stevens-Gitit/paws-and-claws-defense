import { renderFactionPicker, renderLobbyPlayers, updateLobbyControls } from './lobby.js';
import { createRenderer } from './render.js';
import { setupInput } from './input.js';
import { renderResults, showToast } from './results.js';

const el = (id) => document.getElementById(id);

const screens = {
  home: el('screen-home'),
  lobby: el('screen-lobby'),
  results: el('screen-results'),
};
const matchScreen = el('screen-match');
const countdownOverlay = el('overlay-countdown');
const countdownNumber = el('countdown-number');
const toastArea = el('toast-area');
const hudWave = el('hud-wave');
const hudGold = el('hud-gold');
const hudHp = el('hud-hp');

function showScreen(name) {
  for (const s of Object.values(screens)) s.classList.add('hidden');
  matchScreen.classList.add('hidden');
  countdownOverlay.classList.add('hidden');
  if (name === 'match') matchScreen.classList.remove('hidden');
  else if (name) screens[name].classList.remove('hidden');
}

const socket = io();

const appState = {
  playerId: null,
  roomCode: null,
  isHost: false,
  lobbyPlayers: [],
  matchPlayers: [],
  renderer: null,
};

showScreen('home');

// ---------- Home screen ----------
el('btn-create').addEventListener('click', () => {
  const name = el('input-name').value.trim() || 'Player';
  el('home-error').textContent = '';
  socket.emit('createRoom', { name }, (res) => {
    if (!res.ok) { el('home-error').textContent = res.error || 'Could not create room'; return; }
    appState.playerId = res.playerId;
    appState.roomCode = res.code;
  });
});

el('btn-join').addEventListener('click', () => {
  const name = el('input-name').value.trim() || 'Player';
  const code = el('input-code').value.trim().toUpperCase();
  el('home-error').textContent = '';
  if (!code) { el('home-error').textContent = 'Enter a room code'; return; }
  socket.emit('joinRoom', { name, code }, (res) => {
    if (!res.ok) { el('home-error').textContent = res.error || 'Could not join room'; return; }
    appState.playerId = res.playerId;
    appState.roomCode = res.code;
  });
});

// ---------- Lobby screen ----------
el('btn-ready').addEventListener('click', () => socket.emit('toggleReady'));
el('btn-start').addEventListener('click', () => socket.emit('startMatch'));
el('btn-rematch').addEventListener('click', () => socket.emit('backToLobby'));

function renderLobby() {
  el('lobby-code').textContent = appState.roomCode || '';
  renderFactionPicker(el('faction-picker'), appState.lobbyPlayers, appState.playerId, socket);
  renderLobbyPlayers(el('lobby-players'), appState.lobbyPlayers, appState.playerId);
  updateLobbyControls({
    readyBtn: el('btn-ready'),
    startBtn: el('btn-start'),
    hintEl: el('lobby-hint'),
    players: appState.lobbyPlayers,
    localPlayerId: appState.playerId,
    isHost: appState.isHost,
  });
}

// ---------- Socket events ----------
socket.on('lobbyUpdate', ({ code, state, players }) => {
  appState.roomCode = code;
  appState.lobbyPlayers = players;
  const me = players.find((p) => p.id === appState.playerId);
  appState.isHost = !!(me && me.isHost);

  if (state === 'lobby') {
    showScreen('lobby');
    renderLobby();
  }
});

socket.on('matchCountdown', ({ startAt }) => {
  showScreen(null);
  countdownOverlay.classList.remove('hidden');

  const tick = () => {
    const remaining = Math.ceil((startAt - Date.now()) / 1000);
    if (remaining <= 0) {
      countdownNumber.textContent = 'GO!';
      setTimeout(() => countdownOverlay.classList.add('hidden'), 500);
      return;
    }
    countdownNumber.textContent = String(remaining);
    setTimeout(tick, 200);
  };
  tick();
});

socket.on('matchStart', ({ players, towerCatalog, enemyCatalog, config }) => {
  appState.matchPlayers = players;
  showScreen('match');

  const canvas = el('td-canvas');
  appState.renderer = createRenderer(canvas, players);

  setupInput({
    canvas,
    renderer: appState.renderer,
    localPlayerId: appState.playerId,
    towerCatalog,
    enemyCatalog,
    players,
    socket,
    buildMenuEl: el('build-menu'),
    sendMenuEl: el('send-menu'),
    onToast: (msg) => showToast(toastArea, msg),
  });

  hudWave.textContent = 'Wave 0';
  hudGold.textContent = `💰 ${config.startingGold}`;
  hudHp.textContent = `❤️ ${config.startingBaseHp}`;
});

socket.on('stateTick', (snapshot) => {
  if (!appState.renderer) return;
  appState.renderer.draw(snapshot);

  hudWave.textContent = `Wave ${snapshot.waveNumber}`;
  const myLane = snapshot.lanes.find((l) => l.playerId === appState.playerId);
  if (myLane) {
    hudGold.textContent = `💰 ${myLane.gold}`;
    hudHp.textContent = `❤️ ${myLane.baseHp}`;
  }
});

socket.on('enemySent', ({ fromPlayerId, toPlayerId, enemyType }) => {
  const fromName = appState.matchPlayers.find((p) => p.id === fromPlayerId)?.name || '?';
  const toName = appState.matchPlayers.find((p) => p.id === toPlayerId)?.name || '?';
  const isMeSender = fromPlayerId === appState.playerId;
  const isMeTarget = toPlayerId === appState.playerId;
  const label = isMeSender ? `You sent a ${enemyType} at ${toName}!` : isMeTarget ? `${fromName} sent a ${enemyType} at you!` : `${fromName} sent a ${enemyType} at ${toName}`;
  showToast(toastArea, label);
});

socket.on('playerEliminated', ({ playerId }) => {
  const name = appState.matchPlayers.find((p) => p.id === playerId)?.name || '?';
  showToast(toastArea, playerId === appState.playerId ? 'You were eliminated!' : `${name} was eliminated!`);
});

socket.on('matchEnd', (matchEnd) => {
  showScreen('results');
  renderResults(el('results-list'), matchEnd, appState.playerId);
});

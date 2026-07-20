import { FACTION_INFO } from './layout.js';

const FACTIONS = ['cat', 'rat', 'dog'];

export function renderFactionPicker(container, players, localPlayerId, socket) {
  container.innerHTML = FACTIONS.map((f) => {
    const info = FACTION_INFO[f];
    const owner = players.find((p) => p.faction === f);
    const mine = owner && owner.id === localPlayerId;
    const taken = owner && !mine;
    const classes = ['faction-btn', mine ? 'mine' : '', taken ? 'taken' : ''].filter(Boolean).join(' ');
    return `
      <button type="button" class="${classes}" data-faction="${f}" ${taken ? 'disabled' : ''}>
        <span class="emoji">${info.emoji}</span>
        ${info.name}
        ${owner ? `<span class="taken-by">${escapeHtml(owner.name)}${mine ? ' (you)' : ''}</span>` : ''}
      </button>
    `;
  }).join('');

  container.querySelectorAll('[data-faction]').forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => {
      socket.emit('selectFaction', { faction: btn.dataset.faction }, () => {});
    });
  });
}

export function renderLobbyPlayers(container, players, localPlayerId) {
  container.innerHTML = players.map((p) => {
    const info = p.faction ? FACTION_INFO[p.faction] : null;
    return `
      <li>
        <span>${info ? info.emoji : '❔'}</span>
        <span>${escapeHtml(p.name)}${p.id === localPlayerId ? ' (You)' : ''}</span>
        ${p.isHost ? '<span class="tag">HOST</span>' : ''}
        <span class="tag ${p.ready ? 'ready-yes' : ''}">${p.ready ? 'READY' : 'NOT READY'}</span>
      </li>
    `;
  }).join('');
}

export function updateLobbyControls({ readyBtn, startBtn, hintEl, players, localPlayerId, isHost }) {
  const me = players.find((p) => p.id === localPlayerId);
  readyBtn.disabled = !me || !me.faction;
  readyBtn.textContent = me && me.ready ? 'Not Ready' : 'Ready';

  const allSet = players.length >= 1 && players.every((p) => p.faction && p.ready);
  const canGrow = players.length < 3;
  const modeLabel = players.length === 1 ? 'solo' : players.length === 2 ? '2-player' : '3-player';

  if (isHost) {
    startBtn.classList.remove('hidden');
    startBtn.disabled = !allSet;
    hintEl.textContent = !allSet
      ? 'Waiting for everyone to pick a faction and ready up...'
      : canGrow
        ? `Ready for a ${modeLabel} match — start now, or wait for up to ${3 - players.length} more to join.`
        : 'All set — start the match!';
  } else {
    startBtn.classList.add('hidden');
    hintEl.textContent = !allSet
      ? 'Waiting for everyone to pick a faction and ready up...'
      : canGrow
        ? `Ready for a ${modeLabel} match — waiting for the host to start (or for more players to join).`
        : 'Waiting for host to start the match...';
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

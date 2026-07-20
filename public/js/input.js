import { TOWER_EMOJI, ENEMY_EMOJI, FACTION_INFO } from './layout.js';

const SLOT_CLICK_TOLERANCE = 26;

export function setupInput({ canvas, renderer, localPlayerId, towerCatalog, enemyCatalog, players, socket, buildMenuEl, sendMenuEl, onToast }) {
  let selectedTowerType = Object.keys(towerCatalog)[0];
  let selectedEnemyType = Object.keys(enemyCatalog)[0];
  let selectedTargetId = players.find((p) => p.id !== localPlayerId)?.id || null;

  function canvasCoordsFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  canvas.addEventListener('click', (e) => {
    const { x, y } = canvasCoordsFromEvent(e);
    const slots = renderer.getSlotsForPlayer(localPlayerId);
    if (!slots) return;
    let closest = null;
    let closestDist = Infinity;
    for (const slot of slots) {
      const dx = slot.x - x;
      const dy = slot.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) { closestDist = dist; closest = slot; }
    }
    if (!closest || closestDist > SLOT_CLICK_TOLERANCE) return;

    socket.emit('placeTower', { slotId: closest.id, towerType: selectedTowerType }, (res) => {
      if (!res.ok) onToast(res.error || 'Could not place tower');
    });
  });

  function renderBuildMenu() {
    buildMenuEl.innerHTML = '<h3>Build</h3>' + Object.values(towerCatalog).map((t) => `
      <button type="button" class="catalog-btn${t.id === selectedTowerType ? ' selected' : ''}" data-tower="${t.id}">
        <span class="emoji">${TOWER_EMOJI[t.id] || '❔'}</span>
        <span class="info"><span>${t.name}</span><span class="cost">💰 ${t.cost}</span></span>
      </button>
    `).join('');
    buildMenuEl.querySelectorAll('[data-tower]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedTowerType = btn.dataset.tower;
        renderBuildMenu();
      });
    });
  }

  function renderSendMenu() {
    const opponents = players.filter((p) => p.id !== localPlayerId);
    if (opponents.length === 0) {
      sendMenuEl.innerHTML = '<h3>Send at</h3><p class="hint">Playing solo — no opponents to send pests at.</p>';
      return;
    }

    const targetOptions = opponents.map((p) => {
      const faction = FACTION_INFO[p.faction] || { emoji: '❔' };
      return `<button type="button" class="catalog-btn${p.id === selectedTargetId ? ' selected' : ''}" data-target="${p.id}">
        <span class="emoji">${faction.emoji}</span><span class="info"><span>${p.name}</span></span>
      </button>`;
    }).join('');

    const enemyOptions = Object.values(enemyCatalog).map((e) => `
      <button type="button" class="catalog-btn${e.id === selectedEnemyType ? ' selected' : ''}" data-enemy="${e.id}">
        <span class="emoji">${ENEMY_EMOJI[e.id] || '❔'}</span>
        <span class="info"><span>${e.name}</span><span class="cost">💰 ${e.sendCost}</span></span>
      </button>
    `).join('');

    sendMenuEl.innerHTML = `<h3>Send at</h3>${targetOptions}<h3>Send enemy</h3>${enemyOptions}
      <button type="button" id="btn-send-enemy" class="btn primary">Send!</button>`;

    sendMenuEl.querySelectorAll('[data-target]').forEach((btn) => {
      btn.addEventListener('click', () => { selectedTargetId = btn.dataset.target; renderSendMenu(); });
    });
    sendMenuEl.querySelectorAll('[data-enemy]').forEach((btn) => {
      btn.addEventListener('click', () => { selectedEnemyType = btn.dataset.enemy; renderSendMenu(); });
    });
    const sendBtn = sendMenuEl.querySelector('#btn-send-enemy');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        if (!selectedTargetId) { onToast('No opponent to target'); return; }
        socket.emit('sendEnemy', { targetPlayerId: selectedTargetId, enemyType: selectedEnemyType }, (res) => {
          if (!res.ok) onToast(res.error || 'Could not send enemy');
        });
      });
    }
  }

  renderBuildMenu();
  renderSendMenu();
}

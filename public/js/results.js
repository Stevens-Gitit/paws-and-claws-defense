import { FACTION_INFO } from './layout.js';

export function renderResults(container, matchEnd, localPlayerId) {
  const sorted = [...matchEnd.results].sort((a, b) => a.placement - b.placement);
  container.innerHTML = sorted.map((r) => {
    const info = FACTION_INFO[r.faction] || { emoji: '❔' };
    return `
      <li>
        <span>${info.emoji}</span>
        <span>${escapeHtml(r.name)}${r.playerId === localPlayerId ? ' (You)' : ''}</span>
        <span class="tag">#${r.placement}${r.placement === 1 ? ' 🏆' : ''}</span>
      </li>
    `;
  }).join('');
}

export function showToast(toastAreaEl, message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toastAreaEl.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

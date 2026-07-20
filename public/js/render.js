import { CANVAS, computeAbsoluteWaypoints, computeAbsoluteSlots, FACTION_INFO, ENEMY_EMOJI, TOWER_EMOJI } from './layout.js';

export function createRenderer(canvas, players) {
  const ctx = canvas.getContext('2d');
  canvas.width = CANVAS.W;
  canvas.height = CANVAS.H;

  const laneIndexByPlayer = new Map();
  const waypointsByPlayer = new Map();
  const slotsByPlayer = new Map();
  const nameByPlayer = new Map();

  players.forEach((p, i) => {
    laneIndexByPlayer.set(p.id, i);
    waypointsByPlayer.set(p.id, computeAbsoluteWaypoints(i));
    slotsByPlayer.set(p.id, computeAbsoluteSlots(i));
    nameByPlayer.set(p.id, p.name);
  });

  function strokePath(waypoints, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    waypoints.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }

  function drawSlots(slots, laneSnapshot) {
    for (const slot of slots) {
      if (laneSnapshot.towers.some((t) => t.slotId === slot.id)) continue;
      ctx.beginPath();
      ctx.arc(slot.x, slot.y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawTowers(slots, laneSnapshot, color) {
    for (const tower of laneSnapshot.towers) {
      const slot = slots.find((s) => s.id === tower.slotId);
      if (!slot) continue;
      ctx.beginPath();
      ctx.arc(slot.x, slot.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#1c2333';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TOWER_EMOJI[tower.type] || '?', slot.x, slot.y);

      if (tower.cooldownPct > 0) {
        ctx.beginPath();
        ctx.moveTo(slot.x, slot.y);
        ctx.arc(slot.x, slot.y, 22, -Math.PI / 2, -Math.PI / 2 + tower.cooldownPct * Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fill();
      }
    }
  }

  function drawEnemies(laneSnapshot) {
    for (const enemy of laneSnapshot.enemies) {
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ENEMY_EMOJI[enemy.type] || '?', enemy.x, enemy.y);

      const barWidth = 26;
      const pct = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(enemy.x - barWidth / 2, enemy.y - 20, barWidth, 4);
      ctx.fillStyle = pct > 0.5 ? '#06d6a0' : pct > 0.25 ? '#ffd166' : '#ff6b6b';
      ctx.fillRect(enemy.x - barWidth / 2, enemy.y - 20, barWidth * pct, 4);

      if (enemy.sentBy) {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText('!', enemy.x + 14, enemy.y - 14);
      }
    }
  }

  function drawBase(waypoints, laneSnapshot, color) {
    const base = waypoints[waypoints.length - 1];
    ctx.beginPath();
    ctx.arc(base.x, base.y, 24, 0, Math.PI * 2);
    ctx.fillStyle = laneSnapshot.eliminated ? '#3a1a1a' : '#1c2333';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ebebf5';
    ctx.textAlign = 'center';
    ctx.fillText(nameByPlayer.get(laneSnapshot.playerId) || '?', base.x, base.y + 44);

    const pct = Math.max(0, laneSnapshot.baseHp / laneSnapshot.maxBaseHp);
    const barWidth = 60;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(base.x - barWidth / 2, base.y + 30, barWidth, 6);
    ctx.fillStyle = pct > 0.5 ? '#06d6a0' : pct > 0.25 ? '#ffd166' : '#ff6b6b';
    ctx.fillRect(base.x - barWidth / 2, base.y + 30, barWidth * pct, 6);

    if (laneSnapshot.eliminated) {
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('ELIMINATED', base.x, base.y - 34);
    }
  }

  function drawShots(shots) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    for (const shot of shots) {
      ctx.beginPath();
      ctx.moveTo(shot.fromX, shot.fromY);
      ctx.lineTo(shot.toX, shot.toY);
      ctx.stroke();
    }
  }

  function draw(snapshot) {
    ctx.clearRect(0, 0, CANVAS.W, CANVAS.H);
    ctx.fillStyle = '#16241a';
    ctx.fillRect(0, 0, CANVAS.W, CANVAS.H);

    for (const laneSnapshot of snapshot.lanes) {
      const waypoints = waypointsByPlayer.get(laneSnapshot.playerId);
      const slots = slotsByPlayer.get(laneSnapshot.playerId);
      if (!waypoints || !slots) continue;
      const faction = FACTION_INFO[laneSnapshot.faction] || { color: '#888888' };

      strokePath(waypoints, 26, 'rgba(255,255,255,0.15)');
      strokePath(waypoints, 20, '#4a3d2a');
      drawSlots(slots, laneSnapshot);
      drawTowers(slots, laneSnapshot, faction.color);
      drawEnemies(laneSnapshot);
      drawBase(waypoints, laneSnapshot, faction.color);
    }

    drawShots(snapshot.shots || []);
  }

  return {
    draw,
    getSlotsForPlayer: (playerId) => slotsByPlayer.get(playerId),
    getLaneIndexForPlayer: (playerId) => laneIndexByPlayer.get(playerId),
  };
}

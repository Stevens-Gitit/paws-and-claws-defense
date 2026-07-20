const config = require('./config');
const { TOWER_TYPES, ENEMY_TYPES, LANE_WAYPOINTS, TOWER_SLOTS, scaledEnemyHp, getWaveSpawnList } = require('./catalog');

function laneWidthFor(totalLanes) {
  return (config.CANVAS.W - config.LANE_GUTTER * (totalLanes + 1)) / totalLanes;
}

function laneLeftFor(laneIndex, totalLanes) {
  const laneWidth = laneWidthFor(totalLanes);
  return config.LANE_GUTTER + laneIndex * (laneWidth + config.LANE_GUTTER);
}

function computeAbsoluteWaypoints(laneIndex, totalLanes) {
  const laneLeft = laneLeftFor(laneIndex, totalLanes);
  const laneWidth = laneWidthFor(totalLanes);
  return LANE_WAYPOINTS.map((wp) => ({
    x: laneLeft + wp.x * laneWidth,
    y: wp.y * config.CANVAS.H,
  }));
}

function computeAbsoluteSlots(laneIndex, totalLanes) {
  const laneLeft = laneLeftFor(laneIndex, totalLanes);
  const laneWidth = laneWidthFor(totalLanes);
  return TOWER_SLOTS.map((s) => ({
    id: s.id,
    x: laneLeft + s.x * laneWidth,
    y: s.y * config.CANVAS.H,
  }));
}

function computePathMetrics(absWaypoints) {
  const cumDist = [0];
  let total = 0;
  for (let i = 1; i < absWaypoints.length; i++) {
    const dx = absWaypoints[i].x - absWaypoints[i - 1].x;
    const dy = absWaypoints[i].y - absWaypoints[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
    cumDist.push(total);
  }
  return { cumDist, totalLength: total };
}

function pointAtProgress(absWaypoints, cumDist, totalLength, progress) {
  const target = Math.max(0, Math.min(1, progress)) * totalLength;
  let i = 1;
  while (i < cumDist.length && cumDist[i] < target) i++;
  if (i >= absWaypoints.length) return absWaypoints[absWaypoints.length - 1];
  const segStart = cumDist[i - 1];
  const segLen = cumDist[i] - segStart || 1;
  const t = (target - segStart) / segLen;
  const a = absWaypoints[i - 1];
  const b = absWaypoints[i];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function createMatchState(room) {
  const playerIds = Array.from(room.players.keys());
  const totalLanes = playerIds.length;
  const lanes = {};
  playerIds.forEach((playerId, laneIndex) => {
    const player = room.players.get(playerId);
    const absWaypoints = computeAbsoluteWaypoints(laneIndex, totalLanes);
    const { cumDist, totalLength } = computePathMetrics(absWaypoints);
    lanes[playerId] = {
      playerId,
      faction: player.faction,
      name: player.name,
      laneIndex,
      baseHp: config.STARTING_BASE_HP,
      maxBaseHp: config.STARTING_BASE_HP,
      gold: config.STARTING_GOLD,
      eliminated: false,
      towers: [],
      enemies: [],
      spawnQueue: [],
      absWaypoints,
      cumDist,
      totalLength,
      slots: computeAbsoluteSlots(laneIndex, totalLanes),
    };
  });

  return {
    status: 'active',
    waveNumber: 0,
    waveClockMs: 0,
    tick: 0,
    lanes,
    resultsOrder: [],
    nextEnemyId: 1,
    nextTowerId: 1,
    shots: [],
  };
}

function placeTower(matchState, playerId, slotId, towerType) {
  if (matchState.status !== 'active') return { ok: false, error: 'Match is not active' };
  const lane = matchState.lanes[playerId];
  if (!lane) return { ok: false, error: 'Unknown player' };
  if (lane.eliminated) return { ok: false, error: 'You have been eliminated' };
  const towerDef = TOWER_TYPES[towerType];
  if (!towerDef) return { ok: false, error: 'Unknown tower type' };
  const slot = lane.slots.find((s) => s.id === slotId);
  if (!slot) return { ok: false, error: 'Unknown slot' };
  if (lane.towers.some((t) => t.slotId === slotId)) return { ok: false, error: 'Slot already occupied' };
  if (lane.gold < towerDef.cost) return { ok: false, error: 'Not enough gold' };

  lane.gold -= towerDef.cost;
  lane.towers.push({ id: matchState.nextTowerId++, slotId, type: towerType, cooldownRemainingMs: 0 });
  return { ok: true };
}

function sendEnemy(matchState, senderId, targetPlayerId, enemyType) {
  if (matchState.status !== 'active') return { ok: false, error: 'Match is not active' };
  const senderLane = matchState.lanes[senderId];
  const targetLane = matchState.lanes[targetPlayerId];
  if (!senderLane || !targetLane) return { ok: false, error: 'Unknown player' };
  if (senderLane.eliminated) return { ok: false, error: 'You have been eliminated' };
  if (targetLane.eliminated) return { ok: false, error: 'Target already eliminated' };
  if (senderId === targetPlayerId) return { ok: false, error: 'Cannot target yourself' };
  const enemyDef = ENEMY_TYPES[enemyType];
  if (!enemyDef) return { ok: false, error: 'Unknown enemy type' };
  if (senderLane.gold < enemyDef.sendCost) return { ok: false, error: 'Not enough gold' };

  senderLane.gold -= enemyDef.sendCost;
  const hp = scaledEnemyHp(enemyType, Math.max(1, matchState.waveNumber));
  targetLane.enemies.push({
    id: matchState.nextEnemyId++,
    type: enemyType,
    hp,
    maxHp: hp,
    progress: 0,
    x: targetLane.absWaypoints[0].x,
    y: targetLane.absWaypoints[0].y,
    sentBy: senderId,
  });
  return { ok: true };
}

function buildResults(matchState, winnerId) {
  const results = [];
  if (winnerId) results.push({ playerId: winnerId, placement: 1, survivedWave: matchState.waveNumber });
  const reversedEliminated = [...matchState.resultsOrder].reverse();
  const startPlacement = winnerId ? 2 : 1;
  reversedEliminated.forEach((entry, idx) => {
    results.push({ playerId: entry.playerId, placement: startPlacement + idx, survivedWave: entry.atWave });
  });
  return results.map((r) => {
    const lane = matchState.lanes[r.playerId];
    return { playerId: r.playerId, name: lane.name, faction: lane.faction, placement: r.placement, survivedWave: r.survivedWave };
  });
}

// A 1-player match has no opponent to "win" against, so it only ends when
// that player's own base falls — a survival run, not a last-standing contest.
function checkMatchEnd(matchState) {
  if (matchState.status !== 'active') return null;
  const totalPlayers = Object.keys(matchState.lanes).length;
  const alive = Object.values(matchState.lanes).filter((l) => !l.eliminated);
  const shouldEnd = totalPlayers === 1 ? alive.length === 0 : alive.length <= 1;
  if (!shouldEnd) return null;

  matchState.status = 'ended';
  const winnerId = alive.length === 1 ? alive[0].playerId : null;
  return { winnerId, results: buildResults(matchState, winnerId) };
}

function buildSnapshot(matchState) {
  return {
    tick: matchState.tick,
    waveNumber: matchState.waveNumber,
    matchStatus: matchState.status,
    lanes: Object.values(matchState.lanes).map((lane) => ({
      playerId: lane.playerId,
      faction: lane.faction,
      gold: lane.gold,
      baseHp: lane.baseHp,
      maxBaseHp: lane.maxBaseHp,
      eliminated: lane.eliminated,
      towers: lane.towers.map((t) => ({
        id: t.id,
        slotId: t.slotId,
        type: t.type,
        cooldownPct: Math.max(0, Math.min(1, t.cooldownRemainingMs / TOWER_TYPES[t.type].fireRateMs)),
      })),
      enemies: lane.enemies.map((e) => ({
        id: e.id, type: e.type, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, sentBy: e.sentBy,
      })),
    })),
    shots: matchState.shots,
  };
}

function tick(matchState) {
  if (matchState.status !== 'active') {
    return { snapshot: buildSnapshot(matchState), newlyEliminated: [], matchEnd: null };
  }

  matchState.tick += 1;
  matchState.waveClockMs += config.TICK_MS;
  matchState.shots = [];

  if (matchState.waveClockMs >= config.WAVE_INTERVAL_MS) {
    matchState.waveClockMs = 0;
    matchState.waveNumber += 1;
    for (const lane of Object.values(matchState.lanes)) {
      if (lane.eliminated) continue;
      lane.spawnQueue = getWaveSpawnList(matchState.waveNumber);
    }
  }

  const newlyEliminated = [];

  for (const lane of Object.values(matchState.lanes)) {
    if (lane.eliminated) continue;

    lane.spawnQueue = lane.spawnQueue.filter((entry) => {
      if (entry.spawnAtMs > matchState.waveClockMs) return true;
      const hp = scaledEnemyHp(entry.enemyType, matchState.waveNumber);
      lane.enemies.push({
        id: matchState.nextEnemyId++,
        type: entry.enemyType,
        hp,
        maxHp: hp,
        progress: 0,
        x: lane.absWaypoints[0].x,
        y: lane.absWaypoints[0].y,
        sentBy: null,
      });
      return false;
    });

    lane.enemies = lane.enemies.filter((enemy) => {
      const enemyDef = ENEMY_TYPES[enemy.type];
      const deltaProgress = (enemyDef.speed * (config.TICK_MS / 1000)) / lane.totalLength;
      enemy.progress += deltaProgress;
      if (enemy.progress >= 1) {
        lane.baseHp = Math.max(0, lane.baseHp - enemyDef.leakDamage);
        return false;
      }
      const pos = pointAtProgress(lane.absWaypoints, lane.cumDist, lane.totalLength, enemy.progress);
      enemy.x = pos.x;
      enemy.y = pos.y;
      return true;
    });

    for (const tower of lane.towers) {
      tower.cooldownRemainingMs -= config.TICK_MS;
      if (tower.cooldownRemainingMs > 0) continue;
      const towerDef = TOWER_TYPES[tower.type];
      const slot = lane.slots.find((s) => s.id === tower.slotId);

      let target = null;
      for (const enemy of lane.enemies) {
        const dx = enemy.x - slot.x;
        const dy = enemy.y - slot.y;
        if (Math.sqrt(dx * dx + dy * dy) <= towerDef.range) {
          if (!target || enemy.progress > target.progress) target = enemy;
        }
      }
      if (!target) continue;

      tower.cooldownRemainingMs = towerDef.fireRateMs;
      matchState.shots.push({ fromX: slot.x, fromY: slot.y, toX: target.x, toY: target.y, towerType: tower.type });

      target.hp -= towerDef.damage;
      if (towerDef.splashRadius) {
        for (const enemy of lane.enemies) {
          if (enemy === target) continue;
          const dx = enemy.x - target.x;
          const dy = enemy.y - target.y;
          if (Math.sqrt(dx * dx + dy * dy) <= towerDef.splashRadius) {
            enemy.hp -= towerDef.damage;
          }
        }
      }
    }

    lane.enemies = lane.enemies.filter((enemy) => {
      if (enemy.hp <= 0) {
        lane.gold += ENEMY_TYPES[enemy.type].bounty;
        return false;
      }
      return true;
    });

    if (lane.baseHp <= 0 && !lane.eliminated) {
      lane.eliminated = true;
      lane.enemies = [];
      lane.towers = [];
      matchState.resultsOrder.push({ playerId: lane.playerId, atWave: matchState.waveNumber });
      newlyEliminated.push(lane.playerId);
    }
  }

  const matchEnd = checkMatchEnd(matchState);

  return { snapshot: buildSnapshot(matchState), newlyEliminated, matchEnd };
}

function forceEliminate(matchState, playerId) {
  const lane = matchState.lanes[playerId];
  if (!lane || lane.eliminated) return { newlyEliminated: [], matchEnd: null };
  lane.baseHp = 0;
  lane.eliminated = true;
  lane.enemies = [];
  lane.towers = [];
  matchState.resultsOrder.push({ playerId, atWave: matchState.waveNumber });

  const matchEnd = checkMatchEnd(matchState);
  return { newlyEliminated: [playerId], matchEnd };
}

module.exports = {
  createMatchState,
  placeTower,
  sendEnemy,
  tick,
  forceEliminate,
};

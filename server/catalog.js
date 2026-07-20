const FACTIONS = ['cat', 'rat', 'dog'];

const FACTION_INFO = {
  cat: { emoji: '🐱', name: 'Cats', color: '#ff8c42' },
  rat: { emoji: '🐭', name: 'Rats', color: '#8a8d91' },
  dog: { emoji: '🐶', name: 'Dogs', color: '#b5651d' },
};

// Shared tower roster — identical stats for every faction, color is cosmetic only.
const TOWER_TYPES = {
  claw: { id: 'claw', name: 'Claw Turret', emoji: '🐾', cost: 50, damage: 8, range: 110, fireRateMs: 500 },
  sniper: { id: 'sniper', name: 'Whisker Sniper', emoji: '🎯', cost: 90, damage: 35, range: 220, fireRateMs: 1400 },
  yarn: { id: 'yarn', name: 'Yarn Bomb', emoji: '🧶', cost: 120, damage: 18, range: 90, fireRateMs: 900, splashRadius: 45 },
};

// Neutral "pest" enemies — not tied to any player faction.
const ENEMY_TYPES = {
  bug: { id: 'bug', name: 'Bug Swarm', emoji: '🐛', baseHp: 18, speed: 100, leakDamage: 1, bounty: 4, sendCost: 15 },
  cricket: { id: 'cricket', name: 'Cricket Horde', emoji: '🦗', baseHp: 45, speed: 65, leakDamage: 2, bounty: 8, sendCost: 30 },
  beetle: { id: 'beetle', name: 'Beetle Tank', emoji: '🪲', baseHp: 120, speed: 40, leakDamage: 5, bounty: 18, sendCost: 60 },
};

// Normalized (0..1) waypoints within a lane's local box. y:0 = spawn (top), y:1 = base (bottom).
// Shared shape, reused per lane — must match public/js/layout.js
const LANE_WAYPOINTS = [
  { x: 0.5, y: 0.00 },
  { x: 0.5, y: 0.15 },
  { x: 0.15, y: 0.15 },
  { x: 0.15, y: 0.40 },
  { x: 0.85, y: 0.40 },
  { x: 0.85, y: 0.65 },
  { x: 0.20, y: 0.65 },
  { x: 0.20, y: 0.85 },
  { x: 0.5, y: 0.85 },
  { x: 0.5, y: 1.00 },
];

// Fixed build slots (normalized), placed off the path line with clearance.
// must match public/js/layout.js
const TOWER_SLOTS = [
  { id: 0, x: 0.78, y: 0.08 },
  { id: 1, x: 0.28, y: 0.08 },
  { id: 2, x: 0.40, y: 0.25 },
  { id: 3, x: 0.70, y: 0.22 },
  { id: 4, x: 0.50, y: 0.30 },
  { id: 5, x: 0.55, y: 0.50 },
  { id: 6, x: 0.35, y: 0.48 },
  { id: 7, x: 0.50, y: 0.55 },
  { id: 8, x: 0.42, y: 0.75 },
  { id: 9, x: 0.68, y: 0.72 },
  { id: 10, x: 0.80, y: 0.85 },
  { id: 11, x: 0.35, y: 0.94 },
];

function scaledEnemyHp(enemyType, waveNumber) {
  const base = ENEMY_TYPES[enemyType].baseHp;
  return Math.round(base * (1 + 0.18 * (waveNumber - 1)));
}

// Generates one lane's spawn schedule for a given wave — same composition for every lane (fairness).
function getWaveSpawnList(waveNumber) {
  const count = 4 + waveNumber;
  const list = [];
  for (let i = 0; i < count; i++) {
    let enemyType = 'bug';
    if (waveNumber >= 6 && i % 4 === 3) enemyType = 'beetle';
    else if (waveNumber >= 3 && i % 2 === 1) enemyType = 'cricket';
    list.push({ enemyType, spawnAtMs: i * 600 });
  }
  return list;
}

module.exports = {
  FACTIONS,
  FACTION_INFO,
  TOWER_TYPES,
  ENEMY_TYPES,
  LANE_WAYPOINTS,
  TOWER_SLOTS,
  scaledEnemyHp,
  getWaveSpawnList,
};

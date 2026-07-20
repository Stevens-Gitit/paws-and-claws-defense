// Client mirror of server/catalog.js + server/config.js geometry — cosmetic/hit-testing only,
// no balance numbers live here. Keep in sync with the server if the path/slots ever change.

export const CANVAS = { W: 1200, H: 760 };
export const LANE_WIDTH = 380;
export const LANE_GUTTER = 30;
export const LANE_COUNT = 3;

export const LANE_WAYPOINTS = [
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

export const TOWER_SLOTS = [
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

export const FACTION_INFO = {
  cat: { emoji: '🐱', name: 'Cats', color: '#ff8c42' },
  rat: { emoji: '🐭', name: 'Rats', color: '#8a8d91' },
  dog: { emoji: '🐶', name: 'Dogs', color: '#b5651d' },
};

export const ENEMY_EMOJI = { bug: '🐛', cricket: '🦗', beetle: '🪲' };
export const TOWER_EMOJI = { claw: '🐾', sniper: '🎯', yarn: '🧶' };

export function laneLeftFor(laneIndex) {
  return LANE_GUTTER + laneIndex * (LANE_WIDTH + LANE_GUTTER);
}

export function computeAbsoluteWaypoints(laneIndex) {
  const laneLeft = laneLeftFor(laneIndex);
  return LANE_WAYPOINTS.map((wp) => ({ x: laneLeft + wp.x * LANE_WIDTH, y: wp.y * CANVAS.H }));
}

export function computeAbsoluteSlots(laneIndex) {
  const laneLeft = laneLeftFor(laneIndex);
  return TOWER_SLOTS.map((s) => ({ id: s.id, x: laneLeft + s.x * LANE_WIDTH, y: s.y * CANVAS.H }));
}

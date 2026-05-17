'use strict';

const { SKIN_RARITY, SKIN_PATTERNS, EYE_STYLES, UNLOCK_KIND, createSkin } = require('./skins');
const { LAYOUT_DIFFICULTY, createObstacleLayout } = require('./obstacles');
const { GAME_MODE } = require('./modes');

// Built-in catalog data. Kept declarative so the catalog can be loaded from
// JSON later without touching the entity factories.

const SEED_SKINS = [
  {
    id: 'classic-green',
    name: 'Classic',
    description: 'The original. Bright apple green.',
    primaryColor: '#3aa856',
    secondaryColor: '#2c7a3f',
    pattern: SKIN_PATTERNS.SOLID,
    eyeStyle: EYE_STYLES.ROUND,
    rarity: SKIN_RARITY.COMMON,
    unlock: { kind: UNLOCK_KIND.DEFAULT },
    headColor: '#2c7a3f',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Cool, slim, hard to see in the dark.',
    primaryColor: '#1f2933',
    secondaryColor: '#3e4c59',
    pattern: SKIN_PATTERNS.GRADIENT,
    eyeStyle: EYE_STYLES.SLIT,
    rarity: SKIN_RARITY.RARE,
    unlock: { kind: UNLOCK_KIND.GAMES, games: 5 },
    headColor: '#0b0f14',
    accentColor: '#8a99a8',
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Burns through obstacle mode. Earned by clearing maps.',
    primaryColor: '#f76b1c',
    secondaryColor: '#fad961',
    pattern: SKIN_PATTERNS.GRADIENT,
    eyeStyle: EYE_STYLES.ANGRY,
    rarity: SKIN_RARITY.EPIC,
    unlock: { kind: UNLOCK_KIND.OBSTACLE_CLEAR, clears: 3 },
    headColor: '#c53b14',
    accentColor: '#ffd24c',
  },
  {
    id: 'reef',
    name: 'Reef',
    description: 'Calm striped pattern in coral and teal.',
    primaryColor: '#0fb5ba',
    secondaryColor: '#ff6f91',
    pattern: SKIN_PATTERNS.STRIPED,
    eyeStyle: EYE_STYLES.SLEEPY,
    rarity: SKIN_RARITY.RARE,
    unlock: { kind: UNLOCK_KIND.SCORE, score: 500 },
    headColor: '#067a7e',
    accentColor: '#ff9bb3',
  },
  {
    id: 'cyber',
    name: 'Cyberscale',
    description: 'Neon scales, slit pupils, built for high scores.',
    primaryColor: '#7c3aed',
    secondaryColor: '#22d3ee',
    pattern: SKIN_PATTERNS.SCALE,
    eyeStyle: EYE_STYLES.CYBER,
    rarity: SKIN_RARITY.LEGENDARY,
    unlock: { kind: UNLOCK_KIND.SCORE, score: 2000, mode: GAME_MODE.OBSTACLE },
    headColor: '#4c1d95',
    accentColor: '#7dd3fc',
  },
  {
    id: 'snowdrop',
    name: 'Snowdrop',
    description: 'Bright white scales with a faint blue underbelly.',
    primaryColor: '#f3f4f6',
    secondaryColor: '#bae6fd',
    pattern: SKIN_PATTERNS.DOTTED,
    eyeStyle: EYE_STYLES.ROUND,
    rarity: SKIN_RARITY.COMMON,
    unlock: { kind: UNLOCK_KIND.GAMES, games: 1 },
    headColor: '#e5e7eb',
  },
  {
    id: 'mosaic',
    name: 'Mosaic',
    description: 'Checkerboard pattern. Surprisingly hard to spot.',
    primaryColor: '#facc15',
    secondaryColor: '#1f2937',
    pattern: SKIN_PATTERNS.CHECKER,
    eyeStyle: EYE_STYLES.ROUND,
    rarity: SKIN_RARITY.RARE,
    unlock: { kind: UNLOCK_KIND.OBSTACLE_CLEAR, clears: 1 },
    headColor: '#eab308',
  },
];

// Obstacle layouts. Each layout assumes a board of `boardHint` size. The
// runtime will resize the board to fit when launching a session in obstacle
// mode. Tiny ASCII shapes make these easy to eyeball.

function rect(x, y, w, h) {
  const cells = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      cells.push({ x: x + dx, y: y + dy });
    }
  }
  return cells;
}

function hLine(x, y, length) {
  const cells = [];
  for (let i = 0; i < length; i++) cells.push({ x: x + i, y });
  return cells;
}

function vLine(x, y, length) {
  const cells = [];
  for (let i = 0; i < length; i++) cells.push({ x, y: y + i });
  return cells;
}

const SEED_OBSTACLE_LAYOUTS = [
  {
    id: 'open-pillars',
    name: 'Open Pillars',
    description: 'Four small pillars in the open field. Gentle intro to obstacles.',
    difficulty: LAYOUT_DIFFICULTY.EASY,
    boardHint: { width: 20, height: 20 },
    obstacles: [
      { id: 'p1', kind: 'block', cells: rect(5, 5, 1, 1), label: 'Pillar NW' },
      { id: 'p2', kind: 'block', cells: rect(14, 5, 1, 1), label: 'Pillar NE' },
      { id: 'p3', kind: 'block', cells: rect(5, 14, 1, 1), label: 'Pillar SW' },
      { id: 'p4', kind: 'block', cells: rect(14, 14, 1, 1), label: 'Pillar SE' },
    ],
    spawnSafeZone: rect(8, 8, 4, 4),
    tags: ['symmetric', 'starter'],
  },
  {
    id: 'corridor',
    name: 'Corridor',
    description: 'Long horizontal walls form a tight corridor through the middle.',
    difficulty: LAYOUT_DIFFICULTY.MEDIUM,
    boardHint: { width: 24, height: 18 },
    obstacles: [
      { id: 'top', kind: 'wall', cells: hLine(4, 7, 16), label: 'Top wall' },
      { id: 'bot', kind: 'wall', cells: hLine(4, 10, 16), label: 'Bottom wall' },
    ],
    spawnSafeZone: rect(10, 8, 4, 2),
    tags: ['horizontal'],
  },
  {
    id: 'fortress',
    name: 'Fortress',
    description: 'Closed inner ring with two narrow gaps.',
    difficulty: LAYOUT_DIFFICULTY.HARD,
    boardHint: { width: 24, height: 24 },
    obstacles: [
      { id: 'n', kind: 'wall', cells: hLine(6, 6, 12) },
      {
        id: 's',
        kind: 'wall',
        cells: [
          ...hLine(6, 17, 5),
          ...hLine(13, 17, 5),
        ],
      },
      { id: 'w', kind: 'wall', cells: vLine(6, 6, 12) },
      { id: 'e', kind: 'wall', cells: vLine(17, 6, 12) },
    ],
    spawnSafeZone: rect(10, 10, 4, 4),
    tags: ['enclosed', 'symmetric'],
  },
  {
    id: 'crosshair',
    name: 'Crosshair',
    description: 'Four crossing barriers leave only diagonals to ride.',
    difficulty: LAYOUT_DIFFICULTY.HARD,
    boardHint: { width: 22, height: 22 },
    obstacles: [
      { id: 'h-top', kind: 'wall', cells: hLine(3, 8, 16) },
      { id: 'h-bot', kind: 'wall', cells: hLine(3, 13, 16) },
      { id: 'v-left', kind: 'wall', cells: vLine(8, 3, 16) },
      { id: 'v-right', kind: 'wall', cells: vLine(13, 3, 16) },
    ],
    spawnSafeZone: rect(10, 10, 2, 2),
    tags: ['symmetric'],
  },
  {
    id: 'maze',
    name: 'Maze',
    description: 'Staggered walls; only the patient survive.',
    difficulty: LAYOUT_DIFFICULTY.INSANE,
    boardHint: { width: 26, height: 26 },
    obstacles: [
      { id: 'a', kind: 'wall', cells: hLine(2, 5, 10) },
      { id: 'b', kind: 'wall', cells: hLine(14, 8, 10) },
      { id: 'c', kind: 'wall', cells: hLine(4, 12, 14) },
      { id: 'd', kind: 'wall', cells: hLine(8, 16, 14) },
      { id: 'e', kind: 'wall', cells: hLine(2, 20, 12) },
      { id: 'f', kind: 'wall', cells: vLine(7, 6, 4) },
      { id: 'g', kind: 'wall', cells: vLine(18, 12, 5) },
    ],
    spawnSafeZone: rect(11, 1, 4, 3),
    tags: ['maze', 'expert'],
  },
];

function buildSeedSkins() {
  return SEED_SKINS.map(createSkin);
}

function buildSeedObstacleLayouts() {
  return SEED_OBSTACLE_LAYOUTS.map(createObstacleLayout);
}

module.exports = {
  SEED_SKINS,
  SEED_OBSTACLE_LAYOUTS,
  buildSeedSkins,
  buildSeedObstacleLayouts,
};

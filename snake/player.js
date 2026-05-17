'use strict';

const { ValidationError } = require('./errors');

// Player profile entity. Stored locally for offline play; uploadable to the
// backend in the future. Tracks identity, equipped skin, unlocked content, and
// aggregate stats used by skin unlock rules.

const DEFAULT_PLAYER_ID = 'local';
const DEFAULT_PLAYER_NAME = 'Player';

function createPlayer(input) {
  const opts = input || {};
  return {
    id: opts.id || DEFAULT_PLAYER_ID,
    name: opts.name || DEFAULT_PLAYER_NAME,
    equippedSkinId: opts.equippedSkinId || 'classic-green',
    unlockedSkinIds: dedupe(opts.unlockedSkinIds || ['classic-green']),
    purchasedSkinIds: dedupe(opts.purchasedSkinIds || []),
    completedObstacleLayoutIds: dedupe(opts.completedObstacleLayoutIds || []),
    stats: createStats(opts.stats),
    preferences: createPreferences(opts.preferences),
    createdAt: opts.createdAt || Date.now(),
    updatedAt: opts.updatedAt || Date.now(),
  };
}

function createStats(input) {
  const s = input || {};
  return {
    gamesPlayed: int(s.gamesPlayed),
    bestScore: int(s.bestScore),
    totalScore: int(s.totalScore),
    longestSnake: int(s.longestSnake),
    obstacleClears: int(s.obstacleClears),
    bestScoresByMode: { ...(s.bestScoresByMode || {}) },
    foodEatenTotal: int(s.foodEatenTotal),
  };
}

function createPreferences(input) {
  const p = input || {};
  return {
    soundEnabled: p.soundEnabled !== false,
    musicEnabled: p.musicEnabled !== false,
    showGrid: !!p.showGrid,
    reducedMotion: !!p.reducedMotion,
    controls: p.controls === 'wasd' ? 'wasd' : 'arrows',
    theme: p.theme === 'light' ? 'light' : 'dark',
  };
}

function int(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function dedupe(arr) {
  return Array.from(new Set(Array.isArray(arr) ? arr : []));
}

// ---- Pure update helpers --------------------------------------------------

function setEquippedSkin(player, skinId) {
  if (typeof skinId !== 'string' || !skinId) {
    throw new ValidationError('skinId is required to equip');
  }
  if (!player.unlockedSkinIds.includes(skinId)) {
    throw new ValidationError(`skin ${skinId} is not unlocked for this player`);
  }
  return { ...player, equippedSkinId: skinId, updatedAt: Date.now() };
}

function unlockSkin(player, skinId) {
  if (typeof skinId !== 'string' || !skinId) {
    throw new ValidationError('skinId is required to unlock');
  }
  if (player.unlockedSkinIds.includes(skinId)) return player;
  return {
    ...player,
    unlockedSkinIds: [...player.unlockedSkinIds, skinId],
    updatedAt: Date.now(),
  };
}

function recordObstacleClear(player, layoutId) {
  if (typeof layoutId !== 'string' || !layoutId) return player;
  const already = player.completedObstacleLayoutIds.includes(layoutId);
  return {
    ...player,
    completedObstacleLayoutIds: already
      ? player.completedObstacleLayoutIds
      : [...player.completedObstacleLayoutIds, layoutId],
    stats: {
      ...player.stats,
      obstacleClears: player.stats.obstacleClears + 1,
    },
    updatedAt: Date.now(),
  };
}

function recordGameFinished(player, summary) {
  const s = summary || {};
  const stats = player.stats;
  const mode = s.mode;
  const score = int(s.score);
  const snakeLength = int(s.snakeLength);
  const bestByMode = { ...stats.bestScoresByMode };
  if (mode) {
    bestByMode[mode] = Math.max(bestByMode[mode] || 0, score);
  }
  return {
    ...player,
    stats: {
      gamesPlayed: stats.gamesPlayed + 1,
      bestScore: Math.max(stats.bestScore, score),
      totalScore: stats.totalScore + score,
      longestSnake: Math.max(stats.longestSnake, snakeLength),
      obstacleClears: stats.obstacleClears,
      bestScoresByMode: bestByMode,
      foodEatenTotal: stats.foodEatenTotal + int(s.foodEaten),
    },
    updatedAt: Date.now(),
  };
}

function setPreferences(player, patch) {
  return {
    ...player,
    preferences: createPreferences({ ...player.preferences, ...(patch || {}) }),
    updatedAt: Date.now(),
  };
}

function setName(player, name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('player.name must be a non-empty string');
  }
  return { ...player, name: name.trim().slice(0, 40), updatedAt: Date.now() };
}

module.exports = {
  DEFAULT_PLAYER_ID,
  DEFAULT_PLAYER_NAME,
  createPlayer,
  createStats,
  createPreferences,
  setEquippedSkin,
  unlockSkin,
  recordObstacleClear,
  recordGameFinished,
  setPreferences,
  setName,
};

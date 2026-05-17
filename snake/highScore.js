'use strict';

const { ValidationError } = require('./errors');
const { getMode, modePersistsHighScore } = require('./modes');

const HIGH_SCORE_LIMIT_PER_MODE = 10;

function createHighScore(input) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('high score requires an object');
  }
  if (typeof input.id !== 'string' || !input.id) {
    throw new ValidationError('highScore.id is required');
  }
  getMode(input.mode); // throws on invalid mode
  if (!Number.isInteger(input.score) || input.score < 0) {
    throw new ValidationError('highScore.score must be a non-negative integer');
  }
  return Object.freeze({
    id: input.id,
    mode: input.mode,
    score: input.score,
    playerName: input.playerName || 'Anonymous',
    skinId: input.skinId || null,
    obstacleLayoutId: input.obstacleLayoutId || null,
    achievedAt: input.achievedAt || Date.now(),
    durationMs: Number.isInteger(input.durationMs) ? input.durationMs : 0,
    foodEaten: Number.isInteger(input.foodEaten) ? input.foodEaten : 0,
    snakeLength: Number.isInteger(input.snakeLength) ? input.snakeLength : 0,
  });
}

// Sort newest+highest first. Score is the dominant key; ties break by recency.
function compareHighScores(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return (b.achievedAt || 0) - (a.achievedAt || 0);
}

// Insert into a per-mode top-N list, deduping by id. Returns the new list.
function insertHighScore(list, entry, limit) {
  const cap = Number.isInteger(limit) && limit > 0 ? limit : HIGH_SCORE_LIMIT_PER_MODE;
  if (!modePersistsHighScore(entry.mode)) return list || [];
  const filtered = (list || []).filter((e) => e.id !== entry.id);
  filtered.push(entry);
  filtered.sort(compareHighScores);
  return filtered.slice(0, cap);
}

function isPersonalBest(list, entry) {
  if (!list || list.length === 0) return true;
  const top = list[0];
  return entry.score > top.score;
}

module.exports = {
  HIGH_SCORE_LIMIT_PER_MODE,
  createHighScore,
  compareHighScores,
  insertHighScore,
  isPersonalBest,
};

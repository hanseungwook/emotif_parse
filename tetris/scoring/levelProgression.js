'use strict';

const { ValidationError } = require('./errors');
const {
  DEFAULT_LINES_PER_LEVEL,
  DEFAULT_MAX_LEVEL,
  MIN_FALL_SPEED_MS,
  MAX_FALL_SPEED_MS,
} = require('./constants');

function computeLevel({ totalLines, startLevel = 1, linesPerLevel = DEFAULT_LINES_PER_LEVEL } = {}) {
  if (!Number.isInteger(totalLines) || totalLines < 0) {
    throw new ValidationError('totalLines must be a non-negative integer');
  }
  if (!Number.isInteger(startLevel) || startLevel < 1) {
    throw new ValidationError('startLevel must be a positive integer');
  }
  if (!Number.isInteger(linesPerLevel) || linesPerLevel <= 0) {
    throw new ValidationError('linesPerLevel must be a positive integer');
  }
  const advanced = Math.floor(totalLines / linesPerLevel);
  return startLevel + advanced;
}

function linesUntilNextLevel({ totalLines, linesPerLevel = DEFAULT_LINES_PER_LEVEL } = {}) {
  if (!Number.isInteger(totalLines) || totalLines < 0) {
    throw new ValidationError('totalLines must be a non-negative integer');
  }
  if (!Number.isInteger(linesPerLevel) || linesPerLevel <= 0) {
    throw new ValidationError('linesPerLevel must be a positive integer');
  }
  const remainder = totalLines % linesPerLevel;
  return remainder === 0 && totalLines > 0 ? linesPerLevel : linesPerLevel - remainder;
}

// Tetris Worlds gravity formula: seconds per row = (0.8 - (n - 1) * 0.007)^(n - 1)
// where n is the level. Returns milliseconds per row.
function tetrisWorldsFallSpeedMs(level) {
  if (!Number.isFinite(level) || level < 1) {
    throw new ValidationError('level must be a finite number >= 1');
  }
  const base = 0.8 - (level - 1) * 0.007;
  if (base <= 0) return MIN_FALL_SPEED_MS;
  const seconds = Math.pow(base, level - 1);
  const ms = seconds * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return MIN_FALL_SPEED_MS;
  return clamp(ms, MIN_FALL_SPEED_MS, MAX_FALL_SPEED_MS);
}

function clamp(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

function fallSpeedMs(level, options = {}) {
  if (!Number.isFinite(level) || level < 1) {
    throw new ValidationError('level must be a finite number >= 1');
  }
  const maxLevel = options.maxLevel != null ? options.maxLevel : DEFAULT_MAX_LEVEL;
  if (!Number.isInteger(maxLevel) || maxLevel < 1) {
    throw new ValidationError('maxLevel must be a positive integer');
  }
  const capped = Math.min(level, maxLevel);
  if (typeof options.gravityCurve === 'function') {
    const result = options.gravityCurve(capped);
    if (typeof result !== 'number' || !Number.isFinite(result) || result <= 0) {
      throw new ValidationError('gravityCurve must return a positive finite number');
    }
    return clamp(result, MIN_FALL_SPEED_MS, MAX_FALL_SPEED_MS);
  }
  return tetrisWorldsFallSpeedMs(capped);
}

// Helpful summary that runtimes (and tests) can use to introspect a level
// transition without recomputing fields piecemeal.
function describeLevel(level, options = {}) {
  return {
    level,
    fallSpeedMs: fallSpeedMs(level, options),
    cellsPerSecond: 1000 / fallSpeedMs(level, options),
  };
}

module.exports = {
  computeLevel,
  linesUntilNextLevel,
  tetrisWorldsFallSpeedMs,
  fallSpeedMs,
  describeLevel,
};

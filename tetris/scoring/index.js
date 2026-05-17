'use strict';

const { EventEmitter } = require('./eventEmitter');
const {
  ScoringError,
  ValidationError,
  StateError,
} = require('./errors');
const {
  LINE_CLEAR_POINTS,
  T_SPIN_POINTS,
  MINI_T_SPIN_POINTS,
  PERFECT_CLEAR_POINTS,
  PERFECT_CLEAR_B2B_TETRIS_BONUS,
  BACK_TO_BACK_MULTIPLIER,
  COMBO_POINTS,
  SOFT_DROP_POINTS_PER_CELL,
  HARD_DROP_POINTS_PER_CELL,
  DEFAULT_LINES_PER_LEVEL,
  DEFAULT_MAX_LEVEL,
  MIN_FALL_SPEED_MS,
  MAX_FALL_SPEED_MS,
  LINE_LABELS,
  EVENTS,
} = require('./constants');
const {
  scoreLineClear,
  basePointsFor,
  isDifficultClear,
  badgeFor,
} = require('./lineClearScorer');
const {
  nextCombo,
  comboBonus,
  comboMultiplier,
} = require('./comboTracker');
const {
  computeLevel,
  linesUntilNextLevel,
  tetrisWorldsFallSpeedMs,
  fallSpeedMs,
  describeLevel,
} = require('./levelProgression');
const { ScoringRuntime } = require('./scoringRuntime');

function createScoringRuntime(options) {
  return new ScoringRuntime(options || {});
}

module.exports = {
  createScoringRuntime,
  ScoringRuntime,
  EventEmitter,
  ScoringError,
  ValidationError,
  StateError,
  scoreLineClear,
  basePointsFor,
  isDifficultClear,
  badgeFor,
  nextCombo,
  comboBonus,
  comboMultiplier,
  computeLevel,
  linesUntilNextLevel,
  tetrisWorldsFallSpeedMs,
  fallSpeedMs,
  describeLevel,
  LINE_CLEAR_POINTS,
  T_SPIN_POINTS,
  MINI_T_SPIN_POINTS,
  PERFECT_CLEAR_POINTS,
  PERFECT_CLEAR_B2B_TETRIS_BONUS,
  BACK_TO_BACK_MULTIPLIER,
  COMBO_POINTS,
  SOFT_DROP_POINTS_PER_CELL,
  HARD_DROP_POINTS_PER_CELL,
  DEFAULT_LINES_PER_LEVEL,
  DEFAULT_MAX_LEVEL,
  MIN_FALL_SPEED_MS,
  MAX_FALL_SPEED_MS,
  LINE_LABELS,
  EVENTS,
};

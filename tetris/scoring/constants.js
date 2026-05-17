'use strict';

// Modern Tetris guideline scoring constants. All point values are the per-level
// base that is later multiplied by the current level (and optional B2B bonus).
// References: Tetris Guideline / SRS scoring tables.

const LINE_CLEAR_POINTS = Object.freeze({
  0: 0,
  1: 100,   // Single
  2: 300,   // Double
  3: 500,   // Triple
  4: 800,   // Tetris
});

const T_SPIN_POINTS = Object.freeze({
  0: 400,   // T-Spin (no lines)
  1: 800,   // T-Spin Single
  2: 1200,  // T-Spin Double
  3: 1600,  // T-Spin Triple
});

const MINI_T_SPIN_POINTS = Object.freeze({
  0: 100,   // Mini T-Spin (no lines)
  1: 200,   // Mini T-Spin Single
  2: 400,   // Mini T-Spin Double (rare; included for completeness)
});

const PERFECT_CLEAR_POINTS = Object.freeze({
  1: 800,
  2: 1200,
  3: 1800,
  4: 2000,
});

// Extra bonus added when a Perfect Clear lands on a Tetris that also extends
// the back-to-back chain (the famous B2B PC Tetris).
const PERFECT_CLEAR_B2B_TETRIS_BONUS = 1200;

const BACK_TO_BACK_MULTIPLIER = 1.5;
const COMBO_POINTS = 50;

const SOFT_DROP_POINTS_PER_CELL = 1;
const HARD_DROP_POINTS_PER_CELL = 2;

const DEFAULT_LINES_PER_LEVEL = 10;
const DEFAULT_MAX_LEVEL = 20;
const MIN_FALL_SPEED_MS = 1000 / 60;   // ~16.67 ms (one 60Hz frame)
const MAX_FALL_SPEED_MS = 1000;

const LINE_LABELS = Object.freeze({
  1: 'single',
  2: 'double',
  3: 'triple',
  4: 'tetris',
});

const EVENTS = Object.freeze({
  RESET: 'reset',
  START: 'start',
  PAUSE: 'pause',
  RESUME: 'resume',
  GAME_OVER: 'gameover',
  SCORE_CHANGE: 'score:change',
  LEVEL_UP: 'level:up',
  LINES_CHANGE: 'lines:change',
  COMBO_CHANGE: 'combo:change',
  COMBO_BREAK: 'combo:break',
  B2B_CHANGE: 'b2b:change',
  B2B_BREAK: 'b2b:break',
  LINE_CLEAR: 'line:clear',
  LOCK: 'lock',
  SOFT_DROP: 'soft:drop',
  HARD_DROP: 'hard:drop',
});

module.exports = {
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

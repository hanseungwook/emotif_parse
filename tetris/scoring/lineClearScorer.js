'use strict';

const { ValidationError } = require('./errors');
const {
  LINE_CLEAR_POINTS,
  T_SPIN_POINTS,
  MINI_T_SPIN_POINTS,
  PERFECT_CLEAR_POINTS,
  PERFECT_CLEAR_B2B_TETRIS_BONUS,
  BACK_TO_BACK_MULTIPLIER,
  LINE_LABELS,
} = require('./constants');

function basePointsFor({ lines, tSpin, mini }) {
  if (tSpin && mini) {
    return MINI_T_SPIN_POINTS[lines] != null ? MINI_T_SPIN_POINTS[lines] : 0;
  }
  if (tSpin) {
    return T_SPIN_POINTS[lines] != null ? T_SPIN_POINTS[lines] : 0;
  }
  return LINE_CLEAR_POINTS[lines] != null ? LINE_CLEAR_POINTS[lines] : 0;
}

function isDifficultClear({ lines, tSpin }) {
  if (lines <= 0) return false;
  if (lines === 4) return true;
  if (tSpin) return true;
  return false;
}

function badgeFor({ lines, tSpin, mini, perfectClear }) {
  if (tSpin && mini) {
    if (lines === 0) return 't-spin-mini';
    const label = LINE_LABELS[lines] || `${lines}-line`;
    return `t-spin-mini-${label}`;
  }
  if (tSpin) {
    if (lines === 0) return 't-spin';
    const label = LINE_LABELS[lines] || `${lines}-line`;
    return `t-spin-${label}`;
  }
  if (lines >= 1) {
    const base = LINE_LABELS[lines] || `${lines}-line`;
    return perfectClear ? `${base}-perfect-clear` : base;
  }
  return null;
}

function validateInput(input) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('line-clear input must be an object');
  }
  const lines = input.lines;
  if (!Number.isInteger(lines) || lines < 0 || lines > 4) {
    throw new ValidationError('lines must be an integer between 0 and 4');
  }
  const tSpin = !!input.tSpin;
  const mini = !!input.mini;
  const perfectClear = !!input.perfectClear;
  if (mini && !tSpin) {
    throw new ValidationError('mini implies tSpin');
  }
  if (perfectClear && lines === 0) {
    throw new ValidationError('perfectClear requires at least 1 line');
  }
  return { lines, tSpin, mini, perfectClear };
}

// Compute the score contribution of a single line-clear event. Pure function:
// no state is mutated and the caller is responsible for tracking back-to-back
// and combo state. Returns a detailed breakdown so the HUD can render badges
// and animations without recomputing anything.
function scoreLineClear(input, context) {
  const params = validateInput(input);
  const ctx = context || {};
  const level = ctx.level != null ? ctx.level : 1;
  const backToBackActive = !!ctx.backToBackActive;

  if (!Number.isFinite(level) || level < 1) {
    throw new ValidationError('level must be a finite number >= 1');
  }

  const { lines, tSpin, mini, perfectClear } = params;
  const base = basePointsFor({ lines, tSpin, mini });
  const difficult = isDifficultClear({ lines, tSpin });

  const b2bMultiplier = difficult && backToBackActive ? BACK_TO_BACK_MULTIPLIER : 1;
  const scaledBase = base * level * b2bMultiplier;

  let perfectClearPoints = 0;
  if (perfectClear && lines > 0) {
    const pcBase = PERFECT_CLEAR_POINTS[lines] || 0;
    perfectClearPoints = pcBase * level;
    if (lines === 4 && backToBackActive) {
      perfectClearPoints += PERFECT_CLEAR_B2B_TETRIS_BONUS * level;
    }
  }

  const total = scaledBase + perfectClearPoints;
  const breaksBackToBack = lines > 0 && !difficult;
  const badge = badgeFor({ lines, tSpin, mini, perfectClear });

  return {
    lines,
    tSpin,
    mini,
    perfectClear,
    level,
    base,
    scaledBase,
    perfectClearPoints,
    total,
    difficult,
    b2bMultiplier,
    backToBackActive,
    breaksBackToBack,
    badge,
  };
}

module.exports = {
  scoreLineClear,
  basePointsFor,
  isDifficultClear,
  badgeFor,
};

'use strict';

const { ValidationError } = require('./errors');
const { COMBO_POINTS } = require('./constants');

// Combo convention used by this module:
//   combo === 0  -> no active chain (just started, or last lock cleared no lines)
//   combo === 1  -> 1 consecutive line-clearing piece (no bonus yet)
//   combo >= 2   -> chain of `combo` clears, bonus = 50 * (combo - 1) * level
//
// This matches the Tetris Guideline where the "combo counter" displayed in
// HUDs starts at zero on the second clear in a row, while the underlying
// consecutive-clear count is one higher.

function nextCombo({ combo, clearedLines }) {
  if (!Number.isInteger(combo) || combo < 0) {
    throw new ValidationError('combo must be a non-negative integer');
  }
  if (!Number.isInteger(clearedLines) || clearedLines < 0) {
    throw new ValidationError('clearedLines must be a non-negative integer');
  }
  if (clearedLines > 0) {
    return combo + 1;
  }
  return 0;
}

function comboBonus({ combo, level }) {
  if (!Number.isFinite(combo) || combo < 2) return 0;
  if (!Number.isFinite(level) || level < 1) return 0;
  return COMBO_POINTS * (combo - 1) * level;
}

// Number that HUDs typically render (e.g. "REN 3"). Zero or negative for
// pieces that don't extend a chain.
function comboMultiplier(combo) {
  if (!Number.isFinite(combo) || combo < 2) return 0;
  return combo - 1;
}

module.exports = {
  nextCombo,
  comboBonus,
  comboMultiplier,
};

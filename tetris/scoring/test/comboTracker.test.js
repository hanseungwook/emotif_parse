'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { nextCombo, comboBonus, comboMultiplier } = require('../comboTracker');
const { ValidationError } = require('../errors');
const { COMBO_POINTS } = require('../constants');

test('nextCombo increments on line clear', () => {
  assert.equal(nextCombo({ combo: 0, clearedLines: 1 }), 1);
  assert.equal(nextCombo({ combo: 1, clearedLines: 2 }), 2);
  assert.equal(nextCombo({ combo: 5, clearedLines: 4 }), 6);
});

test('nextCombo resets on lock without clear', () => {
  assert.equal(nextCombo({ combo: 0, clearedLines: 0 }), 0);
  assert.equal(nextCombo({ combo: 1, clearedLines: 0 }), 0);
  assert.equal(nextCombo({ combo: 9, clearedLines: 0 }), 0);
});

test('nextCombo validates input', () => {
  assert.throws(() => nextCombo({ combo: -1, clearedLines: 1 }), ValidationError);
  assert.throws(() => nextCombo({ combo: 1.2, clearedLines: 1 }), ValidationError);
  assert.throws(() => nextCombo({ combo: 0, clearedLines: -1 }), ValidationError);
  assert.throws(() => nextCombo({ combo: 0, clearedLines: 1.5 }), ValidationError);
});

test('comboBonus is zero for first clear in chain', () => {
  assert.equal(comboBonus({ combo: 0, level: 1 }), 0);
  assert.equal(comboBonus({ combo: 1, level: 1 }), 0);
});

test('comboBonus scales by (combo - 1) and level', () => {
  assert.equal(comboBonus({ combo: 2, level: 1 }), COMBO_POINTS * 1 * 1);
  assert.equal(comboBonus({ combo: 3, level: 1 }), COMBO_POINTS * 2 * 1);
  assert.equal(comboBonus({ combo: 5, level: 4 }), COMBO_POINTS * 4 * 4);
});

test('comboBonus is zero for invalid level', () => {
  assert.equal(comboBonus({ combo: 5, level: 0 }), 0);
  assert.equal(comboBonus({ combo: 5, level: -1 }), 0);
});

test('comboMultiplier matches HUD convention', () => {
  assert.equal(comboMultiplier(0), 0);
  assert.equal(comboMultiplier(1), 0);
  assert.equal(comboMultiplier(2), 1);
  assert.equal(comboMultiplier(5), 4);
});

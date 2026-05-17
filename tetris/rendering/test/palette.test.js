'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TETROMINO_COLORS,
  NEUTRAL_COLORS,
  BACKGROUND,
  OVERLAY,
  isTetrominoType,
  colorsFor,
  ghostColor,
  mergePalette,
} = require('../palette');

test('every tetromino type has a full color spec', () => {
  const types = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  for (const type of types) {
    const c = TETROMINO_COLORS[type];
    assert.ok(c, 'missing color spec for ' + type);
    assert.equal(typeof c.base, 'string');
    assert.equal(typeof c.light, 'string');
    assert.equal(typeof c.dark, 'string');
    assert.equal(typeof c.glow, 'string');
  }
});

test('isTetrominoType rejects unknown values', () => {
  assert.equal(isTetrominoType('I'), true);
  assert.equal(isTetrominoType('X'), false);
  assert.equal(isTetrominoType(''), false);
  assert.equal(isTetrominoType(null), false);
  assert.equal(isTetrominoType(123), false);
});

test('colorsFor falls back to neutral for unknown types', () => {
  assert.equal(colorsFor('I').base, TETROMINO_COLORS.I.base);
  assert.equal(colorsFor('???'), NEUTRAL_COLORS);
  assert.equal(colorsFor(undefined), NEUTRAL_COLORS);
});

test('ghostColor derives from base color', () => {
  const ghost = ghostColor('T');
  assert.equal(ghost.stroke, TETROMINO_COLORS.T.light);
  assert.equal(ghost.accent, TETROMINO_COLORS.T.glow);
  assert.match(ghost.fill, /rgba/);
});

test('mergePalette deep-merges overrides without mutating defaults', () => {
  const merged = mergePalette({ tetromino: { I: { base: '#000' } }, background: { panel: '#fff' } });
  assert.equal(merged.tetromino.I.base, '#000');
  assert.equal(merged.background.panel, '#fff');
  assert.equal(merged.tetromino.O.base, TETROMINO_COLORS.O.base);
  assert.equal(merged.overlay.textPrimary, OVERLAY.textPrimary);
  assert.equal(TETROMINO_COLORS.I.base, '#22d3ee');
  assert.equal(BACKGROUND.panel, '#0b1220');
});

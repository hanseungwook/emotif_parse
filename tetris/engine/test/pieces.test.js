'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PIECES, PIECE_TYPES, getPiece, getCells, getAbsoluteCells, normalizeRotation,
} = require('../pieces');

test('seven canonical piece types are defined', () => {
  assert.deepEqual(PIECE_TYPES.slice().sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  for (const t of PIECE_TYPES) {
    assert.ok(PIECES[t], `piece ${t} missing`);
  }
});

test('every piece has four rotation states with four cells each', () => {
  for (const t of PIECE_TYPES) {
    const p = PIECES[t];
    assert.equal(p.rotations.length, 4, `${t} should have 4 rotations`);
    for (let r = 0; r < 4; r++) {
      assert.equal(p.rotations[r].length, 4, `${t}@${r} should have 4 cells`);
      for (const cell of p.rotations[r]) {
        assert.equal(cell.length, 2);
        assert.ok(cell[0] >= 0 && cell[0] < p.bboxSize, `${t}@${r} col in bbox`);
        assert.ok(cell[1] >= 0 && cell[1] < p.bboxSize, `${t}@${r} row in bbox`);
      }
    }
  }
});

test('O piece is rotation-invariant', () => {
  const ref = JSON.stringify(PIECES.O.rotations[0]);
  for (let r = 1; r < 4; r++) {
    assert.equal(JSON.stringify(PIECES.O.rotations[r]), ref);
  }
});

test('I piece state 0 is the four-wide horizontal bar', () => {
  const cells = getCells('I', 0);
  for (const [c, r] of cells) {
    assert.equal(r, 1);
  }
  const cols = cells.map((c) => c[0]).sort();
  assert.deepEqual(cols, [0, 1, 2, 3]);
});

test('getCells normalizes negative and large rotation indices', () => {
  const base = getCells('T', 0);
  assert.deepEqual(getCells('T', 4), base);
  assert.deepEqual(getCells('T', -4), base);
  assert.deepEqual(getCells('T', 8), base);
});

test('normalizeRotation wraps to 0..3', () => {
  assert.equal(normalizeRotation(0), 0);
  assert.equal(normalizeRotation(1), 1);
  assert.equal(normalizeRotation(4), 0);
  assert.equal(normalizeRotation(-1), 3);
  assert.equal(normalizeRotation(-5), 3);
});

test('getAbsoluteCells offsets relative cells by piece position', () => {
  const piece = { type: 'T', rotation: 0, col: 4, row: 5 };
  const expected = getCells('T', 0).map(([c, r]) => [4 + c, 5 + r]);
  assert.deepEqual(getAbsoluteCells(piece), expected);
});

test('getPiece throws for unknown types', () => {
  assert.throws(() => getPiece('X'), /Unknown piece type/);
});

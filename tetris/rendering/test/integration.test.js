'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPlayfieldRenderer,
  STATES,
  EFFECTS,
  EffectTimeline,
  TETROMINO_TYPES,
} = require('../');
const { createMockCanvas } = require('./mockCanvas');

function emptyBoard(rows, cols) {
  const board = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(null);
    board.push(row);
  }
  return board;
}

test('public API exposes constants and helpers', () => {
  assert.equal(typeof createPlayfieldRenderer, 'function');
  assert.deepEqual(TETROMINO_TYPES.slice().sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  assert.equal(STATES.PLAYING, 'playing');
  assert.equal(EFFECTS.LINE_CLEAR, 'line-clear');
});

test('full lifecycle: ready → playing → line clear → game over', () => {
  const canvas = createMockCanvas();
  const renderer = createPlayfieldRenderer({
    canvas,
    cellSize: 24,
    columns: 6,
    visibleRows: 8,
    hiddenRows: 2,
  });
  const ctx = canvas.getContext('2d');

  // Initial ready screen
  renderer.draw({ board: emptyBoard(10, 6), state: STATES.READY });
  let labels = ctx.callsByName('fillText').map((c) => c.args[0]);
  assert.ok(labels.indexOf('READY') >= 0);

  // Active piece in play
  ctx.reset();
  const board = emptyBoard(10, 6);
  board[9][0] = { type: 'I' };
  board[9][1] = { type: 'I' };
  renderer.draw({
    board: board,
    active: { type: 'T', cells: [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 4 }] },
    ghost: { type: 'T', cells: [{ x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 9 }] },
    state: STATES.PLAYING,
  });
  assert.ok(ctx.callsByName('fillRect').length > 0);
  assert.ok(ctx.callsByName('setLineDash').length > 0, 'ghost rendered');

  // Trigger a line clear and tick midway through
  ctx.reset();
  for (let c = 0; c < 6; c++) board[8][c] = { type: 'O' };
  const clearId = renderer.lineClear([8]);
  assert.ok(clearId);
  renderer.advance(80);
  renderer.draw({ board: board, state: STATES.PLAYING });
  const flashCount = ctx
    .callsByName('fillRect')
    .filter((c) => typeof c.fillStyle === 'string' && c.fillStyle.indexOf('rgba(255,255,255') === 0).length;
  assert.ok(flashCount > 0, 'flash visible while clearing');

  // Complete the effect
  const finished = renderer.advance(10_000);
  assert.equal(finished.length, 1);
  assert.equal(finished[0].name, EFFECTS.LINE_CLEAR);

  // Game over overlay
  ctx.reset();
  renderer.gameOver();
  renderer.draw({ board: board, state: STATES.GAME_OVER });
  labels = ctx.callsByName('fillText').map((c) => c.args[0]);
  assert.ok(labels.indexOf('GAME OVER') >= 0);
});

test('renderer can be constructed with a custom effect timeline', () => {
  const canvas = createMockCanvas();
  const timeline = new EffectTimeline({ durations: { 'line-clear': 50 } });
  const renderer = createPlayfieldRenderer({ canvas, effects: timeline, cellSize: 10, columns: 4, visibleRows: 4 });
  renderer.lineClear([1]);
  assert.equal(timeline.size(), 1);
  renderer.advance(75);
  assert.equal(timeline.size(), 0);
});

test('canvas re-renders are idempotent given the same snapshot', () => {
  const canvas = createMockCanvas();
  const renderer = createPlayfieldRenderer({ canvas, cellSize: 10, columns: 4, visibleRows: 4 });
  const snapshot = {
    board: emptyBoard(4, 4),
    active: { type: 'L', cells: [{ x: 0, y: 1 }, { x: 1, y: 1 }] },
    state: STATES.PLAYING,
  };
  renderer.draw(snapshot);
  const firstCount = canvas.getContext('2d').calls.length;
  canvas.getContext('2d').reset();
  renderer.draw(snapshot);
  const secondCount = canvas.getContext('2d').calls.length;
  assert.equal(secondCount, firstCount);
});

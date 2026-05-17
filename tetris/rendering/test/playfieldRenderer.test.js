'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { PlayfieldRenderer } = require('../playfieldRenderer');
const { STATES, EFFECTS } = require('../constants');
const { TETROMINO_COLORS } = require('../palette');
const { createMockCanvas } = require('./mockCanvas');

function makeRenderer(options) {
  const canvas = createMockCanvas();
  const renderer = new PlayfieldRenderer(
    Object.assign({ canvas: canvas, cellSize: 20, columns: 4, visibleRows: 4, hiddenRows: 1, padding: 0 }, options)
  );
  return { canvas, renderer, ctx: canvas.getContext('2d') };
}

function emptyBoard(rows, cols) {
  const board = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(null);
    board.push(row);
  }
  return board;
}

test('constructor requires canvas or context', () => {
  assert.throws(() => new PlayfieldRenderer({}));
});

test('constructor sizes the canvas based on geometry', () => {
  const { canvas, renderer } = makeRenderer();
  const g = renderer.geometry;
  assert.equal(canvas.width, g.canvasWidth);
  assert.equal(canvas.height, g.canvasHeight);
});

test('draw clears the canvas and paints background', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.draw({ board: emptyBoard(5, 4), state: STATES.PLAYING });
  assert.ok(ctx.callsByName('clearRect').length >= 1);
  assert.ok(ctx.callsByName('fillRect').length >= 1, 'expected background fillRect');
});

test('draw renders settled blocks for visible rows', () => {
  const { renderer, ctx } = makeRenderer();
  const board = emptyBoard(5, 4);
  board[2][1] = { type: 'I' };
  board[3][2] = 'O';
  renderer.draw({ board: board, state: STATES.PLAYING });
  const fills = ctx.callsByName('fillRect');
  const baseI = fills.find((c) => c.fillStyle === TETROMINO_COLORS.I.base);
  const baseO = fills.find((c) => c.fillStyle === TETROMINO_COLORS.O.base);
  assert.ok(baseI, 'I block drawn');
  assert.ok(baseO, 'O block drawn');
});

test('draw skips settled blocks in the hidden region', () => {
  const { renderer, ctx } = makeRenderer({ hiddenRows: 1 });
  const board = emptyBoard(5, 4);
  board[0][1] = { type: 'I' };
  renderer.draw({ board: board, state: STATES.PLAYING });
  const baseI = ctx.callsByName('fillRect').find((c) => c.fillStyle === TETROMINO_COLORS.I.base);
  assert.equal(baseI, undefined, 'block in hidden row should not be drawn');
});

test('draw renders active tetromino over settled board', () => {
  const { renderer, ctx } = makeRenderer();
  const board = emptyBoard(5, 4);
  renderer.draw({
    board: board,
    active: { type: 'T', cells: [{ x: 0, y: 2 }, { x: 1, y: 2 }] },
    state: STATES.PLAYING,
  });
  const baseT = ctx.callsByName('fillRect').find((c) => c.fillStyle === TETROMINO_COLORS.T.base);
  assert.ok(baseT, 'active block drawn');
});

test('draw renders ghost piece with dashed stroke', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.draw({
    board: emptyBoard(5, 4),
    ghost: { type: 'T', cells: [{ x: 0, y: 3 }] },
    active: { type: 'T', cells: [{ x: 0, y: 1 }] },
    state: STATES.PLAYING,
  });
  assert.ok(ctx.callsByName('setLineDash').length >= 1);
  assert.ok(ctx.callsByName('strokeRect').length >= 1);
});

test('setShowGhost(false) suppresses ghost rendering', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.setShowGhost(false);
  renderer.draw({
    board: emptyBoard(5, 4),
    ghost: { type: 'T', cells: [{ x: 0, y: 3 }] },
    state: STATES.PLAYING,
  });
  assert.equal(ctx.callsByName('setLineDash').length, 0, 'no ghost strokes');
});

test('paused state renders overlay with title', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.draw({ board: emptyBoard(5, 4), state: STATES.PAUSED });
  const text = ctx.callsByName('fillText').map((c) => c.args[0]);
  assert.ok(text.indexOf('PAUSED') >= 0);
});

test('game-over state renders title and subtitle', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.gameOver();
  renderer.draw({ board: emptyBoard(5, 4), state: STATES.GAME_OVER });
  const labels = ctx.callsByName('fillText').map((c) => c.args[0]);
  assert.ok(labels.indexOf('GAME OVER') >= 0);
  assert.ok(labels.some((l) => /restart/i.test(l)));
});

test('lineClear schedules an animation and skips the row in settled draw', () => {
  const { renderer, ctx } = makeRenderer();
  const board = emptyBoard(5, 4);
  for (let c = 0; c < 4; c++) board[3][c] = { type: 'I' };
  const id = renderer.lineClear([3]);
  assert.ok(id);
  renderer.draw({ board: board, state: STATES.PLAYING });
  const baseI = ctx.callsByName('fillRect').filter((c) => c.fillStyle === TETROMINO_COLORS.I.base);
  assert.equal(baseI.length, 0, 'clearing row should not draw normal settled blocks');
  const flashes = ctx.callsByName('fillRect').filter((c) =>
    typeof c.fillStyle === 'string' && c.fillStyle.indexOf('rgba(255,255,255') === 0
  );
  assert.ok(flashes.length > 0, 'flash overlay drawn');
});

test('lineClear progresses with advance and completes', () => {
  const { renderer } = makeRenderer();
  renderer.lineClear([2]);
  const finished = renderer.advance(10000);
  assert.equal(finished.length, 1);
  assert.equal(finished[0].name, EFFECTS.LINE_CLEAR);
});

test('lockFlash and hardDrop register effects', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.lockFlash([{ x: 0, y: 2 }, { x: 1, y: 2 }]);
  renderer.hardDrop(1, 1, 3);
  renderer.draw({ board: emptyBoard(5, 4), state: STATES.PLAYING });
  const whiteFills = ctx.callsByName('fillRect').filter((c) =>
    typeof c.fillStyle === 'string' && /255,255,255/.test(c.fillStyle)
  );
  assert.ok(whiteFills.length >= 1, 'lock flash drawn');
  const trailFills = ctx.callsByName('fillRect').filter((c) =>
    typeof c.fillStyle === 'string' && /226,232,240/.test(c.fillStyle)
  );
  assert.ok(trailFills.length >= 1, 'hard drop trail drawn');
});

test('levelUp draws blue tint and level text', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.levelUp(3);
  renderer.draw({ board: emptyBoard(5, 4), state: STATES.PLAYING, level: 3 });
  const labels = ctx.callsByName('fillText').map((c) => c.args[0]);
  assert.ok(labels.indexOf('LEVEL 3') >= 0);
});

test('reset clears state and effects', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.lineClear([1]);
  renderer.gameOver();
  renderer.reset();
  renderer.draw({ board: emptyBoard(5, 4), state: STATES.PLAYING });
  const labels = ctx.callsByName('fillText').map((c) => c.args[0]);
  assert.ok(labels.indexOf('GAME OVER') < 0);
});

test('resize updates canvas size', () => {
  const { canvas, renderer } = makeRenderer();
  renderer.resize(40);
  assert.equal(renderer.geometry.cellSize, 40);
  assert.equal(canvas.width, renderer.geometry.canvasWidth);
});

test('grid drawing can be disabled', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.setShowGrid(false);
  renderer.draw({ board: emptyBoard(5, 4), state: STATES.PLAYING });
  assert.equal(ctx.callsByName('stroke').length, 0);
});

test('clampCells via lockFlash ignores out-of-range cells', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.lockFlash([{ x: 99, y: 1 }, { x: 0, y: 2 }, null]);
  renderer.draw({ board: emptyBoard(5, 4), state: STATES.PLAYING });
  // Only one valid in-range cell remains and only it should produce a lock flash fill.
  const flashFills = ctx.callsByName('fillRect').filter((c) => c.fillStyle === 'rgba(255,255,255,0.9)');
  assert.equal(flashFills.length, 1);
});

test('snapshot is returned and stored from draw', () => {
  const { renderer } = makeRenderer();
  const board = emptyBoard(5, 4);
  const snap = renderer.draw({ board: board, state: STATES.PLAYING });
  assert.equal(snap.state, STATES.PLAYING);
  assert.equal(snap.board, board);
});

test('draw handles missing snapshot gracefully', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.draw();
  assert.ok(ctx.callsByName('fillRect').length >= 1);
});

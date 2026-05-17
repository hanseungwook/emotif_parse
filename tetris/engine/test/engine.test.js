'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisEngine, PHASE, GAME_OVER_REASON } = require('../engine');
const { createSeededRng } = require('../bag');

// --- helpers -----------------------------------------------------------

function fakeBag(sequence) {
  let idx = 0;
  return {
    next() {
      const t = sequence[idx % sequence.length];
      idx += 1;
      return t;
    },
    peek(n) {
      const out = [];
      for (let i = 0; i < n; i++) out.push(sequence[(idx + i) % sequence.length]);
      return out;
    },
  };
}

function newEngine(extra) {
  return new TetrisEngine(Object.assign({
    rng: createSeededRng(1),
    lockDelayMs: 500,
    maxLockResets: 15,
  }, extra || {}));
}

function fillRow(engine, row, exceptCol) {
  const board = engine.board;
  for (let c = 0; c < board.cols; c++) {
    if (c === exceptCol) continue;
    board.setCell(c, row, { type: 'X', color: 'gray' });
  }
}

function fillFullRow(engine, row) {
  const board = engine.board;
  for (let c = 0; c < board.cols; c++) {
    board.setCell(c, row, { type: 'X', color: 'gray' });
  }
}

// --- lifecycle ---------------------------------------------------------

test('engine starts in READY and transitions to PLAYING on start()', () => {
  const e = newEngine();
  assert.equal(e.phase, PHASE.READY);
  e.start();
  assert.equal(e.phase, PHASE.PLAYING);
  assert.ok(e.activePiece, 'active piece spawned after start');
});

test('start() emits start and spawn events', () => {
  const e = newEngine();
  const events = [];
  e.on('start', () => events.push('start'));
  e.on('spawn', (p) => events.push(['spawn', p.type]));
  e.start();
  assert.equal(events[0], 'start');
  assert.equal(events[1][0], 'spawn');
});

test('start() is idempotent while playing', () => {
  const e = newEngine();
  e.start();
  const first = e.activePiece;
  assert.equal(e.start(), false);
  // Active piece reference may rebuild on input but should still be defined.
  assert.ok(e.activePiece);
  assert.equal(e.activePiece.type, first.type);
});

// --- movement / collision ---------------------------------------------

test('moveLeft/moveRight shift the piece by one column', () => {
  const e = newEngine({ bag: fakeBag(['T']) });
  e.start();
  const startCol = e.activePiece.col;
  assert.equal(e.moveLeft(), true);
  assert.equal(e.activePiece.col, startCol - 1);
  assert.equal(e.moveRight(), true);
  assert.equal(e.activePiece.col, startCol);
});

test('moveLeft is blocked at the left wall', () => {
  const e = newEngine({ bag: fakeBag(['T']) });
  e.start();
  while (e.moveLeft()) {}
  const leftmost = e.activePiece.col;
  assert.equal(e.moveLeft(), false);
  assert.equal(e.activePiece.col, leftmost);
});

test('moveRight is blocked at the right wall', () => {
  const e = newEngine({ bag: fakeBag(['T']) });
  e.start();
  while (e.moveRight()) {}
  const rightmost = e.activePiece.col;
  assert.equal(e.moveRight(), false);
  assert.equal(e.activePiece.col, rightmost);
});

test('movement is blocked by stacked blocks', () => {
  const e = newEngine({ bag: fakeBag(['O']) });
  e.start();
  // Place a wall of blocks just to the right of the O piece's start col.
  const o = e.activePiece;
  // O occupies cols [spawnCol, spawnCol+1] = [4,5]. Put blocks at col 6 in the visible rows.
  for (let r = 0; r < e.board.totalRows; r++) {
    e.board.setCell(6, r, { type: 'X' });
  }
  assert.equal(e.moveRight(), false);
  // ensure original position is unchanged
  assert.equal(e.activePiece.col, o.col);
});

// --- rotation ----------------------------------------------------------

test('rotate CW advances rotation index modulo 4', () => {
  const e = newEngine({ bag: fakeBag(['T']) });
  e.start();
  assert.equal(e.activePiece.rotation, 0);
  e.rotate(1);
  assert.equal(e.activePiece.rotation, 1);
  e.rotate(1);
  assert.equal(e.activePiece.rotation, 2);
  e.rotate(1);
  assert.equal(e.activePiece.rotation, 3);
  e.rotate(1);
  assert.equal(e.activePiece.rotation, 0);
});

test('rotate CCW from spawn produces rotation 3', () => {
  const e = newEngine({ bag: fakeBag(['T']) });
  e.start();
  e.rotate(-1);
  assert.equal(e.activePiece.rotation, 3);
});

test('O piece rotates without changing cells', () => {
  const e = newEngine({ bag: fakeBag(['O']) });
  e.start();
  const before = e.activePiece.cells.slice().sort();
  e.rotate(1);
  const after = e.activePiece.cells.slice().sort();
  assert.deepEqual(before, after);
});

test('wall kick allows rotation against the left wall', () => {
  // Drive a T piece into the left wall, then rotate CCW which would otherwise
  // collide and require a (+1, 0) kick to succeed.
  const e = newEngine({ bag: fakeBag(['T']) });
  e.start();
  while (e.moveLeft()) {}
  assert.equal(e.rotate(-1), true, 'left-wall kick should succeed');
});

// --- gravity / lock delay ---------------------------------------------

test('tick advances gravity and drops the piece', () => {
  const e = newEngine({ bag: fakeBag(['T']), startLevel: 1 });
  e.start();
  const startRow = e.activePiece.row;
  e.tick(1000);
  assert.ok(e.activePiece.row > startRow, 'piece should drop with 1s at level 1');
});

test('soft drop accelerates fall', () => {
  const e = newEngine({ bag: fakeBag(['T']), startLevel: 1 });
  e.start();
  const startRow = e.activePiece.row;
  e.softDrop(true);
  e.tick(100); // at level 1 soft drop is ~50ms/row → ~2 rows
  assert.ok(e.activePiece.row >= startRow + 1);
});

test('softDropStep moves down once and scores 1 point', () => {
  const e = newEngine({ bag: fakeBag(['T']), startLevel: 1 });
  e.start();
  const startRow = e.activePiece.row;
  const startScore = e.score;
  assert.equal(e.softDropStep(), true);
  assert.equal(e.activePiece.row, startRow + 1);
  assert.equal(e.score, startScore + 1);
});

test('hard drop drops to bottom and scores 2 per row, then locks', () => {
  const e = newEngine({ bag: fakeBag(['T', 'I']) });
  e.start();
  const startRow = e.activePiece.row;
  const dropped = e.hardDrop();
  assert.ok(dropped > 0, 'should drop multiple rows');
  assert.equal(e.score, dropped * 2);
  // After hard drop, the engine locks and spawns next piece.
  assert.equal(e.activePiece.type, 'I');
  assert.notEqual(e.activePiece.row, startRow + dropped);
});

test('lock delay holds piece on ground for the configured window', () => {
  const e = newEngine({ bag: fakeBag(['T']), lockDelayMs: 500 });
  e.start();
  // Drop piece to bottom but don't lock.
  while (e.softDropStep()) {}
  assert.ok(e.activePiece, 'piece is grounded');
  const groundedType = e.activePiece.type;
  // Tick less than lock delay — piece should still be active.
  e.tick(400);
  assert.equal(e.activePiece && e.activePiece.type, groundedType, 'should not have locked yet');
  // Tick past lock delay — piece should lock and a new piece spawn.
  e.tick(200);
  // Either active piece is gone (game-over) or replaced. Phase should be PLAYING here.
  assert.equal(e.phase, PHASE.PLAYING);
  assert.ok(e.activePiece, 'new piece should have spawned');
});

test('moving while grounded resets lock delay (up to maxLockResets times)', () => {
  const e = newEngine({ bag: fakeBag(['T']), lockDelayMs: 500, maxLockResets: 15 });
  e.start();
  while (e.softDropStep()) {}
  // Tick almost to lock delay, then reset by moving.
  for (let i = 0; i < 10; i++) {
    e.tick(400);
    const moved = e.moveLeft() || e.moveRight();
    assert.equal(moved, true, `iteration ${i}: should still be able to reset`);
    assert.equal(e.phase, PHASE.PLAYING);
  }
});

test('maxLockResets caps the number of lock-delay resets', () => {
  const e = newEngine({ bag: fakeBag(['T']), lockDelayMs: 500, maxLockResets: 2 });
  e.start();
  while (e.softDropStep()) {}
  // Exhaust resets
  for (let i = 0; i < 2; i++) {
    e.tick(400);
    assert.ok(e.moveLeft() || e.moveRight());
  }
  // Next move should not reset; tick past lock delay must lock.
  e.tick(400);
  e.moveLeft();
  e.tick(200);
  // After enough time, the engine should have locked and respawned a new T.
  // The piece row should now be back near the spawn position.
  assert.ok(e.activePiece, 'new piece spawned');
  assert.ok(e.activePiece.row <= 2, 'spawned near top');
});

// --- line clears -------------------------------------------------------

test('completed rows are cleared and scored', () => {
  // Set up a board where dropping an I piece into a gap clears one line.
  // Use vertical I (rotation R) so it slides into a 1-wide gap.
  const e = newEngine({ bag: fakeBag(['I']) });
  e.start();
  // Fill bottom visible row except for col 0.
  const bottomRow = e.board.totalRows - 1;
  fillRow(e, bottomRow, 0);

  let cleared = null;
  e.on('linesCleared', (info) => { cleared = info; });

  // Rotate I to vertical so it occupies a single column.
  e.rotate(1);
  // Move to col 0
  while (e.moveLeft()) {}
  e.hardDrop();

  assert.ok(cleared, 'linesCleared event should fire');
  assert.equal(cleared.count, 1);
  assert.equal(e.lines, 1);
  assert.equal(e.score >= 100, true);
});

test('Tetris (4 line clear) awards 800 * level', () => {
  const e = newEngine({ bag: fakeBag(['I']), startLevel: 3 });
  e.start();
  // Fill bottom 4 visible rows except col 0.
  const totalRows = e.board.totalRows;
  for (let r = totalRows - 4; r < totalRows; r++) fillRow(e, r, 0);

  let info = null;
  e.on('linesCleared', (i) => { info = i; });
  let scoreBefore = e.score;

  e.rotate(1);
  while (e.moveLeft()) {}
  e.hardDrop();

  assert.ok(info);
  assert.equal(info.count, 4);
  // 800 * level (3) = 2400
  assert.equal(e.score - scoreBefore >= 2400, true);
});

test('level advances after 10 lines cleared', () => {
  const e = newEngine({ bag: fakeBag(['I', 'I', 'I']), linesPerLevel: 1 });
  e.start();
  const totalRows = e.board.totalRows;
  fillRow(e, totalRows - 1, 0);
  e.rotate(1);
  while (e.moveLeft()) {}
  e.hardDrop();
  assert.equal(e.lines, 1);
  assert.equal(e.level, 2, 'level should advance with linesPerLevel=1');
});

// --- game over ---------------------------------------------------------

test('spawn into existing blocks ends the game (block out)', () => {
  // Drop the first piece, then plant a block in the next piece's spawn footprint
  // before it locks/spawns. T spawn cells land at (4,1), (3,2), (4,2), (5,2).
  const e = newEngine({ bag: fakeBag(['I', 'T']) });
  e.start();
  // Block one of the T's spawn cells. The I piece passes through row 2 cleanly
  // since hard drop only checks the destination row for collision.
  e.board.setCell(3, 2, { type: 'X' });
  let reason = null;
  e.on('gameOver', (info) => { reason = info.reason; });
  e.hardDrop();
  assert.equal(e.phase, PHASE.GAME_OVER);
  assert.equal(reason, GAME_OVER_REASON.BLOCK_OUT);
});

test('locking a piece entirely above the playfield ends the game (lock out)', () => {
  const e = newEngine({ bag: fakeBag(['O']), bufferRows: 2 });
  e.start();
  // Stack visible rows fully so the O piece locks immediately on its spawn cells
  // entirely within the buffer rows.
  for (let r = e.board.bufferRows; r < e.board.totalRows; r++) {
    for (let c = 0; c < e.board.cols; c++) {
      e.board.setCell(c, r, { type: 'X' });
    }
  }
  // The O spawned at row=bufferRows-1=1 with cells at rows 1,2. row 2 is filled,
  // so... actually that would be a block-out at spawn since cells collide. Let's
  // re-spawn manually into the buffer region instead.
  // Instead, set the O active piece to row=0 (entirely above visible) and lock.
  // We need to make sure the spawn check passed (it did since we filled AFTER spawn).
  e._active = { type: 'O', rotation: 0, col: 4, row: 0 };
  let reason = null;
  e.on('gameOver', (info) => { reason = info.reason; });
  e.hardDrop();
  // The O at row 0 has cells (4,0),(5,0),(4,1),(5,1). All within bufferRows (0..1).
  // After hard drop it tries to move down but row 2 is filled, so it stays. All
  // cells remain in buffer → lock out.
  assert.equal(reason, GAME_OVER_REASON.LOCK_OUT);
});

// --- snapshot ----------------------------------------------------------

test('snapshot mirrors engine state', () => {
  const e = newEngine({ bag: fakeBag(['T']) });
  e.start();
  const s = e.snapshot();
  assert.equal(s.phase, PHASE.PLAYING);
  assert.equal(s.cols, 10);
  assert.equal(s.visibleRows, 20);
  assert.equal(s.bufferRows, 2);
  assert.equal(s.grid.length, 22);
  assert.equal(s.grid[0].length, 10);
  assert.equal(s.level, 1);
  assert.equal(s.lines, 0);
  assert.equal(s.score, 0);
  assert.equal(s.active.type, 'T');
  assert.ok(Array.isArray(s.active.cells));
  assert.equal(s.active.cells.length, 4);
  assert.ok(Number.isInteger(s.ghostRow));
  assert.ok(s.ghostRow >= s.active.row);
});

test('snapshot grid is a deep copy', () => {
  const e = newEngine({ bag: fakeBag(['T']) });
  e.start();
  const s = e.snapshot();
  s.grid[0][0] = { type: 'TAMPERED' };
  const s2 = e.snapshot();
  assert.equal(s2.grid[0][0], null);
});

// --- spawn position ----------------------------------------------------

test('spawn happens at the top of the buffer / visible boundary', () => {
  const e = newEngine({ bag: fakeBag(['T']), bufferRows: 2 });
  e.start();
  assert.equal(e.activePiece.row, 1, 'T spawns at row=bufferRows-1');
});

// --- events list -------------------------------------------------------

test('events fire in expected order during a play', () => {
  const e = newEngine({ bag: fakeBag(['T', 'O']) });
  const fired = [];
  e.on('start', () => fired.push('start'));
  e.on('spawn', () => fired.push('spawn'));
  e.on('move', () => fired.push('move'));
  e.on('rotate', () => fired.push('rotate'));
  e.on('lock', () => fired.push('lock'));
  e.on('linesCleared', () => fired.push('linesCleared'));
  e.start();
  e.moveLeft();
  e.rotate(1);
  e.hardDrop();
  assert.equal(fired[0], 'start');
  assert.equal(fired[1], 'spawn');
  assert.ok(fired.includes('move'));
  assert.ok(fired.includes('rotate'));
  assert.ok(fired.includes('lock'));
  // After lock comes the next spawn for the O piece.
  const lockIdx = fired.lastIndexOf('lock');
  assert.equal(fired[lockIdx + 1], 'spawn');
});

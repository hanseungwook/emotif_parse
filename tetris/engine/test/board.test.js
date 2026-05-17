'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Board } = require('../board');

test('default board is 10 cols x (20 visible + 2 buffer)', () => {
  const b = new Board();
  assert.equal(b.cols, 10);
  assert.equal(b.visibleRows, 20);
  assert.equal(b.bufferRows, 2);
  assert.equal(b.totalRows, 22);
});

test('rejects invalid dimensions', () => {
  assert.throws(() => new Board({ cols: 2 }), /cols/);
  assert.throws(() => new Board({ visibleRows: 1 }), /visibleRows/);
  assert.throws(() => new Board({ bufferRows: -1 }), /bufferRows/);
});

test('inBounds and cellAt match storage grid', () => {
  const b = new Board();
  assert.equal(b.inBounds(0, 0), true);
  assert.equal(b.inBounds(9, 21), true);
  assert.equal(b.inBounds(-1, 0), false);
  assert.equal(b.inBounds(10, 0), false);
  assert.equal(b.inBounds(0, 22), false);
  assert.equal(b.cellAt(0, 0), null);
  assert.equal(b.cellAt(-1, 0), undefined);
});

test('isCellEmpty treats off-sides and below-floor as blocked, above-grid as empty', () => {
  const b = new Board();
  assert.equal(b.isCellEmpty(-1, 5), false);
  assert.equal(b.isCellEmpty(10, 5), false);
  assert.equal(b.isCellEmpty(0, 22), false);
  assert.equal(b.isCellEmpty(0, -1), true);
  assert.equal(b.isCellEmpty(0, -5), true);
});

test('collides detects overlap with stored cells', () => {
  const b = new Board();
  b.setCell(5, 21, { type: 'T', color: 'purple' });
  assert.equal(b.collides([[5, 21]]), true);
  assert.equal(b.collides([[5, 20]]), false);
  assert.equal(b.collides([[4, 21], [5, 21]]), true);
});

test('lockCells writes cells and reports lock-out signals', () => {
  const b = new Board({ bufferRows: 2 });
  const r = b.lockCells([[3, 1], [3, 2], [4, 2], [5, 2]], { type: 'T', color: 'purple' });
  assert.equal(r.aboveBuffer, false);
  assert.equal(r.anyInVisible, true);
  assert.deepEqual(b.cellAt(3, 1), { type: 'T', color: 'purple' });

  const b2 = new Board({ bufferRows: 2 });
  const r2 = b2.lockCells([[3, 0], [3, 1]], { type: 'O', color: 'yellow' });
  assert.equal(r2.anyInVisible, false, 'cells entirely inside buffer rows count as not visible');

  const b3 = new Board({ bufferRows: 0 });
  const r3 = b3.lockCells([[3, -1], [3, 0]], { type: 'O', color: 'yellow' });
  assert.equal(r3.aboveBuffer, true);
  assert.equal(r3.anyInVisible, true);
});

test('findFullRows and clearRows remove rows and drop content downward', () => {
  const b = new Board({ visibleRows: 4, bufferRows: 0, cols: 4 });
  // Fill bottom row completely
  for (let c = 0; c < 4; c++) b.setCell(c, 3, { type: 'I' });
  // Partial row above
  b.setCell(0, 2, { type: 'I' });
  b.setCell(2, 2, { type: 'I' });

  const full = b.findFullRows();
  assert.deepEqual(full, [3]);

  const cleared = b.clearRows(full);
  assert.equal(cleared, 1);
  // The partial row is now at row 3
  assert.equal(b.cellAt(0, 3).type, 'I');
  assert.equal(b.cellAt(1, 3), null);
  assert.equal(b.cellAt(2, 3).type, 'I');
  // Top row should be empty
  for (let c = 0; c < 4; c++) assert.equal(b.cellAt(c, 0), null);
});

test('clearRows handles multi-line clears', () => {
  const b = new Board({ visibleRows: 4, bufferRows: 0, cols: 4 });
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) b.setCell(c, r, { type: 'I' });
  }
  const full = b.findFullRows();
  assert.equal(full.length, 4);
  const cleared = b.clearRows(full);
  assert.equal(cleared, 4);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) assert.equal(b.cellAt(c, r), null);
  }
});

test('reset clears all cells', () => {
  const b = new Board();
  b.setCell(0, 0, { type: 'T' });
  b.reset();
  assert.equal(b.cellAt(0, 0), null);
});

test('snapshot is a deep copy', () => {
  const b = new Board({ visibleRows: 4, bufferRows: 0, cols: 4 });
  b.setCell(0, 0, { type: 'I' });
  const snap = b.snapshot();
  snap[0][0] = { type: 'TAMPERED' };
  assert.equal(b.cellAt(0, 0).type, 'I');
});

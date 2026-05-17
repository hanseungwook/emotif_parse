'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeGeometry,
  cellToPixel,
  rowToPixel,
  isCellVisible,
  clampCells,
} = require('../geometry');

test('normalizeGeometry applies defaults', () => {
  const g = normalizeGeometry();
  assert.equal(g.columns, 10);
  assert.equal(g.visibleRows, 20);
  assert.equal(g.hiddenRows, 2);
  assert.equal(g.totalRows, 22);
  assert.equal(g.cellSize, 32);
  assert.equal(g.boardPixelWidth, 320);
  assert.equal(g.boardPixelHeight, 640);
  assert.equal(g.padding, 16);
  assert.equal(g.canvasWidth, 320 + 32);
  assert.equal(g.canvasHeight, 640 + 32);
});

test('normalizeGeometry overrides values and rejects bad numbers', () => {
  const g = normalizeGeometry({ columns: 8, visibleRows: 16, hiddenRows: 0, cellSize: 20, padding: 4 });
  assert.equal(g.columns, 8);
  assert.equal(g.visibleRows, 16);
  assert.equal(g.hiddenRows, 0);
  assert.equal(g.cellSize, 20);
  assert.equal(g.padding, 4);

  const fallback = normalizeGeometry({ columns: -5, cellSize: 'big', padding: NaN });
  assert.equal(fallback.columns, 10);
  assert.equal(fallback.cellSize, 32);
  assert.equal(fallback.padding, 16);
});

test('cellToPixel accounts for hidden rows and padding', () => {
  const g = normalizeGeometry({ columns: 10, visibleRows: 20, hiddenRows: 2, cellSize: 30, padding: 10 });
  const top = cellToPixel(g, 0, 2);
  assert.equal(top.x, 10);
  assert.equal(top.y, 10);
  assert.equal(top.width, 30);

  const mid = cellToPixel(g, 3, 5);
  assert.equal(mid.x, 10 + 3 * 30);
  assert.equal(mid.y, 10 + (5 - 2) * 30);
});

test('rowToPixel spans full board width', () => {
  const g = normalizeGeometry({ cellSize: 20, padding: 5, columns: 6, visibleRows: 10, hiddenRows: 1 });
  const rect = rowToPixel(g, 4);
  assert.equal(rect.x, 5);
  assert.equal(rect.width, 120);
  assert.equal(rect.height, 20);
  assert.equal(rect.y, 5 + (4 - 1) * 20);
});

test('isCellVisible respects hidden region', () => {
  const g = normalizeGeometry({ visibleRows: 20, hiddenRows: 2 });
  assert.equal(isCellVisible(g, 0), false);
  assert.equal(isCellVisible(g, 1), false);
  assert.equal(isCellVisible(g, 2), true);
  assert.equal(isCellVisible(g, 21), true);
  assert.equal(isCellVisible(g, 22), false);
});

test('clampCells drops invalid cells', () => {
  const g = normalizeGeometry({ columns: 4, visibleRows: 4, hiddenRows: 0 });
  const result = clampCells(
    [
      { x: 0, y: 0 },
      { x: 4, y: 1 },
      { x: -1, y: 2 },
      { x: 2, y: 4 },
      { x: 1, y: 1.5 },
      null,
      { x: 1, y: 1 },
    ],
    g
  );
  assert.deepEqual(result, [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]);
});

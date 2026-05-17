'use strict';

const {
  DEFAULT_COLUMNS,
  DEFAULT_VISIBLE_ROWS,
  DEFAULT_HIDDEN_ROWS,
  DEFAULT_CELL_SIZE,
  DEFAULT_GUTTER,
} = require('./constants');

function normalizeGeometry(options) {
  const opts = options || {};
  const columns = positiveInt(opts.columns, DEFAULT_COLUMNS);
  const visibleRows = positiveInt(opts.visibleRows || opts.rows, DEFAULT_VISIBLE_ROWS);
  const hiddenRows = nonNegativeInt(opts.hiddenRows, DEFAULT_HIDDEN_ROWS);
  const cellSize = positiveNumber(opts.cellSize, DEFAULT_CELL_SIZE);
  const gutter = nonNegativeNumber(opts.gutter, DEFAULT_GUTTER);
  const padding = nonNegativeNumber(opts.padding, Math.round(cellSize * 0.5));
  const totalRows = visibleRows + hiddenRows;
  const boardPixelWidth = columns * cellSize;
  const boardPixelHeight = visibleRows * cellSize;
  const canvasWidth = boardPixelWidth + padding * 2;
  const canvasHeight = boardPixelHeight + padding * 2;
  return {
    columns,
    visibleRows,
    hiddenRows,
    totalRows,
    cellSize,
    gutter,
    padding,
    boardPixelWidth,
    boardPixelHeight,
    canvasWidth,
    canvasHeight,
  };
}

function cellToPixel(geometry, gridX, gridY) {
  const visibleY = gridY - geometry.hiddenRows;
  return {
    x: geometry.padding + gridX * geometry.cellSize,
    y: geometry.padding + visibleY * geometry.cellSize,
    width: geometry.cellSize,
    height: geometry.cellSize,
  };
}

function rowToPixel(geometry, gridY) {
  const visibleY = gridY - geometry.hiddenRows;
  return {
    x: geometry.padding,
    y: geometry.padding + visibleY * geometry.cellSize,
    width: geometry.boardPixelWidth,
    height: geometry.cellSize,
  };
}

function isCellVisible(geometry, gridY) {
  return gridY >= geometry.hiddenRows && gridY < geometry.totalRows;
}

function clampCells(cells, geometry) {
  if (!Array.isArray(cells)) return [];
  const result = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell) continue;
    const x = cell.x;
    const y = cell.y;
    if (!isFiniteInt(x) || !isFiniteInt(y)) continue;
    if (x < 0 || x >= geometry.columns) continue;
    if (y < 0 || y >= geometry.totalRows) continue;
    result.push({ x, y });
  }
  return result;
}

function positiveInt(value, fallback) {
  const n = Number(value);
  if (!isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function nonNegativeInt(value, fallback) {
  const n = Number(value);
  if (!isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function positiveNumber(value, fallback) {
  const n = Number(value);
  if (!isFinite(n) || n <= 0) return fallback;
  return n;
}

function nonNegativeNumber(value, fallback) {
  const n = Number(value);
  if (!isFinite(n) || n < 0) return fallback;
  return n;
}

function isFiniteInt(value) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
}

module.exports = {
  normalizeGeometry,
  cellToPixel,
  rowToPixel,
  isCellVisible,
  clampCells,
};

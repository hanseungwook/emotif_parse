'use strict';

const { ValidationError } = require('./errors');
const { vectorFor } = require('./direction');

const DEFAULT_WIDTH = 24;
const DEFAULT_HEIGHT = 24;
const MIN_DIM = 6;
const MAX_DIM = 200;

function createBoard(input) {
  const opts = input || {};
  const width = opts.width == null ? DEFAULT_WIDTH : opts.width;
  const height = opts.height == null ? DEFAULT_HEIGHT : opts.height;
  if (!Number.isInteger(width) || width < MIN_DIM || width > MAX_DIM) {
    throw new ValidationError(`board.width must be an integer in [${MIN_DIM}, ${MAX_DIM}]`);
  }
  if (!Number.isInteger(height) || height < MIN_DIM || height > MAX_DIM) {
    throw new ValidationError(`board.height must be an integer in [${MIN_DIM}, ${MAX_DIM}]`);
  }
  return Object.freeze({
    width,
    height,
    wrapEdges: !!opts.wrapEdges,
  });
}

function cellsEqual(a, b) {
  return !!a && !!b && a.x === b.x && a.y === b.y;
}

function inBounds(board, cell) {
  if (!cell) return false;
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.y) &&
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < board.width &&
    cell.y < board.height
  );
}

function assertCell(cell) {
  if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y)) {
    throw new ValidationError('cell must have integer x and y');
  }
  return cell;
}

function assertInBounds(board, cell) {
  if (!inBounds(board, cell)) {
    throw new ValidationError(
      `cell (${cell ? cell.x : '?'}, ${cell ? cell.y : '?'}) out of board bounds ${board.width}x${board.height}`
    );
  }
  return cell;
}

// Apply a direction to a cell. If the board wraps edges, positions wrap around;
// otherwise the position can fall out of bounds (caller decides whether that
// matters — usually it's death).
function step(board, cell, direction) {
  assertCell(cell);
  const v = vectorFor(direction);
  const nx = cell.x + v.x;
  const ny = cell.y + v.y;
  if (board.wrapEdges) {
    return {
      x: ((nx % board.width) + board.width) % board.width,
      y: ((ny % board.height) + board.height) % board.height,
    };
  }
  return { x: nx, y: ny };
}

function cellKey(cell) {
  return `${cell.x},${cell.y}`;
}

function cellsToSet(cells) {
  const set = new Set();
  for (const c of cells || []) {
    set.add(cellKey(c));
  }
  return set;
}

function totalCells(board) {
  return board.width * board.height;
}

module.exports = {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  MIN_DIM,
  MAX_DIM,
  createBoard,
  cellsEqual,
  inBounds,
  assertCell,
  assertInBounds,
  step,
  cellKey,
  cellsToSet,
  totalCells,
};

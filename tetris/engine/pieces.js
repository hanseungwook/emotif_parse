'use strict';

// SRS-style tetromino definitions.
// Each rotation lists 4 cells as [col, row] offsets relative to the bounding-box top-left.
// Rotation indices: 0 = spawn, 1 = R (CW from spawn), 2 = 180, 3 = L (CCW from spawn).
// Row increases downward. Coordinates match the wall-kick tables in rotation.js.

const PIECES = Object.freeze({
  I: Object.freeze({
    type: 'I',
    color: 'cyan',
    bboxSize: 4,
    spawnCol: 3,
    rotations: Object.freeze([
      Object.freeze([[0, 1], [1, 1], [2, 1], [3, 1]]),
      Object.freeze([[2, 0], [2, 1], [2, 2], [2, 3]]),
      Object.freeze([[0, 2], [1, 2], [2, 2], [3, 2]]),
      Object.freeze([[1, 0], [1, 1], [1, 2], [1, 3]]),
    ]),
  }),
  O: Object.freeze({
    type: 'O',
    color: 'yellow',
    bboxSize: 2,
    spawnCol: 4,
    rotations: Object.freeze([
      Object.freeze([[0, 0], [1, 0], [0, 1], [1, 1]]),
      Object.freeze([[0, 0], [1, 0], [0, 1], [1, 1]]),
      Object.freeze([[0, 0], [1, 0], [0, 1], [1, 1]]),
      Object.freeze([[0, 0], [1, 0], [0, 1], [1, 1]]),
    ]),
  }),
  T: Object.freeze({
    type: 'T',
    color: 'purple',
    bboxSize: 3,
    spawnCol: 3,
    rotations: Object.freeze([
      Object.freeze([[1, 0], [0, 1], [1, 1], [2, 1]]),
      Object.freeze([[1, 0], [1, 1], [2, 1], [1, 2]]),
      Object.freeze([[0, 1], [1, 1], [2, 1], [1, 2]]),
      Object.freeze([[1, 0], [0, 1], [1, 1], [1, 2]]),
    ]),
  }),
  S: Object.freeze({
    type: 'S',
    color: 'green',
    bboxSize: 3,
    spawnCol: 3,
    rotations: Object.freeze([
      Object.freeze([[1, 0], [2, 0], [0, 1], [1, 1]]),
      Object.freeze([[1, 0], [1, 1], [2, 1], [2, 2]]),
      Object.freeze([[1, 1], [2, 1], [0, 2], [1, 2]]),
      Object.freeze([[0, 0], [0, 1], [1, 1], [1, 2]]),
    ]),
  }),
  Z: Object.freeze({
    type: 'Z',
    color: 'red',
    bboxSize: 3,
    spawnCol: 3,
    rotations: Object.freeze([
      Object.freeze([[0, 0], [1, 0], [1, 1], [2, 1]]),
      Object.freeze([[2, 0], [1, 1], [2, 1], [1, 2]]),
      Object.freeze([[0, 1], [1, 1], [1, 2], [2, 2]]),
      Object.freeze([[1, 0], [0, 1], [1, 1], [0, 2]]),
    ]),
  }),
  J: Object.freeze({
    type: 'J',
    color: 'blue',
    bboxSize: 3,
    spawnCol: 3,
    rotations: Object.freeze([
      Object.freeze([[0, 0], [0, 1], [1, 1], [2, 1]]),
      Object.freeze([[1, 0], [2, 0], [1, 1], [1, 2]]),
      Object.freeze([[0, 1], [1, 1], [2, 1], [2, 2]]),
      Object.freeze([[1, 0], [1, 1], [0, 2], [1, 2]]),
    ]),
  }),
  L: Object.freeze({
    type: 'L',
    color: 'orange',
    bboxSize: 3,
    spawnCol: 3,
    rotations: Object.freeze([
      Object.freeze([[2, 0], [0, 1], [1, 1], [2, 1]]),
      Object.freeze([[1, 0], [1, 1], [1, 2], [2, 2]]),
      Object.freeze([[0, 1], [1, 1], [2, 1], [0, 2]]),
      Object.freeze([[0, 0], [1, 0], [1, 1], [1, 2]]),
    ]),
  }),
});

const PIECE_TYPES = Object.freeze(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);

function normalizeRotation(rotation) {
  const r = Number(rotation) | 0;
  return ((r % 4) + 4) % 4;
}

function getPiece(type) {
  const piece = PIECES[type];
  if (!piece) throw new RangeError(`Unknown piece type: ${type}`);
  return piece;
}

function getCells(type, rotation) {
  return getPiece(type).rotations[normalizeRotation(rotation)];
}

function getAbsoluteCells(piece) {
  if (!piece || typeof piece.type !== 'string') {
    throw new TypeError('piece must have a type');
  }
  const cells = getCells(piece.type, piece.rotation || 0);
  const col = piece.col | 0;
  const row = piece.row | 0;
  const out = new Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    out[i] = [col + cells[i][0], row + cells[i][1]];
  }
  return out;
}

module.exports = {
  PIECES,
  PIECE_TYPES,
  getPiece,
  getCells,
  getAbsoluteCells,
  normalizeRotation,
};

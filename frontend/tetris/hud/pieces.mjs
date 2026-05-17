// Canonical tetromino shape definitions used by the next-piece preview.
// The HUD does not depend on the gameplay core; it carries its own copy of
// the standard shapes so it can render a piece given just its kind ('I',
// 'O', 'T', 'S', 'Z', 'J', 'L'). Coordinates use a top-left origin where
// each entry is { x, y } in a 4x4 (or 2x2 / 3x3) box.

export const PIECE_KINDS = Object.freeze(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);

const I = {
  kind: 'I',
  cells: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
  boxWidth: 4,
  boxHeight: 2,
  color: '#22d3ee',
};

const O = {
  kind: 'O',
  cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  boxWidth: 2,
  boxHeight: 2,
  color: '#facc15',
};

const T = {
  kind: 'T',
  cells: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }],
  boxWidth: 3,
  boxHeight: 2,
  color: '#a855f7',
};

const S = {
  kind: 'S',
  cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  boxWidth: 3,
  boxHeight: 2,
  color: '#22c55e',
};

const Z = {
  kind: 'Z',
  cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  boxWidth: 3,
  boxHeight: 2,
  color: '#ef4444',
};

const J = {
  kind: 'J',
  cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  boxWidth: 3,
  boxHeight: 2,
  color: '#3b82f6',
};

const L = {
  kind: 'L',
  cells: [{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  boxWidth: 3,
  boxHeight: 2,
  color: '#f97316',
};

const PIECES = Object.freeze({ I, O, T, S, Z, J, L });

export function getPieceShape(kind) {
  if (typeof kind !== 'string') return null;
  const shape = PIECES[kind.toUpperCase()];
  return shape || null;
}

export function isValidPieceKind(kind) {
  return getPieceShape(kind) !== null;
}

export { PIECES };

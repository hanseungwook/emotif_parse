'use strict';

// SRS wall-kick tables.
//
// Source: https://tetris.wiki/Super_Rotation_System (Y-up convention).
// The tables below are pre-converted to a row-down (screen) convention: dy is
// negated so a positive dy moves the piece toward the floor.
//
// Indexed by `${fromRotation}>${toRotation}`. Each entry is the ordered list of
// (dCol, dRow) offsets to try when rotating, starting with the "no kick" (0,0).

const JLSTZ_KICKS = Object.freeze({
  '0>1': Object.freeze([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]),
  '1>0': Object.freeze([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]),
  '1>2': Object.freeze([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]),
  '2>1': Object.freeze([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]),
  '2>3': Object.freeze([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]),
  '3>2': Object.freeze([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]),
  '3>0': Object.freeze([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]),
  '0>3': Object.freeze([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]),
});

const I_KICKS = Object.freeze({
  '0>1': Object.freeze([[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]]),
  '1>0': Object.freeze([[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]]),
  '1>2': Object.freeze([[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]),
  '2>1': Object.freeze([[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]]),
  '2>3': Object.freeze([[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]]),
  '3>2': Object.freeze([[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]]),
  '3>0': Object.freeze([[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]]),
  '0>3': Object.freeze([[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]),
});

const NO_KICK = Object.freeze([[0, 0]]);

const O_KICKS = Object.freeze({
  '0>1': NO_KICK, '1>0': NO_KICK,
  '1>2': NO_KICK, '2>1': NO_KICK,
  '2>3': NO_KICK, '3>2': NO_KICK,
  '3>0': NO_KICK, '0>3': NO_KICK,
});

function getKickTable(type) {
  if (type === 'I') return I_KICKS;
  if (type === 'O') return O_KICKS;
  return JLSTZ_KICKS;
}

function getKicks(type, fromRotation, toRotation) {
  const table = getKickTable(type);
  const key = `${fromRotation}>${toRotation}`;
  const list = table[key];
  if (!list) {
    throw new RangeError(`No kicks defined for ${type} ${key}`);
  }
  return list;
}

module.exports = { JLSTZ_KICKS, I_KICKS, O_KICKS, getKickTable, getKicks };

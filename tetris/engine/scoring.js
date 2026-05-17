'use strict';

const LINE_CLEAR_POINTS = Object.freeze({
  1: 100,
  2: 300,
  3: 500,
  4: 800,
});

function scoreLineClear(linesCleared, level) {
  const lines = linesCleared | 0;
  if (lines < 1 || lines > 4) return 0;
  const lvl = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  return LINE_CLEAR_POINTS[lines] * lvl;
}

function scoreSoftDrop(rows) {
  const r = rows | 0;
  return r > 0 ? r : 0;
}

function scoreHardDrop(rows) {
  const r = rows | 0;
  return r > 0 ? r * 2 : 0;
}

module.exports = { LINE_CLEAR_POINTS, scoreLineClear, scoreSoftDrop, scoreHardDrop };

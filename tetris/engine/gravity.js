'use strict';

// Gravity table: milliseconds per row at each level.
// Derived from the Tetris Guideline formula
//   seconds-per-row = (0.8 - ((level - 1) * 0.007)) ^ (level - 1)
// rounded to milliseconds. Beyond level 20 we cap at the fastest entry (1ms/row).

const TABLE = Object.freeze([
  1000, 793, 618, 473, 355, 262, 190, 135, 94, 64,
  43, 28, 18, 11, 7, 5, 3, 2, 1, 1,
]);

const DEFAULT_LINES_PER_LEVEL = 10;

function gravityMsForLevel(level) {
  if (!Number.isFinite(level) || level < 1) return TABLE[0];
  const idx = Math.min(Math.floor(level), TABLE.length) - 1;
  return TABLE[idx];
}

function levelForLines(linesCleared, startLevel, linesPerLevel) {
  const start = Number.isFinite(startLevel) && startLevel >= 1 ? Math.floor(startLevel) : 1;
  const per = Number.isFinite(linesPerLevel) && linesPerLevel >= 1
    ? Math.floor(linesPerLevel)
    : DEFAULT_LINES_PER_LEVEL;
  const lines = linesCleared > 0 ? Math.floor(linesCleared) : 0;
  return start + Math.floor(lines / per);
}

module.exports = { TABLE, gravityMsForLevel, levelForLines, DEFAULT_LINES_PER_LEVEL };

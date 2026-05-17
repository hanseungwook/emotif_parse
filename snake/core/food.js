'use strict';

const { cellKey } = require('./grid');

// Pick a uniformly random cell that is not occupied by `blockedKeys`. Returns
// null when the board is full (e.g., snake fills every cell — a win condition
// for some variants; the engine treats it as game complete).
function spawnFood({ width, height, blockedKeys, rng }) {
  const total = width * height;
  if (blockedKeys.size >= total) return null;
  const candidates = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = cellKey(x, y);
      if (!blockedKeys.has(key)) candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return null;
  const idx = Math.floor(rng() * candidates.length) % candidates.length;
  return candidates[idx];
}

function isAt(food, point) {
  if (!food) return false;
  return food.x === point.x && food.y === point.y;
}

module.exports = { spawnFood, isAt };

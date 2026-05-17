'use strict';

const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

const OPPOSITE = Object.freeze({
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
});

function isDirection(name) {
  return Object.prototype.hasOwnProperty.call(DIRECTIONS, name);
}

function isOpposite(a, b) {
  return OPPOSITE[a] === b;
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function inBounds(point, width, height) {
  return point.x >= 0 && point.y >= 0 && point.x < width && point.y < height;
}

function step(point, direction) {
  const delta = DIRECTIONS[direction];
  return { x: point.x + delta.x, y: point.y + delta.y };
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

module.exports = {
  DIRECTIONS,
  OPPOSITE,
  isDirection,
  isOpposite,
  cellKey,
  inBounds,
  step,
  samePoint,
};

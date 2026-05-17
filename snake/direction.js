'use strict';

const { ValidationError } = require('./errors');

const DIRECTION = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
});

const DIRECTIONS = Object.freeze([
  DIRECTION.UP,
  DIRECTION.DOWN,
  DIRECTION.LEFT,
  DIRECTION.RIGHT,
]);

const DIRECTION_VECTORS = Object.freeze({
  [DIRECTION.UP]: Object.freeze({ x: 0, y: -1 }),
  [DIRECTION.DOWN]: Object.freeze({ x: 0, y: 1 }),
  [DIRECTION.LEFT]: Object.freeze({ x: -1, y: 0 }),
  [DIRECTION.RIGHT]: Object.freeze({ x: 1, y: 0 }),
});

const OPPOSITES = Object.freeze({
  [DIRECTION.UP]: DIRECTION.DOWN,
  [DIRECTION.DOWN]: DIRECTION.UP,
  [DIRECTION.LEFT]: DIRECTION.RIGHT,
  [DIRECTION.RIGHT]: DIRECTION.LEFT,
});

function isDirection(value) {
  return typeof value === 'string' && DIRECTIONS.includes(value);
}

function assertDirection(value) {
  if (!isDirection(value)) {
    throw new ValidationError(`invalid direction: ${String(value)}`);
  }
  return value;
}

function vectorFor(direction) {
  assertDirection(direction);
  return DIRECTION_VECTORS[direction];
}

function opposite(direction) {
  assertDirection(direction);
  return OPPOSITES[direction];
}

function isOpposite(a, b) {
  return isDirection(a) && isDirection(b) && OPPOSITES[a] === b;
}

module.exports = {
  DIRECTION,
  DIRECTIONS,
  DIRECTION_VECTORS,
  isDirection,
  assertDirection,
  vectorFor,
  opposite,
  isOpposite,
};

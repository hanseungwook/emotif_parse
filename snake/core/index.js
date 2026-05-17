'use strict';

const { createEngine, DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_TICK_MS } = require('./engine');
const { STATUS, MODE, OUTCOME } = require('./state');
const { SKINS, DEFAULT_SKIN_ID, listSkins, getSkin, hasSkin } = require('./skins');
const { DIRECTIONS, isDirection, isOpposite, step, samePoint } = require('./grid');
const { PATTERNS, DEFAULT_PATTERN, generateObstacles } = require('./obstacles');
const {
  KEY_TO_DIRECTION,
  directionForKey,
  actionForKey,
  attachKeyboard,
} = require('./input');

module.exports = {
  createEngine,
  STATUS,
  MODE,
  OUTCOME,
  SKINS,
  DEFAULT_SKIN_ID,
  listSkins,
  getSkin,
  hasSkin,
  DIRECTIONS,
  isDirection,
  isOpposite,
  step,
  samePoint,
  PATTERNS,
  DEFAULT_PATTERN,
  generateObstacles,
  KEY_TO_DIRECTION,
  directionForKey,
  actionForKey,
  attachKeyboard,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_TICK_MS,
};

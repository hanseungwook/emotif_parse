'use strict';

const pieces = require('./pieces');
const bag = require('./bag');
const board = require('./board');
const rotation = require('./rotation');
const gravity = require('./gravity');
const scoring = require('./scoring');
const events = require('./events');
const engine = require('./engine');

function createTetrisEngine(options) {
  return new engine.TetrisEngine(options);
}

module.exports = {
  // Main engine
  TetrisEngine: engine.TetrisEngine,
  createTetrisEngine,
  PHASE: engine.PHASE,
  GAME_OVER_REASON: engine.GAME_OVER_REASON,
  DEFAULTS: engine.DEFAULTS,

  // Pieces
  PIECES: pieces.PIECES,
  PIECE_TYPES: pieces.PIECE_TYPES,
  getPiece: pieces.getPiece,
  getCells: pieces.getCells,
  getAbsoluteCells: pieces.getAbsoluteCells,
  normalizeRotation: pieces.normalizeRotation,

  // Board
  Board: board.Board,

  // Bag / RNG
  SevenBag: bag.SevenBag,
  createSeededRng: bag.createSeededRng,

  // Rotation system
  JLSTZ_KICKS: rotation.JLSTZ_KICKS,
  I_KICKS: rotation.I_KICKS,
  O_KICKS: rotation.O_KICKS,
  getKickTable: rotation.getKickTable,
  getKicks: rotation.getKicks,

  // Gravity / level progression
  GRAVITY_TABLE: gravity.TABLE,
  gravityMsForLevel: gravity.gravityMsForLevel,
  levelForLines: gravity.levelForLines,

  // Scoring
  LINE_CLEAR_POINTS: scoring.LINE_CLEAR_POINTS,
  scoreLineClear: scoring.scoreLineClear,
  scoreSoftDrop: scoring.scoreSoftDrop,
  scoreHardDrop: scoring.scoreHardDrop,

  // Event bus
  EventBus: events.EventBus,
};

'use strict';

const DEFAULT_COLUMNS = 10;
const DEFAULT_VISIBLE_ROWS = 20;
const DEFAULT_HIDDEN_ROWS = 2;
const DEFAULT_CELL_SIZE = 32;
const DEFAULT_GUTTER = 1;

const STATES = Object.freeze({
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game-over',
  READY: 'ready',
  LEVEL_UP: 'level-up',
});

const EFFECTS = Object.freeze({
  LINE_CLEAR: 'line-clear',
  LEVEL_UP: 'level-up',
  GAME_OVER: 'game-over',
  HARD_DROP: 'hard-drop',
  LOCK: 'lock',
});

const TETROMINO_TYPES = Object.freeze(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);

const DEFAULT_LINE_CLEAR_MS = 320;
const DEFAULT_GAME_OVER_FADE_MS = 720;
const DEFAULT_LEVEL_UP_MS = 480;
const DEFAULT_HARD_DROP_MS = 220;
const DEFAULT_LOCK_FLASH_MS = 140;

module.exports = {
  DEFAULT_COLUMNS,
  DEFAULT_VISIBLE_ROWS,
  DEFAULT_HIDDEN_ROWS,
  DEFAULT_CELL_SIZE,
  DEFAULT_GUTTER,
  STATES,
  EFFECTS,
  TETROMINO_TYPES,
  DEFAULT_LINE_CLEAR_MS,
  DEFAULT_GAME_OVER_FADE_MS,
  DEFAULT_LEVEL_UP_MS,
  DEFAULT_HARD_DROP_MS,
  DEFAULT_LOCK_FLASH_MS,
};

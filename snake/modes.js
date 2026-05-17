'use strict';

const { ValidationError } = require('./errors');

// Game mode descriptors. Modes change spawn rules, scoring, win conditions —
// the data model only needs to know which knobs to expose. Values stay flat so
// they serialize cleanly into highscores and saved sessions.

const GAME_MODE = Object.freeze({
  CLASSIC: 'classic',
  OBSTACLE: 'obstacle',
  TIME_ATTACK: 'time_attack',
  ZEN: 'zen',
});

const MODE_DESCRIPTORS = Object.freeze({
  [GAME_MODE.CLASSIC]: Object.freeze({
    id: GAME_MODE.CLASSIC,
    label: 'Classic',
    description: 'Empty board. Eat, grow, do not bite yourself.',
    obstacleLayoutRequired: false,
    tickIntervalMs: 120,
    pointsPerFood: 10,
    wallsKill: true,
  }),
  [GAME_MODE.OBSTACLE]: Object.freeze({
    id: GAME_MODE.OBSTACLE,
    label: 'Obstacle',
    description: 'Curated maps with walls and blocks. Higher rewards.',
    obstacleLayoutRequired: true,
    tickIntervalMs: 130,
    pointsPerFood: 15,
    wallsKill: true,
  }),
  [GAME_MODE.TIME_ATTACK]: Object.freeze({
    id: GAME_MODE.TIME_ATTACK,
    label: 'Time Attack',
    description: 'Score as much as possible inside the timer.',
    obstacleLayoutRequired: false,
    tickIntervalMs: 90,
    pointsPerFood: 20,
    wallsKill: true,
    timeLimitSec: 120,
  }),
  [GAME_MODE.ZEN]: Object.freeze({
    id: GAME_MODE.ZEN,
    label: 'Zen',
    description: 'Wrapping edges, slower pace, no high score.',
    obstacleLayoutRequired: false,
    tickIntervalMs: 160,
    pointsPerFood: 5,
    wallsKill: false,
    wrapEdges: true,
    persistsHighScore: false,
  }),
});

function listModes() {
  return Object.values(MODE_DESCRIPTORS);
}

function getMode(modeId) {
  const desc = MODE_DESCRIPTORS[modeId];
  if (!desc) throw new ValidationError(`unknown game mode: ${modeId}`);
  return desc;
}

function isObstacleMode(modeId) {
  return modeId === GAME_MODE.OBSTACLE;
}

function modePersistsHighScore(modeId) {
  const desc = getMode(modeId);
  return desc.persistsHighScore !== false;
}

module.exports = {
  GAME_MODE,
  MODE_DESCRIPTORS,
  listModes,
  getMode,
  isObstacleMode,
  modePersistsHighScore,
};

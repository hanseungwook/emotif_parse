'use strict';

const STATUS = Object.freeze({
  idle: 'idle',
  playing: 'playing',
  paused: 'paused',
  gameOver: 'gameOver',
});

const MODE = Object.freeze({
  classic: 'classic',
  obstacle: 'obstacle',
});

const OUTCOME = Object.freeze({
  wallCollision: 'wallCollision',
  selfCollision: 'selfCollision',
  obstacleCollision: 'obstacleCollision',
});

function isValidStatus(status) {
  return Object.prototype.hasOwnProperty.call(STATUS, status);
}

function isValidMode(mode) {
  return Object.prototype.hasOwnProperty.call(MODE, mode);
}

module.exports = { STATUS, MODE, OUTCOME, isValidStatus, isValidMode };

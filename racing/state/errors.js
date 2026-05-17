'use strict';

class RaceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'RaceError';
    this.code = code || 'RACE_ERROR';
  }
}

class ValidationError extends RaceError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

class StateError extends RaceError {
  constructor(message, fromPhase, action) {
    super(message, 'STATE_ERROR');
    this.name = 'StateError';
    this.fromPhase = fromPhase || null;
    this.action = action || null;
  }
}

module.exports = {
  RaceError,
  ValidationError,
  StateError,
};

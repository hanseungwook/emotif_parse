'use strict';

class ScoringError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ScoringError';
    this.code = code || 'SCORING_ERROR';
  }
}

class ValidationError extends ScoringError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

class StateError extends ScoringError {
  constructor(message) {
    super(message, 'STATE_ERROR');
    this.name = 'StateError';
  }
}

module.exports = {
  ScoringError,
  ValidationError,
  StateError,
};

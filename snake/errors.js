'use strict';

class SnakeError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SnakeError';
    this.code = code || 'SNAKE_ERROR';
  }
}

class ValidationError extends SnakeError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

class NotFoundError extends SnakeError {
  constructor(message) {
    super(message || 'entity not found', 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class PersistenceError extends SnakeError {
  constructor(message, cause) {
    super(message || 'persistence failed', 'PERSISTENCE_ERROR');
    this.name = 'PersistenceError';
    if (cause) this.cause = cause;
  }
}

class MigrationError extends SnakeError {
  constructor(message) {
    super(message || 'migration failed', 'MIGRATION_ERROR');
    this.name = 'MigrationError';
  }
}

module.exports = {
  SnakeError,
  ValidationError,
  NotFoundError,
  PersistenceError,
  MigrationError,
};

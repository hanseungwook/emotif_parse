'use strict';

class OperationsError extends Error {
  constructor(message, code, options) {
    super(message);
    this.name = 'OperationsError';
    this.code = code || 'OPERATIONS_ERROR';
    const opts = options || {};
    if (opts.cause) this.cause = opts.cause;
    if (opts.recoverable === false) {
      this.recoverable = false;
    } else {
      this.recoverable = true;
    }
    if (opts.details) this.details = opts.details;
  }
}

class SkinLoadError extends OperationsError {
  constructor(message, options) {
    super(message || 'failed to load skin', 'SKIN_LOAD_FAILED', options);
    this.name = 'SkinLoadError';
  }
}

class ObstacleGenerationError extends OperationsError {
  constructor(message, options) {
    super(
      message || 'failed to generate obstacle layout',
      'OBSTACLE_GENERATION_FAILED',
      options
    );
    this.name = 'ObstacleGenerationError';
  }
}

class SnapshotCorruptError extends OperationsError {
  constructor(message, options) {
    const opts = Object.assign({ recoverable: false }, options || {});
    super(message || 'snapshot is corrupt', 'SNAPSHOT_CORRUPT', opts);
    this.name = 'SnapshotCorruptError';
  }
}

class RecoveryFailedError extends OperationsError {
  constructor(message, options) {
    super(message || 'recovery failed', 'RECOVERY_FAILED', options);
    this.name = 'RecoveryFailedError';
  }
}

class InvalidStateError extends OperationsError {
  constructor(message, options) {
    const opts = Object.assign({ recoverable: false }, options || {});
    super(message || 'operation invalid in current state', 'INVALID_STATE', opts);
    this.name = 'InvalidStateError';
  }
}

function serializeError(err) {
  if (!err) return null;
  return {
    name: err.name || 'Error',
    code: err.code || null,
    message: err.message || String(err),
    recoverable: err.recoverable !== false,
  };
}

module.exports = {
  OperationsError,
  SkinLoadError,
  ObstacleGenerationError,
  SnapshotCorruptError,
  RecoveryFailedError,
  InvalidStateError,
  serializeError,
};

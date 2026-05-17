'use strict';

const { EventEmitter } = require('./events');
const {
  STATES,
  STATE_VALUES,
  TRANSITIONS,
  isState,
  canTransition,
  assertTransition,
} = require('./states');
const {
  OperationsError,
  SkinLoadError,
  ObstacleGenerationError,
  SnapshotCorruptError,
  RecoveryFailedError,
  InvalidStateError,
  serializeError,
} = require('./errors');
const {
  SkinCatalog,
  BUILTIN_SKINS,
  DEFAULT_SKIN_ID,
  normalizeSkin,
} = require('./skinCatalog');
const {
  ObstacleLayoutLoader,
  DIFFICULTIES,
  DEFAULT_GRID,
  generateLayout,
  coerceSeed,
} = require('./obstacleLayoutLoader');
const {
  SnapshotStore,
  MemoryStorage,
  SNAPSHOT_VERSION,
  validateSnapshot,
} = require('./snapshotStore');
const { OperationsRuntime } = require('./operationsRuntime');

function createOperationsRuntime(options) {
  return new OperationsRuntime(options || {});
}

module.exports = {
  createOperationsRuntime,
  OperationsRuntime,
  EventEmitter,
  STATES,
  STATE_VALUES,
  TRANSITIONS,
  isState,
  canTransition,
  assertTransition,
  OperationsError,
  SkinLoadError,
  ObstacleGenerationError,
  SnapshotCorruptError,
  RecoveryFailedError,
  InvalidStateError,
  serializeError,
  SkinCatalog,
  BUILTIN_SKINS,
  DEFAULT_SKIN_ID,
  normalizeSkin,
  ObstacleLayoutLoader,
  DIFFICULTIES,
  DEFAULT_GRID,
  generateLayout,
  coerceSeed,
  SnapshotStore,
  MemoryStorage,
  SNAPSHOT_VERSION,
  validateSnapshot,
};

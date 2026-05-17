'use strict';

// Public API for the Snake data model. This module is the single entry point
// for the rest of the app — game runtime, renderer, and UI all import from
// here so internal modules can be reorganized without breaking callers.

const { EventEmitter } = require('./eventEmitter');
const { defaultClock, createIdGenerator } = require('./ids');

const {
  SnakeError,
  ValidationError,
  NotFoundError,
  PersistenceError,
  MigrationError,
} = require('./errors');

const {
  DIRECTION,
  DIRECTIONS,
  DIRECTION_VECTORS,
  isDirection,
  assertDirection,
  vectorFor,
  opposite,
  isOpposite,
} = require('./direction');

const {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  MIN_DIM,
  MAX_DIM,
  createBoard,
  cellsEqual,
  inBounds,
  assertCell,
  assertInBounds,
  step,
  cellKey,
  cellsToSet,
  totalCells,
} = require('./board');

const {
  DEFAULT_LENGTH,
  createSnake,
  head,
  tail,
  length: snakeLength,
  bodySet,
  occupies,
  queueDirection,
  advance,
  applyGrowth,
  consumeGrowth,
  kill,
  snapshot: snapshotSnake,
} = require('./snake');

const {
  SKIN_RARITY,
  SKIN_PATTERNS,
  EYE_STYLES,
  UNLOCK_KIND,
  createSkin,
  isSkinUnlocked,
} = require('./skins');

const {
  OBSTACLE_KIND,
  LAYOUT_DIFFICULTY,
  createObstacle,
  createObstacleLayout,
  layoutBlockedCells,
  layoutToGrid,
} = require('./obstacles');

const {
  GAME_MODE,
  MODE_DESCRIPTORS,
  listModes,
  getMode,
  isObstacleMode,
  modePersistsHighScore,
} = require('./modes');

const {
  SESSION_STATUS,
  FOOD_KIND,
  FOOD_POINTS,
  createFood,
  createGameSession,
  start: startSession,
  pause: pauseSession,
  resume: resumeSession,
  gameOver: endSession,
  setSnake,
  setFoods,
  addScore,
  tick: tickSession,
  recordFoodEaten,
  recordObstacleHit,
  snapshot: snapshotSession,
  restore: restoreSession,
  occupiedKeys,
} = require('./gameSession');

const {
  HIGH_SCORE_LIMIT_PER_MODE,
  createHighScore,
  compareHighScores,
  insertHighScore,
  isPersonalBest,
} = require('./highScore');

const {
  DEFAULT_PLAYER_ID,
  DEFAULT_PLAYER_NAME,
  createPlayer,
  createStats,
  createPreferences,
  setEquippedSkin,
  unlockSkin,
  recordObstacleClear,
  recordGameFinished,
  setPreferences,
  setName,
} = require('./player');

const {
  GameStore,
  emptyState,
  selectPlayer,
  selectCatalog,
  selectSession,
  selectHighScores,
  selectEquippedSkin,
  selectUnlockedSkins,
  selectAvailableSkins,
  selectObstacleLayout,
  selectObstacleLayoutsByDifficulty,
} = require('./store');

const {
  PersistenceManager,
  SCHEMA_VERSION,
  DEFAULT_NAMESPACE,
} = require('./persistence');

const { MemoryStorageAdapter } = require('./memoryStorageAdapter');
const { LocalStorageAdapter } = require('./localStorageAdapter');

const {
  SkinRepository,
  ObstacleLayoutRepository,
  CatalogRepository,
  PlayerRepository,
  HighScoreRepository,
  Repositories,
  loadSeedCatalog,
  buildSeedCatalogSync,
} = require('./repositories');

const {
  SEED_SKINS,
  SEED_OBSTACLE_LAYOUTS,
  buildSeedSkins,
  buildSeedObstacleLayouts,
} = require('./seedData');

// Convenience factory: wire up Repositories + GameStore + hydrate. Apps that
// don't care about wiring details can call `createGame()` and start playing.
async function createGame(options) {
  const opts = options || {};
  const persistence = opts.persistence || new PersistenceManager({ adapter: opts.adapter });
  const repos = opts.repositories || new Repositories({ persistence });
  const store = opts.store || new GameStore();
  store.setLoading(true);
  const initial = await repos.hydrate();
  store.hydrate(initial);
  return { store, repositories: repos, persistence };
}

module.exports = {
  // utilities
  EventEmitter,
  defaultClock,
  createIdGenerator,

  // errors
  SnakeError,
  ValidationError,
  NotFoundError,
  PersistenceError,
  MigrationError,

  // direction
  DIRECTION,
  DIRECTIONS,
  DIRECTION_VECTORS,
  isDirection,
  assertDirection,
  vectorFor,
  opposite,
  isOpposite,

  // board
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  MIN_DIM,
  MAX_DIM,
  createBoard,
  cellsEqual,
  inBounds,
  assertCell,
  assertInBounds,
  step,
  cellKey,
  cellsToSet,
  totalCells,

  // snake
  DEFAULT_LENGTH,
  createSnake,
  head,
  tail,
  snakeLength,
  bodySet,
  occupies,
  queueDirection,
  advance,
  applyGrowth,
  consumeGrowth,
  kill,
  snapshotSnake,

  // skins
  SKIN_RARITY,
  SKIN_PATTERNS,
  EYE_STYLES,
  UNLOCK_KIND,
  createSkin,
  isSkinUnlocked,

  // obstacles
  OBSTACLE_KIND,
  LAYOUT_DIFFICULTY,
  createObstacle,
  createObstacleLayout,
  layoutBlockedCells,
  layoutToGrid,

  // modes
  GAME_MODE,
  MODE_DESCRIPTORS,
  listModes,
  getMode,
  isObstacleMode,
  modePersistsHighScore,

  // session
  SESSION_STATUS,
  FOOD_KIND,
  FOOD_POINTS,
  createFood,
  createGameSession,
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  setSnake,
  setFoods,
  addScore,
  tickSession,
  recordFoodEaten,
  recordObstacleHit,
  snapshotSession,
  restoreSession,
  occupiedKeys,

  // high score
  HIGH_SCORE_LIMIT_PER_MODE,
  createHighScore,
  compareHighScores,
  insertHighScore,
  isPersonalBest,

  // player
  DEFAULT_PLAYER_ID,
  DEFAULT_PLAYER_NAME,
  createPlayer,
  createStats,
  createPreferences,
  setEquippedSkin,
  unlockSkin,
  recordObstacleClear,
  recordGameFinished,
  setPreferences,
  setName,

  // store
  GameStore,
  emptyState,
  selectPlayer,
  selectCatalog,
  selectSession,
  selectHighScores,
  selectEquippedSkin,
  selectUnlockedSkins,
  selectAvailableSkins,
  selectObstacleLayout,
  selectObstacleLayoutsByDifficulty,

  // persistence
  PersistenceManager,
  SCHEMA_VERSION,
  DEFAULT_NAMESPACE,
  MemoryStorageAdapter,
  LocalStorageAdapter,

  // repositories
  SkinRepository,
  ObstacleLayoutRepository,
  CatalogRepository,
  PlayerRepository,
  HighScoreRepository,
  Repositories,
  loadSeedCatalog,
  buildSeedCatalogSync,

  // seed data
  SEED_SKINS,
  SEED_OBSTACLE_LAYOUTS,
  buildSeedSkins,
  buildSeedObstacleLayouts,

  // bootstrap
  createGame,
};

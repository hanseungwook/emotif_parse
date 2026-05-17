'use strict';

const { STATUS, MODE, OUTCOME, isValidMode } = require('./state');
const {
  DIRECTIONS,
  isDirection,
  isOpposite,
  cellKey,
} = require('./grid');
const {
  createSnake,
  advance,
  hitsSelf,
  hitsWall,
  bodyKeys,
  nextHead,
} = require('./snake');
const { spawnFood, isAt: foodIsAt } = require('./food');
const {
  generateObstacles,
  obstacleKeys,
  hits: obstacleHits,
  DEFAULT_PATTERN,
} = require('./obstacles');
const { hasSkin, DEFAULT_SKIN_ID } = require('./skins');
const { EventBus } = require('./events');

const DEFAULT_WIDTH = 20;
const DEFAULT_HEIGHT = 20;
const DEFAULT_TICK_MS = 140;
const DEFAULT_INITIAL_LENGTH = 3;
const MIN_TICK_MS = 50;
const SPEED_STEP_MS = 6;
const SPEED_STEP_EVERY = 4; // food eaten between speed-ups

function defaultRng() {
  return Math.random();
}

function freezeSnapshot(state) {
  return {
    status: state.status,
    mode: state.mode,
    skinId: state.skinId,
    width: state.width,
    height: state.height,
    score: state.score,
    best: state.best,
    foodEaten: state.foodEaten,
    tickMs: state.tickMs,
    snake: {
      segments: state.snake.segments.map((s) => ({ x: s.x, y: s.y })),
      direction: state.snake.direction,
      pendingGrowth: state.snake.pendingGrowth,
    },
    food: state.food ? { x: state.food.x, y: state.food.y } : null,
    obstacles: state.obstacles.map((o) => ({ x: o.x, y: o.y })),
    outcome: state.outcome,
    tickCount: state.tickCount,
  };
}

// Build the engine. The engine is fully deterministic given `rng` and the
// sequence of dispatched actions — useful for tests and replay.
function createEngine(options = {}) {
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  if (width < 6 || height < 6) {
    throw new RangeError('snake board must be at least 6x6');
  }
  const rng = typeof options.rng === 'function' ? options.rng : defaultRng;
  const initialMode = isValidMode(options.initialMode) ? options.initialMode : MODE.classic;
  const initialSkinId = hasSkin(options.initialSkinId)
    ? options.initialSkinId
    : DEFAULT_SKIN_ID;
  const initialLength = options.initialLength || DEFAULT_INITIAL_LENGTH;
  const initialTickMs = options.tickMs || DEFAULT_TICK_MS;
  const obstaclePattern = options.obstaclePattern || DEFAULT_PATTERN;

  const bus = new EventBus();

  // The engine owns the canonical state. External code receives frozen
  // snapshots so it can't mutate engine internals.
  let state = buildInitialState({
    width,
    height,
    mode: initialMode,
    skinId: initialSkinId,
    initialLength,
    tickMs: initialTickMs,
    obstaclePattern,
    best: options.best || 0,
    rng,
  });

  let pendingDirection = null;

  function buildInitialState(opts) {
    const snake = createSnake({
      width: opts.width,
      height: opts.height,
      length: opts.initialLength,
    });
    const obstacles =
      opts.mode === MODE.obstacle
        ? generateObstacles({
            pattern: opts.obstaclePattern,
            width: opts.width,
            height: opts.height,
            rng: opts.rng,
          })
        : [];
    const blocked = new Set(bodyKeys(snake));
    for (const o of obstacles) blocked.add(cellKey(o.x, o.y));
    const food = spawnFood({
      width: opts.width,
      height: opts.height,
      blockedKeys: blocked,
      rng: opts.rng,
    });
    return {
      status: STATUS.idle,
      mode: opts.mode,
      skinId: opts.skinId,
      width: opts.width,
      height: opts.height,
      score: 0,
      best: opts.best,
      foodEaten: 0,
      tickMs: opts.tickMs,
      baseTickMs: opts.tickMs,
      snake,
      food,
      obstacles,
      obstaclePattern: opts.obstaclePattern,
      outcome: null,
      tickCount: 0,
    };
  }

  function reseedBoard({ mode, skinId } = {}) {
    state = buildInitialState({
      width,
      height,
      mode: mode || state.mode,
      skinId: skinId || state.skinId,
      initialLength,
      tickMs: state.baseTickMs,
      obstaclePattern,
      best: state.best,
      rng,
    });
    pendingDirection = null;
  }

  function emitChange(reason, extra = {}) {
    bus.emit('change', { reason, state: getState(), ...extra });
  }

  function getState() {
    return freezeSnapshot(state);
  }

  function subscribe(fn) {
    return bus.on('change', fn);
  }

  function on(event, fn) {
    return bus.on(event, fn);
  }

  // --- Action handlers ---

  function start() {
    if (state.status === STATUS.playing) return;
    if (state.status === STATUS.gameOver || state.status === STATUS.idle) {
      reseedBoard();
    }
    state.status = STATUS.playing;
    state.outcome = null;
    emitChange('start');
  }

  function pause() {
    if (state.status !== STATUS.playing) return;
    state.status = STATUS.paused;
    emitChange('pause');
  }

  function resume() {
    if (state.status !== STATUS.paused) return;
    state.status = STATUS.playing;
    emitChange('resume');
  }

  function reset() {
    reseedBoard();
    emitChange('reset');
  }

  function changeDirection(direction) {
    if (!isDirection(direction)) return;
    if (state.status !== STATUS.playing && state.status !== STATUS.paused) return;
    const current = state.snake.direction;
    // Block 180° flips — they always result in instant self-collision.
    if (isOpposite(current, direction)) return;
    pendingDirection = direction;
  }

  function setMode(mode) {
    if (!isValidMode(mode)) return;
    if (state.mode === mode) return;
    if (state.status === STATUS.playing || state.status === STATUS.paused) {
      // Mode changes mid-run are deferred until reset so layouts stay fair.
      state.pendingMode = mode;
      emitChange('mode:pending', { mode });
      return;
    }
    reseedBoard({ mode });
    emitChange('mode:changed', { mode });
  }

  function setSkin(skinId) {
    if (!hasSkin(skinId)) return;
    if (state.skinId === skinId) return;
    state.skinId = skinId;
    emitChange('skin:changed', { skinId });
  }

  // The single tick advances physics by one cell. The engine is tick-driven
  // so renderers/timers can swap freely (raf, setInterval, manual stepping
  // in tests). Returns the resulting snapshot.
  function tick() {
    if (state.status !== STATUS.playing) return getState();
    if (pendingDirection) {
      state.snake = { ...state.snake, direction: pendingDirection };
      pendingDirection = null;
    }
    const head = nextHead(state.snake);
    // Wall collision
    if (head.x < 0 || head.y < 0 || head.x >= state.width || head.y >= state.height) {
      return finish(OUTCOME.wallCollision);
    }
    // Obstacle collision (Obstacle Mode)
    if (state.mode === MODE.obstacle && obstacleHits(state.obstacles, head)) {
      return finish(OUTCOME.obstacleCollision);
    }
    // Food check before moving (so we know whether to grow on advance)
    const ateFood = state.food && foodIsAt(state.food, head);
    state.snake = advance(state.snake, { grow: ateFood });
    state.tickCount += 1;
    // Self-collision after the move
    if (hitsSelf(state.snake)) {
      return finish(OUTCOME.selfCollision);
    }
    if (hitsWall(state.snake, state.width, state.height)) {
      return finish(OUTCOME.wallCollision);
    }
    if (ateFood) {
      state.score += scoreForFood(state.mode, state.foodEaten);
      state.foodEaten += 1;
      maybeSpeedUp();
      respawnFood();
      bus.emit('food:eaten', { state: getState() });
    }
    emitChange('tick');
    return getState();
  }

  function respawnFood() {
    const blocked = new Set(bodyKeys(state.snake));
    for (const o of state.obstacles) blocked.add(cellKey(o.x, o.y));
    state.food = spawnFood({
      width: state.width,
      height: state.height,
      blockedKeys: blocked,
      rng,
    });
    if (!state.food) {
      // Board cleared — treat as a completion win.
      finish(null, { reason: 'cleared' });
    }
  }

  function maybeSpeedUp() {
    if (state.foodEaten > 0 && state.foodEaten % SPEED_STEP_EVERY === 0) {
      const next = state.tickMs - SPEED_STEP_MS;
      state.tickMs = next > MIN_TICK_MS ? next : MIN_TICK_MS;
      bus.emit('speed:changed', { tickMs: state.tickMs });
    }
  }

  function scoreForFood(mode, foodEaten) {
    const base = 10;
    // Obstacle mode pays out a little more to reward higher-difficulty play.
    const modeBonus = mode === MODE.obstacle ? 5 : 0;
    // Streak bonus rises every 5 foods.
    const streak = Math.floor(foodEaten / 5);
    return base + modeBonus + streak * 2;
  }

  function finish(outcome, extra = {}) {
    state.status = STATUS.gameOver;
    state.outcome = outcome;
    if (state.score > state.best) state.best = state.score;
    // Apply any deferred mode change so the next start uses it.
    if (state.pendingMode) {
      state.mode = state.pendingMode;
      delete state.pendingMode;
    }
    emitChange('gameOver', { outcome, ...extra });
    bus.emit('gameOver', { outcome, state: getState() });
    return getState();
  }

  // Dispatch dispatches an action object. This is the recommended public
  // entry — it lets UIs serialize and replay user intent (good for the
  // sibling Operations States module if it needs to record sessions).
  function dispatch(action) {
    if (!action || typeof action.type !== 'string') return getState();
    switch (action.type) {
      case 'START':
        start();
        break;
      case 'PAUSE':
        pause();
        break;
      case 'RESUME':
        resume();
        break;
      case 'RESET':
        reset();
        break;
      case 'TICK':
        tick();
        break;
      case 'CHANGE_DIRECTION':
        changeDirection(action.direction);
        break;
      case 'SET_MODE':
        setMode(action.mode);
        break;
      case 'SET_SKIN':
        setSkin(action.skinId);
        break;
      default:
        break;
    }
    return getState();
  }

  return {
    getState,
    subscribe,
    on,
    dispatch,
    start,
    pause,
    resume,
    reset,
    tick,
    changeDirection,
    setMode,
    setSkin,
  };
}

module.exports = {
  createEngine,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_TICK_MS,
  DEFAULT_INITIAL_LENGTH,
};

// Browser ES-module mirror of the engine. The CommonJS modules under
// /app/snake/core/ remain the source of truth for Node tests; this file
// re-implements the same logic so the demo page can run without a bundler.
// Kept intentionally small so the two stay in sync.

export const STATUS = Object.freeze({
  idle: 'idle',
  playing: 'playing',
  paused: 'paused',
  gameOver: 'gameOver',
});

export const MODE = Object.freeze({
  classic: 'classic',
  obstacle: 'obstacle',
});

export const OUTCOME = Object.freeze({
  wallCollision: 'wallCollision',
  selfCollision: 'selfCollision',
  obstacleCollision: 'obstacleCollision',
});

export const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const SKINS = Object.freeze({
  classic: { id: 'classic', label: 'Classic Green', head: '#1f8a4c', body: '#2cb86b', accent: '#b9f5cf', eye: '#0d2818', description: 'The original arcade pixel snake.' },
  neon: { id: 'neon', label: 'Neon Pulse', head: '#ff2bd6', body: '#7cf6ff', accent: '#fff66b', eye: '#1c0033', description: 'High-contrast neon for night-mode play.' },
  ember: { id: 'ember', label: 'Ember Coil', head: '#ff6b1a', body: '#ffb347', accent: '#fff1c1', eye: '#3b0f00', description: 'Warm gradient that pulses with each tick.' },
  shadow: { id: 'shadow', label: 'Shadow Mamba', head: '#222633', body: '#3c4256', accent: '#7a83a8', eye: '#f0f3ff', description: 'Stealth palette tuned for obstacle mode.' },
});

export const DEFAULT_SKIN_ID = 'classic';

export function listSkins() {
  return Object.values(SKINS);
}

export function hasSkin(id) {
  return Object.prototype.hasOwnProperty.call(SKINS, id);
}

export function getSkin(id) {
  return hasSkin(id) ? SKINS[id] : SKINS[DEFAULT_SKIN_ID];
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function step(point, direction) {
  const d = DIRECTIONS[direction];
  return { x: point.x + d.x, y: point.y + d.y };
}

function inBounds(p, w, h) {
  return p.x >= 0 && p.y >= 0 && p.x < w && p.y < h;
}

function createSnake({ width, height, length, direction = 'right' }) {
  const headX = Math.floor(width / 2);
  const headY = Math.floor(height / 2);
  const segments = [];
  for (let i = 0; i < length; i += 1) segments.push({ x: headX - i, y: headY });
  return { segments, direction, pendingGrowth: 0 };
}

function nextHead(snake) {
  return step(snake.segments[0], snake.direction);
}

function advance(snake, grow) {
  const head = nextHead(snake);
  const segments = [head, ...snake.segments];
  let pendingGrowth = snake.pendingGrowth;
  if (grow) pendingGrowth += 1;
  if (pendingGrowth > 0) pendingGrowth -= 1;
  else segments.pop();
  return { segments, direction: snake.direction, pendingGrowth };
}

function bodyKeys(snake) {
  const keys = new Set();
  for (const s of snake.segments) keys.add(cellKey(s.x, s.y));
  return keys;
}

function hitsSelf(snake) {
  const h = snake.segments[0];
  for (let i = 1; i < snake.segments.length; i += 1) {
    const s = snake.segments[i];
    if (s.x === h.x && s.y === h.y) return true;
  }
  return false;
}

function hitsWall(snake, w, h) {
  return !inBounds(snake.segments[0], w, h);
}

function spawnFood({ width, height, blockedKeys, rng }) {
  const total = width * height;
  if (blockedKeys.size >= total) return null;
  const candidates = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!blockedKeys.has(cellKey(x, y))) candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length) % candidates.length];
}

function pillars({ width, height }) {
  if (width < 8 || height < 8) return [];
  const pad = 2;
  return [
    { x: pad, y: pad },
    { x: width - pad - 1, y: pad },
    { x: pad, y: height - pad - 1 },
    { x: width - pad - 1, y: height - pad - 1 },
  ];
}

function crossbars({ width, height }) {
  if (width < 8 || height < 8) return [];
  const cells = [];
  const midY = Math.floor(height / 2);
  const barY = Math.max(1, midY - 3);
  for (let i = 2; i <= width - 3; i += 3) cells.push({ x: i, y: barY });
  const barX = Math.max(1, Math.floor(width / 2) - 3);
  for (let j = midY + 2; j <= height - 3; j += 3) cells.push({ x: barX, y: j });
  return cells;
}

function scattered({ width, height, rng, count }) {
  const startY = Math.floor(height / 2);
  const goal = count != null ? count : Math.max(4, Math.floor((width * height) / 40));
  const seen = new Set();
  const cells = [];
  let attempts = 0;
  while (cells.length < goal && attempts < goal * 20) {
    attempts += 1;
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    if (y === startY) continue;
    const k = cellKey(x, y);
    if (seen.has(k)) continue;
    seen.add(k);
    cells.push({ x, y });
  }
  return cells;
}

export const PATTERNS = { pillars, crossbars, scattered };
export const DEFAULT_PATTERN = 'pillars';

function obstacleHits(obstacles, p) {
  for (const c of obstacles) if (c.x === p.x && c.y === p.y) return true;
  return false;
}

const DEFAULT_TICK_MS = 140;
const MIN_TICK_MS = 50;
const SPEED_STEP_MS = 6;
const SPEED_STEP_EVERY = 4;

export function createEngine(options = {}) {
  const width = options.width || 20;
  const height = options.height || 20;
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const initialMode = MODE[options.initialMode] || MODE.classic;
  const initialSkinId = hasSkin(options.initialSkinId) ? options.initialSkinId : DEFAULT_SKIN_ID;
  const initialLength = options.initialLength || 3;
  const initialTickMs = options.tickMs || DEFAULT_TICK_MS;
  const obstaclePattern = options.obstaclePattern || DEFAULT_PATTERN;
  const listeners = new Set();
  let pendingDirection = null;

  let state = buildInitialState({
    width, height,
    mode: initialMode,
    skinId: initialSkinId,
    initialLength,
    tickMs: initialTickMs,
    obstaclePattern,
    best: options.best || 0,
    rng,
  });

  function buildInitialState(opts) {
    const snake = createSnake({ width: opts.width, height: opts.height, length: opts.initialLength });
    const obstacles = opts.mode === MODE.obstacle
      ? (PATTERNS[opts.obstaclePattern] || PATTERNS.pillars)({ width: opts.width, height: opts.height, rng: opts.rng })
      : [];
    const blocked = new Set(bodyKeys(snake));
    for (const o of obstacles) blocked.add(cellKey(o.x, o.y));
    const food = spawnFood({ width: opts.width, height: opts.height, blockedKeys: blocked, rng: opts.rng });
    return {
      status: STATUS.idle,
      mode: opts.mode,
      skinId: opts.skinId,
      width: opts.width, height: opts.height,
      score: 0, best: opts.best, foodEaten: 0,
      tickMs: opts.tickMs, baseTickMs: opts.tickMs,
      snake, food, obstacles,
      obstaclePattern: opts.obstaclePattern,
      outcome: null, tickCount: 0,
    };
  }

  function snapshot() {
    return {
      status: state.status, mode: state.mode, skinId: state.skinId,
      width: state.width, height: state.height,
      score: state.score, best: state.best, foodEaten: state.foodEaten, tickMs: state.tickMs,
      snake: { segments: state.snake.segments.map(s => ({ x: s.x, y: s.y })), direction: state.snake.direction, pendingGrowth: state.snake.pendingGrowth },
      food: state.food ? { x: state.food.x, y: state.food.y } : null,
      obstacles: state.obstacles.map(o => ({ x: o.x, y: o.y })),
      outcome: state.outcome, tickCount: state.tickCount,
    };
  }

  function emit(reason, extra) {
    const evt = { reason, state: snapshot(), ...(extra || {}) };
    for (const fn of Array.from(listeners)) {
      try { fn(evt); } catch (err) { console.error(err); }
    }
  }

  function reseed({ mode, skinId } = {}) {
    state = buildInitialState({
      width, height,
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

  function start() {
    if (state.status === STATUS.playing) return;
    if (state.status === STATUS.gameOver || state.status === STATUS.idle) reseed();
    state.status = STATUS.playing; state.outcome = null;
    emit('start');
  }
  function pause() { if (state.status === STATUS.playing) { state.status = STATUS.paused; emit('pause'); } }
  function resume() { if (state.status === STATUS.paused) { state.status = STATUS.playing; emit('resume'); } }
  function reset() { reseed(); emit('reset'); }

  function changeDirection(direction) {
    if (!DIRECTIONS[direction]) return;
    if (state.status !== STATUS.playing && state.status !== STATUS.paused) return;
    if (OPPOSITE[state.snake.direction] === direction) return;
    pendingDirection = direction;
  }

  function setMode(mode) {
    if (!MODE[mode]) return;
    if (state.mode === mode) return;
    if (state.status === STATUS.playing || state.status === STATUS.paused) {
      state.pendingMode = mode;
      emit('mode:pending', { mode });
      return;
    }
    reseed({ mode });
    emit('mode:changed', { mode });
  }

  function setSkin(skinId) {
    if (!hasSkin(skinId) || state.skinId === skinId) return;
    state.skinId = skinId;
    emit('skin:changed', { skinId });
  }

  function finish(outcome) {
    state.status = STATUS.gameOver;
    state.outcome = outcome;
    if (state.score > state.best) state.best = state.score;
    if (state.pendingMode) { state.mode = state.pendingMode; delete state.pendingMode; }
    emit('gameOver', { outcome });
  }

  function tick() {
    if (state.status !== STATUS.playing) return snapshot();
    if (pendingDirection) {
      state.snake = { ...state.snake, direction: pendingDirection };
      pendingDirection = null;
    }
    const head = nextHead(state.snake);
    if (!inBounds(head, state.width, state.height)) { finish(OUTCOME.wallCollision); return snapshot(); }
    if (state.mode === MODE.obstacle && obstacleHits(state.obstacles, head)) { finish(OUTCOME.obstacleCollision); return snapshot(); }
    const ate = state.food && state.food.x === head.x && state.food.y === head.y;
    state.snake = advance(state.snake, ate);
    state.tickCount += 1;
    if (hitsSelf(state.snake)) { finish(OUTCOME.selfCollision); return snapshot(); }
    if (hitsWall(state.snake, state.width, state.height)) { finish(OUTCOME.wallCollision); return snapshot(); }
    if (ate) {
      state.score += scoreForFood(state.mode, state.foodEaten);
      state.foodEaten += 1;
      if (state.foodEaten % SPEED_STEP_EVERY === 0) {
        const next = state.tickMs - SPEED_STEP_MS;
        state.tickMs = next > MIN_TICK_MS ? next : MIN_TICK_MS;
      }
      const blocked = new Set(bodyKeys(state.snake));
      for (const o of state.obstacles) blocked.add(cellKey(o.x, o.y));
      state.food = spawnFood({ width: state.width, height: state.height, blockedKeys: blocked, rng });
      if (!state.food) finish(null);
    }
    emit('tick');
    return snapshot();
  }

  function scoreForFood(mode, eaten) {
    const base = 10;
    const modeBonus = mode === MODE.obstacle ? 5 : 0;
    const streak = Math.floor(eaten / 5);
    return base + modeBonus + streak * 2;
  }

  function dispatch(action) {
    if (!action || typeof action.type !== 'string') return snapshot();
    switch (action.type) {
      case 'START': start(); break;
      case 'PAUSE': pause(); break;
      case 'RESUME': resume(); break;
      case 'RESET': reset(); break;
      case 'TICK': tick(); break;
      case 'CHANGE_DIRECTION': changeDirection(action.direction); break;
      case 'SET_MODE': setMode(action.mode); break;
      case 'SET_SKIN': setSkin(action.skinId); break;
    }
    return snapshot();
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { getState: snapshot, dispatch, subscribe, start, pause, resume, reset, tick, changeDirection, setMode, setSkin };
}

export const KEY_TO_DIRECTION = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};

const ACTION_KEYS = {
  Space: 'TOGGLE', ' ': 'TOGGLE', Enter: 'START',
  KeyP: 'PAUSE', KeyR: 'RESET', p: 'PAUSE', r: 'RESET',
};

export function attachKeyboard(engine, target) {
  const handler = (e) => {
    const key = e.code || e.key;
    const direction = KEY_TO_DIRECTION[key];
    if (direction) {
      engine.dispatch({ type: 'CHANGE_DIRECTION', direction });
      e.preventDefault();
      return;
    }
    const action = ACTION_KEYS[key];
    if (!action) return;
    e.preventDefault();
    const s = engine.getState().status;
    if (action === 'TOGGLE') {
      if (s === 'idle' || s === 'gameOver') engine.dispatch({ type: 'START' });
      else if (s === 'playing') engine.dispatch({ type: 'PAUSE' });
      else if (s === 'paused') engine.dispatch({ type: 'RESUME' });
    } else if (action === 'START') engine.dispatch({ type: 'START' });
    else if (action === 'PAUSE') {
      if (s === 'playing') engine.dispatch({ type: 'PAUSE' });
      else if (s === 'paused') engine.dispatch({ type: 'RESUME' });
    } else if (action === 'RESET') engine.dispatch({ type: 'RESET' });
  };
  target.addEventListener('keydown', handler);
  return () => target.removeEventListener('keydown', handler);
}

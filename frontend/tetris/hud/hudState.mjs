import { EventEmitter } from './eventEmitter.mjs';
import { isValidPieceKind } from './pieces.mjs';

export const STATUS = Object.freeze({
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameOver',
});

const VALID_STATUSES = new Set(Object.values(STATUS));

export const CLEAR_TYPES = Object.freeze({
  SINGLE: 'single',
  DOUBLE: 'double',
  TRIPLE: 'triple',
  TETRIS: 'tetris',
  TSPIN: 'tspin',
  TSPIN_MINI: 'tspinMini',
  PERFECT_CLEAR: 'perfectClear',
});

function clampNonNegativeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function sanitizeQueue(queue) {
  if (!Array.isArray(queue)) return [];
  return queue
    .map((entry) => (typeof entry === 'string' ? entry.toUpperCase() : null))
    .filter((kind) => kind && isValidPieceKind(kind));
}

// HudState owns the user-facing run state for the HUD. It is intentionally
// independent of the gameplay core, scoring engine, renderer, and input
// loop so the HUD can be wired into any of them through small adapter
// hooks. Callers push state in (`setScore`, `recordClear`, etc.) and
// subscribe to granular change events.
export class HudState extends EventEmitter {
  constructor(initial) {
    super();
    const seed = initial || {};
    this._state = {
      score: clampNonNegativeInt(seed.score, 0),
      bestScore: clampNonNegativeInt(seed.bestScore, 0),
      lines: clampNonNegativeInt(seed.lines, 0),
      level: Math.max(1, clampNonNegativeInt(seed.level, 1) || 1),
      combo: clampNonNegativeInt(seed.combo, 0),
      maxCombo: clampNonNegativeInt(seed.maxCombo, 0),
      nextQueue: sanitizeQueue(seed.nextQueue),
      hold: seed.hold && isValidPieceKind(seed.hold) ? seed.hold.toUpperCase() : null,
      status: VALID_STATUSES.has(seed.status) ? seed.status : STATUS.READY,
      lastClear: null,
      message: typeof seed.message === 'string' ? seed.message : '',
    };
  }

  getState() {
    return { ...this._state, nextQueue: this._state.nextQueue.slice() };
  }

  // ---- Score / progression ----

  setScore(score) {
    const next = clampNonNegativeInt(score, this._state.score);
    if (next === this._state.score) return;
    const prev = this._state.score;
    this._state.score = next;
    if (next > this._state.bestScore) {
      const prevBest = this._state.bestScore;
      this._state.bestScore = next;
      this.emit('bestScore:change', { value: next, prev: prevBest });
    }
    this.emit('score:change', { value: next, prev, delta: next - prev });
    this._emitChange();
  }

  addScore(delta) {
    const value = Number(delta);
    if (!Number.isFinite(value) || value === 0) return;
    this.setScore(this._state.score + value);
  }

  setBestScore(value) {
    const next = clampNonNegativeInt(value, this._state.bestScore);
    if (next === this._state.bestScore) return;
    const prev = this._state.bestScore;
    this._state.bestScore = next;
    this.emit('bestScore:change', { value: next, prev });
    this._emitChange();
  }

  setLines(lines) {
    const next = clampNonNegativeInt(lines, this._state.lines);
    if (next === this._state.lines) return;
    const prev = this._state.lines;
    this._state.lines = next;
    this.emit('lines:change', { value: next, prev, delta: next - prev });
    this._emitChange();
  }

  setLevel(level) {
    const requested = clampNonNegativeInt(level, this._state.level);
    const next = Math.max(1, requested || 1);
    if (next === this._state.level) return;
    const prev = this._state.level;
    this._state.level = next;
    this.emit('level:change', { value: next, prev });
    this._emitChange();
  }

  setCombo(combo) {
    const next = clampNonNegativeInt(combo, this._state.combo);
    if (next === this._state.combo) return;
    const prev = this._state.combo;
    this._state.combo = next;
    if (next > this._state.maxCombo) this._state.maxCombo = next;
    this.emit('combo:change', { value: next, prev, broken: next === 0 && prev > 0 });
    this._emitChange();
  }

  // Convenience wrapper used by score subsystems each lock: forward the
  // current combo count for the just-locked piece.
  bumpCombo() {
    this.setCombo(this._state.combo + 1);
  }

  breakCombo() {
    if (this._state.combo === 0) return;
    this.setCombo(0);
  }

  // ---- Last clear ----

  recordClear(detail) {
    if (!detail || typeof detail !== 'object') return;
    const lines = clampNonNegativeInt(detail.lines, 0);
    if (lines === 0 && !detail.type) return;
    const entry = {
      type: typeof detail.type === 'string' ? detail.type : null,
      lines,
      points: clampNonNegativeInt(detail.points, 0),
      combo: clampNonNegativeInt(detail.combo, this._state.combo),
      perfect: detail.perfect === true,
      at: typeof detail.at === 'number' ? detail.at : Date.now(),
    };
    this._state.lastClear = entry;
    this.emit('clear', entry);
    this._emitChange();
  }

  clearLastClear() {
    if (this._state.lastClear === null) return;
    this._state.lastClear = null;
    this.emit('clear:expire');
    this._emitChange();
  }

  // ---- Next queue / hold ----

  setNextQueue(queue) {
    const next = sanitizeQueue(queue);
    const prev = this._state.nextQueue;
    if (
      prev.length === next.length &&
      prev.every((kind, idx) => kind === next[idx])
    ) {
      return;
    }
    this._state.nextQueue = next;
    this.emit('next:change', { queue: next.slice(), prev: prev.slice() });
    this._emitChange();
  }

  setHold(kind) {
    const value = kind && typeof kind === 'string' && isValidPieceKind(kind)
      ? kind.toUpperCase()
      : null;
    if (value === this._state.hold) return;
    const prev = this._state.hold;
    this._state.hold = value;
    this.emit('hold:change', { value, prev });
    this._emitChange();
  }

  // ---- Status / lifecycle ----

  setStatus(status) {
    if (!VALID_STATUSES.has(status)) {
      throw new RangeError(`unknown status: ${status}`);
    }
    if (status === this._state.status) return;
    const prev = this._state.status;
    this._state.status = status;
    this.emit('status:change', { value: status, prev });
    this._emitChange();
  }

  start() {
    this.setStatus(STATUS.PLAYING);
  }

  pause() {
    if (this._state.status !== STATUS.PLAYING) return;
    this.setStatus(STATUS.PAUSED);
  }

  resume() {
    if (this._state.status !== STATUS.PAUSED) return;
    this.setStatus(STATUS.PLAYING);
  }

  togglePause() {
    if (this._state.status === STATUS.PLAYING) this.pause();
    else if (this._state.status === STATUS.PAUSED) this.resume();
  }

  gameOver() {
    this.setStatus(STATUS.GAME_OVER);
    this.breakCombo();
  }

  // Resets the run-state (score, lines, level, combo, clear, status). The
  // all-time best score is preserved unless the caller explicitly passes a
  // new `bestScore` in the seed.
  reset(seed) {
    const base = seed || {};
    const prev = this.getState();
    this._state.score = clampNonNegativeInt(base.score, 0);
    this._state.lines = clampNonNegativeInt(base.lines, 0);
    this._state.level = Math.max(1, clampNonNegativeInt(base.level, 1) || 1);
    this._state.combo = clampNonNegativeInt(base.combo, 0);
    this._state.maxCombo = clampNonNegativeInt(base.maxCombo, 0);
    this._state.nextQueue = sanitizeQueue(base.nextQueue);
    this._state.hold = base.hold && isValidPieceKind(base.hold) ? base.hold.toUpperCase() : null;
    this._state.lastClear = null;
    this._state.message = typeof base.message === 'string' ? base.message : '';
    this._state.status = VALID_STATUSES.has(base.status) ? base.status : STATUS.READY;
    if (base.bestScore !== undefined) {
      this._state.bestScore = clampNonNegativeInt(base.bestScore, this._state.bestScore);
    }
    this.emit('reset', { prev, value: this.getState() });
    this._emitChange();
  }

  setMessage(message) {
    const next = typeof message === 'string' ? message : '';
    if (next === this._state.message) return;
    const prev = this._state.message;
    this._state.message = next;
    this.emit('message:change', { value: next, prev });
    this._emitChange();
  }

  // ---- UI intents ----
  //
  // These are emitted by the HUD's interactive controls (restart button,
  // resume button). They are intents, not state changes — the runtime
  // owning the gameplay loop listens for them and decides how to apply
  // them, then pushes back the result via setStatus/reset.

  requestRestart(meta) {
    this.emit('intent:restart', meta || {});
  }

  requestResume() {
    this.emit('intent:resume');
  }

  requestPause() {
    this.emit('intent:pause');
  }

  _emitChange() {
    this.emit('change', this.getState());
  }
}

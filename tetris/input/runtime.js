'use strict';

const { Actions } = require('./actions');

// Runtime states. Idle is pre-start, Running drives ticks, Paused freezes the
// loop, GameOver halts ticks and locks out gameplay actions until Restart.
const STATES = Object.freeze({
  Idle: 'idle',
  Running: 'running',
  Paused: 'paused',
  GameOver: 'game-over',
});

// Cap delta-time per frame so a tab switch or breakpoint can't replay several
// seconds of gravity in a single tick.
const MAX_FRAME_MS = 100;

function defaultScheduler() {
  const hasRaf = typeof requestAnimationFrame === 'function' &&
    typeof cancelAnimationFrame === 'function';
  return {
    now: () => (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? performance.now()
      : Date.now(),
    requestFrame: (cb) => hasRaf ? requestAnimationFrame(cb) : setTimeout(() => cb(Date.now()), 16),
    cancelFrame: (id) => hasRaf ? cancelAnimationFrame(id) : clearTimeout(id),
  };
}

class GameRuntime {
  constructor(options) {
    const opts = options || {};
    this.scheduler = opts.scheduler || defaultScheduler();
    this.input = opts.input || null;
    this._tickers = new Set();
    this._stateListeners = new Set();
    this._lifecycleListeners = new Set();
    this._state = STATES.Idle;
    this._frameId = null;
    this._lastFrameAt = 0;
    this._elapsedMs = 0;
    this._frameCount = 0;
    this._unsubInput = null;
    this._loop = this._loop.bind(this);

    if (this.input && opts.autoBindSystemActions !== false) {
      this._unsubInput = this.input.on((action) => {
        if (action === Actions.PauseToggle) this.togglePause();
        else if (action === Actions.Restart) this.restart();
      });
    }
  }

  get state() { return this._state; }
  get elapsedMs() { return this._elapsedMs; }
  get frameCount() { return this._frameCount; }
  get isRunning() { return this._state === STATES.Running; }
  get isPaused() { return this._state === STATES.Paused; }
  get isGameOver() { return this._state === STATES.GameOver; }

  // Per-frame tick subscribers. Handlers receive (dt, elapsedMs, frameCount).
  onTick(handler) {
    if (typeof handler !== 'function') throw new TypeError('handler must be a function');
    this._tickers.add(handler);
    return () => { this._tickers.delete(handler); };
  }

  // Notified when the runtime state machine transitions. Handlers receive
  // (next, prev). Use for HUD/render swaps (e.g. show "PAUSED" overlay).
  onStateChange(handler) {
    if (typeof handler !== 'function') throw new TypeError('handler must be a function');
    this._stateListeners.add(handler);
    return () => { this._stateListeners.delete(handler); };
  }

  // Notified on coarse lifecycle events: 'start', 'pause', 'resume', 'restart',
  // 'stop', 'game-over'. Useful for one-shot side effects like analytics.
  onLifecycle(handler) {
    if (typeof handler !== 'function') throw new TypeError('handler must be a function');
    this._lifecycleListeners.add(handler);
    return () => { this._lifecycleListeners.delete(handler); };
  }

  start() {
    if (this._state === STATES.Running) return;
    const wasFresh = this._state === STATES.Idle || this._state === STATES.GameOver;
    if (wasFresh) this._reset();
    this._setState(STATES.Running);
    this._lastFrameAt = this.scheduler.now();
    if (this.input) {
      this.input.setPaused(false);
      this.input.setEnabled(true);
    }
    this._emitLifecycle(wasFresh ? 'start' : 'resume');
    this._schedule();
  }

  pause() {
    if (this._state !== STATES.Running) return;
    this._cancel();
    this._setState(STATES.Paused);
    if (this.input) this.input.setPaused(true);
    this._emitLifecycle('pause');
  }

  resume() {
    if (this._state !== STATES.Paused) return;
    this._setState(STATES.Running);
    this._lastFrameAt = this.scheduler.now();
    if (this.input) {
      this.input.setPaused(false);
      // Re-anchor any keys that were held during pause so DAS doesn't replay.
      if (typeof this.input.resyncHeldKeys === 'function') {
        this.input.resyncHeldKeys(this._lastFrameAt);
      }
    }
    this._emitLifecycle('resume');
    this._schedule();
  }

  togglePause() {
    if (this._state === STATES.Running) this.pause();
    else if (this._state === STATES.Paused) this.resume();
    else if (this._state === STATES.Idle) this.start();
  }

  endGame() {
    if (this._state === STATES.GameOver) return;
    this._cancel();
    this._setState(STATES.GameOver);
    if (this.input) this.input.setPaused(true);
    this._emitLifecycle('game-over');
  }

  restart() {
    this._cancel();
    this._reset();
    this._setState(STATES.Running);
    this._lastFrameAt = this.scheduler.now();
    if (this.input) {
      this.input.setPaused(false);
      this.input.setEnabled(true);
    }
    this._emitLifecycle('restart');
    this._schedule();
  }

  stop() {
    this._cancel();
    if (this._state === STATES.Idle) return;
    this._setState(STATES.Idle);
    if (this.input) this.input.setPaused(true);
    this._emitLifecycle('stop');
  }

  // Tear down listeners and any pending frame. Idempotent.
  dispose() {
    this._cancel();
    this._tickers.clear();
    this._stateListeners.clear();
    this._lifecycleListeners.clear();
    if (this._unsubInput) {
      this._unsubInput();
      this._unsubInput = null;
    }
  }

  _reset() {
    this._frameCount = 0;
    this._elapsedMs = 0;
    this._lastFrameAt = 0;
  }

  _schedule() {
    if (this._frameId !== null) return;
    this._frameId = this.scheduler.requestFrame(this._loop);
  }

  _cancel() {
    if (this._frameId !== null) {
      this.scheduler.cancelFrame(this._frameId);
      this._frameId = null;
    }
  }

  _loop() {
    this._frameId = null;
    if (this._state !== STATES.Running) return;
    const now = this.scheduler.now();
    const rawDt = now - this._lastFrameAt;
    // Clamp negative dt (rare but possible when the scheduler clock jitters)
    // and very large dt to keep gameplay deterministic across frame stalls.
    const dt = Math.max(0, Math.min(rawDt, MAX_FRAME_MS));
    this._lastFrameAt = now;
    this._elapsedMs += dt;
    this._frameCount += 1;
    if (this.input && typeof this.input.update === 'function') {
      this.input.update(now);
    }
    for (const handler of this._tickers) {
      handler(dt, this._elapsedMs, this._frameCount);
    }
    if (this._state === STATES.Running) this._schedule();
  }

  _setState(next) {
    if (this._state === next) return;
    const prev = this._state;
    this._state = next;
    for (const handler of this._stateListeners) {
      handler(next, prev);
    }
  }

  _emitLifecycle(event) {
    for (const handler of this._lifecycleListeners) {
      handler(event, this._state);
    }
  }
}

module.exports = { GameRuntime, STATES, MAX_FRAME_MS };

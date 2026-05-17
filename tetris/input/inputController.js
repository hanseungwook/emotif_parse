'use strict';

const { Actions, isRepeatable, isSystem } = require('./actions');
const { createKeymap } = require('./keymap');

// Standard guideline-ish defaults. DAS is the delay before a held movement key
// begins auto-repeating; ARR is the interval between repeats. SDR is the soft
// drop repeat rate (no DAS — repeats start immediately while ArrowDown is held).
const DEFAULT_TIMING = Object.freeze({
  das: 133,
  arr: 10,
  sdr: 30,
  holdCooldownMs: 0,
});

// Internal sentinel meaning "fire on every update tick" (ARR=0 in modern
// Tetris means instant shift to the wall).
const INSTANT_REPEAT = 0;

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

class InputController {
  constructor(options) {
    const opts = options || {};
    this.keymap = createKeymap(opts.keymap);
    this.timing = Object.assign({}, DEFAULT_TIMING, opts.timing || {});
    this._clock = opts.clock || nowMs;
    this._listeners = new Set();
    this._held = new Map();
    this._paused = false;
    this._enabled = true;
    this._adapter = null;
    this._lastHoldAt = -Infinity;
  }

  // Subscribe to action events. The handler receives (action, meta) where meta
  // describes how the action was triggered. Returns an unsubscribe function.
  on(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('handler must be a function');
    }
    this._listeners.add(handler);
    return () => { this._listeners.delete(handler); };
  }

  // Connect a keyboard adapter (any object exposing `on(down, up)` and `off()`).
  // The adapter is responsible for normalising raw events into `{code, repeat,
  // timestamp}` shapes — see keyboardAdapter.js for the DOM implementation.
  attach(adapter) {
    if (this._adapter) {
      throw new Error('InputController is already attached to an adapter');
    }
    this._adapter = adapter;
    adapter.on(
      (event) => this._onKeyDown(event),
      (event) => this._onKeyUp(event),
    );
  }

  detach() {
    if (this._adapter && typeof this._adapter.off === 'function') {
      this._adapter.off();
    }
    this._adapter = null;
    this._held.clear();
  }

  setPaused(paused) { this._paused = !!paused; }
  isPaused() { return this._paused; }

  setEnabled(enabled) {
    this._enabled = !!enabled;
    if (!this._enabled) {
      this._held.clear();
    }
  }

  isEnabled() { return this._enabled; }

  // Update DAS/ARR/SDR repeats. Called once per frame by the runtime loop with
  // the current monotonic timestamp in milliseconds.
  update(now) {
    if (!this._enabled || this._paused) return;
    const t = typeof now === 'number' ? now : this._clock();
    for (const state of this._held.values()) {
      if (!isRepeatable(state.action)) continue;
      this._tickRepeat(state, t);
    }
  }

  _tickRepeat(state, now) {
    const action = state.action;
    const isSoft = action === Actions.SoftDrop;
    const dasMs = isSoft ? 0 : this.timing.das;
    const intervalMs = isSoft ? this.timing.sdr : this.timing.arr;
    const elapsed = now - state.pressedAt;
    if (elapsed < dasMs) return;
    if (intervalMs <= INSTANT_REPEAT) {
      // ARR=0 (or SDR=0): fire once per tick.
      this._emit(action, { source: 'auto-repeat' });
      state.lastRepeatAt = now;
      return;
    }
    const firstRepeatAt = state.pressedAt + dasMs;
    // First repeat is anchored to the end of DAS; subsequent repeats step by
    // intervalMs from there. This keeps cadence stable regardless of when the
    // tick lands relative to the DAS boundary.
    let nextRepeat = state.lastRepeatAt < firstRepeatAt
      ? firstRepeatAt
      : state.lastRepeatAt + intervalMs;
    while (nextRepeat <= now) {
      this._emit(action, { source: 'auto-repeat' });
      state.lastRepeatAt = nextRepeat;
      nextRepeat += intervalMs;
    }
  }

  // Convenience for tests and other modules that don't want to construct fake
  // KeyboardEvents.
  pressKey(code, now) {
    this._onKeyDown({ code, repeat: false, timestamp: now });
  }

  releaseKey(code, now) {
    this._onKeyUp({ code, timestamp: now });
  }

  // Re-emit a press for a key that's still held (used when resuming from pause
  // so DAS timing restarts from the resume moment rather than the original
  // press, which would otherwise spam queued repeats the player never asked for).
  resyncHeldKeys(now) {
    const t = typeof now === 'number' ? now : this._clock();
    for (const state of this._held.values()) {
      state.pressedAt = t;
      state.lastRepeatAt = t;
    }
  }

  _onKeyDown(event) {
    if (!this._enabled) return;
    const code = event && event.code;
    if (!code) return;
    const action = this.keymap[code];
    if (!action) return;
    // Browsers fire keydown with `repeat: true` for OS-level key repeat. We
    // ignore that — DAS/ARR are owned by this controller, not the OS.
    if (event.repeat) return;
    if (this._held.has(code)) return;

    const now = typeof event.timestamp === 'number' ? event.timestamp : this._clock();
    const allowedWhilePaused = isSystem(action);

    if (this._paused && !allowedWhilePaused) {
      // Track the key so release accounting still works, but suppress emission.
      this._held.set(code, { action, pressedAt: now, lastRepeatAt: now, suppressed: true });
      return;
    }

    if (action === Actions.Hold) {
      if (this.timing.holdCooldownMs > 0 && now - this._lastHoldAt < this.timing.holdCooldownMs) {
        this._held.set(code, { action, pressedAt: now, lastRepeatAt: now, suppressed: true });
        return;
      }
      this._lastHoldAt = now;
    }

    this._held.set(code, { action, pressedAt: now, lastRepeatAt: now, suppressed: false });
    this._emit(action, { source: 'press' });
  }

  _onKeyUp(event) {
    const code = event && event.code;
    if (!code) return;
    this._held.delete(code);
  }

  _emit(action, meta) {
    if (this._listeners.size === 0) return;
    const payload = meta || { source: 'press' };
    for (const handler of this._listeners) {
      handler(action, payload);
    }
  }
}

module.exports = { InputController, DEFAULT_TIMING };

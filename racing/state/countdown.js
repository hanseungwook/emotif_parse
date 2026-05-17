'use strict';

const { ValidationError } = require('./errors');

// The Countdown helper turns a configured "3-2-1-GO" cadence into a tick-
// driven state machine. The owning race state advances elapsed time and
// pulls discrete beat changes out via `advance(dtMs)`. This keeps the
// pacing logic isolated and easily unit-testable.
//
// Steps emitted:
//   For `steps = 3`, the sequence is `3, 2, 1, GO`. The GO beat (value 0)
//   marks the green flag.
//   For `steps = 0`, no countdown numbers are emitted, only an immediate
//   `GO` beat on the very first advance() call.

class Countdown {
  constructor(options = {}) {
    const steps = options.steps != null ? options.steps : 3;
    const stepMs = options.stepMs != null ? options.stepMs : 1000;
    if (!Number.isInteger(steps) || steps < 0) {
      throw new ValidationError('countdown steps must be a non-negative integer');
    }
    if (!Number.isFinite(stepMs) || stepMs <= 0) {
      throw new ValidationError('countdown stepMs must be a positive number');
    }
    this._steps = steps;
    this._stepMs = stepMs;
    this._elapsedMs = 0;
    this._currentBeat = steps; // first beat is `steps` (e.g. 3); GO is 0.
    this._goEmitted = false;
    this._beatAnnounced = false;
  }

  get totalDurationMs() {
    return this._steps * this._stepMs;
  }

  get elapsedMs() {
    return this._elapsedMs;
  }

  get isComplete() {
    return this._goEmitted;
  }

  get currentBeat() {
    return this._currentBeat;
  }

  // Returns the upcoming announcement when the elapsed time crosses a beat
  // boundary, or null when nothing happened this advance. Callers pass dtMs
  // each tick; large dt values are clamped so a single call cannot emit
  // multiple beats at once — call advance() in a loop and pass leftover dt
  // if you need to consume the surplus across multiple beats.
  peekInitialBeat() {
    if (this._beatAnnounced) return null;
    this._beatAnnounced = true;
    if (this._steps === 0) {
      // No numeric beats: emit immediate GO on next advance().
      return { kind: 'beat', value: this._steps, remaining: this._steps };
    }
    return { kind: 'beat', value: this._steps, remaining: this._steps };
  }

  advance(dtMs) {
    if (!Number.isFinite(dtMs) || dtMs < 0) {
      throw new ValidationError('dtMs must be a non-negative finite number');
    }
    if (this._goEmitted) return null;

    // Force a beat announcement before the first time-advance so callers
    // that consume `advance()` exclusively still observe the opening beat.
    if (!this._beatAnnounced) {
      this._beatAnnounced = true;
      if (this._steps === 0) {
        this._goEmitted = true;
        this._currentBeat = 0;
        return { kind: 'go', value: 0, remaining: 0 };
      }
      return { kind: 'beat', value: this._steps, remaining: this._steps };
    }

    this._elapsedMs += dtMs;
    const elapsedSteps = Math.floor(this._elapsedMs / this._stepMs);
    const stepsRemaining = Math.max(0, this._steps - elapsedSteps);
    const nextBeat = stepsRemaining;

    if (nextBeat === this._currentBeat) {
      return null;
    }
    this._currentBeat = nextBeat;
    if (nextBeat === 0) {
      this._goEmitted = true;
      return { kind: 'go', value: 0, remaining: 0 };
    }
    return { kind: 'beat', value: nextBeat, remaining: nextBeat };
  }

  reset() {
    this._elapsedMs = 0;
    this._currentBeat = this._steps;
    this._goEmitted = false;
    this._beatAnnounced = false;
  }

  snapshot() {
    return {
      steps: this._steps,
      stepMs: this._stepMs,
      totalDurationMs: this.totalDurationMs,
      elapsedMs: this._elapsedMs,
      currentBeat: this._currentBeat,
      complete: this._goEmitted,
    };
  }
}

module.exports = { Countdown };

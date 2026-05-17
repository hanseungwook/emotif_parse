'use strict';

const { ValidationError } = require('./errors');
const { CRASH_SEVERITY } = require('./constants');

// CrashHandler holds a respawn timer and the last-known clean checkpoint
// the car should re-spawn at. RaceState delegates timing to it so the
// respawn delay can be unit-tested without spinning up the full state
// machine.

class CrashHandler {
  constructor(options = {}) {
    const respawnDelayMs = options.respawnDelayMs != null
      ? options.respawnDelayMs : 1500;
    if (!Number.isFinite(respawnDelayMs) || respawnDelayMs < 0) {
      throw new ValidationError('respawnDelayMs must be a non-negative number');
    }
    this._respawnDelayMs = respawnDelayMs;
    this._severityDelayMultipliers = {
      [CRASH_SEVERITY.MINOR]: 0.5,
      [CRASH_SEVERITY.MAJOR]: 1.0,
      [CRASH_SEVERITY.TOTAL]: 1.75,
    };
    this.reset();
  }

  reset() {
    this._active = false;
    this._severity = null;
    this._remainingMs = 0;
    this._totalCrashes = 0;
    this._lastRespawnCheckpoint = 0;
    this._lastCrashAtMs = null;
    this._cause = null;
  }

  get isActive() { return this._active; }
  get remainingMs() { return this._remainingMs; }
  get totalCrashes() { return this._totalCrashes; }
  get severity() { return this._severity; }

  snapshot() {
    return {
      active: this._active,
      severity: this._severity,
      remainingMs: this._remainingMs,
      totalCrashes: this._totalCrashes,
      lastRespawnCheckpoint: this._lastRespawnCheckpoint,
      lastCrashAtMs: this._lastCrashAtMs,
      cause: this._cause,
    };
  }

  // Start a crash. Returns the computed respawn delay so the owning runtime
  // can mirror it onto its public snapshot in one step.
  registerCrash(options = {}) {
    const severity = options.severity || CRASH_SEVERITY.MAJOR;
    if (!Object.values(CRASH_SEVERITY).includes(severity)) {
      throw new ValidationError('unknown crash severity: ' + severity);
    }
    const multiplier = this._severityDelayMultipliers[severity];
    const delay = options.delayMs != null
      ? options.delayMs
      : Math.round(this._respawnDelayMs * multiplier);
    if (!Number.isFinite(delay) || delay < 0) {
      throw new ValidationError('crash delayMs must be a non-negative number');
    }
    this._active = true;
    this._severity = severity;
    this._remainingMs = delay;
    this._totalCrashes += 1;
    this._lastCrashAtMs = Number.isFinite(options.atMs) ? options.atMs : null;
    this._lastRespawnCheckpoint = Number.isInteger(options.respawnCheckpoint)
      ? options.respawnCheckpoint : 0;
    this._cause = options.cause || null;
    return { severity, delayMs: delay, totalCrashes: this._totalCrashes };
  }

  // Drain the respawn timer. Returns true when the timer crosses zero
  // (caller should now move the vehicle back into the RACING phase). When
  // already drained or never started, returns false.
  advance(dtMs) {
    if (!Number.isFinite(dtMs) || dtMs < 0) {
      throw new ValidationError('dtMs must be a non-negative finite number');
    }
    if (!this._active) return false;
    this._remainingMs = Math.max(0, this._remainingMs - dtMs);
    if (this._remainingMs === 0) {
      this._active = false;
      return true;
    }
    return false;
  }

  // Force-complete the respawn (e.g. player taps "respawn now").
  completeNow() {
    if (!this._active) return false;
    this._remainingMs = 0;
    this._active = false;
    return true;
  }
}

module.exports = { CrashHandler };

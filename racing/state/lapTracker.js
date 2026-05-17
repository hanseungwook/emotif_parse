'use strict';

const { ValidationError } = require('./errors');

// LapTracker enforces a checkpoint ring. The track exposes N checkpoints
// arranged in order around a closed loop; index 0 is the start/finish
// line. A lap is valid only when the car visits every checkpoint in order
// (1, 2, ..., N) and then crosses the start/finish line again.
//
// Out-of-order checkpoint hits are ignored (returns null) unless the
// configuration sets `allowMissedCheckpoints: true`, in which case the
// lap is recorded but flagged `invalidated: true` so callers can decide
// whether to count it toward placement.

const CHECKPOINT_RESULT_KIND = Object.freeze({
  PROGRESS: 'progress',
  LAP: 'lap',
  IGNORED: 'ignored',
  FINISH: 'finish',
});

class LapTracker {
  constructor(options = {}) {
    const totalLaps = options.totalLaps != null ? options.totalLaps : 3;
    const checkpointCount = options.checkpointCount != null ? options.checkpointCount : 3;
    if (!Number.isInteger(totalLaps) || totalLaps < 1) {
      throw new ValidationError('totalLaps must be a positive integer');
    }
    if (!Number.isInteger(checkpointCount) || checkpointCount < 0) {
      throw new ValidationError('checkpointCount must be a non-negative integer');
    }
    this._totalLaps = totalLaps;
    this._checkpointCount = checkpointCount;
    this._allowMissed = options.allowMissedCheckpoints === true;
    this._historyLimit = Number.isInteger(options.historyLimit)
      && options.historyLimit > 0 ? options.historyLimit : 32;
    this.reset();
  }

  reset() {
    this._currentLap = 0;             // 0 before crossing the start line.
    this._lapsCompleted = 0;
    this._expectedCheckpoint = 1;     // next checkpoint we need to hit.
    this._missedThisLap = 0;
    this._currentLapStartMs = null;
    this._lapHistory = [];
    this._bestLapMs = null;
    this._bestLapIndex = -1;
    this._currentLapInvalidated = false;
    this._lastCheckpointHitIndex = 0;
  }

  // Snapshot for HUDs / debug. Always returns plain JSON.
  snapshot() {
    return {
      totalLaps: this._totalLaps,
      checkpointCount: this._checkpointCount,
      currentLap: this._currentLap,
      lapsCompleted: this._lapsCompleted,
      expectedCheckpoint: this._expectedCheckpoint,
      missedThisLap: this._missedThisLap,
      currentLapStartMs: this._currentLapStartMs,
      currentLapInvalidated: this._currentLapInvalidated,
      lastCheckpointIndex: this._lastCheckpointHitIndex,
      bestLapMs: this._bestLapMs,
      bestLapIndex: this._bestLapIndex,
      lapHistory: this._lapHistory.slice(),
      finished: this._lapsCompleted >= this._totalLaps,
    };
  }

  get totalLaps() { return this._totalLaps; }
  get currentLap() { return this._currentLap; }
  get lapsCompleted() { return this._lapsCompleted; }
  get bestLapMs() { return this._bestLapMs; }
  get lapHistory() { return this._lapHistory.slice(); }
  get isFinished() { return this._lapsCompleted >= this._totalLaps; }

  // Called when the vehicle is reset to the last clean checkpoint after a
  // crash. The current lap is invalidated (still counted toward time, but
  // cannot become a personal-best lap).
  invalidateCurrentLap() {
    this._currentLapInvalidated = true;
  }

  // Record a checkpoint crossing. `index` is 0 for the start/finish line
  // and 1..checkpointCount for intermediate checkpoints. `timestampMs` is
  // the race clock (monotonic non-negative number) at the moment of the
  // crossing.
  recordCheckpoint(index, timestampMs) {
    if (!Number.isInteger(index) || index < 0 || index > this._checkpointCount) {
      throw new ValidationError(
        'checkpoint index out of range [0..' + this._checkpointCount + ']'
      );
    }
    if (!Number.isFinite(timestampMs) || timestampMs < 0) {
      throw new ValidationError('timestampMs must be a non-negative finite number');
    }
    if (this.isFinished) {
      return { kind: CHECKPOINT_RESULT_KIND.IGNORED, reason: 'race-finished' };
    }

    if (index === 0) {
      return this._handleStartFinishLine(timestampMs);
    }
    return this._handleIntermediate(index, timestampMs);
  }

  _handleIntermediate(index, timestampMs) {
    // Pre-race: ignore intermediate checkpoint hits (engine should never
    // emit them but defensive ignore keeps the contract simple).
    if (this._currentLap === 0) {
      return { kind: CHECKPOINT_RESULT_KIND.IGNORED, reason: 'pre-start' };
    }

    if (index === this._expectedCheckpoint) {
      this._expectedCheckpoint = index + 1;
      this._lastCheckpointHitIndex = index;
      return {
        kind: CHECKPOINT_RESULT_KIND.PROGRESS,
        checkpointIndex: index,
        nextExpected: this._expectedCheckpoint,
        timestampMs,
      };
    }

    // Out-of-order checkpoint.
    if (this._allowMissed) {
      this._missedThisLap += Math.max(0, index - this._expectedCheckpoint);
      this._expectedCheckpoint = index + 1;
      this._lastCheckpointHitIndex = index;
      this._currentLapInvalidated = true;
      return {
        kind: CHECKPOINT_RESULT_KIND.PROGRESS,
        checkpointIndex: index,
        nextExpected: this._expectedCheckpoint,
        timestampMs,
        outOfOrder: true,
      };
    }
    return {
      kind: CHECKPOINT_RESULT_KIND.IGNORED,
      reason: 'out-of-order',
      expected: this._expectedCheckpoint,
      received: index,
    };
  }

  _handleStartFinishLine(timestampMs) {
    // First crossing → arm the first lap.
    if (this._currentLap === 0) {
      this._currentLap = 1;
      this._expectedCheckpoint = 1;
      this._missedThisLap = 0;
      this._currentLapStartMs = timestampMs;
      this._currentLapInvalidated = false;
      this._lastCheckpointHitIndex = 0;
      return {
        kind: CHECKPOINT_RESULT_KIND.PROGRESS,
        checkpointIndex: 0,
        nextExpected: this._expectedCheckpoint,
        timestampMs,
        firstCrossing: true,
      };
    }

    const requiredCheckpoint = this._checkpointCount + 1;
    const allCheckpointsHit = this._expectedCheckpoint >= requiredCheckpoint;
    if (!allCheckpointsHit && !this._allowMissed) {
      return {
        kind: CHECKPOINT_RESULT_KIND.IGNORED,
        reason: 'missing-checkpoints',
        expected: this._expectedCheckpoint,
      };
    }

    const startMs = this._currentLapStartMs == null ? timestampMs : this._currentLapStartMs;
    const lapMs = Math.max(0, timestampMs - startMs);
    const lapInvalidated = this._currentLapInvalidated
      || (!allCheckpointsHit && this._allowMissed);

    const lapRecord = {
      lapNumber: this._currentLap,
      durationMs: lapMs,
      startedAtMs: startMs,
      finishedAtMs: timestampMs,
      missedCheckpoints: this._missedThisLap,
      invalid: lapInvalidated,
    };

    this._pushLapHistory(lapRecord);
    let isBestLap = false;
    if (!lapInvalidated && (this._bestLapMs == null || lapMs < this._bestLapMs)) {
      this._bestLapMs = lapMs;
      this._bestLapIndex = this._lapHistory.length - 1;
      isBestLap = true;
    }

    this._lapsCompleted = this._currentLap;
    const raceComplete = this._lapsCompleted >= this._totalLaps;

    if (raceComplete) {
      this._lastCheckpointHitIndex = 0;
      return {
        kind: CHECKPOINT_RESULT_KIND.FINISH,
        lap: lapRecord,
        bestLap: isBestLap,
        lapsCompleted: this._lapsCompleted,
        totalLaps: this._totalLaps,
        timestampMs,
      };
    }

    // Advance to the next lap.
    this._currentLap += 1;
    this._expectedCheckpoint = 1;
    this._missedThisLap = 0;
    this._currentLapStartMs = timestampMs;
    this._currentLapInvalidated = false;
    this._lastCheckpointHitIndex = 0;
    return {
      kind: CHECKPOINT_RESULT_KIND.LAP,
      lap: lapRecord,
      bestLap: isBestLap,
      lapsCompleted: this._lapsCompleted,
      totalLaps: this._totalLaps,
      nextLap: this._currentLap,
      timestampMs,
    };
  }

  _pushLapHistory(record) {
    this._lapHistory.push(record);
    if (this._lapHistory.length > this._historyLimit) {
      const dropped = this._lapHistory.length - this._historyLimit;
      this._lapHistory.splice(0, dropped);
      if (this._bestLapIndex >= 0) this._bestLapIndex -= dropped;
    }
  }
}

module.exports = { LapTracker, CHECKPOINT_RESULT_KIND };

'use strict';

const { EventEmitter } = require('./eventEmitter');
const { ValidationError, StateError } = require('./errors');
const {
  PHASE,
  FINISH_REASON,
  EVENTS,
  DEFAULTS,
  MODE,
} = require('./constants');
const { Countdown } = require('./countdown');
const { LapTracker, CHECKPOINT_RESULT_KIND } = require('./lapTracker');
const { CrashHandler } = require('./crashHandler');
const { computeFinishResults } = require('./finishResults');

// RaceState is the orchestration layer the rest of the arcade racer talks
// to. It owns the phase enum, drives the countdown / crash timers, and
// converts raw checkpoint hits from the Track Runtime into lap events. It
// is event-driven: the Driving Core and HUD subscribe to events instead of
// polling, but a synchronous `snapshot()` is also exposed for any consumer
// that prefers pull-based access.
class RaceState extends EventEmitter {
  constructor(options = {}) {
    super();
    const opts = Object.assign({}, DEFAULTS, options || {});
    if (!Number.isInteger(opts.totalLaps) || opts.totalLaps < 1) {
      throw new ValidationError('totalLaps must be a positive integer');
    }
    if (!Number.isInteger(opts.checkpointCount) || opts.checkpointCount < 0) {
      throw new ValidationError('checkpointCount must be a non-negative integer');
    }
    if (opts.timeLimitMs != null
      && (!Number.isFinite(opts.timeLimitMs) || opts.timeLimitMs <= 0)) {
      throw new ValidationError('timeLimitMs must be a positive number or null');
    }
    this._opts = opts;
    this._countdown = new Countdown({
      steps: opts.countdownSteps,
      stepMs: opts.countdownStepMs,
    });
    this._lapTracker = new LapTracker({
      totalLaps: opts.totalLaps,
      checkpointCount: opts.checkpointCount,
      allowMissedCheckpoints: opts.allowMissedCheckpoints,
      historyLimit: opts.topLapHistory,
    });
    this._crash = new CrashHandler({
      respawnDelayMs: opts.respawnDelayMs,
    });
    this._mode = opts.timeLimitMs != null ? MODE.TIME_ATTACK : MODE.LAP_RACE;
    this._resetState();
  }

  _resetState() {
    this._phase = PHASE.IDLE;
    this._previousPhase = null;
    this._raceClockMs = 0;
    this._countdownClockMs = 0;
    this._totalPausedMs = 0;
    this._pauseCount = 0;
    this._pauseStartedAtMs = null;
    this._finishedAtMs = null;
    this._finishReason = null;
    this._results = null;
    this._countdown.reset();
    this._lapTracker.reset();
    this._crash.reset();
  }

  // ------------------------------------------------------------------
  // Phase accessors
  // ------------------------------------------------------------------
  get phase() { return this._phase; }
  get previousPhase() { return this._previousPhase; }
  get mode() { return this._mode; }
  get raceClockMs() { return this._raceClockMs; }
  get totalPausedMs() { return this._totalPausedMs; }
  get isRunning() {
    return this._phase === PHASE.RACING
      || this._phase === PHASE.CRASHED
      || this._phase === PHASE.COUNTDOWN;
  }
  get isFinished() {
    return this._phase === PHASE.FINISHED || this._phase === PHASE.ABANDONED;
  }
  get results() { return this._results; }

  snapshot() {
    return {
      phase: this._phase,
      previousPhase: this._previousPhase,
      mode: this._mode,
      raceClockMs: this._raceClockMs,
      countdownClockMs: this._countdownClockMs,
      countdownBeat: this._countdown.currentBeat,
      countdownComplete: this._countdown.isComplete,
      totalPausedMs: this._totalPausedMs,
      pauseCount: this._pauseCount,
      finishedAtMs: this._finishedAtMs,
      finishReason: this._finishReason,
      timeLimitMs: this._opts.timeLimitMs,
      timeRemainingMs: this._opts.timeLimitMs != null
        ? Math.max(0, this._opts.timeLimitMs - this._raceClockMs)
        : null,
      lap: this._lapTracker.snapshot(),
      crash: this._crash.snapshot(),
      countdown: this._countdown.snapshot(),
      results: this._results,
    };
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  // Arm the race. Transitions IDLE → COUNTDOWN. Calling start() again
  // after FINISHED resets the run; otherwise it throws a StateError.
  start() {
    if (this._phase === PHASE.COUNTDOWN || this._phase === PHASE.RACING) {
      throw new StateError(
        'start() called from phase ' + this._phase,
        this._phase,
        'start'
      );
    }
    if (this._phase !== PHASE.IDLE) {
      this._resetState();
    }
    this._transition(PHASE.COUNTDOWN);
    this._emit(EVENTS.START, { state: this.snapshot() });
    const initial = this._countdown.peekInitialBeat();
    if (initial) {
      this._emit(EVENTS.COUNTDOWN_TICK, { beat: initial.value, state: this.snapshot() });
    }
    return true;
  }

  // Full reset back to IDLE. Useful for the "restart race" menu option.
  reset() {
    this._resetState();
    this._emit(EVENTS.RESET, { state: this.snapshot() });
    return true;
  }

  // Pause from RACING or CRASHED. Stores the previous phase so resume()
  // can restore it. Returns false (without throwing) if already paused or
  // not in a pausable phase, matching the convention in the tetris
  // scoring runtime.
  pause() {
    if (this._phase === PHASE.PAUSED) return false;
    if (this._phase !== PHASE.RACING
      && this._phase !== PHASE.CRASHED
      && this._phase !== PHASE.COUNTDOWN) {
      return false;
    }
    this._previousPhase = this._phase;
    this._pauseStartedAtMs = this._raceClockMs;
    this._pauseCount += 1;
    this._transition(PHASE.PAUSED);
    this._emit(EVENTS.PAUSE, { state: this.snapshot() });
    return true;
  }

  resume() {
    if (this._phase !== PHASE.PAUSED) return false;
    const target = this._previousPhase || PHASE.RACING;
    if (this._pauseStartedAtMs != null) {
      this._totalPausedMs += Math.max(0, this._raceClockMs - this._pauseStartedAtMs);
      this._pauseStartedAtMs = null;
    }
    this._transition(target);
    this._emit(EVENTS.RESUME, { state: this.snapshot() });
    return true;
  }

  // Abandon a run without finishing (DNF). Allowed from any phase that is
  // not already terminal.
  abandon(reasonDetail) {
    if (this.isFinished) return false;
    this._finishReason = FINISH_REASON.ABANDONED;
    this._finishedAtMs = this._raceClockMs;
    this._results = computeFinishResults({
      reason: FINISH_REASON.ABANDONED,
      lapHistory: this._lapTracker.lapHistory,
      lapsCompleted: this._lapTracker.lapsCompleted,
      totalLaps: this._opts.totalLaps,
      totalRaceMs: this._raceClockMs,
      finishedAtMs: this._raceClockMs,
      totalCrashes: this._crash.totalCrashes,
      pauseCount: this._pauseCount,
      totalPausedMs: this._totalPausedMs,
    });
    this._transition(PHASE.ABANDONED);
    this._emit(EVENTS.ABANDON, {
      detail: reasonDetail || null,
      results: this._results,
      state: this.snapshot(),
    });
    this._emit(EVENTS.RESULTS, { results: this._results, state: this.snapshot() });
    return true;
  }

  // ------------------------------------------------------------------
  // Tick
  // ------------------------------------------------------------------

  tick(dtMs) {
    if (!Number.isFinite(dtMs) || dtMs < 0) {
      throw new ValidationError('tick(dtMs) requires a non-negative finite number');
    }
    if (dtMs === 0) return;

    switch (this._phase) {
      case PHASE.COUNTDOWN:
        this._tickCountdown(dtMs);
        break;
      case PHASE.RACING:
        this._tickRacing(dtMs);
        break;
      case PHASE.CRASHED:
        this._tickCrashed(dtMs);
        break;
      case PHASE.PAUSED:
      case PHASE.IDLE:
      case PHASE.FINISHED:
      case PHASE.ABANDONED:
      default:
        return;
    }
  }

  _tickCountdown(dtMs) {
    let remaining = dtMs;
    while (remaining > 0 && this._phase === PHASE.COUNTDOWN) {
      const beforeBeat = this._countdown.currentBeat;
      // Cap step at the next beat boundary so each beat fires exactly
      // once even on absurdly large dt.
      const beatBudget = Math.max(1, this._opts.countdownStepMs);
      const step = Math.min(remaining, beatBudget);
      this._countdownClockMs += step;
      const beat = this._countdown.advance(step);
      remaining -= step;
      if (beat) {
        if (beat.kind === 'go') {
          this._emit(EVENTS.COUNTDOWN_GO, { state: this.snapshot() });
          this._transition(PHASE.RACING);
          this._emit(EVENTS.RACE_BEGIN, { state: this.snapshot() });
          if (remaining > 0) this._tickRacing(remaining);
          return;
        }
        if (beat.value !== beforeBeat) {
          this._emit(EVENTS.COUNTDOWN_TICK, { beat: beat.value, state: this.snapshot() });
        }
      }
    }
  }

  _tickRacing(dtMs) {
    this._raceClockMs += dtMs;
    this._emit(EVENTS.RACE_TICK, { dtMs, state: this.snapshot() });
    if (this._opts.timeLimitMs != null && this._raceClockMs >= this._opts.timeLimitMs) {
      this._finishByTimeout();
    }
  }

  _tickCrashed(dtMs) {
    // Race clock keeps running so the crash carries a cost.
    this._raceClockMs += dtMs;
    const drained = this._crash.advance(dtMs);
    this._emit(EVENTS.RACE_TICK, { dtMs, state: this.snapshot() });
    if (this._opts.timeLimitMs != null && this._raceClockMs >= this._opts.timeLimitMs) {
      this._finishByTimeout();
      return;
    }
    if (drained) {
      this._transition(PHASE.RACING);
      this._emit(EVENTS.RESPAWN, {
        checkpoint: this._crash.snapshot().lastRespawnCheckpoint,
        state: this.snapshot(),
      });
    }
  }

  // ------------------------------------------------------------------
  // External events from sibling subsystems
  // ------------------------------------------------------------------

  // Track Runtime calls this when the car crosses a checkpoint trigger.
  registerCheckpoint(index) {
    if (this._phase !== PHASE.RACING) {
      // While crashed or paused, ignore checkpoint hits so a respawning
      // car doesn't double-count progression.
      return { kind: CHECKPOINT_RESULT_KIND.IGNORED, reason: 'phase:' + this._phase };
    }
    const result = this._lapTracker.recordCheckpoint(index, this._raceClockMs);
    if (result.kind === CHECKPOINT_RESULT_KIND.PROGRESS) {
      this._emit(EVENTS.CHECKPOINT, {
        checkpointIndex: result.checkpointIndex,
        nextExpected: result.nextExpected,
        timestampMs: result.timestampMs,
        outOfOrder: result.outOfOrder === true,
        firstCrossing: result.firstCrossing === true,
        state: this.snapshot(),
      });
    } else if (result.kind === CHECKPOINT_RESULT_KIND.LAP) {
      this._emit(EVENTS.LAP_COMPLETE, {
        lap: result.lap,
        bestLap: result.bestLap,
        lapsCompleted: result.lapsCompleted,
        totalLaps: result.totalLaps,
        nextLap: result.nextLap,
        state: this.snapshot(),
      });
      if (result.bestLap) {
        this._emit(EVENTS.BEST_LAP, { lap: result.lap, state: this.snapshot() });
      }
    } else if (result.kind === CHECKPOINT_RESULT_KIND.FINISH) {
      if (result.bestLap) {
        this._emit(EVENTS.BEST_LAP, { lap: result.lap, state: this.snapshot() });
      }
      this._finishByCompletion(result);
    }
    return result;
  }

  // Driving Core calls this on a serious collision. The phase moves to
  // CRASHED and a respawn timer starts; while crashed, checkpoint hits
  // are ignored.
  registerCrash(options = {}) {
    if (this._phase !== PHASE.RACING) {
      return null;
    }
    // Anchor the respawn at the most recently cleared checkpoint so the
    // lap doesn't have to be restarted just because of one wipeout.
    const respawnCheckpoint = Number.isInteger(options.respawnCheckpoint)
      ? options.respawnCheckpoint
      : this._lapTracker.snapshot().lastCheckpointIndex;
    const info = this._crash.registerCrash({
      severity: options.severity,
      delayMs: options.delayMs,
      cause: options.cause,
      atMs: this._raceClockMs,
      respawnCheckpoint,
    });
    // A heavy crash voids the current lap's eligibility for a personal
    // best, mirroring most arcade racers' "lap invalidated" badge.
    if (info.severity !== 'minor') {
      this._lapTracker.invalidateCurrentLap();
    }
    this._transition(PHASE.CRASHED);
    this._emit(EVENTS.CRASH, {
      severity: info.severity,
      delayMs: info.delayMs,
      totalCrashes: info.totalCrashes,
      respawnCheckpoint,
      cause: options.cause || null,
      state: this.snapshot(),
    });
    return info;
  }

  // Allow the player or game to skip the remainder of the respawn timer
  // (e.g. tapping "respawn now"). Re-emits respawn + transitions to RACING.
  respawnNow() {
    if (this._phase !== PHASE.CRASHED) return false;
    this._crash.completeNow();
    this._transition(PHASE.RACING);
    this._emit(EVENTS.RESPAWN, {
      checkpoint: this._crash.snapshot().lastRespawnCheckpoint,
      state: this.snapshot(),
      forced: true,
    });
    return true;
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  _finishByCompletion(lapResult) {
    this._finishReason = FINISH_REASON.COMPLETED;
    this._finishedAtMs = this._raceClockMs;
    this._results = computeFinishResults({
      reason: FINISH_REASON.COMPLETED,
      lapHistory: this._lapTracker.lapHistory,
      lapsCompleted: this._lapTracker.lapsCompleted,
      totalLaps: this._opts.totalLaps,
      totalRaceMs: this._raceClockMs,
      finishedAtMs: this._raceClockMs,
      totalCrashes: this._crash.totalCrashes,
      pauseCount: this._pauseCount,
      totalPausedMs: this._totalPausedMs,
    });
    this._transition(PHASE.FINISHED);
    this._emit(EVENTS.FINISH, {
      lap: lapResult.lap,
      lapsCompleted: lapResult.lapsCompleted,
      totalLaps: lapResult.totalLaps,
      results: this._results,
      state: this.snapshot(),
    });
    this._emit(EVENTS.RESULTS, { results: this._results, state: this.snapshot() });
  }

  _finishByTimeout() {
    this._finishReason = FINISH_REASON.TIMED_OUT;
    this._finishedAtMs = this._raceClockMs;
    this._results = computeFinishResults({
      reason: FINISH_REASON.TIMED_OUT,
      lapHistory: this._lapTracker.lapHistory,
      lapsCompleted: this._lapTracker.lapsCompleted,
      totalLaps: this._opts.totalLaps,
      totalRaceMs: this._raceClockMs,
      finishedAtMs: this._raceClockMs,
      totalCrashes: this._crash.totalCrashes,
      pauseCount: this._pauseCount,
      totalPausedMs: this._totalPausedMs,
    });
    this._transition(PHASE.FINISHED);
    this._emit(EVENTS.FINISH, {
      reason: FINISH_REASON.TIMED_OUT,
      results: this._results,
      state: this.snapshot(),
    });
    this._emit(EVENTS.RESULTS, { results: this._results, state: this.snapshot() });
  }

  _transition(nextPhase) {
    if (nextPhase === this._phase) return;
    const from = this._phase;
    this._phase = nextPhase;
    this._emit(EVENTS.PHASE_CHANGE, { from, to: nextPhase, state: this.snapshot() });
  }

  _emit(name, payload) {
    this.emit(name, payload);
  }
}

module.exports = { RaceState };

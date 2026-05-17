'use strict';

const { EventEmitter } = require('./eventEmitter');
const { ValidationError, StateError } = require('./errors');
const { scoreLineClear } = require('./lineClearScorer');
const { nextCombo, comboBonus, comboMultiplier } = require('./comboTracker');
const {
  computeLevel,
  linesUntilNextLevel,
  fallSpeedMs,
} = require('./levelProgression');
const {
  DEFAULT_LINES_PER_LEVEL,
  DEFAULT_MAX_LEVEL,
  SOFT_DROP_POINTS_PER_CELL,
  HARD_DROP_POINTS_PER_CELL,
  EVENTS,
} = require('./constants');

// Stateful scoring runtime for a Tetris session. The Game Core notifies the
// runtime of meaningful events (piece locks, line clears, drops) and the
// runtime tracks score, level, combo, and back-to-back state. Listeners (HUD,
// sound effects, telemetry) subscribe via the EventEmitter interface to get
// granular run-state feedback.
class ScoringRuntime extends EventEmitter {
  constructor(options = {}) {
    super();
    const startLevel = options.startLevel != null ? options.startLevel : 1;
    if (!Number.isInteger(startLevel) || startLevel < 1) {
      throw new ValidationError('startLevel must be a positive integer');
    }
    const linesPerLevel = options.linesPerLevel != null
      ? options.linesPerLevel
      : DEFAULT_LINES_PER_LEVEL;
    if (!Number.isInteger(linesPerLevel) || linesPerLevel <= 0) {
      throw new ValidationError('linesPerLevel must be a positive integer');
    }
    const maxLevel = options.maxLevel != null ? options.maxLevel : DEFAULT_MAX_LEVEL;
    if (!Number.isInteger(maxLevel) || maxLevel < 1) {
      throw new ValidationError('maxLevel must be a positive integer');
    }
    this._startLevel = startLevel;
    this._linesPerLevel = linesPerLevel;
    this._maxLevel = maxLevel;
    this._gravityCurve = options.gravityCurve || null;
    this._softDropPoints = options.softDropPointsPerCell != null
      ? options.softDropPointsPerCell : SOFT_DROP_POINTS_PER_CELL;
    this._hardDropPoints = options.hardDropPointsPerCell != null
      ? options.hardDropPointsPerCell : HARD_DROP_POINTS_PER_CELL;
    if (this._softDropPoints < 0 || this._hardDropPoints < 0) {
      throw new ValidationError('drop point values must be >= 0');
    }
    this._strictPause = options.strictPause === true;
    this._resetState();
  }

  _resetState() {
    this._score = 0;
    this._level = this._startLevel;
    this._lines = 0;
    this._combo = 0;
    this._backToBack = 0;
    this._maxCombo = 0;
    this._maxBackToBack = 0;
    this._tetrises = 0;
    this._tSpins = 0;
    this._perfectClears = 0;
    this._totalLockedPieces = 0;
    this._lastEvent = null;
    this._paused = false;
    this._gameOver = false;
    this._started = false;
  }

  // -------- lifecycle --------

  reset() {
    this._resetState();
    this._emit(EVENTS.RESET, { state: this.snapshot() });
  }

  start() {
    if (this._gameOver) this._resetState();
    if (!this._started) {
      this._started = true;
      this._emit(EVENTS.START, { state: this.snapshot() });
    }
  }

  pause() {
    if (this._paused || this._gameOver) return false;
    this._paused = true;
    this._emit(EVENTS.PAUSE, { state: this.snapshot() });
    return true;
  }

  resume() {
    if (!this._paused) return false;
    this._paused = false;
    this._emit(EVENTS.RESUME, { state: this.snapshot() });
    return true;
  }

  gameOver() {
    if (this._gameOver) return false;
    this._gameOver = true;
    // Lock-out terminates any active combo / b2b chain.
    const previousCombo = this._combo;
    const previousB2B = this._backToBack;
    this._combo = 0;
    this._backToBack = 0;
    const state = this.snapshot();
    this._emit(EVENTS.GAME_OVER, { state });
    if (previousCombo >= 2) {
      this._emit(EVENTS.COMBO_BREAK, { previous: previousCombo, state });
    }
    if (previousB2B > 0) {
      this._emit(EVENTS.B2B_BREAK, { previous: previousB2B, state });
    }
    return true;
  }

  // -------- queries --------

  isPaused() { return this._paused; }
  isGameOver() { return this._gameOver; }
  isStarted() { return this._started; }

  snapshot() {
    const linesIntoCurrentLevel = this._lines
      - (this._level - this._startLevel) * this._linesPerLevel;
    return {
      score: this._score,
      level: this._level,
      lines: this._lines,
      startLevel: this._startLevel,
      combo: this._combo,
      comboMultiplier: comboMultiplier(this._combo),
      backToBack: this._backToBack,
      backToBackActive: this._backToBack > 0,
      maxCombo: this._maxCombo,
      maxBackToBack: this._maxBackToBack,
      tetrises: this._tetrises,
      tSpins: this._tSpins,
      perfectClears: this._perfectClears,
      totalLockedPieces: this._totalLockedPieces,
      linesUntilNextLevel: linesUntilNextLevel({
        totalLines: linesIntoCurrentLevel,
        linesPerLevel: this._linesPerLevel,
      }),
      fallSpeedMs: this.getFallSpeedMs(),
      paused: this._paused,
      gameOver: this._gameOver,
      started: this._started,
      lastEvent: this._lastEvent ? { ...this._lastEvent } : null,
    };
  }

  getFallSpeedMs() {
    return fallSpeedMs(this._level, {
      gravityCurve: this._gravityCurve,
      maxLevel: this._maxLevel,
    });
  }

  // -------- registration --------

  registerLineClear(input) {
    this._guardActive('registerLineClear');

    const previousLevel = this._level;
    const previousCombo = this._combo;
    const previousBackToBack = this._backToBack;
    const previousLines = this._lines;
    const backToBackActive = this._backToBack > 0;

    const clearResult = scoreLineClear(input, {
      level: this._level,
      backToBackActive,
    });

    const newCombo = nextCombo({
      combo: this._combo,
      clearedLines: clearResult.lines,
    });
    const comboPoints = comboBonus({ combo: newCombo, level: this._level });

    let newBackToBack = this._backToBack;
    if (clearResult.lines > 0) {
      if (clearResult.difficult) {
        newBackToBack = this._backToBack + 1;
      } else if (clearResult.breaksBackToBack) {
        newBackToBack = 0;
      }
    }

    const totalPoints = clearResult.total + comboPoints;

    // Mutate state ---------------------------------------------------------
    this._totalLockedPieces += 1;
    this._lines += clearResult.lines;
    this._combo = newCombo;
    this._backToBack = newBackToBack;
    if (newCombo > this._maxCombo) this._maxCombo = newCombo;
    if (newBackToBack > this._maxBackToBack) this._maxBackToBack = newBackToBack;
    if (clearResult.lines === 4) this._tetrises += 1;
    if (clearResult.tSpin && clearResult.lines > 0) this._tSpins += 1;
    if (clearResult.perfectClear) this._perfectClears += 1;
    this._score += totalPoints;
    this._level = computeLevel({
      totalLines: this._lines,
      startLevel: this._startLevel,
      linesPerLevel: this._linesPerLevel,
    });

    this._lastEvent = {
      kind: 'line-clear',
      lines: clearResult.lines,
      tSpin: clearResult.tSpin,
      mini: clearResult.mini,
      perfectClear: clearResult.perfectClear,
      badge: clearResult.badge,
      basePoints: clearResult.scaledBase,
      perfectClearPoints: clearResult.perfectClearPoints,
      comboPoints,
      totalPoints,
      b2bMultiplier: clearResult.b2bMultiplier,
      combo: newCombo,
      backToBack: newBackToBack,
      difficult: clearResult.difficult,
    };

    const state = this.snapshot();

    // Emit events ----------------------------------------------------------
    if (clearResult.lines > 0) {
      this._emit(EVENTS.LINES_CHANGE, {
        lines: this._lines,
        previous: previousLines,
        delta: clearResult.lines,
        state,
      });
    }

    if (newCombo !== previousCombo) {
      this._emit(EVENTS.COMBO_CHANGE, {
        combo: newCombo,
        previous: previousCombo,
        points: comboPoints,
        multiplier: comboMultiplier(newCombo),
        state,
      });
      if (previousCombo >= 2 && newCombo === 0) {
        this._emit(EVENTS.COMBO_BREAK, { previous: previousCombo, state });
      }
    }

    if (newBackToBack !== previousBackToBack) {
      this._emit(EVENTS.B2B_CHANGE, {
        backToBack: newBackToBack,
        previous: previousBackToBack,
        state,
      });
      if (previousBackToBack > 0 && newBackToBack === 0) {
        this._emit(EVENTS.B2B_BREAK, { previous: previousBackToBack, state });
      }
    }

    if (totalPoints > 0) {
      this._emit(EVENTS.SCORE_CHANGE, {
        score: this._score,
        delta: totalPoints,
        source: 'line-clear',
        breakdown: {
          basePoints: clearResult.scaledBase,
          perfectClearPoints: clearResult.perfectClearPoints,
          comboPoints,
          b2bMultiplier: clearResult.b2bMultiplier,
        },
        state,
      });
    }

    if (this._level !== previousLevel) {
      this._emit(EVENTS.LEVEL_UP, {
        previous: previousLevel,
        level: this._level,
        fallSpeedMs: this.getFallSpeedMs(),
        state,
      });
    }

    this._emit(EVENTS.LINE_CLEAR, {
      lines: clearResult.lines,
      tSpin: clearResult.tSpin,
      mini: clearResult.mini,
      perfectClear: clearResult.perfectClear,
      badge: clearResult.badge,
      difficult: clearResult.difficult,
      basePoints: clearResult.scaledBase,
      perfectClearPoints: clearResult.perfectClearPoints,
      comboPoints,
      totalPoints,
      b2bMultiplier: clearResult.b2bMultiplier,
      combo: newCombo,
      backToBack: newBackToBack,
      state,
    });

    return { ...this._lastEvent, state };
  }

  registerLockNoClear() {
    this._guardActive('registerLockNoClear');
    const previousCombo = this._combo;

    this._totalLockedPieces += 1;
    this._combo = 0;
    this._lastEvent = {
      kind: 'lock',
      lines: 0,
      combo: 0,
      backToBack: this._backToBack,
    };

    const state = this.snapshot();

    if (previousCombo !== 0) {
      this._emit(EVENTS.COMBO_CHANGE, {
        combo: 0,
        previous: previousCombo,
        points: 0,
        multiplier: 0,
        state,
      });
      if (previousCombo >= 2) {
        this._emit(EVENTS.COMBO_BREAK, { previous: previousCombo, state });
      }
    }

    this._emit(EVENTS.LOCK, { cleared: 0, state });
    return { ...this._lastEvent, state };
  }

  registerSoftDrop(cells) {
    return this._registerDrop(cells, 'soft', this._softDropPoints);
  }

  registerHardDrop(cells) {
    return this._registerDrop(cells, 'hard', this._hardDropPoints);
  }

  _registerDrop(cells, kind, pointsPerCell) {
    this._guardActive(kind === 'soft' ? 'registerSoftDrop' : 'registerHardDrop');
    if (!Number.isInteger(cells) || cells < 0) {
      throw new ValidationError(`${kind} drop cells must be a non-negative integer`);
    }
    if (cells === 0) {
      return { points: 0, cells: 0, source: `${kind}-drop`, state: this.snapshot() };
    }
    const points = cells * pointsPerCell;
    this._score += points;
    this._lastEvent = { kind: `${kind}-drop`, cells, points };
    const state = this.snapshot();
    const eventName = kind === 'soft' ? EVENTS.SOFT_DROP : EVENTS.HARD_DROP;
    this._emit(eventName, { cells, points, state });
    if (points > 0) {
      this._emit(EVENTS.SCORE_CHANGE, {
        score: this._score,
        delta: points,
        source: `${kind}-drop`,
        state,
      });
    }
    return { points, cells, source: `${kind}-drop`, state };
  }

  // -------- internals --------

  _guardActive(operation) {
    if (this._gameOver) {
      throw new StateError(`${operation}: cannot register after game over`);
    }
    if (this._strictPause && this._paused) {
      throw new StateError(`${operation}: runtime is paused`);
    }
  }

  // Wrapper around emit() so listener exceptions never silently corrupt
  // subsequent emissions. The EventEmitter base class already routes
  // listener errors to the 'error' event; this just makes the intent
  // explicit at call sites.
  _emit(name, payload) {
    this.emit(name, payload);
  }
}

module.exports = {
  ScoringRuntime,
  EVENTS,
};

'use strict';

const { EventEmitter } = require('./events');
const {
  STATES,
  TRANSITIONS,
  canTransition,
  assertTransition,
  isState,
} = require('./states');
const {
  OperationsError,
  SkinLoadError,
  ObstacleGenerationError,
  SnapshotCorruptError,
  RecoveryFailedError,
  InvalidStateError,
  serializeError,
} = require('./errors');
const { SkinCatalog, DEFAULT_SKIN_ID } = require('./skinCatalog');
const { ObstacleLayoutLoader } = require('./obstacleLayoutLoader');
const { SnapshotStore } = require('./snapshotStore');

const TERMINAL_STATES_FOR_RESTART = Object.freeze([
  STATES.EMPTY,
  STATES.COMPLETED,
  STATES.ERROR,
]);

class OperationsRuntime extends EventEmitter {
  constructor(options) {
    super();
    const opts = options || {};
    this._state = STATES.BOOTING;
    this._clock = opts.clock || (() => Date.now());
    this._catalog = opts.skinCatalog || new SkinCatalog({ defaultId: opts.defaultSkinId });
    this._obstacles = opts.obstacleLoader || new ObstacleLayoutLoader({
      defaultDifficulty: opts.defaultDifficulty,
    });
    this._snapshots = opts.snapshotStore || new SnapshotStore({ clock: this._clock });
    this._loaders = {
      skins: typeof opts.skinLoader === 'function' ? opts.skinLoader : null,
    };
    this._loadingTicket = 0;
    this._lastError = null;
    this._lastCompletion = null;
    this._startedAt = null;
    this._pendingLoad = null;
  }

  get state() {
    return this._state;
  }

  get skinCatalog() {
    return this._catalog;
  }

  get obstacleLoader() {
    return this._obstacles;
  }

  get snapshotStore() {
    return this._snapshots;
  }

  get lastError() {
    return this._lastError;
  }

  get lastCompletion() {
    return this._lastCompletion;
  }

  get isLoading() {
    return this._state === STATES.LOADING;
  }

  get isEmpty() {
    return this._state === STATES.EMPTY;
  }

  get isErrored() {
    return this._state === STATES.ERROR;
  }

  get isCompleted() {
    return this._state === STATES.COMPLETED;
  }

  // Returns the human-facing operational view for the UI: which state and
  // the relevant payload (loading progress, error message, completion stats).
  view() {
    const base = { state: this._state, at: this._clock() };
    switch (this._state) {
      case STATES.BOOTING:
        return Object.assign(base, {
          message: 'Preparing Modern Snake…',
        });
      case STATES.LOADING:
        return Object.assign(base, this._loadingView());
      case STATES.EMPTY:
        return Object.assign(base, this._emptyView());
      case STATES.ACTIVE:
        return Object.assign(base, {
          message: 'Game in progress',
          selectedSkin: this._catalog.getSelected(),
          obstacles: this._obstacles.current,
        });
      case STATES.PAUSED:
        return Object.assign(base, {
          message: 'Paused',
          canResume: true,
          selectedSkin: this._catalog.getSelected(),
          obstacles: this._obstacles.current,
        });
      case STATES.RECOVERING:
        return Object.assign(base, {
          message: 'Recovering previous game…',
        });
      case STATES.ERROR:
        return Object.assign(base, this._errorView());
      case STATES.COMPLETED:
        return Object.assign(base, this._completionView());
      default:
        return base;
    }
  }

  _loadingView() {
    const ticket = this._pendingLoad;
    return {
      message: 'Loading assets and obstacle layout…',
      progress: ticket ? ticket.progress : 0,
      skinsLoaded: ticket ? ticket.skinsLoaded : false,
      obstaclesReady: ticket ? ticket.obstaclesReady : false,
    };
  }

  _emptyView() {
    const skins = this._catalog.list();
    const obstacles = this._obstacles.current;
    const difficulty = obstacles ? obstacles.difficulty : this._obstacles.defaultDifficulty;
    const message = obstacles && obstacles.count > 0
      ? 'Ready to play. ' + obstacles.count + ' obstacles set to ' + obstacles.difficultyName + '.'
      : 'Ready to play. Choose a skin and obstacle mode.';
    return {
      message,
      canStart: true,
      canRecover: this._snapshots.has(),
      selectedSkin: this._catalog.getSelected(),
      skins,
      obstacles,
      difficulty,
    };
  }

  _errorView() {
    const err = this._lastError;
    return {
      message: (err && err.message) || 'Something went wrong',
      error: serializeError(err),
      canRecover: !!(err && err.recoverable !== false) && (this._snapshots.has() || this._canRetryLoad()),
      canReset: true,
      hasSnapshot: this._snapshots.has(),
    };
  }

  _completionView() {
    const c = this._lastCompletion || {};
    return {
      message: c.reason === 'win' ? 'You win!' : 'Game over',
      reason: c.reason || 'game_over',
      score: typeof c.score === 'number' ? c.score : 0,
      durationMs: typeof c.durationMs === 'number' ? c.durationMs : 0,
      skin: c.skin || this._catalog.getSelected(),
      obstacles: c.obstacles || this._obstacles.current,
      stats: c.stats || null,
      canRestart: true,
    };
  }

  _canRetryLoad() {
    return !!this._loaders.skins;
  }

  _setState(next, payload) {
    assertTransition(this._state, next);
    const prev = this._state;
    this._state = next;
    this.emit('state:change', { from: prev, to: next, payload: payload || null });
    this.emit('state:' + next, payload || null);
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  // Drives BOOTING/EMPTY/COMPLETED/ERROR → LOADING → EMPTY|ERROR. Concurrent
  // calls cancel the in-flight load by ticket.
  load(params) {
    if (this._state !== STATES.BOOTING && !canTransition(this._state, STATES.LOADING)) {
      return Promise.reject(
        new InvalidStateError('cannot load from state ' + this._state)
      );
    }
    const ticket = { id: ++this._loadingTicket, progress: 0, skinsLoaded: false, obstaclesReady: false };
    this._pendingLoad = ticket;
    this._setState(STATES.LOADING, { ticket: ticket.id });

    const p = params || {};
    const skinPromise = this._loaders.skins
      ? this._catalog.load(this._loaders.skins).then((added) => {
          ticket.skinsLoaded = true;
          ticket.progress = Math.max(ticket.progress, 0.5);
          this.emit('loading:progress', { stage: 'skins', progress: ticket.progress, added });
          return added;
        })
      : Promise.resolve([]).then(() => {
          ticket.skinsLoaded = true;
          ticket.progress = Math.max(ticket.progress, 0.5);
          this.emit('loading:progress', { stage: 'skins', progress: ticket.progress, added: [] });
          return [];
        });

    return skinPromise
      .then(() => {
        if (this._pendingLoad !== ticket) {
          return null;
        }
        return this._obstacles.load(p.obstacles).then((layout) => {
          ticket.obstaclesReady = true;
          ticket.progress = 1;
          this.emit('loading:progress', {
            stage: 'obstacles',
            progress: 1,
            obstacles: layout,
          });
          return layout;
        });
      })
      .then((layout) => {
        if (this._pendingLoad !== ticket) {
          return { cancelled: true };
        }
        if (p.selectSkin) {
          try {
            this._catalog.select(p.selectSkin);
          } catch (err) {
            this._failToError(err);
            throw err;
          }
        } else if (!this._catalog.selectedId || !this._catalog.has(this._catalog.selectedId)) {
          this._catalog.select(this._catalog.defaultId);
        }
        this._pendingLoad = null;
        this._lastError = null;
        this._setState(STATES.EMPTY, { skins: this._catalog.list().length, obstacles: layout });
        return { state: this._state, obstacles: layout };
      })
      .catch((err) => {
        if (this._pendingLoad === ticket) {
          this._pendingLoad = null;
          this._failToError(err);
        }
        throw err;
      });
  }

  _failToError(err) {
    const normalized = err instanceof OperationsError
      ? err
      : new OperationsError(err && err.message ? err.message : 'unexpected error', 'UNEXPECTED', {
          cause: err,
        });
    this._lastError = normalized;
    if (canTransition(this._state, STATES.ERROR)) {
      this._setState(STATES.ERROR, { error: serializeError(normalized) });
    }
  }

  // ─── Empty → Active ──────────────────────────────────────────────────────

  startGame(options) {
    if (this._state !== STATES.EMPTY) {
      throw new InvalidStateError('cannot start game from ' + this._state);
    }
    const opts = options || {};
    if (opts.skinId) this._catalog.select(opts.skinId);
    this._startedAt = this._clock();
    this._setState(STATES.ACTIVE, {
      skin: this._catalog.getSelected(),
      obstacles: this._obstacles.current,
      startedAt: this._startedAt,
    });
    return this.view();
  }

  // ─── Active ↔ Paused ─────────────────────────────────────────────────────

  pauseGame() {
    if (this._state !== STATES.ACTIVE) {
      throw new InvalidStateError('cannot pause from ' + this._state);
    }
    this._setState(STATES.PAUSED, {});
    return this.view();
  }

  resumeGame() {
    if (this._state !== STATES.PAUSED) {
      throw new InvalidStateError('cannot resume from ' + this._state);
    }
    this._setState(STATES.ACTIVE, { resumedAt: this._clock() });
    return this.view();
  }

  // ─── Active → Completed ──────────────────────────────────────────────────

  completeGame(result) {
    if (this._state !== STATES.ACTIVE && this._state !== STATES.PAUSED) {
      throw new InvalidStateError('cannot complete from ' + this._state);
    }
    const r = result || {};
    const completion = Object.freeze({
      reason: r.reason || 'game_over',
      score: typeof r.score === 'number' ? r.score : 0,
      durationMs:
        typeof r.durationMs === 'number'
          ? r.durationMs
          : this._startedAt
          ? Math.max(0, this._clock() - this._startedAt)
          : 0,
      skin: this._catalog.getSelected(),
      obstacles: this._obstacles.current,
      stats: r.stats ? Object.freeze(Object.assign({}, r.stats)) : null,
    });
    this._lastCompletion = completion;
    this._snapshots.clear();
    this._startedAt = null;
    this._setState(STATES.COMPLETED, { completion });
    return completion;
  }

  // ─── Error / Recovery ───────────────────────────────────────────────────

  reportError(err) {
    const e = err instanceof Error
      ? err
      : new OperationsError(String(err && err.message ? err.message : err), 'REPORTED');
    if (!canTransition(this._state, STATES.ERROR)) {
      throw new InvalidStateError('cannot enter ERROR from ' + this._state);
    }
    this._failToError(e);
    return this.view();
  }

  // Persists a snapshot so a later error/refresh can recover. Allowed in
  // ACTIVE or PAUSED only — snapshots represent in-progress games.
  saveSnapshot(payload) {
    if (this._state !== STATES.ACTIVE && this._state !== STATES.PAUSED) {
      throw new InvalidStateError('cannot snapshot from ' + this._state);
    }
    const merged = Object.assign(
      {
        skinId: this._catalog.selectedId,
        skin: this._catalog.getSelected(),
        obstacles: this._obstacles.current,
      },
      payload || {}
    );
    return this._snapshots.save(merged);
  }

  // Attempts to restore the last snapshot. On success, transitions to ACTIVE
  // unless the caller chose `to:'empty'` (used to recover identity but stay
  // idle, e.g. after a refresh).
  recover(options) {
    if (this._state !== STATES.ERROR && this._state !== STATES.EMPTY) {
      throw new InvalidStateError('cannot recover from ' + this._state);
    }
    const opts = options || {};
    this._setState(STATES.RECOVERING, {});
    return Promise.resolve()
      .then(() => {
        let snap;
        try {
          snap = this._snapshots.load();
        } catch (err) {
          throw err;
        }
        if (!snap) {
          throw new RecoveryFailedError('no snapshot available', { recoverable: false });
        }
        if (snap.skinId && this._catalog.has(snap.skinId)) {
          this._catalog.select(snap.skinId);
        }
        if (snap.obstacles) {
          // Restore the previously generated layout exactly so the world is
          // identical post-recovery.
          this._obstacles._current = Object.freeze(
            Object.assign({}, snap.obstacles, {
              cells: Object.freeze(
                (snap.obstacles.cells || []).map((c) => Object.freeze(Object.assign({}, c)))
              ),
            })
          );
        }
        const target = opts.to === 'empty' ? STATES.EMPTY : STATES.ACTIVE;
        if (target === STATES.ACTIVE) {
          this._startedAt = this._clock();
        }
        this._lastError = null;
        this._setState(target, { recovered: true, snapshot: snap });
        return { snapshot: snap, state: this._state };
      })
      .catch((err) => {
        const failure = err instanceof OperationsError
          ? err
          : new RecoveryFailedError(err && err.message ? err.message : 'recovery failed', {
              cause: err,
            });
        this._lastError = failure;
        // RECOVERING → ERROR is allowed; if the snapshot was simply absent
        // and the caller is okay with that we just drop back to ERROR.
        if (canTransition(this._state, STATES.ERROR)) {
          this._setState(STATES.ERROR, { error: serializeError(failure) });
        }
        throw failure;
      });
  }

  // Discards the snapshot and returns to EMPTY (a clean slate). Useful when
  // the player decides not to recover, or when recovery itself fails on
  // corrupt data.
  reset() {
    this._snapshots.clear();
    this._lastError = null;
    this._startedAt = null;
    const target = this._state === STATES.ERROR || this._state === STATES.COMPLETED
      ? STATES.EMPTY
      : null;
    if (target === null) {
      throw new InvalidStateError('cannot reset from ' + this._state);
    }
    this._setState(target, { reset: true });
    return this.view();
  }

  // Restarts: discards prior completion/error data and loads again with the
  // same (or new) params. Convenience wrapper used by the completion screen.
  restart(params) {
    if (TERMINAL_STATES_FOR_RESTART.indexOf(this._state) === -1) {
      return Promise.reject(new InvalidStateError('cannot restart from ' + this._state));
    }
    this._snapshots.clear();
    this._lastCompletion = null;
    this._lastError = null;
    if (this._state !== STATES.EMPTY) {
      // Move back through EMPTY → LOADING for a fresh load cycle.
      this._setState(STATES.EMPTY, { reset: true });
    }
    return this.load(params);
  }
}

module.exports = {
  OperationsRuntime,
  STATES,
  TRANSITIONS,
  isState,
};

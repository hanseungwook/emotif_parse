'use strict';

const { PIECES, getAbsoluteCells, normalizeRotation } = require('./pieces');
const { Board } = require('./board');
const { SevenBag } = require('./bag');
const { getKicks } = require('./rotation');
const { gravityMsForLevel, levelForLines, DEFAULT_LINES_PER_LEVEL } = require('./gravity');
const { scoreLineClear, scoreSoftDrop, scoreHardDrop } = require('./scoring');
const { EventBus } = require('./events');

const PHASE = Object.freeze({
  READY: 'ready',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver',
});

const GAME_OVER_REASON = Object.freeze({
  BLOCK_OUT: 'blockOut',
  LOCK_OUT: 'lockOut',
});

const DEFAULTS = Object.freeze({
  cols: 10,
  visibleRows: 20,
  bufferRows: 2,
  startLevel: 1,
  lockDelayMs: 500,
  maxLockResets: 15,
  nextQueueSize: 5,
  softDropFactor: 20,
  linesPerLevel: DEFAULT_LINES_PER_LEVEL,
});

class TetrisEngine {
  constructor(options) {
    const opts = Object.assign({}, DEFAULTS, options || {});
    if (!Number.isFinite(opts.lockDelayMs) || opts.lockDelayMs < 0) {
      throw new RangeError('lockDelayMs must be a non-negative number');
    }
    if (!Number.isInteger(opts.maxLockResets) || opts.maxLockResets < 0) {
      throw new RangeError('maxLockResets must be a non-negative integer');
    }
    if (!Number.isFinite(opts.softDropFactor) || opts.softDropFactor <= 0) {
      throw new RangeError('softDropFactor must be a positive number');
    }
    this._opts = opts;
    this._board = new Board({
      cols: opts.cols,
      visibleRows: opts.visibleRows,
      bufferRows: opts.bufferRows,
    });
    this._events = new EventBus();

    const rng = typeof opts.rng === 'function' ? opts.rng : null;
    this._bag = opts.bag || new SevenBag(rng ? { rng } : undefined);

    this._phase = PHASE.READY;
    this._active = null;
    this._level = opts.startLevel;
    this._lines = 0;
    this._score = 0;
    this._gameOverReason = null;
    this._gravityMs = 0;
    this._lockDelayMs = 0;
    this._lockResets = 0;
    this._softDropHeld = false;
  }

  on(event, handler) { return this._events.on(event, handler); }
  off(event, handler) { return this._events.off(event, handler); }

  // ----- lifecycle -----
  start() {
    if (this._phase === PHASE.PLAYING) return false;
    this._board.reset();
    this._active = null;
    this._level = this._opts.startLevel;
    this._lines = 0;
    this._score = 0;
    this._gameOverReason = null;
    this._gravityMs = 0;
    this._lockDelayMs = 0;
    this._lockResets = 0;
    this._softDropHeld = false;
    this._phase = PHASE.PLAYING;
    this._events.emit('start', { level: this._level });
    this._spawnNext();
    return this._phase === PHASE.PLAYING;
  }

  tick(dtMs) {
    if (this._phase !== PHASE.PLAYING || !this._active) return;
    if (!Number.isFinite(dtMs) || dtMs <= 0) return;

    let remaining = dtMs;
    // Loop so a single large dt can consume multiple gravity steps or a full
    // lock-delay window without losing the leftover time.
    while (remaining > 0 && this._phase === PHASE.PLAYING && this._active) {
      const grounded = this._isGrounded();
      if (grounded) {
        const lockBudget = Math.max(0, this._opts.lockDelayMs - this._lockDelayMs);
        const advance = Math.min(remaining, lockBudget);
        this._lockDelayMs += advance;
        remaining -= advance;
        this._gravityMs = 0;
        if (this._lockDelayMs >= this._opts.lockDelayMs) {
          this._lockPiece();
        } else if (advance === 0) {
          // No budget left and not yet ready to lock → exit to avoid spinning.
          break;
        }
      } else {
        const gravity = this._currentGravityMs();
        const gravityBudget = Math.max(1, gravity - this._gravityMs);
        const advance = Math.min(remaining, gravityBudget);
        this._gravityMs += advance;
        remaining -= advance;
        if (this._gravityMs >= gravity) {
          this._gravityMs = 0;
          const moved = this._tryMoveRaw(0, 1);
          if (moved) {
            if (this._softDropHeld) this._score += scoreSoftDrop(1);
            this._events.emit('move', this._snapshotActive());
          }
        }
      }
    }
  }

  // ----- input -----
  moveLeft() { return this._inputMove(-1, 0); }
  moveRight() { return this._inputMove(1, 0); }

  softDrop(enable) {
    if (this._phase !== PHASE.PLAYING) return false;
    this._softDropHeld = enable !== false;
    return true;
  }

  softDropStep() {
    if (this._phase !== PHASE.PLAYING || !this._active) return false;
    const moved = this._tryMoveRaw(0, 1);
    if (moved) {
      this._score += scoreSoftDrop(1);
      this._gravityMs = 0;
      this._onSuccessfulMove();
      this._events.emit('move', this._snapshotActive());
    }
    return moved;
  }

  hardDrop() {
    if (this._phase !== PHASE.PLAYING || !this._active) return 0;
    let rows = 0;
    while (this._tryMoveRaw(0, 1)) rows++;
    this._score += scoreHardDrop(rows);
    if (rows > 0) {
      this._events.emit('move', this._snapshotActive());
    }
    this._lockPiece();
    return rows;
  }

  rotate(direction) {
    if (this._phase !== PHASE.PLAYING || !this._active) return false;
    const dir = direction < 0 ? -1 : 1;
    const fromRot = this._active.rotation;
    const toRot = normalizeRotation(fromRot + dir);
    if (toRot === fromRot) return false;

    const kicks = getKicks(this._active.type, fromRot, toRot);
    for (let i = 0; i < kicks.length; i++) {
      const [dc, dr] = kicks[i];
      const candidate = {
        type: this._active.type,
        rotation: toRot,
        col: this._active.col + dc,
        row: this._active.row + dr,
      };
      if (!this._collidesPiece(candidate)) {
        this._active = candidate;
        this._onSuccessfulMove();
        this._events.emit('rotate', this._snapshotActive());
        return true;
      }
    }
    return false;
  }

  // ----- accessors -----
  get phase() { return this._phase; }
  get level() { return this._level; }
  get lines() { return this._lines; }
  get score() { return this._score; }
  get gameOverReason() { return this._gameOverReason; }
  get activePiece() { return this._snapshotActive(); }
  get board() { return this._board; }

  snapshot() {
    return {
      phase: this._phase,
      gameOverReason: this._gameOverReason,
      cols: this._board.cols,
      visibleRows: this._board.visibleRows,
      bufferRows: this._board.bufferRows,
      grid: this._board.snapshot(),
      active: this._snapshotActive(),
      ghostRow: this._computeGhostRow(),
      next: this._bag.peek(this._opts.nextQueueSize),
      level: this._level,
      lines: this._lines,
      score: this._score,
      lockDelayMs: this._lockDelayMs,
      lockResets: this._lockResets,
      isGrounded: this._isGrounded(),
      softDropHeld: this._softDropHeld,
    };
  }

  // ----- internal: movement -----
  _inputMove(dc, dr) {
    if (this._phase !== PHASE.PLAYING || !this._active) return false;
    const moved = this._tryMoveRaw(dc, dr);
    if (moved) {
      this._onSuccessfulMove();
      this._events.emit('move', this._snapshotActive());
    }
    return moved;
  }

  _tryMoveRaw(dc, dr) {
    if (!this._active) return false;
    const candidate = {
      type: this._active.type,
      rotation: this._active.rotation,
      col: this._active.col + dc,
      row: this._active.row + dr,
    };
    if (this._collidesPiece(candidate)) return false;
    this._active = candidate;
    return true;
  }

  _onSuccessfulMove() {
    if (this._isGrounded()) {
      if (this._lockResets < this._opts.maxLockResets) {
        this._lockDelayMs = 0;
        this._lockResets += 1;
      }
    } else {
      this._lockDelayMs = 0;
    }
  }

  _isGrounded() {
    if (!this._active) return false;
    const probe = {
      type: this._active.type,
      rotation: this._active.rotation,
      col: this._active.col,
      row: this._active.row + 1,
    };
    return this._collidesPiece(probe);
  }

  _collidesPiece(piece) {
    return this._board.collides(getAbsoluteCells(piece));
  }

  _currentGravityMs() {
    const base = gravityMsForLevel(this._level);
    if (this._softDropHeld) {
      return Math.max(1, Math.floor(base / this._opts.softDropFactor));
    }
    return base;
  }

  // ----- internal: spawn / lock / game-over -----
  _spawnRowForBuffer() {
    return Math.max(0, this._board.bufferRows - 1);
  }

  _spawnNext() {
    const type = this._bag.next();
    const def = PIECES[type];
    const piece = {
      type,
      rotation: 0,
      col: def.spawnCol,
      row: this._spawnRowForBuffer(),
    };
    if (this._collidesPiece(piece)) {
      this._active = piece;
      this._gameOver(GAME_OVER_REASON.BLOCK_OUT);
      return;
    }
    this._active = piece;
    this._gravityMs = 0;
    this._lockDelayMs = 0;
    this._lockResets = 0;
    this._events.emit('spawn', this._snapshotActive());
  }

  _lockPiece() {
    const piece = this._active;
    if (!piece) return;
    const cells = getAbsoluteCells(piece);
    const value = { type: piece.type, color: PIECES[piece.type].color };
    const { anyInVisible } = this._board.lockCells(cells, value);

    const lockSnapshot = {
      type: piece.type,
      rotation: piece.rotation,
      col: piece.col,
      row: piece.row,
      cells: cells.map((c) => c.slice()),
    };
    this._events.emit('lock', lockSnapshot);

    if (!anyInVisible) {
      this._active = null;
      this._gameOver(GAME_OVER_REASON.LOCK_OUT);
      return;
    }

    const fullRows = this._board.findFullRows();
    if (fullRows.length > 0) {
      const cleared = this._board.clearRows(fullRows);
      const earned = scoreLineClear(cleared, this._level);
      this._score += earned;
      this._lines += cleared;
      const newLevel = levelForLines(this._lines, this._opts.startLevel, this._opts.linesPerLevel);
      const levelChanged = newLevel !== this._level;
      this._level = newLevel;
      this._events.emit('linesCleared', {
        rows: fullRows.slice(),
        count: cleared,
        score: earned,
        totalLines: this._lines,
        level: this._level,
      });
      if (levelChanged) {
        this._events.emit('levelUp', { level: this._level });
      }
    }

    this._active = null;
    this._spawnNext();
  }

  _gameOver(reason) {
    this._phase = PHASE.GAME_OVER;
    this._gameOverReason = reason;
    this._events.emit('gameOver', {
      reason,
      score: this._score,
      lines: this._lines,
      level: this._level,
    });
  }

  // ----- internal: snapshots -----
  _snapshotActive() {
    if (!this._active) return null;
    return {
      type: this._active.type,
      rotation: this._active.rotation,
      col: this._active.col,
      row: this._active.row,
      cells: getAbsoluteCells(this._active),
    };
  }

  _computeGhostRow() {
    if (!this._active) return null;
    let drop = 0;
    while (true) {
      const candidate = {
        type: this._active.type,
        rotation: this._active.rotation,
        col: this._active.col,
        row: this._active.row + drop + 1,
      };
      if (this._collidesPiece(candidate)) break;
      drop += 1;
    }
    return this._active.row + drop;
  }
}

module.exports = { TetrisEngine, PHASE, GAME_OVER_REASON, DEFAULTS };

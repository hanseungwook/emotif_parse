'use strict';

const { STATES, EFFECTS } = require('./constants');
const { mergePalette } = require('./palette');
const {
  normalizeGeometry,
  cellToPixel,
  rowToPixel,
  isCellVisible,
  clampCells,
} = require('./geometry');
const {
  drawFilledBlock,
  drawGhostBlock,
  drawClearingBlock,
} = require('./drawBlock');
const { EffectTimeline, easeOutCubic } = require('./effects');

class PlayfieldRenderer {
  constructor(options) {
    const opts = options || {};
    this._canvas = opts.canvas || null;
    this._ctx = opts.context || resolveContext(this._canvas);
    if (!this._ctx) {
      throw new TypeError('PlayfieldRenderer requires a canvas or a 2D context');
    }
    this._geometry = normalizeGeometry(opts);
    this._palette = mergePalette(opts.palette);
    this._effects = opts.effects || new EffectTimeline({ durations: opts.effectDurations });
    this._state = STATES.READY;
    this._lastSnapshot = null;
    this._statusMessage = '';
    this._levelText = '';
    this._showGhost = opts.showGhost !== false;
    this._showGrid = opts.showGrid !== false;
    this._scale = 1;
    this._applyCanvasSize();
  }

  get geometry() {
    return this._geometry;
  }

  get palette() {
    return this._palette;
  }

  get canvas() {
    return this._canvas;
  }

  setShowGhost(value) {
    this._showGhost = value !== false;
  }

  setShowGrid(value) {
    this._showGrid = value !== false;
  }

  resize(cellSize) {
    this._geometry = normalizeGeometry({
      columns: this._geometry.columns,
      visibleRows: this._geometry.visibleRows,
      hiddenRows: this._geometry.hiddenRows,
      cellSize: cellSize || this._geometry.cellSize,
      gutter: this._geometry.gutter,
      padding: this._geometry.padding,
    });
    this._applyCanvasSize();
  }

  advance(deltaMs) {
    return this._effects.advance(deltaMs);
  }

  lineClear(rows, options) {
    const clean = sanitizeRows(rows);
    if (clean.length === 0) return null;
    return this._effects.start(EFFECTS.LINE_CLEAR, {
      rows: clean,
      types: options && options.types ? Object.assign({}, options.types) : null,
    });
  }

  levelUp(level) {
    return this._effects.start(EFFECTS.LEVEL_UP, { level: Number(level) || 0 });
  }

  hardDrop(column, fromY, toY) {
    return this._effects.start(EFFECTS.HARD_DROP, {
      column: Number(column) || 0,
      fromY: Number(fromY) || 0,
      toY: Number(toY) || 0,
    });
  }

  lockFlash(cells) {
    return this._effects.start(EFFECTS.LOCK, { cells: clampCells(cells, this._geometry) });
  }

  gameOver() {
    this._effects.cancelByName(EFFECTS.LINE_CLEAR);
    return this._effects.start(EFFECTS.GAME_OVER, null);
  }

  reset() {
    this._effects.clear();
    this._state = STATES.READY;
    this._lastSnapshot = null;
  }

  draw(snapshot) {
    const snap = normalizeSnapshot(snapshot);
    this._state = snap.state || this._state || STATES.PLAYING;
    this._statusMessage = snap.message || '';
    this._levelText = snap.level != null ? 'Level ' + snap.level : '';
    this._lastSnapshot = snap;
    this._renderFrame(snap);
    return snap;
  }

  _renderFrame(snap) {
    const ctx = this._ctx;
    const g = this._geometry;
    ctx.save();
    this._clearCanvas();
    this._drawBackground();
    if (this._showGrid) this._drawGrid();
    this._drawSettled(snap.board);
    if (this._showGhost && snap.ghost) this._drawGhost(snap.ghost);
    if (snap.active) this._drawActive(snap.active);
    this._drawLineClearEffect(snap.board);
    this._drawHardDropTrail();
    this._drawLockFlash();
    this._drawStateOverlay();
    this._drawLevelUpFlash();
    ctx.restore();
  }

  _clearCanvas() {
    const ctx = this._ctx;
    const g = this._geometry;
    if (typeof ctx.clearRect === 'function') {
      ctx.clearRect(0, 0, g.canvasWidth, g.canvasHeight);
    }
  }

  _drawBackground() {
    const ctx = this._ctx;
    const g = this._geometry;
    const bg = this._palette.background;
    ctx.fillStyle = bg.panel;
    ctx.fillRect(0, 0, g.canvasWidth, g.canvasHeight);
    ctx.strokeStyle = bg.panelBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, g.canvasWidth - 2, g.canvasHeight - 2);
    ctx.fillStyle = '#020617';
    ctx.fillRect(g.padding, g.padding, g.boardPixelWidth, g.boardPixelHeight);
  }

  _drawGrid() {
    const ctx = this._ctx;
    const g = this._geometry;
    const bg = this._palette.background;
    ctx.save();
    ctx.strokeStyle = bg.gridMinor;
    ctx.lineWidth = 1;
    for (let c = 1; c < g.columns; c++) {
      const x = g.padding + c * g.cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, g.padding);
      ctx.lineTo(x, g.padding + g.boardPixelHeight);
      ctx.stroke();
    }
    for (let r = 1; r < g.visibleRows; r++) {
      const y = g.padding + r * g.cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(g.padding, y);
      ctx.lineTo(g.padding + g.boardPixelWidth, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawSettled(board) {
    if (!Array.isArray(board)) return;
    const g = this._geometry;
    const clearingRows = this._activeClearRows();
    for (let row = 0; row < board.length; row++) {
      if (clearingRows && clearingRows.indexOf(row) >= 0) continue;
      if (!isCellVisible(g, row)) continue;
      const rowCells = board[row];
      if (!Array.isArray(rowCells)) continue;
      for (let col = 0; col < rowCells.length; col++) {
        const cell = rowCells[col];
        if (!cell) continue;
        const type = typeof cell === 'string' ? cell : cell.type;
        const rect = cellToPixel(g, col, row);
        drawFilledBlock(this._ctx, rect, type, { inset: 1 });
      }
    }
  }

  _drawGhost(ghost) {
    if (!ghost || !Array.isArray(ghost.cells) || ghost.cells.length === 0) return;
    const g = this._geometry;
    for (let i = 0; i < ghost.cells.length; i++) {
      const cell = ghost.cells[i];
      if (!cell) continue;
      if (!isCellVisible(g, cell.y)) continue;
      const rect = cellToPixel(g, cell.x, cell.y);
      drawGhostBlock(this._ctx, rect, ghost.type, {});
    }
  }

  _drawActive(active) {
    if (!active || !Array.isArray(active.cells)) return;
    const g = this._geometry;
    const highlight = active.locking === true;
    for (let i = 0; i < active.cells.length; i++) {
      const cell = active.cells[i];
      if (!cell) continue;
      if (!isCellVisible(g, cell.y)) continue;
      const rect = cellToPixel(g, cell.x, cell.y);
      drawFilledBlock(this._ctx, rect, active.type, { inset: 1, highlight });
    }
  }

  _drawLineClearEffect(board) {
    const effects = this._effects.active(EFFECTS.LINE_CLEAR);
    if (effects.length === 0) return;
    const ctx = this._ctx;
    const g = this._geometry;
    const overlay = this._palette.overlay;
    for (let e = 0; e < effects.length; e++) {
      const effect = effects[e];
      const rows = effect.payload && effect.payload.rows ? effect.payload.rows : [];
      const types = effect.payload && effect.payload.types ? effect.payload.types : null;
      const progress = easeOutCubic(effect.progress);
      ctx.save();
      ctx.globalAlpha = 1 - progress * 0.3;
      ctx.fillStyle = overlay.flash;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!isCellVisible(g, row)) continue;
        const rect = rowToPixel(g, row);
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
      ctx.restore();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!isCellVisible(g, row)) continue;
        for (let col = 0; col < g.columns; col++) {
          const type = resolveClearingType(board, types, row, col);
          const rect = cellToPixel(g, col, row);
          drawClearingBlock(this._ctx, rect, type, progress);
        }
      }
    }
  }

  _drawHardDropTrail() {
    const effects = this._effects.active(EFFECTS.HARD_DROP);
    if (effects.length === 0) return;
    const ctx = this._ctx;
    const g = this._geometry;
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      const payload = effect.payload || {};
      const column = payload.column;
      const fromY = payload.fromY;
      const toY = payload.toY;
      if (column == null || fromY == null || toY == null) continue;
      const fromRect = cellToPixel(g, column, Math.max(g.hiddenRows, fromY));
      const toRect = cellToPixel(g, column, Math.max(g.hiddenRows, toY));
      const top = Math.min(fromRect.y, toRect.y);
      const height = Math.abs(toRect.y - fromRect.y) + g.cellSize;
      const alpha = (1 - effect.progress) * 0.6;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(226,232,240,0.6)';
      ctx.fillRect(fromRect.x + g.cellSize / 4, top, g.cellSize / 2, height);
      ctx.restore();
    }
  }

  _drawLockFlash() {
    const effects = this._effects.active(EFFECTS.LOCK);
    if (effects.length === 0) return;
    const ctx = this._ctx;
    const g = this._geometry;
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      const payload = effect.payload || {};
      const cells = payload.cells || [];
      const alpha = (1 - effect.progress) * 0.45;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        if (!cell || !isCellVisible(g, cell.y)) continue;
        const rect = cellToPixel(g, cell.x, cell.y);
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
      ctx.restore();
    }
  }

  _drawLevelUpFlash() {
    const effects = this._effects.active(EFFECTS.LEVEL_UP);
    if (effects.length === 0) return;
    const ctx = this._ctx;
    const g = this._geometry;
    const overlay = this._palette.overlay;
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      const progress = effect.progress;
      const alpha = (1 - progress) * 0.55;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = overlay.levelUp;
      ctx.fillRect(g.padding, g.padding, g.boardPixelWidth, g.boardPixelHeight);
      ctx.restore();
      const level = effect.payload && effect.payload.level != null ? effect.payload.level : null;
      if (level != null && typeof ctx.fillText === 'function') {
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.fillStyle = overlay.textPrimary;
        ctx.font = (g.cellSize * 1.1) + 'px sans-serif';
        if ('textAlign' in ctx) ctx.textAlign = 'center';
        if ('textBaseline' in ctx) ctx.textBaseline = 'middle';
        ctx.fillText(
          'LEVEL ' + level,
          g.padding + g.boardPixelWidth / 2,
          g.padding + g.boardPixelHeight / 2
        );
        ctx.restore();
      }
    }
  }

  _drawStateOverlay() {
    const state = this._state;
    if (state === STATES.PLAYING) return;
    const gameOver = this._effects.active(EFFECTS.GAME_OVER)[0];
    const ctx = this._ctx;
    const g = this._geometry;
    const overlay = this._palette.overlay;
    let fill = null;
    let title = '';
    let subtitle = this._statusMessage || '';
    if (state === STATES.PAUSED) {
      fill = overlay.paused;
      title = 'PAUSED';
      if (!subtitle) subtitle = 'Press P to resume';
    } else if (state === STATES.GAME_OVER) {
      const alpha = gameOver ? gameOver.progress : 1;
      fill = mixOverlay(overlay.gameOver, alpha);
      title = 'GAME OVER';
      if (!subtitle) subtitle = 'Press R to restart';
    } else if (state === STATES.READY) {
      fill = overlay.ready;
      title = 'READY';
      if (!subtitle) subtitle = 'Press Space to start';
    } else if (state === STATES.LEVEL_UP) {
      fill = overlay.levelUp;
      title = this._levelText || 'LEVEL UP';
    }
    if (!fill) return;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.fillRect(g.padding, g.padding, g.boardPixelWidth, g.boardPixelHeight);
    if (typeof ctx.fillText === 'function') {
      ctx.fillStyle = overlay.textPrimary;
      ctx.font = (g.cellSize * 1.2) + 'px sans-serif';
      if ('textAlign' in ctx) ctx.textAlign = 'center';
      if ('textBaseline' in ctx) ctx.textBaseline = 'middle';
      const centerX = g.padding + g.boardPixelWidth / 2;
      const centerY = g.padding + g.boardPixelHeight / 2;
      ctx.fillText(title, centerX, centerY - g.cellSize * 0.6);
      if (subtitle) {
        ctx.fillStyle = overlay.textSecondary;
        ctx.font = (g.cellSize * 0.55) + 'px sans-serif';
        ctx.fillText(subtitle, centerX, centerY + g.cellSize * 0.6);
      }
    }
    ctx.restore();
  }

  _activeClearRows() {
    const effects = this._effects.active(EFFECTS.LINE_CLEAR);
    if (effects.length === 0) return null;
    const rows = [];
    for (let i = 0; i < effects.length; i++) {
      const payload = effects[i].payload;
      if (payload && Array.isArray(payload.rows)) {
        for (let r = 0; r < payload.rows.length; r++) {
          if (rows.indexOf(payload.rows[r]) < 0) rows.push(payload.rows[r]);
        }
      }
    }
    return rows;
  }

  _applyCanvasSize() {
    const canvas = this._canvas;
    if (!canvas) return;
    const g = this._geometry;
    if ('width' in canvas) canvas.width = g.canvasWidth;
    if ('height' in canvas) canvas.height = g.canvasHeight;
    if (canvas.style) {
      canvas.style.width = g.canvasWidth + 'px';
      canvas.style.height = g.canvasHeight + 'px';
    }
  }
}

function normalizeSnapshot(snapshot) {
  const s = snapshot || {};
  const board = Array.isArray(s.board) ? s.board : [];
  return {
    board,
    active: s.active || null,
    ghost: s.ghost || null,
    state: s.state || STATES.PLAYING,
    level: s.level != null ? s.level : null,
    message: typeof s.message === 'string' ? s.message : '',
  };
}

function sanitizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const value = rows[i];
    if (typeof value !== 'number' || !isFinite(value)) continue;
    const n = Math.floor(value);
    if (n < 0) continue;
    if (out.indexOf(n) < 0) out.push(n);
  }
  out.sort(function (a, b) {
    return a - b;
  });
  return out;
}

function resolveClearingType(board, typeOverrides, row, col) {
  if (typeOverrides) {
    const key = row + ',' + col;
    if (typeOverrides[key]) return typeOverrides[key];
  }
  if (Array.isArray(board) && Array.isArray(board[row])) {
    const cell = board[row][col];
    if (cell) return typeof cell === 'string' ? cell : cell.type;
  }
  return null;
}

function mixOverlay(base, alpha) {
  if (alpha >= 1) return base;
  if (alpha <= 0) return 'rgba(0,0,0,0)';
  if (typeof base !== 'string') return base;
  const match = base.match(/rgba?\(([^)]+)\)/i);
  if (!match) return base;
  const parts = match[1].split(',').map(function (s) {
    return s.trim();
  });
  if (parts.length < 3) return base;
  const r = parts[0];
  const g = parts[1];
  const b = parts[2];
  const baseAlpha = parts.length === 4 ? Number(parts[3]) : 1;
  const finalAlpha = Math.max(0, Math.min(1, baseAlpha * alpha));
  return 'rgba(' + r + ',' + g + ',' + b + ',' + finalAlpha.toFixed(3) + ')';
}

function resolveContext(canvas) {
  if (!canvas) return null;
  if (typeof canvas.getContext === 'function') {
    return canvas.getContext('2d');
  }
  return null;
}

module.exports = { PlayfieldRenderer };

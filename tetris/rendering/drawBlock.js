'use strict';

const { colorsFor, ghostColor } = require('./palette');

function drawFilledBlock(ctx, rect, type, options) {
  if (!ctx || !rect) return;
  const opts = options || {};
  const colors = colorsFor(type);
  const inset = clampNonNegative(opts.inset, 0);
  const bevel = clampNonNegative(opts.bevel, Math.max(1, Math.floor(rect.width / 8)));
  const alpha = clampUnit(opts.alpha, 1);
  const highlight = opts.highlight === true;
  const x = rect.x + inset;
  const y = rect.y + inset;
  const w = rect.width - inset * 2;
  const h = rect.height - inset * 2;
  if (w <= 0 || h <= 0) return;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.fillStyle = colors.dark;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colors.base;
  ctx.fillRect(x + bevel, y + bevel, w - bevel * 2, h - bevel * 2);
  ctx.fillStyle = colors.light;
  ctx.fillRect(x + bevel, y + bevel, w - bevel * 2, Math.max(1, Math.floor(bevel / 2)));
  ctx.fillRect(x + bevel, y + bevel, Math.max(1, Math.floor(bevel / 2)), h - bevel * 2);
  if (highlight) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function drawGhostBlock(ctx, rect, type, options) {
  if (!ctx || !rect) return;
  const opts = options || {};
  const ghost = ghostColor(type);
  const inset = clampNonNegative(opts.inset, Math.max(1, Math.floor(rect.width / 12)));
  const lineWidth = clampNonNegative(opts.lineWidth, Math.max(1, Math.floor(rect.width / 14)));
  const x = rect.x + inset;
  const y = rect.y + inset;
  const w = rect.width - inset * 2;
  const h = rect.height - inset * 2;
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.fillStyle = ghost.fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = ghost.stroke;
  ctx.lineWidth = lineWidth;
  if (typeof ctx.setLineDash === 'function') {
    ctx.setLineDash([Math.max(2, Math.floor(rect.width / 6)), Math.max(2, Math.floor(rect.width / 10))]);
  }
  ctx.strokeRect(x + lineWidth / 2, y + lineWidth / 2, w - lineWidth, h - lineWidth);
  ctx.restore();
}

function drawClearingBlock(ctx, rect, type, progress) {
  if (!ctx || !rect) return;
  const p = clampUnit(progress, 0);
  const colors = colorsFor(type);
  const fade = 1 - p;
  const shrink = Math.floor(rect.width * (p * 0.4));
  const x = rect.x + shrink;
  const y = rect.y + Math.floor(rect.height * p * 0.5);
  const w = rect.width - shrink * 2;
  const h = rect.height - Math.floor(rect.height * p);
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.fillStyle = colors.light;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + p * 0.5).toFixed(3) + ')';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function clampUnit(value, fallback) {
  const n = Number(value);
  if (!isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clampNonNegative(value, fallback) {
  const n = Number(value);
  if (!isFinite(n) || n < 0) return fallback;
  return n;
}

module.exports = {
  drawFilledBlock,
  drawGhostBlock,
  drawClearingBlock,
};

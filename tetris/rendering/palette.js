'use strict';

const { TETROMINO_TYPES } = require('./constants');

const TETROMINO_COLORS = Object.freeze({
  I: { base: '#22d3ee', light: '#67e8f9', dark: '#0e7490', glow: 'rgba(34,211,238,0.55)' },
  O: { base: '#facc15', light: '#fde68a', dark: '#a16207', glow: 'rgba(250,204,21,0.55)' },
  T: { base: '#a855f7', light: '#d8b4fe', dark: '#6b21a8', glow: 'rgba(168,85,247,0.55)' },
  S: { base: '#22c55e', light: '#86efac', dark: '#15803d', glow: 'rgba(34,197,94,0.55)' },
  Z: { base: '#ef4444', light: '#fca5a5', dark: '#991b1b', glow: 'rgba(239,68,68,0.55)' },
  J: { base: '#3b82f6', light: '#93c5fd', dark: '#1d4ed8', glow: 'rgba(59,130,246,0.55)' },
  L: { base: '#f97316', light: '#fdba74', dark: '#9a3412', glow: 'rgba(249,115,22,0.55)' },
});

const NEUTRAL_COLORS = Object.freeze({
  base: '#475569',
  light: '#64748b',
  dark: '#1e293b',
  glow: 'rgba(148,163,184,0.4)',
});

const BACKGROUND = Object.freeze({
  panel: '#0b1220',
  panelBorder: '#1e293b',
  gridMinor: 'rgba(148,163,184,0.08)',
  gridMajor: 'rgba(148,163,184,0.18)',
  hiddenRow: 'rgba(15,23,42,0.85)',
});

const OVERLAY = Object.freeze({
  paused: 'rgba(15,23,42,0.62)',
  gameOver: 'rgba(15,23,42,0.78)',
  ready: 'rgba(15,23,42,0.50)',
  flash: 'rgba(255,255,255,0.85)',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5f5',
  levelUp: 'rgba(125,211,252,0.42)',
});

function isTetrominoType(type) {
  return typeof type === 'string' && TETROMINO_TYPES.indexOf(type) >= 0;
}

function colorsFor(type) {
  if (!isTetrominoType(type)) return NEUTRAL_COLORS;
  return TETROMINO_COLORS[type];
}

function ghostColor(type) {
  const base = colorsFor(type);
  return {
    stroke: base.light,
    fill: 'rgba(255,255,255,0.06)',
    accent: base.glow,
  };
}

function mergePalette(overrides) {
  if (!overrides) return { tetromino: TETROMINO_COLORS, neutral: NEUTRAL_COLORS, background: BACKGROUND, overlay: OVERLAY };
  const tetromino = Object.assign({}, TETROMINO_COLORS, overrides.tetromino || {});
  const neutral = Object.assign({}, NEUTRAL_COLORS, overrides.neutral || {});
  const background = Object.assign({}, BACKGROUND, overrides.background || {});
  const overlay = Object.assign({}, OVERLAY, overrides.overlay || {});
  return { tetromino, neutral, background, overlay };
}

module.exports = {
  TETROMINO_COLORS,
  NEUTRAL_COLORS,
  BACKGROUND,
  OVERLAY,
  isTetrominoType,
  colorsFor,
  ghostColor,
  mergePalette,
};

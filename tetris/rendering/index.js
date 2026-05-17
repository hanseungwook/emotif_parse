'use strict';

const constants = require('./constants');
const palette = require('./palette');
const geometry = require('./geometry');
const drawBlock = require('./drawBlock');
const effects = require('./effects');
const { PlayfieldRenderer } = require('./playfieldRenderer');

function createPlayfieldRenderer(options) {
  return new PlayfieldRenderer(options);
}

module.exports = {
  createPlayfieldRenderer,
  PlayfieldRenderer,
  EffectTimeline: effects.EffectTimeline,
  STATES: constants.STATES,
  EFFECTS: constants.EFFECTS,
  TETROMINO_TYPES: constants.TETROMINO_TYPES,
  TETROMINO_COLORS: palette.TETROMINO_COLORS,
  BACKGROUND_PALETTE: palette.BACKGROUND,
  OVERLAY_PALETTE: palette.OVERLAY,
  colorsFor: palette.colorsFor,
  ghostColor: palette.ghostColor,
  mergePalette: palette.mergePalette,
  normalizeGeometry: geometry.normalizeGeometry,
  cellToPixel: geometry.cellToPixel,
  rowToPixel: geometry.rowToPixel,
  isCellVisible: geometry.isCellVisible,
  clampCells: geometry.clampCells,
  drawFilledBlock: drawBlock.drawFilledBlock,
  drawGhostBlock: drawBlock.drawGhostBlock,
  drawClearingBlock: drawBlock.drawClearingBlock,
  easeOutCubic: effects.easeOutCubic,
  easeInQuad: effects.easeInQuad,
  DEFAULT_COLUMNS: constants.DEFAULT_COLUMNS,
  DEFAULT_VISIBLE_ROWS: constants.DEFAULT_VISIBLE_ROWS,
  DEFAULT_HIDDEN_ROWS: constants.DEFAULT_HIDDEN_ROWS,
  DEFAULT_CELL_SIZE: constants.DEFAULT_CELL_SIZE,
};

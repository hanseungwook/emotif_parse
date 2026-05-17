'use strict';

const fs = require('fs');
const path = require('path');

const MODULE_ORDER = [
  'constants.js',
  'palette.js',
  'geometry.js',
  'drawBlock.js',
  'effects.js',
  'playfieldRenderer.js',
  'index.js',
];

function buildBrowserBundle(rootDir) {
  const dir = rootDir || __dirname;
  const parts = [];
  parts.push("// Auto-generated browser bundle for /app/tetris/rendering/.");
  parts.push("// Canonical source is /app/tetris/rendering/*.js (CommonJS).");
  parts.push("const __tetrisRenderingModules = new Map();");
  parts.push("function __tetrisRenderingRequire(name) {");
  parts.push("  const key = name.replace(/^\\.\\//, '').replace(/\\.js$/, '');");
  parts.push("  if (!__tetrisRenderingModules.has(key)) {");
  parts.push("    throw new Error('Module not registered: ' + name);");
  parts.push("  }");
  parts.push("  return __tetrisRenderingModules.get(key).exports;");
  parts.push("}");

  for (const file of MODULE_ORDER) {
    const filePath = path.join(dir, file);
    const source = fs.readFileSync(filePath, 'utf8');
    const moduleKey = file.replace(/\.js$/, '');
    parts.push('');
    parts.push('// === module: ' + moduleKey + ' ===');
    parts.push('__tetrisRenderingModules.set(' + JSON.stringify(moduleKey) + ', (function () {');
    parts.push('  const module = { exports: {} };');
    parts.push('  const exports = module.exports;');
    parts.push('  const require = __tetrisRenderingRequire;');
    parts.push('  (function () {');
    parts.push(source);
    parts.push('  })();');
    parts.push('  return module;');
    parts.push('})());');
  }

  parts.push('');
  parts.push('const __tetrisRenderingPublic = __tetrisRenderingRequire("./index.js");');
  parts.push('export default __tetrisRenderingPublic;');
  parts.push('export const {');
  parts.push('  createPlayfieldRenderer,');
  parts.push('  PlayfieldRenderer,');
  parts.push('  EffectTimeline,');
  parts.push('  STATES,');
  parts.push('  EFFECTS,');
  parts.push('  TETROMINO_TYPES,');
  parts.push('  TETROMINO_COLORS,');
  parts.push('  BACKGROUND_PALETTE,');
  parts.push('  OVERLAY_PALETTE,');
  parts.push('  colorsFor,');
  parts.push('  ghostColor,');
  parts.push('  mergePalette,');
  parts.push('  normalizeGeometry,');
  parts.push('  cellToPixel,');
  parts.push('  rowToPixel,');
  parts.push('  isCellVisible,');
  parts.push('  clampCells,');
  parts.push('  drawFilledBlock,');
  parts.push('  drawGhostBlock,');
  parts.push('  drawClearingBlock,');
  parts.push('  easeOutCubic,');
  parts.push('  easeInQuad,');
  parts.push('  DEFAULT_COLUMNS,');
  parts.push('  DEFAULT_VISIBLE_ROWS,');
  parts.push('  DEFAULT_HIDDEN_ROWS,');
  parts.push('  DEFAULT_CELL_SIZE,');
  parts.push('} = __tetrisRenderingPublic;');

  return parts.join('\n') + '\n';
}

module.exports = { buildBrowserBundle, MODULE_ORDER };

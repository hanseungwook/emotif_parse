// Public entry point for the HUD subsystem. Other Modern Tetris modules
// (gameplay core, scoring engine, input loop) integrate by:
//
//   1. Creating a HUD via `createHud({ container, ... })`.
//   2. Pushing state through the returned `hudState` (setScore, recordClear,
//      setNextQueue, setStatus, ...).
//   3. Subscribing to UI intents — `hudState.on('intent:restart', ...)`,
//      `hudState.on('intent:resume', ...)`, `hudState.on('intent:pause', ...)`
//      — to react to the player's HUD-driven actions.

import { HudState, STATUS, CLEAR_TYPES } from './hudState.mjs';
import { HudRenderer } from './hudRenderer.mjs';
import { NextPreviewPanel } from './nextPreview.mjs';
import { ScorePanel } from './scorePanel.mjs';
import { StatusOverlay } from './statusOverlay.mjs';
import { EventEmitter } from './eventEmitter.mjs';
import { PIECES, PIECE_KINDS, getPieceShape, isValidPieceKind } from './pieces.mjs';

export function createHud(options) {
  const opts = options || {};
  const hudState = opts.hudState || new HudState(opts.initial);
  let renderer = null;
  if (opts.container) {
    renderer = new HudRenderer({
      container: opts.container,
      document: opts.document,
      hudState,
      classNames: opts.classNames,
      nextSlots: opts.nextSlots,
    });
    if (opts.autoMount !== false) renderer.mount();
  }
  return {
    hudState,
    renderer,
    mount() {
      if (renderer) renderer.mount();
    },
    unmount() {
      if (renderer) renderer.unmount();
    },
  };
}

export {
  HudState,
  HudRenderer,
  NextPreviewPanel,
  ScorePanel,
  StatusOverlay,
  EventEmitter,
  STATUS,
  CLEAR_TYPES,
  PIECES,
  PIECE_KINDS,
  getPieceShape,
  isValidPieceKind,
};

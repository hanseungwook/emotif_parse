'use strict';

// Public surface for the Tetris input + runtime subsystem. Other Tetris
// modules (game core, scoring, rendering, HUD) consume the InputController and
// GameRuntime from here so we can refactor internals without breaking imports.

const actions = require('./actions');
const keymap = require('./keymap');
const controller = require('./inputController');
const runtime = require('./runtime');
const adapter = require('./keyboardAdapter');

module.exports = {
  // Action constants and predicates
  Actions: actions.Actions,
  REPEATABLE_ACTIONS: actions.REPEATABLE_ACTIONS,
  GAMEPLAY_ACTIONS: actions.GAMEPLAY_ACTIONS,
  SYSTEM_ACTIONS: actions.SYSTEM_ACTIONS,
  isRepeatable: actions.isRepeatable,
  isGameplay: actions.isGameplay,
  isSystem: actions.isSystem,

  // Keymap
  defaultKeymap: keymap.defaultKeymap,
  createKeymap: keymap.createKeymap,
  keysForAction: keymap.keysForAction,

  // Input controller
  InputController: controller.InputController,
  DEFAULT_TIMING: controller.DEFAULT_TIMING,

  // Runtime loop
  GameRuntime: runtime.GameRuntime,
  STATES: runtime.STATES,
  MAX_FRAME_MS: runtime.MAX_FRAME_MS,

  // Keyboard adapters
  createDomKeyboardAdapter: adapter.createDomKeyboardAdapter,
  createMemoryKeyboardAdapter: adapter.createMemoryKeyboardAdapter,
};

'use strict';

const { Actions } = require('./actions');

// Default key bindings keyed by KeyboardEvent.code (layout-independent).
// Codes were chosen to match conventions players expect from modern arcade
// Tetris: arrows for movement, Z/X for rotation, Space for hard drop, Shift/C
// for hold, Escape/P for pause, R for restart.
const defaultKeymap = Object.freeze({
  ArrowLeft: Actions.MoveLeft,
  ArrowRight: Actions.MoveRight,
  ArrowDown: Actions.SoftDrop,
  ArrowUp: Actions.RotateCW,
  Space: Actions.HardDrop,
  KeyX: Actions.RotateCW,
  KeyZ: Actions.RotateCCW,
  ControlLeft: Actions.RotateCCW,
  ControlRight: Actions.RotateCCW,
  KeyA: Actions.Rotate180,
  KeyC: Actions.Hold,
  ShiftLeft: Actions.Hold,
  ShiftRight: Actions.Hold,
  KeyP: Actions.PauseToggle,
  Escape: Actions.PauseToggle,
  KeyR: Actions.Restart,
});

// Build a mutable keymap by merging overrides onto the defaults. Passing
// `null` for a code removes the binding; passing an action replaces it.
function createKeymap(overrides) {
  const map = Object.assign({}, defaultKeymap);
  if (overrides) {
    for (const code of Object.keys(overrides)) {
      const value = overrides[code];
      if (value === null || value === undefined) {
        delete map[code];
      } else {
        map[code] = value;
      }
    }
  }
  return map;
}

// Reverse lookup: list the key codes bound to an action. Useful for HUDs that
// want to show the current binding ("Press [Space] to hard drop").
function keysForAction(keymap, action) {
  const codes = [];
  for (const code of Object.keys(keymap)) {
    if (keymap[code] === action) codes.push(code);
  }
  return codes;
}

module.exports = { defaultKeymap, createKeymap, keysForAction };

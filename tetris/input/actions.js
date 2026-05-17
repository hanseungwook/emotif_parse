'use strict';

// Action identifiers emitted by the input controller. They are intentionally
// string constants so consumers (game core, scoring, HUD) can listen by value
// without taking a hard dependency on this module's object identity.
const Actions = Object.freeze({
  MoveLeft: 'move-left',
  MoveRight: 'move-right',
  SoftDrop: 'soft-drop',
  HardDrop: 'hard-drop',
  RotateCW: 'rotate-cw',
  RotateCCW: 'rotate-ccw',
  Rotate180: 'rotate-180',
  Hold: 'hold',
  PauseToggle: 'pause-toggle',
  Restart: 'restart',
});

// Actions that may repeat while their key is held. Everything else fires once
// per press regardless of how long the key is held down.
const REPEATABLE_ACTIONS = Object.freeze(new Set([
  Actions.MoveLeft,
  Actions.MoveRight,
  Actions.SoftDrop,
]));

// Actions that should be ignored when the runtime is paused. Pause and Restart
// remain enabled so the player can always unpause or reset.
const GAMEPLAY_ACTIONS = Object.freeze(new Set([
  Actions.MoveLeft,
  Actions.MoveRight,
  Actions.SoftDrop,
  Actions.HardDrop,
  Actions.RotateCW,
  Actions.RotateCCW,
  Actions.Rotate180,
  Actions.Hold,
]));

const SYSTEM_ACTIONS = Object.freeze(new Set([
  Actions.PauseToggle,
  Actions.Restart,
]));

function isRepeatable(action) {
  return REPEATABLE_ACTIONS.has(action);
}

function isGameplay(action) {
  return GAMEPLAY_ACTIONS.has(action);
}

function isSystem(action) {
  return SYSTEM_ACTIONS.has(action);
}

module.exports = {
  Actions,
  REPEATABLE_ACTIONS,
  GAMEPLAY_ACTIONS,
  SYSTEM_ACTIONS,
  isRepeatable,
  isGameplay,
  isSystem,
};

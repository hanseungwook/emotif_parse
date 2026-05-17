'use strict';

// Map browser-style key names to game directions. Used by the demo page and
// reused by sibling shells so input remains consistent.
const KEY_TO_DIRECTION = Object.freeze({
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
});

const ACTION_KEYS = Object.freeze({
  Space: 'TOGGLE',
  ' ': 'TOGGLE',
  Enter: 'START',
  KeyP: 'PAUSE',
  KeyR: 'RESET',
  p: 'PAUSE',
  r: 'RESET',
});

function directionForKey(key) {
  return KEY_TO_DIRECTION[key] || null;
}

function actionForKey(key) {
  return ACTION_KEYS[key] || null;
}

// Attach keyboard handlers to a target. Returns a teardown function. The
// engine reference is captured by closure; the renderer/demo wires this on
// document.
function attachKeyboard(engine, target) {
  const handler = (event) => {
    const key = event.code || event.key;
    const direction = directionForKey(key);
    if (direction) {
      engine.dispatch({ type: 'CHANGE_DIRECTION', direction });
      event.preventDefault();
      return;
    }
    const action = actionForKey(key);
    if (!action) return;
    event.preventDefault();
    const status = engine.getState().status;
    if (action === 'TOGGLE') {
      if (status === 'idle' || status === 'gameOver') engine.dispatch({ type: 'START' });
      else if (status === 'playing') engine.dispatch({ type: 'PAUSE' });
      else if (status === 'paused') engine.dispatch({ type: 'RESUME' });
    } else if (action === 'START') {
      engine.dispatch({ type: 'START' });
    } else if (action === 'PAUSE') {
      if (status === 'playing') engine.dispatch({ type: 'PAUSE' });
      else if (status === 'paused') engine.dispatch({ type: 'RESUME' });
    } else if (action === 'RESET') {
      engine.dispatch({ type: 'RESET' });
    }
  };
  target.addEventListener('keydown', handler);
  return () => target.removeEventListener('keydown', handler);
}

module.exports = {
  KEY_TO_DIRECTION,
  ACTION_KEYS,
  directionForKey,
  actionForKey,
  attachKeyboard,
};

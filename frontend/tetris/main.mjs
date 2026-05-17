import { createHud, STATUS, CLEAR_TYPES, PIECE_KINDS } from './hud/index.mjs';

// Simulated game stand-in. This page is the HUD subsystem demo, so it
// fakes the game-core, scoring, and input modules with just enough state
// to drive the HUD through every visual it can produce.

const stage = document.querySelector('.tetris-stage');
const grid = document.querySelector('[data-grid]');
buildGridCells(grid, 10 * 20);

const hud = createHud({
  container: stage,
  initial: {
    nextQueue: drawQueue(5),
    bestScore: Number(localStorage.getItem('tetris.bestScore') || 0),
  },
});

const state = hud.hudState;

// Persist best score so the demo carries it across reloads.
state.on('bestScore:change', ({ value }) => {
  try { localStorage.setItem('tetris.bestScore', String(value)); } catch (_e) {}
});

// Hook UI intents from the HUD overlay back into our fake game.
state.on('intent:restart', () => restart());
state.on('intent:resume', () => state.resume());
state.on('intent:pause', () => state.pause());

// Keyboard shortcuts for the demo.
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === ' ' || key === 'spacebar') {
    event.preventDefault();
    simulateClear();
  } else if (key === 'p') {
    event.preventDefault();
    state.togglePause();
  } else if (key === 'g') {
    event.preventDefault();
    state.gameOver();
  } else if (key === 'r') {
    event.preventDefault();
    restart();
  } else if (key === 'enter') {
    event.preventDefault();
    if (state.getState().status !== STATUS.PLAYING) {
      restart();
    }
  }
});

function restart() {
  state.reset({ nextQueue: drawQueue(5) });
  state.start();
}

function simulateClear() {
  if (state.getState().status !== STATUS.PLAYING) return;
  const lines = pickLines();
  const type = clearType(lines);
  const points = scoreFor(type, lines, state.getState().level, state.getState().combo + 1);
  state.addScore(points);
  state.setLines(state.getState().lines + lines);
  if (lines >= 1) {
    state.bumpCombo();
    state.recordClear({
      type,
      lines,
      points,
      combo: state.getState().combo,
      perfect: Math.random() < 0.08,
    });
  } else {
    state.breakCombo();
  }
  const nextLevel = Math.max(1, Math.floor(state.getState().lines / 10) + 1);
  if (nextLevel !== state.getState().level) state.setLevel(nextLevel);
  const queue = state.getState().nextQueue.slice();
  queue.shift();
  while (queue.length < 5) queue.push(randomPiece());
  state.setNextQueue(queue);

  // 1.5% chance to simulate a game-over so the visuals are exercisable
  // without a real playfield.
  if (Math.random() < 0.015) {
    state.gameOver();
  }
}

function drawQueue(size) {
  const out = [];
  for (let i = 0; i < size; i++) out.push(randomPiece());
  return out;
}

function randomPiece() {
  return PIECE_KINDS[Math.floor(Math.random() * PIECE_KINDS.length)];
}

function pickLines() {
  const r = Math.random();
  if (r < 0.55) return 1;
  if (r < 0.85) return 2;
  if (r < 0.97) return 3;
  return 4;
}

function clearType(lines) {
  if (lines === 1) return CLEAR_TYPES.SINGLE;
  if (lines === 2) return CLEAR_TYPES.DOUBLE;
  if (lines === 3) return CLEAR_TYPES.TRIPLE;
  return CLEAR_TYPES.TETRIS;
}

function scoreFor(type, lines, level, combo) {
  const base = type === CLEAR_TYPES.TETRIS
    ? 800
    : type === CLEAR_TYPES.TRIPLE
    ? 500
    : type === CLEAR_TYPES.DOUBLE
    ? 300
    : 100;
  const comboBonus = combo > 1 ? 50 * (combo - 1) : 0;
  return Math.round((base + comboBonus) * level);
}

function buildGridCells(parent, count) {
  if (!parent) return;
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    parent.appendChild(cell);
  }
}

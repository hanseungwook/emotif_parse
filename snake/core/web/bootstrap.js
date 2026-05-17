// Demo bootstrap: wires the engine to the renderer, HUD, and controls so
// the entire core workflow (start → play → pause → game over → restart) is
// exercisable in a browser. Skin and mode selection live in the HUD.

import {
  createEngine,
  attachKeyboard,
  listSkins,
  MODE,
  STATUS,
  OUTCOME,
} from './engine-bundle.js';
import { createRenderer } from './renderer.js';

const canvas = document.getElementById('snake-canvas');
const scoreEl = document.getElementById('snake-score');
const bestEl = document.getElementById('snake-best');
const lengthEl = document.getElementById('snake-length');
const speedEl = document.getElementById('snake-speed');
const statusEl = document.getElementById('snake-status');
const messageEl = document.getElementById('snake-message');
const modeSelect = document.getElementById('snake-mode');
const skinList = document.getElementById('snake-skins');
const startBtn = document.getElementById('snake-start');
const resetBtn = document.getElementById('snake-reset');

const engine = createEngine({ width: 20, height: 20, tickMs: 140 });
const renderer = createRenderer(canvas, { maxSize: 560 });

let tickTimer = null;

function scheduleTicks() {
  cancelTicks();
  const tickMs = engine.getState().tickMs;
  tickTimer = window.setInterval(() => engine.dispatch({ type: 'TICK' }), tickMs);
}

function cancelTicks() {
  if (tickTimer !== null) {
    window.clearInterval(tickTimer);
    tickTimer = null;
  }
}

function statusLabel(status, outcome) {
  if (status === STATUS.idle) return 'Press start to play';
  if (status === STATUS.playing) return 'Playing';
  if (status === STATUS.paused) return 'Paused';
  if (status === STATUS.gameOver) {
    if (outcome === OUTCOME.wallCollision) return 'Game over — you hit the wall';
    if (outcome === OUTCOME.selfCollision) return 'Game over — you ran into yourself';
    if (outcome === OUTCOME.obstacleCollision) return 'Game over — you hit an obstacle';
    return 'Run complete — board cleared!';
  }
  return '';
}

function render() {
  const state = engine.getState();
  renderer.render(state);
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
  lengthEl.textContent = String(state.snake.segments.length);
  speedEl.textContent = state.tickMs + 'ms';
  statusEl.textContent = statusLabel(state.status, state.outcome);
  statusEl.dataset.status = state.status;
  messageEl.textContent = pickMessage(state);
  startBtn.textContent =
    state.status === STATUS.playing
      ? 'Pause'
      : state.status === STATUS.paused
        ? 'Resume'
        : state.status === STATUS.gameOver
          ? 'Play again'
          : 'Start';
  modeSelect.value = state.mode;
  for (const button of skinList.querySelectorAll('button[data-skin]')) {
    button.classList.toggle('is-active', button.dataset.skin === state.skinId);
  }
}

function pickMessage(state) {
  if (state.status === STATUS.idle) {
    return state.mode === MODE.obstacle
      ? 'Obstacle Mode: dodge the pillars while you eat.'
      : 'Classic Mode: eat, grow, survive.';
  }
  if (state.status === STATUS.paused) return 'Press space to resume.';
  if (state.status === STATUS.gameOver) {
    if (!state.outcome) return 'You cleared the board. Reset to play again.';
    return state.score === state.best && state.score > 0
      ? `New best: ${state.score}!`
      : `Final score: ${state.score}. Best: ${state.best}.`;
  }
  return '';
}

function renderSkinPicker() {
  skinList.innerHTML = '';
  for (const skin of listSkins()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.skin = skin.id;
    btn.className = 'snake-skin';
    btn.setAttribute('aria-label', `Use skin ${skin.label}`);
    btn.innerHTML = `
      <span class="snake-skin__swatch" style="background: linear-gradient(135deg, ${skin.head}, ${skin.body});"></span>
      <span class="snake-skin__label">${skin.label}</span>
    `;
    btn.addEventListener('click', () => {
      engine.dispatch({ type: 'SET_SKIN', skinId: skin.id });
    });
    skinList.appendChild(btn);
  }
}

renderSkinPicker();

engine.subscribe((evt) => {
  // Speed changes mid-run need a fresh interval.
  if (evt.reason === 'tick' && evt.state.foodEaten > 0 && evt.state.foodEaten % 4 === 0) {
    if (tickTimer !== null) scheduleTicks();
  }
  if (evt.reason === 'start') scheduleTicks();
  if (evt.reason === 'resume') scheduleTicks();
  if (evt.reason === 'pause') cancelTicks();
  if (evt.reason === 'gameOver') cancelTicks();
  if (evt.reason === 'reset') cancelTicks();
  render();
});

modeSelect.addEventListener('change', (e) => {
  engine.dispatch({ type: 'SET_MODE', mode: e.target.value });
});

startBtn.addEventListener('click', () => {
  const status = engine.getState().status;
  if (status === STATUS.playing) engine.dispatch({ type: 'PAUSE' });
  else if (status === STATUS.paused) engine.dispatch({ type: 'RESUME' });
  else engine.dispatch({ type: 'START' });
});

resetBtn.addEventListener('click', () => {
  engine.dispatch({ type: 'RESET' });
});

attachKeyboard(engine, window);

window.addEventListener('resize', render);
render();

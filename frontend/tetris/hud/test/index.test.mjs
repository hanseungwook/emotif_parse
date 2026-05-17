import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockContainer } from './mockDom.mjs';
import { createHud, STATUS, CLEAR_TYPES, HudState } from '../index.mjs';

test('createHud without container returns only state shell', () => {
  const hud = createHud();
  assert.ok(hud.hudState instanceof HudState);
  assert.equal(hud.renderer, null);
  hud.hudState.setScore(50);
  assert.equal(hud.hudState.getState().score, 50);
});

test('createHud with container auto-mounts renderer', () => {
  const { document, container } = createMockContainer();
  const hud = createHud({ container, document });
  assert.ok(hud.renderer);
  const mounts = container.querySelectorAll('[data-hud-mount]');
  assert.equal(mounts.length, 3);
});

test('createHud autoMount=false defers mount', () => {
  const { document, container } = createMockContainer();
  const hud = createHud({ container, document, autoMount: false });
  assert.equal(container.querySelectorAll('[data-hud-mount]').length, 0);
  hud.mount();
  assert.equal(container.querySelectorAll('[data-hud-mount]').length, 3);
});

test('STATUS and CLEAR_TYPES exports are present', () => {
  assert.equal(STATUS.READY, 'ready');
  assert.equal(STATUS.PLAYING, 'playing');
  assert.equal(STATUS.PAUSED, 'paused');
  assert.equal(STATUS.GAME_OVER, 'gameOver');
  assert.equal(CLEAR_TYPES.TETRIS, 'tetris');
});

test('hud integration: scoring engine pushes; HUD renders', () => {
  const { document, container } = createMockContainer();
  const hud = createHud({
    container,
    document,
    initial: { nextQueue: ['I', 'O', 'T', 'L', 'J'] },
  });

  // Simulated scoring engine wires into hudState.
  const state = hud.hudState;
  state.start();
  state.addScore(100);
  state.bumpCombo();
  state.addScore(300);
  state.bumpCombo();
  state.setLevel(2);
  state.setLines(4);
  state.recordClear({ type: CLEAR_TYPES.TETRIS, lines: 4, points: 800 });

  assert.equal(
    container.querySelector('[data-stat="score"] .hud-score__value').textContent,
    '400'
  );
  assert.equal(
    container.querySelector('[data-stat="combo"] .hud-score__combo-value').textContent,
    '2'
  );
  const banner = container.querySelector('[data-stat="clear"]');
  assert.equal(banner.querySelector('.hud-score__clear-type').textContent, 'TETRIS!');
});

test('hud integration: input loop drives pause via intent', () => {
  const { document, container } = createMockContainer();
  const hud = createHud({ container, document });
  hud.hudState.start();
  // Simulate input loop subscribing to HUD intents:
  const pauseCalls = [];
  hud.hudState.on('intent:pause', () => {
    pauseCalls.push(true);
    hud.hudState.pause();
  });
  hud.hudState.requestPause();
  assert.equal(pauseCalls.length, 1);
  assert.equal(hud.hudState.getState().status, STATUS.PAUSED);
});

test('unmount cleans up renderer', () => {
  const { document, container } = createMockContainer();
  const hud = createHud({ container, document });
  hud.unmount();
  assert.equal(container.querySelectorAll('[data-hud-mount]').length, 0);
});

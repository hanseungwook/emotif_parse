import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockContainer } from './mockDom.mjs';
import { HudRenderer } from '../hudRenderer.mjs';
import { HudState, STATUS } from '../hudState.mjs';

function build(initial) {
  const { document, container } = createMockContainer();
  const hudState = new HudState(initial);
  const renderer = new HudRenderer({ container, document, hudState });
  renderer.mount();
  return { document, container, renderer, hudState };
}

test('mount creates next, score, and overlay mount points', () => {
  const { container } = build();
  const mounts = container.querySelectorAll('[data-hud-mount]');
  const ids = mounts.map((m) => m.getAttribute('data-hud-mount')).sort();
  assert.deepEqual(ids, ['next', 'overlay', 'score']);
});

test('initial state is synced to panels', () => {
  const { container } = build({
    score: 5000,
    level: 3,
    lines: 12,
    bestScore: 9000,
    nextQueue: ['I', 'O', 'T'],
  });
  assert.equal(
    container.querySelector('[data-stat="score"] .hud-score__value').textContent,
    '5,000'
  );
  assert.equal(
    container.querySelector('[data-stat="level"] .hud-score__value').textContent,
    '3'
  );
  assert.equal(
    container.querySelector('[data-stat="lines"] .hud-score__value').textContent,
    '12'
  );
  assert.equal(
    container.querySelector('[data-stat="best"] .hud-score__value').textContent,
    '9,000'
  );
  const slot0 = container.querySelector('[data-slot-index="0"]');
  assert.equal(slot0.getAttribute('data-piece'), 'I');
});

test('hud state updates propagate to score panel', () => {
  const { container, hudState } = build();
  hudState.setScore(1200);
  hudState.setLevel(2);
  hudState.setLines(8);
  hudState.bumpCombo();
  hudState.bumpCombo();
  assert.equal(
    container.querySelector('[data-stat="score"] .hud-score__value').textContent,
    '1,200'
  );
  assert.equal(
    container.querySelector('[data-stat="level"] .hud-score__value').textContent,
    '2'
  );
  assert.equal(
    container.querySelector('[data-stat="lines"] .hud-score__value').textContent,
    '8'
  );
  assert.equal(
    container.querySelector('[data-stat="combo"] .hud-score__combo-value').textContent,
    '2'
  );
});

test('next:change events update preview slots', () => {
  const { container, hudState } = build({ nextQueue: ['I'] });
  hudState.setNextQueue(['S', 'Z', 'L', 'J']);
  assert.equal(
    container.querySelector('[data-slot-index="0"]').getAttribute('data-piece'),
    'S'
  );
  assert.equal(
    container.querySelector('[data-slot-index="3"]').getAttribute('data-piece'),
    'J'
  );
});

test('clear events show banner; clear:expire hides it', () => {
  const { container, hudState } = build();
  hudState.recordClear({ type: 'triple', lines: 3, points: 300 });
  const banner = container.querySelector('[data-stat="clear"]');
  assert.ok(banner.className.includes('is-visible'));
  hudState.clearLastClear();
  assert.ok(!banner.className.includes('is-visible'));
});

test('status:change toggles overlay', () => {
  const { container, hudState } = build();
  // Overlay starts visible (ready)
  const overlay = container.querySelector('.hud-overlay');
  assert.ok(!overlay.className.includes('hud-overlay--hidden'));
  hudState.start();
  assert.ok(overlay.className.includes('hud-overlay--hidden'));
  hudState.pause();
  assert.ok(!overlay.className.includes('hud-overlay--hidden'));
});

test('reset re-syncs panels', () => {
  const { container, hudState } = build();
  hudState.setScore(1000);
  hudState.setLines(5);
  hudState.recordClear({ type: 'single', lines: 1, points: 100 });
  hudState.reset({ bestScore: 2000 });
  assert.equal(
    container.querySelector('[data-stat="score"] .hud-score__value').textContent,
    '0'
  );
  assert.equal(
    container.querySelector('[data-stat="lines"] .hud-score__value').textContent,
    '0'
  );
  assert.equal(
    container.querySelector('[data-stat="best"] .hud-score__value').textContent,
    '2,000'
  );
  const banner = container.querySelector('[data-stat="clear"]');
  assert.ok(!banner.className.includes('is-visible'));
});

test('honors preexisting hud mount nodes when provided by the host', () => {
  const { document, container } = createMockContainer();
  const nextNode = document.createElement('div');
  nextNode.className = 'hud-root__next';
  const scoreNode = document.createElement('div');
  scoreNode.className = 'hud-root__score';
  const overlayNode = document.createElement('div');
  overlayNode.className = 'hud-root__overlay';
  container.appendChild(nextNode);
  container.appendChild(scoreNode);
  container.appendChild(overlayNode);

  const hudState = new HudState();
  const renderer = new HudRenderer({ container, document, hudState });
  renderer.mount();

  const mounts = renderer.getMounts();
  assert.equal(mounts.nextMount, nextNode);
  assert.equal(mounts.scoreMount, scoreNode);
  assert.equal(mounts.overlayMount, overlayNode);
});

test('unmount removes listeners and clears panels', () => {
  const { container, hudState, renderer } = build();
  renderer.unmount();
  hudState.setScore(500);
  // No panels attached; container retains the root class but no live panel content.
  assert.equal(container.querySelectorAll('[data-stat="score"]').length, 0);
});

test('full lifecycle: ready → playing → game over with intent restart', () => {
  const { container, hudState } = build();
  hudState.start();
  hudState.setScore(2500);
  hudState.setLevel(3);
  hudState.setLines(15);
  hudState.bumpCombo();
  hudState.bumpCombo();
  hudState.gameOver();
  // Overlay is shown with restart intent
  const primary = container.querySelector('[data-action="primary"]');
  assert.equal(primary.textContent, 'Restart');
  const restarts = [];
  hudState.on('intent:restart', (m) => restarts.push(m));
  primary.click();
  assert.equal(restarts[0].reason, 'gameOver');
  // After restart intent, runtime would call reset + setStatus(PLAYING)
  hudState.reset();
  hudState.start();
  assert.equal(hudState.getState().status, STATUS.PLAYING);
});

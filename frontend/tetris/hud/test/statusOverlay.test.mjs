import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockContainer } from './mockDom.mjs';
import { StatusOverlay } from '../statusOverlay.mjs';
import { HudState, STATUS } from '../hudState.mjs';

function build(initial) {
  const { document, container } = createMockContainer();
  const hudState = new HudState(initial);
  const overlay = new StatusOverlay({ container, document, hudState });
  overlay.mount();
  return { document, container, overlay, hudState };
}

test('overlay shown in READY status with Start primary action', () => {
  const { container, hudState } = build();
  assert.equal(container.getAttribute('data-status'), STATUS.READY);
  assert.ok(!container.className.includes('hud-overlay--hidden'));
  const primary = container.querySelector('[data-action="primary"]');
  assert.equal(primary.textContent, 'Start');
  assert.equal(primary.getAttribute('data-intent'), 'restart');
  // best score is not shown when 0
  assert.equal(container.querySelector('.hud-overlay__meta').childNodes.length, 0);
  // Avoid unused warning
  void hudState;
});

test('overlay shows best in READY status when bestScore > 0', () => {
  const { container } = build({ bestScore: 12345 });
  const meta = container.querySelector('.hud-overlay__meta');
  assert.ok(meta.childNodes.length > 0);
  const strong = meta.childNodes[0].querySelector('strong');
  assert.equal(strong.textContent, '12,345');
});

test('overlay hides during PLAYING', () => {
  const { container, hudState } = build();
  hudState.start();
  assert.ok(container.className.includes('hud-overlay--hidden'));
  assert.equal(container.getAttribute('aria-hidden'), 'true');
  assert.equal(container.style.display, 'none');
});

test('PAUSED status shows resume primary, restart secondary', () => {
  const { container, hudState } = build();
  hudState.start();
  hudState.pause();
  assert.ok(!container.className.includes('hud-overlay--hidden'));
  assert.equal(container.getAttribute('data-status'), STATUS.PAUSED);
  const primary = container.querySelector('[data-action="primary"]');
  const secondary = container.querySelector('[data-action="secondary"]');
  assert.equal(primary.textContent, 'Resume');
  assert.equal(primary.getAttribute('data-intent'), 'resume');
  assert.equal(secondary.textContent, 'Restart');
  assert.equal(secondary.getAttribute('data-intent'), 'restart');
  assert.notEqual(secondary.getAttribute('aria-hidden'), 'true');
});

test('GAME_OVER status shows Restart primary with final stats', () => {
  const { container, hudState } = build();
  hudState.setScore(2500);
  hudState.setLevel(4);
  hudState.setLines(20);
  hudState.start();
  hudState.gameOver();
  const primary = container.querySelector('[data-action="primary"]');
  const secondary = container.querySelector('[data-action="secondary"]');
  assert.equal(primary.textContent, 'Restart');
  assert.equal(primary.getAttribute('data-intent'), 'restart');
  // Secondary is hidden
  assert.equal(secondary.getAttribute('aria-hidden'), 'true');
  const meta = container.querySelector('.hud-overlay__meta');
  // Final Score / Best / Level / Lines (max combo skipped because <=1)
  assert.equal(meta.childNodes.length, 4);
});

test('clicking primary while READY emits intent:restart', () => {
  const { container, hudState } = build();
  const intents = [];
  hudState.on('intent:restart', (m) => intents.push(m));
  container.querySelector('[data-action="primary"]').click();
  assert.equal(intents.length, 1);
  assert.equal(intents[0].reason, 'ready');
});

test('clicking primary while PAUSED emits intent:resume', () => {
  const { container, hudState } = build();
  hudState.start();
  hudState.pause();
  const resumes = [];
  hudState.on('intent:resume', () => resumes.push(true));
  container.querySelector('[data-action="primary"]').click();
  assert.equal(resumes.length, 1);
});

test('clicking secondary while PAUSED emits intent:restart with paused reason', () => {
  const { container, hudState } = build();
  hudState.start();
  hudState.pause();
  const restarts = [];
  hudState.on('intent:restart', (m) => restarts.push(m));
  container.querySelector('[data-action="secondary"]').click();
  assert.equal(restarts.length, 1);
  assert.equal(restarts[0].reason, 'paused');
});

test('clicking primary while GAME_OVER emits intent:restart with gameOver reason', () => {
  const { container, hudState } = build();
  hudState.start();
  hudState.gameOver();
  const restarts = [];
  hudState.on('intent:restart', (m) => restarts.push(m));
  container.querySelector('[data-action="primary"]').click();
  assert.equal(restarts.length, 1);
  assert.equal(restarts[0].reason, 'gameOver');
});

test('unmount removes content and stops responding to state changes', () => {
  const { container, hudState, overlay } = build();
  overlay.unmount();
  hudState.start();
  hudState.pause();
  assert.equal(container.childNodes.length, 0);
});

test('switching status updates variant class', () => {
  const { container, hudState } = build();
  assert.ok(container.className.includes('hud-overlay--ready'));
  hudState.start();
  hudState.pause();
  assert.ok(container.className.includes('hud-overlay--paused'));
  assert.ok(!container.className.includes('hud-overlay--ready'));
  hudState.resume();
  hudState.gameOver();
  assert.ok(container.className.includes('hud-overlay--game-over'));
  assert.ok(!container.className.includes('hud-overlay--paused'));
});

test('GAME_OVER includes max combo when it exceeds 1', () => {
  const { container, hudState } = build();
  hudState.bumpCombo();
  hudState.bumpCombo();
  hudState.bumpCombo();
  hudState.start();
  hudState.gameOver();
  const meta = container.querySelector('.hud-overlay__meta');
  // Final Score / Best / Level / Lines / Max Combo
  assert.equal(meta.childNodes.length, 5);
});

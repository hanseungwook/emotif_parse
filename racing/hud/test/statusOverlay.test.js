'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockContainer } = require('./mockDom');
const { StatusOverlay } = require('../statusOverlay');
const { HudState, STATUS } = require('../hudState');

function build(seed) {
  const { document, container } = createMockContainer();
  const hudState = new HudState(seed);
  const overlay = new StatusOverlay({ container, document, hudState });
  overlay.mount();
  return { document, container, overlay, hudState };
}

test('idle state shows Start with start intent', () => {
  const { container } = build();
  assert.equal(container.getAttribute('data-status'), STATUS.IDLE);
  const primary = container.querySelector('[data-action="primary"]');
  assert.equal(primary.textContent, 'Start Race');
  assert.equal(primary.getAttribute('data-intent'), 'start');
});

test('racing hides overlay', () => {
  const { container, hudState } = build();
  hudState.setStatus(STATUS.RACING);
  assert.ok(container.className.includes('hud-overlay--hidden'));
  assert.equal(container.getAttribute('aria-hidden'), 'true');
});

test('paused shows Resume + Restart with proper intents', () => {
  const { container, hudState } = build();
  hudState.setStatus(STATUS.RACING);
  hudState.pause();
  assert.equal(container.querySelector('[data-action="primary"]').textContent, 'Resume');
  assert.equal(container.querySelector('[data-action="primary"]').getAttribute('data-intent'), 'resume');
  assert.equal(container.querySelector('[data-action="secondary"]').textContent, 'Restart');
  assert.equal(container.querySelector('[data-action="secondary"]').getAttribute('data-intent'), 'restart');
});

test('finished shows Race Again and finish meta', () => {
  const { container, hudState } = build({ totalLaps: 3 });
  hudState.setStatus(STATUS.RACING);
  hudState.tickTime(60000);
  hudState.completeLap(20000);
  hudState.completeLap(20000);
  hudState.completeLap(20000);
  hudState.finishRace({ position: 2, totalRacers: 8 });
  const primary = container.querySelector('[data-action="primary"]');
  assert.equal(primary.textContent, 'Race Again');
  assert.equal(primary.getAttribute('data-intent'), 'restart');
  // Meta surfaces finish position and race time.
  const meta = container.querySelector('.hud-overlay__meta');
  assert.ok(meta.textContent.includes('2nd / 8'));
});

test('clicking Start emits intent:start', () => {
  const { container, hudState } = build();
  const intents = [];
  hudState.on('intent:start', (m) => intents.push(m));
  container.querySelector('[data-action="primary"]').click();
  assert.equal(intents.length, 1);
  assert.equal(intents[0].reason, 'idle');
});

test('clicking Resume / Restart emit proper intents in paused state', () => {
  const { container, hudState } = build();
  hudState.setStatus(STATUS.RACING);
  hudState.pause();
  const resumes = [];
  const restarts = [];
  hudState.on('intent:resume', () => resumes.push(true));
  hudState.on('intent:restart', (m) => restarts.push(m));
  container.querySelector('[data-action="primary"]').click();
  container.querySelector('[data-action="secondary"]').click();
  assert.equal(resumes.length, 1);
  assert.equal(restarts.length, 1);
  assert.equal(restarts[0].reason, 'paused');
});

test('countdown state shows countdown variant and hides primary', () => {
  const { container, hudState } = build();
  hudState.startCountdown();
  assert.ok(container.className.includes('hud-overlay--countdown'));
  const primary = container.querySelector('[data-action="primary"]');
  assert.equal(primary.getAttribute('hidden'), 'hidden');
});

test('unmount removes the overlay tree', () => {
  const { container, overlay } = build();
  overlay.unmount();
  assert.equal(container.childNodes.length, 0);
});

test('throws when required options are missing', () => {
  const { document, container } = createMockContainer();
  assert.throws(() => new StatusOverlay({ container, document }), /requires hudState/);
  assert.throws(() => new StatusOverlay({ document, hudState: new HudState() }), /requires a container/);
});

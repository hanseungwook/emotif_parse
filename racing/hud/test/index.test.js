'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockContainer, createTestScheduler } = require('./mockDom');
const {
  createRacingHud,
  HudState,
  STATUS,
  MESSAGE_CATEGORIES,
  SPEED_UNITS,
  DEFAULTS,
  formatLapTime,
  formatRaceTime,
  formatOrdinal,
} = require('../index');

test('createRacingHud without a container returns state shell only', () => {
  const hud = createRacingHud();
  assert.ok(hud.hudState instanceof HudState);
  assert.equal(hud.renderer, null);
  hud.hudState.setSpeed(50);
  assert.equal(hud.hudState.getState().speed, 50);
});

test('createRacingHud with a container auto-mounts the renderer', () => {
  const { document, container } = createMockContainer();
  const hud = createRacingHud({ container, document });
  assert.ok(hud.renderer);
  assert.equal(container.querySelectorAll('[data-hud-mount]').length, 7);
});

test('createRacingHud autoMount=false defers mounting', () => {
  const { document, container } = createMockContainer();
  const hud = createRacingHud({ container, document, autoMount: false });
  assert.equal(container.querySelectorAll('[data-hud-mount]').length, 0);
  hud.mount();
  assert.equal(container.querySelectorAll('[data-hud-mount]').length, 7);
});

test('exports include the public API surface', () => {
  assert.equal(STATUS.IDLE, 'idle');
  assert.equal(STATUS.RACING, 'racing');
  assert.equal(MESSAGE_CATEGORIES.COLLISION, 'collision');
  assert.equal(SPEED_UNITS.MPH, 'mph');
  assert.ok(DEFAULTS.MAX_SPEED > 0);
  assert.equal(typeof formatLapTime, 'function');
  assert.equal(typeof formatRaceTime, 'function');
  assert.equal(typeof formatOrdinal, 'function');
});

test('format helpers behave as documented', () => {
  assert.equal(formatLapTime(75123), '01:15.123');
  assert.equal(formatRaceTime(75123), '01:15.123');
  assert.equal(formatRaceTime(60 * 60 * 1000), '1:00:00.000');
  assert.equal(formatOrdinal(1), '1st');
  assert.equal(formatOrdinal(2), '2nd');
  assert.equal(formatOrdinal(11), '11th');
});

test('end-to-end race scenario: countdown -> race -> finish', () => {
  const { document, container } = createMockContainer();
  const { scheduler, cancel } = createTestScheduler();
  const hud = createRacingHud({
    container,
    document,
    initial: { totalLaps: 2, totalCheckpoints: 3, maxSpeed: 300 },
    panelOpts: {
      raceTimer: { scheduler, cancelScheduler: cancel },
      messageFeed: { scheduler, cancelScheduler: cancel },
    },
  });

  // Sim runs the countdown.
  hud.hudState.startCountdown();
  hud.hudState.setCountdown(3);
  assert.equal(container.querySelector('[data-role="countdown-number"]').textContent, '3');
  hud.hudState.setCountdown('GO');
  assert.equal(container.querySelector('[data-role="countdown-text"]').textContent, 'GO');
  hud.hudState.beginRace();

  // Lap 1.
  hud.hudState.setSpeed(180);
  hud.hudState.setBoost(80, true);
  hud.hudState.tickTime(20000);
  hud.hudState.reachCheckpoint(0);
  hud.hudState.reachCheckpoint(1);
  hud.hudState.reachCheckpoint(2);
  hud.hudState.recordCollision({ text: 'Wall hit!' });
  hud.hudState.completeLap(20000);
  assert.equal(container.querySelector('[data-role="best-value"]').textContent, '00:20.000');
  assert.equal(container.querySelector('[data-role="lap-current"]').textContent, '2');

  // Lap 2 (final).
  hud.hudState.tickTime(18000);
  hud.hudState.completeLap(18000);
  hud.hudState.finishRace({ position: 1, totalRacers: 6 });

  assert.equal(hud.hudState.getState().status, STATUS.FINISHED);
  const overlay = container.querySelector('.hud-overlay');
  assert.equal(overlay.getAttribute('data-status'), STATUS.FINISHED);
  assert.equal(container.querySelector('[data-role="best-value"]').textContent, '00:18.000');
  assert.ok(container.querySelector('.hud-lap').className.includes('hud-lap--complete'));
});

test('runtime listens to UI intents and updates state in response', () => {
  const { document, container } = createMockContainer();
  const hud = createRacingHud({ container, document });
  const intents = [];
  hud.hudState.on('intent:start', (m) => {
    intents.push(m);
    hud.hudState.startCountdown();
    hud.hudState.setCountdown(3);
  });
  container.querySelector('[data-action="primary"]').click();
  assert.equal(intents.length, 1);
  assert.equal(hud.hudState.getState().status, STATUS.COUNTDOWN);
  assert.equal(hud.hudState.getState().countdown, 3);
});

test('collision message is decorated with the collision category', () => {
  const { document, container } = createMockContainer();
  const hud = createRacingHud({ container, document });
  hud.hudState.recordCollision({ text: 'Sideswipe' });
  const item = container.querySelector('[data-message-id]');
  assert.ok(item);
  assert.equal(item.getAttribute('data-category'), 'collision');
});

test('unmount cleans up the renderer', () => {
  const { document, container } = createMockContainer();
  const hud = createRacingHud({ container, document });
  hud.unmount();
  assert.equal(container.querySelectorAll('[data-hud-mount]').length, 0);
});

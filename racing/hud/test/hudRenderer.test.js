'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockContainer, createTestScheduler } = require('./mockDom');
const { HudRenderer } = require('../hudRenderer');
const { HudState, STATUS } = require('../hudState');

function build(seed, options) {
  const { document, container } = createMockContainer();
  const opts = options || {};
  const hudState = new HudState(seed);
  const { scheduler, cancel, advance } = createTestScheduler();
  const renderer = new HudRenderer({
    container,
    document,
    hudState,
    panelOpts: {
      raceTimer: { scheduler, cancelScheduler: cancel },
      messageFeed: { scheduler, cancelScheduler: cancel },
      ...(opts.panelOpts || {}),
    },
  });
  renderer.mount();
  return { document, container, hudState, renderer, advance };
}

test('mount creates the expected mount points', () => {
  const { container } = build();
  const mounts = container.querySelectorAll('[data-hud-mount]');
  const keys = mounts.map((m) => m.getAttribute('data-hud-mount')).sort();
  assert.deepEqual(keys, [
    'boost',
    'countdown',
    'lap',
    'messages',
    'overlay',
    'speed',
    'timer',
  ]);
});

test('initial state hydrates panels', () => {
  const { container } = build({
    speed: 50,
    maxSpeed: 200,
    boost: 30,
    boostCapacity: 100,
    currentLap: 2,
    totalLaps: 4,
    nextCheckpoint: 1,
    totalCheckpoints: 4,
    raceTime: 8000,
    lapTime: 4000,
    bestLap: 35000,
    countdown: 2,
    status: STATUS.RACING,
  });
  assert.equal(container.querySelector('[data-role="speed-value"]').textContent, '50');
  assert.equal(container.querySelector('[data-role="boost-value"]').textContent, '30%');
  assert.equal(container.querySelector('[data-role="lap-current"]').textContent, '2');
  assert.equal(container.querySelector('[data-role="lap-total"]').textContent, '4');
  assert.equal(container.querySelector('[data-role="race-value"]').textContent, '00:08.000');
  assert.equal(container.querySelector('[data-role="lap-value"]').textContent, '00:04.000');
  assert.equal(container.querySelector('[data-role="best-value"]').textContent, '00:35.000');
  assert.equal(container.querySelector('[data-role="countdown-number"]').textContent, '2');
});

test('speed and boost updates flow through to panels', () => {
  const { container, hudState } = build();
  hudState.setSpeed(80);
  hudState.setBoost(40, true);
  assert.equal(container.querySelector('[data-role="speed-value"]').textContent, '80');
  assert.equal(container.querySelector('[data-role="boost-value"]').textContent, '40%');
  assert.ok(container.querySelector('.hud-boost').className.includes('hud-boost--active'));
});

test('lap and checkpoint updates flow through to LapTracker', () => {
  const { container, hudState } = build({ totalCheckpoints: 4 });
  hudState.reachCheckpoint(0);
  hudState.reachCheckpoint(1);
  hudState.setLap(2, 3);
  assert.equal(container.querySelector('[data-role="lap-current"]').textContent, '2');
  const dots = container.querySelectorAll('.hud-lap__checkpoint');
  assert.equal(dots[0].getAttribute('data-state'), 'reached');
  assert.equal(dots[1].getAttribute('data-state'), 'reached');
  assert.equal(dots[2].getAttribute('data-state'), 'next');
});

test('tickTime updates the race timer', () => {
  const { container, hudState } = build({ status: STATUS.RACING });
  hudState.tickTime(2500);
  assert.equal(container.querySelector('[data-role="race-value"]').textContent, '00:02.500');
  assert.equal(container.querySelector('[data-role="lap-value"]').textContent, '00:02.500');
});

test('completeLap flashes the best block and updates the value', () => {
  const { container, hudState } = build({ totalLaps: 3 });
  hudState.setStatus(STATUS.RACING);
  hudState.tickTime(45000);
  hudState.completeLap(45000);
  assert.equal(container.querySelector('[data-role="best-value"]').textContent, '00:45.000');
  const block = container.querySelector('[data-timer="best"]');
  assert.ok(block.className.includes('hud-timer__block--best-flash'));
});

test('countdown:change updates the countdown panel', () => {
  const { container, hudState } = build();
  hudState.setCountdown(3);
  assert.equal(container.querySelector('[data-role="countdown-number"]').textContent, '3');
  hudState.setCountdown('GO');
  assert.equal(container.querySelector('[data-role="countdown-text"]').textContent, 'GO');
  hudState.setCountdown(null);
  assert.ok(container.querySelector('.hud-countdown').className.includes('hud-countdown--hidden'));
});

test('message:push appears in the message feed', () => {
  const { container, hudState } = build();
  hudState.pushMessage({ id: 'm1', text: 'Lap 2!', category: 'lap', durationMs: 5000 });
  hudState.recordCollision({ text: 'Smashed!' });
  const items = container.querySelectorAll('[data-message-id]');
  assert.equal(items.length, 2);
  assert.equal(items[0].getAttribute('data-category'), 'lap');
  assert.equal(items[1].getAttribute('data-category'), 'collision');
});

test('status changes propagate to timer paused class and lap completion', () => {
  const { container, hudState } = build();
  hudState.setStatus(STATUS.RACING);
  hudState.pause();
  assert.ok(container.querySelector('.hud-timer').className.includes('hud-timer--paused'));
  hudState.resume();
  assert.ok(!container.querySelector('.hud-timer').className.includes('hud-timer--paused'));
  hudState.setStatus(STATUS.FINISHED);
  assert.ok(container.querySelector('.hud-lap').className.includes('hud-lap--complete'));
});

test('host-provided mount nodes are reused', () => {
  const { document, container } = createMockContainer();
  const slots = ['speed', 'boost', 'lap', 'timer', 'countdown', 'messages', 'overlay'];
  const hostNodes = {};
  for (const key of slots) {
    const node = document.createElement('div');
    node.className = `hud-root__${key}`;
    container.appendChild(node);
    hostNodes[key] = node;
  }
  const hudState = new HudState();
  const renderer = new HudRenderer({ container, document, hudState });
  renderer.mount();
  const mounts = renderer.getMounts();
  assert.equal(mounts.speedMount, hostNodes.speed);
  assert.equal(mounts.boostMount, hostNodes.boost);
  assert.equal(mounts.lapMount, hostNodes.lap);
  assert.equal(mounts.timerMount, hostNodes.timer);
  assert.equal(mounts.countdownMount, hostNodes.countdown);
  assert.equal(mounts.messagesMount, hostNodes.messages);
  assert.equal(mounts.overlayMount, hostNodes.overlay);
});

test('reset re-syncs every panel', () => {
  const { container, hudState } = build();
  hudState.setStatus(STATUS.RACING);
  hudState.setSpeed(150);
  hudState.setBoost(70, true);
  hudState.reachCheckpoint(0);
  hudState.tickTime(8000);
  hudState.pushMessage({ id: 'x', text: 'Boom' });
  hudState.reset({ totalLaps: 5 });
  assert.equal(container.querySelector('[data-role="speed-value"]').textContent, '0');
  assert.equal(container.querySelector('[data-role="boost-value"]').textContent, '0%');
  assert.equal(container.querySelector('[data-role="lap-current"]').textContent, '1');
  assert.equal(container.querySelector('[data-role="lap-total"]').textContent, '5');
  assert.equal(container.querySelector('[data-role="race-value"]').textContent, '00:00.000');
  assert.equal(container.querySelectorAll('[data-message-id]').length, 0);
});

test('unmount drops listeners and tears down panels', () => {
  const { container, hudState, renderer } = build();
  renderer.unmount();
  hudState.setSpeed(120);
  assert.equal(container.querySelectorAll('[data-role="speed-value"]').length, 0);
});

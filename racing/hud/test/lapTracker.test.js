'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockContainer } = require('./mockDom');
const { LapTracker } = require('../lapTracker');

function build(opts) {
  const { document, container } = createMockContainer();
  const tracker = new LapTracker({ container, document, ...(opts || {}) });
  tracker.mount();
  return { document, container, tracker };
}

test('renders lap counter and default checkpoint dots', () => {
  const { container } = build();
  assert.equal(container.querySelector('[data-role="lap-current"]').textContent, '1');
  assert.equal(container.querySelector('[data-role="lap-total"]').textContent, '3');
  const list = container.querySelector('[data-role="checkpoint-list"]');
  assert.equal(list.childNodes.length, 4);
});

test('setLap updates current/total values', () => {
  const { container, tracker } = build();
  tracker.setLap(2, 5);
  assert.equal(container.querySelector('[data-role="lap-current"]').textContent, '2');
  assert.equal(container.querySelector('[data-role="lap-total"]').textContent, '5');
});

test('setCheckpoint applies reached/next/pending states', () => {
  const { container, tracker } = build();
  tracker.setCheckpoint(2, 4);
  const dots = container.querySelectorAll('.hud-lap__checkpoint');
  assert.equal(dots[0].getAttribute('data-state'), 'reached');
  assert.equal(dots[1].getAttribute('data-state'), 'reached');
  assert.equal(dots[2].getAttribute('data-state'), 'next');
  assert.equal(dots[3].getAttribute('data-state'), 'pending');
});

test('setCheckpoint with new total rebuilds dot list', () => {
  const { container, tracker } = build();
  tracker.setCheckpoint(undefined, 6);
  const list = container.querySelector('[data-role="checkpoint-list"]');
  assert.equal(list.childNodes.length, 6);
});

test('final lap surfaces hud-lap--final modifier', () => {
  const { container, tracker } = build();
  tracker.setLap(3, 3);
  assert.ok(container.className.includes('hud-lap--final'));
  tracker.setLap(2, 3);
  assert.ok(!container.className.includes('hud-lap--final'));
});

test('setComplete adds the complete modifier', () => {
  const { container, tracker } = build();
  tracker.setComplete(true);
  assert.ok(container.className.includes('hud-lap--complete'));
  tracker.setComplete(false);
  assert.ok(!container.className.includes('hud-lap--complete'));
});

test('unmount tears down the container', () => {
  const { container, tracker } = build();
  tracker.unmount();
  assert.equal(container.childNodes.length, 0);
});

test('throws when constructed without a container', () => {
  assert.throws(() => new LapTracker({}), /requires a container/);
});

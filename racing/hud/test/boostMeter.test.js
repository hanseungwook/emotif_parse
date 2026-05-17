'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockContainer } = require('./mockDom');
const { BoostMeter, LOW_BOOST_THRESHOLD } = require('../boostMeter');

function build(opts) {
  const { document, container } = createMockContainer();
  const meter = new BoostMeter({ container, document, ...(opts || {}) });
  meter.mount();
  return { document, container, meter };
}

test('renders label, fill, value, and meter scaffold', () => {
  const { container } = build();
  assert.ok(container.querySelector('.hud-boost__label'));
  assert.ok(container.querySelector('[data-role="boost-meter"]'));
  assert.ok(container.querySelector('[data-role="boost-fill"]'));
  assert.equal(container.querySelector('[data-role="boost-value"]').textContent, '0%');
});

test('setBoost updates fill width and percent text', () => {
  const { container, meter } = build({ capacity: 100 });
  meter.setBoost(50);
  const fill = container.querySelector('[data-role="boost-fill"]');
  assert.equal(fill.getAttribute('data-ratio'), '0.500');
  assert.equal(container.querySelector('[data-role="boost-value"]').textContent, '50%');
});

test('clamps to capacity at both ends', () => {
  const { container, meter } = build({ capacity: 80 });
  meter.setBoost(-50);
  assert.equal(container.querySelector('[data-role="boost-value"]').textContent, '0%');
  meter.setBoost(999);
  assert.equal(container.querySelector('[data-role="boost-value"]').textContent, '100%');
  assert.ok(container.className.includes('hud-boost--full'));
});

test('active state applies modifier when boost present', () => {
  const { container, meter } = build({ capacity: 100 });
  meter.setBoost(40, true);
  assert.ok(container.className.includes('hud-boost--active'));
  meter.setBoost(0, true);
  assert.ok(!container.className.includes('hud-boost--active'));
  assert.ok(container.className.includes('hud-boost--empty'));
});

test('low-boost class applies under threshold', () => {
  const { container, meter } = build({ capacity: 100 });
  meter.setBoost(LOW_BOOST_THRESHOLD * 100 - 1);
  assert.ok(container.className.includes('hud-boost--low'));
  meter.setBoost(LOW_BOOST_THRESHOLD * 100 + 1);
  assert.ok(!container.className.includes('hud-boost--low'));
});

test('setCapacity re-clamps current value', () => {
  const { container, meter } = build({ capacity: 100 });
  meter.setBoost(90);
  meter.setCapacity(50);
  assert.equal(container.querySelector('[data-role="boost-value"]').textContent, '100%');
  assert.equal(meter.getRatio(), 1);
});

test('unmount tears down the container', () => {
  const { container, meter } = build();
  meter.unmount();
  assert.equal(container.childNodes.length, 0);
});

test('throws when constructed without a container', () => {
  assert.throws(() => new BoostMeter({}), /requires a container/);
});

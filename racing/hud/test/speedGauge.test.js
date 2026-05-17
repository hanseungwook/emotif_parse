'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockContainer } = require('./mockDom');
const { SpeedGauge, REDLINE_THRESHOLD } = require('../speedGauge');

function build(opts) {
  const { document, container } = createMockContainer();
  const gauge = new SpeedGauge({ container, document, ...(opts || {}) });
  gauge.mount();
  return { document, container, gauge };
}

test('renders value, unit, and bar', () => {
  const { container } = build({ unit: 'km/h' });
  assert.equal(container.querySelector('[data-role="speed-value"]').textContent, '0');
  assert.equal(container.querySelector('[data-role="speed-unit"]').textContent, 'km/h');
  assert.ok(container.querySelector('[data-role="speed-bar"]'));
});

test('setSpeed updates value and fill ratio', () => {
  const { container, gauge } = build({ maxSpeed: 200 });
  gauge.setSpeed(100);
  assert.equal(container.querySelector('[data-role="speed-value"]').textContent, '100');
  assert.equal(container.querySelector('[data-role="speed-fill"]').getAttribute('data-ratio'), '0.500');
});

test('redline class applies above threshold', () => {
  const { container, gauge } = build({ maxSpeed: 100 });
  gauge.setSpeed(REDLINE_THRESHOLD * 100 + 5);
  assert.ok(container.className.includes('hud-speed--redline'));
  gauge.setSpeed(REDLINE_THRESHOLD * 100 - 5);
  assert.ok(!container.className.includes('hud-speed--redline'));
});

test('negative speed surfaces reverse class and absolute value', () => {
  const { container, gauge } = build({ maxSpeed: 100 });
  gauge.setSpeed(-20);
  assert.equal(container.querySelector('[data-role="speed-value"]').textContent, '20');
  assert.ok(container.className.includes('hud-speed--reverse'));
  gauge.setSpeed(40);
  assert.ok(!container.className.includes('hud-speed--reverse'));
});

test('setUnit updates label without rebuild', () => {
  const { container, gauge } = build({ unit: 'km/h' });
  gauge.setUnit('mph');
  assert.equal(container.querySelector('[data-role="speed-unit"]').textContent, 'mph');
});

test('setMaxSpeed re-computes ratio', () => {
  const { container, gauge } = build({ maxSpeed: 200 });
  gauge.setSpeed(150);
  gauge.setMaxSpeed(300);
  assert.equal(container.querySelector('[data-role="speed-fill"]').getAttribute('data-ratio'), '0.500');
});

test('non-finite speed input is treated as 0', () => {
  const { container, gauge } = build();
  gauge.setSpeed('not a number');
  assert.equal(container.querySelector('[data-role="speed-value"]').textContent, '0');
});

test('unmount removes the rendered tree', () => {
  const { container, gauge } = build();
  gauge.unmount();
  assert.equal(container.childNodes.length, 0);
});

test('throws when constructed without a container', () => {
  assert.throws(() => new SpeedGauge({}), /requires a container/);
});

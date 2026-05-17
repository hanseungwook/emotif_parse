'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockContainer } = require('./mockDom');
const { Countdown, GO_SENTINEL } = require('../countdown');

function build() {
  const { document, container } = createMockContainer();
  const cd = new Countdown({ container, document });
  cd.mount();
  return { document, container, countdown: cd };
}

test('hides by default and exposes number / text nodes', () => {
  const { container } = build();
  assert.ok(container.className.includes('hud-countdown--hidden'));
  assert.ok(container.querySelector('[data-role="countdown-number"]'));
  assert.ok(container.querySelector('[data-role="countdown-text"]'));
});

test('setValue with positive integer shows number', () => {
  const { container, countdown } = build();
  countdown.setValue(3);
  assert.ok(!container.className.includes('hud-countdown--hidden'));
  assert.equal(container.querySelector('[data-role="countdown-number"]').textContent, '3');
  assert.equal(container.getAttribute('data-countdown'), '3');
});

test('setValue("GO") triggers the go modifier', () => {
  const { container, countdown } = build();
  countdown.setValue('go');
  assert.ok(container.className.includes('hud-countdown--go'));
  assert.equal(container.querySelector('[data-role="countdown-text"]').textContent, 'GO');
  assert.equal(container.getAttribute('data-countdown'), GO_SENTINEL);
});

test('numeric 0 collapses to GO', () => {
  const { container, countdown } = build();
  countdown.setValue(0);
  assert.equal(container.querySelector('[data-role="countdown-text"]').textContent, 'GO');
});

test('null / undefined hides the countdown', () => {
  const { container, countdown } = build();
  countdown.setValue(3);
  countdown.setValue(null);
  assert.ok(container.className.includes('hud-countdown--hidden'));
  assert.equal(container.getAttribute('aria-hidden'), 'true');
});

test('hide() is equivalent to setValue(null)', () => {
  const { container, countdown } = build();
  countdown.setValue(2);
  countdown.hide();
  assert.equal(countdown.isVisible(), false);
  assert.ok(container.className.includes('hud-countdown--hidden'));
});

test('isVisible reports current state', () => {
  const { countdown } = build();
  assert.equal(countdown.isVisible(), false);
  countdown.setValue(1);
  assert.equal(countdown.isVisible(), true);
  countdown.setValue(null);
  assert.equal(countdown.isVisible(), false);
});

test('unmount clears the container', () => {
  const { container, countdown } = build();
  countdown.unmount();
  assert.equal(container.childNodes.length, 0);
});

test('throws when constructed without a container', () => {
  assert.throws(() => new Countdown({}), /requires a container/);
});

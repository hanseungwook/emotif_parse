'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockContainer, createTestScheduler } = require('./mockDom');
const { RaceTimer, BEST_FLASH_MS } = require('../raceTimer');

function build() {
  const { document, container } = createMockContainer();
  const { scheduler, cancel, advance } = createTestScheduler();
  const timer = new RaceTimer({
    container,
    document,
    scheduler,
    cancelScheduler: cancel,
  });
  timer.mount();
  return { document, container, timer, advance };
}

test('renders race, lap, and best timer blocks', () => {
  const { container } = build();
  assert.equal(container.querySelector('[data-role="race-value"]').textContent, '00:00.000');
  assert.equal(container.querySelector('[data-role="lap-value"]').textContent, '00:00.000');
  assert.equal(container.querySelector('[data-role="best-value"]').textContent, '--:--.---');
});

test('setRaceTime / setLapTime format mm:ss.mmm', () => {
  const { container, timer } = build();
  timer.setRaceTime(63450);
  timer.setLapTime(12340);
  assert.equal(container.querySelector('[data-role="race-value"]').textContent, '01:03.450');
  assert.equal(container.querySelector('[data-role="lap-value"]').textContent, '00:12.340');
});

test('race-time switches to h:mm:ss.mmm past one hour', () => {
  const { container, timer } = build();
  timer.setRaceTime(3 * 3600000 + 4 * 60000 + 5000 + 6);
  assert.equal(container.querySelector('[data-role="race-value"]').textContent, '3:04:05.006');
});

test('setBestLap with null reverts to placeholder', () => {
  const { container, timer } = build();
  timer.setBestLap(45000);
  assert.equal(container.querySelector('[data-role="best-value"]').textContent, '00:45.000');
  timer.setBestLap(null);
  assert.equal(container.querySelector('[data-role="best-value"]').textContent, '--:--.---');
});

test('flashBest adds and later removes the flash class', () => {
  const { container, timer, advance } = build();
  timer.flashBest();
  const block = container.querySelector('[data-timer="best"]');
  assert.ok(block.className.includes('hud-timer__block--best-flash'));
  advance(BEST_FLASH_MS + 10);
  assert.ok(!block.className.includes('hud-timer__block--best-flash'));
});

test('setPaused toggles the paused modifier', () => {
  const { container, timer } = build();
  timer.setPaused(true);
  assert.ok(container.className.includes('hud-timer--paused'));
  timer.setPaused(false);
  assert.ok(!container.className.includes('hud-timer--paused'));
});

test('non-finite times are normalized to 00:00.000', () => {
  const { container, timer } = build();
  timer.setRaceTime(-1);
  timer.setLapTime('NaN');
  assert.equal(container.querySelector('[data-role="race-value"]').textContent, '00:00.000');
  assert.equal(container.querySelector('[data-role="lap-value"]').textContent, '00:00.000');
});

test('unmount tears down container and cancels pending flash timer', () => {
  const { container, timer, advance } = build();
  timer.flashBest();
  timer.unmount();
  // No throw on advancing the timer past the flash.
  advance(BEST_FLASH_MS + 10);
  assert.equal(container.childNodes.length, 0);
});

test('throws when constructed without a container', () => {
  assert.throws(() => new RaceTimer({}), /requires a container/);
});

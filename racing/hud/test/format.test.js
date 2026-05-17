'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatInteger,
  formatLapTime,
  formatRaceTime,
  formatSpeed,
  formatBoostPercent,
  formatOrdinal,
} = require('../format');

test('formatInteger rounds to nearest non-negative integer', () => {
  assert.equal(formatInteger(0), '0');
  assert.equal(formatInteger(42.6), '43');
  assert.equal(formatInteger(-7), '0');
  assert.equal(formatInteger('not a number'), '0');
  assert.equal(formatInteger(null), '0');
});

test('formatLapTime renders mm:ss.mmm', () => {
  assert.equal(formatLapTime(0), '00:00.000');
  assert.equal(formatLapTime(1234), '00:01.234');
  assert.equal(formatLapTime(75123), '01:15.123');
  assert.equal(formatLapTime(-5), '00:00.000');
  assert.equal(formatLapTime('NaN'), '00:00.000');
});

test('formatRaceTime falls back to mm:ss.mmm under an hour', () => {
  assert.equal(formatRaceTime(0), '00:00.000');
  assert.equal(formatRaceTime(75123), '01:15.123');
});

test('formatRaceTime expands to h:mm:ss.mmm at and past one hour', () => {
  assert.equal(formatRaceTime(3600000), '1:00:00.000');
  assert.equal(formatRaceTime(3 * 3600000 + 4 * 60000 + 5006), '3:04:05.006');
});

test('formatSpeed is non-negative and integral', () => {
  assert.equal(formatSpeed(0), '0');
  assert.equal(formatSpeed(42.7), '43');
  assert.equal(formatSpeed(-5), '0');
});

test('formatBoostPercent uses ratio of value/capacity', () => {
  assert.equal(formatBoostPercent(0, 100), '0%');
  assert.equal(formatBoostPercent(25, 100), '25%');
  assert.equal(formatBoostPercent(99, 100), '99%');
  assert.equal(formatBoostPercent(200, 100), '100%');
  assert.equal(formatBoostPercent(50, 0), '0%');
  assert.equal(formatBoostPercent('NaN', 100), '0%');
});

test('formatOrdinal handles teen exceptions', () => {
  assert.equal(formatOrdinal(1), '1st');
  assert.equal(formatOrdinal(2), '2nd');
  assert.equal(formatOrdinal(3), '3rd');
  assert.equal(formatOrdinal(4), '4th');
  assert.equal(formatOrdinal(11), '11th');
  assert.equal(formatOrdinal(12), '12th');
  assert.equal(formatOrdinal(13), '13th');
  assert.equal(formatOrdinal(21), '21st');
  assert.equal(formatOrdinal(0), '-');
  assert.equal(formatOrdinal(-3), '-');
});

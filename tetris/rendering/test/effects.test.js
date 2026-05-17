'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { EffectTimeline, easeOutCubic, easeInQuad } = require('../effects');
const { EFFECTS } = require('../constants');

test('start tracks an effect with payload and zero elapsed', () => {
  const timeline = new EffectTimeline();
  const id = timeline.start(EFFECTS.LINE_CLEAR, { rows: [3, 4] });
  assert.equal(timeline.size(), 1);
  const active = timeline.active(EFFECTS.LINE_CLEAR);
  assert.equal(active.length, 1);
  assert.equal(active[0].id, id);
  assert.equal(active[0].progress, 0);
  assert.deepEqual(active[0].payload.rows, [3, 4]);
});

test('start throws on unknown effect', () => {
  const timeline = new EffectTimeline();
  assert.throws(() => timeline.start('not-a-real-effect'));
});

test('advance increments elapsed and completes when expired', () => {
  const timeline = new EffectTimeline({ durations: { 'line-clear': 100 } });
  timeline.start(EFFECTS.LINE_CLEAR, { rows: [1] });
  const finished1 = timeline.advance(40);
  assert.equal(finished1.length, 0);
  assert.equal(timeline.active(EFFECTS.LINE_CLEAR)[0].progress, 0.4);
  const finished2 = timeline.advance(80);
  assert.equal(finished2.length, 1);
  assert.equal(finished2[0].name, EFFECTS.LINE_CLEAR);
  assert.equal(timeline.size(), 0);
});

test('advance with non-positive delta is treated as zero', () => {
  const timeline = new EffectTimeline({ durations: { 'lock': 100 } });
  timeline.start(EFFECTS.LOCK);
  timeline.advance(-50);
  timeline.advance('nope');
  assert.equal(timeline.active(EFFECTS.LOCK)[0].progress, 0);
});

test('cancel and cancelByName remove effects', () => {
  const timeline = new EffectTimeline();
  const a = timeline.start(EFFECTS.LINE_CLEAR, { rows: [1] });
  timeline.start(EFFECTS.LINE_CLEAR, { rows: [2] });
  timeline.start(EFFECTS.LEVEL_UP, { level: 3 });
  assert.equal(timeline.cancel(a), true);
  assert.equal(timeline.size(), 2);
  const removed = timeline.cancelByName(EFFECTS.LINE_CLEAR);
  assert.equal(removed, 1);
  assert.equal(timeline.size(), 1);
  assert.equal(timeline.has(EFFECTS.LEVEL_UP), true);
});

test('clear wipes all effects', () => {
  const timeline = new EffectTimeline();
  timeline.start(EFFECTS.LINE_CLEAR, { rows: [1] });
  timeline.start(EFFECTS.LEVEL_UP, { level: 2 });
  timeline.clear();
  assert.equal(timeline.size(), 0);
});

test('easeOutCubic clamps to 0..1 and matches expected curve at midpoint', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(-2), 0);
  assert.equal(easeOutCubic(3), 1);
  const mid = easeOutCubic(0.5);
  assert.ok(mid > 0.85 && mid < 0.9, 'mid should be ~0.875');
});

test('easeInQuad respects bounds', () => {
  assert.equal(easeInQuad(0), 0);
  assert.equal(easeInQuad(1), 1);
  assert.equal(easeInQuad(-1), 0);
  assert.equal(easeInQuad(2), 1);
  assert.equal(easeInQuad(0.5), 0.25);
});

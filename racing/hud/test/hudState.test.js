'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  HudState,
  STATUS,
  MESSAGE_CATEGORIES,
  SPEED_UNITS,
} = require('../hudState');

test('seeds defaults and normalizes inputs', () => {
  const hud = new HudState({
    speed: -10,
    maxSpeed: 250,
    boost: 999,
    boostCapacity: 50,
    totalLaps: 0,
    totalCheckpoints: 0,
    nextCheckpoint: 'nope',
    speedUnit: 'parsec',
    status: 'idle',
  });
  const state = hud.getState();
  assert.equal(state.speed, 0);
  assert.equal(state.maxSpeed, 250);
  assert.equal(state.boostCapacity, 50);
  assert.equal(state.boost, 50);
  assert.equal(state.totalLaps, 1);
  assert.equal(state.totalCheckpoints, 1);
  assert.equal(state.nextCheckpoint, 0);
  assert.equal(state.speedUnit, SPEED_UNITS.KMH);
  assert.equal(state.status, STATUS.IDLE);
});

test('setSpeed clamps to maxSpeed and emits delta', () => {
  const hud = new HudState({ maxSpeed: 300 });
  const events = [];
  hud.on('speed:change', (e) => events.push(e));
  hud.setSpeed(120);
  hud.setSpeed(120); // no-op
  hud.setSpeed(500); // clamped
  assert.equal(hud.getState().speed, 300);
  assert.equal(events.length, 2);
  assert.equal(events[0].delta, 120);
  assert.equal(events[1].value, 300);
});

test('setMaxSpeed re-clamps current speed', () => {
  const hud = new HudState();
  hud.setSpeed(150);
  hud.setMaxSpeed(100);
  assert.equal(hud.getState().maxSpeed, 100);
  assert.equal(hud.getState().speed, 100);
});

test('setBoost emits change and clamps to capacity; toggles active state', () => {
  const hud = new HudState({ boostCapacity: 100 });
  const events = [];
  const activations = [];
  hud.on('boost:change', (e) => events.push(e));
  hud.on('boost:activate', () => activations.push('on'));
  hud.on('boost:deactivate', () => activations.push('off'));
  hud.setBoost(40);
  hud.setBoost(150); // clamps to capacity
  hud.setBoost(120, true); // value unchanged (still capped) but active flips on
  hud.setBoost(0, true); // drains while still flagged active
  assert.equal(hud.getState().boost, 0);
  // boost:change fires whenever value OR active changes — the third call only
  // changes active, but still emits so the renderer can repaint the active state.
  assert.deepEqual(events.map((e) => e.value), [40, 100, 100, 0]);
  assert.deepEqual(events.map((e) => e.active), [false, false, true, true]);
  assert.deepEqual(activations, ['on']);
});

test('consumeBoost auto-deactivates when drained', () => {
  const hud = new HudState({ boostCapacity: 50 });
  hud.setBoost(30, true);
  hud.consumeBoost(20);
  assert.equal(hud.getState().boost, 10);
  assert.equal(hud.getState().boostActive, true);
  hud.consumeBoost(20);
  assert.equal(hud.getState().boost, 0);
  assert.equal(hud.getState().boostActive, false);
});

test('chargeBoost respects capacity', () => {
  const hud = new HudState({ boostCapacity: 100 });
  hud.chargeBoost(40);
  hud.chargeBoost(80);
  assert.equal(hud.getState().boost, 100);
});

test('reachCheckpoint advances next pointer and emits events', () => {
  const hud = new HudState({ totalCheckpoints: 4 });
  const reached = [];
  const changes = [];
  hud.on('checkpoint:reach', (e) => reached.push(e));
  hud.on('checkpoint:change', (e) => changes.push(e));
  hud.reachCheckpoint(0);
  hud.reachCheckpoint(1);
  hud.reachCheckpoint(2);
  hud.reachCheckpoint(3);
  assert.equal(hud.getState().nextCheckpoint, 4);
  assert.equal(reached.length, 4);
  // Every advance (including the final one that pegs at total) emits change.
  assert.equal(changes.length, 4);
  // Reaching the last checkpoint a second time pegs at total without re-emitting change.
  hud.reachCheckpoint(4);
  assert.equal(reached.length, 5);
  assert.equal(changes.length, 4);
});

test('completeLap records time, picks best, rolls to next lap', () => {
  const hud = new HudState({ totalLaps: 3 });
  const completes = [];
  const lapChanges = [];
  hud.on('lap:complete', (e) => completes.push(e));
  hud.on('lap:change', (e) => lapChanges.push(e));
  hud.setStatus(STATUS.RACING);
  hud.tickTime(45000);
  hud.completeLap(45000);
  hud.tickTime(43000);
  hud.completeLap(43000);
  hud.tickTime(46000);
  hud.completeLap(46000);
  const state = hud.getState();
  assert.equal(state.currentLap, 3);
  assert.equal(state.bestLap, 43000);
  assert.deepEqual(state.lapTimes, [45000, 43000, 46000]);
  // 2 lap:change events (after laps 1 and 2). Lap 3 is final and does not advance.
  assert.equal(lapChanges.length, 2);
  assert.equal(completes.length, 3);
  assert.equal(completes[1].isBestLap, true);
});

test('tickTime only advances while racing', () => {
  const hud = new HudState();
  hud.tickTime(1000);
  assert.equal(hud.getState().raceTime, 0);
  hud.setStatus(STATUS.RACING);
  hud.tickTime(1500);
  assert.equal(hud.getState().raceTime, 1500);
  assert.equal(hud.getState().lapTime, 1500);
});

test('countdown sequence then beginRace', () => {
  const hud = new HudState();
  const countdowns = [];
  hud.on('countdown:change', (e) => countdowns.push(e.value));
  hud.startCountdown();
  hud.setCountdown(3);
  hud.setCountdown(2);
  hud.setCountdown(1);
  hud.setCountdown('GO');
  hud.beginRace();
  assert.equal(hud.getState().status, STATUS.RACING);
  assert.equal(hud.getState().countdown, null);
  assert.deepEqual(countdowns, [3, 2, 1, 'GO', null]);
});

test('pause / resume only between racing and paused', () => {
  const hud = new HudState();
  hud.pause();
  assert.equal(hud.getState().status, STATUS.IDLE);
  hud.setStatus(STATUS.RACING);
  hud.pause();
  assert.equal(hud.getState().status, STATUS.PAUSED);
  hud.resume();
  assert.equal(hud.getState().status, STATUS.RACING);
  hud.togglePause();
  assert.equal(hud.getState().status, STATUS.PAUSED);
  hud.togglePause();
  assert.equal(hud.getState().status, STATUS.RACING);
});

test('finishRace emits finish detail and sets status', () => {
  const hud = new HudState();
  hud.setStatus(STATUS.RACING);
  hud.tickTime(120000);
  const finishes = [];
  hud.on('race:finish', (e) => finishes.push(e));
  const detail = hud.finishRace({ position: 1, totalRacers: 8 });
  assert.equal(hud.getState().status, STATUS.FINISHED);
  assert.equal(detail.position, 1);
  assert.equal(detail.totalRacers, 8);
  assert.equal(finishes.length, 1);
  assert.equal(finishes[0].raceTime, 120000);
});

test('pushMessage normalizes category and assigns id', () => {
  const hud = new HudState();
  const msgs = [];
  hud.on('message:push', (m) => msgs.push(m));
  const a = hud.pushMessage({ text: 'Boost picked up', category: 'boost', durationMs: 1000 });
  const b = hud.pushMessage({ text: 'Hello' });
  const c = hud.pushMessage({ text: '', category: 'info' });
  hud.pushMessage(null);
  assert.equal(msgs.length, 2);
  assert.equal(a.category, MESSAGE_CATEGORIES.BOOST);
  assert.equal(b.category, MESSAGE_CATEGORIES.INFO);
  assert.equal(c, null);
  assert.ok(typeof a.id === 'string' && a.id.length > 0);
});

test('recordCollision pushes a collision message', () => {
  const hud = new HudState();
  const m = hud.recordCollision({ text: 'Smashed the wall!' });
  assert.equal(m.category, MESSAGE_CATEGORIES.COLLISION);
  assert.equal(m.text, 'Smashed the wall!');
  // Default text when none provided.
  const m2 = hud.recordCollision();
  assert.equal(m2.text, 'Collision!');
});

test('dismissMessage and clearMessages adjust state', () => {
  const hud = new HudState();
  const a = hud.pushMessage({ text: 'one' });
  hud.pushMessage({ text: 'two' });
  hud.pushMessage({ text: 'three' });
  hud.dismissMessage(a.id);
  assert.equal(hud.getState().messages.length, 2);
  hud.clearMessages();
  assert.equal(hud.getState().messages.length, 0);
});

test('reset returns to a fresh race; honors config overrides', () => {
  const hud = new HudState({ totalLaps: 3 });
  hud.setStatus(STATUS.RACING);
  hud.setSpeed(120);
  hud.setBoost(50, true);
  hud.tickTime(20000);
  hud.completeLap(20000);
  hud.pushMessage({ text: 'mid-race' });
  hud.reset({ totalLaps: 5, maxSpeed: 400 });
  const state = hud.getState();
  assert.equal(state.speed, 0);
  assert.equal(state.boost, 0);
  assert.equal(state.boostActive, false);
  assert.equal(state.currentLap, 1);
  assert.equal(state.totalLaps, 5);
  assert.equal(state.maxSpeed, 400);
  assert.equal(state.raceTime, 0);
  assert.equal(state.lapTime, 0);
  assert.equal(state.bestLap, null);
  assert.deepEqual(state.lapTimes, []);
  assert.equal(state.status, STATUS.IDLE);
  assert.deepEqual(state.messages, []);
});

test('setStatus rejects unknown values', () => {
  const hud = new HudState();
  assert.throws(() => hud.setStatus('flying'), /unknown status/);
});

test('intents emit without state changes', () => {
  const hud = new HudState();
  const intents = [];
  hud.on('intent:start', (m) => intents.push(['start', m]));
  hud.on('intent:restart', (m) => intents.push(['restart', m]));
  hud.on('intent:resume', () => intents.push(['resume']));
  hud.on('intent:pause', () => intents.push(['pause']));
  hud.requestStart({ reason: 'idle' });
  hud.requestRestart({ reason: 'finished' });
  hud.requestResume();
  hud.requestPause();
  assert.equal(intents.length, 4);
  assert.equal(intents[0][1].reason, 'idle');
});

test('change event aggregates updates', () => {
  const hud = new HudState();
  let changes = 0;
  hud.on('change', () => { changes++; });
  hud.setStatus(STATUS.RACING);
  hud.setSpeed(50);
  hud.setBoost(20);
  hud.tickTime(1000);
  assert.ok(changes >= 4);
});

test('setPosition updates and emits position:change', () => {
  const hud = new HudState();
  const positions = [];
  hud.on('position:change', (e) => positions.push(e));
  hud.setPosition(3, 8);
  hud.setPosition(3, 8); // no-op
  hud.setPosition(2);
  assert.equal(hud.getState().position, 2);
  assert.equal(hud.getState().totalRacers, 8);
  assert.equal(positions.length, 2);
});

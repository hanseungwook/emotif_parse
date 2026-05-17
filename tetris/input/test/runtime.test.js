'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Actions } = require('../actions');
const { InputController } = require('../inputController');
const { GameRuntime, STATES } = require('../runtime');
const { createMemoryKeyboardAdapter } = require('../keyboardAdapter');
const { createMockScheduler } = require('./mockScheduler');

function setup(opts) {
  const scheduler = createMockScheduler(0);
  const adapter = createMemoryKeyboardAdapter();
  const input = new InputController({ clock: scheduler.now });
  input.attach(adapter);
  const runtime = new GameRuntime(Object.assign({ scheduler, input }, opts || {}));
  return { scheduler, adapter, input, runtime };
}

test('runtime begins in idle state with no scheduled frame', () => {
  const { runtime, scheduler } = setup();
  assert.equal(runtime.state, STATES.Idle);
  assert.equal(scheduler.pendingCount(), 0);
});

test('start() transitions to running and schedules first frame', () => {
  const { runtime, scheduler } = setup();
  runtime.start();
  assert.equal(runtime.state, STATES.Running);
  assert.equal(scheduler.pendingCount(), 1);
});

test('ticks advance elapsedMs and frameCount', () => {
  const { runtime, scheduler } = setup();
  runtime.start();
  scheduler.tick(16);
  scheduler.tick(16);
  scheduler.tick(16);
  assert.equal(runtime.frameCount, 3);
  assert.equal(runtime.elapsedMs, 48);
});

test('ticker handlers receive (dt, elapsed, frameCount)', () => {
  const { runtime, scheduler } = setup();
  const events = [];
  runtime.onTick((dt, elapsed, frame) => events.push({ dt, elapsed, frame }));
  runtime.start();
  scheduler.tick(20);
  scheduler.tick(10);
  assert.deepEqual(events, [
    { dt: 20, elapsed: 20, frame: 1 },
    { dt: 10, elapsed: 30, frame: 2 },
  ]);
});

test('huge gaps between frames are clamped to MAX_FRAME_MS', () => {
  const { runtime, scheduler } = setup();
  const dts = [];
  runtime.onTick((dt) => dts.push(dt));
  runtime.start();
  scheduler.tick(5000); // tab was in background for 5 seconds
  assert.equal(dts[0], 100);
});

test('pause halts ticks and resume picks up at current time', () => {
  const { runtime, scheduler } = setup();
  const dts = [];
  runtime.onTick((dt) => dts.push(dt));
  runtime.start();
  scheduler.tick(16);
  runtime.pause();
  assert.equal(runtime.state, STATES.Paused);
  assert.equal(scheduler.pendingCount(), 0);
  scheduler.advance(2000); // time moves while paused
  runtime.resume();
  assert.equal(runtime.state, STATES.Running);
  // First post-resume tick should be ~0, not 2000.
  scheduler.tick(16);
  assert.equal(dts[dts.length - 1], 16);
});

test('togglePause flips running ↔ paused', () => {
  const { runtime } = setup();
  runtime.start();
  assert.equal(runtime.state, STATES.Running);
  runtime.togglePause();
  assert.equal(runtime.state, STATES.Paused);
  runtime.togglePause();
  assert.equal(runtime.state, STATES.Running);
});

test('togglePause from idle starts the game', () => {
  const { runtime } = setup();
  runtime.togglePause();
  assert.equal(runtime.state, STATES.Running);
});

test('endGame moves to game-over and cancels frames', () => {
  const { runtime, scheduler } = setup();
  runtime.start();
  runtime.endGame();
  assert.equal(runtime.state, STATES.GameOver);
  assert.equal(scheduler.pendingCount(), 0);
});

test('restart resets elapsed and frameCount and resumes running', () => {
  const { runtime, scheduler } = setup();
  runtime.start();
  scheduler.tick(50);
  scheduler.tick(50);
  assert.equal(runtime.elapsedMs, 100);
  runtime.restart();
  assert.equal(runtime.state, STATES.Running);
  assert.equal(runtime.elapsedMs, 0);
  assert.equal(runtime.frameCount, 0);
});

test('restart from game-over revives the loop', () => {
  const { runtime, scheduler } = setup();
  runtime.start();
  runtime.endGame();
  runtime.restart();
  scheduler.tick(16);
  assert.equal(runtime.state, STATES.Running);
  assert.equal(runtime.frameCount, 1);
});

test('state listeners receive (next, prev) transitions', () => {
  const { runtime } = setup();
  const transitions = [];
  runtime.onStateChange((next, prev) => transitions.push([prev, next]));
  runtime.start();
  runtime.pause();
  runtime.resume();
  runtime.endGame();
  assert.deepEqual(transitions, [
    [STATES.Idle, STATES.Running],
    [STATES.Running, STATES.Paused],
    [STATES.Paused, STATES.Running],
    [STATES.Running, STATES.GameOver],
  ]);
});

test('lifecycle listeners receive coarse events', () => {
  const { runtime } = setup();
  const events = [];
  runtime.onLifecycle((event) => events.push(event));
  runtime.start();
  runtime.pause();
  runtime.resume();
  runtime.restart();
  runtime.endGame();
  runtime.stop();
  assert.deepEqual(events, ['start', 'pause', 'resume', 'restart', 'game-over', 'stop']);
});

test('PauseToggle from input triggers togglePause when autoBindSystemActions is on', () => {
  const { runtime, adapter } = setup();
  runtime.start();
  adapter.keydown('KeyP', { timestamp: 0 });
  assert.equal(runtime.state, STATES.Paused);
  adapter.keydown('Escape', { timestamp: 1 });
  assert.equal(runtime.state, STATES.Running);
});

test('Restart from input triggers runtime restart', () => {
  const { runtime, adapter, scheduler } = setup();
  runtime.start();
  scheduler.tick(200);
  adapter.keydown('KeyR', { timestamp: 0 });
  assert.equal(runtime.state, STATES.Running);
  assert.equal(runtime.elapsedMs, 0);
  assert.equal(runtime.frameCount, 0);
});

test('autoBindSystemActions can be disabled', () => {
  const scheduler = createMockScheduler(0);
  const adapter = createMemoryKeyboardAdapter();
  const input = new InputController({ clock: scheduler.now });
  input.attach(adapter);
  const runtime = new GameRuntime({ scheduler, input, autoBindSystemActions: false });
  runtime.start();
  adapter.keydown('KeyP', { timestamp: 0 });
  assert.equal(runtime.state, STATES.Running);
});

test('input controller is paused/unpaused alongside the runtime', () => {
  const { runtime, input, adapter } = setup();
  runtime.start();
  runtime.pause();
  const log = [];
  input.on((a) => log.push(a));
  adapter.keydown('ArrowLeft', { timestamp: 0 });
  assert.equal(log.includes(Actions.MoveLeft), false);
  runtime.resume();
  adapter.keydown('Space', { timestamp: 100 });
  assert.equal(log.includes(Actions.HardDrop), true);
});

test('input.update is called once per frame', () => {
  const scheduler = createMockScheduler(0);
  const calls = [];
  const fakeInput = {
    on: () => () => {},
    setPaused: () => {},
    setEnabled: () => {},
    resyncHeldKeys: () => {},
    update: (t) => calls.push(t),
  };
  const runtime = new GameRuntime({ scheduler, input: fakeInput });
  runtime.start();
  scheduler.tick(16);
  scheduler.tick(16);
  assert.equal(calls.length, 2);
});

test('stop() cancels scheduled frames and returns to idle', () => {
  const { runtime, scheduler } = setup();
  runtime.start();
  scheduler.tick(16);
  runtime.stop();
  assert.equal(runtime.state, STATES.Idle);
  assert.equal(scheduler.pendingCount(), 0);
});

test('dispose tears down listeners and cancels frames', () => {
  const { runtime, scheduler } = setup();
  let tickCount = 0;
  runtime.onTick(() => tickCount++);
  runtime.start();
  scheduler.tick(16);
  assert.equal(tickCount, 1);
  runtime.dispose();
  scheduler.tick(16); // already drained; nothing should fire
  assert.equal(tickCount, 1);
});

test('starting an already-running runtime is a no-op', () => {
  const { runtime, scheduler } = setup();
  runtime.start();
  const pending = scheduler.pendingCount();
  runtime.start();
  assert.equal(scheduler.pendingCount(), pending);
});

test('pausing while idle does nothing', () => {
  const { runtime } = setup();
  runtime.pause();
  assert.equal(runtime.state, STATES.Idle);
});

test('frame fired after pause is a no-op', () => {
  const { runtime, scheduler } = setup();
  let count = 0;
  runtime.onTick(() => count++);
  runtime.start();
  // Manually mark paused, then flush the in-flight frame.
  runtime.pause();
  scheduler.flush();
  assert.equal(count, 0);
});

test('held keys resync on resume so DAS does not avalanche', () => {
  const { runtime, scheduler, adapter, input } = setup();
  const log = [];
  input.on((a, meta) => log.push({ a, source: meta.source }));
  // Use guideline-ish timing.
  input.timing.das = 100;
  input.timing.arr = 50;
  runtime.start();
  adapter.keydown('ArrowLeft', { timestamp: 0 });
  scheduler.tick(16); // first frame, no repeats yet
  const baseline = log.length;
  runtime.pause();
  scheduler.advance(2000); // wall time during pause
  runtime.resume();
  // Right after resume we should not have a flood of catch-up repeats.
  assert.equal(log.length, baseline);
  scheduler.tick(50); // still inside the fresh DAS window
  assert.equal(log.length, baseline);
  scheduler.tick(80); // past 100ms DAS — one repeat expected
  assert.ok(log.length >= baseline + 1);
});

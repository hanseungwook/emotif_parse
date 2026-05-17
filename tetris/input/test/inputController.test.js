'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Actions } = require('../actions');
const { InputController } = require('../inputController');
const { createMemoryKeyboardAdapter } = require('../keyboardAdapter');

function setup(opts) {
  const log = [];
  const adapter = createMemoryKeyboardAdapter();
  const controller = new InputController(Object.assign({ clock: () => 0 }, opts || {}));
  controller.attach(adapter);
  const unsub = controller.on((action, meta) => log.push({ action, source: meta.source }));
  return { controller, adapter, log, unsub };
}

test('press fires an action exactly once', () => {
  const { adapter, log } = setup();
  adapter.keydown('ArrowLeft', { timestamp: 0 });
  assert.deepEqual(log, [{ action: Actions.MoveLeft, source: 'press' }]);
});

test('unbound keys do not fire actions', () => {
  const { adapter, log } = setup();
  adapter.keydown('KeyQ', { timestamp: 0 });
  assert.deepEqual(log, []);
});

test('browser auto-repeat is ignored — DAS/ARR drive repeats instead', () => {
  const { adapter, log } = setup();
  adapter.keydown('ArrowLeft', { timestamp: 0, repeat: true });
  assert.deepEqual(log, []);
});

test('holding a key without ticking does not auto-repeat', () => {
  const { adapter, log } = setup();
  adapter.keydown('ArrowLeft', { timestamp: 0 });
  // No update() call → no repeats, even after a release.
  adapter.keyup('ArrowLeft', { timestamp: 500 });
  assert.equal(log.length, 1);
});

test('DAS gates the first auto-repeat', () => {
  const { controller, adapter, log } = setup({ timing: { das: 100, arr: 50, sdr: 30 } });
  adapter.keydown('ArrowRight', { timestamp: 0 });
  controller.update(50); // before DAS
  assert.equal(log.length, 1); // only the initial press
  controller.update(100); // exactly at DAS
  assert.equal(log.length, 2);
  controller.update(150);
  assert.equal(log.length, 3);
});

test('ARR fires multiple repeats when ticks are coarse', () => {
  const { controller, adapter, log } = setup({ timing: { das: 100, arr: 50, sdr: 30 } });
  adapter.keydown('ArrowRight', { timestamp: 0 });
  // One big tick at t=350 -> should fire repeats at 100, 150, 200, 250, 300, 350.
  controller.update(350);
  const repeats = log.filter((e) => e.source === 'auto-repeat');
  assert.equal(repeats.length, 6);
});

test('ARR=0 means one repeat per tick (instant shift)', () => {
  const { controller, adapter, log } = setup({ timing: { das: 100, arr: 0, sdr: 30 } });
  adapter.keydown('ArrowLeft', { timestamp: 0 });
  controller.update(50); // before DAS — nothing
  controller.update(150);
  controller.update(160);
  controller.update(170);
  const repeats = log.filter((e) => e.source === 'auto-repeat');
  assert.equal(repeats.length, 3);
});

test('soft drop has no DAS — it repeats immediately at SDR', () => {
  const { controller, adapter, log } = setup({ timing: { das: 100, arr: 50, sdr: 25 } });
  adapter.keydown('ArrowDown', { timestamp: 0 });
  controller.update(25);
  controller.update(50);
  controller.update(75);
  const repeats = log.filter((e) => e.source === 'auto-repeat');
  assert.equal(repeats.length, 3);
});

test('hard drop only fires once per press', () => {
  const { controller, adapter, log } = setup();
  adapter.keydown('Space', { timestamp: 0 });
  controller.update(500); // even after a long hold
  controller.update(1000);
  const hardDrops = log.filter((e) => e.action === Actions.HardDrop);
  assert.equal(hardDrops.length, 1);
});

test('rotation only fires once per press (no auto-repeat)', () => {
  const { controller, adapter, log } = setup();
  adapter.keydown('KeyX', { timestamp: 0 });
  controller.update(500);
  controller.update(1000);
  const rotations = log.filter((e) => e.action === Actions.RotateCW);
  assert.equal(rotations.length, 1);
});

test('release stops auto-repeat', () => {
  const { controller, adapter, log } = setup({ timing: { das: 100, arr: 50, sdr: 30 } });
  adapter.keydown('ArrowRight', { timestamp: 0 });
  controller.update(200); // some repeats
  const beforeRelease = log.length;
  adapter.keyup('ArrowRight', { timestamp: 200 });
  controller.update(500);
  controller.update(1000);
  assert.equal(log.length, beforeRelease);
});

test('pause suppresses gameplay actions but allows pause/restart', () => {
  const { controller, adapter, log } = setup();
  controller.setPaused(true);
  adapter.keydown('ArrowLeft', { timestamp: 0 });
  adapter.keydown('Space', { timestamp: 0 });
  assert.deepEqual(log, []);
  adapter.keydown('KeyP', { timestamp: 0 });
  assert.deepEqual(log, [{ action: Actions.PauseToggle, source: 'press' }]);
  adapter.keydown('KeyR', { timestamp: 0 });
  assert.equal(log[log.length - 1].action, Actions.Restart);
});

test('pause also stops auto-repeat from firing on update', () => {
  const { controller, adapter, log } = setup({ timing: { das: 50, arr: 25, sdr: 25 } });
  adapter.keydown('ArrowLeft', { timestamp: 0 });
  controller.update(100); // would normally fire repeats
  const before = log.length;
  controller.setPaused(true);
  controller.update(500);
  assert.equal(log.length, before);
});

test('disabling clears held keys and silences all input', () => {
  const { controller, adapter, log } = setup();
  adapter.keydown('ArrowLeft', { timestamp: 0 });
  controller.setEnabled(false);
  adapter.keydown('Space', { timestamp: 10 });
  controller.update(200);
  assert.equal(log.filter((e) => e.action !== Actions.MoveLeft).length, 0);
});

test('re-pressing a key that is already held is ignored', () => {
  const { adapter, log } = setup();
  adapter.keydown('ArrowLeft', { timestamp: 0 });
  adapter.keydown('ArrowLeft', { timestamp: 10 });
  assert.equal(log.filter((e) => e.action === Actions.MoveLeft).length, 1);
});

test('two different keys that map to the same action both fire', () => {
  const { adapter, log } = setup();
  adapter.keydown('ArrowUp', { timestamp: 0 });   // RotateCW
  adapter.keydown('KeyX', { timestamp: 1 });       // also RotateCW
  const rotations = log.filter((e) => e.action === Actions.RotateCW);
  assert.equal(rotations.length, 2);
});

test('unsubscribe stops further deliveries', () => {
  const { adapter, log, unsub } = setup();
  unsub();
  adapter.keydown('ArrowLeft', { timestamp: 0 });
  assert.deepEqual(log, []);
});

test('on() requires a function', () => {
  const c = new InputController();
  assert.throws(() => c.on(null), /handler must be a function/);
});

test('attach() twice throws', () => {
  const c = new InputController();
  c.attach(createMemoryKeyboardAdapter());
  assert.throws(() => c.attach(createMemoryKeyboardAdapter()), /already attached/);
});

test('detach() lets us reattach a new adapter', () => {
  const c = new InputController();
  c.attach(createMemoryKeyboardAdapter());
  c.detach();
  const adapter = createMemoryKeyboardAdapter();
  c.attach(adapter);
  let received = null;
  c.on((action) => { received = action; });
  adapter.keydown('Space', { timestamp: 0 });
  assert.equal(received, Actions.HardDrop);
});

test('custom keymap overrides take effect', () => {
  const log = [];
  const adapter = createMemoryKeyboardAdapter();
  const c = new InputController({ keymap: { KeyW: Actions.RotateCW, ArrowUp: null } });
  c.attach(adapter);
  c.on((a) => log.push(a));
  adapter.keydown('KeyW', { timestamp: 0 });
  adapter.keydown('ArrowUp', { timestamp: 1 });
  assert.deepEqual(log, [Actions.RotateCW]);
});

test('hold cooldown suppresses spammed hold presses', () => {
  const log = [];
  const adapter = createMemoryKeyboardAdapter();
  const c = new InputController({ timing: { holdCooldownMs: 500 }, clock: () => 0 });
  c.attach(adapter);
  c.on((a) => log.push(a));
  adapter.keydown('KeyC', { timestamp: 0 });
  adapter.keyup('KeyC', { timestamp: 10 });
  adapter.keydown('KeyC', { timestamp: 100 }); // within cooldown
  adapter.keyup('KeyC', { timestamp: 110 });
  adapter.keydown('KeyC', { timestamp: 600 }); // past cooldown
  assert.deepEqual(log, [Actions.Hold, Actions.Hold]);
});

test('resyncHeldKeys restarts DAS from the new anchor', () => {
  const { controller, adapter, log } = setup({ timing: { das: 100, arr: 50, sdr: 30 } });
  adapter.keydown('ArrowLeft', { timestamp: 0 });
  controller.update(150); // would normally trigger a repeat
  const before = log.length;
  controller.resyncHeldKeys(200);
  controller.update(250); // 50ms after the new anchor -> still inside DAS
  assert.equal(log.length, before);
  controller.update(310); // 110ms after the new anchor -> past DAS, one repeat
  assert.equal(log.length, before + 1);
});

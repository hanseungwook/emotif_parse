'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Actions } = require('../actions');
const { defaultKeymap, createKeymap, keysForAction } = require('../keymap');

test('default keymap binds the standard arcade controls', () => {
  assert.equal(defaultKeymap.ArrowLeft, Actions.MoveLeft);
  assert.equal(defaultKeymap.ArrowRight, Actions.MoveRight);
  assert.equal(defaultKeymap.ArrowDown, Actions.SoftDrop);
  assert.equal(defaultKeymap.Space, Actions.HardDrop);
  assert.equal(defaultKeymap.KeyZ, Actions.RotateCCW);
  assert.equal(defaultKeymap.KeyX, Actions.RotateCW);
  assert.equal(defaultKeymap.KeyP, Actions.PauseToggle);
  assert.equal(defaultKeymap.Escape, Actions.PauseToggle);
  assert.equal(defaultKeymap.KeyR, Actions.Restart);
  assert.equal(defaultKeymap.ShiftLeft, Actions.Hold);
});

test('default keymap is frozen', () => {
  assert.throws(() => { defaultKeymap.ArrowLeft = Actions.HardDrop; }, /./);
});

test('createKeymap returns a mutable copy of defaults when no overrides', () => {
  const map = createKeymap();
  assert.equal(map.ArrowLeft, Actions.MoveLeft);
  map.ArrowLeft = Actions.HardDrop;
  assert.equal(map.ArrowLeft, Actions.HardDrop);
  // The default keymap is untouched.
  assert.equal(defaultKeymap.ArrowLeft, Actions.MoveLeft);
});

test('createKeymap merges overrides', () => {
  const map = createKeymap({ KeyW: Actions.RotateCW });
  assert.equal(map.KeyW, Actions.RotateCW);
  assert.equal(map.ArrowLeft, Actions.MoveLeft); // defaults preserved
});

test('createKeymap removes bindings when override is null', () => {
  const map = createKeymap({ Escape: null });
  assert.equal(map.Escape, undefined);
});

test('keysForAction returns every code bound to an action', () => {
  const map = createKeymap();
  const rotateCw = keysForAction(map, Actions.RotateCW);
  assert.ok(rotateCw.includes('ArrowUp'));
  assert.ok(rotateCw.includes('KeyX'));
  const hold = keysForAction(map, Actions.Hold);
  assert.ok(hold.includes('ShiftLeft'));
  assert.ok(hold.includes('ShiftRight'));
  assert.ok(hold.includes('KeyC'));
});

test('keysForAction returns empty array when nothing is bound', () => {
  const map = createKeymap({ ArrowLeft: null });
  // Other things may still map to MoveLeft if defaults included them.
  const left = keysForAction(map, Actions.MoveLeft);
  assert.deepEqual(left, []);
});

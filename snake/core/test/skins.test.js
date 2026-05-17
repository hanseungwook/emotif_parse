'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { listSkins, getSkin, hasSkin, DEFAULT_SKIN_ID, SKINS } = require('../skins');

test('the four built-in skins are registered', () => {
  const ids = listSkins().map((s) => s.id).sort();
  assert.deepEqual(ids, ['classic', 'ember', 'neon', 'shadow']);
});

test('getSkin falls back to default for unknown ids', () => {
  const skin = getSkin('does-not-exist');
  assert.equal(skin.id, DEFAULT_SKIN_ID);
});

test('hasSkin returns true for built-in ids', () => {
  assert.ok(hasSkin('classic'));
  assert.ok(hasSkin('neon'));
  assert.ok(!hasSkin('bogus'));
});

test('skin entries are frozen so they cannot be mutated', () => {
  assert.ok(Object.isFrozen(SKINS.classic));
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SkinCatalog, BUILTIN_SKINS, DEFAULT_SKIN_ID } = require('../skinCatalog');
const { SkinLoadError } = require('../errors');

test('builtin skins include the default unlocked skin', () => {
  const def = BUILTIN_SKINS.find((s) => s.id === DEFAULT_SKIN_ID);
  assert.ok(def, 'default skin is in BUILTIN_SKINS');
  assert.equal(def.unlocked, true);
});

test('list() returns all builtin skins', () => {
  const cat = new SkinCatalog();
  const list = cat.list();
  assert.ok(list.length >= BUILTIN_SKINS.length);
  for (const builtin of BUILTIN_SKINS) {
    assert.ok(cat.has(builtin.id));
  }
});

test('selectedId falls back to default when none selected', () => {
  const cat = new SkinCatalog();
  assert.equal(cat.selectedId, DEFAULT_SKIN_ID);
  assert.equal(cat.getSelected().id, DEFAULT_SKIN_ID);
});

test('select() throws for locked or unknown skins', () => {
  const cat = new SkinCatalog();
  assert.throws(() => cat.select('does-not-exist'), SkinLoadError);
  assert.throws(() => cat.select('sunset'), SkinLoadError);
});

test('unlock() flips the unlocked flag and allows selection', () => {
  const cat = new SkinCatalog();
  cat.unlock('sunset');
  const selected = cat.select('sunset');
  assert.equal(selected.id, 'sunset');
  assert.equal(selected.unlocked, true);
});

test('load() adds custom skins via async loader', async () => {
  const cat = new SkinCatalog();
  const added = await cat.load(() => [
    { id: 'neon', name: 'Neon', head: '#0ff', body: '#0aa', accent: '#055', unlocked: true },
  ]);
  assert.equal(added.length, 1);
  assert.equal(cat.has('neon'), true);
  assert.equal(cat.select('neon').name, 'Neon');
});

test('load() wraps async failures as SkinLoadError', async () => {
  const cat = new SkinCatalog();
  await assert.rejects(
    cat.load(() => Promise.reject(new Error('network'))),
    (err) => err instanceof SkinLoadError && /network/.test(err.message)
  );
});

test('load() rejects non-array results', async () => {
  const cat = new SkinCatalog();
  await assert.rejects(cat.load(() => ({ id: 'x' })), SkinLoadError);
});

test('seed option pre-registers custom skins', () => {
  const cat = new SkinCatalog({
    seed: [{ id: 'forest', head: '#2f6', body: '#063', accent: '#031' }],
  });
  assert.equal(cat.has('forest'), true);
  assert.equal(cat.get('forest').unlocked, true);
});

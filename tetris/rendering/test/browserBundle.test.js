'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { buildBrowserBundle } = require('../browserBundle');

function evalBundle() {
  const bundle = buildBrowserBundle();
  // Strip the ESM export statements so the body is plain script.
  const script = bundle
    .replace(/^export default[\s\S]*?;\s*$/m, '')
    .replace(/^export const \{[\s\S]*?\} = __tetrisRenderingPublic;\s*$/m, '');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(script + '\nglobalThis.__publicApi = __tetrisRenderingPublic;', sandbox);
  return sandbox.__publicApi;
}

test('browser bundle generates a parseable script with the public API', () => {
  const api = evalBundle();
  assert.equal(typeof api.createPlayfieldRenderer, 'function');
  assert.equal(typeof api.PlayfieldRenderer, 'function');
  assert.equal(typeof api.EffectTimeline, 'function');
  assert.equal(api.STATES.PLAYING, 'playing');
  assert.equal(api.EFFECTS.LINE_CLEAR, 'line-clear');
  assert.equal(Array.from(api.TETROMINO_TYPES).sort().join(','), 'I,J,L,O,S,T,Z');
});

test('browser bundle output declares all expected exports', () => {
  const bundle = buildBrowserBundle();
  for (const name of ['createPlayfieldRenderer', 'EffectTimeline', 'STATES', 'EFFECTS', 'normalizeGeometry']) {
    assert.ok(bundle.indexOf(name) >= 0, 'expected export ' + name + ' in bundle');
  }
});

test('browser bundle includes every source module marker', () => {
  const bundle = buildBrowserBundle();
  const expected = ['constants', 'palette', 'geometry', 'drawBlock', 'effects', 'playfieldRenderer', 'index'];
  for (const key of expected) {
    assert.ok(bundle.indexOf('=== module: ' + key + ' ===') >= 0, 'missing module marker ' + key);
  }
});

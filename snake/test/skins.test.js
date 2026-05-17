'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createSkin,
  isSkinUnlocked,
  SKIN_PATTERNS,
  EYE_STYLES,
  SKIN_RARITY,
  UNLOCK_KIND,
} = require('../skins');
const { ValidationError } = require('../errors');

test('createSkin requires id, name, colors', () => {
  assert.throws(() => createSkin({}), ValidationError);
  assert.throws(() => createSkin({ id: 'a' }), ValidationError);
  assert.throws(
    () => createSkin({ id: 'a', name: 'A', primaryColor: 'not-a-color' }),
    ValidationError
  );
});

test('createSkin fills in defaults', () => {
  const skin = createSkin({ id: 's1', name: 'Test', primaryColor: '#abcdef' });
  assert.equal(skin.pattern, SKIN_PATTERNS.SOLID);
  assert.equal(skin.eyeStyle, EYE_STYLES.ROUND);
  assert.equal(skin.rarity, SKIN_RARITY.COMMON);
  assert.equal(skin.unlock.kind, UNLOCK_KIND.DEFAULT);
  assert.equal(skin.secondaryColor, '#abcdef');
});

test('createSkin accepts 3-digit hex colors', () => {
  const skin = createSkin({ id: 's2', name: 'Short', primaryColor: '#abc' });
  assert.equal(skin.primaryColor, '#abc');
});

test('unlock validation rejects malformed unlock', () => {
  assert.throws(
    () =>
      createSkin({
        id: 's',
        name: 'S',
        primaryColor: '#000',
        unlock: { kind: UNLOCK_KIND.SCORE, score: -1 },
      }),
    ValidationError
  );
});

test('isSkinUnlocked DEFAULT skin is always unlocked', () => {
  const skin = createSkin({ id: 'd', name: 'D', primaryColor: '#000' });
  assert.equal(isSkinUnlocked(skin, null), true);
});

test('isSkinUnlocked SCORE compares against best score', () => {
  const skin = createSkin({
    id: 'high',
    name: 'High',
    primaryColor: '#000',
    unlock: { kind: UNLOCK_KIND.SCORE, score: 100 },
  });
  assert.equal(isSkinUnlocked(skin, { bestScore: 50 }), false);
  assert.equal(isSkinUnlocked(skin, { bestScore: 100 }), true);
});

test('isSkinUnlocked SCORE with mode uses bestScoresByMode', () => {
  const skin = createSkin({
    id: 'mode',
    name: 'Mode',
    primaryColor: '#000',
    unlock: { kind: UNLOCK_KIND.SCORE, score: 100, mode: 'obstacle' },
  });
  assert.equal(isSkinUnlocked(skin, { bestScore: 999 }), false);
  assert.equal(
    isSkinUnlocked(skin, { bestScoresByMode: { obstacle: 200 } }),
    true
  );
});

test('isSkinUnlocked OBSTACLE_CLEAR counts clears', () => {
  const skin = createSkin({
    id: 'clear',
    name: 'Clear',
    primaryColor: '#000',
    unlock: { kind: UNLOCK_KIND.OBSTACLE_CLEAR, clears: 3 },
  });
  assert.equal(isSkinUnlocked(skin, { obstacleClears: 2 }), false);
  assert.equal(isSkinUnlocked(skin, { obstacleClears: 3 }), true);
});

test('isSkinUnlocked PURCHASE checks ownership list', () => {
  const skin = createSkin({
    id: 'paid',
    name: 'Paid',
    primaryColor: '#000',
    unlock: { kind: UNLOCK_KIND.PURCHASE, price: 100 },
  });
  assert.equal(isSkinUnlocked(skin, { purchasedSkinIds: ['other'] }), false);
  assert.equal(isSkinUnlocked(skin, { purchasedSkinIds: ['paid'] }), true);
});

test('skin is frozen', () => {
  const skin = createSkin({ id: 'f', name: 'F', primaryColor: '#000' });
  assert.throws(() => {
    skin.name = 'mutated';
  });
});

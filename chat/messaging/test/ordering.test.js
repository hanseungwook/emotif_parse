'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  compareMessages,
  findInsertIndex,
  insertSorted,
  detectGaps,
} = require('../ordering');

test('orders by sequence ascending', () => {
  const a = { clientId: 'a', sequence: 1, createdAt: 100 };
  const b = { clientId: 'b', sequence: 2, createdAt: 50 };
  assert.equal(compareMessages(a, b) < 0, true);
});

test('messages without sequence sort after delivered messages', () => {
  const delivered = { clientId: 'a', sequence: 10, createdAt: 100 };
  const pending = { clientId: 'b', createdAt: 200 };
  assert.equal(compareMessages(delivered, pending) < 0, true);
  assert.equal(compareMessages(pending, delivered) > 0, true);
});

test('messages without sequence tie-break by createdAt', () => {
  const earlier = { clientId: 'a', createdAt: 100 };
  const later = { clientId: 'b', createdAt: 200 };
  assert.equal(compareMessages(earlier, later) < 0, true);
});

test('tie-breaks deterministically by clientId', () => {
  const a = { clientId: 'a', createdAt: 100 };
  const b = { clientId: 'b', createdAt: 100 };
  assert.equal(compareMessages(a, b) < 0, true);
  assert.equal(compareMessages(b, a) > 0, true);
  assert.equal(compareMessages(a, a), 0);
});

test('insertSorted keeps the array sorted', () => {
  const list = [];
  insertSorted(list, { clientId: 'b', sequence: 2, createdAt: 100 });
  insertSorted(list, { clientId: 'a', sequence: 1, createdAt: 100 });
  insertSorted(list, { clientId: 'c', sequence: 3, createdAt: 100 });
  insertSorted(list, { clientId: 'p', createdAt: 999 });
  insertSorted(list, { clientId: 'd', sequence: 4, createdAt: 100 });

  const order = list.map((m) => m.clientId);
  assert.deepEqual(order, ['a', 'b', 'c', 'd', 'p']);
});

test('findInsertIndex respects strict ordering', () => {
  const list = [
    { clientId: 'a', sequence: 1, createdAt: 100 },
    { clientId: 'b', sequence: 3, createdAt: 100 },
  ];
  const idx = findInsertIndex(list, { clientId: 'm', sequence: 2, createdAt: 100 });
  assert.equal(idx, 1);
});

test('detectGaps returns missing sequence ranges', () => {
  const list = [
    { clientId: 'a', sequence: 1, createdAt: 1 },
    { clientId: 'b', sequence: 2, createdAt: 2 },
    { clientId: 'c', sequence: 5, createdAt: 5 },
    { clientId: 'd', sequence: 6, createdAt: 6 },
    { clientId: 'e', sequence: 9, createdAt: 9 },
  ];
  assert.deepEqual(detectGaps(list), [
    { from: 3, to: 4 },
    { from: 7, to: 8 },
  ]);
});

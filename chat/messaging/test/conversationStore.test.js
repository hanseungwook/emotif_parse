'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ConversationStore, MESSAGE_STATUS } = require('../conversationStore');

function captureEvents(store, names) {
  const events = [];
  for (const name of names) {
    store.on(name, (evt) => events.push({ name, evt }));
  }
  return events;
}

test('upsertConversation stores a conversation and emits event', () => {
  const store = new ConversationStore();
  const events = captureEvents(store, ['conversation:upsert']);
  store.upsertConversation({ id: 'c1', title: 'General', participants: ['u1', 'u2'] });
  assert.equal(events.length, 1);
  const conv = store.getConversation('c1');
  assert.equal(conv.title, 'General');
  assert.deepEqual(conv.participants, ['u1', 'u2']);
});

test('insertMessage adds and orders messages', () => {
  const store = new ConversationStore();
  const events = captureEvents(store, ['message:insert']);
  store.insertMessage({ conversationId: 'c1', clientId: 'b', sequence: 2, body: 'two', createdAt: 200 });
  store.insertMessage({ conversationId: 'c1', clientId: 'a', sequence: 1, body: 'one', createdAt: 100 });
  store.insertMessage({ conversationId: 'c1', clientId: 'p', body: 'pending', createdAt: 999 });
  const messages = store.getMessages('c1');
  assert.deepEqual(messages.map((m) => m.clientId), ['a', 'b', 'p']);
  assert.equal(events.length, 3);
});

test('insertMessage dedupes by clientId and merges fields', () => {
  const store = new ConversationStore();
  store.insertMessage({ conversationId: 'c1', clientId: 'x', body: 'hi', createdAt: 50, status: 'pending' });
  store.insertMessage({ conversationId: 'c1', clientId: 'x', id: 'srv1', sequence: 1, status: 'delivered' });
  const list = store.getMessages('c1');
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'srv1');
  assert.equal(list[0].status, 'delivered');
  assert.equal(list[0].body, 'hi');
});

test('insertMessage dedupes by server id', () => {
  const store = new ConversationStore();
  store.insertMessage({ conversationId: 'c1', id: 'srv1', body: 'a', createdAt: 1, sequence: 1 });
  store.insertMessage({ conversationId: 'c1', id: 'srv1', body: 'a-edited', createdAt: 1, sequence: 1 });
  const list = store.getMessages('c1');
  assert.equal(list.length, 1);
  assert.equal(list[0].body, 'a-edited');
});

test('reconcileMessage repositions reorders if sequence changes order', () => {
  const store = new ConversationStore();
  const events = captureEvents(store, ['message:reorder', 'message:update']);
  store.insertMessage({ conversationId: 'c1', clientId: 'p', body: 'pending', createdAt: 200, status: 'pending' });
  store.insertMessage({ conversationId: 'c1', clientId: 'd', body: 'delivered', sequence: 10, createdAt: 50, status: 'delivered' });

  const ordered = store.getMessages('c1').map((m) => m.clientId);
  assert.deepEqual(ordered, ['d', 'p']);

  store.reconcileMessage('c1', 'p', { id: 'srv-p', sequence: 5, status: 'delivered' });

  const afterReorder = store.getMessages('c1').map((m) => m.clientId);
  assert.deepEqual(afterReorder, ['p', 'd']);

  const reorderEvents = events.filter((e) => e.name === 'message:reorder');
  assert.equal(reorderEvents.length, 1);
});

test('markMessageStatus mutates status and emits update', () => {
  const store = new ConversationStore();
  const events = captureEvents(store, ['message:update']);
  store.insertMessage({ conversationId: 'c1', clientId: 'x', body: 'hi', createdAt: 1 });
  const result = store.markMessageStatus('c1', 'x', MESSAGE_STATUS.FAILED, { lastError: { message: 'oops' } });
  assert.equal(result.status, MESSAGE_STATUS.FAILED);
  assert.equal(result.lastError.message, 'oops');
  assert.equal(events.length, 1);
});

test('removeMessage drops a message and emits remove', () => {
  const store = new ConversationStore();
  const events = captureEvents(store, ['message:remove']);
  store.insertMessage({ conversationId: 'c1', clientId: 'x', body: 'hi', createdAt: 1 });
  assert.equal(store.removeMessage('c1', 'x'), true);
  assert.equal(store.getMessages('c1').length, 0);
  assert.equal(events.length, 1);
});

test('reconcile inserts a new message if clientId is unknown', () => {
  const store = new ConversationStore();
  const result = store.reconcileMessage('c1', 'unknown', { id: 'srv', sequence: 1, body: 'hi', createdAt: 5 });
  assert.equal(result.clientId, 'unknown');
  assert.equal(result.id, 'srv');
  assert.equal(store.getMessages('c1').length, 1);
});

test('lastMessageAt advances with inserts', () => {
  const store = new ConversationStore();
  store.insertMessage({ conversationId: 'c1', clientId: 'a', body: 'first', createdAt: 1000 });
  store.insertMessage({ conversationId: 'c1', clientId: 'b', body: 'second', createdAt: 2000 });
  const conv = store.getConversation('c1');
  assert.equal(conv.lastMessageAt, 2000);
});

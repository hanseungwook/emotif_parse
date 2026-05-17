'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ConversationStore, MESSAGE_STATUS } = require('../conversationStore');
const { MessageRenderer } = require('../messageRenderer');
const { createMockContainer } = require('./mockDom');

function setup() {
  const { document, container } = createMockContainer();
  const store = new ConversationStore();
  const renderer = new MessageRenderer({
    store,
    conversationId: 'c1',
    container,
    document,
    currentUserId: 'me',
  });
  renderer.mount();
  return { renderer, store, container, document };
}

test('renders empty state when no messages', () => {
  const { container } = setup();
  assert.equal(container.childNodes.length, 1);
  assert.equal(container.firstChild.className, 'msg-empty');
});

test('renders inserted message and removes empty state', () => {
  const { container, store } = setup();
  store.insertMessage({
    conversationId: 'c1',
    clientId: 'a',
    body: 'hello',
    authorId: 'me',
    createdAt: Date.UTC(2026, 4, 17, 9, 30),
    status: MESSAGE_STATUS.DELIVERED,
    sequence: 1,
  });
  assert.equal(container.childNodes.length, 1);
  const node = container.firstChild;
  assert.equal(node.getAttribute('data-client-id'), 'a');
  assert.equal(node.className, 'msg msg--own msg--delivered');
  const body = node.childNodes[1];
  assert.equal(body.textContent, 'hello');
});

test('updates DOM when a message status changes', () => {
  const { container, store } = setup();
  store.insertMessage({
    conversationId: 'c1',
    clientId: 'p',
    body: 'pending',
    authorId: 'me',
    createdAt: Date.UTC(2026, 4, 17, 9, 30),
    status: MESSAGE_STATUS.PENDING,
  });
  const node = container.firstChild;
  assert.ok(node.className.includes('msg--pending'));

  store.reconcileMessage('c1', 'p', { id: 'srv-p', sequence: 7, status: MESSAGE_STATUS.DELIVERED });
  assert.ok(node.className.includes('msg--delivered'));
  assert.ok(!node.className.includes('msg--pending'));
  assert.equal(node.getAttribute('data-server-id'), 'srv-p');
});

test('inserts at correct position when ordering shifts', () => {
  const { container, store } = setup();
  store.insertMessage({
    conversationId: 'c1', clientId: 'p', body: 'pending', authorId: 'me',
    createdAt: 2000, status: MESSAGE_STATUS.PENDING,
  });
  store.insertMessage({
    conversationId: 'c1', clientId: 'd', body: 'delivered', authorId: 'other',
    createdAt: 1000, sequence: 1, status: MESSAGE_STATUS.DELIVERED,
  });
  assert.equal(container.childNodes.length, 2);
  assert.equal(container.childNodes[0].getAttribute('data-client-id'), 'd');
  assert.equal(container.childNodes[1].getAttribute('data-client-id'), 'p');

  store.reconcileMessage('c1', 'p', { id: 'srv-p', sequence: 0, status: MESSAGE_STATUS.DELIVERED });
  assert.equal(container.childNodes[0].getAttribute('data-client-id'), 'p');
  assert.equal(container.childNodes[1].getAttribute('data-client-id'), 'd');
});

test('removes a message from the DOM and restores empty state', () => {
  const { container, store } = setup();
  store.insertMessage({ conversationId: 'c1', clientId: 'x', body: 'hi', authorId: 'me', createdAt: 1 });
  assert.equal(container.childNodes.length, 1);
  store.removeMessage('c1', 'x');
  assert.equal(container.childNodes.length, 1);
  assert.equal(container.firstChild.className, 'msg-empty');
});

test('unmount detaches listeners and clears DOM', () => {
  const { renderer, container, store } = setup();
  store.insertMessage({ conversationId: 'c1', clientId: 'x', body: 'hi', authorId: 'me', createdAt: 1 });
  renderer.unmount();
  assert.equal(container.childNodes.length, 0);
  store.insertMessage({ conversationId: 'c1', clientId: 'y', body: 'after-unmount', authorId: 'me', createdAt: 2 });
  assert.equal(container.childNodes.length, 0);
});

test('autoScroll updates scrollTop to scrollHeight', () => {
  const { container, store } = setup();
  store.insertMessage({ conversationId: 'c1', clientId: 'x', body: 'hi', authorId: 'me', createdAt: 1 });
  store.insertMessage({ conversationId: 'c1', clientId: 'y', body: 'hi again', authorId: 'me', createdAt: 2 });
  assert.equal(container.scrollTop, container.scrollHeight);
});

test('ignores events for other conversations', () => {
  const { container, store } = setup();
  store.insertMessage({ conversationId: 'other', clientId: 'x', body: 'hi', authorId: 'me', createdAt: 1 });
  assert.equal(container.childNodes.length, 1);
  assert.equal(container.firstChild.className, 'msg-empty');
});

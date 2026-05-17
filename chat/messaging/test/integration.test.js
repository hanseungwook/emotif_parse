'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createMessagingRuntime,
  MessageRenderer,
  InMemoryBroker,
  createBrokerTransportFactory,
  MESSAGE_STATUS,
} = require('..');
const { createMockContainer } = require('./mockDom');

async function flush() {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setImmediate(r));
  }
}

test('two clients exchange messages with live DOM rendering', async () => {
  const broker = new InMemoryBroker();
  const transportFactory = createBrokerTransportFactory(broker);

  const alice = createMessagingRuntime({
    transportFactory,
    currentUser: { id: 'alice' },
    retry: { enabled: false },
    reconnect: { enabled: false },
  });
  const bob = createMessagingRuntime({
    transportFactory,
    currentUser: { id: 'bob' },
    retry: { enabled: false },
    reconnect: { enabled: false },
  });

  alice.start();
  bob.start();
  await flush();

  alice.openConversation('lobby');
  bob.openConversation('lobby');
  await flush();

  const aliceUi = createMockContainer();
  const bobUi = createMockContainer();
  const aliceRenderer = new MessageRenderer({
    store: alice.store,
    container: aliceUi.container,
    document: aliceUi.document,
    conversationId: 'lobby',
    currentUserId: 'alice',
  });
  const bobRenderer = new MessageRenderer({
    store: bob.store,
    container: bobUi.container,
    document: bobUi.document,
    conversationId: 'lobby',
    currentUserId: 'bob',
  });
  aliceRenderer.mount();
  bobRenderer.mount();

  const composer = alice.composer('lobby');
  composer.setBody('hi bob');
  const sentPromise = composer.send();
  assert.equal(aliceUi.container.childNodes.length, 1);
  assert.ok(aliceUi.container.firstChild.className.includes('msg--pending'));

  await sentPromise;
  await flush();
  await flush();

  assert.equal(aliceUi.container.childNodes.length, 1);
  assert.ok(aliceUi.container.firstChild.className.includes('msg--delivered'));
  assert.equal(aliceUi.container.firstChild.childNodes[1].textContent, 'hi bob');

  assert.equal(bobUi.container.childNodes.length, 1);
  assert.equal(bobUi.container.firstChild.childNodes[1].textContent, 'hi bob');
  assert.ok(!bobUi.container.firstChild.className.includes('msg--own'));

  await bob.sendMessage({ conversationId: 'lobby', body: 'sup alice' });
  await flush();
  await flush();

  assert.equal(alice.store.getMessages('lobby').length, 2);
  assert.equal(bob.store.getMessages('lobby').length, 2);
  assert.equal(aliceUi.container.childNodes.length, 2);
  assert.equal(bobUi.container.childNodes.length, 2);

  const aliceOrder = alice.store.getMessages('lobby').map((m) => m.body);
  assert.deepEqual(aliceOrder, ['hi bob', 'sup alice']);

  aliceRenderer.unmount();
  bobRenderer.unmount();
  alice.stop();
  bob.stop();
});

test('out-of-order arrival is sorted by sequence and rendered in order', async () => {
  const broker = new InMemoryBroker();
  const transportFactory = createBrokerTransportFactory(broker);

  const me = createMessagingRuntime({
    transportFactory,
    currentUser: { id: 'me' },
    retry: { enabled: false },
    reconnect: { enabled: false },
  });
  me.start();
  await flush();
  me.openConversation('room');
  await flush();

  const ui = createMockContainer();
  const renderer = new MessageRenderer({
    store: me.store,
    container: ui.container,
    document: ui.document,
    conversationId: 'room',
    currentUserId: 'me',
  });
  renderer.mount();

  me.store.insertMessage({
    conversationId: 'room',
    id: 'srv-2',
    body: 'second',
    authorId: 'remote',
    createdAt: 200,
    sequence: 2,
    status: MESSAGE_STATUS.DELIVERED,
  });
  me.store.insertMessage({
    conversationId: 'room',
    id: 'srv-1',
    body: 'first',
    authorId: 'remote',
    createdAt: 100,
    sequence: 1,
    status: MESSAGE_STATUS.DELIVERED,
  });
  me.store.insertMessage({
    conversationId: 'room',
    id: 'srv-3',
    body: 'third',
    authorId: 'remote',
    createdAt: 300,
    sequence: 3,
    status: MESSAGE_STATUS.DELIVERED,
  });

  const rendered = ui.container.childNodes.map((c) => c.childNodes[1].textContent);
  assert.deepEqual(rendered, ['first', 'second', 'third']);

  renderer.unmount();
  me.stop();
});

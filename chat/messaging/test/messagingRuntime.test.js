'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MessagingRuntime, MESSAGE_STATUS } = require('../messagingRuntime');
const { ConversationStore } = require('../conversationStore');
const { RealtimeChannel } = require('../realtimeChannel');
const {
  createInMemoryTransportFactory,
  InMemoryBroker,
  createBrokerTransportFactory,
} = require('../inMemoryChannel');

function manualScheduler() {
  let now = 0;
  const queue = [];
  function schedule(fn, delay) {
    const handle = { fn, runAt: now + delay, cancelled: false };
    queue.push(handle);
    return handle;
  }
  function cancel(handle) { if (handle) handle.cancelled = true; }
  function advance(ms) {
    now += ms;
    const due = queue.filter((h) => h.runAt <= now);
    for (const h of due) queue.splice(queue.indexOf(h), 1);
    for (const h of due) if (!h.cancelled) h.fn();
  }
  return { schedule, cancel, advance, queue };
}

function buildRuntime(opts) {
  opts = opts || {};
  const transportFactory = createInMemoryTransportFactory({ latency: 0 });
  const channel = new RealtimeChannel({ transportFactory, reconnect: { enabled: false } });
  const store = new ConversationStore();
  const runtime = new MessagingRuntime({
    store,
    channel,
    currentUser: { id: 'u1', name: 'Me' },
    idGenerator: opts.idGenerator || ((() => {
      let i = 0;
      return () => `cid_${++i}`;
    })()),
    clock: opts.clock || ((() => {
      let t = 1000;
      return () => (t += 10);
    })()),
    ackTimeoutMs: opts.ackTimeoutMs || 10_000,
    retry: opts.retry || { enabled: false, maxAttempts: 1 },
  });
  return { runtime, channel, store };
}

async function flush() {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setImmediate(r));
  }
}

test('sendMessage inserts an optimistic pending message and reconciles after ack', async () => {
  const { runtime, store } = buildRuntime();
  runtime.start();
  runtime.openConversation('c1');
  await flush();

  const inserts = [];
  store.on('message:insert', (e) => inserts.push(e));
  const updates = [];
  store.on('message:update', (e) => updates.push(e));

  const promise = runtime.sendMessage({ conversationId: 'c1', body: 'hi' });
  let messages = store.getMessages('c1');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].status, MESSAGE_STATUS.PENDING);

  const final = await promise;
  assert.equal(final.status, MESSAGE_STATUS.DELIVERED);
  assert.ok(final.id, 'message has server id');
  assert.equal(typeof final.sequence, 'number');

  messages = store.getMessages('c1');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].status, MESSAGE_STATUS.DELIVERED);
  assert.equal(inserts.length, 1);
  assert.ok(updates.length >= 1);
  runtime.stop();
});

test('sendMessage rejects on empty body', async () => {
  const { runtime } = buildRuntime();
  runtime.start();
  await assert.rejects(runtime.sendMessage({ conversationId: 'c1', body: '   ' }), /empty/);
  runtime.stop();
});

test('ack timeout marks the message failed when retries are disabled', async () => {
  const scheduler = manualScheduler();
  const transportFactory = createInMemoryTransportFactory({
    latency: 1_000_000,
    scheduler: (fn, delay) => scheduler.schedule(fn, delay || 0),
  });
  const channel = new RealtimeChannel({ transportFactory, reconnect: { enabled: false } });
  const store = new ConversationStore();
  const runtime = new MessagingRuntime({
    store,
    channel,
    currentUser: { id: 'u1' },
    scheduler: scheduler.schedule,
    cancelScheduler: scheduler.cancel,
    ackTimeoutMs: 500,
    retry: { enabled: false, maxAttempts: 1 },
    idGenerator: () => 'cidA',
    clock: () => 1,
  });
  runtime.start();
  scheduler.advance(0);

  const failed = [];
  runtime.on('message:failed', (e) => failed.push(e));

  const promise = runtime.sendMessage({ conversationId: 'c1', body: 'hi' });
  promise.catch(() => {});
  scheduler.advance(500);
  await flush();

  assert.equal(failed.length, 1);
  const messages = store.getMessages('c1');
  assert.equal(messages[0].status, MESSAGE_STATUS.FAILED);
  await assert.rejects(promise);
  runtime.stop();
});

test('ack timeout retries with backoff when enabled', async () => {
  const scheduler = manualScheduler();
  let ackOn = 2;
  let sentCount = 0;
  const transportFactory = (handlers) => {
    return {
      open() { scheduler.schedule(() => handlers.onOpen(), 0); },
      close() { handlers.onClose({ code: 1000 }); },
      send(envelope) {
        if (envelope.type !== 'message:send') return;
        sentCount += 1;
        if (sentCount >= ackOn) {
          scheduler.schedule(() => {
            handlers.onMessage({
              type: 'message:ack',
              conversationId: envelope.conversationId,
              clientId: envelope.message.clientId,
              message: { id: 'srv1', sequence: 1, status: 'delivered' },
            });
          }, 50);
        }
      },
    };
  };
  const channel = new RealtimeChannel({ transportFactory, scheduler: scheduler.schedule, reconnect: { enabled: false } });
  const store = new ConversationStore();
  const runtime = new MessagingRuntime({
    store,
    channel,
    currentUser: { id: 'u1' },
    scheduler: scheduler.schedule,
    cancelScheduler: scheduler.cancel,
    ackTimeoutMs: 200,
    retry: { enabled: true, maxAttempts: 3, baseDelayMs: 100, factor: 2, maxDelayMs: 1000 },
    idGenerator: () => 'cid_r',
    clock: () => 1,
  });
  runtime.start();
  scheduler.advance(0);

  const retries = [];
  runtime.on('message:retry', (e) => retries.push(e));

  const p = runtime.sendMessage({ conversationId: 'c1', body: 'retry-me' });
  scheduler.advance(200);
  await flush();
  scheduler.advance(100);
  await flush();
  scheduler.advance(50);
  await flush();

  const result = await p;
  assert.equal(result.id, 'srv1');
  assert.equal(retries.length, 1);
  assert.equal(sentCount, 2);
  runtime.stop();
});

test('messages received from other clients are inserted into the store', async () => {
  const broker = new InMemoryBroker();
  const transportFactory = createBrokerTransportFactory(broker);

  function setup(userId) {
    const channel = new RealtimeChannel({ transportFactory, reconnect: { enabled: false } });
    const store = new ConversationStore();
    const runtime = new MessagingRuntime({
      store,
      channel,
      currentUser: { id: userId },
      idGenerator: ((p) => {
        let i = 0;
        return () => `${p}_${++i}`;
      })(userId),
      ackTimeoutMs: 5000,
      retry: { enabled: false, maxAttempts: 1 },
    });
    return { runtime, store, channel };
  }

  const alice = setup('alice');
  const bob = setup('bob');

  alice.runtime.start();
  bob.runtime.start();
  await flush();

  alice.runtime.openConversation('room1');
  bob.runtime.openConversation('room1');
  await flush();

  await alice.runtime.sendMessage({ conversationId: 'room1', body: 'hello from alice' });
  await flush();
  await flush();

  const bobs = bob.store.getMessages('room1');
  assert.equal(bobs.length, 1);
  assert.equal(bobs[0].body, 'hello from alice');
  assert.equal(bobs[0].authorId, 'alice');
  assert.equal(bobs[0].status, MESSAGE_STATUS.DELIVERED);

  const alices = alice.store.getMessages('room1');
  assert.equal(alices.length, 1);
  assert.equal(alices[0].status, MESSAGE_STATUS.DELIVERED);

  alice.runtime.stop();
  bob.runtime.stop();
});

test('retryMessage re-sends a previously failed message', async () => {
  const scheduler = manualScheduler();
  let allowAck = false;
  const transportFactory = (handlers) => ({
    open() { scheduler.schedule(() => handlers.onOpen(), 0); },
    close() { handlers.onClose({ code: 1000 }); },
    send(envelope) {
      if (envelope.type !== 'message:send') return;
      if (allowAck) {
        scheduler.schedule(() => {
          handlers.onMessage({
            type: 'message:ack',
            conversationId: envelope.conversationId,
            clientId: envelope.message.clientId,
            message: { id: 'srv99', sequence: 7, status: 'delivered' },
          });
        }, 5);
      }
    },
  });
  const channel = new RealtimeChannel({ transportFactory, scheduler: scheduler.schedule, reconnect: { enabled: false } });
  const store = new ConversationStore();
  const runtime = new MessagingRuntime({
    store,
    channel,
    currentUser: { id: 'u1' },
    scheduler: scheduler.schedule,
    cancelScheduler: scheduler.cancel,
    ackTimeoutMs: 50,
    retry: { enabled: false, maxAttempts: 1 },
    idGenerator: () => 'cid_only',
    clock: () => 1,
  });
  runtime.start();
  scheduler.advance(0);

  const promise = runtime.sendMessage({ conversationId: 'c1', body: 'try1' });
  promise.catch(() => {});
  scheduler.advance(50);
  await flush();
  await assert.rejects(promise);
  assert.equal(store.getMessages('c1')[0].status, MESSAGE_STATUS.FAILED);

  allowAck = true;
  const retried = runtime.retryMessage('c1', 'cid_only');
  scheduler.advance(5);
  await flush();
  const finalMessage = await retried;
  assert.equal(finalMessage.id, 'srv99');
  assert.equal(store.getMessages('c1')[0].status, MESSAGE_STATUS.DELIVERED);
  runtime.stop();
});

test('openConversation subscribes the channel', async () => {
  const subscribed = [];
  const transportFactory = (handlers) => ({
    open() { handlers.onOpen(); },
    close() { handlers.onClose({ code: 1000 }); },
    send(envelope) {
      if (envelope.type === 'subscribe') subscribed.push(envelope.conversationId);
    },
  });
  const channel = new RealtimeChannel({ transportFactory, reconnect: { enabled: false } });
  const runtime = new MessagingRuntime({
    channel,
    store: new ConversationStore(),
    currentUser: { id: 'u1' },
  });
  runtime.start();
  runtime.openConversation('room42');
  await flush();
  assert.deepEqual(subscribed, ['room42']);
  runtime.stop();
});

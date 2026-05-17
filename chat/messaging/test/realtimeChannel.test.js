'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RealtimeChannel, CONNECTION_STATE } = require('../realtimeChannel');
const { ChannelNotConnectedError } = require('../errors');

function manualScheduler() {
  const tasks = [];
  function scheduler(fn, delay) {
    const handle = { fn, delay, cancelled: false };
    tasks.push(handle);
    return handle;
  }
  scheduler.run = function run() {
    const ready = tasks.splice(0);
    for (const t of ready) if (!t.cancelled) t.fn();
  };
  scheduler.size = () => tasks.length;
  return scheduler;
}

function makeFakeTransport(send) {
  const handlers = {};
  const transport = {
    open() { if (handlers.onOpen) handlers.onOpen(); },
    close() { if (handlers.onClose) handlers.onClose({ code: 1000 }); },
    send,
    _emit(env) { if (handlers.onMessage) handlers.onMessage(env); },
    _error(e) { if (handlers.onError) handlers.onError(e); },
  };
  return { transport, handlers };
}

function makeChannel(opts) {
  const sent = [];
  const fakes = [];
  const channel = new RealtimeChannel(
    Object.assign(
      {
        transportFactory: (h) => {
          const send = (env) => sent.push(env);
          const t = {
            open: () => h.onOpen(),
            close: () => h.onClose({ code: 1000 }),
            send,
            _inject: (env) => h.onMessage(env),
            _error: (e) => h.onError(e),
          };
          fakes.push(t);
          return t;
        },
      },
      opts || {}
    )
  );
  return { channel, sent, fakes };
}

test('connect transitions to open and emits state changes', () => {
  const { channel } = makeChannel();
  const states = [];
  channel.on('state', (evt) => states.push(evt.state));
  channel.connect();
  assert.equal(channel.connected, true);
  assert.deepEqual(states, [CONNECTION_STATE.CONNECTING, CONNECTION_STATE.OPEN]);
});

test('publish throws ChannelNotConnectedError when closed and buffers envelope', () => {
  const { channel, sent, fakes } = makeChannel();
  assert.throws(() => channel.publish({ type: 'message:send' }), ChannelNotConnectedError);
  assert.deepEqual(sent, []);
  channel.connect();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, 'message:send');
  fakes[0].close();
});

test('subscriptions are replayed on reconnect', () => {
  const { channel, sent } = makeChannel({ reconnect: { enabled: false } });
  channel.connect();
  channel.subscribe('c1');
  channel.subscribe('c2');
  assert.deepEqual(sent.map((s) => `${s.type}:${s.conversationId || ''}`), [
    'subscribe:c1',
    'subscribe:c2',
  ]);
  channel.close();
  sent.length = 0;
  channel.connect();
  assert.deepEqual(sent.map((s) => `${s.type}:${s.conversationId || ''}`).sort(), [
    'subscribe:c1',
    'subscribe:c2',
  ]);
});

test('reconnects with backoff after unexpected close', () => {
  const scheduler = manualScheduler();
  const sent = [];
  let factoryCount = 0;
  const channel = new RealtimeChannel({
    transportFactory: (h) => {
      factoryCount += 1;
      const t = {
        open: () => h.onOpen(),
        close: () => h.onClose({ code: 1006 }),
        send: (e) => sent.push(e),
        crash: () => h.onClose({ code: 1006 }),
      };
      t._handlers = h;
      return t;
    },
    scheduler,
    reconnect: { enabled: true, maxAttempts: 3, baseDelayMs: 100, factor: 2, maxDelayMs: 1000 },
  });
  const reconnectEvents = [];
  channel.on('reconnect:scheduled', (evt) => reconnectEvents.push(evt));

  channel.connect();
  assert.equal(factoryCount, 1);

  channel._transport._handlers.onClose({ code: 1006 });
  assert.equal(reconnectEvents.length, 1);
  assert.equal(reconnectEvents[0].attempt, 1);

  scheduler.run();
  assert.equal(factoryCount, 2);
});

test('parses string envelopes as JSON', () => {
  const { channel, fakes } = makeChannel();
  channel.connect();
  const events = [];
  channel.on('message', (evt) => events.push(evt));
  fakes[0]._inject(JSON.stringify({ type: 'message:new', conversationId: 'c1' }));
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'message:new');
});

test('emits message:<type> namespaced events', () => {
  const { channel, fakes } = makeChannel();
  channel.connect();
  const acks = [];
  channel.on('message:message:ack', (evt) => acks.push(evt));
  fakes[0]._inject({ type: 'message:ack', conversationId: 'c1', clientId: 'x' });
  assert.equal(acks.length, 1);
});

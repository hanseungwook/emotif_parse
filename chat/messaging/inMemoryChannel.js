'use strict';

const { EventEmitter } = require('./eventEmitter');

class InMemoryChannelTransport {
  constructor(handlers, options) {
    this._handlers = handlers || {};
    this._closed = true;
    this._latency = options && typeof options.latency === 'number' ? options.latency : 0;
    this._scheduler = (options && options.scheduler) || defaultScheduler;
    this._onSend = (options && options.onSend) || null;
    this._failNext = false;
    this._sequence = options && typeof options.startSequence === 'number' ? options.startSequence : 0;
    this._subscriptions = new Set();
  }

  open() {
    this._closed = false;
    this._scheduler(() => {
      if (this._closed) return;
      if (this._handlers.onOpen) this._handlers.onOpen();
    }, 0);
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    this._scheduler(() => {
      if (this._handlers.onClose) this._handlers.onClose({ code: 1000, reason: 'closed' });
    }, 0);
  }

  send(envelope) {
    if (this._closed) {
      throw new Error('transport closed');
    }
    if (this._failNext) {
      this._failNext = false;
      throw new Error('simulated send failure');
    }
    if (this._onSend) this._onSend(envelope);
    this._scheduler(() => {
      this._handleEnvelope(envelope);
    }, this._latency);
  }

  failNextSend() {
    this._failNext = true;
  }

  inject(envelope) {
    this._scheduler(() => {
      if (this._handlers.onMessage) this._handlers.onMessage(envelope);
    }, this._latency);
  }

  _handleEnvelope(envelope) {
    if (envelope.type === 'subscribe') {
      this._subscriptions.add(envelope.conversationId);
      return;
    }
    if (envelope.type === 'unsubscribe') {
      this._subscriptions.delete(envelope.conversationId);
      return;
    }
    if (envelope.type === 'message:send') {
      const { conversationId, message } = envelope;
      const seq = ++this._sequence;
      const serverMessage = Object.assign({}, message, {
        id: message.id || `srv_${seq}_${message.clientId}`,
        sequence: seq,
        status: 'delivered',
        deliveredAt: Date.now(),
      });
      const ack = {
        type: 'message:ack',
        conversationId,
        clientId: message.clientId,
        message: serverMessage,
      };
      if (this._handlers.onMessage) this._handlers.onMessage(ack);
      if (this._subscriptions.has(conversationId)) {
        if (this._handlers.onMessage) {
          this._handlers.onMessage({
            type: 'message:new',
            conversationId,
            message: serverMessage,
          });
        }
      }
      return;
    }
    if (envelope.type === 'typing:start' || envelope.type === 'typing:stop') {
      return;
    }
  }
}

function defaultScheduler(fn, delay) {
  if (!delay) {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(fn);
    } else {
      Promise.resolve().then(fn);
    }
    return null;
  }
  return setTimeout(fn, delay);
}

function createInMemoryTransportFactory(options) {
  return function transportFactory(handlers) {
    return new InMemoryChannelTransport(handlers, options || {});
  };
}

class InMemoryBroker extends EventEmitter {
  constructor(options) {
    super();
    this._scheduler = (options && options.scheduler) || defaultScheduler;
    this._sequence = 0;
    this._clients = new Set();
  }

  attach(channel) {
    const client = new BrokerClient(this, channel);
    this._clients.add(client);
    return client;
  }

  _detach(client) {
    this._clients.delete(client);
  }

  _nextSequence() {
    return ++this._sequence;
  }

  _broadcast(conversationId, envelope, origin) {
    for (const client of this._clients) {
      if (client === origin) continue;
      if (client.subscriptions.has(conversationId)) {
        this._scheduler(() => {
          client.deliver(envelope);
        }, 0);
      }
    }
  }
}

class BrokerClient {
  constructor(broker, handlers) {
    this._broker = broker;
    this._handlers = handlers;
    this.subscriptions = new Set();
    this._closed = false;
  }

  deliver(envelope) {
    if (this._closed) return;
    if (this._handlers.onMessage) this._handlers.onMessage(envelope);
  }

  open() {
    this._closed = false;
    this._broker._scheduler(() => {
      if (this._handlers.onOpen) this._handlers.onOpen();
    }, 0);
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    this._broker._detach(this);
    this._broker._scheduler(() => {
      if (this._handlers.onClose) this._handlers.onClose({ code: 1000 });
    }, 0);
  }

  send(envelope) {
    if (this._closed) throw new Error('client closed');
    if (envelope.type === 'subscribe') {
      this.subscriptions.add(envelope.conversationId);
      return;
    }
    if (envelope.type === 'unsubscribe') {
      this.subscriptions.delete(envelope.conversationId);
      return;
    }
    if (envelope.type === 'message:send') {
      const seq = this._broker._nextSequence();
      const serverMessage = Object.assign({}, envelope.message, {
        id: envelope.message.id || `srv_${seq}_${envelope.message.clientId}`,
        sequence: seq,
        status: 'delivered',
        deliveredAt: Date.now(),
      });
      this._broker._scheduler(() => {
        if (this._handlers.onMessage) {
          this._handlers.onMessage({
            type: 'message:ack',
            conversationId: envelope.conversationId,
            clientId: envelope.message.clientId,
            message: serverMessage,
          });
        }
      }, 0);
      this._broker._broadcast(
        envelope.conversationId,
        {
          type: 'message:new',
          conversationId: envelope.conversationId,
          message: serverMessage,
        },
        this
      );
      return;
    }
    if (envelope.type === 'typing:start' || envelope.type === 'typing:stop') {
      this._broker._broadcast(envelope.conversationId, envelope, this);
      return;
    }
  }
}

function createBrokerTransportFactory(broker) {
  return function transportFactory(handlers) {
    return broker.attach(handlers);
  };
}

module.exports = {
  InMemoryChannelTransport,
  createInMemoryTransportFactory,
  InMemoryBroker,
  createBrokerTransportFactory,
};

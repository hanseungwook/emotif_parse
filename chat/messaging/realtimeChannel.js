'use strict';

const { EventEmitter } = require('./eventEmitter');
const { ChannelNotConnectedError } = require('./errors');

const CONNECTION_STATE = Object.freeze({
  CLOSED: 'closed',
  CONNECTING: 'connecting',
  OPEN: 'open',
  CLOSING: 'closing',
});

class RealtimeChannel extends EventEmitter {
  constructor(options) {
    super();
    const opts = options || {};
    this._endpoint = opts.endpoint || null;
    this._transportFactory = opts.transportFactory || null;
    this._scheduler = opts.scheduler || defaultScheduler;
    this._reconnect = Object.assign(
      { enabled: true, maxAttempts: 8, baseDelayMs: 250, maxDelayMs: 10000, factor: 2 },
      opts.reconnect || {}
    );
    this._state = CONNECTION_STATE.CLOSED;
    this._transport = null;
    this._subscriptions = new Set();
    this._reconnectAttempts = 0;
    this._closedByUser = false;
    this._outbox = [];
  }

  get state() {
    return this._state;
  }

  get connected() {
    return this._state === CONNECTION_STATE.OPEN;
  }

  connect() {
    if (this._state === CONNECTION_STATE.OPEN || this._state === CONNECTION_STATE.CONNECTING) {
      return;
    }
    if (!this._transportFactory) {
      throw new Error('RealtimeChannel requires a transportFactory');
    }
    this._closedByUser = false;
    this._setState(CONNECTION_STATE.CONNECTING);
    try {
      this._transport = this._transportFactory({
        endpoint: this._endpoint,
        onOpen: () => this._handleOpen(),
        onMessage: (msg) => this._handleMessage(msg),
        onError: (err) => this._handleError(err),
        onClose: (info) => this._handleClose(info),
      });
      if (this._transport && typeof this._transport.open === 'function') {
        this._transport.open();
      }
    } catch (err) {
      this._handleError(err);
      this._handleClose({ code: 1011, reason: 'transport construction failed' });
    }
  }

  close() {
    this._closedByUser = true;
    if (this._state === CONNECTION_STATE.CLOSED || this._state === CONNECTION_STATE.CLOSING) {
      return;
    }
    this._setState(CONNECTION_STATE.CLOSING);
    if (this._transport && typeof this._transport.close === 'function') {
      try {
        this._transport.close();
      } catch (err) {
        this.emit('error', err);
      }
    } else {
      this._handleClose({ code: 1000, reason: 'closed' });
    }
  }

  publish(envelope) {
    if (!envelope || typeof envelope.type !== 'string') {
      throw new TypeError('publish requires an envelope with a string type');
    }
    if (!this.connected) {
      this._outbox.push(envelope);
      throw new ChannelNotConnectedError();
    }
    return this._writeEnvelope(envelope);
  }

  trySend(envelope) {
    if (!this.connected) {
      this._outbox.push(envelope);
      return false;
    }
    this._writeEnvelope(envelope);
    return true;
  }

  subscribe(conversationId) {
    if (typeof conversationId !== 'string' || conversationId.length === 0) {
      throw new TypeError('subscribe requires a conversationId');
    }
    const had = this._subscriptions.has(conversationId);
    this._subscriptions.add(conversationId);
    if (!had && this.connected) {
      this._writeEnvelope({ type: 'subscribe', conversationId });
    }
    return () => this.unsubscribe(conversationId);
  }

  unsubscribe(conversationId) {
    const had = this._subscriptions.delete(conversationId);
    if (had && this.connected) {
      this._writeEnvelope({ type: 'unsubscribe', conversationId });
    }
    return had;
  }

  subscriptions() {
    return Array.from(this._subscriptions);
  }

  _writeEnvelope(envelope) {
    if (!this._transport || typeof this._transport.send !== 'function') {
      throw new ChannelNotConnectedError('transport missing send');
    }
    this._transport.send(envelope);
  }

  _setState(next) {
    if (this._state === next) return;
    const previous = this._state;
    this._state = next;
    this.emit('state', { state: next, previous });
  }

  _handleOpen() {
    this._reconnectAttempts = 0;
    this._setState(CONNECTION_STATE.OPEN);
    for (const conversationId of this._subscriptions) {
      try {
        this._writeEnvelope({ type: 'subscribe', conversationId });
      } catch (err) {
        this.emit('error', err);
      }
    }
    const buffered = this._outbox.splice(0);
    for (const envelope of buffered) {
      try {
        this._writeEnvelope(envelope);
      } catch (err) {
        this._outbox.push(envelope);
        this.emit('error', err);
        break;
      }
    }
    this.emit('open');
  }

  _handleMessage(raw) {
    let envelope = raw;
    if (typeof raw === 'string') {
      try {
        envelope = JSON.parse(raw);
      } catch (err) {
        this.emit('error', err);
        return;
      }
    }
    if (!envelope || typeof envelope !== 'object') return;
    this.emit('message', envelope);
    if (typeof envelope.type === 'string') {
      this.emit(`message:${envelope.type}`, envelope);
    }
  }

  _handleError(err) {
    this.emit('error', err);
  }

  _handleClose(info) {
    this._transport = null;
    const wasOpen = this._state === CONNECTION_STATE.OPEN;
    this._setState(CONNECTION_STATE.CLOSED);
    this.emit('close', info || {});
    if (
      !this._closedByUser &&
      this._reconnect.enabled &&
      this._reconnectAttempts < this._reconnect.maxAttempts
    ) {
      const attempt = ++this._reconnectAttempts;
      const delay = Math.min(
        this._reconnect.maxDelayMs,
        Math.floor(this._reconnect.baseDelayMs * Math.pow(this._reconnect.factor, attempt - 1))
      );
      this.emit('reconnect:scheduled', { attempt, delay });
      this._scheduler(() => {
        if (this._closedByUser) return;
        this.connect();
      }, delay);
    } else if (!wasOpen && !this._closedByUser) {
      this.emit('reconnect:abandoned', { attempts: this._reconnectAttempts });
    }
  }
}

function defaultScheduler(fn, delay) {
  return setTimeout(fn, delay);
}

module.exports = { RealtimeChannel, CONNECTION_STATE };

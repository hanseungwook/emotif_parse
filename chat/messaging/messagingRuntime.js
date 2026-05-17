'use strict';

const { EventEmitter } = require('./eventEmitter');
const { ConversationStore, MESSAGE_STATUS } = require('./conversationStore');
const { RealtimeChannel } = require('./realtimeChannel');
const { MessageComposer } = require('./messageComposer');
const { createIdGenerator, defaultClock } = require('./ids');
const {
  MessagingError,
  ChannelNotConnectedError,
  MessageDeliveryError,
} = require('./errors');

const DEFAULT_RETRY = Object.freeze({
  enabled: true,
  maxAttempts: 3,
  baseDelayMs: 800,
  factor: 2,
  maxDelayMs: 8000,
});

const DEFAULT_ACK_TIMEOUT_MS = 15000;

class MessagingRuntime extends EventEmitter {
  constructor(options) {
    super();
    const opts = options || {};
    this._store = opts.store || new ConversationStore();
    this._channel = opts.channel || null;
    this._currentUser = opts.currentUser || null;
    this._clock = opts.clock || defaultClock;
    this._generateClientId = opts.idGenerator || createIdGenerator('cli');
    this._scheduler = opts.scheduler || defaultScheduler;
    this._cancelScheduler = opts.cancelScheduler || defaultCancelScheduler;
    this._retry = Object.assign({}, DEFAULT_RETRY, opts.retry || {});
    this._ackTimeoutMs =
      typeof opts.ackTimeoutMs === 'number' ? opts.ackTimeoutMs : DEFAULT_ACK_TIMEOUT_MS;

    this._pending = new Map();
    this._unsubFromChannel = [];
    this._openConversations = new Set();
    this._started = false;
  }

  get store() {
    return this._store;
  }

  get channel() {
    return this._channel;
  }

  get currentUser() {
    return this._currentUser;
  }

  setCurrentUser(user) {
    this._currentUser = user;
    this.emit('user:change', { user });
  }

  setChannel(channel) {
    if (this._started) {
      this._detachChannel();
    }
    this._channel = channel;
    if (this._started && channel) {
      this._attachChannel();
    }
  }

  start() {
    if (this._started) return;
    if (!this._channel) {
      throw new MessagingError('runtime requires a channel before start');
    }
    this._started = true;
    this._attachChannel();
    if (typeof this._channel.connect === 'function') {
      this._channel.connect();
    }
    this.emit('start', {});
  }

  stop() {
    if (!this._started) return;
    this._started = false;
    this._detachChannel();
    for (const pending of this._pending.values()) {
      if (pending.timer) this._cancelScheduler(pending.timer);
    }
    this._pending.clear();
    if (this._channel && typeof this._channel.close === 'function') {
      this._channel.close();
    }
    this.emit('stop', {});
  }

  openConversation(conversationId) {
    if (typeof conversationId !== 'string' || conversationId.length === 0) {
      throw new TypeError('openConversation requires a conversationId');
    }
    this._openConversations.add(conversationId);
    if (this._channel && typeof this._channel.subscribe === 'function') {
      this._channel.subscribe(conversationId);
    }
    this.emit('conversation:open', { conversationId });
  }

  closeConversation(conversationId) {
    if (!this._openConversations.delete(conversationId)) return;
    if (this._channel && typeof this._channel.unsubscribe === 'function') {
      this._channel.unsubscribe(conversationId);
    }
    this.emit('conversation:close', { conversationId });
  }

  composer(conversationId, options) {
    return new MessageComposer(
      Object.assign(
        {
          runtime: this,
          conversationId,
          authorId: this._currentUser ? this._currentUser.id : null,
        },
        options || {}
      )
    );
  }

  sendMessage(input) {
    const conversationId = input && input.conversationId;
    if (typeof conversationId !== 'string' || conversationId.length === 0) {
      return Promise.reject(new TypeError('sendMessage requires conversationId'));
    }
    const body = typeof input.body === 'string' ? input.body : '';
    const attachments = Array.isArray(input.attachments) ? input.attachments.slice() : [];
    if (body.trim().length === 0 && attachments.length === 0) {
      return Promise.reject(new MessagingError('cannot send empty message', 'EMPTY_MESSAGE'));
    }
    const clientId = input.clientId || this._generateClientId();
    const authorId = input.authorId || (this._currentUser && this._currentUser.id) || null;
    const createdAt = typeof input.createdAt === 'number' ? input.createdAt : this._clock();

    const optimistic = {
      conversationId,
      clientId,
      authorId,
      body,
      attachments,
      createdAt,
      status: MESSAGE_STATUS.PENDING,
      sequence: null,
    };
    this._store.insertMessage(optimistic);

    return new Promise((resolve, reject) => {
      this._dispatch({ optimistic, attempt: 0, resolve, reject });
    });
  }

  retryMessage(conversationId, clientId) {
    const message = this._store.getMessage(conversationId, clientId);
    if (!message) throw new MessagingError('message not found', 'MESSAGE_NOT_FOUND');
    if (message.status !== MESSAGE_STATUS.FAILED && message.status !== MESSAGE_STATUS.PENDING) {
      throw new MessagingError('message is not retryable', 'NOT_RETRYABLE');
    }
    this._store.markMessageStatus(conversationId, clientId, MESSAGE_STATUS.PENDING, {
      lastError: null,
    });
    return new Promise((resolve, reject) => {
      this._dispatch({
        optimistic: { ...message, status: MESSAGE_STATUS.PENDING },
        attempt: 0,
        resolve,
        reject,
      });
    });
  }

  _dispatch(ctx) {
    const { optimistic } = ctx;
    const pendingKey = pendingKeyFor(optimistic.conversationId, optimistic.clientId);
    this._pending.set(pendingKey, ctx);

    const envelope = {
      type: 'message:send',
      conversationId: optimistic.conversationId,
      message: {
        clientId: optimistic.clientId,
        authorId: optimistic.authorId,
        body: optimistic.body,
        attachments: optimistic.attachments,
        createdAt: optimistic.createdAt,
      },
    };

    let sent = false;
    try {
      this._channel.publish(envelope);
      sent = true;
    } catch (err) {
      if (err instanceof ChannelNotConnectedError) {
        if (this._channel && typeof this._channel.trySend === 'function') {
          this._channel.trySend(envelope);
          sent = true;
        } else {
          this._failPending(pendingKey, new MessageDeliveryError('channel not connected', err));
          return;
        }
      } else {
        this._failPending(pendingKey, new MessageDeliveryError('publish failed', err));
        return;
      }
    }

    if (sent) {
      ctx.timer = this._scheduler(() => {
        this._handleAckTimeout(pendingKey);
      }, this._ackTimeoutMs);
    }
  }

  _handleAckTimeout(pendingKey) {
    const ctx = this._pending.get(pendingKey);
    if (!ctx) return;
    const error = new MessageDeliveryError('ack timeout');
    this._tryRetry(pendingKey, ctx, error);
  }

  _failPending(pendingKey, error) {
    const ctx = this._pending.get(pendingKey);
    if (!ctx) return;
    this._pending.delete(pendingKey);
    this._store.markMessageStatus(
      ctx.optimistic.conversationId,
      ctx.optimistic.clientId,
      MESSAGE_STATUS.FAILED,
      { lastError: serializeError(error) }
    );
    this.emit('message:failed', {
      conversationId: ctx.optimistic.conversationId,
      clientId: ctx.optimistic.clientId,
      error,
    });
    ctx.reject(error);
  }

  _tryRetry(pendingKey, ctx, error) {
    if (ctx.timer) this._cancelScheduler(ctx.timer);
    ctx.timer = null;
    if (!this._retry.enabled || ctx.attempt + 1 >= this._retry.maxAttempts) {
      this._failPending(pendingKey, error);
      return;
    }
    ctx.attempt += 1;
    const delay = Math.min(
      this._retry.maxDelayMs,
      Math.floor(this._retry.baseDelayMs * Math.pow(this._retry.factor, ctx.attempt - 1))
    );
    this.emit('message:retry', {
      conversationId: ctx.optimistic.conversationId,
      clientId: ctx.optimistic.clientId,
      attempt: ctx.attempt,
      delay,
    });
    ctx.timer = this._scheduler(() => this._dispatch(ctx), delay);
  }

  _attachChannel() {
    if (!this._channel) return;
    const adds = [];
    adds.push(
      this._channel.on('open', () => {
        for (const conversationId of this._openConversations) {
          this._channel.subscribe(conversationId);
        }
        this.emit('channel:open', {});
      })
    );
    adds.push(
      this._channel.on('close', (info) => {
        this.emit('channel:close', info || {});
      })
    );
    adds.push(
      this._channel.on('error', (err) => {
        this.emit('channel:error', err);
      })
    );
    adds.push(
      this._channel.on('message', (envelope) => {
        this._onChannelEnvelope(envelope);
      })
    );
    this._unsubFromChannel = adds;
  }

  _detachChannel() {
    for (const off of this._unsubFromChannel) {
      try {
        off();
      } catch (_e) {}
    }
    this._unsubFromChannel = [];
  }

  _onChannelEnvelope(envelope) {
    if (!envelope || typeof envelope.type !== 'string') return;
    switch (envelope.type) {
      case 'message:ack':
        this._handleAck(envelope);
        break;
      case 'message:new':
        this._handleNew(envelope);
        break;
      case 'message:update':
        this._handleUpdate(envelope);
        break;
      case 'message:delete':
        this._handleDelete(envelope);
        break;
      case 'conversation:upsert':
        if (envelope.conversation) this._store.upsertConversation(envelope.conversation);
        break;
      default:
        this.emit('channel:envelope', envelope);
    }
  }

  _handleAck(envelope) {
    const { conversationId, clientId, message } = envelope;
    if (!conversationId || !clientId) return;
    const pendingKey = pendingKeyFor(conversationId, clientId);
    const ctx = this._pending.get(pendingKey);
    if (ctx && ctx.timer) this._cancelScheduler(ctx.timer);
    const reconciled = this._store.reconcileMessage(conversationId, clientId, {
      id: message && message.id,
      sequence: message && message.sequence,
      status: (message && message.status) || MESSAGE_STATUS.DELIVERED,
      deliveredAt: message && message.deliveredAt,
      lastError: null,
    });
    if (ctx) {
      this._pending.delete(pendingKey);
      this.emit('message:delivered', { conversationId, clientId, message: reconciled });
      ctx.resolve(reconciled);
    } else {
      this.emit('message:delivered', { conversationId, clientId, message: reconciled });
    }
  }

  _handleNew(envelope) {
    const { conversationId, message } = envelope;
    if (!conversationId || !message) return;
    const incoming = Object.assign({}, message, {
      conversationId,
      status: message.status || MESSAGE_STATUS.DELIVERED,
    });
    const inserted = this._store.insertMessage(incoming);
    this.emit('message:new', { conversationId, message: inserted });
  }

  _handleUpdate(envelope) {
    const { conversationId, message } = envelope;
    if (!conversationId || !message) return;
    if (message.clientId) {
      this._store.reconcileMessage(conversationId, message.clientId, message);
    } else if (message.id) {
      this._store.insertMessage(Object.assign({}, message, { conversationId }));
    }
  }

  _handleDelete(envelope) {
    const { conversationId, messageId, clientId } = envelope;
    if (!conversationId) return;
    const key = messageId || clientId;
    if (!key) return;
    this._store.removeMessage(conversationId, key);
  }
}

function pendingKeyFor(conversationId, clientId) {
  return `${conversationId}::${clientId}`;
}

function serializeError(err) {
  if (!err) return null;
  return {
    name: err.name || 'Error',
    code: err.code || null,
    message: err.message || String(err),
  };
}

function defaultScheduler(fn, delay) {
  return setTimeout(fn, delay);
}

function defaultCancelScheduler(handle) {
  if (handle != null) clearTimeout(handle);
}

module.exports = { MessagingRuntime, MESSAGE_STATUS };

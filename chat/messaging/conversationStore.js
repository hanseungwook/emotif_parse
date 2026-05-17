'use strict';

const { EventEmitter } = require('./eventEmitter');
const { compareMessages, findInsertIndex, insertSorted } = require('./ordering');

const MESSAGE_STATUS = Object.freeze({
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
});

function ensureConversationShape(conversation) {
  if (!conversation || typeof conversation.id !== 'string' || conversation.id.length === 0) {
    throw new TypeError('conversation requires a string id');
  }
}

function ensureMessageShape(message) {
  if (!message || typeof message !== 'object') {
    throw new TypeError('message must be an object');
  }
  if (typeof message.conversationId !== 'string' || message.conversationId.length === 0) {
    throw new TypeError('message.conversationId is required');
  }
  if (!message.clientId && !message.id) {
    throw new TypeError('message must have a clientId or id');
  }
}

class ConversationStore extends EventEmitter {
  constructor() {
    super();
    this._conversations = new Map();
  }

  _ensureBucket(conversationId) {
    let bucket = this._conversations.get(conversationId);
    if (!bucket) {
      bucket = {
        conversation: { id: conversationId, participants: [], title: null, lastMessageAt: null },
        messages: [],
        byClientId: new Map(),
        byServerId: new Map(),
      };
      this._conversations.set(conversationId, bucket);
    }
    return bucket;
  }

  upsertConversation(conversation) {
    ensureConversationShape(conversation);
    const bucket = this._ensureBucket(conversation.id);
    const previous = { ...bucket.conversation };
    bucket.conversation = { ...bucket.conversation, ...conversation };
    this.emit('conversation:upsert', { conversation: bucket.conversation, previous });
    return bucket.conversation;
  }

  removeConversation(conversationId) {
    const bucket = this._conversations.get(conversationId);
    if (!bucket) return false;
    this._conversations.delete(conversationId);
    this.emit('conversation:remove', { conversationId, conversation: bucket.conversation });
    return true;
  }

  listConversations() {
    const result = [];
    for (const bucket of this._conversations.values()) {
      result.push({ ...bucket.conversation });
    }
    return result;
  }

  getConversation(conversationId) {
    const bucket = this._conversations.get(conversationId);
    return bucket ? { ...bucket.conversation } : null;
  }

  getMessages(conversationId) {
    const bucket = this._conversations.get(conversationId);
    if (!bucket) return [];
    return bucket.messages.map((m) => ({ ...m }));
  }

  getMessage(conversationId, key) {
    const bucket = this._conversations.get(conversationId);
    if (!bucket) return null;
    const fromServer = bucket.byServerId.get(key);
    if (fromServer) return { ...fromServer };
    const fromClient = bucket.byClientId.get(key);
    return fromClient ? { ...fromClient } : null;
  }

  insertMessage(message) {
    ensureMessageShape(message);
    const bucket = this._ensureBucket(message.conversationId);
    const normalized = normalizeMessage(message);

    if (normalized.id && bucket.byServerId.has(normalized.id)) {
      return this._updateExisting(bucket, bucket.byServerId.get(normalized.id), normalized);
    }
    if (normalized.clientId && bucket.byClientId.has(normalized.clientId)) {
      return this._updateExisting(bucket, bucket.byClientId.get(normalized.clientId), normalized);
    }

    const stored = { ...normalized };
    const index = insertSorted(bucket.messages, stored);
    if (stored.clientId) bucket.byClientId.set(stored.clientId, stored);
    if (stored.id) bucket.byServerId.set(stored.id, stored);

    bucket.conversation.lastMessageAt = Math.max(
      bucket.conversation.lastMessageAt || 0,
      stored.createdAt || 0
    );
    this.emit('message:insert', { conversationId: stored.conversationId, message: { ...stored }, index });
    return { ...stored };
  }

  _updateExisting(bucket, existing, patch) {
    const oldIndex = bucket.messages.indexOf(existing);
    const merged = { ...existing, ...patch };
    if (existing.clientId && !merged.clientId) merged.clientId = existing.clientId;
    if (existing.id && !merged.id) merged.id = existing.id;
    Object.assign(existing, merged);

    if (existing.clientId) bucket.byClientId.set(existing.clientId, existing);
    if (existing.id) bucket.byServerId.set(existing.id, existing);

    const correctIndex = findInsertIndex(
      bucket.messages.filter((_, i) => i !== oldIndex),
      existing
    );
    if (oldIndex !== correctIndex && oldIndex !== correctIndex - 1) {
      bucket.messages.splice(oldIndex, 1);
      const adjusted = oldIndex < correctIndex ? correctIndex - 1 : correctIndex;
      bucket.messages.splice(adjusted, 0, existing);
      this.emit('message:reorder', {
        conversationId: existing.conversationId,
        message: { ...existing },
        from: oldIndex,
        to: adjusted,
      });
    }
    this.emit('message:update', {
      conversationId: existing.conversationId,
      message: { ...existing },
    });
    return { ...existing };
  }

  reconcileMessage(conversationId, clientId, serverPatch) {
    const bucket = this._conversations.get(conversationId);
    if (!bucket) {
      return this.insertMessage({ conversationId, clientId, ...serverPatch });
    }
    const existing = bucket.byClientId.get(clientId);
    if (!existing) {
      return this.insertMessage({ conversationId, clientId, ...serverPatch });
    }
    const patch = { ...serverPatch, conversationId, clientId };
    if (!patch.status) patch.status = MESSAGE_STATUS.DELIVERED;
    return this._updateExisting(bucket, existing, normalizeMessage(patch));
  }

  markMessageStatus(conversationId, key, status, extra) {
    const bucket = this._conversations.get(conversationId);
    if (!bucket) return null;
    const existing = bucket.byClientId.get(key) || bucket.byServerId.get(key);
    if (!existing) return null;
    return this._updateExisting(bucket, existing, { ...(extra || {}), status });
  }

  removeMessage(conversationId, key) {
    const bucket = this._conversations.get(conversationId);
    if (!bucket) return false;
    const existing = bucket.byClientId.get(key) || bucket.byServerId.get(key);
    if (!existing) return false;
    const idx = bucket.messages.indexOf(existing);
    if (idx >= 0) bucket.messages.splice(idx, 1);
    if (existing.clientId) bucket.byClientId.delete(existing.clientId);
    if (existing.id) bucket.byServerId.delete(existing.id);
    this.emit('message:remove', {
      conversationId,
      message: { ...existing },
      index: idx,
    });
    return true;
  }

  clear() {
    this._conversations.clear();
    this.emit('store:clear', {});
  }
}

function normalizeMessage(message) {
  const result = { ...message };
  if (!result.status) result.status = MESSAGE_STATUS.PENDING;
  if (typeof result.createdAt !== 'number') {
    const t = result.createdAt ? Date.parse(result.createdAt) : NaN;
    result.createdAt = Number.isFinite(t) ? t : Date.now();
  }
  return result;
}

module.exports = {
  ConversationStore,
  MESSAGE_STATUS,
  compareMessages,
};

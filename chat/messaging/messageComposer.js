'use strict';

const { ValidationError } = require('./errors');
const { EventEmitter } = require('./eventEmitter');

const DEFAULT_MAX_LENGTH = 4000;

class MessageComposer extends EventEmitter {
  constructor(options) {
    super();
    const opts = options || {};
    if (!opts.runtime) throw new TypeError('MessageComposer requires runtime');
    if (typeof opts.conversationId !== 'string' || opts.conversationId.length === 0) {
      throw new TypeError('MessageComposer requires conversationId');
    }
    this._runtime = opts.runtime;
    this._conversationId = opts.conversationId;
    this._authorId = opts.authorId || (opts.runtime.currentUser && opts.runtime.currentUser.id) || null;
    this._maxLength = typeof opts.maxLength === 'number' ? opts.maxLength : DEFAULT_MAX_LENGTH;
    this._draft = '';
    this._attachments = [];
    this._isSending = false;
  }

  get draft() {
    return this._draft;
  }

  get attachments() {
    return this._attachments.slice();
  }

  get conversationId() {
    return this._conversationId;
  }

  setBody(text) {
    const value = text == null ? '' : String(text);
    if (value === this._draft) return;
    this._draft = value;
    this.emit('change', { draft: this._draft, attachments: this.attachments });
  }

  appendBody(text) {
    if (text == null) return;
    this.setBody(this._draft + String(text));
  }

  setAttachments(attachments) {
    this._attachments = Array.isArray(attachments) ? attachments.slice() : [];
    this.emit('change', { draft: this._draft, attachments: this.attachments });
  }

  reset() {
    if (this._draft === '' && this._attachments.length === 0) return;
    this._draft = '';
    this._attachments = [];
    this.emit('change', { draft: this._draft, attachments: this.attachments });
  }

  validate() {
    const body = this._draft.trim();
    if (body.length === 0 && this._attachments.length === 0) {
      throw new ValidationError('message body cannot be empty');
    }
    if (body.length > this._maxLength) {
      throw new ValidationError(`message body exceeds ${this._maxLength} characters`);
    }
    return body;
  }

  canSend() {
    try {
      this.validate();
      return !this._isSending;
    } catch (_err) {
      return false;
    }
  }

  async send() {
    if (this._isSending) {
      throw new ValidationError('composer is already sending');
    }
    const body = this.validate();
    this._isSending = true;
    this.emit('sending', { conversationId: this._conversationId });
    const attachments = this._attachments.slice();
    const snapshot = { body, attachments };
    this.reset();
    try {
      const result = await this._runtime.sendMessage({
        conversationId: this._conversationId,
        authorId: this._authorId,
        body: snapshot.body,
        attachments: snapshot.attachments,
      });
      this.emit('sent', { message: result });
      return result;
    } catch (err) {
      this._draft = snapshot.body;
      this._attachments = snapshot.attachments;
      this.emit('error', err);
      throw err;
    } finally {
      this._isSending = false;
    }
  }
}

module.exports = { MessageComposer };

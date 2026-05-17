'use strict';

const { MESSAGE_STATUS } = require('./conversationStore');

class MessageRenderer {
  constructor(options) {
    const opts = options || {};
    if (!opts.store) throw new TypeError('MessageRenderer requires a store');
    if (typeof opts.conversationId !== 'string' || opts.conversationId.length === 0) {
      throw new TypeError('MessageRenderer requires conversationId');
    }
    if (!opts.container) throw new TypeError('MessageRenderer requires a container');
    this._store = opts.store;
    this._conversationId = opts.conversationId;
    this._container = opts.container;
    this._document = opts.document || (opts.container.ownerDocument) || resolveGlobalDocument();
    if (!this._document) throw new TypeError('MessageRenderer requires a document');
    this._currentUserId = opts.currentUserId || null;
    this._format = typeof opts.format === 'function' ? opts.format : defaultFormat;
    this._classNames = Object.assign(
      {
        message: 'msg',
        own: 'msg--own',
        pending: 'msg--pending',
        failed: 'msg--failed',
        delivered: 'msg--delivered',
        body: 'msg__body',
        meta: 'msg__meta',
        author: 'msg__author',
        timestamp: 'msg__timestamp',
        status: 'msg__status',
        empty: 'msg-empty',
      },
      opts.classNames || {}
    );
    this._autoScroll = opts.autoScroll !== false;
    this._nodes = new Map();
    this._unsubscribers = [];
    this._emptyNode = null;
    this._mounted = false;
  }

  mount() {
    if (this._mounted) return;
    this._mounted = true;
    this._renderAll();
    const subs = [
      this._store.on('message:insert', (evt) => this._handleInsert(evt)),
      this._store.on('message:update', (evt) => this._handleUpdate(evt)),
      this._store.on('message:remove', (evt) => this._handleRemove(evt)),
      this._store.on('message:reorder', (evt) => this._handleReorder(evt)),
    ];
    this._unsubscribers = subs;
  }

  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    for (const off of this._unsubscribers) {
      try { off(); } catch (_e) {}
    }
    this._unsubscribers = [];
    this._clearContainer();
    this._nodes.clear();
    this._emptyNode = null;
  }

  setCurrentUserId(userId) {
    this._currentUserId = userId;
    for (const message of this._store.getMessages(this._conversationId)) {
      const node = this._nodeFor(message);
      if (node) this._applyClasses(node, message);
    }
  }

  _renderAll() {
    this._clearContainer();
    this._nodes.clear();
    const messages = this._store.getMessages(this._conversationId);
    if (messages.length === 0) {
      this._showEmpty();
      return;
    }
    this._hideEmpty();
    for (const message of messages) {
      const node = this._createNode(message);
      this._nodes.set(messageKey(message), node);
      this._container.appendChild(node);
    }
    this._scrollToBottom();
  }

  _handleInsert(event) {
    if (event.conversationId !== this._conversationId) return;
    const { message, index } = event;
    this._hideEmpty();
    const node = this._createNode(message);
    this._nodes.set(messageKey(message), node);
    const children = this._container.childNodes;
    if (typeof index === 'number' && index < children.length) {
      this._container.insertBefore(node, children[index]);
    } else {
      this._container.appendChild(node);
    }
    this._scrollToBottom();
  }

  _handleUpdate(event) {
    if (event.conversationId !== this._conversationId) return;
    const { message } = event;
    const node = this._nodeFor(message);
    if (!node) return this._handleInsert(event);
    this._applyContent(node, message);
    this._applyClasses(node, message);
    if (message.id) node.setAttribute('data-server-id', message.id);
    if (message.clientId) node.setAttribute('data-client-id', message.clientId);
    node.setAttribute('data-message-key', messageKey(message));
    if (message.clientId && message.id) {
      const fromClientKey = `cid:${message.clientId}`;
      const newKey = messageKey(message);
      if (fromClientKey !== newKey && this._nodes.has(fromClientKey)) {
        this._nodes.delete(fromClientKey);
        this._nodes.set(newKey, node);
      }
    }
  }

  _handleReorder(event) {
    if (event.conversationId !== this._conversationId) return;
    const { message, to } = event;
    const node = this._nodeFor(message);
    if (!node) return;
    if (node.parentNode) node.parentNode.removeChild(node);
    const children = this._container.childNodes;
    if (typeof to === 'number' && to < children.length) {
      this._container.insertBefore(node, children[to]);
    } else {
      this._container.appendChild(node);
    }
  }

  _handleRemove(event) {
    if (event.conversationId !== this._conversationId) return;
    const node = this._nodeFor(event.message);
    if (node && node.parentNode) node.parentNode.removeChild(node);
    if (event.message.clientId) this._nodes.delete(`cid:${event.message.clientId}`);
    if (event.message.id) this._nodes.delete(`sid:${event.message.id}`);
    if (this._store.getMessages(this._conversationId).length === 0) {
      this._showEmpty();
    }
  }

  _createNode(message) {
    const doc = this._document;
    const root = doc.createElement('div');
    root.setAttribute('data-message-key', messageKey(message));
    if (message.clientId) root.setAttribute('data-client-id', message.clientId);
    if (message.id) root.setAttribute('data-server-id', message.id);

    const meta = doc.createElement('div');
    meta.className = this._classNames.meta;
    const author = doc.createElement('span');
    author.className = this._classNames.author;
    const timestamp = doc.createElement('time');
    timestamp.className = this._classNames.timestamp;
    const status = doc.createElement('span');
    status.className = this._classNames.status;
    meta.appendChild(author);
    meta.appendChild(timestamp);
    meta.appendChild(status);

    const body = doc.createElement('div');
    body.className = this._classNames.body;

    root.appendChild(meta);
    root.appendChild(body);

    this._applyContent(root, message);
    this._applyClasses(root, message);
    return root;
  }

  _applyClasses(node, message) {
    const classes = [this._classNames.message];
    if (message.authorId && this._currentUserId && message.authorId === this._currentUserId) {
      classes.push(this._classNames.own);
    }
    if (message.status === MESSAGE_STATUS.PENDING) classes.push(this._classNames.pending);
    else if (message.status === MESSAGE_STATUS.FAILED) classes.push(this._classNames.failed);
    else if (message.status === MESSAGE_STATUS.DELIVERED || message.status === MESSAGE_STATUS.SENT) {
      classes.push(this._classNames.delivered);
    }
    node.className = classes.join(' ');
  }

  _applyContent(node, message) {
    const formatted = this._format(message);
    const body = findChildByClass(node, this._classNames.body);
    const author = findChildByClass(node, this._classNames.author);
    const timestamp = findChildByClass(node, this._classNames.timestamp);
    const status = findChildByClass(node, this._classNames.status);
    if (body) body.textContent = formatted.body || '';
    if (author) author.textContent = formatted.author || '';
    if (timestamp) {
      timestamp.textContent = formatted.timestamp || '';
      if (typeof timestamp.setAttribute === 'function' && formatted.isoTimestamp) {
        timestamp.setAttribute('datetime', formatted.isoTimestamp);
      }
    }
    if (status) status.textContent = formatted.status || '';
  }

  _showEmpty() {
    if (this._emptyNode) return;
    const node = this._document.createElement('div');
    node.className = this._classNames.empty;
    node.textContent = 'No messages yet';
    this._container.appendChild(node);
    this._emptyNode = node;
  }

  _hideEmpty() {
    if (this._emptyNode && this._emptyNode.parentNode) {
      this._emptyNode.parentNode.removeChild(this._emptyNode);
    }
    this._emptyNode = null;
  }

  _nodeFor(message) {
    if (message.id && this._nodes.has(`sid:${message.id}`)) return this._nodes.get(`sid:${message.id}`);
    if (message.clientId && this._nodes.has(`cid:${message.clientId}`)) {
      return this._nodes.get(`cid:${message.clientId}`);
    }
    return null;
  }

  _clearContainer() {
    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
  }

  _scrollToBottom() {
    if (!this._autoScroll) return;
    if (typeof this._container.scrollTop === 'number' && typeof this._container.scrollHeight === 'number') {
      this._container.scrollTop = this._container.scrollHeight;
    }
  }
}

function messageKey(message) {
  if (message.id) return `sid:${message.id}`;
  return `cid:${message.clientId}`;
}

function findChildByClass(node, className) {
  if (!node || !node.childNodes) return null;
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.className === className) return child;
    if (child.childNodes && child.childNodes.length) {
      const inner = findChildByClass(child, className);
      if (inner) return inner;
    }
  }
  return null;
}

function defaultFormat(message) {
  const created = new Date(message.createdAt || Date.now());
  const isoTimestamp = isFinite(created.getTime()) ? created.toISOString() : '';
  const hh = String(created.getHours()).padStart(2, '0');
  const mm = String(created.getMinutes()).padStart(2, '0');
  let status = '';
  if (message.status === MESSAGE_STATUS.PENDING) status = 'sending…';
  else if (message.status === MESSAGE_STATUS.FAILED) status = 'failed';
  else if (message.status === MESSAGE_STATUS.SENT) status = 'sent';
  else if (message.status === MESSAGE_STATUS.DELIVERED) status = '';
  return {
    body: message.body || '',
    author: message.authorName || message.authorId || '',
    timestamp: `${hh}:${mm}`,
    isoTimestamp,
    status,
  };
}

function resolveGlobalDocument() {
  if (typeof document !== 'undefined') return document;
  if (typeof window !== 'undefined' && window.document) return window.document;
  return null;
}

module.exports = { MessageRenderer };

// Minimal DOM mock that mirrors the surface used by HUD modules so the
// HUD subsystem can run under `node --test` without a browser. Extends the
// chat-app mockDom shape with addEventListener / removeEventListener,
// style.setProperty, and attribute removal — the bits the HUD's interactive
// overlay depends on.

class MockStyle {
  constructor() {
    this._props = new Map();
    this.display = '';
  }
  setProperty(name, value) { this._props.set(name, String(value)); }
  getPropertyValue(name) { return this._props.has(name) ? this._props.get(name) : ''; }
  removeProperty(name) { this._props.delete(name); }
}

export class MockNode {
  constructor(doc, tagName) {
    this.ownerDocument = doc;
    this.tagName = (tagName || '').toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this._attributes = new Map();
    this.className = '';
    this._textContent = '';
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.style = new MockStyle();
    this._listeners = new Map();
    this.type = '';
  }

  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }

  get textContent() {
    if (this.childNodes.length === 0) return this._textContent;
    return this.childNodes.map((c) => c.textContent).join('');
  }
  set textContent(value) {
    this.childNodes = [];
    this._textContent = value == null ? '' : String(value);
  }

  setAttribute(name, value) { this._attributes.set(name, String(value)); }
  getAttribute(name) { return this._attributes.has(name) ? this._attributes.get(name) : null; }
  removeAttribute(name) { this._attributes.delete(name); }
  hasAttribute(name) { return this._attributes.has(name); }

  get dataset() {
    const node = this;
    return new Proxy({}, {
      get(_t, prop) {
        return node._attributes.get(`data-${kebab(prop)}`) ?? undefined;
      },
      set(_t, prop, value) {
        node._attributes.set(`data-${kebab(prop)}`, String(value));
        return true;
      },
    });
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    this._updateScroll();
    return child;
  }

  insertBefore(child, reference) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    if (!reference) {
      this.childNodes.push(child);
    } else {
      const idx = this.childNodes.indexOf(reference);
      if (idx < 0) this.childNodes.push(child);
      else this.childNodes.splice(idx, 0, child);
    }
    this._updateScroll();
    return child;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) this.childNodes.splice(idx, 1);
    child.parentNode = null;
    this._updateScroll();
    return child;
  }

  replaceChildren(...children) {
    this.childNodes = [];
    for (const child of children) this.appendChild(child);
  }

  _updateScroll() {
    this.scrollHeight = this.childNodes.length * 20;
  }

  querySelector(selector) {
    if (!selector) return null;
    return querySelectorImpl(this, selector);
  }

  querySelectorAll(selector) {
    if (!selector) return [];
    const tokens = selector.trim().split(/\s+/);
    const out = [];
    walk(this, (node) => {
      if (matchesChain(node, tokens)) out.push(node);
    });
    return out;
  }

  addEventListener(type, handler) {
    if (typeof handler !== 'function') return;
    let set = this._listeners.get(type);
    if (!set) {
      set = new Set();
      this._listeners.set(type, set);
    }
    set.add(handler);
  }

  removeEventListener(type, handler) {
    const set = this._listeners.get(type);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this._listeners.delete(type);
  }

  dispatchEvent(event) {
    const type = (event && event.type) || event;
    const set = this._listeners.get(type);
    if (!set) return true;
    const evt = typeof event === 'string' ? { type: event, target: this } : event;
    for (const handler of Array.from(set)) handler(evt);
    return true;
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this });
  }
}

function kebab(name) {
  return name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function classListOf(node) {
  return (node.className || '').split(/\s+/).filter(Boolean);
}

function matches(node, selector) {
  if (!node || node.nodeType === 3) return false;
  const s = selector.trim();
  if (s.startsWith('.')) return classListOf(node).includes(s.slice(1));
  if (s.startsWith('#')) return node.getAttribute('id') === s.slice(1);
  if (s.startsWith('[')) {
    // [name="value"] or [name]
    const m = s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if (!m) return false;
    const name = m[1];
    const value = m[2];
    if (value === undefined) return node.hasAttribute && node.hasAttribute(name);
    return node.getAttribute && node.getAttribute(name) === value;
  }
  return (node.tagName || '').toLowerCase() === s.toLowerCase();
}

function walk(node, fn) {
  if (!node || !node.childNodes) return;
  for (const child of node.childNodes) {
    fn(child);
    walk(child, fn);
  }
}

function querySelectorImpl(root, selector) {
  const tokens = selector.trim().split(/\s+/);
  if (tokens.length === 0) return null;
  let found = null;
  walk(root, (node) => {
    if (found) return;
    if (matchesChain(node, tokens)) found = node;
  });
  return found;
}

function matchesChain(node, tokens) {
  if (!matches(node, tokens[tokens.length - 1])) return false;
  let parent = node.parentNode;
  for (let i = tokens.length - 2; i >= 0; i--) {
    let ok = false;
    while (parent) {
      if (matches(parent, tokens[i])) {
        parent = parent.parentNode;
        ok = true;
        break;
      }
      parent = parent.parentNode;
    }
    if (!ok) return false;
  }
  return true;
}

class MockDocument {
  createElement(tagName) { return new MockNode(this, tagName); }
  createTextNode(text) {
    const node = new MockNode(this, '#text');
    node.nodeType = 3;
    node._textContent = String(text);
    return node;
  }
}

export function createMockDocument() {
  return new MockDocument();
}

export function createMockContainer(doc) {
  const document = doc || createMockDocument();
  const node = new MockNode(document, 'div');
  return { document, container: node };
}

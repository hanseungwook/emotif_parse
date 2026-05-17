'use strict';

class MockNode {
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
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] || null;
  }

  get textContent() {
    if (this.childNodes.length === 0) return this._textContent;
    return this.childNodes.map((c) => c.textContent).join('');
  }

  set textContent(value) {
    this.childNodes = [];
    this._textContent = value == null ? '' : String(value);
  }

  setAttribute(name, value) {
    this._attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this._attributes.has(name) ? this._attributes.get(name) : null;
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

  _updateScroll() {
    this.scrollHeight = this.childNodes.length * 20;
  }

  querySelector(selector) {
    if (!selector || selector[0] !== '.') return null;
    const className = selector.slice(1);
    if ((this.className || '').split(' ').includes(className)) return this;
    for (const child of this.childNodes) {
      const found = child.querySelector ? child.querySelector(selector) : null;
      if (found) return found;
    }
    return null;
  }
}

class MockDocument {
  createElement(tagName) {
    return new MockNode(this, tagName);
  }
}

function createMockDocument() {
  return new MockDocument();
}

function createMockContainer(doc) {
  const document = doc || createMockDocument();
  const node = new MockNode(document, 'div');
  return { document, container: node };
}

module.exports = { MockDocument, MockNode, createMockDocument, createMockContainer };

'use strict';

// Tiny helpers shared by the racing HUD panels. They each accept a document
// implementation (real or mock), so all panels can run under `node --test`
// without a real browser.

function resolveDocument(opts) {
  if (opts && opts.document) return opts.document;
  if (opts && opts.container && opts.container.ownerDocument) {
    return opts.container.ownerDocument;
  }
  if (typeof document !== 'undefined') return document;
  if (typeof window !== 'undefined' && window.document) return window.document;
  return null;
}

function appendClass(base, addition) {
  const list = (base || '').split(' ').filter(Boolean);
  if (addition && !list.includes(addition)) list.push(addition);
  return list.join(' ');
}

function removeClass(base, removal) {
  if (!removal) return base || '';
  return (base || '').split(' ').filter((c) => c && c !== removal).join(' ');
}

function clearChildren(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function schedulerWithFallback() {
  if (typeof globalThis.setTimeout === 'function') {
    return (cb, ms) => globalThis.setTimeout(cb, ms);
  }
  return () => null;
}

function cancelWithFallback() {
  if (typeof globalThis.clearTimeout === 'function') {
    return (handle) => globalThis.clearTimeout(handle);
  }
  return () => undefined;
}

function setStyleProperty(node, name, value) {
  if (!node || !node.style) return;
  if (typeof node.style.setProperty === 'function') {
    node.style.setProperty(name, value);
  } else {
    node.style[name] = value;
  }
}

module.exports = {
  resolveDocument,
  appendClass,
  removeClass,
  clearChildren,
  schedulerWithFallback,
  cancelWithFallback,
  setStyleProperty,
};

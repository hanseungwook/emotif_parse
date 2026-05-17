'use strict';

class MockCanvasContext {
  constructor(canvas) {
    this.canvas = canvas || null;
    this.calls = [];
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this._stack = [];
    this._lineDash = [];
  }

  _record(name, args) {
    this.calls.push({
      name,
      args,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
    });
  }

  save() {
    this._stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
      lineDash: this._lineDash.slice(),
    });
    this._record('save', []);
  }

  restore() {
    const prev = this._stack.pop();
    if (prev) {
      this.fillStyle = prev.fillStyle;
      this.strokeStyle = prev.strokeStyle;
      this.lineWidth = prev.lineWidth;
      this.globalAlpha = prev.globalAlpha;
      this.font = prev.font;
      this.textAlign = prev.textAlign;
      this.textBaseline = prev.textBaseline;
      this._lineDash = prev.lineDash;
    }
    this._record('restore', []);
  }

  clearRect(x, y, w, h) {
    this._record('clearRect', [x, y, w, h]);
  }

  fillRect(x, y, w, h) {
    this._record('fillRect', [x, y, w, h]);
  }

  strokeRect(x, y, w, h) {
    this._record('strokeRect', [x, y, w, h]);
  }

  beginPath() {
    this._record('beginPath', []);
  }

  moveTo(x, y) {
    this._record('moveTo', [x, y]);
  }

  lineTo(x, y) {
    this._record('lineTo', [x, y]);
  }

  stroke() {
    this._record('stroke', []);
  }

  fillText(text, x, y) {
    this._record('fillText', [text, x, y]);
  }

  setLineDash(dash) {
    this._lineDash = Array.isArray(dash) ? dash.slice() : [];
    this._record('setLineDash', [dash]);
  }

  getLineDash() {
    return this._lineDash.slice();
  }

  reset() {
    this.calls = [];
  }

  callsByName(name) {
    return this.calls.filter(function (c) {
      return c.name === name;
    });
  }
}

class MockCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.style = {};
    this._ctx = new MockCanvasContext(this);
  }
  getContext(type) {
    if (type !== '2d') return null;
    return this._ctx;
  }
}

function createMockCanvas() {
  return new MockCanvas();
}

module.exports = { MockCanvas, MockCanvasContext, createMockCanvas };

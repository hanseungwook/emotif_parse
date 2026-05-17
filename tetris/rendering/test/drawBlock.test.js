'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { drawFilledBlock, drawGhostBlock, drawClearingBlock } = require('../drawBlock');
const { MockCanvasContext } = require('./mockCanvas');
const { TETROMINO_COLORS } = require('../palette');

const RECT = { x: 10, y: 20, width: 30, height: 30 };

test('drawFilledBlock paints dark, base, and highlight layers', () => {
  const ctx = new MockCanvasContext();
  drawFilledBlock(ctx, RECT, 'T');

  const fills = ctx.callsByName('fillRect');
  assert.ok(fills.length >= 3, 'expected multiple fillRect calls');

  const darkCall = fills.find((c) => c.fillStyle === TETROMINO_COLORS.T.dark);
  const baseCall = fills.find((c) => c.fillStyle === TETROMINO_COLORS.T.base);
  const lightCall = fills.find((c) => c.fillStyle === TETROMINO_COLORS.T.light);
  assert.ok(darkCall, 'dark layer drawn');
  assert.ok(baseCall, 'base layer drawn');
  assert.ok(lightCall, 'light highlight drawn');

  assert.deepEqual(darkCall.args, [10, 20, 30, 30]);
});

test('drawFilledBlock supports highlight overlay', () => {
  const ctx = new MockCanvasContext();
  drawFilledBlock(ctx, RECT, 'I', { highlight: true });
  const highlight = ctx.callsByName('fillRect').find((c) => c.fillStyle === 'rgba(255,255,255,0.35)');
  assert.ok(highlight, 'expected highlight overlay fill');
});

test('drawFilledBlock honors alpha option', () => {
  const ctx = new MockCanvasContext();
  drawFilledBlock(ctx, RECT, 'I', { alpha: 0.5 });
  const baseCall = ctx.callsByName('fillRect').find((c) => c.fillStyle === TETROMINO_COLORS.I.base);
  assert.ok(baseCall);
  assert.equal(baseCall.globalAlpha, 0.5);
});

test('drawFilledBlock skips when rect too small', () => {
  const ctx = new MockCanvasContext();
  drawFilledBlock(ctx, { x: 0, y: 0, width: 0, height: 0 }, 'I');
  assert.equal(ctx.callsByName('fillRect').length, 0);
});

test('drawGhostBlock paints translucent fill and dashed stroke', () => {
  const ctx = new MockCanvasContext();
  drawGhostBlock(ctx, RECT, 'L');
  const dashCalls = ctx.callsByName('setLineDash');
  assert.ok(dashCalls.length > 0, 'expected setLineDash');
  assert.ok(ctx.callsByName('strokeRect').length > 0, 'expected strokeRect');
});

test('drawGhostBlock uses ghost stroke color', () => {
  const ctx = new MockCanvasContext();
  drawGhostBlock(ctx, RECT, 'J');
  const stroke = ctx.callsByName('strokeRect')[0];
  assert.equal(stroke.strokeStyle, TETROMINO_COLORS.J.light);
});

test('drawClearingBlock fades out as progress approaches 1', () => {
  const ctx = new MockCanvasContext();
  drawClearingBlock(ctx, RECT, 'O', 0.5);
  const fills = ctx.callsByName('fillRect');
  assert.ok(fills.length >= 1);
  for (const fill of fills) {
    assert.ok(fill.globalAlpha <= 1);
    assert.ok(fill.globalAlpha >= 0);
  }
});

test('drawClearingBlock with progress=1 still safe (no negative dims)', () => {
  const ctx = new MockCanvasContext();
  drawClearingBlock(ctx, RECT, 'O', 1);
  for (const c of ctx.callsByName('fillRect')) {
    const [, , w, h] = c.args;
    assert.ok(w >= 0);
    assert.ok(h >= 0);
  }
});

test('drawClearingBlock with unknown type uses neutral palette', () => {
  const ctx = new MockCanvasContext();
  drawClearingBlock(ctx, RECT, null, 0.2);
  assert.ok(ctx.callsByName('fillRect').length >= 1);
});

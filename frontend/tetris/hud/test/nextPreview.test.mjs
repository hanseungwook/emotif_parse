import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockContainer } from './mockDom.mjs';
import { NextPreviewPanel } from '../nextPreview.mjs';

function build(slots) {
  const { document, container } = createMockContainer();
  const panel = new NextPreviewPanel({ container, document, slots });
  panel.mount();
  return { document, container, panel };
}

test('renders requested number of slots on mount', () => {
  const { container, panel } = build(5);
  assert.equal(panel.getSlotCount(), 5);
  const list = container.querySelector('.hud-next__list');
  assert.ok(list, 'list element exists');
  assert.equal(list.childNodes.length, 5);
});

test('setQueue fills slots with piece data', () => {
  const { container, panel } = build(4);
  panel.setQueue(['I', 'O', 'T', 'L']);
  const slots = container.querySelectorAll('.hud-next__slot');
  assert.equal(slots[0].getAttribute('data-piece'), 'I');
  assert.equal(slots[1].getAttribute('data-piece'), 'O');
  assert.equal(slots[2].getAttribute('data-piece'), 'T');
  assert.equal(slots[3].getAttribute('data-piece'), 'L');
  for (const slot of slots) {
    assert.equal(slot.getAttribute('aria-label')?.startsWith('Upcoming piece'), true);
  }
});

test('first slot gets the head modifier class', () => {
  const { container } = build(3);
  const slots = container.querySelectorAll('.hud-next__slot');
  assert.ok(slots[0].className.includes('hud-next__slot--head'));
  assert.ok(!slots[1].className.includes('hud-next__slot--head'));
});

test('empty slots are marked as empty', () => {
  const { container, panel } = build(3);
  panel.setQueue(['I']);
  const slots = container.querySelectorAll('.hud-next__slot');
  assert.equal(slots[0].getAttribute('data-piece'), 'I');
  assert.equal(slots[1].getAttribute('data-piece'), '');
  assert.ok(slots[1].className.includes('hud-next__slot--empty'));
  assert.equal(slots[1].getAttribute('aria-label'), 'Empty preview slot');
});

test('updating queue replaces piece content', () => {
  const { container, panel } = build(2);
  panel.setQueue(['T', 'S']);
  let slot = container.querySelectorAll('.hud-next__slot')[0];
  let pieces = slot.querySelectorAll('.hud-next__piece');
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].getAttribute('data-piece-kind'), 'T');

  panel.setQueue(['Z', 'I']);
  slot = container.querySelectorAll('.hud-next__slot')[0];
  pieces = slot.querySelectorAll('.hud-next__piece');
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].getAttribute('data-piece-kind'), 'Z');
});

test('invalid kinds are ignored (slot remains empty)', () => {
  const { container, panel } = build(2);
  panel.setQueue(['BAD', 'I']);
  const slots = container.querySelectorAll('.hud-next__slot');
  // The HUD state would normally filter these out, but the panel itself
  // tolerates malformed input by leaving the slot empty.
  assert.equal(slots[0].getAttribute('data-piece'), 'BAD');
  assert.equal(slots[0].querySelectorAll('.hud-next__piece').length, 0);
});

test('unmount clears the container', () => {
  const { container, panel } = build(3);
  panel.setQueue(['I', 'O', 'T']);
  panel.unmount();
  assert.equal(container.childNodes.length, 0);
});

test('setQueue applied before mount renders after mount', () => {
  const { document, container } = createMockContainer();
  const panel = new NextPreviewPanel({ container, document, slots: 3 });
  panel.setQueue(['L', 'J', 'S']);
  panel.mount();
  const slots = container.querySelectorAll('.hud-next__slot');
  assert.equal(slots[0].getAttribute('data-piece'), 'L');
  assert.equal(slots[1].getAttribute('data-piece'), 'J');
  assert.equal(slots[2].getAttribute('data-piece'), 'S');
});

test('renders a 4x4 grid per piece', () => {
  const { container, panel } = build(1);
  panel.setQueue(['I']);
  const rows = container.querySelectorAll('.hud-next__row');
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert.equal(row.childNodes.length, 4);
  }
  const filled = container.querySelectorAll('.hud-next__cell--filled');
  assert.equal(filled.length, 4); // I-piece has 4 filled cells
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockContainer, createTestScheduler } = require('./mockDom');
const { MessageFeed } = require('../messageFeed');

function build(opts) {
  const { document, container } = createMockContainer();
  const { scheduler, cancel, advance } = createTestScheduler();
  const feed = new MessageFeed({
    container,
    document,
    scheduler,
    cancelScheduler: cancel,
    ...(opts || {}),
  });
  feed.mount();
  return { document, container, feed, advance };
}

test('renders an empty list initially', () => {
  const { container } = build();
  assert.ok(container.className.includes('hud-messages--empty'));
  assert.equal(container.querySelector('[data-role="message-list"]').childNodes.length, 0);
});

test('push adds an item with category class and removes the empty modifier', () => {
  const { container, feed } = build();
  feed.push({ id: 'a', text: 'Lap 1', category: 'lap' });
  const items = container.querySelectorAll('[data-message-id]');
  assert.equal(items.length, 1);
  assert.equal(items[0].getAttribute('data-category'), 'lap');
  assert.ok(items[0].className.includes('hud-messages__item--lap'));
  assert.ok(!container.className.includes('hud-messages--empty'));
});

test('items expire after their durationMs', () => {
  const { container, feed, advance } = build();
  feed.push({ id: 'a', text: 'Boost!', durationMs: 1000 });
  feed.push({ id: 'b', text: 'Collision', durationMs: 4000 });
  advance(1200);
  assert.equal(container.querySelectorAll('[data-message-id]').length, 1);
  advance(3000);
  assert.equal(container.querySelectorAll('[data-message-id]').length, 0);
});

test('dismiss removes the entry after exit animation', () => {
  const { container, feed, advance } = build();
  feed.push({ id: 'a', text: 'Foo', durationMs: 5000 });
  feed.dismiss('a');
  // Exit animation pending — still in DOM but flagged as exiting.
  const exiting = container.querySelector('[data-message-id="a"]');
  assert.ok(exiting.className.includes('hud-messages__item--exiting'));
  advance(300);
  assert.equal(container.querySelectorAll('[data-message-id="a"]').length, 0);
});

test('respects maxVisible by trimming oldest messages', () => {
  const { container, feed } = build({ maxVisible: 2 });
  feed.push({ id: 'a', text: 'one' });
  feed.push({ id: 'b', text: 'two' });
  feed.push({ id: 'c', text: 'three' });
  const ids = container
    .querySelectorAll('[data-message-id]')
    .map((n) => n.getAttribute('data-message-id'));
  assert.deepEqual(ids, ['b', 'c']);
});

test('clear removes every entry and re-applies empty modifier', () => {
  const { container, feed } = build();
  feed.push({ id: 'a', text: 'one' });
  feed.push({ id: 'b', text: 'two' });
  feed.clear();
  assert.equal(container.querySelectorAll('[data-message-id]').length, 0);
  assert.ok(container.className.includes('hud-messages--empty'));
});

test('list() returns the visible queue', () => {
  const { feed } = build();
  feed.push({ id: 'a', text: 'one', category: 'lap' });
  feed.push({ id: 'b', text: 'two', category: 'collision' });
  const out = feed.list();
  assert.deepEqual(out, [
    { id: 'a', text: 'one', category: 'lap' },
    { id: 'b', text: 'two', category: 'collision' },
  ]);
});

test('push with empty text is a no-op', () => {
  const { feed, container } = build();
  const result = feed.push({ text: '' });
  assert.equal(result, null);
  assert.equal(container.querySelectorAll('[data-message-id]').length, 0);
});

test('push with duplicate id is rejected', () => {
  const { feed, container } = build();
  feed.push({ id: 'a', text: 'one' });
  const dup = feed.push({ id: 'a', text: 'one-again' });
  assert.equal(dup, null);
  assert.equal(container.querySelectorAll('[data-message-id]').length, 1);
});

test('unmount cancels pending timers', () => {
  const { feed, advance, container } = build();
  feed.push({ id: 'a', text: 'one', durationMs: 500 });
  feed.unmount();
  advance(1000);
  assert.equal(container.childNodes.length, 0);
});

test('throws when constructed without a container', () => {
  assert.throws(() => new MessageFeed({}), /requires a container/);
});

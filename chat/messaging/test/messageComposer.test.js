'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageComposer } = require('../messageComposer');
const { ValidationError } = require('../errors');

function fakeRuntime() {
  const sent = [];
  return {
    sent,
    currentUser: { id: 'u1' },
    sendMessage(input) {
      sent.push(input);
      return Promise.resolve({ ...input, status: 'delivered', id: 'srv1' });
    },
  };
}

test('setBody emits change event', () => {
  const runtime = fakeRuntime();
  const composer = new MessageComposer({ runtime, conversationId: 'c1' });
  const changes = [];
  composer.on('change', (evt) => changes.push(evt));
  composer.setBody('hello');
  assert.equal(changes.length, 1);
  assert.equal(changes[0].draft, 'hello');
});

test('validate throws on empty draft', () => {
  const runtime = fakeRuntime();
  const composer = new MessageComposer({ runtime, conversationId: 'c1' });
  assert.throws(() => composer.validate(), ValidationError);
});

test('validate enforces maxLength', () => {
  const runtime = fakeRuntime();
  const composer = new MessageComposer({ runtime, conversationId: 'c1', maxLength: 3 });
  composer.setBody('toolong');
  assert.throws(() => composer.validate(), ValidationError);
});

test('canSend reflects validity and sending state', async () => {
  const runtime = fakeRuntime();
  const composer = new MessageComposer({ runtime, conversationId: 'c1' });
  assert.equal(composer.canSend(), false);
  composer.setBody('hello');
  assert.equal(composer.canSend(), true);
  await composer.send();
});

test('send clears draft and forwards to runtime', async () => {
  const runtime = fakeRuntime();
  const composer = new MessageComposer({ runtime, conversationId: 'c1' });
  composer.setBody('hi there');
  const sentEvents = [];
  composer.on('sent', (e) => sentEvents.push(e));
  const result = await composer.send();
  assert.equal(result.body, 'hi there');
  assert.equal(composer.draft, '');
  assert.equal(runtime.sent.length, 1);
  assert.equal(runtime.sent[0].body, 'hi there');
  assert.equal(sentEvents.length, 1);
});

test('send restores draft on failure', async () => {
  const runtime = {
    sendMessage() {
      return Promise.reject(new Error('network down'));
    },
  };
  const composer = new MessageComposer({ runtime, conversationId: 'c1', authorId: 'u1' });
  composer.setBody('hello');
  const errors = [];
  composer.on('error', (e) => errors.push(e));
  await assert.rejects(composer.send(), /network down/);
  assert.equal(composer.draft, 'hello');
  assert.equal(errors.length, 1);
});

test('appendBody adds to existing draft', () => {
  const runtime = fakeRuntime();
  const composer = new MessageComposer({ runtime, conversationId: 'c1' });
  composer.setBody('hello');
  composer.appendBody(' world');
  assert.equal(composer.draft, 'hello world');
});

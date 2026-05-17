'use strict';

const { EventEmitter } = require('./eventEmitter');
const { ConversationStore, MESSAGE_STATUS } = require('./conversationStore');
const { RealtimeChannel, CONNECTION_STATE } = require('./realtimeChannel');
const { MessagingRuntime } = require('./messagingRuntime');
const { MessageComposer } = require('./messageComposer');
const { MessageRenderer } = require('./messageRenderer');
const {
  MessagingError,
  ChannelNotConnectedError,
  MessageDeliveryError,
  ValidationError,
} = require('./errors');
const { createIdGenerator, defaultClock } = require('./ids');
const {
  compareMessages,
  findInsertIndex,
  insertSorted,
  detectGaps,
} = require('./ordering');
const {
  InMemoryChannelTransport,
  createInMemoryTransportFactory,
  InMemoryBroker,
  createBrokerTransportFactory,
} = require('./inMemoryChannel');

function createMessagingRuntime(options) {
  const opts = options || {};
  const store = opts.store || new ConversationStore();
  let channel = opts.channel;
  if (!channel) {
    if (!opts.transportFactory) {
      throw new TypeError(
        'createMessagingRuntime requires either a channel or a transportFactory'
      );
    }
    channel = new RealtimeChannel({
      endpoint: opts.endpoint,
      transportFactory: opts.transportFactory,
      scheduler: opts.scheduler,
      reconnect: opts.reconnect,
    });
  }
  return new MessagingRuntime({
    store,
    channel,
    currentUser: opts.currentUser,
    clock: opts.clock,
    idGenerator: opts.idGenerator,
    scheduler: opts.scheduler,
    cancelScheduler: opts.cancelScheduler,
    retry: opts.retry,
    ackTimeoutMs: opts.ackTimeoutMs,
  });
}

module.exports = {
  createMessagingRuntime,
  MessagingRuntime,
  ConversationStore,
  RealtimeChannel,
  MessageComposer,
  MessageRenderer,
  EventEmitter,
  MESSAGE_STATUS,
  CONNECTION_STATE,
  MessagingError,
  ChannelNotConnectedError,
  MessageDeliveryError,
  ValidationError,
  createIdGenerator,
  defaultClock,
  compareMessages,
  findInsertIndex,
  insertSorted,
  detectGaps,
  InMemoryChannelTransport,
  createInMemoryTransportFactory,
  InMemoryBroker,
  createBrokerTransportFactory,
};

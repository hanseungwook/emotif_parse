'use strict';

class MessagingError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'MessagingError';
    this.code = code || 'MESSAGING_ERROR';
  }
}

class ChannelNotConnectedError extends MessagingError {
  constructor(message) {
    super(message || 'Realtime channel is not connected', 'CHANNEL_NOT_CONNECTED');
    this.name = 'ChannelNotConnectedError';
  }
}

class MessageDeliveryError extends MessagingError {
  constructor(message, cause) {
    super(message || 'Message delivery failed', 'MESSAGE_DELIVERY_FAILED');
    this.name = 'MessageDeliveryError';
    if (cause) this.cause = cause;
  }
}

class ValidationError extends MessagingError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

module.exports = {
  MessagingError,
  ChannelNotConnectedError,
  MessageDeliveryError,
  ValidationError,
};

'use strict';

function defaultClock() {
  return Date.now();
}

function createIdGenerator(prefix = 'cli') {
  let counter = 0;
  return function generateId() {
    counter += 1;
    const random = Math.random().toString(36).slice(2, 10);
    const ts = Date.now().toString(36);
    return `${prefix}_${ts}_${counter}_${random}`;
  };
}

module.exports = { defaultClock, createIdGenerator };

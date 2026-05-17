'use strict';

const POSITIVE_INFINITY = Number.POSITIVE_INFINITY;

function sequenceKey(message) {
  if (typeof message.sequence === 'number' && Number.isFinite(message.sequence)) {
    return message.sequence;
  }
  return POSITIVE_INFINITY;
}

function compareMessages(a, b) {
  const sa = sequenceKey(a);
  const sb = sequenceKey(b);
  if (sa !== sb) return sa < sb ? -1 : 1;

  const ta = a.createdAt || 0;
  const tb = b.createdAt || 0;
  if (ta !== tb) return ta < tb ? -1 : 1;

  const ka = a.clientId || a.id || '';
  const kb = b.clientId || b.id || '';
  if (ka === kb) return 0;
  return ka < kb ? -1 : 1;
}

function findInsertIndex(sortedList, message) {
  let lo = 0;
  let hi = sortedList.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareMessages(sortedList[mid], message) <= 0) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function insertSorted(sortedList, message) {
  const idx = findInsertIndex(sortedList, message);
  sortedList.splice(idx, 0, message);
  return idx;
}

function detectGaps(sortedList) {
  const gaps = [];
  let prev = null;
  for (const msg of sortedList) {
    if (typeof msg.sequence !== 'number') continue;
    if (prev !== null && msg.sequence - prev > 1) {
      gaps.push({ from: prev + 1, to: msg.sequence - 1 });
    }
    prev = msg.sequence;
  }
  return gaps;
}

module.exports = {
  compareMessages,
  findInsertIndex,
  insertSorted,
  detectGaps,
};

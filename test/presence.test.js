//================ Presence Tests ================//
//================================================//
// Lightweight node-only tests. No external test framework
// dependency — verifies the client debounce/typing-event
// state machine and the server-side activity classifier.

var assert = require("assert");
var PresenceClient = require("../client/presence.js");

// Fake transport that records calls and resolves immediately.
function makeTransport() {
    var calls = [];
    return {
        calls: calls,
        call: function(name, params) {
            calls.push({ name: name, params: params });
            return Promise.resolve({ typing: [] });
        }
    };
}

// Fake clock/scheduler so we can drive timers deterministically.
function makeClock() {
    var now = 0;
    var nextId = 1;
    var pending = {};
    return {
        now: function() { return now; },
        setTimeout: function(fn, delay) {
            var id = nextId++;
            pending[id] = { fireAt: now + delay, fn: fn, interval: false };
            return id;
        },
        clearTimeout: function(id) { delete pending[id]; },
        setInterval: function(fn, delay) {
            var id = nextId++;
            pending[id] = { fireAt: now + delay, fn: fn, interval: true, delay: delay };
            return id;
        },
        clearInterval: function(id) { delete pending[id]; },
        advance: function(ms) {
            var target = now + ms;
            // Fire timers in order until we reach the target.
            while (true) {
                var nextKey = null;
                var nextAt = Infinity;
                for (var k in pending) {
                    if (pending[k].fireAt <= target && pending[k].fireAt < nextAt) {
                        nextAt = pending[k].fireAt;
                        nextKey = k;
                    }
                }
                if (nextKey === null) break;
                var entry = pending[nextKey];
                now = entry.fireAt;
                if (entry.interval) {
                    entry.fireAt = now + entry.delay;
                } else {
                    delete pending[nextKey];
                }
                entry.fn();
            }
            now = target;
        }
    };
}

function newClient(extra) {
    var clock = makeClock();
    var transport = makeTransport();
    var opts = {
        transport: transport,
        typingDebounceMs: 400,
        typingStopMs: 3000,
        heartbeatMs: 30000,
        pollMs: 2000,
        now: clock.now,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        setInterval: clock.setInterval,
        clearInterval: clock.clearInterval
    };
    for (var k in (extra || {})) opts[k] = extra[k];
    return { client: new PresenceClient(opts), transport: transport, clock: clock };
}

function countCalls(transport, name) {
    return transport.calls.filter(function(c) { return c.name === name; }).length;
}

function lastCall(transport, name) {
    var matches = transport.calls.filter(function(c) { return c.name === name; });
    return matches[matches.length - 1];
}

// --- Tests ---

function testDebounceCoalescesRapidKeystrokes() {
    var env = newClient();
    env.client.setActiveConversation("conv-1");
    env.transport.calls.length = 0; // ignore initial poll

    // Five rapid keystrokes within debounce window.
    for (var i = 0; i < 5; i++) {
        env.client.handleInputActivity("conv-1");
        env.clock.advance(50);
    }
    // Before debounce elapses, no start_typing yet.
    var startsBefore = env.transport.calls.filter(function(c) {
        return c.name === "setTypingStatus" && c.params.isTyping === true;
    }).length;
    assert.strictEqual(startsBefore, 0, "no start sent during debounce window");

    env.clock.advance(400);
    var startsAfter = env.transport.calls.filter(function(c) {
        return c.name === "setTypingStatus" && c.params.isTyping === true;
    }).length;
    assert.strictEqual(startsAfter, 1, "exactly one start_typing after debounce");
}

function testAutoStopAfterIdle() {
    var env = newClient();
    env.client.setActiveConversation("conv-2");
    env.transport.calls.length = 0;

    env.client.handleInputActivity("conv-2");
    env.clock.advance(400); // fires start
    assert.strictEqual(
        countCalls(env.transport, "setTypingStatus"), 1,
        "start_typing sent after debounce"
    );

    // No further activity — stop timer should fire after typingStopMs.
    env.clock.advance(3000);
    var stop = lastCall(env.transport, "setTypingStatus");
    assert.strictEqual(stop.params.isTyping, false, "stop_typing sent after silence");
}

function testStopTimerResetsOnEachKeystroke() {
    var env = newClient();
    env.client.setActiveConversation("conv-3");
    env.transport.calls.length = 0;

    env.client.handleInputActivity("conv-3");
    env.clock.advance(400); // fire start
    assert.strictEqual(countCalls(env.transport, "setTypingStatus"), 1);

    // Type again right before stop would fire.
    env.clock.advance(2500);
    env.client.handleInputActivity("conv-3");
    env.clock.advance(2500);

    // Still typing — no stop yet because timer reset.
    assert.strictEqual(
        countCalls(env.transport, "setTypingStatus"), 1,
        "stop should not fire while user keeps typing"
    );

    env.clock.advance(600);
    var stop = lastCall(env.transport, "setTypingStatus");
    assert.strictEqual(stop.params.isTyping, false, "stop fires once user pauses long enough");
}

function testMessageSentClearsTyping() {
    var env = newClient();
    env.client.setActiveConversation("conv-4");
    env.transport.calls.length = 0;

    env.client.handleInputActivity("conv-4");
    env.clock.advance(400);
    assert.strictEqual(env.client.typingState, true);

    env.client.handleMessageSent("conv-4");
    assert.strictEqual(env.client.typingState, false);
    assert.strictEqual(
        countCalls(env.transport, "clearTypingOnSend"), 1,
        "clearTypingOnSend invoked"
    );

    // Subsequent silence should not produce a stop_typing — already cleared.
    env.clock.advance(5000);
    var stops = env.transport.calls.filter(function(c) {
        return c.name === "setTypingStatus" && c.params.isTyping === false;
    });
    assert.strictEqual(stops.length, 0, "no stop_typing after message send clears state");
}

function testSwitchingConversationSendsStopForPrevious() {
    var env = newClient();
    env.client.setActiveConversation("conv-A");
    env.transport.calls.length = 0;

    env.client.handleInputActivity("conv-A");
    env.clock.advance(400);
    assert.strictEqual(env.client.typingState, true);

    env.client.setActiveConversation("conv-B");
    var stop = env.transport.calls.filter(function(c) {
        return c.name === "setTypingStatus" && c.params.conversationId === "conv-A" && c.params.isTyping === false;
    });
    assert.strictEqual(stop.length, 1, "stop_typing sent for previous conversation");
    assert.strictEqual(env.client.activeConversationId, "conv-B");
}

function testSubscriberReceivesTypingUpdates() {
    var fakeTyping = [{ userId: "u9", username: "alex" }];
    var clock = makeClock();
    var transport = {
        calls: [],
        call: function(name, params) {
            this.calls.push({ name: name, params: params });
            if (name === "getTypingStatus") {
                return Promise.resolve({ typing: fakeTyping });
            }
            return Promise.resolve({});
        }
    };
    var client = new PresenceClient({
        transport: transport,
        typingDebounceMs: 400,
        typingStopMs: 3000,
        pollMs: 2000,
        now: clock.now,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        setInterval: clock.setInterval,
        clearInterval: clock.clearInterval
    });

    var received = [];
    client.subscribe("conv-X", function(payload) { received.push(payload); });
    client.setActiveConversation("conv-X");

    return new Promise(function(resolve) {
        // Initial tick is sync-dispatched; resolution is async — wait a turn.
        setTimeout(function() {
            assert.ok(received.length >= 1, "subscriber notified after poll");
            assert.deepStrictEqual(received[0].typing, fakeTyping);
            resolve();
        }, 10);
    });
}

function testDestroyCleansUpAndStops() {
    var env = newClient();
    env.client.setActiveConversation("conv-D");
    env.transport.calls.length = 0;

    env.client.handleInputActivity("conv-D");
    env.clock.advance(400);
    env.client.destroy();

    var stops = env.transport.calls.filter(function(c) {
        return c.name === "setTypingStatus" && c.params.isTyping === false;
    });
    assert.strictEqual(stops.length, 1, "destroy sends final stop_typing");
    assert.strictEqual(env.client.activeConversationId, null);
}

// Server-side classifier check. We don't bring up Parse here — just
// require the file with a stubbed Parse.Cloud so it doesn't blow up.
function testActivityClassifier() {
    global.Parse = {
        Cloud: {
            define: function() {},
            beforeSave: function() {}
        },
        Object: { extend: function() { return function() {}; } },
        Query: function() {},
        ACL: function() {}
    };
    // Stash STRIPEAPIKEY so the unrelated stripe require doesn't crash.
    var presence = require("../cloud/presence.js");
    var now = Date.now();
    assert.strictEqual(presence.classifyActivity(now), "active");
    assert.strictEqual(presence.classifyActivity(now - 90 * 1000), "idle");
    assert.strictEqual(presence.classifyActivity(now - 10 * 60 * 1000), "offline");
}

// --- Runner ---

var sync = [
    ["debounce coalesces rapid keystrokes", testDebounceCoalescesRapidKeystrokes],
    ["auto stop after idle window", testAutoStopAfterIdle],
    ["stop timer resets on each keystroke", testStopTimerResetsOnEachKeystroke],
    ["message sent clears typing immediately", testMessageSentClearsTyping],
    ["switching conversation stops typing in previous", testSwitchingConversationSendsStopForPrevious],
    ["destroy cleans up and sends final stop", testDestroyCleansUpAndStops],
    ["activity classifier buckets correctly", testActivityClassifier]
];

var async = [
    ["subscriber receives typing updates", testSubscriberReceivesTypingUpdates]
];

var failed = 0;
sync.forEach(function(t) {
    try {
        t[1]();
        console.log("  ok  - " + t[0]);
    } catch (e) {
        failed++;
        console.log("  FAIL - " + t[0]);
        console.log("    " + (e.stack || e.message));
    }
});

Promise.all(async.map(function(t) {
    return Promise.resolve()
        .then(function() { return t[1](); })
        .then(function() { console.log("  ok  - " + t[0]); })
        ["catch"](function(e) {
            failed++;
            console.log("  FAIL - " + t[0]);
            console.log("    " + (e.stack || e.message));
        });
})).then(function() {
    if (failed > 0) {
        console.log("\n" + failed + " test(s) failed");
        process.exit(1);
    } else {
        console.log("\nAll tests passed");
    }
});

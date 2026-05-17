//================ Presence Client ================//
//=================================================//
// Browser/Node client module for typing indicators,
// participant activity state, and UI binding tied
// to the currently active conversation.

(function(root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.PresenceClient = factory();
    }
}(typeof self !== "undefined" ? self : this, function() {

    var DEFAULT_TYPING_DEBOUNCE_MS = 400;
    var DEFAULT_TYPING_STOP_MS = 3000;
    var DEFAULT_ACTIVITY_HEARTBEAT_MS = 30 * 1000;
    var DEFAULT_TYPING_POLL_MS = 2000;

    function noop() {}

    function PresenceClient(options) {
        options = options || {};
        this.transport = options.transport || defaultParseTransport();
        this.typingDebounceMs = options.typingDebounceMs || DEFAULT_TYPING_DEBOUNCE_MS;
        this.typingStopMs = options.typingStopMs || DEFAULT_TYPING_STOP_MS;
        this.heartbeatMs = options.heartbeatMs || DEFAULT_ACTIVITY_HEARTBEAT_MS;
        this.pollMs = options.pollMs || DEFAULT_TYPING_POLL_MS;
        this.now = options.now || function() { return Date.now(); };
        this.setTimeoutFn = options.setTimeout || setTimeout;
        this.clearTimeoutFn = options.clearTimeout || clearTimeout;
        this.setIntervalFn = options.setInterval || setInterval;
        this.clearIntervalFn = options.clearInterval || clearInterval;

        this.activeConversationId = null;
        this.typingState = false;
        this.lastStartSentAt = 0;
        this.startDebounceTimer = null;
        this.stopTimer = null;
        this.heartbeatTimer = null;
        this.pollTimer = null;
        this.subscribers = {};
        this.cleanupHandlers = [];
    }

    PresenceClient.prototype.setActiveConversation = function(conversationId) {
        if (this.activeConversationId === conversationId) return;
        var previous = this.activeConversationId;
        if (previous) {
            this._sendStopTyping(previous);
        }
        this._cancelTimers();
        this.activeConversationId = conversationId;
        this.typingState = false;
        if (conversationId) {
            this._startPolling(conversationId);
        }
    };

    // Call on every keystroke. Debounces a single "start_typing" event and
    // schedules an automatic "stop_typing" after typingStopMs of silence.
    PresenceClient.prototype.handleInputActivity = function(conversationId) {
        conversationId = conversationId || this.activeConversationId;
        if (!conversationId) return;

        var self = this;

        if (this.stopTimer) {
            this.clearTimeoutFn(this.stopTimer);
            this.stopTimer = null;
        }

        if (!this.typingState) {
            if (this.startDebounceTimer) this.clearTimeoutFn(this.startDebounceTimer);
            this.startDebounceTimer = this.setTimeoutFn(function() {
                self.startDebounceTimer = null;
                self._sendStartTyping(conversationId);
            }, this.typingDebounceMs);
        }

        this.stopTimer = this.setTimeoutFn(function() {
            self.stopTimer = null;
            self._sendStopTyping(conversationId);
        }, this.typingStopMs);
    };

    // Call when the user sends a message: immediately clears the typing flag.
    PresenceClient.prototype.handleMessageSent = function(conversationId) {
        conversationId = conversationId || this.activeConversationId;
        if (!conversationId) return;
        if (this.startDebounceTimer) {
            this.clearTimeoutFn(this.startDebounceTimer);
            this.startDebounceTimer = null;
        }
        if (this.stopTimer) {
            this.clearTimeoutFn(this.stopTimer);
            this.stopTimer = null;
        }
        if (this.typingState) {
            this.typingState = false;
            this.transport.call("clearTypingOnSend", { conversationId: conversationId })["catch"](noop);
        }
    };

    PresenceClient.prototype._sendStartTyping = function(conversationId) {
        this.typingState = true;
        this.lastStartSentAt = this.now();
        this.transport.call("setTypingStatus", {
            conversationId: conversationId,
            isTyping: true
        })["catch"](noop);
    };

    PresenceClient.prototype._sendStopTyping = function(conversationId) {
        if (!this.typingState) return;
        this.typingState = false;
        this.transport.call("setTypingStatus", {
            conversationId: conversationId,
            isTyping: false
        })["catch"](noop);
    };

    // Bind a text input to the active conversation. Returns a detach function.
    PresenceClient.prototype.attachToInput = function(input, conversationId) {
        var self = this;
        if (conversationId) this.setActiveConversation(conversationId);

        function onInput() { self.handleInputActivity(self.activeConversationId); }
        function onBlur() { self._sendStopTyping(self.activeConversationId); }

        input.addEventListener("input", onInput);
        input.addEventListener("blur", onBlur);

        var detach = function() {
            input.removeEventListener("input", onInput);
            input.removeEventListener("blur", onBlur);
        };
        this.cleanupHandlers.push(detach);
        return detach;
    };

    // Subscribe to typing/activity updates for a conversation. Callback
    // receives { typing: [...], at: timestamp }. Returns an unsubscribe fn.
    PresenceClient.prototype.subscribe = function(conversationId, callback) {
        if (!this.subscribers[conversationId]) this.subscribers[conversationId] = [];
        this.subscribers[conversationId].push(callback);
        var self = this;
        return function() {
            var list = self.subscribers[conversationId] || [];
            var idx = list.indexOf(callback);
            if (idx >= 0) list.splice(idx, 1);
        };
    };

    PresenceClient.prototype._emit = function(conversationId, payload) {
        var list = this.subscribers[conversationId] || [];
        for (var i = 0; i < list.length; i++) {
            try { list[i](payload); } catch (e) { /* ignore subscriber errors */ }
        }
    };

    PresenceClient.prototype._startPolling = function(conversationId) {
        var self = this;
        var tick = function() {
            if (self.activeConversationId !== conversationId) return;
            self.transport.call("getTypingStatus", { conversationId: conversationId })
                .then(function(result) {
                    if (self.activeConversationId !== conversationId) return;
                    self._emit(conversationId, {
                        typing: (result && result.typing) || [],
                        at: self.now()
                    });
                })["catch"](noop);
        };
        tick();
        this.pollTimer = this.setIntervalFn(tick, this.pollMs);
    };

    PresenceClient.prototype.startHeartbeat = function() {
        var self = this;
        var beat = function() {
            self.transport.call("updateActivity", {})["catch"](noop);
        };
        beat();
        this.heartbeatTimer = this.setIntervalFn(beat, this.heartbeatMs);
    };

    PresenceClient.prototype.setActivity = function(status) {
        return this.transport.call("updateActivity", { status: status });
    };

    PresenceClient.prototype._cancelTimers = function() {
        if (this.startDebounceTimer) {
            this.clearTimeoutFn(this.startDebounceTimer);
            this.startDebounceTimer = null;
        }
        if (this.stopTimer) {
            this.clearTimeoutFn(this.stopTimer);
            this.stopTimer = null;
        }
        if (this.pollTimer) {
            this.clearIntervalFn(this.pollTimer);
            this.pollTimer = null;
        }
    };

    PresenceClient.prototype.destroy = function() {
        this._cancelTimers();
        if (this.heartbeatTimer) {
            this.clearIntervalFn(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.activeConversationId) {
            this._sendStopTyping(this.activeConversationId);
        }
        this.cleanupHandlers.forEach(function(fn) { try { fn(); } catch (e) {} });
        this.cleanupHandlers = [];
        this.subscribers = {};
        this.activeConversationId = null;
    };

    function defaultParseTransport() {
        return {
            call: function(name, params) {
                if (typeof Parse === "undefined" || !Parse.Cloud || !Parse.Cloud.run) {
                    return Promise.reject(new Error("Parse SDK not available"));
                }
                return Parse.Cloud.run(name, params);
            }
        };
    }

    PresenceClient.defaults = {
        typingDebounceMs: DEFAULT_TYPING_DEBOUNCE_MS,
        typingStopMs: DEFAULT_TYPING_STOP_MS,
        heartbeatMs: DEFAULT_ACTIVITY_HEARTBEAT_MS,
        pollMs: DEFAULT_TYPING_POLL_MS
    };

    return PresenceClient;
}));

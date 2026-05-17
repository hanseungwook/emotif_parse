//================ Presence Signals ================//
//==================================================//
// Server-side cloud functions for typing indicators
// and participant activity state in chat conversations.

var TYPING_TTL_MS = 8000;
var ACTIVITY_IDLE_MS = 60 * 1000;
var ACTIVITY_OFFLINE_MS = 5 * 60 * 1000;

function requireUser(req) {
    if (!req.user) {
        throw new Error("Authentication required");
    }
    return req.user;
}

function nowMs() {
    return Date.now();
}

function classifyActivity(lastSeenMs) {
    var delta = nowMs() - lastSeenMs;
    if (delta < ACTIVITY_IDLE_MS) return "active";
    if (delta < ACTIVITY_OFFLINE_MS) return "idle";
    return "offline";
}

// Record or refresh a user's typing state in a conversation.
// Params: conversationId (string), isTyping (bool)
Parse.Cloud.define("setTypingStatus", function(req, res) {
    var user;
    try { user = requireUser(req); } catch (e) { return res.error(e.message); }

    var conversationId = req.params.conversationId;
    var isTyping = !!req.params.isTyping;
    if (!conversationId) return res.error("conversationId is required");

    var TypingState = Parse.Object.extend("TypingState");
    var query = new Parse.Query(TypingState);
    query.equalTo("conversationId", conversationId);
    query.equalTo("user", user);

    query.first({ useMasterKey: true }).then(function(existing) {
        var state = existing || new TypingState();
        state.set("conversationId", conversationId);
        state.set("user", user);
        state.set("isTyping", isTyping);
        state.set("lastEventAt", new Date());
        return state.save(null, { useMasterKey: true });
    }).then(function(saved) {
        res.success({
            conversationId: conversationId,
            userId: user.id,
            isTyping: isTyping,
            event: isTyping ? "start_typing" : "stop_typing",
            at: saved.get("lastEventAt")
        });
    }, function(err) {
        res.error("Failed to set typing status: " + (err && err.message));
    });
});

// Return participants currently typing in a conversation.
// Stale records (older than TYPING_TTL_MS) are treated as not typing.
// Params: conversationId (string)
Parse.Cloud.define("getTypingStatus", function(req, res) {
    var user;
    try { user = requireUser(req); } catch (e) { return res.error(e.message); }

    var conversationId = req.params.conversationId;
    if (!conversationId) return res.error("conversationId is required");

    var TypingState = Parse.Object.extend("TypingState");
    var query = new Parse.Query(TypingState);
    query.equalTo("conversationId", conversationId);
    query.equalTo("isTyping", true);
    query.include("user");

    query.find({ useMasterKey: true }).then(function(rows) {
        var cutoff = new Date(nowMs() - TYPING_TTL_MS);
        var typers = rows.filter(function(row) {
            var ts = row.get("lastEventAt");
            return ts && ts >= cutoff && row.get("user") && row.get("user").id !== user.id;
        }).map(function(row) {
            var u = row.get("user");
            return {
                userId: u.id,
                username: u.get("username"),
                since: row.get("lastEventAt")
            };
        });
        res.success({ conversationId: conversationId, typing: typers });
    }, function(err) {
        res.error("Failed to fetch typing status: " + (err && err.message));
    });
});

// Heartbeat for participant activity state. Status is derived from
// the most recent ping ("active" < 1m, "idle" < 5m, otherwise "offline").
// Params: status (optional override: "active" | "idle" | "offline")
Parse.Cloud.define("updateActivity", function(req, res) {
    var user;
    try { user = requireUser(req); } catch (e) { return res.error(e.message); }

    var override = req.params.status;
    var ParticipantActivity = Parse.Object.extend("ParticipantActivity");
    var query = new Parse.Query(ParticipantActivity);
    query.equalTo("user", user);

    query.first({ useMasterKey: true }).then(function(existing) {
        var record = existing || new ParticipantActivity();
        var when = new Date();
        record.set("user", user);
        record.set("lastSeenAt", when);
        if (override === "active" || override === "idle" || override === "offline") {
            record.set("explicitStatus", override);
        } else {
            record.unset("explicitStatus");
        }
        return record.save(null, { useMasterKey: true });
    }).then(function(saved) {
        var status = saved.get("explicitStatus") || classifyActivity(saved.get("lastSeenAt").getTime());
        res.success({
            userId: user.id,
            status: status,
            lastSeenAt: saved.get("lastSeenAt")
        });
    }, function(err) {
        res.error("Failed to update activity: " + (err && err.message));
    });
});

// Resolve activity state for every participant in a conversation.
// Params: participantIds (array of user objectIds)
Parse.Cloud.define("getParticipantsActivity", function(req, res) {
    try { requireUser(req); } catch (e) { return res.error(e.message); }

    var ids = req.params.participantIds || [];
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.success({ participants: [] });
    }

    var User = Parse.Object.extend("_User");
    var userPointers = ids.map(function(id) {
        var u = new User();
        u.id = id;
        return u;
    });

    var ParticipantActivity = Parse.Object.extend("ParticipantActivity");
    var query = new Parse.Query(ParticipantActivity);
    query.containedIn("user", userPointers);
    query.include("user");

    query.find({ useMasterKey: true }).then(function(rows) {
        var byUser = {};
        rows.forEach(function(row) {
            var u = row.get("user");
            if (!u) return;
            var explicit = row.get("explicitStatus");
            var lastSeen = row.get("lastSeenAt");
            byUser[u.id] = {
                userId: u.id,
                username: u.get("username"),
                status: explicit || classifyActivity(lastSeen ? lastSeen.getTime() : 0),
                lastSeenAt: lastSeen
            };
        });
        var out = ids.map(function(id) {
            return byUser[id] || { userId: id, status: "offline", lastSeenAt: null };
        });
        res.success({ participants: out });
    }, function(err) {
        res.error("Failed to fetch participants activity: " + (err && err.message));
    });
});

// Clear typing state when a message is actually sent, so the UI doesn't
// have to wait for the TTL to expire.
Parse.Cloud.define("clearTypingOnSend", function(req, res) {
    var user;
    try { user = requireUser(req); } catch (e) { return res.error(e.message); }

    var conversationId = req.params.conversationId;
    if (!conversationId) return res.error("conversationId is required");

    var TypingState = Parse.Object.extend("TypingState");
    var query = new Parse.Query(TypingState);
    query.equalTo("conversationId", conversationId);
    query.equalTo("user", user);

    query.first({ useMasterKey: true }).then(function(existing) {
        if (!existing) return null;
        existing.set("isTyping", false);
        existing.set("lastEventAt", new Date());
        return existing.save(null, { useMasterKey: true });
    }).then(function() {
        res.success({ conversationId: conversationId, cleared: true });
    }, function(err) {
        res.error("Failed to clear typing: " + (err && err.message));
    });
});

// Lock down TypingState so users can only mutate their own row.
Parse.Cloud.beforeSave("TypingState", function(req, res) {
    if (!req.master && req.user) {
        var owner = req.object.get("user");
        if (owner && owner.id !== req.user.id) {
            return res.error("Cannot modify another user's typing state");
        }
        var acl = new Parse.ACL();
        acl.setPublicReadAccess(true);
        acl.setWriteAccess(req.user, true);
        req.object.setACL(acl);
    }
    res.success();
});

Parse.Cloud.beforeSave("ParticipantActivity", function(req, res) {
    if (!req.master && req.user) {
        var owner = req.object.get("user");
        if (owner && owner.id !== req.user.id) {
            return res.error("Cannot modify another user's activity");
        }
        var acl = new Parse.ACL();
        acl.setPublicReadAccess(true);
        acl.setWriteAccess(req.user, true);
        req.object.setACL(acl);
    }
    res.success();
});

module.exports = {
    TYPING_TTL_MS: TYPING_TTL_MS,
    ACTIVITY_IDLE_MS: ACTIVITY_IDLE_MS,
    ACTIVITY_OFFLINE_MS: ACTIVITY_OFFLINE_MS,
    classifyActivity: classifyActivity
};

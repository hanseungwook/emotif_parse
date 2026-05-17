//=================Cloud Functions=================//
//=================================================//

// Test stripe key for dev, change stripe key for live
var stripe = require('stripe')(process.env.STRIPEAPIKEY),
    mongoose = require('mongoose');

const uuidV1 = require('uuid/v1');

// Presence signals subsystem: typing indicators, participant activity.
require('./presence.js');

// mongoose.connect(process.env.MONGODB_URI);

// Test hello function
Parse.Cloud.define("hello", function(req, res) {
    res.success('hi');
});

Parse.Cloud.define("test", function(req, res) {
    var test1 = req.params.email || req.body.email;
    res.success(test1);
});

// Setting ACL setings for UserProfile class before saving
Parse.Cloud.beforeSave("UserProfile", function(req, res) {
    var acl = new Parse.ACL();
    acl.setReadAccess(req.user, true);
    acl.setWriteAccess(req.user, true);
    req.object.setACL(acl);
    res.success();
});

// Creating stripe token for cards
Parse.Cloud.define("createStripeToken", function(req, res) {
    stripe.tokens.create({
        card: {
            "number": req.params.number || req.body.number,
            "exp_month": req.params.exp_month || req.body.exp_month,
            "exp_year": req.params.exp_year || req.body.exp_year,
            "cvc": req.params.cvc || req.body.cvc
        }
    }).then(function(token) {
        res.success(token);
    });
});

// Creating stripe customer account
Parse.Cloud.define("createStripeCustomer", function(req, res) {
    var custEmail = req.params.email || req.body.email;
    var User = Parse.Object.extend("_User");
    var query = new Parse.Query(User);
    query.equalTo("email", custEmail);
    query.first({
        success: function(user) {
            if (!user.get("stripeId")) {
                var number = req.params.number; // || req.body.number;
                var exp_month = req.params.exp_month; // || req.body.exp_month;
                var exp_year = req.params.exp_year; // || req.body.exp_year;
                var cvc = req.params.cvc; // || req.body.cvc;
                Parse.Cloud.run("createStripeToken", {"number": number, "exp_month": exp_month, "exp_year": exp_year, "cvc": cvc}, {
                    success: function(token) {
                        stripe.customers.create({
                            email: custEmail,
                            source: token.id
                        }).then(function(stripeCustomer) {
                            var newStripeId = stripeCustomer.id
                            user.set("stripeId", newStripeId);
                            user.save(null, { useMasterKey: true});
                            res.success({ "stripeId": newStripeId });
                    });
                    },
                    error: function(token, err) {
                        res.error("Error in creating card token");
                    }
                });
            }
            else {
                res.error("Already has stripe account");
            }
        },
        error: function(err) {
            res.error("Error " + err.code + " " + err.message);
        }
    });
});

// Create idempotent Stripe charge
Parse.Cloud.define("createTransaction", function(req, res) {
    var custEmail = req.params.email;
    var User = Parse.Object.extend("_User");
    var query = new Parse.Query(User);
    query.equalTo("email", custEmail);
    query.first({
        success: function(user) {
            var custStripeId = user.get("stripeId");
            if (!custStripeId) {
                res.error("No stripe registration for the customer");
            }
            stripe.charges.create({
                amount: req.params.amount || req.body.amount,
                currency: "usd",
                customer: custStripeId,
                idempotency_key: uuidV1()
                }).then(function(charge) {
                    res.success(charge);
                });
        },
        error: function(err) {
            res.error("Error" + err.code + " " + err.message);
        }
    });
});



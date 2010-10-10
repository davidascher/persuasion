/**
 * Module dependencies.
 */

// should somehow tell redis to pick a database that we've cleared first.
var app = require('../app');


module.exports = {
    'test basic server': function(assert){
        assert.response(app.app,
            { url: '/' },
            function(res){
                assert.ok(res.body.indexOf('Not Authenticated') >= 0, 'Test assert.response() callback');
            });
        assert.response(app.app,
            { url: '/newslide' },
            { status: 200 },
            function(res){
                console.log("BODY", res.body);
                assert.ok(res.body.indexOf('does not exist') >= 0, 'Test assert.response() callback');
                app.redis.end(); // last test.
            });

    },
};

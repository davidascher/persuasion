/**
 * Module dependencies.
 */

// should somehow tell redis to pick a database that we've cleared first.
var app = require('../app');


module.exports = {
    setup: function(test) {
        console.log('setup called');
        app.redis.select(15, function(err, ok) {
            app.redis.flushdb(function(err, ok) {
                console.log('selected test DB and flushed it');
                test();
            });
        });
    },
    basic: function(assert){
        assert.response(app.app,
            { url: '/' },
            function(res){
                assert.ok(res.body.indexOf('Not Authenticated') >= 0, 'Test assert.response() callback');
            });
        assert.response(app.app,
            { url: '/newslide' },
            { status: 200 },
            function(res){
                assert.ok(res.body.indexOf('does not exist') >= 0, 'Test assert.response() callback');
            });
        assert.response(app.app,
            { url: '/create/newslide' },
            { status: 303 },
            function(res){
                assert.equal('/newslide', res.headers.location, 'Test assert.response() callback');
                assert.ok(res.body.indexOf('redirecting to ') >= 0, 'Test assert.response() callback');
            });
        assert.response(app.app,
            { url: '/newslide' },
            { status: 200 },
            function(res){
                // the slide exists now!
                assert.ok(res.body.indexOf('<header>') >= 0, 'Test assert.response() callback');
            });
        // finish by closing of the redis connection
        // there should be a better way to do this XXX!!
        assert.response(app.app,
            { url: '/' },
            function(res){
                app.redis.end();
            });
    },
};

/**
 * Module dependencies.
 */

var express = require('express'),
    Buffer = require('buffer').Buffer;

module.exports = {
    'test basic server': function(assert){
        var server = express.createServer();

        server.get('/', function(req, res){
            //assert.equal('test', server.set('env'), 'env setting was not set properly');
            res.writeHead(200, {});
            res.end('wahoo');
        });

        server.put('/user/:id', function(req, res){
            res.writeHead(200, {});
            res.end('updated user ' + req.params.id)
        });

        assert.response(server,
            { url: '/' },
            { body: 'wahoo' });
        
        assert.response(server,
            { url: '/user/12', method: 'PUT' },
            { body: 'updated user 12' });
    },
    };
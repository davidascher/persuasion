var express = require('express'),
    connect = require('connect'),
    jade = require('jade');
    
var app = express.createServer();
app.set('views', __dirname + '/views');
app.set('view options', {
    layout: false
});
app.get('/', function(req, res, next){
    console.log('in /');
    //res.writeHead(200, {"Content-Type": "text/plain"});
    //res.end("blah blah");
    res.render('unauthenticated.jade');
    res.end();
});

app.listen(3000);

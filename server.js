// server.js

var express = require('express'),
    sys = require('sys'),
    fs = require('fs'),
    path = require('path'),
    url = require('url'),
    jade = require('jade');

var app = express.createServer();
var redis = require('redis-client').createClient();

app.use(express.favicon());
app.use(express.logger({format: '":method :url" :status'}))
app.use(app.router);

app.use(function(req, res, next) {
  next(new NotFound(req.url));
});

app.set('views', __dirname + '/views');

// Provide our app with the notion of NotFound exceptions

function NotFound(path){
    this.name = 'NotFound';
    if (path) {
        Error.call(this, 'Cannot find ' + path);
        this.path = path;
    } else {
        Error.call(this, 'Not Found');
    }
    Error.captureStackTrace(this, arguments.callee);
}

sys.inherits(NotFound, Error);

// We can call app.error() several times as shown below.
// Here we check for an instanceof NotFound and show the
// 404 page, or we pass on to the next error handler.

// These handlers could potentially be defined within
// configure() blocks to provide introspection when
// in the development environment.

app.error(function(err, req, res, next){
    if (err instanceof NotFound) {
        res.render('404.jade', {
            status: 404,
            locals: {
                error: err
            }
        });
    } else {
        next(err);
    }
});

// Here we assume all errors as 500 for the simplicity of
// this demo, however you can choose whatever you like

app.error(function(err, req, res){
    res.render('500.jade', {
        status: 500,
        locals: {
            error: err
        }
    });
});

// Routes

app.get('/', function(req, res){
  res.render('index.jade');
});

app.get('/404', function(req, res){
    throw new NotFound;
});

app.get('/500', function(req, res, next){
    next(new Error('keyboard cat!'));
});

app.get('/static/(*.*)', function(req, res, next){
  // XXX clean up regex
  var pathname = req.params[0]+'.'+req.params[1];
  var filename = path.join(process.cwd(), 'static', pathname);
  res.sendfile(filename);
});

//app.get('/render/(*.*)', function(req, res, next) {
//  
//});

app.get('/create/:id', function(req, res, next){
  var pathname = req.params.id;
  // if we get here, it shouldn't already exist
  redis.exists(pathname, function(err, exists) {
    if (exists) {
      res.writeHead(500, {'Content-Type': 'text/html'});
      res.close("uh oh, already exists");
      return;
    }

    redis.set(pathname, html, function(err, info) {
      if (err) {
        res.writeHead(500, {'Content-Type': 'text/plain'});
        res.end("Error creating: " + pathname + ' ' + err);
      }
      // then redirect to the new (original) url
      res.writeHead(303, {"Content-Type": 'text/plain',
                    "Location": "/"+pathname});
      res.end("redirecting to " + pathname);
    });
    //
    //// then it doesn't, create a default one.
    //// first, find an id
    //redis.incr("ids::presentations", function(err, pid) {
    //  fs.readFile('static/deck.html', function(err, html) {
    //    fs.readFile('static/defaultSlides.json', function(err, json) {
    //      var args = ["presentation:" + pid];
    //      var slides = JSON.parse(json);
    //      console.log(slides);
    //      var num = 0;
    //      slides.forEach(function(slide) {
    //        args.concat([num++, slide]);
    //      });
    //      // args is presentation:123, 0, first slide contents, 1, second slide contents, ...
    //      redis.hmset(args, function(err, info) {
    //        if (err) {
    //          res.writeHead(500, {'Content-Type': 'text/plain'});
    //          res.end("Error creating: " + pathname + ' ' + err);
    //        }
    //        // then redirect to the new (original) url
    //        res.writeHead(303, {"Content-Type": 'text/plain',
    //                      "Location": "/"+pathname});
    //        res.end("redirecting to " + pathname);
    //      });
    //    });
    //  });
    //});
  });
});

app.get('/:id', function(req, res, next){
  res.writeHead(200, {"Content-Type": 'text/plain'});
  var pathname = req.params.id;
  // figure out if we already have a resource there
  redis.get(pathname, function(err, exists) {
    if (exists) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(exists);
    }
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end("That thing does not exist, we can <a href='./create/" + pathname + "'>create it</a> (" + pathname + ")");
  })
});
  


app.listen(3000);
console.log('Express app started on port 3000');

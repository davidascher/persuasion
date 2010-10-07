// server.js

var express = require('express'),
    sys = require('sys'),
    fs = require('fs'),
    path = require('path'),
    url = require('url'),
    jade = require('jade');
    connect = require('connect'), 
    MemoryStore = require('connect/middleware/session/memory'),
    auth = require('./lib/auth');

// N.B. TO USE Any of the OAuth or RPX strategies you will need to provide
// a copy of the example_keys_file (named keys_file) 
try {
  var example_keys= require('./keys_file');
  for(var key in example_keys) {
    global[key]= example_keys[key];
  }
}
catch(e) {
  console.log('Unable to locate the keys_file.js file.  Please copy and ammend the example_keys_file.js as appropriate');
  sys.exit();
}

var app = express.createServer(
                        connect.cookieDecoder(), 
                        connect.session({ store: new MemoryStore({ reapInterval: -1 }) }),
                        connect.bodyDecoder() /* Only required for the janrain strategy*/,
                        auth( [
                              auth.Anonymous(),
                              auth.Twitter({consumerKey: twitterConsumerKey, consumerSecret: twitterConsumerSecret}),
                              auth.Facebook({appId : fbId, appSecret: fbSecret, scope: "email", callback: fbCallbackAddress}),
                              ])
                        );


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

// -- AUTH (from connect-auth/examples/app.js)
app.get ('/auth/twitter', function(req, res, params) {
console.log('in /auth/twitter');
  var next = url.parse(req.url, true).query.next;
  if (next) {
    req.sessionStore.set('persuasion', {'next': next});
  }
  req.authenticate(['twitter'], function(error, authenticated) { 
    if( authenticated ) {
      var next = req.sessionStore.get('persuasion', function(err, data, meta) {
        res.writeHead(303, {"Location": data['next']});
        res.end();
      });
    }
    else {
      res.writeHead(200, {'Content-Type': 'text/html'})
      res.end("<html><h1>Twitter authentication failed :( </h1></html>")
    }
  });
})

app.get ('/auth/facebook', function(req, res, params) {
  req.authenticate(['facebook'], function(error, authenticated) {
    res.writeHead(200, {'Content-Type': 'text/html'})
    if( authenticated ) {
      res.end("<html><h1>Hello Facebook user:" + JSON.stringify( req.getAuthDetails().user ) + ".</h1></html>")
    }
    else {
      res.end("<html><h1>Facebook authentication failed :( </h1></html>")
    }
  });
})

app.get('/auth/anon', function(req, res, params) {
  req.authenticate(['anon'], function(error, authenticated) { 
    res.writeHead(200, {'Content-Type': 'text/html'})
    res.end("<html><h1>Hello! Full anonymous access</h1></html>")
  });
})

app.get ('/logout', function(req, res, params) {
  req.logout();
  var next = url.parse(req.url, true).query.next;
  res.writeHead(303, { 'Location': next });
  res.end('');
})

app.get('/', function(req, res, params) {
  var self=this;
  //console.log("req.params", req.params);
  //console.log("params", params);
  //console.log("req.query", req.query);
  //console.log("req.query", JSON.stringify(req.query));
  res.writeHead(200, {'Content-Type': 'text/html'})
  if( !req.isAuthenticated() ) {
    res.end('<html>                                              \n\
        <head>                                             \n\
          <title>connect Auth -- Not Authenticated</title> \n\
          <script src="http://static.ak.fbcdn.net/connect/en_US/core.js"></script> \n\
        </head>                                            \n\
        <body>                                             \n\
          <div id="wrapper">                               \n\
            <h1>Not authenticated</h1>                     \n\
            <div class="fb_button" id="fb-login" style="float:left; background-position: left -188px">          \n\
              <a href="/auth/facebook" class="fb_button_medium">        \n\
                <span id="fb_login_text" class="fb_button_text"> \n\
                  Connect with Facebook                    \n\
                </span>                                    \n\
              </a>                                         \n\
            </div>                                         \n\
            <div style="float:left;margin-left:5px">       \n\
              <a href="/auth/twitter" style="border:0px">  \n\
                <img style="border:0px" src="http://apiwiki.twitter.com/f/1242697715/Sign-in-with-Twitter-darker.png"/>\n\
              </a>                                         \n\
            </div>                                         \n\
          </div>                                           \n\
        </body>                                            \n\
      </html>')
  }
  else {
    res.end('<html>                                              \n\
        <head>                                             \n\
          <title>Express Auth -- Authenticated</title>\n\
        </head>                                            \n\
        <body>                                             \n\
          <div id="wrapper">                               \n\
            <h1>Authenticated</h1>     \n\
          ' + JSON.stringify( req.getAuthDetails().user ) + '   \n\
           <h2><a href="/logout">Logout</a></h2>                \n\
          </div>                                           \n\
        </body>                                            \n\
      </html>')
  }
})


app.get('/:path/slide/:sid', function(req, res, next) {
  var path = req.params.path;
  var sid = req.params.sid;
  redis.hget("url2id", path, function(err, pid) {
    redis.hget("presentation:" + pid, sid, function(err, slideJade) {
      if (err) {
        next(new Error("no such slide"));
      }
      res.writeHead(200, {
        'Content-Type': 'text/plain',
      });
      res.end(slideJade);
      res.close
    });
  });
});



app.get('/:path/save/:sid', function(req, res, next) {
  var path = req.params.path;
  var sid = req.params.sid;
  var jadeString = req.query['jade'].toString();
  try {
    var converted = jade.render(jadeString);
  } catch (e) {
    console.log(e);
  }
  console.log('html of jade is ' + converted);
  redis.hget("url2id", path, function(err, pid) {
    redis.hset("presentation:" + pid, sid, jadeString, function(err, slideJade) {
      if (err) {
        next(new Error("no such slide"));
      }
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(converted);
    });
  });
});



app.get('/create/:id', function(req, res, next){
  var pathname = req.params.id;
  // if we get here, it shouldn't already exist
  redis.exists(pathname, function(err, exists) {
    if (exists) {
      res.writeHead(500, {'Content-Type': 'text/html'});
      res.close("uh oh, already exists");
      return;
    }

    redis.incr("ids::presentations", function(err, pid) {
      // keep the id in a url->id lookup key
      redis.hset("url2id", pathname, pid, function(err, ok) {
        fs.readFile('static/defaultSlides.json', function(err, json) {
          var args = ["presentation:" + pid];
          var slides = JSON.parse(json);
          var num = 0;
          slides.forEach(function(slide) {
            args = args.concat([num++, slide]);
          });
          // args is presentation:123, 0, first slide contents, 1, second slide contents, ...
          redis.hmset(args, function(err, info) {
            if (err) {
              res.writeHead(500, {'Content-Type': 'text/plain'});
              res.end("Error creating: " + pathname + ' ' + err);
            }
            // then redirect to the new (original) url
            res.writeHead(303, {"Content-Type": 'text/plain',
                          "Location": "/"+pathname});
            res.end("redirecting to " + pathname);
          });
        });
      });
    });
  });
});

app.get('/:id', function(req, res, next){
  res.writeHead(200, {"Content-Type": 'text/plain'});
  var pathname = req.params.id;
  var user;
  // figure out if we already have a resource there
  redis.hget('url2id', pathname, function(err, pid) {
    if (pid) {
      if( req.isAuthenticated() ) {
        userDiv = '<a href="/logout?next='+ req.url + '">logout</a> ' + req.getAuthDetails().user.username
      } else {
        userDiv = '<a href="/auth/twitter?next='+ req.url + '">login</a>';
      }

    fs.readFile('static/deck.html', function(err, deck) {
        res.writeHead(200, {'Content-Type': 'text/html'});
        var htmlDeck = deck.toString();
        // we get all of the slides in the presentation
        redis.hvals("presentation:" + pid, function(err, slides) {
          var htmlSlides = [];
          slides.forEach(function(slide) {
            // we convert them from jade to html
            html = jade.render(slide);
            htmlSlides.push("<div class='slide'>\n" + html + '</div>')
          });
          allSlides = htmlSlides.join('\n');
          htmlDeck = htmlDeck.replace('${USERPANEL}', userDiv)
          htmlDeck = htmlDeck.replace('${SLIDES}', allSlides)
          res.end(htmlDeck);
        });
      });
    } else {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end("That thing does not exist, we can <a href='./create/" + pathname + "'>create it</a> (" + pathname + ")");
    }
  })
});
  
// We let the example run without npm, by setting up the require paths
// so the node-oauth submodule inside of git is used.  You do *NOT*
// need to bother with this line if you're using npm ...
require.paths.unshift('support')
var OAuth= require('oauth').OAuth;

var getSharedSecretForUserFunction = function(user,  callback) {
  var result;
  if(user == 'foo') 
    result= 'bar';
  callback(null, result);
};

var validatePasswordFunction = function(username, password, successCallback, failureCallback){
  if (username === 'foo' && password === "bar"){
    successCallback();
  } else {
    failureCallback();
  }
};

app.listen(3000);
console.log('Express app started on port 3000');

// server.js

// move all redis error handling to a specific handler, as we expect them _never_.
// implement appropriate auth checking everywhere (commenting, reading, saving, etc.)

var express = require('express'),
    sys = require('sys'),
    fs = require('fs'),
    path = require('path'),
    url = require('url'),
    jade = require('jade');
    connect = require('connect'), 
    MemoryStore = require('connect/middleware/session/memory'),
    auth = require('./lib/auth'),
    OAuth = require('oauth').OAuth,
    io = require('./lib/socket.io/index'),
    FlickrAPI = require('./lib/flickr/flickr').FlickrAPI,
    app = require('./app');


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

flickr = new FlickrAPI(flickrKey);

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


//var redis = require('redis-client').createClient();
var redis = require('redis').createClient();

var STATIC_DIR = path.join(process.cwd(), 'static');

app.use(express.favicon());  // XXX come up with our own favicon
app.use(express.logger({format: '":method :url" :status'}))
app.use(app.router);

// XXX understand
app.use(function(req, res, next) {
  next(new NotFound(req.url));
});

// XXX understand
app.set('views', __dirname + '/views');

// Provide our app with the notion of NotFound exceptions

// XXX understand
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
// XXX understand

app.error(function(err, req, res){
    res.render('500.jade', {
        status: 500,
        locals: {
            error: err
        }
    });
});

// Routes
// XXX add test
app.get('/static/(*)$', function(req, res, next){
  // XXX understand regex rules better (can I name that regex?)
  var pathname = req.params[0];
  var filename = path.join(STATIC_DIR, pathname);
  res.sendfile(filename);
});

// -- AUTH (from connect-auth/examples/app.js)
// XXX add test
app.get ('/auth/twitter', function(req, res, params) {
  // next is a query parameter which indicates where to redirect to.
  var q = url.parse(req.url, true).query;
  var next = '/';
  if (q && q.next) {
    next = q.next;
    // we'll store in the session, so that we can handle it when we get
    // redirected back from twitter.
    req.sessionStore.set('persuasion', {'next': next});
  }
  req.authenticate(['twitter'], function(error, authenticated) { 
    if (authenticated) {
      var next = req.sessionStore.get('persuasion', function(err, data, meta) {
        res.writeHead(303, {"Location": (data && data['next']) ? data['next'] : '/'});
        res.end();
      });
    } else {
      console.log("failed to authenticate", error);
      res.writeHead(200, {'Content-Type': 'text/html'})
      res.end("<html><h1>Twitter authentication failed :( </h1></html>")
    }
  });
})

// XXX test.
// XXX add test
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

// XXX understand
app.get('/auth/anon', function(req, res, params) {
  req.authenticate(['anon'], function(error, authenticated) { 
    res.writeHead(200, {'Content-Type': 'text/html'})
    res.end("<html><h1>Hello! Full anonymous access</h1></html>")
  });
})

// XXX add test
app.get ('/logout', function(req, res, params) {
  req.logout();
  var next = null
  var q = url.parse(req.url, true).query;
  if (q)
    next = q.next;
  res.writeHead(303, { 'Location': next ? next : '/'});
  res.end('');
})

// XXX add test
app.get('/', function(req, res, params) {
  res.writeHead(200, {'Content-Type': 'text/html'})
  if( !req.isAuthenticated() ) {
    // XXX move to jade template
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
    // XXX move to jade template
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

// XXX add test
app.get('/:path/slide/:slideNo', function(req, res, next) {
  var path = req.params.path;
  var slideNo = req.params.slideNo;
  redis.hget("url2id", path, function(err, pid) {
    if (err) { next(new Error("no such slide")); }
    redis.zrangebyscore("presentation:" + pid, slideNo, slideNo, function(err, slideId) {
      if (err) {
        console.log("no slide Id for presentation " + pid + "with slide # " + slideNo);
        next(new Error("no such slide"));
      }
      redis.get(slideId, function(err, slide) {
        if (err) { next(new Error("no such slide")); }
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end(slide);
      });
    });
  });
});


// XXX add test
app.get('/:path/save/:slideNo', function(req, res, next) {
  var path = req.params.path;
  var slideNo = req.params.slideNo;
  var slide = req.query.slide;
  redis.hget("url2id", path, function(err, pid) {
    redis.zrangebyscore("presentation:" + pid, slideNo, slideNo, function(err, slides) {
      if (err) { next(new Error(err)); }
      if (! slides) {
        console.log("uh oh, couldn' find slide:", slideNo);
        next(new Error("no such slide")); // understand next here.
      }
      assert.equal(slides.length, 1); // we know there's only one by design of the zset.
      slideId = slides[0]; 
      redis.set(slideId, slide, function(err, slideJade) {
        if (err) {
          next(new Error("no such slide"));
        }
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(slide);
      });
    });
  });
});

// XXX add test
// consider whether data structure is right given new UX goals
// XXX use auth
app.post('/:path/add_comment/:sid', function(req, res) {
  var path = req.params.path;
  var sid = req.params.sid;
  var comment = url.parse(req.url, true).query.comment;
  redis.hget("url2id", path, function(err, pid) {
    redis.incr("ids::comments", function(err, cid) {
      redis.rpush("comment:" + pid,
                  JSON.stringify({"slide": sid,
                                  "id": cid,
                                  "author": "someone", 
                                  "comment" : comment}), function(err, ok) {
        if (err) {
          next(new Error("couldn't write a comment"));
        }
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end("OK");
      });
    });
  });
});

// XXX add test
// XXX use POST instead
app.get('/:path/insert_slide/:pos', function(req, res) {
  // we need to add a comment to a slide
  var path = req.params.path;
  var pos = req.params.pos;
  redis.hget("url2id", path, function(err, pid) {
    redis.incr("ids::slides", function(err, sid) {
      // we now have the id for the slide
      // let's get the default slide
      var slideId = "slide:"+sid;
      fs.readFile('static/defaultSlide.json', function(err, slideJSON) {
        var slide = JSON.parse(slideJSON);
        if (err) throw new Error("couldn't read defaultSlide.json");
        // we add the slide with it id
        redis.set(slideId, slide, function(err, ok) {
          if (err) throw new Error("couldn't set slide for id: " + slideId);
          // we need to move all of the subsequent slides further,
          // which means incrementing their scores
          var key ="presentation:" + pid;
          redis.zrangebyscore(key, pos, "inf", function(error, keys_to_incr) {
            var cmds = [];
            if (keys_to_incr) {
              for (var z = 0; z < keys_to_incr.length; z++) {
                cmds.push(['zincrby', key, 1, keys_to_incr[z]]);
              }
            }
            cmds.push(['zadd', key, pos, slideId]);
            redis.multi(cmds).exec(function(err, results) {
              res.writeHead(200, {'Content-Type': 'text/html'});
              res.end(slide);
            });
          });
        });
      });
    });
  });
});


// XXX add test
app.del('/:path/slide/:slideNo', function(req, res) {
  // we need to add a comment to a slide
  var path = req.params.path;
  var slideNo = req.params.slideNo;
  redis.hget("url2id", path, function(err, pid) {
    redis.zrangebyscore("presentation:" + pid, slideNo, slideNo, function(err, slides) {
      if (err) {
        console.log("no slide Id for presentation " + pid + "with slide # " + slideNo);
        next(new Error("no such slide"));
      }
      if (! slides) {
        next(new Error("no such slide"));
      }
      var slideId = slides[0]; // we know there's only one.
      redis.del(slideId, function(err, slideJade) {
        redis.zrem(key, slideId, function(err, ok) {
          res.writeHead(200, {'Content-Type': 'text/plain'});
          res.end(ok);
        });
      });
    });
  });
});

// XXX add test
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
        fs.readFile('static/defaultDeck.json', function(err, json) {
          var key ="presentation:" + pid;
          var slides = JSON.parse(json);
          var num = 0;
          for (var i=0; i < slides.length; i++) {
            // XXX cleanup
            (function() {
              var j = i;
              var slide = slides[j];
              redis.incr("ids::slides", function(err, sid) {
                redis.set("slide:"+sid, slide, function(err, ok) {
                  redis.zadd(key, j, "slide:"+sid);
                });
              });
            })();
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


function choose (set) {
  return set[Math.floor(Math.random() * set.length)];
}

app.get('/random_image/:word', function(req, res) {
  // Search for photos with a tag of 'badgers'
  flickr.photos.search({'tags': req.params.word,
                        'sort': 'interestingness-desc',
                        //'is_commons': 'true',
                        'per_page': 100},  function(error, results) {
    var photos = results.photo;
    var photo = null;
    var count = 0;
    if (photos.length) {
      while (!photo && count < 100) {
        // XXX sometimes we get undefined returned photos?
        photo = choose(photos);
        count++;
      }
      farm = photo.farm;
      secret = photo.secret;
      id = photo.id;
      server = photo.server;
      url = "http://farm" + farm + ".static.flickr.com/" + server + "/" + id + "_" + secret +".jpg";
      res.writeHead(303, {'Location': url});
      res.end();
    } else {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end("no such photo!");
    }
  });
});

// XXX add test
app.get('/:id', function(req, res, next){
  res.writeHead(200, {"Content-Type": 'text/plain'});
  var pathname = req.params.id;
  var user;
  // figure out if we already have a resource there
  redis.hget('url2id', pathname, function(err, pid) {
    if (pid) {
      if (req.isAuthenticated()) {
        userDiv = '<a href="/logout?next='+ req.url + '">logout</a> ' + req.getAuthDetails().user.username
      } else {
        userDiv = '<a href="/auth/twitter?next='+ req.url + '">login</a>';
      }
      fs.readFile('static/deck.html', function(err, deck) {
        res.writeHead(200, {'Content-Type': 'text/html'});
        var htmlDeck = deck.toString();
        // we get all of the slides in the presentation
        // get the comments on the deck
        redis.lrange("comment:" + pid, 0, -1, function(err, comments) {
          var cs = [];
          // XXX this is all very strange.  I'm not sure what the right
          // process would be to effectively move a JS data structure to the
          // client.
          if (comments) {
            comments.forEach(function (c) {
              cs.push(c.toString());
            });
          }
          commentsJSON = JSON.stringify(cs);
          redis.zrangebyscore("presentation:" + pid, "-inf", "+inf", function(err, slides) {
            var htmlSlides = [];
            var num = 0;
            var commands = [];
            slides.forEach(function(slideId) {
              commands.push(['get', slideId]);
            });
            redis.multi(commands).exec(function(err, results) {
              for (var num = 0; num < results.length; num++) {
                slide = results[num];
                var html = "<div slideNo='" + num + "' class='slide'>\n" + slide + '</div>';
                htmlSlides.push(html)
              }
              allSlides = htmlSlides.join('\n');
              // XXX this is hacky, find some real templating system.
              htmlDeck = htmlDeck.replace('COMMENTS_MARKER', commentsJSON, 'g');
              htmlDeck = htmlDeck.replace('${PATH}', pathname, 'g');
              htmlDeck = htmlDeck.replace('${USERPANEL}', userDiv);
              htmlDeck = htmlDeck.replace('${SLIDES}', allSlides);
              res.end(htmlDeck);
            });
          });
        });
      });
    } else {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end("That thing does not exist, we can <a href='./create/" + pathname + "'>create it</a> (" + pathname + ")");
    }
  })
});

// XXX add tests
var socket = io.listen(app);
socket.on('connection', function(client){
  // new client is here!
  client.on('message', function(e){
    //console.log("got a message!", e);
    client.broadcast({"type": "message",
                "payload": e});
  });
  client.on('connect', function(e){
    //console.log("got a connect!", e);
  });
  client.on('disconnect', function(){
    //console.log("got a disconnect")
  });
});

app.listen(3000);

console.log('Persuasion started on port 3000');

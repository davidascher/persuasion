// the persuasion server

// the redis data structures we use

// url2id --> hset mapping url paths to presentationIDs (pid)
// presentation:<pid> --> zset mapping slide numbers to slideIDs (sid)
// ids::comments --> set of comment 
var express = require('express'),
    sys = require('sys'),
    fs = require('fs'),
    assert = require('assert'),
    path = require('path'),
    url = require('url'),
    jade = require('jade');
    connect = require('connect'), 
    auth = require('connect-auth/lib/auth'),
    OAuth = require('oauth').OAuth,
    io = require('Socket.IO-node/lib/socket.io'),
    RedisStore = require('connect-redis'),
    FlickrAPI = require('flickrnode/lib/flickr').FlickrAPI;

var redis = require('redis').createClient();

try {
  var keys = require(path.join(process.env.HOME, 'persuasion_secrets.js'));
  for(var key in keys) {
    global[key]= keys[key];
  }
}
catch(e) {
  console.log('Unable to locate the persuasion_secrets.js file.  Please copy and ammend the example_keys_file.js as appropriate, and put it in your HOME directory');
  sys.exit();
}

flickr = new FlickrAPI(flickrKey);

var app = express.createServer(
                        connect.cookieDecoder(), 
                        connect.session({ store: new RedisStore({ maxAge: 300000 }) }),
                        connect.bodyDecoder() /* Only required for the janrain strategy*/,
                        auth( [
                              auth.Anonymous(),
                              auth.Twitter({consumerKey: twitterConsumerKey, consumerSecret: twitterConsumerSecret}),
                              auth.Facebook({appId : fbId, appSecret: fbSecret, scope: "email", callback: fbCallbackAddress}),
                              ])
                        );



var STATIC_DIR = path.join(process.cwd(), 'static');

app.use(express.favicon());  // XXX come up with our own favicon
app.use(express.logger({format: '":method :url" :status'}))
app.use(app.router);
app.set('view options', {
    layout: false
});

// XXX understand
app.use(function(req, res, next) {
  next(new NotFound(req.url));
});


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

function NotFound(msg){
    this.name = 'NotFound';
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}

sys.inherits(NotFound, Error);

// Routes
// XXX add test
app.get('/static/(*)$', function(req, res, next){
  // XXX understand regex rules better (can I name that regex?)
  //console.log(req.params[0]);
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
  if (! req.isAuthenticated() ) {
    res.render('unauthenticated.jade');
  } else {
    res.writeHead(303, {"Location": "/profile"});
    res.end();
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
app.get('/profile/:username', function(req, res, next) {
});

// XXX add test
app.get('/profile', function(req, res, next) {
  if (! req.isAuthenticated() ) {
    res.render('mustbeloggedin.jade', {'locals': {
      'heading': 'who are you?',
      'next': req.url,
      'isAuth': false,
      'username': null,
      'body': "<strong>Sorry, this page is only visible to authenticated users.</strong>\n<p>click on the red links above to become one.</p>"
    }});
  } else {
    var username = req.getAuthDetails().user.username;
    redis.lrange("my_presentations::" + username, 0, -1, function(err, pids) {
      var keys = [];
      if (pids) { // go backwards so the most recent are first
        for (var i=pids.length-1; i >=0 ; i--) {
          var pid = pids[i];
          keys.push("details::" + pid);
        }
      }
      redis.mget(keys, function(err, details_list) {
        if (!details_list) {
          details_list = [];
        } else {
          for (var j=0; j < details_list.length; j++) {
            details_list[j] = JSON.parse(details_list[j]);
          }
        }
        res.render('profile.jade', {'locals':{
          'username': req.getAuthDetails().user.username,
          'creations' : res.partial('creations.jade', {
            'locals' : {
              creations: details_list
            }}
          )}
        });
      });
    })
  }
})

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

app.get('/create', function(req, res, next){
  if (! req.isAuthenticated()) {
    res.render('mustbeloggedin.jade', {'locals': {
      'heading': 'who are you?',
      'next': req.url,
      'isAuth': req.isAuthenticated(),
      'username': null,
      'body': "<strong>Sorry, to create a new resource you need to authenticate.</strong>\n<p>click on the red links above to do so.</p>"
    }});
    return;
  }
  var title = req.query.title;
  var pathname = req.query.path;
  var username = req.getAuthDetails().user.username;
  console.log("url_specified is specified!");
  res.render('notthere.jade', {'locals':
      {'createPath': "/create/"+pathname,
       'isAuth': req.isAuthenticated(),
       'url_specified': false,
       'next': req.url,
       'path': pathname,
       'user': req.getAuthDetails().user,
  }});
})

// XXX add test
// Need two query parameters: title & path

app.post('/create', function(req, res, next){
  if (! req.isAuthenticated()) {
    res.writeHead(303, {"Location": "/profile"});
    res.end("/profile");
    //res.render('mustbeloggedin.jade', {'locals': {
    //  'heading': 'who are you?',
    //  'next': req.url,
    //  'isAuth': req.isAuthenticated(),
    //  'username': null,
    //  'body': "<strong>Sorry, to create a new resource you need to authenticate.</strong>\n<p>click on the red links above to do so.</p>"
    //}});
    return;
  }
  var title = req.query.title;
  var pathname = req.query.path;
  var username = req.getAuthDetails().user.username;
  // if we get here, it shouldn't already exist
  redis.exists(pathname, function(err, exists) {
    if (exists) {
      res.writeHead(500, {'Content-Type': 'text/html'});
      res.close("uh oh, already exists");
      return;
    }

    redis.incr("ids::presentations", function(err, pid) {
      redis.rpush("my_presentations::" + username, pid, function(err, ok) {
        // keep the id in a url->id lookup key
        console.log("pid = ", pid);
        redis.hset("url2id", pathname, pid, function(err, ok) {
          details = JSON.stringify({'url': pathname,
                                   'title': title});
          console.log("setting details to", "details::"+ pid, details);
          redis.set("details::"+ pid, details, function(err, ok) {
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
              res.writeHead(200, {"Content-Type": 'text/plain'});
              res.end(pathname);
              
              //// then redirect to the new (original) url
              //res.writeHead(303, {"Content-Type": 'text/plain',
              //                    "Location": "/"+pathname});
              //res.end("redirecting to " + pathname);
            });
          });
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
app.get('/:path', function(req, res, next){
  var pathname = req.params.path;
  var user;
  // figure out if we already have a resource there
  redis.hget('url2id', pathname, function(err, pid) {
    if (pid) {
      redis.get("details::"+ pid, function(err, details) {
        details = JSON.parse(details.toString());
        title = details.title;
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
                htmlDeck = htmlDeck.replace('${TITLE}', title, 'g');
                htmlDeck = htmlDeck.replace('${PATH}', pathname, 'g');
                htmlDeck = htmlDeck.replace('${USERPANEL}', userDiv);
                htmlDeck = htmlDeck.replace('${SLIDES}', allSlides);
                res.end(htmlDeck);
              });
            });
          });
        });
      });
    } else {
      if (! req.isAuthenticated()) {
        res.writeHead(303, {"Location": "/profile"});
        res.end("/profile");
        // XXX we should have a better handling of next, so that after
        // auth, they get back to the url they were trying to create.
        // then again, it's not that important.
        return;
      }
      res.render('notthere.jade', {'locals': {'createPath': "/create/"+pathname,
           'isAuth': req.isAuthenticated(),
           'url_specified': true,
           'next': req.url,
           'path': pathname,
           'user': req.getAuthDetails().user,
      }});
    }
  })
});

// XXX add tests
var socket = io.listen(app);
socket.on('connection', function(client){
  //console.log(client);
  client.broadcast({"type": "connect",
                    "payload": "there was a connection"});
  console.log("got a connect!", client);
  // new client is here!
  client.on('message', function(e){
    console.log("got a message!", e);
    client.broadcast({"type": "message",
                      "payload": e});
  });
  client.on('disconnect', function(){
    console.log("got a disconnect")
  });
});

module.exports = {
  'app': app,
  'redis': redis,
}

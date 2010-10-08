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


//var redis = require('redis-client').createClient();
var redis = require('redis').createClient();

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


app.get('/:path/render_slide/:sid', function(req, res, next) {
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


function get_slide_html(path, slideNo) {
  
}

app.get('/:path/slide/:slideNo', function(req, res, next) {
  var path = req.params.path;
  var slideNo = req.params.slideNo;
  redis.hget("url2id", path, function(err, pid) {
    if (err) {
      //console.log("no mapping of " + path + " to url");
      next(new Error("no such slide"));
    }
    redis.zrangebyscore("presentation:" + pid, slideNo, slideNo, function(err, slideId) {
      //console.log("presentation:" + pid + " is OK")
      if (err) {
        console.log("no slide Id for presentation " + pid + "with slide # " + slideNo);
        next(new Error("no such slide"));
      }
      //console.log("slideNo = " + slideNo)
      redis.get(slideId, function(err, slideJade) {
        if (err) {
          //console.log("failure to hget: " + slideId);
          next(new Error("no such slide"));
        }
        res.writeHead(200, {
          'Content-Type': 'text/plain',
        });
        res.end(slideJade);
      });
    });
  });
});



app.get('/:path/save/:slideNo', function(req, res, next) {
  var path = req.params.path;
  var slideNo = req.params.slideNo;
  var jadeString = req.query['jade'].toString();
  try {
    var converted = jade.render(jadeString);
  } catch (e) {
    console.log(e);
    // XXX we need to do better =).
  }
  //console.log('html of jade is ' + converted);
  redis.hget("url2id", path, function(err, pid) {
    redis.zrangebyscore("presentation:" + pid, slideNo, slideNo, function(err, slideId) {
      //console.log("presentation:" + pid + " is OK")
      slideId = slideId[0]; // we know there's only one.
      if (err) {
        console.log("no slide Id for presentation " + pid + "with slide # " + slideNo);
        next(new Error("no such slide"));
      }
      redis.set(slideId, jadeString, function(err, slideJade) {
        if (err) {
          next(new Error("no such slide"));
        }
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(converted);
      });
    });
  });
});

app.post('/:path/add_comment/:sid', function(req, res) {
  // we need to add a comment to a slide
  var path = req.params.path;
  var sid = req.params.sid;
  var comment = url.parse(req.url, true).query.comment;
  redis.hget("url2id", path, function(err, pid) {
    redis.incr("ids::comments", function(err, cid) {
      redis.rpush("comment:" + pid,
                  JSON.stringify({"slide": sid,
                                  "id": cid,
                                  "author": "someone", // XXX use auth
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
        if (err) {
          console.log("couldn't read defaultSlide.json: " + err);
        }
        // we add the slide with it id
        redis.set(slideId, slide, function(err, ok) {
          if (err) {
            console.log("couldn't set slide for id: " + slideId);
          }
          // we need to move all of the subsequent slides further,
          // which means incrementing their scores
          console.log("looking at slides starting at " + pos);
          var key ="presentation:" + pid;
          console.log('key = ' + key);
          redis.zrangebyscore(key, pos, "inf", function(error, to_incr) {
            var cmds = [];
            if (to_incr) {
              for (var z = 0; z < to_incr.length; z++) {
                cmds.push(['zincrby', key, 1, to_incr[z]]);
              }
            }
            cmds.push(['zadd', key, pos, slideId]);
            redis.multi(cmds).exec(function(err, results) {
              res.writeHead(200, {'Content-Type': 'text/html'});
              console.log("returning: " + jade.render(slide));
              res.end(jade.render(slide));
            });
          });
        });
      });
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
          var key ="presentation:" + pid;
          var slides = JSON.parse(json);
          console.log("JSON: " + json + "");
          var num = 0;
          for (var i=0; i < slides.length; i++) {
            (function() {
              var j = i;
              var slide = slides[j];
              console.log("slideJSON = " + slide);
              redis.incr("ids::slides", function(err, sid) {
                console.log('________SET________', "slide:"+sid, slide);
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
          console.log("key = " + "presentation:" + pid);
          redis.zrangebyscore("presentation:" + pid, "-inf", "+inf", function(err, slides) {
            console.log("scores = " + slides);
            var htmlSlides = [];
            var num = 0;
            var commands = [];
            slides.forEach(function(slideId) {
              commands.push(['get', slideId]);
            });
            redis.multi(commands).exec(function(err, results) {
              results.forEach(function(slide) {
                console.log("slide = " + slide);
                var h = jade.render(slide);
                console.log("jade says: " + h);
                var html = "<div slide_id='" + num + "' class='slide'>\n" + h + '</div>';
                console.log("html = " + html );
                htmlSlides.push(html)
              });
              allSlides = htmlSlides.join('\n');
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

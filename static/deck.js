
var slideshow;
var webchat;

(function() {
  var doc = document;
  var disableBuilds = true;
  function randomString() {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    var string_length = 8;
    var randomstring = '';
    for (var i=0; i<string_length; i++) {
      var rnum = Math.floor(Math.random() * chars.length);
      randomstring += chars.substring(rnum,rnum+1);
    }
    return randomstring;
  }
  var ctr = 0;
  var spaces = /\s+/, a1 = [''];

  var toArray = function(list) {
    return Array.prototype.slice.call(list || [], 0);
  };

  var byId = function(id) {
    if (typeof id == 'string') { return doc.getElementById(id); }
    return id;
  };

  var query = function(query, root) {
    if (!query) { return []; }
    if (typeof query != 'string') { return toArray(query); }
    if (typeof root == 'string') {
      root = byId(root);
      if(!root){ return []; }
    }

    root = root || document;
    var rootIsDoc = (root.nodeType == 9);
    var doc = rootIsDoc ? root : (root.ownerDocument || document);

    // rewrite the query to be ID rooted
    if (!rootIsDoc || ('>~+'.indexOf(query.charAt(0)) >= 0)) {
      root.id = root.id || ('qUnique' + (ctr++));
      query = '#' + root.id + ' ' + query;
    }
    // don't choke on something like ".yada.yada >"
    if ('>~+'.indexOf(query.slice(-1)) >= 0) { query += ' *'; }

    return toArray(doc.querySelectorAll(query));
  };

  var strToArray = function(s) {
    if (typeof s == 'string' || s instanceof String) {
      if (s.indexOf(' ') < 0) {
        a1[0] = s;
        return a1;
      } else {
        return s.split(spaces);
      }
    }
    return s;
  };

  var addClass = function(node, classStr) {
    classStr = strToArray(classStr);
    var cls = ' ' + node.className + ' ';
    for (var i = 0, len = classStr.length, c; i < len; ++i) {
      c = classStr[i];
      if (c && cls.indexOf(' ' + c + ' ') < 0) {
        cls += c + ' ';
      }
    }
    node.className = cls.trim();
  };

  var removeClass = function(node, classStr) {
    var cls;
    if (classStr !== undefined) {
      classStr = strToArray(classStr);
      cls = ' ' + node.className + ' ';
      for (var i = 0, len = classStr.length; i < len; ++i) {
        cls = cls.replace(' ' + classStr[i] + ' ', ' ');
      }
      cls = cls.trim();
    } else {
      cls = '';
    }
    if (node.className != cls) {
      node.className = cls;
    }
  };

  var toggleClass = function(node, classStr) {
    var cls = ' ' + node.className + ' ';
    if (cls.indexOf(' ' + classStr.trim() + ' ') >= 0) {
      removeClass(node, classStr);
    } else {
      addClass(node, classStr);
    }
  };

  var ua = navigator.userAgent;
  var isFF = parseFloat(ua.split('Firefox/')[1]) || undefined;
  var isWK = parseFloat(ua.split('WebKit/')[1]) || undefined;
  var isOpera = parseFloat(ua.split('Opera/')[1]) || undefined;

  var canTransition = (function() {
    var ver = parseFloat(ua.split('Version/')[1]) || undefined;
    // test to determine if this browser can handle CSS transitions.
    var cachedCanTransition = 
      (isWK || (isFF && isFF > 3.6 ) || (isOpera && ver >= 10.5));
    return function() { return cachedCanTransition; }
  })();

  //
  // Slide class
  //
  var Slide = function(node, idx) {
    this._node = node;
    if (idx >= 0) {
      this._count = idx + 1;
    }
    if (this._node) {
      addClass(this._node, 'slide distant-slide');
    }
    this._makeCounter();
    this._makeBuildList();
  };

  Slide.prototype = {
    _node: null,
    _count: 0,
    _buildList: [],
    _visited: false,
    _currentState: '',
    _states: [ 'distant-slide', 'far-past',
               'past', 'current', 'future',
               'far-future', 'distant-slide' ],
    startEditing: function() {
      // get the "source" of the slide
      var node = this._node;
      var req = new XMLHttpRequest();
      var url = window.location.pathname + '/slide/' + (this._count - 1);
      req.open('GET', url);
      req.onreadystatechange = function (aEvt) {
        if (req.readyState == 4) {
          if (req.status == 200) {
            bespin.useBespin(node).then(function(env) {
              slideshow.env = env;
              env.settings.set('tabstop', 2);
              env.editor.value = req.responseText;
              env.editor.focus = true ;
            });
          }
        }
      }
      req.send("");
    },
    stopEditing: function() {
      var editor = this._node.firstChild;
      var newcontents = slideshow.env.editor.value;
      var slide = editor.parentNode;
      slide.removeChild(editor);
      slideshow._saveCurrentSlide(newcontents, function(contents) {
        slide.innerHTML = contents;
        //$('div.slide *').editable();
      });
    },
    setState: function(state) {
      if (typeof state != 'string') {
        state = this._states[state];
      }
      if (state == 'current' && !this._visited) {
        this._visited = true;
        this._makeBuildList();
      }
      removeClass(this._node, this._states);
      addClass(this._node, state);
      this._currentState = state;

      // delay first auto run. Really wish this were in CSS.
      /*
      this._runAutos();
      */
      var _t = this;
      setTimeout(function(){ _t._runAutos(); } , 400);
    },
    _makeCounter: function() {
      if(!this._count || !this._node) { return; }
      var counters = $(this._node).find('.counter');
      if (counters.length) return;
      var c = doc.createElement('span');
      c.innerHTML = this._count;
      c.className = 'counter';
      this._node.appendChild(c);
    },
    _makeBuildList: function() {
      this._buildList = [];
      if (disableBuilds) { return; }
      if (this._node) {
        this._buildList = query('[data-build] > *', this._node);
      }
      this._buildList.forEach(function(el) {
        addClass(el, 'to-build');
      });
    },
    _runAutos: function() {
      if (this._currentState != 'current') {
        return;
      }
      // find the next auto, slice it out of the list, and run it
      var idx = -1;
      this._buildList.some(function(n, i) {
        if (n.hasAttribute('data-auto')) {
          idx = i;
          return true;
        }
        return false;
      });
      if (idx >= 0) {
        var elem = this._buildList.splice(idx, 1)[0];
        var transitionEnd = isWK ? 'webkitTransitionEnd' : (isFF ? 'mozTransitionEnd' : 'oTransitionEnd');
        var _t = this;
        if (canTransition()) {
          var l = function(evt) {
            elem.parentNode.removeEventListener(transitionEnd, l, false);
            _t._runAutos();
          };
          elem.parentNode.addEventListener(transitionEnd, l, false);
          removeClass(elem, 'to-build');
        } else {
          setTimeout(function() {
            removeClass(elem, 'to-build');
            _t._runAutos();
          }, 400);
        }
      }
    },
    buildNext: function() {
      if (!this._buildList.length) {
        return false;
      }
      removeClass(this._buildList.shift(), 'to-build');
      return true;
    },
  };

  //
  // SlideShow class
  //
  var SlideShow = function(slides) {
    this._slides = (slides || []).map(function(el, idx) {
      return new Slide(el, idx);
    });
    var h = window.location.hash;
    try {
      this.current = parseInt(h.split('#slide')[1], 10);
    } catch (e) { /* squeltch */ }
    this.current = isNaN(this.current) ? 1 : this.current;
    var _t = this;
    doc.addEventListener('keydown', 
        function(e) { _t.handleKeyDown(e); }, false);
    //doc.addEventListener('keyup', 
    //    function(e) { _t.handleKeyUp(e); }, false);
    //doc.addEventListener('keypress', 
    //    function(e) { _t.handleKeyPress(e); }, false);
    doc.addEventListener('mousewheel', 
        function(e) { _t.handleWheel(e); }, false);
    //doc.addEventListener('click', 
    //    function(e) { _t.handleClick(e); }, false);
    doc.addEventListener('DOMMouseScroll', 
        function(e) { _t.handleWheel(e); }, false);
    doc.addEventListener('touchstart', 
        function(e) { _t.handleTouchStart(e); }, false);
    doc.addEventListener('touchend', 
        function(e) { _t.handleTouchEnd(e); }, false);
    window.addEventListener('popstate', 
        function(e) { if (e.state) { _t.go(e.state); } }, false);
    this.setupComments();
    this._update();
    this._setupHandlers();
    console.log("SETING UP HOVER");
    //console.log("#logo");
      $("#logo").hover(function(e) {
        console.log(e);
        //console.log($("#logo"));
        $("#logo").fadeTo('fast', 1);
      }, function(e) {
        console.log(e);
        $("#logo").fadeTo('fast', 0.1);
      }
      );
    
    $("#commentheader").mousedown(function(e) {
      if (slideshow._commentsShowing) {
        slideshow.hideComments();
      } else {
        slideshow.showComments();
      }
    });
  };

  SlideShow.prototype = {
    editing: false,
    _slides: [],
    _commentsShowing: false,
    showComments: function() {
      var commentbox = $("#commentbox");
      var height = - commentbox.height() + 20;
      commentbox.animate({"bottom": 0}, "fast");
      $("#newcomment").focus();
      this._commentsShowing = true;
    },

    hideComments: function() {
      var commentbox = $("#commentbox");
      var height = - commentbox.height() + 20;
      commentbox.animate({"bottom": height}, "fast");
      this._commentsShowing = false;
    },
    
    _addSlide: function(el, idx) {
      this._slides.splice(idx, 0, new Slide(el, idx));
      //this._fixupTimeline();
    },
    _fixupTimeline: function() {
      for (var x = this.current-1; x <= this.current+7; x++) {
        if (this._slides[x-4]) {
          this._slides[x-4].setState(Math.max(0, x-this.current));
        }
      }
    },
    _setupHandlers: function() {
      // setup all jquery and other handlers we need.
      $('div.slide *').editable();
      slideshow = this;
      $('div.slide *').hover(function(e) {
        $(e.target).addClass('selected');
        slideshow.currentDiv = e.target;
        
        //$('#divpanel').removeClass('hidden');
        //var rect = e.target.getBoundingClientRect();
        //var divpanel = document.getElementById('divpanel'); // $("#divpanel");
        //divpanel.style.left = (rect.left + 4) + 'px';
        //divpanel.style.top = ((rect.top + rect.height / 2) - 8 )+ 'px';
      }, function(e) {
        $(e.target).removeClass('selected');
        slideshow.currentDiv = null;
        //console.log(e.target);
        //if (e.target.id != 'divpanel')
        //  $('#divpanel').addClass('hidden');
      });
      
      $("body").bind('editFinish', function(e) {
        // save current slide again, picking up any changes.
        var s = slideshow.curSlide;
        var bits = $(".ui-editable");
        bits.removeClass('ui-editable');
        var html = s.innerHTML;
        html.replace('class=""', '', 'g');
        slideshow._saveCurrentSlide(s.innerHTML);
        bits.addClass('ui-editable');
      });
    },
    
    addDiv: function(e) {
      // we can tell which div we're on because of the mouseover set variable
      var d = slideshow.currentDiv;
      var nd = document.createElement('div');
      //nd.setAttribute('class', d.getAttribute('class'));
      $(nd).text('blahblah');
      d.parentNode.insertBefore(nd, d.nextSibling);
      $(nd).editable();
      $(nd).editable('start');
      $(d).removeClass('selected');
      slideshow.currentDiv = null;
      slideshow.resetSlideHandlers();
    },

    resetSlideHandlers: function(e) {
      slideshow._setupHandlers();
      slideshow._saveCurrentSlide(slideshow.curSlide.innerHTML);
    },
    
    removeCurrentDiv: function(e) {
      // we can tell which div we're on because of the mouseover set variable
      var d = slideshow.currentDiv;
      if (!d) return;
      d.parentNode.removeChild(d);
      slideshow.currentDiv = null;
      slideshow.resetSlideHandlers();
    },

    _saveCurrentSlide: function(newcontents, callback) {
      var params = [];
      params.push(encodeURIComponent("slide") + "=" + encodeURIComponent(newcontents));
      var qparams = params.join("&");
      var url = window.location.pathname + '/save/' + ( slideshow.current-1 )+ '?' + qparams;
      var req = new XMLHttpRequest();
      req.open('GET', url);
      var node = this._node;
      req.onreadystatechange = function (aEvt) {
        if (req.readyState == 4) {
          if (req.status == 200) {
            if (callback) {
              callback(req.responseText);
            }
          }
        }
      };
      req.send("");
    },
    
    _update: function(dontPush) {
      document.querySelector('#presentation-counter').innerText = this.current;
      if (history.pushState) {
        if (!dontPush) {
          history.replaceState(this.current, 'Slide ' + this.current, '#slide' + this.current);
        }
      } else {
        window.location.hash = 'slide' + this.current;
      }
      this._fixupTimeline();
      var comments = [];
      var slideIndex = this.current-1;
      var slideshow = this;
      this.clearComments();
      if (slideIndex in this._commentsPerSlide) {
        comments = this._commentsPerSlide[slideIndex];
        comments.forEach(function(comment) { slideshow.addComment(comment)});
      }
      var commentbox = $("#commentbox");
      var height = - commentbox.height() + 20;
      commentbox.css("bottom", height);
      $("#commentheadercount").text(comments.length);
    },

    current: 0,
    next: function() {
      if (!this._slides[this.current-1].buildNext()) {
        this.current = Math.min(this.current + 1, this._slides.length);
        this._update();
      }
    },
    prev: function() {
      this.current = Math.max(this.current-1, 1);
      this._update();
    },
    go: function(num) {
      this.current = num;
      this._update(true);
    },
    
    editCurrentSlide: function() {
      this._slides[this.current-1].startEditing();
      this.editing = true;
    },

    stopEditingCurrentSlide: function() {
      this._slides[this.current-1].stopEditing();
      this.editing = false;
      slideshow.resetSlideHandlers();
    },
    
    setupComments: function() {
      var commentlist = COMMENTS;
      var show = this;
      this._commentsPerSlide = {};
      var comment;
      commentlist.forEach(function(commentJSON) {
        // we'll create a data structure mapping slide number to a list of
        // comments
        comment = JSON.parse(commentJSON);
        show.registerComment(comment);
      });
    },
    registerComment: function(comment) {
      slideMap = this._commentsPerSlide;
      if (! (comment.slide in slideMap)) {
        slideMap[comment.slide] = [];
      }
      slideMap[comment.slide].push(comment);
    },
    
    addComment: function(commentHash) {
      var comments = $('#comments'); // for now treat as one big list
      var comment = $('<li class="comment"><span class="who">' + commentHash.author +
                      '</span> said: <span class="comment">' + commentHash.comment + '</span></li>');
      comments.append(comment);
    },
    
    clearComments: function() {
      $('#comments').html('');
    },
    makeComment: function(comment, event) {
      var req = new XMLHttpRequest();
      var params = [];
      params.push(encodeURIComponent("comment") + "=" + encodeURIComponent(comment));
      var qparams = params.join("&");
      var url = window.location.pathname + '/add_comment/' + ( this.current - 1)+ '?' + qparams;
      req.open('POST', url, true);
      req.send("");
      var comment = {'comment': comment, 'author': 'you', 'slide': this.current -1}
      this.addComment(comment);
      $("#commentheadercount").text(Number($("#commentheadercount").text())+1);
      this.registerComment(comment); // XXX we probably need an ID too.
      var textbox = document.getElementById("newcomment");
      textbox.value = '';
      textbox.blur();
    },
    
    dismissComment: function(commentId) {
      
    },

    _notesOn: false,
    showNotes: function() {
      var isOn = this._notesOn = !this._notesOn;
      query('.notes').forEach(function(el) {
        el.style.display = (notesOn) ? 'block' : 'none';
      });
    },
    switch3D: function() {
      toggleClass(document.body, 'three-d');
    },
    handleWheel: function(e) {
      // trigger happy
      return;
      var delta = 0;
      if (e.wheelDelta) {
        delta = e.wheelDelta/120;
        if (isOpera) {
          delta = -delta;
        }
      } else if (e.detail) {
        delta = -e.detail/3;
      }

      if (delta > 0 ) {
        this.prev();
        return;
      }
      if (delta < 0 ) {
        this.next();
        return;
      }
    },
    _leaveAddMode: function() {
      $("#add_hud").toggleClass('hidden');
      this._in_add_hud = false;
    },
    _enterAddMode: function() {
      $("#add_hud").toggleClass('hidden');
      this._in_add_hud = true;
    },
    _leaveDeleteMode: function() {
      $("#delete_hud").toggleClass('hidden');
      this._in_delete_hud = false;
    },
    _enterDeleteMode: function() {
      $("#delete_hud").toggleClass('hidden');
      this._in_delete_hud = true;
    },
    
    get curSlide() {
      return this._slides[this.current-1]._node;
    },
    
    addSlideAtOffset: function(offset) {
      // ask the server for the html
      var req = new XMLHttpRequest();
      var index = this.current + offset;
      var url = window.location.pathname + '/insert_slide/' + index;

      req.open('GET', url);
      var curSlideNode = this._slides[this.current-1]._node;
      var slideshow = this;
      req.onreadystatechange = function (aEvt) {
        if (req.readyState == 4) {
          if (req.status == 200) {
            // add it to the dom
            var slide = document.createElement('div');
            slide.innerHTML = req.responseText;
            //slide.setAttribute('style', 'background-image: url(/random_image/color?' + randomString() + ')');
            if (offset < 0) {
              curSlideNode.parentNode.insertBefore(slide, curSlideNode);
              slide.setAttribute('class', 'slide past');
              slideshow._addSlide(slide, index);
              slideshow.current += 1; // indeed!  move to the _addSlide logic?
              slideshow.prev();
            } else {
              slide.setAttribute('class', 'slide future');
              if (curSlideNode.nextSibling) {
                curSlideNode.parentNode.insertBefore(slide, curSlideNode.nextSibling);
              } else {
                curSlideNode.parentNode.appendChild(slide);
              }
              slideshow._addSlide(slide, index);
              slideshow.next();
            }
            slideshow._setupHandlers();
          }
        }
      }
      req.send("");
    },
    addSlideAfter: function() {
      this.addSlideAtOffset(0);
    },
    
    addSlideBefore: function() {
      this.addSlideAtOffset(-1);
    },

    deleteCurrentSlide: function() {
      // ask the server for the html
      var req = new XMLHttpRequest();
      var index = this.current-1;
      var url = window.location.pathname + '/slide/' + index;

      req.open('delete', url);
      var curSlideNode = this._slides[this.current-1]._node;
      var slideshow = this;
      req.onreadystatechange = function (aEvt) {
        if (req.readyState == 4) {
          if (req.status == 200) {
            // deletion was successful
            // remove it from the dom
            curSlideNode.parentNode.removeChild(curSlideNode);
            var slides = slideshow._slides;
            // remove it from the slides array
            slideshow._slides = slideshow._slides.slice(0,index).concat( slideshow._slides.slice(index+1) );
            
            slideshow._update();
            // make sure we're on the next slide, not the previous one.
              //slideshow._addSlide(slide, index);
              //slideshow.current += 1; // indeed!  move to the _addSlide logic?
              //slideshow.prev();
            }
          }
        }
      req.send("");
    },

    handleKeyDown: function(e) {
      // probably want to only do it if we've bubbled to the top or something.
      if (e.keyCode == 27) {
        if (this.editing) {
          this.stopEditingCurrentSlide();
          e.preventDefault(); 
          e.stopPropagation();
          return;
        } else if (this._commentsShowing) {
          this.hideComments();
          e.preventDefault(); 
          e.stopPropagation();
          return;
        }
      }
      //console.log(e);
      //e.stopPropagation();
      //e.preventDefault();
      var tag = e.target.tagName
      if ((tag == "BODY") || (tag == "HTML")) {
        switch (e.keyCode) {
          case 8: // delete
            this.removeCurrentDiv();
            e.preventDefault(); 
            e.stopPropagation();
            break;
          case 65: // a
            if (! this._in_add_hud) {
              this._enterAddMode();
            } else {
              // we already hit 'a'
              this.addSlideAfter();
              this._leaveAddMode();
            }
            break;
          case 66: // b
            if (this._in_add_hud) {
              // a, b -> add before
              this.addSlideBefore();
              this._leaveAddMode();
            }
            break;
          case 67: // c
            e.preventDefault();
            e.stopPropagation();
            this.showComments();
            break;
          case 68: // d
            if (! this._in_delete_hud) {
              this._enterDeleteMode();
            }
            break;
          case 80: // p
            this.addDiv();
            e.preventDefault();
            e.stopPropagation();
            break;
          case 89: // y
            if (this._in_delete_hud) {
              this.deleteCurrentSlide();
              this._leaveDeleteMode();
            }
            break;
          case 27: // esc
            if (this._in_add_hud) {
              this._leaveAddMode();
            } else if (this._in_delete_hud) {
              this._leaveDeleteMode();
            } else {
              if (! this.editing) {
                this.editCurrentSlide();
              }
            }
            e.preventDefault(); 
            e.stopPropagation();
            break;
          case 13: // return
            if (e.ctrlKey) {
              this.stopEditingCurrentSlide();
            }
            break;
          case 188: // "<"
            break;
          case 190: // ">"
            break;
        case 37: // left arrow
          this.prev();
          break;
        case 39: // right arrow
        case 32: // space
          this.next();
          break;
        case 50: // 2
          this.showNotes(); // XXX understand better
          break;
        case 51: // 3
          this.switch3D(); // XXX understand better
          break;
            
        }
      }
      
      if (/^(input|textarea)$/i.test(e.target.nodeName)) return;
      
      switch (e.keyCode) {
      }
    },
    _touchStartX: 0,
    handleTouchStart: function(e) {
      this._touchStartX = e.touches[0].pageX;
    },
    handleTouchEnd: function(e) {
      var delta = this._touchStartX - e.changedTouches[0].pageX;
      var SWIPE_SIZE = 150;
      if (delta > SWIPE_SIZE) {
        this.next();
      } else if (delta< -SWIPE_SIZE) {
        this.prev();
      }
    },
  };

  // Initialize
  slideshow = new SlideShow(query('.slide'));
  
  var Webchat = function(chatul) {
    this._setup(chatul);
  };

  Webchat.prototype = {
    _ul: null,
    _showing: false,
    _setup: function(ul) {
      this._ul = ul;
      var chat = this;
      chat.hide();
      $("#chatheader").mousedown(function(e) {
        if (chat._showing) {
          chat.hide();
        } else {
          chat.show();
        }

      });
      this.socket = new io.Socket(null, {port: 3000});
      this.socket.connect();
      this.socket.on('message', function(obj){
        webchat.addMessage(obj.payload);
      });
    },
    hide: function() {
      var chatbox = $("#chatbox");
      var height = - chatbox.height() + 20;
      chatbox.animate({"bottom": height}, "fast");
      this._showing = false;
    },
    show: function() {
      var chatbox = $("#chatbox");
      var height = - chatbox.height() + 20;
      chatbox.animate({"bottom": 0}, "fast");
      $("#newchat").focus();
      this._showing = true;
    },
    say: function(something) {
      var textbox = document.getElementById("newchat");
      textbox.value = '';
      webchat.socket.send({'author': 'me',
                          'message': something});
      webchat.addMessage({'author': 'you',
                      'message': something});
    },
    addMessage: function(line) {
      var chats = $('#chats'); // for now treat as one big list
      var chat = $('<li class="chat"><span class="who">' + line.author +
                      '</span> said: <span class="chat">' + line.message + '</span></li>');
      chats.append(chat);
    }
  };
  
  webchat = new Webchat(query('#chats'));
})();

// Copyright 2013 Sami Samhuri

module.exports = {

  // write
  set: callbackOptional(set)
, writer: writer

  // read
, exists: callbackOptional(exists)
, fetch: callbackOptional(fetch)
, ttl: callbackOptional(ttl)
, list: list
, fetchAll: fetchAll
, count: count

  // remove
, remove: callbackOptional(remove)
, removeAll: removeAll
, sweep: sweep

  // change redis client
, redis: setRedis
};

var async = require('async')
  , redis = require('redis').createClient()
  , LineEmitter = require('./line_emitter.js')
  ;

function setRedis(newRedis) {
  if (redis) redis.end();
  redis = newRedis;
}

// Make the callback argument of a function optional.
// If the callback is passed it will call the function
// normally. If the callback isn't given a function
// that accepts the callback is returned, with the
// rest of the arguments fixed (like bind).
//
// function fetch(id, cb) { db.fetch(id, cb); }
// fetch = callbackOptional(fetch);
//
// function print(err, x) { if (err) throw err; console.log(x); }
//
// fetch(1, print);
//
// var fetch1 = fetch(1);
// fetch1(print);
function callbackOptional(fn, ctx) {
  return function() {
    var args = Array.prototype.slice.call(arguments);
    var cb = args[args.length - 1];
    if (typeof cb == 'function') {
      fn.apply(ctx, arguments);
    }
    else {
      return function(cb) {
        args.push(cb);
        fn.apply(ctx, args);
      };
    }
  };
}

function k(name) {
  return 'kwikemon:monitor:' + name;
}

function exists(name, cb) {
  redis.exists(k(name), function(err, exists) {
    if (err) return cb(err);
    cb(null, exists == 1);
  });
}

// options:
//   - ttl: time to live in seconds, <= 0 to never expire
function set(name, text, options, cb) {
  if (typeof options == 'function') {
    cb = options;
    options = null;
  }
  options = options || {};
  var key = k(name)
    , ttl = ('ttl' in options) ? options.ttl : 86400
    ;
  exists(name, function(err, exists) {
    var fields = {
          text: text
        , modified: Date.now()
        }
      , multi = redis.multi()
      ;
    if (!exists) {
      fields.created = Date.now();
    }
    multi
      .hmset(key, fields)
      .hincrby(key, 'updates', 1);
    if (ttl != null) {
      multi.expire(key, ttl);
    }
    multi.sadd('kwikemon:monitors', name);
    multi.exec(cb);
  });
}

function writer(name) {
  var le = new LineEmitter();
  le.on('line', function(line) {
    set(name, line, function(err) {
      if (err) throw err;
      le.emit('monitor', name, line);
    });
  });
  return le;
}

function fetch(name, cb) {
  redis.hgetall(k(name), cb);
}

function ttl(name, cb) {
  redis.ttl(k(name), cb);
}

function count(cb) {
  redis.scard('kwikemon:monitors', cb);
}

function sweep(cb) {
  var i = 0
    , n
    , checkIfDone = function() {
        i += 1;
        if (i == n) cb();
      }
    ;
  redis.smembers('kwikemon:monitors', function(err, names) {
    if (err) return cb(err);
    n = names.length;
    if (n == 0) return cb();
    names.forEach(function(name) {
      exists(name, function(err, exists) {
        if (err) {
          // meh, ignore it
        }
        // remove expired monitors
        else if (!exists) {
          remove(name);
        }
        checkIfDone();
      });
    });
  });
}

function list(cb) {
  sweep(function(err) {
    if (err) return cb(err);
    redis.smembers('kwikemon:monitors', cb);
  });
}

function fetchAll(cb) {
  var monitors = {};
  list(function(err, names) {
    if (err) return cb(err);
    var fetchers = names.sort().map(function(name) {
      return function(done) {
        fetch(name, function(err, text) {
          if (err) return done(err);
          monitors[name] = text;
          done();
        });
      };
    });
    async.parallel(fetchers, function(err, _) {
      if (err) return cb(err);
      cb(null, monitors)
    });
  });
}

function remove(name, cb) {
  redis.multi()
    .del(k(name))
    .srem('kwikemon:monitors', name)
    .exec(cb);
}

function removeAll(cb) {
  redis.smembers('kwikemon:monitors', function(err, names) {
    if (err) return cb(err);
    var multi = redis.multi();
    names.forEach(function(name) {
      multi.del(k(name));
      multi.srem('kwikemon:monitors', name);
    });
    multi.exec(cb);
  });
}

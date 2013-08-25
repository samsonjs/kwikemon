// Copyright 2013 Sami Samhuri

module.exports = {

  // write
  set: callbackOptional(set)
, writer: writer

  // read
, exists: callbackOptional(exists)
, get: callbackOptional(get)
, ttl: callbackOptional(ttl)
, count: count
, list: list
, getAll: getAll

  // remove
, remove: callbackOptional(remove)
, clear: clear
, sweep: sweep

  // change redis client
, redis: redis
};

var async = require('async')
  , fs = require('fs')
  , Redis = require('redis')
  , redisClient
  , toml = require('toml')
  , LineEmitter = require('./line_emitter.js')
  ;

function redis(newRedis) {
  if (newRedis){
    if (redisClient) redisClient.end();
    redisClient = newRedis;
  }
  else {
    if (!redisClient) {
      var configFile = process.env.HOME + '/.kwikemon.toml'
        , config = {}
        ;
      if (fs.existsSync(configFile)) {
        config = toml.parse(fs.readFileSync(configFile));
      }
      config.redis = config.redis || {};
      redisClient = Redis.createClient(config.redis.port, config.redis.host, config.redis.options);
    }
    return redisClient;
  }
}

// Make the callback argument of a function optional.
// If the callback is passed it will call the function
// normally. If the callback isn't given a function
// that accepts the callback is returned, with the
// rest of the arguments fixed (like bind).
//
// function get(id, cb) { db.get(id, cb); }
// get = callbackOptional(get);
//
// function print(err, x) { if (err) throw err; console.log(x); }
//
// get(1, print);
//
// var get1 = get(1);
// get1(print);
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
  redis().exists(k(name), function(err, exists) {
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
          name: name
        , text: text
        , modified: Date.now()
        }
      , multi = redis().multi()
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

function get(name, cb) {
  redis().hgetall(k(name), cb);
}

function expire(name, ttl, cb) {
  exists(name, function(err, exists) {
    if (err || !exists) {
      return cb(err || new Error('not found'));
    }
    redis().multi()
      .hset(k(name), 'expire', ttl)
      .expire(k(name), ttl)
      .exec(cb);
  });
}

function ttl(name, ttl, cb) {
  if (typeof ttl == 'number') {
    expire(name, ttl, cb);
  }
  else {
    cb = ttl;
    redis().ttl(k(name), cb);
  }
}

function count(cb) {
  sweep(function(err) {
    if (err) return cb(err);
    redis().scard('kwikemon:monitors', cb);
  })
}

function sweep(cb) {
  var i = 0
    , n
    , checkIfDone = function() {
        i += 1;
        if (i == n) cb();
      }
    ;
  redis().smembers('kwikemon:monitors', function(err, names) {
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
    redis().smembers('kwikemon:monitors', cb);
  });
}

function getAll(cb) {
  var monitors = {};
  list(function(err, names) {
    if (err) return cb(err);
    var geters = names.sort().map(function(name) {
      return function(done) {
        get(name, function(err, text) {
          if (err) return done(err);
          monitors[name] = text;
          done();
        });
      };
    });
    async.parallel(geters, function(err, _) {
      if (err) return cb(err);
      cb(null, monitors)
    });
  });
}

function remove(name, cb) {
  redis().multi()
    .del(k(name))
    .srem('kwikemon:monitors', name)
    .exec(cb);
}

function clear(cb) {
  redis().smembers('kwikemon:monitors', function(err, names) {
    if (err) return cb(err);
    var multi = redis().multi();
    names.forEach(function(name) {
      multi.del(k(name));
      multi.srem('kwikemon:monitors', name);
    });
    multi.exec(cb);
  });
}

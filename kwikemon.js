// Copyright 2013 Sami Samhuri

var async = require('async')
  , redis = require('redis')
  , LineEmitter = require('./line_emitter.js')
  ;

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

var kwikemon = module.exports = {
  Monitor: Monitor

, defaultTTL: 86400
, keyPrefix: 'kwikemon:'

  // get or set the redis connection
, redis: function(newRedis) {
    // set
    if (newRedis) {
      if (kwikemon._redis) kwikemon._redis.end();
      kwikemon._redis = newRedis;
    }
    // get, init if necessary
    else {
      if (!kwikemon._redis) {
        kwikemon._redis = redis.createClient();
      }
      return kwikemon._redis;
    }
  }

, key: function(name) {
    return kwikemon.keyPrefix + 'monitor:' + name;
  }

, indexKey: function() {
    return kwikemon.keyPrefix + 'monitors';
  }

, count: function(cb) {
    kwikemon.redis().scard(kwikemon.indexKey(), cb);
  }

, sweep: function(cb) {
    var keptNames = [];
    kwikemon.redis().smembers(kwikemon.indexKey(), function(err, names) {
      if (err) return cb(err);
      var sweepers = names.map(function(name) {
        return function(done) {
          kwikemon.exists(name, function(err, exists) {
            if (err) {
              done();
            }
            // remove expired monitors
            else if (!exists) {
              new Monitor(name).remove(done);
            }
            else {
              keptNames.push(name);
              done();
            }
          });
        };
      });
      async.parallel(sweepers, function(err, _) {
        cb(err, keptNames);
      });
    });
  }

, list: function(cb) {
    kwikemon.sweep(function(err, names) {
      if (err) return cb(err);
      cb(null, names);
    });
  }

, fetchAll: function(cb) {
    var monitors = {};
    kwikemon.list(function(err, names) {
      if (err) return cb(err);
      var fetchers = names.sort().map(function(name) {
        return function(done) {
          kwikemon.fetch(name, function(err, mon) {
            if (err) return done(err);
            monitors[name] = mon;
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

, clear: function(cb) {
    kwikemon.list(function(err, names) {
      if (err) return cb(err);
      var removers = names.map(function(name) {
        return function(done) {
          new Monitor(name).remove(done);
        };
      });
      async.parallel(removers, cb);
    });
  }

, exists: callbackOptional(function(name, cb) {
    kwikemon.redis().exists(kwikemon.key(name), function(err, exists) {
      if (err) return cb(err);
      cb(null, exists == 1);
    });
  }, kwikemon)

, fetch: callbackOptional(function(name, cb) {
    kwikemon.redis().hgetall(kwikemon.key(name), function(err, fields) {
      if (err) return cb(err);
      if (fields) {
        cb(null, new Monitor(name, fields));
      }
      else {
        cb(new Error('not found'));
      }
    });
  }, kwikemon)

, ttl: callbackOptional(function(name, cb) {
    new Monitor(name).ttl(cb);
  }, kwikemon)

, set: callbackOptional(function(name, text, cb) {
    return kwikemon.setex(name, text, null, cb);
  }, kwikemon)

, setex: callbackOptional(function(name, text, ttl, cb) {
    kwikemon.fetch(name, function(err, mon) {
      if (err && err.message != 'not found') return cb(err);
      mon = mon || new Monitor(name);
      mon.text = text;
      if (typeof ttl == 'number') {
        mon.expire = ttl;
      }
      mon.save(cb);
    });
  }, kwikemon)

, writer: callbackOptional(function(name, ttl, cb) {
    if (typeof ttl == 'function') {
      cb = ttl;
      ttl = null;
    }
    kwikemon.fetch(name, function(err, mon) {
      if (err && err.message != 'not found') return cb(err);
      mon = mon || new Monitor(name);
      if (typeof ttl == 'number') {
        mon.expire = ttl;
      }
      cb(null, mon.writer());
    });
  }, kwikemon)

, remove: callbackOptional(function(name, cb) {
    new Monitor(name).remove(cb);
  }, kwikemon)

};

function Monitor(name, fields) {
  this.name = name;
  if (fields) {
    this.text = fields.text;
    this.created = fields.created ? new Date(+fields.created) : null;
    this.modified = fields.modified ? new Date(+fields.modified) : null;
    this.updates = fields.updates || 0;
    this.expire = typeof fields.expire == 'number' ? fields.expire : kwikemon.defaultTTL;
  }
}

Monitor.prototype.key = function() {
  return kwikemon.key(this.name);
};

Monitor.prototype.remove = function(cb) {
  kwikemon.redis().multi()
    .del(this.key())
    .srem(kwikemon.indexKey(), this.name)
    .exec(cb);
};

Monitor.prototype.update = function(text, cb) {
  this.text = text;
  this.save(cb);
};

Monitor.prototype.save = function(cb) {
  var self = this
    , key = this.key()
    ;
  kwikemon.exists(this.name, function(err, exists) {
    var fields = {
          text: self.text
        , expire: self.expire
        , modified: Date.now()
        }
      , multi = kwikemon.redis().multi()
      ;
    if (!exists) {
      fields.created = Date.now();
    }
    multi
      .hmset(key, fields)
      .hincrby(key, 'updates', 1)
      .expire(key, self.expire)
      .sadd(kwikemon.indexKey(), self.name)
      .exec(cb);
  });
};

Monitor.prototype.ttl = function(cb) {
  kwikemon.redis().ttl(this.key(), cb);
};

Monitor.prototype.writer = function() {
  var self = this
    , le = new LineEmitter()
    ;
  le.on('line', function(line) {
    self.update(line, function(err) {
      if (err) throw err;
      le.emit('monitor', self.name, line);
    });
  });
  return le;
};

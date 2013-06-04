// Copyright 2013 Sami Samhuri

module.exports = {
  // read
  fetchMonitor: fetchMonitor
, fetchMonitors: fetchMonitors

  // write
, monitor: monitor
, createWriter: createWriter
};

var redis = require('redis').createClient()
  , LineEmitter = require('./line_emitter.js')
  ;

function monitor(name, text, options) {
  console.log(name,'=',text)
  options = options || {};
  if (typeof options == 'function') {
    options = { cb: options };
  }
  var key = 'kwikemon:monitor:' + name
    , timeout = options.timeout || 86400
    ;
  console.log('set',key,text)
  redis.set(key, text, function(err, status) {
    console.log('set',key,text)
    if (err) throw err;
    if (timeout >= 0) {
      redis.expire(key, timeout);
    }
    redis.sadd('kwikemon:monitors', name, function(err, status) {
      if (options.cb) options.cb();
    });
  });
}

function createWriter(name) {
  var le = new LineEmitter();
  le.on('line', function(line) {
    monitor(name, line);
  });
  return le;
}

function fetchMonitor(name, cb) {
  redis.get('kwikemon:monitor:' + name, cb);
}

function fetchMonitors(cb) {
  var monitors = {}
    , i = 0
    , n
    , checkIfDone = function() {
        i += 1;
        if (i == n) cb(null, monitors);
      }
    ;
  redis.smembers('kwikemon:monitors', function(err, names) {
    if (err) return cb(err);
    n = names.length;
    names.forEach(function(name) {
      fetchMonitor(name, function(err, text) {
        if (err) {
          // missing? probably don't care
        }
        else {
          monitors[name] = text;
        }
        checkIfDone();
      });
    });
  });
}


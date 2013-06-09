// Copyright 2013 Sami Samhuri

module.exports = {
  create: create
, start: start
, stop: stop
};

var http = require('http')
  , kwikemon = require('./kwikemon.js')
  , _server
  ;

function create() {
  return http.createServer(handleRequest);
}

function start(port, host) {
  port = port || 1111;
  host = host || '127.0.0.1';
  _server = create();
  _server.listen(port, host);
  console.log('kwikemond listening on ' + host + ':' + port);
  return _server;
}

function stop() {
  _server.close();
  _server = null;
}

function handleRequest(req, res) {
  var name = req.url.replace(/^\//, '')
    , type = 'html'
    , m
    ;
  if (name == 'favicon.ico') return res.end();
  if (m = name.match(/\.(json|txt)$/)) {
    type = m[1];
    name = name.replace(RegExp('\.' + type + '$'), '');
  }
  if (name) {
    kwikemon.get(name, function(err, text) {
      if (err) {
        res.end('error: ' + (err.message || 'unknown'));
        return;
      }
      res.end(text);
    });
  }
  // all
  else {
    kwikemon.getAll(function(err, monitors) {
      if (err) {
        res.end('error: ' + (err.message || 'unknown'));
        return;
      }
      Object.keys(monitors).sort().forEach(function(name) {
        res.write(name + ': ' + monitors[name] + '\n');
      });
      res.end();
    });
  }
}

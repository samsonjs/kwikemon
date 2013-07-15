// Copyright 2013 Sami Samhuri

var express = require('express')
  , Negotiator = require('negotiator')
  , kwikemon = require('./kwikemon.js')
  , app = module.exports = express()
  , version = require('./version.js')
  ;

// Middleware
app.use(express.favicon('/dev/null'));
app.use(express.logger());
app.use(express.static(__dirname + '/public'));

// Views
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

// Routes
app.get('/', route('monitors', getMonitors));
app.get('/:name', route('monitor', getMonitor));

function route(template, buildContext) {
  return function(req, res) {
    buildContext(req, res, function(err, ctx) {
      if (err) {
        var message = err.message || String(err)
          , status = message == 'not found' ? 404 : 500
          ;
        res.format({
          html: function() {
            res.render('error', {
              version: version,
              pageTitle: 'Error',
              err: err
            });
          },
          text: function() {
            res.send(renderText('error', { err: err }));
          },
          json: function() {
            res.json({ message: message });
          }
        });
      }
      else {
        ctx = ctx || {};
        res.format({
          html: function() {
            ctx.version = version;
            res.render(template, ctx);
          },
          text: function() {
            res.send(renderText(template, ctx));
          },
          json: function() {
            res.json(ctx);
          }
        });
      }
    });
  };
}

// Rendering

function renderText(template, ctx) {
  var text;
  switch (template) {
  case 'monitor':
    text = String(ctx.monitor.text);
    break;

  case 'monitors':
    text = Object.keys(ctx.monitors).sort().map(function(name) {
      return name + ': ' + ctx.monitors[name].text;
    }).join('\n');
    break;

  case 'error':
    text = ctx.err.message || String(ctx.err);
    break;

  default:
    throw new Error('unknown text template: ' + template);
  }
  return text;
}


//////////////////////
// Request handlers //
//////////////////////

function getMonitors(req, res, cb) {
  kwikemon.getAll(function(err, monitors) {
    cb(err, err ? null : {
      pageTitle: 'Monitors',
      monitors: monitors
    });
  });
}

function getMonitor(req, res, cb) {
  var name = req.params.name;
  kwikemon.get(name, function(err, mon) {
    if (!mon) {
      err = new Error('not found');
    }
    cb(err, err ? null : {
      pageTitle: mon.name,
      monitor: mon
    });
  });
}


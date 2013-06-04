// Copyright 2013 Sami Samhuri

module.exports = LineEmitter;

var stream = require('stream')
  , Transform = stream.Transform
  ;

function LineEmitter(options) {
  Transform.call(this, options);
  this._buffer = [];
}

LineEmitter.prototype = Object.create(Transform.prototype, {
  constructor: { value: LineEmitter }
});

LineEmitter.prototype._transform = function(chunk, encoding, done) {
  // check for a newline
  var split = -1;
  for (var i = 0; i < chunk.length; i++) {
    if (chunk[i] === 10) { // '\n'
      split = i;
      break;
    }
  }

  // buffer until we see a newline
  if (split == -1) {
    this._buffer.push(chunk);
  }

  // construct & emit the line, buffering the rest of the next line
  else {
    this._buffer.push(chunk.slice(0, split));
    var line = Buffer.concat(this._buffer).toString();
    this.emit('line', line);

    // skip over newline
    this._buffer = [chunk.slice(split + 1)];
  }

  // no actual transform
  this.push(chunk);
  done();
}

LineEmitter.prototype._flush = function(cb) {
  var line = Buffer.concat(this._buffer).toString();
  if (line) {
    this.emit('line', line);
  }
  this._buffer = [];
}

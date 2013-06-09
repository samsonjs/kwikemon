// Copyright 2013 Sami Samhuri

var assert = require('better-assert')
  , async = require('async')
  , kwikemon = require('./kwikemon')
  , redis = require('redis').createClient()
  ;

before(function(done) {
  redis.select(1, function() {
    kwikemon.redis(redis);
    done();
  });
});
beforeEach(kwikemon.clear);
after(kwikemon.clear);

describe("kwikemon", function() {
  describe("#set", function() {
    it("should set text", function(done) {
      kwikemon.set('foo', 'bar', function(err) {
        kwikemon.get('foo', function(err, mon) {
          assert(mon.text == 'bar');
          done();
        });
      });
    });

    it("should overwrite text", function(done) {
      kwikemon.set('foo', 'baz', function(err) {
        kwikemon.get('foo', function(err, mon) {
          assert(mon.text == 'baz');
          done();
        });
      });
    });

    it("should set custom ttls", function(done) {
      kwikemon.set('foo', 'bar', { ttl: 1 }, function(err) {
        kwikemon.ttl('foo', function(err, ttl) {
          assert(ttl <= 1);
          done();
        });
      })
    });

    it("should not expire with a ttl of zero", function(done) {
      kwikemon.set('foo', 'bar', { ttl: 0 }, function(err) {
        kwikemon.ttl('foo', function(err, ttl) {
          assert(ttl == -1);
          done();
        });
      });
    });

    it("should not expire when ttl is < 0", function(done) {
      kwikemon.set('foo', 'bar', { ttl: -1 }, function(err) {
        kwikemon.ttl('foo', function(err, ttl) {
          assert(ttl == -1);
          done();
        });
      })
    });
  });

  describe("#writer", function() {
    it("should monitor each line of text written", function(done) {
      var writer = kwikemon.writer('foo');
      writer.once('monitor', function(name, text) {
        assert(text == 'a');
        writer.once('monitor', function(name, text) {
          assert(text == 'b');
          done();
        });
        writer.write("b\n");
      });
      writer.write("a\n");
    });

    it("should only monitor complete lines of text", function(done) {
      var writer = kwikemon.writer('foo');
      writer.once('monitor', function(name, text) {
        assert(text == 'complete');
        writer.once('monitor', function(name, text) {
          assert(text == 'incomplete');
          done();
        });
        writer.write("plete\n");
      });
      writer.write("complete\n");
      writer.write("incom");
    });
  });

  describe("#get", function() {
    it("should get the last text monitored", function(done) {
      async.series([
          kwikemon.set('foo', 'bar')
        , kwikemon.set('foo', 'marcellus')
        , kwikemon.get('foo')
        ],
        function(err, results) {
          var mon = results[2];
          assert(mon.text == 'marcellus');
          done();
        }
      );
    });

    it("should get null for non-existent monitors", function(done) {
      kwikemon.get('non-existent', function(err, mon) {
        assert(mon == null);
        done();
      });
    });
  });

  describe("#ttl", function() {
    it("should get the last TTL set", function(done) {
      kwikemon.set('foo', 'bar', { ttl: 300 }, function(err) {
        kwikemon.ttl('foo', function(err, ttl) {
          assert(ttl <= 300);
          done();
        });
      });
    });

    it("should return -1 for non-existent monitors", function(done) {
      kwikemon.ttl('non-existent', function(err, ttl) {
        assert(ttl == -1);
        done();
      });
    });

    it("should set a ttl if given one", function(done) {
      kwikemon.set('foo', 'bar', function(err) {
        kwikemon.ttl('foo', 100, function(err) {
          kwikemon.ttl('foo', function(err, ttl) {
            assert(ttl <= 100);
            done();
          });
        });
      });
    });
  });

  describe("#getAll", function() {
    it("should get all monitors", function(done) {
      async.series([
          kwikemon.set('a', '1')
        , kwikemon.set('b', '2')
        , kwikemon.set('c', '3')
        , kwikemon.getAll
        ],
        function(err, results) {
          var monitors = results.pop()
            , names = Object.keys(monitors).sort();
          assert(names.length == 3);
          assert(names[0] == 'a' && monitors.a.text == '1');
          assert(names[1] == 'b' && monitors.b.text == '2');
          assert(names[2] == 'c' && monitors.c.text == '3');
          done();
        }
      );
    });
  });

  describe("#count", function() {
    it("should count all monitors", function(done) {
      async.series([
          kwikemon.set('a', '1')
        , kwikemon.set('b', '2')
        , kwikemon.set('c', '3')
        , kwikemon.count
        ],
        function(err, results) {
          var n = results.pop();
          assert(n == 3);
          done();
        }
      );
    });
  });

  describe("#remove", function() {
    it("should remove the named monitor", function(done) {
      async.series([
          kwikemon.set('foo', 'bar')
        , kwikemon.remove('foo')
        , kwikemon.exists('foo')
        ],
        function(err, results) {
          var exists = results.pop();
          assert(!exists);
          done();
        }
      );
    });
  });

  describe("#clear", function() {
    it("should remove the named monitor", function(done) {
      async.series([
          kwikemon.set('foo', 'bar')
        , kwikemon.set('baz', 'quux')
        , kwikemon.clear
        , kwikemon.exists('foo')
        , kwikemon.exists('baz')
        , kwikemon.count
        ],
        function(err, results) {
          var n = results.pop()
            , bazExists = results.pop()
            , fooExists = results.pop()
            ;
          assert(!fooExists);
          assert(!bazExists);
          assert(n == 0);
          done();
        }
      );
    });
  });
});

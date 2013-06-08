# kwik-e-mon

Monitor one-off tasks on your servers using Redis.


## Installation

npm install -g kwikemon


## Usage

    $ kwikemond &
    $ curl -s localhost/nginx_status | grep Active | kwikemon nginx-connections
    $ curl localhost:1111/nignx-connections
    Active connections: 316
    $ kwikemon foo bar
    $ curl localhost:1111/
    foo: bar
    nginx-connections: Active connections: 316

Here's how it works:

- call `kwikemon thing status` to set the text for the monitor named "thing"
- fire up the server, `kwikemond`, that serves up these monitors in a big list or individually

Alternatively:

- continuously pipe data to `kwikemon <name of thing you are watching>` on stdin
- every time a full line of text is received on stdin it becomes the new status for <name of thing you are watching>

To see everything `kwikemon` can do run it without arguments.

    # or with -h or --help
    $ kwikemon

This is very much a work in progress.


## API

You can use kwikemon as a library.

    var kwikemon = require('kiwkemon');

    kwikemon.set('foo', 'bar', function(err) {
      kwikemon.fetch('foo', function(err, text) {
        console.log('foo = ' + text);
      });
    });

    kwikemon.fetchAll(function(err, monitors) {
      Object.keys(monitors).forEach(function (name) {
        console.log(name + ' = ' + monitors[name]);
      });
    });

Monitors expire 1 day after the last time they were set by default. You can pass in any `ttl` you
want though.

    // never expire
    kwikemon.set('foo', 'bar', { ttl: 0 });


## Protocol

All kwikemon does is shove things into Redis in a standard way and read them out later.

A monitor named `nginx` stores its data in the hash `kwikemon:monitor:nginx`. Hash fields
are:

  - text
  - created
  - modified
  - updates

The list of all monitors is a set stored at `kwikemon:monitors`.

#### List

This is when you should clean out expired entries.

    names = redis.smembers("kwikemon:monitors")
    monitors = {}
    for name in names:
        if redis.exists("kwikemon:monitor:$name"):
            monitors[name] = redis.hget("kwikemon:monitor:$name", "text")
    return monitors

#### Read

    redis.hgetall("kwikemon:monitor:nginx")

#### Update

    exists = redis.exists("kwikemon:monitor:nginx")
    if exists:
        redis.hmset("kwikemon:monitor:nginx", {
            text: "Active connections: 583"
            modified: 1370668341943
        })
        redis.hincrby("kwikemon:monitor:nginx", "updates", 1)
    else:
        redis.hmset("kwikemon:monitor:nginx", {
            text: "Active connections: 316"
            updates: 1
            created: 1370668301943
            modified: 1370668301943
        })
    redis.sadd("kwikemon:monitors", "nginx")
    # optional
    redis.expire("kwikemon:monitor:nginx", <ttl>)

#### Delete

    redis.del("kwikemon:monitor:nginx")
    redis.srem("kwikemon:monitors", "nginx")


## License

Copyright 2013 Sami Samhuri <sami@samhuri.net>

[MIT license](http://sjs.mit-license.org)


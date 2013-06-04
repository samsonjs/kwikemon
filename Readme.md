# kwik-e-mon

Monitor one-off tasks on your servers.


## Installation

npm install -g kwikemon


## Usage

I can't think of a concise example use of the command line tool. Here's how it works:

- you continuously pipe data to `kwikemon <name of thing you are watching>` on stdin
- every time a full line of text is received on stdin it becomes the new status for <name of thing you are watching>
- there's a simple web server, `kwikemond`, that serves up these monitors in a big list or individually

This is very much a work in progress and as the functionality is fleshed out this readme will improve as well.


## License

Copyright 2013 Sami Samhuri <sami@samhuri.net>

[MIT license](http://sjs.mit-license.org)


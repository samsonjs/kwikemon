// Copyright 2013 Sami Samhuri

module.exports = JSON.parse(require('fs').readFileSync('./package.json')).version;

$LOAD_PATH << File.expand_path('../lib', __FILE__)
require 'kwikemon/version'

Gem::Specification.new do |s|
  s.name = 'kwikemon'
  s.version = Kwikemon::VERSION
  s.license = 'MIT'
  s.summary = 'Ruby client for kwikemon.'
  s.description = 'Read & write simple monitors using Redis.'
  s.author = 'Sami Samhuri'
  s.email = 'sami@samhuri.net'
  s.homepage = 'https://github.com/samsonjs/kwikemon'
  s.require_path = './lib'
  s.files = ['lib/kwikemon.rb', 'lib/kwikemon/monitor.rb', 'lib/kwikemon/version.rb']
  s.add_dependency 'redis', '~> 3.0.4'
  s.required_ruby_version = '>= 1.9.1'
end

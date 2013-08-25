$LOAD_PATH << File.expand_path("../", __FILE__)
require 'version'

Gem::Specification.new do |s|
  s.name = 'kwikemon'
  s.version = Kwikemon::VERSION
  s.license = 'MIT'
  s.summary = 'Ruby client for kwikemon.'
  s.description = 'Read & write simple monitors using Redis.'
  s.author = 'Sami Samhuri'
  s.email = 'sami@samhuri.net'
  s.homepage = 'https://github.com/samsonjs/kwikemon'
  s.require_path = '.'
  s.files = ['kwikemon.rb', 'monitor.rb']
  s.add_dependency 'redis', '~> 3.0.4'
  s.required_ruby_version = '>= 1.9.1'
end

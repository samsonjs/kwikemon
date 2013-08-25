# Copyright 2013 Sami Samhuri <sami@samhuri.net>
#
# MIT License
# http://sjs.mit-license.org

lib_dir = File.expand_path('../', __FILE__)
$LOAD_PATH << lib_dir unless $LOAD_PATH.include?(lib_dir)

require 'hashie'
require 'redis'
require 'toml'
require 'kwikemon/monitor'
require 'kwikemon/version'

module Kwikemon

  extend self

  include Enumerable

  def redis
    @redis ||= Redis.new(config.redis)
  end

  def redis=(redis)
    @redis = redis
  end

  def key_prefix
    @key_prefix ||= "kwikemon"
  end

  def key_prefix=(key_prefix)
    @key_prefix = key_prefix
  end

  def key(x)
    "#{key_prefix}:#{x}"
  end

  Monitor.on(:create) do |name|
    redis.sadd(key('monitors'), name)
  end

  Monitor.on(:remove) do |name|
    redis.srem(key('monitors'), name)
  end


  # Set `name` to `value`.
  #
  # @param name [#to_s] name of the monitor
  # @param text [#to_s] status text
  def set(name, text)
    Monitor.new(name, text).save
  end

  # Check if `name` exists3
  #
  # @param name [#to_s] name of the monitor
  # @return [true, false] true if monitor exists, otherwise false
  def exists?(name)
    Monitor.new(name).exists?
  end

  # Get the value of `name`. Returns `nil` if it doesn't exist.
  #
  # @param name [#_tos] name of the monitor
  # @return [String, nil] status text, or `nil` if it doesn't exist
  def get(name)
    Monitor.new(name).text
  end

  # Get the TTL in seconds of `name`. Returns `nil` if it doesn't exit.
  #
  # @param name [#_tos] name of the monitor
  # @return [String, nil] TTL, or `nil` if it doesn't exist
  def ttl(name)
    Monitor.new(name).ttl
  end

  # Count all monitors.
  def count
    redis.scard(key('monitors'))
  end

  # List all monitor names.
  def list
    redis.smembers(key('monitors'))
  end

  def each
    list.each { |m| yield(m) }
  end

  # Get a `Hash` of all monitors.
  def get_all
    list.inject({}) do |ms, name|
      ms[name] = Monitor.new(name).text
      ms
    end
  end

  # Remove the monitor named `name`.
  def remove(name)
    Monitor.new(name).remove
  end

  # Clear all monitors.
  def clear
    list.each do |name|
      remove(name)
    end
  end

  # Clean up expired monitors.
  def sweep
    list.each do |name|
      remove(name) unless exists?(name)
    end
  end


private

  def config
    @config ||= Hashie::Mash.new(load_config)
  end

  def load_config
    path = File.join(ENV['HOME'], '.kwikemon.toml')
    if File.exists?(path)
      TOML.load_file(path)
    else
      {}
    end
  end

end

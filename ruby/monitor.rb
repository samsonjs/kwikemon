# Copyright 2013 Sami Samhuri <sami@samhuri.net>
#
# MIT License
# http://sjs.mit-license.org

module Kwikemon

  class Monitor

    DefaultTTL = 86400 # 1 day

    attr_accessor :redis
    attr_reader :name, :text, :ttl, :created, :modified

    @listeners = Hash.new { |h, k| h[k] = [] }

    def Monitor.on(event, &block)
      @listeners[event] << block
    end

    def Monitor.emit(event, *args)
      @listeners[event].each { |handler| handler.call(*args) }
    end

    def initialize(name, text = nil)
      @name = name
      @text = text
    end

    def save
      if exists?
        update
      else
        create
      end
    end

    def exists?
      redis.exists(key)
    end

    def create
      raise MonitorError.new('name cannot be blank') if name.to_s.strip.length == 0
      redis.hmset(key, *to_a)
      emit(:create, name)
      self
    end

    def update(text, ttl = nil)
      raise MonitorError.new('name cannot be blank') if name.to_s.strip.length == 0
      redis.hmset(key, 'text', text, 'modified', Time.now.to_i)
      redis.ttl(key, ttl) if ttl
      self
    end

    def key
      Kwikemon.key("monitor:#{name}")
    end

    def ttl
      @ttl ||= exists? ? redis.ttl(key) : nil
    end

    def created
      @created ||= exists? ? redis.hget(key, 'created').to_i : nil
    end

    def modified
      @modified ||= exists? ? redis.hget(key, 'modified').to_i : nil
    end

    def text
      @text ||= exists? ? redis.hget(key, 'name')
    end


  private

    def redis
      Kwikemon.redis
    end

    def to_hash
      { name: name,
        text: text,
        ttl: ttl || DefaultTTL,
        created: created || Time.now.to_i,
        modified: modified || Time.now_to_i
      }
    end

    def to_a
      to_hash.to_a
    end

  end

end
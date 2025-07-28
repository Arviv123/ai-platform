const redis = require('redis');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.localCache = new Map(); // Fallback to local cache
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
    
    this.initialize();
  }

  // Initialize Redis connection
  async initialize() {
    try {
      if (!process.env.REDIS_URL) {
        logger.warn('Redis URL not configured, using local cache only');
        return;
      }

      this.client = redis.createClient({
        url: process.env.REDIS_URL,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis server refused connection');
            return new Error('Redis server refused connection');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            logger.error('Redis max retry attempts reached');
            return undefined;
          }
          // Reconnect after
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.isConnected = false;
        this.stats.errors++;
      });

      this.client.on('end', () => {
        logger.warn('Redis client connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
      
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      logger.info('Falling back to local cache');
    }
  }

  // Get value from cache
  async get(key, options = {}) {
    const { useLocal = true } = options;
    
    try {
      let value = null;

      // Try Redis first
      if (this.isConnected && this.client) {
        try {
          value = await this.client.get(key);
          if (value !== null) {
            this.stats.hits++;
            return JSON.parse(value);
          }
        } catch (error) {
          logger.error('Redis get error:', error);
          this.stats.errors++;
        }
      }

      // Fallback to local cache
      if (useLocal && this.localCache.has(key)) {
        const cached = this.localCache.get(key);
        if (cached.expires > Date.now()) {
          this.stats.hits++;
          return cached.value;
        } else {
          this.localCache.delete(key);
        }
      }

      this.stats.misses++;
      return null;

    } catch (error) {
      logger.error('Cache get error:', error);
      this.stats.errors++;
      return null;
    }
  }

  // Set value in cache
  async set(key, value, options = {}) {
    const { 
      ttl = 3600, // 1 hour default
      useLocal = true 
    } = options;

    try {
      const serializedValue = JSON.stringify(value);

      // Set in Redis
      if (this.isConnected && this.client) {
        try {
          if (ttl > 0) {
            await this.client.setEx(key, ttl, serializedValue);
          } else {
            await this.client.set(key, serializedValue);
          }
        } catch (error) {
          logger.error('Redis set error:', error);
          this.stats.errors++;
        }
      }

      // Set in local cache as fallback
      if (useLocal) {
        this.localCache.set(key, {
          value: value,
          expires: Date.now() + (ttl * 1000)
        });

        // Limit local cache size
        if (this.localCache.size > 1000) {
          const firstKey = this.localCache.keys().next().value;
          this.localCache.delete(firstKey);
        }
      }

      this.stats.sets++;
      return true;

    } catch (error) {
      logger.error('Cache set error:', error);
      this.stats.errors++;
      return false;
    }
  }

  // Delete from cache
  async del(key, options = {}) {
    const { useLocal = true } = options;

    try {
      // Delete from Redis
      if (this.isConnected && this.client) {
        try {
          await this.client.del(key);
        } catch (error) {
          logger.error('Redis delete error:', error);
          this.stats.errors++;
        }
      }

      // Delete from local cache
      if (useLocal) {
        this.localCache.delete(key);
      }

      this.stats.deletes++;
      return true;

    } catch (error) {
      logger.error('Cache delete error:', error);
      this.stats.errors++;
      return false;
    }
  }

  // Check if key exists
  async exists(key) {
    try {
      // Check Redis first
      if (this.isConnected && this.client) {
        try {
          const exists = await this.client.exists(key);
          if (exists) return true;
        } catch (error) {
          logger.error('Redis exists error:', error);
        }
      }

      // Check local cache
      if (this.localCache.has(key)) {
        const cached = this.localCache.get(key);
        if (cached.expires > Date.now()) {
          return true;
        } else {
          this.localCache.delete(key);
        }
      }

      return false;

    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  // Increment counter
  async incr(key, amount = 1, ttl = 3600) {
    try {
      if (this.isConnected && this.client) {
        try {
          const result = await this.client.incrBy(key, amount);
          if (ttl > 0) {
            await this.client.expire(key, ttl);
          }
          return result;
        } catch (error) {
          logger.error('Redis incr error:', error);
        }
      }

      // Fallback to local cache
      const current = await this.get(key) || 0;
      const newValue = current + amount;
      await this.set(key, newValue, { ttl });
      return newValue;

    } catch (error) {
      logger.error('Cache increment error:', error);
      return null;
    }
  }

  // Set with expiration
  async setex(key, seconds, value) {
    return await this.set(key, value, { ttl: seconds });
  }

  // Get multiple keys
  async mget(keys) {
    try {
      const results = {};

      if (this.isConnected && this.client) {
        try {
          const values = await this.client.mGet(keys);
          keys.forEach((key, index) => {
            if (values[index] !== null) {
              results[key] = JSON.parse(values[index]);
              this.stats.hits++;
            } else {
              this.stats.misses++;
            }
          });
          return results;
        } catch (error) {
          logger.error('Redis mget error:', error);
        }
      }

      // Fallback to local cache
      for (const key of keys) {
        const value = await this.get(key, { useLocal: true });
        if (value !== null) {
          results[key] = value;
        }
      }

      return results;

    } catch (error) {
      logger.error('Cache mget error:', error);
      return {};
    }
  }

  // Set multiple keys
  async mset(keyValuePairs, ttl = 3600) {
    try {
      const promises = [];

      for (const [key, value] of Object.entries(keyValuePairs)) {
        promises.push(this.set(key, value, { ttl }));
      }

      await Promise.all(promises);
      return true;

    } catch (error) {
      logger.error('Cache mset error:', error);
      return false;
    }
  }

  // Clear all cache
  async clear() {
    try {
      // Clear Redis
      if (this.isConnected && this.client) {
        try {
          await this.client.flushDb();
        } catch (error) {
          logger.error('Redis clear error:', error);
        }
      }

      // Clear local cache
      this.localCache.clear();

      logger.info('Cache cleared');
      return true;

    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }

  // Get cache statistics
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 ? 
      (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 : 0;

    return {
      ...this.stats,
      hitRate: hitRate,
      isRedisConnected: this.isConnected,
      localCacheSize: this.localCache.size,
      timestamp: new Date()
    };
  }

  // Cache decorator for functions
  cached(keyGenerator, ttl = 3600) {
    return (target, propertyName, descriptor) => {
      const method = descriptor.value;

      descriptor.value = async function(...args) {
        const key = typeof keyGenerator === 'function' ? 
          keyGenerator(...args) : `${propertyName}:${JSON.stringify(args)}`;

        // Try to get from cache
        const cached = await this.get(key);
        if (cached !== null) {
          return cached;
        }

        // Execute method and cache result
        const result = await method.apply(this, args);
        await this.set(key, result, { ttl });

        return result;
      };

      return descriptor;
    };
  }

  // Warming up cache with data
  async warmup(data) {
    try {
      logger.info('Starting cache warmup...');
      const promises = [];

      for (const [key, value] of Object.entries(data)) {
        promises.push(this.set(key, value.data, { ttl: value.ttl || 3600 }));
      }

      await Promise.all(promises);
      logger.info(`Cache warmup completed: ${Object.keys(data).length} keys loaded`);

    } catch (error) {
      logger.error('Cache warmup error:', error);
    }
  }

  // Cache key patterns
  static keys = {
    user: (userId) => `user:${userId}`,
    session: (sessionId) => `session:${sessionId}`,
    chatHistory: (userId) => `chat:history:${userId}`,
    aiModel: (model) => `ai:model:${model}`,
    mcpServer: (serverId) => `mcp:server:${serverId}`,
    rateLimit: (ip) => `rate:${ip}`,
    analytics: (date) => `analytics:${date}`,
    subscription: (userId) => `subscription:${userId}`
  };

  // Disconnect
  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        logger.info('Redis client disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting Redis:', error);
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
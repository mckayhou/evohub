/**
 * EvoHub Redis Client - Redis 连接封装
 * 支持连接池、自动重连、健康检查
 */

const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 10;
  }

  /**
   * 初始化 Redis 连接
   */
  async connect() {
    if (this.client && this.isConnected) {
      return this.client;
    }

    try {
      this.client = new Redis(config.database.redis.uri, {
        ...config.database.redis.options,
        retryStrategy: (times) => {
          this.connectionAttempts = times;
          if (times > this.maxRetries) {
            logger.error(`Redis 重试次数超过 ${this.maxRetries}，放弃连接`);
            return null;
          }
          const delay = Math.min(times * 50, 2000);
          logger.warn(`Redis 重连尝试 ${times}/${this.maxRetries}，延迟 ${delay}ms`);
          return delay;
        },
        reconnectOnError: (err) => {
          const targetErrors = ['READONLY', 'ECONNREFUSED', 'ETIMEDOUT'];
          const shouldReconnect = targetErrors.some(e => err.message.includes(e));
          if (shouldReconnect) {
            logger.warn('Redis 遇到可恢复错误，尝试重连:', err.message);
          }
          return shouldReconnect;
        }
      });

      // 绑定事件处理器
      this.client.on('connect', () => {
        this.isConnected = true;
        this.connectionAttempts = 0;
        logger.info('✅ Redis client connected');
      });

      this.client.on('ready', () => {
        logger.info('✅ Redis client ready');
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.warn('Redis reconnecting...');
      });

      this.client.on('end', () => {
        logger.warn('Redis connection ended');
        this.isConnected = false;
      });

      // 等待连接就绪
      await this.client.ping();
      this.isConnected = true;

      return this.client;
    } catch (err) {
      logger.error('❌ Redis connection failed:', err.message);
      throw err;
    }
  }

  /**
   * 获取原生 Redis 客户端
   */
  getClient() {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    return this.client;
  }

  /**
   * 设置键值
   * @param {string} key - 键
   * @param {string|number|object} value - 值
   * @param {string|number} expire - 过期时间（秒）或 'EX' 格式
   */
  async set(key, value, expire = null) {
    try {
      const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      if (expire) {
        if (typeof expire === 'number') {
          await this.client.set(key, serialized, 'EX', expire);
        } else {
          await this.client.set(key, serialized, expire);
        }
      } else {
        await this.client.set(key, serialized);
      }
      
      return true;
    } catch (err) {
      logger.error('Redis set error:', err.message);
      throw err;
    }
  }

  /**
   * 获取键值
   * @param {string} key - 键
   * @param {boolean} parseJson - 是否解析 JSON
   */
  async get(key, parseJson = false) {
    try {
      const value = await this.client.get(key);
      
      if (value === null) return null;
      
      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      
      return value;
    } catch (err) {
      logger.error('Redis get error:', err.message);
      throw err;
    }
  }

  /**
   * 删除键
   * @param {string|string[]} keys - 键或键数组
   */
  async del(keys) {
    try {
      if (Array.isArray(keys)) {
        return await this.client.del(...keys);
      }
      return await this.client.del(keys);
    } catch (err) {
      logger.error('Redis del error:', err.message);
      throw err;
    }
  }

  /**
   * 检查键是否存在
   * @param {string} key - 键
   */
  async exists(key) {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (err) {
      logger.error('Redis exists error:', err.message);
      throw err;
    }
  }

  /**
   * 设置过期时间
   * @param {string} key - 键
   * @param {number} seconds - 秒数
   */
  async expire(key, seconds) {
    try {
      return await this.client.expire(key, seconds);
    } catch (err) {
      logger.error('Redis expire error:', err.message);
      throw err;
    }
  }

  /**
   * 获取过期时间
   * @param {string} key - 键
   */
  async ttl(key) {
    try {
      return await this.client.ttl(key);
    } catch (err) {
      logger.error('Redis ttl error:', err.message);
      throw err;
    }
  }

  /**
   * 递增
   * @param {string} key - 键
   * @param {number} amount - 增量
   */
  async incr(key, amount = 1) {
    try {
      if (amount === 1) {
        return await this.client.incr(key);
      }
      return await this.client.incrby(key, amount);
    } catch (err) {
      logger.error('Redis incr error:', err.message);
      throw err;
    }
  }

  /**
   * 递减
   * @param {string} key - 键
   * @param {number} amount - 减量
   */
  async decr(key, amount = 1) {
    try {
      if (amount === 1) {
        return await this.client.decr(key);
      }
      return await this.client.decrby(key, amount);
    } catch (err) {
      logger.error('Redis decr error:', err.message);
      throw err;
    }
  }

  /**
   * 批量获取
   * @param {string[]} keys - 键数组
   * @param {boolean} parseJson - 是否解析 JSON
   */
  async mget(keys, parseJson = false) {
    try {
      const values = await this.client.mget(keys);
      
      if (!parseJson) return values;
      
      return values.map(v => {
        if (v === null) return null;
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      });
    } catch (err) {
      logger.error('Redis mget error:', err.message);
      throw err;
    }
  }

  /**
   * 批量设置
   * @param {object} data - 键值对对象
   * @param {number} expire - 过期时间（秒）
   */
  async mset(data, expire = null) {
    try {
      const pipeline = this.client.pipeline();
      
      Object.entries(data).forEach(([key, value]) => {
        const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
        pipeline.set(key, serialized);
        if (expire) {
          pipeline.expire(key, expire);
        }
      });
      
      await pipeline.exec();
      return true;
    } catch (err) {
      logger.error('Redis mset error:', err.message);
      throw err;
    }
  }

  /**
   * 模糊查询键
   * @param {string} pattern - 匹配模式
   */
  async keys(pattern) {
    try {
      return await this.client.keys(pattern);
    } catch (err) {
      logger.error('Redis keys error:', err.message);
      throw err;
    }
  }

  /**
   * 清空当前数据库
   * ⚠️ 危险操作，仅用于测试
   */
  async flushdb() {
    if (config.server.env === 'production') {
      throw new Error('flushdb is not allowed in production');
    }
    
    try {
      await this.client.flushdb();
      logger.warn('Redis database flushed');
      return true;
    } catch (err) {
      logger.error('Redis flushdb error:', err.message);
      throw err;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      if (!this.client) {
        return { status: 'disconnected', latency: null };
      }
      
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'connected',
        latency,
        connected: this.isConnected
      };
    } catch (err) {
      return {
        status: 'error',
        error: err.message,
        connected: false
      };
    }
  }

  /**
   * 关闭连接
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      this.client = null;
      logger.info('Redis client disconnected');
    }
  }
}

// 单例模式
const redisClient = new RedisClient();

module.exports = redisClient;

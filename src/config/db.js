/**
 * EvoHub Database Connection
 * MongoDB & Redis 连接管理
 */

const mongoose = require('mongoose');
const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

// MongoDB 连接
class DatabaseConnection {
  constructor() {
    this.mongoConnection = null;
    this.redisClient = null;
  }

  async connectMongo() {
    if (this.mongoConnection) {
      return this.mongoConnection;
    }

    try {
      mongoose.set('strictQuery', false);
      
      this.mongoConnection = await mongoose.connect(
        config.database.mongodb.uri,
        config.database.mongodb.options
      );

      logger.info('✅ MongoDB connected successfully');

      // 监听连接事件
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

      return this.mongoConnection;
    } catch (err) {
      logger.error('❌ MongoDB connection failed:', err.message);
      throw err;
    }
  }

  async connectRedis() {
    if (this.redisClient) {
      return this.redisClient;
    }

    try {
      this.redisClient = new Redis(config.database.redis.uri, {
        ...config.database.redis.options,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          logger.warn(`Redis 重连尝试 ${times}，延迟 ${delay}ms`);
          return delay;
        }
      });

      this.redisClient.on('connect', () => {
        logger.info('✅ Redis connected successfully');
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis connection error:', err.message);
      });

      this.redisClient.on('reconnecting', () => {
        logger.warn('Redis reconnecting...');
      });

      return this.redisClient;
    } catch (err) {
      logger.error('❌ Redis connection failed:', err.message);
      throw err;
    }
  }

  async disconnect() {
    try {
      if (this.mongoConnection) {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected');
      }

      if (this.redisClient) {
        await this.redisClient.quit();
        logger.info('Redis disconnected');
      }
    } catch (err) {
      logger.error('Error during disconnect:', err);
    }
  }

  getMongoStatus() {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    return states[mongoose.connection.readyState] || 'unknown';
  }

  async getRedisStatus() {
    if (!this.redisClient) return 'disconnected';
    try {
      await this.redisClient.ping();
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }

  async healthCheck() {
    const mongoStatus = this.getMongoStatus();
    const redisStatus = await this.getRedisStatus();
    
    return {
      mongodb: mongoStatus,
      redis: redisStatus,
      healthy: mongoStatus === 'connected' && redisStatus === 'connected'
    };
  }
}

// 单例模式
const dbConnection = new DatabaseConnection();

module.exports = dbConnection;

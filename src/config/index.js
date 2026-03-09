/**
 * EvoHub Configuration - 集中配置管理
 * v2.5 架构 - 百炼 Coding Plan 配置
 */

const path = require('path');

// 加载 .env 文件
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// 配置验证
const requiredEnvVars = ['JWT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0 && process.env.NODE_ENV === 'production') {
  console.warn(`⚠️  缺少必要的环境变量: ${missingVars.join(', ')}`);
}

const config = {
  // 服务器配置
  server: {
    port: parseInt(process.env.PORT) || 3000,
    env: process.env.NODE_ENV || 'development',
    version: '2.5.0'
  },

  // 数据库配置
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/evohub',
      options: {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
      }
    },
    redis: {
      uri: process.env.REDIS_URI || 'redis://localhost:6379',
      options: {
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3
      }
    }
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'evohub-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'evohub'
  },

  // 百炼 Coding Plan 配置
  bailian: {
    baseUrl: process.env.BAILIAN_BASE_URL || 'https://coding.dashscope.aliyuncs.com/v1',
    apiKey: process.env.BAILIAN_CODING_API_KEY,
    primaryModel: process.env.PRIMARY_MODEL || 'qwen3-coder-plus',
    fallbackModel: process.env.FALLBACK_MODEL || 'qwen3.5-plus',
    maxTokens: {
      coding: 950,
      plus: 1200
    },
    costPerM: {
      'qwen3-coder-plus': 0.8,
      'qwen3.5-plus': 1.2
    }
  },

  // GDI 评分配置
  gdi: {
    selfConsistencyN: parseInt(process.env.SELF_CONSISTENCY_N) || 3,
    promoteThreshold: 0.70,
    candidateThreshold: 0.50,
    weights: {
      quality: 0.35,
      usage: 0.30,
      social: 0.20,
      freshness: 0.15
    }
  },

  // 经济系统配置
  economy: {
    initialCredits: parseInt(process.env.INITIAL_CREDITS) || 500,
    publishReward: parseInt(process.env.PUBLISH_CREDIT_REWARD) || 100,
    validationReward: parseInt(process.env.VALIDATION_CREDIT_REWARD) || 20,
    usageReward: 5
  },

  // 熔断器配置
  circuitBreaker: {
    threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,
    resetMs: parseInt(process.env.CIRCUIT_BREAKER_RESET_MS) || 30000
  },

  // 限流配置
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100
  },

  // 心跳配置
  heartbeat: {
    intervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS) || 15 * 60 * 1000, // 15 minutes
    timeoutMs: parseInt(process.env.HEARTBEAT_TIMEOUT_MS) || 45 * 60 * 1000    // 45 minutes
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxFiles: '14d',
    maxSize: '20m'
  },

  // 安全白名单
  security: {
    allowedCommands: ['node', 'npm', 'npx', 'git', 'curl', 'wget'],
    maxExecutionTime: 180000, // 180 seconds
    maxPayloadSize: '10mb'
  }
};

// 冻结配置防止运行时修改
module.exports = Object.freeze(config);

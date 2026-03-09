/**
 * EvoHub Logger - Winston 日志封装
 * 支持结构化日志、日志轮转、指标记录
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('../config');

const { combine, timestamp, json, printf, colorize, errors } = winston.format;

// 自定义格式：开发环境使用彩色输出
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// 创建日志目录
const logDir = path.join(__dirname, '../../logs');

// 基础配置
const baseConfig = {
  level: config.logging.level,
  defaultMeta: {
    service: 'evohub',
    version: config.server.version,
    env: config.server.env
  }
};

// 控制台传输
const consoleTransport = new winston.transports.Console({
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    config.server.env === 'development' ? devFormat : json()
  )
});

// 应用日志文件传输（按天轮转）
const appFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  format: combine(
    timestamp(),
    json()
  )
});

// 错误日志文件传输
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  level: 'error',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  )
});

// 指标日志文件传输
const metricFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'metrics-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  format: combine(
    timestamp(),
    json()
  )
});

// 创建主 Logger
const logger = winston.createLogger({
  ...baseConfig,
  transports: [
    consoleTransport,
    appFileTransport,
    errorFileTransport
  ],
  exitOnError: false
});

// 创建指标 Logger（单独实例，避免污染主日志）
const metricLogger = winston.createLogger({
  level: 'info',
  defaultMeta: { type: 'metric' },
  transports: [metricFileTransport],
  format: combine(timestamp(), json())
});

// 扩展 logger 方法

/**
 * 记录指标数据
 * @param {string} metricName - 指标名称
 * @param {object} data - 指标数据
 * @param {string} data.type - 指标类型 (counter, gauge, histogram, timer)
 * @param {number} data.value - 指标值
 * @param {object} data.tags - 标签
 */
logger.metric = (metricName, data = {}) => {
  const metricData = {
    metric: metricName,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  metricLogger.info('metric', metricData);
  
  // 开发环境也输出到控制台
  if (config.server.env === 'development') {
    logger.debug(`[METRIC] ${metricName}: ${JSON.stringify(data)}`);
  }
};

/**
 * 记录 API 调用指标
 * @param {object} req - Express 请求对象
 * @param {object} res - Express 响应对象
 * @param {number} duration - 响应时间(ms)
 */
logger.apiMetric = (req, res, duration) => {
  logger.metric('api_request', {
    type: 'timer',
    method: req.method,
    path: req.route?.path || req.path,
    status_code: res.statusCode,
    duration_ms: duration,
    node_id: req.nodeId || 'anonymous',
    user_agent: req.get('user-agent'),
    ip: req.ip
  });
};

/**
 * 记录 LLM 调用指标
 * @param {object} data - LLM 调用数据
 */
logger.llmMetric = (data) => {
  logger.metric('llm_call', {
    type: 'histogram',
    model: data.model,
    latency_ms: data.latency,
    tokens_in: data.tokensIn,
    tokens_out: data.tokensOut,
    cost_usd: data.cost,
    success: data.success,
    error_type: data.errorType
  });
};

/**
 * 记录 GDI 评分指标
 * @param {object} data - GDI 评分数据
 */
logger.gdiMetric = (data) => {
  logger.metric('gdi_score', {
    type: 'gauge',
    asset_id: data.assetId,
    gdi_score: data.score,
    quality_score: data.qualityScore,
    consistency_score: data.consistencyScore,
    confidence_level: data.confidenceLevel,
    model: data.model,
    latency_ms: data.latency
  });
};

/**
 * 记录节点活动指标
 * @param {object} data - 节点活动数据
 */
logger.nodeMetric = (data) => {
  logger.metric('node_activity', {
    type: 'counter',
    action: data.action, // register, heartbeat, publish, fetch, etc.
    node_id: data.nodeId,
    credits_delta: data.creditsDelta || 0,
    reputation_delta: data.reputationDelta || 0
  });
};

/**
 * 创建请求上下文 Logger
 * @param {object} context - 请求上下文
 * @returns {object} 带上下文的 logger
 */
logger.child = (context) => {
  return logger.child(context);
};

// 未捕获异常处理
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = logger;

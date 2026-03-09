/**
 * EvoHub Error Handler Middleware
 * 统一错误处理 + 结构化错误响应
 */

const config = require('../config');
const logger = require('../utils/logger');

/**
 * 自定义应用错误类
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // 标记为可预期的操作错误
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 常见错误类型
 */
const ErrorTypes = {
  // 认证错误
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED' },
  FORBIDDEN: { status: 403, code: 'FORBIDDEN' },
  
  // 资源错误
  NOT_FOUND: { status: 404, code: 'NOT_FOUND' },
  CONFLICT: { status: 409, code: 'CONFLICT' },
  
  // 验证错误
  VALIDATION_ERROR: { status: 400, code: 'VALIDATION_ERROR' },
  BAD_REQUEST: { status: 400, code: 'BAD_REQUEST' },
  
  // 业务错误
  INSUFFICIENT_CREDITS: { status: 402, code: 'INSUFFICIENT_CREDITS' },
  RATE_LIMITED: { status: 429, code: 'RATE_LIMITED' },
  
  // 服务错误
  SERVICE_UNAVAILABLE: { status: 503, code: 'SERVICE_UNAVAILABLE' },
  GATEWAY_TIMEOUT: { status: 504, code: 'GATEWAY_TIMEOUT' },
  
  // 内部错误
  INTERNAL_ERROR: { status: 500, code: 'INTERNAL_ERROR' }
};

/**
 * 创建特定类型的错误
 */
const createError = (type, message, details = null) => {
  const errorDef = ErrorTypes[type] || ErrorTypes.INTERNAL_ERROR;
  return new AppError(message, errorDef.status, errorDef.code, details);
};

/**
 * 异步错误包装器
 * 自动捕获 async 路由中的错误
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  // 默认错误值
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal server error';
  let details = err.details || null;
  
  // Mongoose 验证错误
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
      value: e.value
    }));
  }
  
  // Mongoose 重复键错误
  if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY';
    message = 'Resource already exists';
    const field = Object.keys(err.keyValue)[0];
    details = {
      field,
      value: err.keyValue[field]
    };
  }
  
  // Mongoose CastError（无效 ObjectId）
  if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = `Invalid ${err.path}: ${err.value}`;
    details = {
      path: err.path,
      value: err.value,
      kind: err.kind
    };
  }
  
  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  }
  
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
    details = { expiredAt: err.expiredAt };
  }
  
  // MongoDB 连接错误
  if (err.name === 'MongoNetworkError') {
    statusCode = 503;
    errorCode = 'DATABASE_UNAVAILABLE';
    message = 'Database connection failed';
  }
  
  // Redis 连接错误
  if (err.name === 'RedisError' || err.message?.includes('Redis')) {
    statusCode = 503;
    errorCode = 'CACHE_UNAVAILABLE';
    message = 'Cache service unavailable';
  }
  
  // 请求体解析错误
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    errorCode = 'PARSE_ERROR';
    message = 'Invalid JSON in request body';
  }
  
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    errorCode = 'PAYLOAD_TOO_LARGE';
    message = 'Request payload too large';
    details = { limit: err.limit };
  }
  
  // Axios 错误（外部 API 调用失败）
  if (err.isAxiosError) {
    statusCode = 502;
    errorCode = 'EXTERNAL_API_ERROR';
    message = 'External service call failed';
    details = {
      service: err.config?.url,
      method: err.config?.method,
      status: err.response?.status
    };
  }
  
  // Zod 验证错误
  if (err.name === 'ZodError') {
    statusCode = 400;
    errorCode = 'SCHEMA_VALIDATION_ERROR';
    message = 'Data validation failed';
    details = err.errors?.map(e => ({
      path: e.path.join('.'),
      message: e.message,
      code: e.code
    }));
  }
  
  // 记录错误日志
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel]({
    message: `Error ${statusCode}: ${message}`,
    code: errorCode,
    path: req.path,
    method: req.method,
    nodeId: req.nodeId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    stack: config.server.env === 'development' ? err.stack : undefined,
    details
  });
  
  // 构建错误响应
  const errorResponse = {
    success: false,
    error: message,
    code: errorCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: req.id // 如果有请求 ID
  };
  
  // 开发环境添加详细信息
  if (config.server.env === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = details;
  }
  
  // 某些错误类型始终包含 details
  if (['VALIDATION_ERROR', 'SCHEMA_VALIDATION_ERROR', 'DUPLICATE_KEY'].includes(errorCode)) {
    errorResponse.details = details;
  }
  
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 处理中间件
 */
const notFoundHandler = (req, res, next) => {
  const err = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(err);
};

/**
 * 未捕获异常处理
 */
const setupUncaughtHandlers = () => {
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION:', err);
    
    // 给日志写入时间后退出
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
  });
  
  // 优雅关闭
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    process.exit(0);
  });
};

/**
 * 请求 ID 中间件
 * 为每个请求生成唯一 ID
 */
const requestId = (req, res, next) => {
  req.id = `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-Id', req.id);
  next();
};

/**
 * 请求日志中间件
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      nodeId: req.nodeId || 'anonymous',
      ip: req.ip,
      userAgent: req.get('user-agent')
    };
    
    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else {
      logger.debug('Request completed', logData);
    }
    
    // 记录 API 指标
    logger.apiMetric(req, res, duration);
  });
  
  next();
};

module.exports = {
  AppError,
  ErrorTypes,
  createError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
  setupUncaughtHandlers,
  requestId,
  requestLogger
};

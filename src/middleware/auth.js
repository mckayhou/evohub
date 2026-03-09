/**
 * EvoHub Authentication Middleware
 * JWT 验证 + 节点状态检查
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * JWT Token 验证中间件
 * 验证请求中的 Authorization 头
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // 检查 Authorization 头
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header required',
        code: 'MISSING_AUTH_HEADER'
      });
    }
    
    // 检查 Bearer 格式
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authorization format. Use: Bearer <token>',
        code: 'INVALID_AUTH_FORMAT'
      });
    }
    
    const token = authHeader.substring(7);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token is empty',
        code: 'EMPTY_TOKEN'
      });
    }
    
    // 验证 Token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer
      });
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token has expired',
          code: 'TOKEN_EXPIRED',
          expiredAt: jwtError.expiredAt
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }
      
      throw jwtError;
    }
    
    // 检查必要字段
    if (!decoded.nodeId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token payload',
        code: 'INVALID_TOKEN_PAYLOAD'
      });
    }
    
    // 将节点信息附加到请求对象
    req.nodeId = decoded.nodeId;
    req.tokenData = decoded;
    
    // 记录认证成功日志
    logger.debug(`Auth success: node ${decoded.nodeId}`);
    
    next();
  } catch (err) {
    logger.error('Auth middleware error:', err);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * 可选认证中间件
 * 验证 token 如果存在，但不强制要求
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.nodeId = null;
    req.tokenData = null;
    return next();
  }
  
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer
    });
    
    req.nodeId = decoded.nodeId;
    req.tokenData = decoded;
  } catch (err) {
    // 可选认证失败不阻止请求
    req.nodeId = null;
    req.tokenData = null;
  }
  
  next();
};

/**
 * API Key 验证中间件
 * 用于服务间通信
 */
const verifyApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        code: 'MISSING_API_KEY'
      });
    }
    
    // TODO: 实现 API Key 验证逻辑
    // 这里可以查询数据库验证 API Key 的有效性
    
    // 临时方案：检查 API Key 格式
    if (!apiKey.startsWith('evohub_')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key format',
        code: 'INVALID_API_KEY'
      });
    }
    
    req.apiKey = apiKey;
    next();
  } catch (err) {
    logger.error('API key verification error:', err);
    return res.status(500).json({
      success: false,
      error: 'API key verification error',
      code: 'API_KEY_ERROR'
    });
  }
};

/**
 * 节点状态检查中间件
 * 检查节点是否在线、是否有足够积分等
 */
const checkNodeStatus = (options = {}) => {
  const { requireActive = true, requireCredits = false, minCredits = 0 } = options;
  
  return async (req, res, next) => {
    try {
      // 从 app.locals 获取节点存储（由 NodeService 管理）
      const nodes = req.app.locals.nodes;
      
      if (!nodes) {
        logger.warn('Node storage not initialized');
        return next();
      }
      
      const nodeId = req.nodeId;
      if (!nodeId) {
        return res.status(401).json({
          success: false,
          error: 'Node authentication required',
          code: 'NODE_AUTH_REQUIRED'
        });
      }
      
      const node = nodes.get(nodeId);
      
      if (!node) {
        return res.status(404).json({
          success: false,
          error: 'Node not found',
          code: 'NODE_NOT_FOUND'
        });
      }
      
      // 检查节点是否活跃
      if (requireActive) {
        const heartbeats = req.app.locals.heartbeats;
        const lastHeartbeat = heartbeats?.get(nodeId);
        const timeout = config.heartbeat.timeoutMs;
        
        if (!lastHeartbeat || Date.now() - lastHeartbeat > timeout) {
          return res.status(403).json({
            success: false,
            error: 'Node is inactive. Please send heartbeat first.',
            code: 'NODE_INACTIVE'
          });
        }
      }
      
      // 检查积分
      if (requireCredits && node.credits < minCredits) {
        return res.status(403).json({
          success: false,
          error: `Insufficient credits. Required: ${minCredits}, Available: ${node.credits}`,
          code: 'INSUFFICIENT_CREDITS',
          current_credits: node.credits,
          required_credits: minCredits
        });
      }
      
      // 将节点信息附加到请求
      req.node = node;
      
      next();
    } catch (err) {
      logger.error('Node status check error:', err);
      return res.status(500).json({
        success: false,
        error: 'Node status check failed',
        code: 'NODE_STATUS_ERROR'
      });
    }
  };
};

/**
 * 角色权限检查中间件
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const nodeRole = req.node?.role || 'user';
    
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(nodeRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required_roles: roles,
        current_role: nodeRole
      });
    }
    
    next();
  };
};

/**
 * 速率限制绕过检查（内部服务）
 */
const internalService = async (req, res, next) => {
  const internalToken = req.headers['x-internal-token'];
  
  // 检查内部令牌（应该与配置中的安全令牌匹配）
  if (internalToken === process.env.INTERNAL_SERVICE_TOKEN) {
    req.isInternal = true;
    req.skipRateLimit = true;
  }
  
  next();
};

/**
 * 生成 JWT Token
 * @param {object} payload - Token 载荷
 * @returns {string} JWT Token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer
  });
};

/**
 * 验证 JWT Token（不抛出异常）
 * @param {string} token - JWT Token
 * @returns {object|null} 解码后的数据或 null
 */
const verifyTokenSilent = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer
    });
  } catch {
    return null;
  }
};

module.exports = {
  verifyToken,
  optionalAuth,
  verifyApiKey,
  checkNodeStatus,
  requireRole,
  internalService,
  generateToken,
  verifyTokenSilent
};

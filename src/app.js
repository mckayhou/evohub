/**
 * EvoHub v2.5 - Application Entry Point
 * Layered Architecture + Clean Architecture Light
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const a2aRoutes = require('./routes/a2aRoutes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const config = require('./config');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  message: {
    error: 'Too many requests, please try again later.',
    retry_after: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check (before routes)
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    version: '2.5.0',
    protocol: 'GEP-A2A-v1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {}
  };

  // Check MongoDB
  try {
    const mongoose = require('mongoose');
    health.services.mongodb = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch (e) {
    health.services.mongodb = 'error';
  }

  // Check Redis (if configured)
  try {
    const redis = require('./utils/redisClient');
    await redis.ping();
    health.services.redis = 'connected';
  } catch (e) {
    health.services.redis = 'disconnected';
  }

  const isHealthy = health.services.mongodb === 'connected';
  res.status(isHealthy ? 200 : 503).json(health);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'EvoHub',
    version: '2.5.0',
    description: 'OpenClaw 私有 EvoMap Mini-Hub',
    protocol: 'GEP-A2A-v1.0.0',
    status: 'running',
    documentation: '/docs',
    health: '/health'
  });
});

// API routes
app.use('/a2a', a2aRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    available_endpoints: [
      'GET /health',
      'GET /',
      'POST /a2a/hello',
      'POST /a2a/heartbeat',
      'POST /a2a/publish',
      'POST /a2a/fetch',
      'POST /a2a/validate',
      'POST /a2a/report',
      'POST /a2a/decision',
      'POST /a2a/revoke',
      'GET /a2a/directory'
    ]
  });
});

// Error handling (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    const PORT = config.port || 3000;
    app.listen(PORT, () => {
      logger.info(`✅ EvoHub v2.5.0 已启动`);
      logger.info(`🚀 http://localhost:${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    logger.error('❌ 启动失败', err);
    process.exit(1);
  }
};

// Auto-start if not in test mode
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, startServer };

/**
 * EvoHub - 私有 EvoMap Mini-Hub
 * GEP-A2A Protocol v1.0.0 完整实现
 */

const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Asset = require('./models/Asset');
const gdiScorer = require('./utils/gdiScorer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'evohub-secret-key';
const INITIAL_CREDITS = parseInt(process.env.INITIAL_CREDITS) || 500;

// Middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' }
});
app.use('/a2a/', limiter);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/evohub')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// In-memory store for nodes (production: use Redis)
const nodes = new Map();
const heartbeats = new Map();

// Helper: Generate unique ID
const generateId = (prefix) => `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

// Helper: Compute SHA256
const computeSHA256 = (data) => {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

// Helper: Verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.nodeId = decoded.nodeId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * POST /a2a/hello
 * 注册新节点，返回 node_id + node_secret + 初始 Credit
 */
app.post('/a2a/hello', async (req, res) => {
  try {
    const { protocol, protocol_version, payload } = req.body;
    
    // Validate protocol
    if (protocol !== 'gep-a2a' || protocol_version !== '1.0.0') {
      return res.status(400).json({
        error: 'Unsupported protocol version',
        supported: 'gep-a2a/1.0.0'
      });
    }
    
    const nodeId = generateId('node');
    const nodeSecret = generateId('secret');
    
    // Create node record
    const node = {
      nodeId,
      nodeSecret,
      credits: INITIAL_CREDITS,
      reputation: 0,
      capabilities: payload?.capabilities || {},
      envFingerprint: payload?.env_fingerprint || {},
      referrer: payload?.referrer || null,
      createdAt: new Date(),
      lastHeartbeat: new Date()
    };
    
    nodes.set(nodeId, node);
    heartbeats.set(nodeId, Date.now());
    
    // Generate JWT token
    const token = jwt.sign({ nodeId }, JWT_SECRET, { expiresIn: '7d' });
    
    console.log(`🎉 New node registered: ${nodeId}`);
    
    res.json({
      success: true,
      node_id: nodeId,
      node_secret: nodeSecret,
      token,
      credits: INITIAL_CREDITS,
      heartbeat_interval_ms: 900000, // 15 minutes
      message: 'Welcome to EvoHub! 🦞'
    });
  } catch (err) {
    console.error('Hello error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /a2a/heartbeat
 * 心跳检测，保持节点在线状态
 */
app.post('/a2a/heartbeat', verifyToken, async (req, res) => {
  try {
    const nodeId = req.nodeId;
    const node = nodes.get(nodeId);
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    // Update heartbeat
    heartbeats.set(nodeId, Date.now());
    node.lastHeartbeat = new Date();
    
    res.json({
      success: true,
      status: 'active',
      credits: node.credits,
      reputation: node.reputation,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Heartbeat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /a2a/publish
 * 发布 Gene+Capsule，自动触发 GDI 评审
 */
app.post('/a2a/publish', verifyToken, async (req, res) => {
  try {
    const nodeId = req.nodeId;
    const node = nodes.get(nodeId);
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    const { gene, capsule, metadata } = req.body;
    
    // Validate required fields
    if (!gene || !capsule) {
      return res.status(400).json({ error: 'gene and capsule are required' });
    }
    
    // Compute content hash
    const contentHash = computeSHA256({ gene, capsule });
    
    // Check for duplicates
    const existingAsset = await Asset.findOne({ contentHash });
    if (existingAsset) {
      return res.status(409).json({
        error: 'Asset already exists',
        assetId: existingAsset.assetId,
        gdi: existingAsset.gdi
      });
    }
    
    // Auto GDI scoring
    const gdiResult = await gdiScorer.score(gene, capsule, metadata);
    
    // Create asset
    const asset = new Asset({
      assetId: generateId('asset'),
      nodeId,
      gene,
      capsule,
      contentHash,
      metadata: metadata || {},
      gdi: gdiResult.score,
      gdiBreakdown: gdiResult.breakdown,
      status: gdiResult.score >= 60 ? 'promoted' : 'pending',
      createdAt: new Date()
    });
    
    await asset.save();
    
    // Reward credits for publishing
    const reward = parseInt(process.env.PUBLISH_CREDIT_REWARD) || 100;
    node.credits += reward;
    
    console.log(`📦 Asset published: ${asset.assetId} (GDI: ${gdiResult.score})`);
    
    res.json({
      success: true,
      asset_id: asset.assetId,
      gdi: gdiResult.score,
      gdi_breakdown: gdiResult.breakdown,
      status: asset.status,
      credits_earned: reward,
      current_credits: node.credits
    });
  } catch (err) {
    console.error('Publish error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /a2a/fetch
 * 获取高 GDI Capsule（支持过滤）
 */
app.post('/a2a/fetch', verifyToken, async (req, res) => {
  try {
    const { signals, category, min_gdi, limit = 10 } = req.body;
    
    // Build query
    const query = { status: 'promoted' };
    
    if (min_gdi) {
      query.gdi = { $gte: parseInt(min_gdi) };
    }
    
    if (category) {
      query['metadata.category'] = category;
    }
    
    if (signals && signals.length > 0) {
      query['gene.signals'] = { $in: signals };
    }
    
    // Fetch assets
    const assets = await Asset.find(query)
      .sort({ gdi: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .select('-_id -__v');
    
    res.json({
      success: true,
      count: assets.length,
      assets: assets.map(a => ({
        asset_id: a.assetId,
        gene: a.gene,
        capsule: a.capsule,
        gdi: a.gdi,
        metadata: a.metadata,
        created_at: a.createdAt
      }))
    });
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /a2a/validate
 * 干跑沙箱验证（不存储）
 */
app.post('/a2a/validate', verifyToken, async (req, res) => {
  try {
    const { gene, capsule, metadata } = req.body;
    
    if (!gene || !capsule) {
      return res.status(400).json({ error: 'gene and capsule are required' });
    }
    
    // Compute GDI without storing
    const gdiResult = await gdiScorer.score(gene, capsule, metadata);
    
    res.json({
      success: true,
      valid: gdiResult.score >= 60,
      gdi: gdiResult.score,
      gdi_breakdown: gdiResult.breakdown,
      suggestions: gdiResult.suggestions || []
    });
  } catch (err) {
    console.error('Validate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /a2a/report
 * 报告资产使用情况
 */
app.post('/a2a/report', verifyToken, async (req, res) => {
  try {
    const { asset_id, action, context } = req.body;
    const nodeId = req.nodeId;
    
    const asset = await Asset.findOne({ assetId: asset_id });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Log usage
    asset.usageCount = (asset.usageCount || 0) + 1;
    asset.lastUsedAt = new Date();
    await asset.save();
    
    // Reward original publisher
    const publisher = nodes.get(asset.nodeId);
    if (publisher) {
      publisher.credits += 5; // Small reward for usage
    }
    
    res.json({
      success: true,
      message: 'Report logged'
    });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /a2a/decision
 * 提交决策结果（用于 Swarm）
 */
app.post('/a2a/decision', verifyToken, async (req, res) => {
  try {
    const { task_id, decision, reasoning } = req.body;
    const nodeId = req.nodeId;
    
    // TODO: Implement Swarm decision logic
    res.json({
      success: true,
      decision_id: generateId('decision'),
      status: 'recorded'
    });
  } catch (err) {
    console.error('Decision error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /a2a/revoke
 * 撤销资产
 */
app.post('/a2a/revoke', verifyToken, async (req, res) => {
  try {
    const { asset_id, reason } = req.body;
    const nodeId = req.nodeId;
    
    const asset = await Asset.findOne({ assetId: asset_id, nodeId });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found or not owned by you' });
    }
    
    asset.status = 'revoked';
    asset.revokedAt = new Date();
    asset.revokeReason = reason;
    await asset.save();
    
    res.json({
      success: true,
      message: 'Asset revoked'
    });
  } catch (err) {
    console.error('Revoke error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /a2a/directory
 * 获取活跃节点列表
 */
app.get('/a2a/directory', async (req, res) => {
  try {
    const now = Date.now();
    const activeNodes = [];
    
    for (const [nodeId, lastHeartbeat] of heartbeats) {
      // Consider active if heartbeat within last 45 minutes
      if (now - lastHeartbeat < 45 * 60 * 1000) {
        const node = nodes.get(nodeId);
        if (node) {
          activeNodes.push({
            node_id: nodeId,
            reputation: node.reputation,
            capabilities: node.capabilities,
            last_heartbeat: new Date(lastHeartbeat).toISOString()
          });
        }
      }
    }
    
    res.json({
      success: true,
      count: activeNodes.length,
      nodes: activeNodes
    });
  } catch (err) {
    console.error('Directory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /health
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    nodes_online: heartbeats.size
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EvoHub Mini-Hub running on port ${PORT}`);
  console.log(`📡 GEP-A2A Protocol v1.0.0 ready`);
});

module.exports = app;

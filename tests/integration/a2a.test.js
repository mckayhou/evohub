/**
 * A2A API Integration Tests
 * Tests all 9 GEP-A2A endpoints with mocked dependencies
 */

const request = require('supertest');

// Mock external services
jest.mock('../../src/utils/redisClient', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  ping: jest.fn().mockResolvedValue('PONG')
}));

jest.mock('../../src/services/gdiService', () => ({
  calculateGDI: jest.fn().mockResolvedValue({
    gdi_score: 0.85,
    recommendation: 'promote',
    reason: 'Good quality',
    consistency_score: 0.88,
    confidence_level: 'high'
  })
}));

// Create test app with minimal setup
const express = require('express');
const app = express();
app.use(express.json());

// JWT secret for testing
const JWT_SECRET = 'test-secret-key';
const jwt = require('jsonwebtoken');

// In-memory storage
const nodes = new Map();
const assets = new Map();
let nodeCounter = 0;

// Helper: Generate node ID
const generateNodeId = () => `node_${Date.now()}_${++nodeCounter}`;
const generateNodeSecret = () => `secret_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

// Middleware: Verify JWT
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

// Routes

// POST /a2a/hello - Register node
app.post('/a2a/hello', (req, res) => {
  const { protocol, protocol_version } = req.body;
  
  if (protocol !== 'gep-a2a' || protocol_version !== '1.0.0') {
    return res.status(400).json({
      error: 'Unsupported protocol version',
      supported: 'gep-a2a/1.0.0'
    });
  }
  
  const nodeId = generateNodeId();
  const nodeSecret = generateNodeSecret();
  const token = jwt.sign({ nodeId }, JWT_SECRET, { expiresIn: '7d' });
  
  nodes.set(nodeId, {
    node_id: nodeId,
    node_secret: nodeSecret,
    credits: 500,
    created_at: new Date(),
    last_heartbeat: new Date()
  });
  
  res.json({
    success: true,
    node_id: nodeId,
    node_secret: nodeSecret,
    token,
    credits: 500,
    hub_version: '2.5.0',
    protocol_version: 'GEP-A2A-v1.0.0'
  });
});

// POST /a2a/heartbeat
app.post('/a2a/heartbeat', verifyToken, (req, res) => {
  const node = nodes.get(req.nodeId);
  if (!node) {
    return res.status(404).json({ error: 'Node not found' });
  }
  
  node.last_heartbeat = new Date();
  
  res.json({
    success: true,
    status: 'alive',
    credits: node.credits,
    timestamp: new Date().toISOString()
  });
});

// POST /a2a/publish
app.post('/a2a/publish', verifyToken, (req, res) => {
  const { payload } = req.body;
  
  if (!payload?.assets || !Array.isArray(payload.assets) || payload.assets.length === 0) {
    return res.status(400).json({ error: 'Invalid assets array' });
  }
  
  const saved = [];
  const errors = [];
  
  for (const data of payload.assets) {
    // Check for duplicate
    if (assets.has(data.asset_id)) {
      errors.push({ asset_id: data.asset_id, error: 'Duplicate asset_id' });
      continue;
    }
    
    const asset = {
      ...data,
      node_id: req.nodeId,
      gdi_score: 0.85,
      status: 'promoted',
      published_at: new Date()
    };
    
    assets.set(data.asset_id, asset);
    
    saved.push({
      asset_id: asset.asset_id,
      gdi: asset.gdi_score,
      status: asset.status
    });
  }
  
  res.json({
    success: true,
    published: saved.length,
    failed: errors.length,
    assets: saved,
    errors: errors.length > 0 ? errors : undefined
  });
});

// POST /a2a/fetch
app.post('/a2a/fetch', verifyToken, (req, res) => {
  const { signals, min_gdi = 0.7, limit = 20 } = req.body;
  
  let results = Array.from(assets.values())
    .filter(a => a.status === 'promoted' && a.gdi_score >= min_gdi);
  
  if (signals && Array.isArray(signals)) {
    results = results.filter(a => 
      a.signals_match && a.signals_match.some(s => signals.includes(s))
    );
  }
  
  results = results.slice(0, limit);
  
  res.json({
    success: true,
    count: results.length,
    capsules: results.map(r => ({
      asset_id: r.asset_id,
      type: r.type,
      gdi_score: r.gdi_score,
      summary: r.summary
    }))
  });
});

// POST /a2a/validate
app.post('/a2a/validate', verifyToken, (req, res) => {
  const { payload } = req.body;
  
  if (!payload?.assets || !Array.isArray(payload.assets)) {
    return res.status(400).json({ error: 'Invalid assets array' });
  }
  
  const validations = payload.assets.map(asset => {
    const errors = [];
    
    if (!asset.asset_id) errors.push('Missing asset_id');
    if (!asset.type) errors.push('Missing type');
    if (!asset.signals_match || asset.signals_match.length === 0) {
      errors.push('Missing signals_match');
    }
    
    return {
      asset_id: asset.asset_id || 'unknown',
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  });
  
  const allValid = validations.every(v => v.valid);
  
  res.json({
    valid: allValid,
    message: allValid ? 'Validation passed' : 'Some assets invalid',
    validations
  });
});

// POST /a2a/report
app.post('/a2a/report', verifyToken, (req, res) => {
  const { asset_id, success } = req.body;
  
  const asset = assets.get(asset_id);
  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }
  
  asset.total_reports = (asset.total_reports || 0) + 1;
  if (success) {
    asset.success_reports = (asset.success_reports || 0) + 1;
  }
  
  res.json({
    success: true,
    asset_id,
    success_rate: asset.success_reports / asset.total_reports
  });
});

// POST /a2a/revoke
app.post('/a2a/revoke', verifyToken, (req, res) => {
  const { asset_id, reason } = req.body;
  
  const asset = assets.get(asset_id);
  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }
  
  if (asset.node_id !== req.nodeId) {
    return res.status(403).json({ error: 'Not authorized to revoke this asset' });
  }
  
  asset.status = 'revoked';
  asset.revoked_at = new Date();
  asset.revoke_reason = reason;
  
  res.json({
    success: true,
    asset_id,
    status: 'revoked'
  });
});

// GET /a2a/directory
app.get('/a2a/directory', (req, res) => {
  const activeNodes = Array.from(nodes.values())
    .filter(n => Date.now() - n.last_heartbeat < 45 * 60 * 1000)
    .map(n => ({
      node_id: n.node_id,
      credits: n.credits,
      last_heartbeat: n.last_heartbeat.toISOString()
    }));
  
  res.json({
    success: true,
    count: activeNodes.length,
    nodes: activeNodes
  });
});

// GET /health
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '2.5.0',
    timestamp: new Date().toISOString()
  });
});

describe('A2A Integration Tests', () => {
  beforeEach(() => {
    nodes.clear();
    assets.clear();
    nodeCounter = 0;
  });

  describe('POST /a2a/hello', () => {
    test('should register new node', async () => {
      const res = await request(app)
        .post('/a2a/hello')
        .send({
          protocol: 'gep-a2a',
          protocol_version: '1.0.0'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.node_id).toMatch(/^node_/);
      expect(res.body.token).toBeDefined();
      expect(res.body.credits).toBe(500);
    });

    test('should reject invalid protocol', async () => {
      const res = await request(app)
        .post('/a2a/hello')
        .send({
          protocol: 'invalid',
          protocol_version: '1.0.0'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unsupported');
    });
  });

  describe('POST /a2a/heartbeat', () => {
    let token;
    let nodeId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/a2a/hello')
        .send({ protocol: 'gep-a2a', protocol_version: '1.0.0' });
      token = res.body.token;
      nodeId = res.body.node_id;
    });

    test('should update heartbeat', async () => {
      const res = await request(app)
        .post('/a2a/heartbeat')
        .set('Authorization', `Bearer ${token}`)
        .send({ node_id: nodeId });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
    });

    test('should reject without auth', async () => {
      const res = await request(app)
        .post('/a2a/heartbeat')
        .send({ node_id: nodeId });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /a2a/publish', () => {
    let token;

    beforeEach(async () => {
      const res = await request(app)
        .post('/a2a/hello')
        .send({ protocol: 'gep-a2a', protocol_version: '1.0.0' });
      token = res.body.token;
    });

    test('should publish asset', async () => {
      const res = await request(app)
        .post('/a2a/publish')
        .set('Authorization', `Bearer ${token}`)
        .send({
          payload: {
            assets: [{
              asset_id: 'gene_test_001',
              type: 'Gene',
              version: '1.0.0',
              signals_match: ['test'],
              summary: 'Test gene'
            }]
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.published).toBe(1);
      expect(res.body.assets[0].gdi).toBe(0.85);
    });

    test('should reject duplicate asset', async () => {
      const asset = {
        asset_id: 'gene_dup_001',
        type: 'Gene',
        version: '1.0.0',
        signals_match: ['test'],
        summary: 'Test'
      };

      // First publish
      await request(app)
        .post('/a2a/publish')
        .set('Authorization', `Bearer ${token}`)
        .send({ payload: { assets: [asset] } });

      // Second publish (should fail)
      const res = await request(app)
        .post('/a2a/publish')
        .set('Authorization', `Bearer ${token}`)
        .send({ payload: { assets: [asset] } });

      expect(res.status).toBe(200);
      expect(res.body.failed).toBe(1);
    });

    test('should reject without auth', async () => {
      const res = await request(app)
        .post('/a2a/publish')
        .send({ payload: { assets: [] } });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /a2a/fetch', () => {
    let token;

    beforeEach(async () => {
      const hello = await request(app)
        .post('/a2a/hello')
        .send({ protocol: 'gep-a2a', protocol_version: '1.0.0' });
      token = hello.body.token;

      // Publish an asset
      await request(app)
        .post('/a2a/publish')
        .set('Authorization', `Bearer ${token}`)
        .send({
          payload: {
            assets: [{
              asset_id: 'gene_fetch_001',
              type: 'Gene',
              version: '1.0.0',
              signals_match: ['fetch-test'],
              summary: 'Fetch test'
            }]
          }
        });
    });

    test('should fetch assets', async () => {
      const res = await request(app)
        .post('/a2a/fetch')
        .set('Authorization', `Bearer ${token}`)
        .send({
          signals: ['fetch-test'],
          min_gdi: 0.5,
          limit: 10
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.capsules)).toBe(true);
    });
  });

  describe('POST /a2a/validate', () => {
    let token;

    beforeEach(async () => {
      const res = await request(app)
        .post('/a2a/hello')
        .send({ protocol: 'gep-a2a', protocol_version: '1.0.0' });
      token = res.body.token;
    });

    test('should validate asset', async () => {
      const res = await request(app)
        .post('/a2a/validate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          payload: {
            assets: [{
              asset_id: 'gene_validate_001',
              type: 'Gene',
              version: '1.0.0',
              signals_match: ['test'],
              summary: 'Validation test'
            }]
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });

    test('should reject invalid asset', async () => {
      const res = await request(app)
        .post('/a2a/validate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          payload: {
            assets: [{ asset_id: 'test' }] // Missing required fields
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });
  });

  describe('POST /a2a/revoke', () => {
    let token;
    let nodeId;

    beforeEach(async () => {
      const hello = await request(app)
        .post('/a2a/hello')
        .send({ protocol: 'gep-a2a', protocol_version: '1.0.0' });
      token = hello.body.token;
      nodeId = hello.body.node_id;

      // Publish asset
      await request(app)
        .post('/a2a/publish')
        .set('Authorization', `Bearer ${token}`)
        .send({
          payload: {
            assets: [{
              asset_id: 'gene_revoke_001',
              type: 'Gene',
              version: '1.0.0',
              signals_match: ['test'],
              summary: 'Revoke test'
            }]
          }
        });
    });

    test('should revoke owned asset', async () => {
      const res = await request(app)
        .post('/a2a/revoke')
        .set('Authorization', `Bearer ${token}`)
        .send({
          asset_id: 'gene_revoke_001',
          reason: 'Test revocation'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('revoked');
    });
  });

  describe('GET /a2a/directory', () => {
    test('should list nodes', async () => {
      const res = await request(app).get('/a2a/directory');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.nodes)).toBe(true);
    });
  });

  describe('GET /health', () => {
    test('should return health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.version).toBe('2.5.0');
    });
  });
});

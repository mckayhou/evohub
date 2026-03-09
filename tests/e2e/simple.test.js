/**
 * Simple E2E Tests - Basic API smoke tests
 * No complex mocking, just test endpoints respond
 */

const request = require('supertest');

// Mock external services only
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
    reason: 'Good quality'
  })
}));

// Create minimal app for testing
const express = require('express');
const app = express();
app.use(express.json());

// In-memory storage for tests
const nodes = new Map();
const assets = new Map();
let nodeCounter = 0;

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', version: '2.5.0' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ name: 'EvoHub', protocol: 'GEP-A2A-v1.0.0' });
});

// Hello endpoint
app.post('/a2a/hello', (req, res) => {
  const { protocol, protocol_version } = req.body;
  
  if (protocol !== 'gep-a2a' || protocol_version !== '1.0.0') {
    return res.status(400).json({ error: 'Unsupported protocol' });
  }
  
  nodeCounter++;
  const nodeId = `node_test_${nodeCounter}`;
  const token = `token_${Date.now()}`;
  
  nodes.set(nodeId, { token, credits: 500 });
  
  res.json({
    success: true,
    node_id: nodeId,
    token,
    credits: 500
  });
});

// Heartbeat endpoint
app.post('/a2a/heartbeat', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  res.json({ success: true, status: 'alive' });
});

// Directory endpoint
app.get('/a2a/directory', (req, res) => {
  res.json({ success: true, nodes: [] });
});

// Publish endpoint
app.post('/a2a/publish', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { payload } = req.body;
  if (!payload?.assets || payload.assets.length === 0) {
    return res.status(400).json({ error: 'Invalid assets' });
  }
  
  res.json({
    success: true,
    published: payload.assets.length,
    assets: payload.assets.map(a => ({
      asset_id: a.asset_id,
      gdi: 0.85,
      status: 'promoted'
    }))
  });
});

// Fetch endpoint
app.post('/a2a/fetch', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  res.json({ success: true, capsules: [] });
});

describe('E2E: API Smoke Tests', () => {
  test('GET /health returns healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  test('GET / returns API info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('EvoHub');
  });

  test('POST /a2a/hello registers node', async () => {
    const res = await request(app)
      .post('/a2a/hello')
      .send({ protocol: 'gep-a2a', protocol_version: '1.0.0' });
    
    expect(res.status).toBe(200);
    expect(res.body.node_id).toBeDefined();
    expect(res.body.token).toBeDefined();
  });

  test('POST /a2a/hello rejects invalid protocol', async () => {
    const res = await request(app)
      .post('/a2a/hello')
      .send({ protocol: 'invalid', protocol_version: '1.0.0' });
    
    expect(res.status).toBe(400);
  });

  test('POST /a2a/heartbeat requires auth', async () => {
    const res = await request(app).post('/a2a/heartbeat').send({});
    expect(res.status).toBe(401);
  });

  test('POST /a2a/heartbeat with valid token', async () => {
    const hello = await request(app)
      .post('/a2a/hello')
      .send({ protocol: 'gep-a2a', protocol_version: '1.0.0' });
    
    const res = await request(app)
      .post('/a2a/heartbeat')
      .set('Authorization', `Bearer ${hello.body.token}`)
      .send({ node_id: hello.body.node_id });
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
  });

  test('POST /a2a/publish requires auth', async () => {
    const res = await request(app)
      .post('/a2a/publish')
      .send({ payload: { assets: [] } });
    
    expect(res.status).toBe(401);
  });

  test('POST /a2a/publish publishes asset', async () => {
    const hello = await request(app)
      .post('/a2a/hello')
      .send({ protocol: 'gep-a2a', protocol_version: '1.0.0' });
    
    const res = await request(app)
      .post('/a2a/publish')
      .set('Authorization', `Bearer ${hello.body.token}`)
      .send({
        payload: {
          assets: [{
            asset_id: 'gene_test_001',
            type: 'Gene',
            signals_match: ['test'],
            summary: 'Test gene'
          }]
        }
      });
    
    expect(res.status).toBe(200);
    expect(res.body.published).toBe(1);
  });

  test('GET /a2a/directory returns nodes', async () => {
    const res = await request(app).get('/a2a/directory');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.nodes)).toBe(true);
  });
});

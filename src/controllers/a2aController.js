/**
 * A2A Controller - GEP-A2A Protocol Endpoints
 * EvoHub v2.5
 */

const Asset = require('../models/Asset');
const { calculateGDI } = require('../services/gdiService');
const { generateNodeId, generateNodeSecret } = require('../utils/crypto');
const logger = require('../utils/logger');

// In-memory node registry (production: use Redis)
const nodeRegistry = new Map();

/**
 * POST /a2a/hello
 * Node registration and handshake
 */
const hello = async (req, res, next) => {
  try {
    const nodeId = generateNodeId();
    const nodeSecret = generateNodeSecret();
    
    nodeRegistry.set(nodeId, {
      node_id: nodeId,
      node_secret: nodeSecret,
      credit: 500,
      created_at: new Date(),
      last_heartbeat: new Date()
    });

    logger.info(`Node registered: ${nodeId}`);
    
    res.json({
      node_id: nodeId,
      node_secret: nodeSecret,
      credit: 500,
      hub_version: '2.5.0',
      protocol_version: 'GEP-A2A-v1.0.0'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /a2a/heartbeat
 * Keep node connection alive
 */
const heartbeat = async (req, res, next) => {
  try {
    const { node_id } = req.body;
    const node = nodeRegistry.get(node_id);
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    node.last_heartbeat = new Date();
    
    res.json({
      status: 'alive',
      node_id,
      credit: node.credit,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /a2a/publish
 * Publish assets with GDI scoring
 */
const publish = async (req, res, next) => {
  try {
    const { assets } = req.body.payload || req.body;
    
    if (!Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ error: 'Invalid assets array' });
    }

    const saved = [];
    const errors = [];

    for (const data of assets) {
      try {
        // Check for duplicate
        const existing = await Asset.findOne({ asset_id: data.asset_id });
        if (existing) {
          errors.push({ asset_id: data.asset_id, error: 'Duplicate asset_id' });
          continue;
        }

        const asset = new Asset(data);
        const gdiResult = await calculateGDI(asset);
        await asset.save();
        
        saved.push({
          asset_id: asset.asset_id,
          gdi: gdiResult.gdi_score,
          status: asset.status,
          confidence_level: gdiResult.confidence_level
        });

        logger.info(`Asset published: ${asset.asset_id} (GDI: ${gdiResult.gdi_score})`);
      } catch (assetErr) {
        logger.error(`Failed to publish asset: ${data.asset_id}`, assetErr);
        errors.push({ asset_id: data.asset_id, error: assetErr.message });
      }
    }

    res.json({
      success: true,
      published: saved.length,
      failed: errors.length,
      assets: saved,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /a2a/fetch
 * Fetch assets by signals or category
 */
const fetch = async (req, res, next) => {
  try {
    const { signals, category, min_gdi = 0.7, limit = 20 } = req.body;
    
    const query = { 
      status: 'promoted', 
      gdi_score: { $gte: min_gdi } 
    };
    
    if (signals && Array.isArray(signals)) {
      query.signals_match = { $in: signals };
    }
    
    if (category) {
      query.category = category;
    }

    const results = await Asset.find(query)
      .sort({ gdi_score: -1, published_at: -1 })
      .limit(parseInt(limit));

    // Update fetch count
    for (const asset of results) {
      asset.fetch_count = (asset.fetch_count || 0) + 1;
      await asset.save();
    }

    res.json({
      success: true,
      count: results.length,
      capsules: results.map(r => ({
        asset_id: r.asset_id,
        type: r.type,
        category: r.category,
        signals_match: r.signals_match,
        summary: r.summary,
        gdi_score: r.gdi_score,
        confidence: r.confidence,
        published_at: r.published_at
      }))
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /a2a/validate
 * Dry-run validation
 */
const validate = async (req, res, next) => {
  try {
    const { assets } = req.body.payload || req.body;
    
    if (!Array.isArray(assets)) {
      return res.status(400).json({ error: 'Invalid assets array' });
    }

    const validations = assets.map(asset => {
      const errors = [];
      
      // Basic structure validation
      if (!asset.asset_id) errors.push('Missing asset_id');
      if (!asset.type || !['Gene', 'Capsule', 'EvolutionEvent'].includes(asset.type)) {
        errors.push('Invalid or missing type');
      }
      if (!asset.signals_match || !Array.isArray(asset.signals_match)) {
        errors.push('Missing or invalid signals_match');
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
      message: allValid ? 'GEP bundle 通过干跑验证' : '部分资产验证失败',
      validations
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /a2a/report
 * Report asset usage outcome
 */
const report = async (req, res, next) => {
  try {
    const { asset_id, success, details } = req.body;
    
    const asset = await Asset.findOne({ asset_id });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    asset.total_reports = (asset.total_reports || 0) + 1;
    if (success) {
      asset.success_reports = (asset.success_reports || 0) + 1;
    }
    
    await asset.save();

    logger.info(`Report received for ${asset_id}: ${success ? 'success' : 'failure'}`);

    res.json({
      success: true,
      asset_id,
      success_rate: asset.success_reports / asset.total_reports
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /a2a/decision
 * Record agent decision
 */
const decision = async (req, res, next) => {
  try {
    const { asset_id, decision: decisionType, reason } = req.body;
    
    logger.info(`Decision recorded: ${asset_id} -> ${decisionType}`);
    
    res.json({
      success: true,
      asset_id,
      decision: decisionType,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /a2a/revoke
 * Revoke published asset
 */
const revoke = async (req, res, next) => {
  try {
    const { asset_id, reason } = req.body;
    
    const asset = await Asset.findOne({ asset_id });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    asset.status = 'revoked';
    asset.revoked_at = new Date();
    asset.revoke_reason = reason;
    await asset.save();

    logger.info(`Asset revoked: ${asset_id}`);

    res.json({
      success: true,
      asset_id,
      status: 'revoked',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /a2a/directory
 * List available assets
 */
const directory = async (req, res, next) => {
  try {
    const { category, status = 'promoted', limit = 50 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;

    const results = await Asset.find(query)
      .sort({ gdi_score: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: results.length,
      assets: results.map(r => ({
        asset_id: r.asset_id,
        type: r.type,
        category: r.category,
        gdi_score: r.gdi_score,
        status: r.status,
        published_at: r.published_at
      }))
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  hello,
  heartbeat,
  publish,
  fetch,
  validate,
  report,
  decision,
  revoke,
  directory
};

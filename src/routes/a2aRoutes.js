/**
 * A2A Routes - GEP-A2A Protocol API Routes
 * EvoHub v2.5
 */

const express = require('express');
const router = express.Router();
const { verifyNodeSecret } = require('../middleware/auth');
const a2aController = require('../controllers/a2aController');

// Node registration (no auth required)
router.post('/hello', a2aController.hello);

// Heartbeat (node_id based)
router.post('/heartbeat', a2aController.heartbeat);

// Asset publishing (requires node_secret)
router.post('/publish', verifyNodeSecret, a2aController.publish);

// Asset fetching (public, but can use auth for rate limiting)
router.post('/fetch', a2aController.fetch);

// Validation (requires node_secret)
router.post('/validate', verifyNodeSecret, a2aController.validate);

// Usage reporting
router.post('/report', a2aController.report);

// Decision recording (Swarm Bounty)
const swarmController = require('../controllers/swarmController');
router.post('/decision', verifyNodeSecret, swarmController.submitDecision);

// Swarm Bounty routes
router.post('/bounty/create', verifyNodeSecret, swarmController.createBounty);
router.post('/bounty/join', verifyNodeSecret, swarmController.joinBounty);
router.get('/bounty/list', swarmController.listBounties);
router.get('/bounty/:id', swarmController.getBounty);
router.post('/bounty/cancel', verifyNodeSecret, swarmController.cancelBounty);
router.post('/bounty/cleanup', swarmController.cleanupBounties);

// Asset revocation (requires node_secret)
router.post('/revoke', verifyNodeSecret, a2aController.revoke);

// Directory listing (public)
router.get('/directory', a2aController.directory);

module.exports = router;

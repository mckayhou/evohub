/**
 * Swarm Controller - Bounty API Endpoints
 */

const swarmService = require('../services/swarmService');
const logger = require('../utils/logger');

class SwarmController {
  /**
   * POST /a2a/bounty/create
   * Create new bounty task
   */
  async createBounty(req, res, next) {
    try {
      const nodeId = req.nodeId;
      const bountyData = req.body;

      // Validate required fields
      if (!bountyData.title || !bountyData.description || !bountyData.task_type) {
        return res.status(400).json({
          error: 'Missing required fields: title, description, task_type'
        });
      }

      if (!bountyData.rewards || !bountyData.rewards.credits) {
        return res.status(400).json({
          error: 'Missing rewards.credits'
        });
      }

      const bounty = await swarmService.createBounty(nodeId, bountyData);

      res.json({
        success: true,
        bounty_id: bounty.bounty_id,
        status: bounty.status,
        message: 'Bounty created successfully'
      });
    } catch (err) {
      logger.error('Create bounty error:', err);
      next(err);
    }
  }

  /**
   * POST /a2a/bounty/join
   * Join a bounty as participant
   */
  async joinBounty(req, res, next) {
    try {
      const nodeId = req.nodeId;
      const { bounty_id } = req.body;

      if (!bounty_id) {
        return res.status(400).json({ error: 'Missing bounty_id' });
      }

      const bounty = await swarmService.joinBounty(bounty_id, nodeId);

      res.json({
        success: true,
        bounty_id: bounty.bounty_id,
        participants_count: bounty.participants.length,
        status: bounty.status,
        message: 'Joined bounty successfully'
      });
    } catch (err) {
      logger.error('Join bounty error:', err);
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * POST /a2a/bounty/decision
   * Submit decision for bounty
   */
  async submitDecision(req, res, next) {
    try {
      const nodeId = req.nodeId;
      const { bounty_id, decision, reasoning, solution_asset_id } = req.body;

      if (!bounty_id || !decision) {
        return res.status(400).json({
          error: 'Missing required fields: bounty_id, decision'
        });
      }

      if (!['accept', 'reject', 'abstain'].includes(decision)) {
        return res.status(400).json({
          error: 'Invalid decision. Must be: accept, reject, abstain'
        });
      }

      const bounty = await swarmService.submitDecision(
        bounty_id,
        nodeId,
        decision,
        reasoning,
        solution_asset_id
      );

      res.json({
        success: true,
        bounty_id: bounty.bounty_id,
        consensus_reached: bounty.result?.consensus_reached || false,
        final_decision: bounty.result?.final_decision,
        status: bounty.status,
        message: 'Decision submitted successfully'
      });
    } catch (err) {
      logger.error('Submit decision error:', err);
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * GET /a2a/bounty/list
   * List available bounties
   */
  async listBounties(req, res, next) {
    try {
      const filters = {
        task_type: req.query.task_type,
        tags: req.query.tags ? req.query.tags.split(',') : undefined,
        priority: req.query.priority,
        limit: parseInt(req.query.limit) || 50
      };

      const bounties = await swarmService.getAvailableBounties(filters);

      res.json({
        success: true,
        count: bounties.length,
        bounties: bounties.map(b => ({
          bounty_id: b.bounty_id,
          title: b.title,
          description: b.description.substring(0, 200) + '...',
          task_type: b.task_type,
          status: b.status,
          rewards: b.rewards,
          deadline: b.deadline,
          participants_count: b.participants.length,
          tags: b.tags,
          priority: b.priority
        }))
      });
    } catch (err) {
      logger.error('List bounties error:', err);
      next(err);
    }
  }

  /**
   * GET /a2a/bounty/:id
   * Get bounty details
   */
  async getBounty(req, res, next) {
    try {
      const { id } = req.params;
      const bounty = await swarmService.getBounty(id);

      if (!bounty) {
        return res.status(404).json({ error: 'Bounty not found' });
      }

      res.json({
        success: true,
        bounty: {
          bounty_id: bounty.bounty_id,
          title: bounty.title,
          description: bounty.description,
          task_type: bounty.task_type,
          requirements: bounty.requirements,
          rewards: bounty.rewards,
          status: bounty.status,
          deadline: bounty.deadline,
          created_at: bounty.created_at,
          creator_node_id: bounty.creator_node_id,
          participants: bounty.participants.map(p => ({
            node_id: p.node_id,
            joined_at: p.joined_at,
            decision: p.decision,
            submitted_at: p.submitted_at
          })),
          result: bounty.result,
          tags: bounty.tags,
          priority: bounty.priority
        }
      });
    } catch (err) {
      logger.error('Get bounty error:', err);
      next(err);
    }
  }

  /**
   * POST /a2a/bounty/cancel
   * Cancel bounty (creator only)
   */
  async cancelBounty(req, res, next) {
    try {
      const nodeId = req.nodeId;
      const { bounty_id } = req.body;

      if (!bounty_id) {
        return res.status(400).json({ error: 'Missing bounty_id' });
      }

      const bounty = await swarmService.cancelBounty(bounty_id, nodeId);

      res.json({
        success: true,
        bounty_id: bounty.bounty_id,
        status: bounty.status,
        message: 'Bounty cancelled successfully'
      });
    } catch (err) {
      logger.error('Cancel bounty error:', err);
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * POST /a2a/bounty/cleanup
   * Admin: Cleanup expired bounties
   */
  async cleanupBounties(req, res, next) {
    try {
      const count = await swarmService.cleanupExpiredBounties();

      res.json({
        success: true,
        expired_count: count,
        message: `Cleaned up ${count} expired bounties`
      });
    } catch (err) {
      logger.error('Cleanup bounties error:', err);
      next(err);
    }
  }
}

module.exports = new SwarmController();

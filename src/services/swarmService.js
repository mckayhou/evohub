/**
 * Swarm Service - Bounty and Consensus Management
 */

const Bounty = require('../models/Bounty');
const Asset = require('../models/Asset');
const logger = require('../utils/logger');
const { generateNodeId } = require('../utils/crypto');

const SWARM_CONFIG = {
  min_participants: 3,
  consensus_threshold: 0.67, // 2/3 majority
  decision_timeout: 24 * 60 * 60 * 1000, // 24 hours
  reputation_decay: 0.95 // Weekly decay
};

class SwarmService {
  /**
   * Create a new bounty task
   */
  async createBounty(creatorNodeId, bountyData) {
    const bountyId = `bounty_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const bounty = new Bounty({
      bounty_id: bountyId,
      creator_node_id: creatorNodeId,
      title: bountyData.title,
      description: bountyData.description,
      task_type: bountyData.task_type,
      requirements: bountyData.requirements || {},
      rewards: bountyData.rewards,
      deadline: new Date(Date.now() + (bountyData.duration_hours || 24) * 3600000),
      tags: bountyData.tags || [],
      priority: bountyData.priority || 'medium'
    });

    await bounty.save();
    logger.info(`Swarm bounty created: ${bountyId} by ${creatorNodeId}`);
    
    return bounty;
  }

  /**
   * Join a bounty as participant
   */
  async joinBounty(bountyId, nodeId) {
    const bounty = await Bounty.findOne({ bounty_id: bountyId });
    if (!bounty) {
      throw new Error('Bounty not found');
    }

    if (bounty.status !== 'open') {
      throw new Error(`Cannot join bounty with status: ${bounty.status}`);
    }

    if (bounty.deadline < new Date()) {
      bounty.status = 'expired';
      await bounty.save();
      throw new Error('Bounty has expired');
    }

    // Check if already joined
    if (bounty.participants.some(p => p.node_id === nodeId)) {
      throw new Error('Already joined this bounty');
    }

    // Check max participants
    if (bounty.participants.length >= bounty.requirements.max_nodes) {
      throw new Error('Bounty is full');
    }

    bounty.participants.push({
      node_id: nodeId,
      joined_at: new Date()
    });

    // Update status if min participants reached
    if (bounty.participants.length >= SWARM_CONFIG.min_participants) {
      bounty.status = 'in_progress';
    }

    await bounty.save();
    logger.info(`Node ${nodeId} joined bounty ${bountyId}`);
    
    return bounty;
  }

  /**
   * Submit decision for bounty
   */
  async submitDecision(bountyId, nodeId, decision, reasoning, solutionAssetId = null) {
    const bounty = await Bounty.findOne({ bounty_id: bountyId });
    if (!bounty) {
      throw new Error('Bounty not found');
    }

    if (bounty.status !== 'in_progress') {
      throw new Error('Bounty is not in progress');
    }

    const participant = bounty.participants.find(p => p.node_id === nodeId);
    if (!participant) {
      throw new Error('Not a participant of this bounty');
    }

    if (participant.submitted_at) {
      throw new Error('Decision already submitted');
    }

    participant.decision = decision;
    participant.reasoning = reasoning;
    participant.submitted_at = new Date();

    // If solution provided, publish it
    if (solutionAssetId) {
      participant.solution_asset_id = solutionAssetId;
    }

    await bounty.save();
    logger.info(`Decision submitted for bounty ${bountyId} by ${nodeId}: ${decision}`);

    // Check if consensus can be reached
    await this.checkConsensus(bounty);
    
    return bounty;
  }

  /**
   * Check and process consensus
   */
  async checkConsensus(bounty) {
    const submitted = bounty.participants.filter(p => p.submitted_at);
    const total = bounty.participants.length;

    // Need at least min_participants decisions
    if (submitted.length < SWARM_CONFIG.min_participants) {
      return false;
    }

    // Count decisions
    const counts = { accept: 0, reject: 0, abstain: 0 };
    submitted.forEach(p => {
      counts[p.decision] = (counts[p.decision] || 0) + 1;
    });

    const maxDecision = Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b);
    const ratio = maxDecision[1] / total;

    // Check if consensus reached
    if (ratio >= SWARM_CONFIG.consensus_threshold) {
      bounty.status = 'completed';
      bounty.completed_at = new Date();
      bounty.result = {
        consensus_reached: true,
        final_decision: maxDecision[0],
        winning_nodes: submitted
          .filter(p => p.decision === maxDecision[0])
          .map(p => p.node_id)
      };

      await bounty.save();
      await this.distributeRewards(bounty);
      
      logger.info(`Consensus reached for bounty ${bounty.bounty_id}: ${maxDecision[0]}`);
      return true;
    }

    // Check if all submitted but no consensus
    if (submitted.length === total) {
      bounty.status = 'completed';
      bounty.completed_at = new Date();
      bounty.result = {
        consensus_reached: false,
        final_decision: 'no_consensus',
        winning_nodes: []
      };

      await bounty.save();
      logger.info(`No consensus for bounty ${bounty.bounty_id}`);
      return false;
    }

    return false;
  }

  /**
   * Distribute rewards to winning nodes
   */
  async distributeRewards(bounty) {
    if (!bounty.result.consensus_reached) {
      return;
    }

    const { winning_nodes, final_decision } = bounty.result;
    
    if (final_decision === 'accept' && winning_nodes.length > 0) {
      const rewardPerNode = Math.floor(bounty.rewards.credits / winning_nodes.length);
      
      // TODO: Update node credits in database
      logger.info(`Distributed ${rewardPerNode} credits to ${winning_nodes.length} nodes for bounty ${bounty.bounty_id}`);
    }
  }

  /**
   * Get available bounties
   */
  async getAvailableBounties(filters = {}) {
    const query = {
      status: { $in: ['open', 'in_progress'] },
      deadline: { $gt: new Date() }
    };

    if (filters.task_type) {
      query.task_type = filters.task_type;
    }

    if (filters.tags) {
      query.tags = { $in: filters.tags };
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    return await Bounty.find(query)
      .sort({ priority: -1, created_at: -1 })
      .limit(filters.limit || 50);
  }

  /**
   * Get bounty details
   */
  async getBounty(bountyId) {
    return await Bounty.findOne({ bounty_id: bountyId });
  }

  /**
   * Cancel bounty (only creator)
   */
  async cancelBounty(bountyId, nodeId) {
    const bounty = await Bounty.findOne({ bounty_id: bountyId });
    if (!bounty) {
      throw new Error('Bounty not found');
    }

    if (bounty.creator_node_id !== nodeId) {
      throw new Error('Only creator can cancel bounty');
    }

    if (bounty.status === 'completed') {
      throw new Error('Cannot cancel completed bounty');
    }

    bounty.status = 'cancelled';
    await bounty.save();
    
    logger.info(`Bounty ${bountyId} cancelled by ${nodeId}`);
    return bounty;
  }

  /**
   * Clean up expired bounties
   */
  async cleanupExpiredBounties() {
    const result = await Bounty.updateMany(
      {
        status: { $in: ['open', 'in_progress'] },
        deadline: { $lt: new Date() }
      },
      { $set: { status: 'expired' } }
    );

    if (result.modifiedCount > 0) {
      logger.info(`Marked ${result.modifiedCount} bounties as expired`);
    }

    return result.modifiedCount;
  }
}

module.exports = new SwarmService();

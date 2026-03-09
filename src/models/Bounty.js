/**
 * Bounty Model - Swarm Task System
 */

const mongoose = require('mongoose');

const bountySchema = new mongoose.Schema({
  bounty_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Task definition
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  task_type: {
    type: String,
    enum: ['code_review', 'bug_fix', 'optimization', 'documentation', 'testing', 'research'],
    required: true
  },
  
  // Requirements
  requirements: {
    skills: [String],
    min_reputation: { type: Number, default: 0.5 },
    max_nodes: { type: Number, default: 5 }
  },
  
  // Rewards
  rewards: {
    credits: { type: Number, required: true },
    reputation: { type: Number, default: 0.05 }
  },
  
  // Timeline
  created_at: {
    type: Date,
    default: Date.now
  },
  deadline: {
    type: Date,
    required: true
  },
  completed_at: Date,
  
  // Status
  status: {
    type: String,
    enum: ['open', 'in_progress', 'completed', 'cancelled', 'expired'],
    default: 'open'
  },
  
  // Creator
  creator_node_id: {
    type: String,
    required: true
  },
  
  // Participants
  participants: [{
    node_id: String,
    joined_at: Date,
    decision: {
      type: String,
      enum: ['accept', 'reject', 'abstain'],
      default: 'abstain'
    },
    reasoning: String,
    submitted_at: Date
  }],
  
  // Results
  result: {
    consensus_reached: Boolean,
    final_decision: String,
    winning_nodes: [String],
    solution_asset_id: String
  },
  
  // Metadata
  tags: [String],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  }
});

// Indexes
bountySchema.index({ status: 1, deadline: 1 });
bountySchema.index({ creator_node_id: 1 });
bountySchema.index({ tags: 1 });

module.exports = mongoose.model('Bounty', bountySchema);

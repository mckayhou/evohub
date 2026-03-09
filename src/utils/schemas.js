/**
 * Zod Schemas - Input Validation
 * EvoHub v2.5
 */

const { z } = require('zod');

// Asset types
const AssetType = z.enum(['Gene', 'Capsule', 'EvolutionEvent']);

// Gene schema
const GeneSchema = z.object({
  asset_id: z.string().min(1).max(128),
  type: z.literal('Gene'),
  version: z.string().regex(/^\d+\.\d+\.\d+/),
  signals_match: z.array(z.string()).min(1),
  summary: z.string().min(10).max(2000),
  preconditions: z.array(z.string()).optional(),
  constraints: z.record(z.any()).optional(),
  code_diff: z.string().min(1).max(10000),
  validate_commands: z.array(z.string()).min(1)
});

// Capsule schema
const CapsuleSchema = z.object({
  asset_id: z.string().min(1).max(128),
  type: z.literal('Capsule'),
  version: z.string().regex(/^\d+\.\d+\.\d+/),
  parent_gene: z.string().min(1).max(128),
  signals_match: z.array(z.string()).min(1),
  outcome: z.string().min(10).max(2000),
  confidence: z.number().min(0).max(1),
  blast_radius: z.array(z.string()).optional(),
  env_fingerprint: z.record(z.any()).optional(),
  success_rate: z.number().min(0).max(1).optional()
});

// Asset schema for validation (union of Gene and Capsule)
const AssetSchema = z.union([GeneSchema, CapsuleSchema]);

// Publish request schema
const PublishRequestSchema = z.object({
  payload: z.object({
    assets: z.array(AssetSchema).min(1).max(100)
  })
});

// Fetch request schema
const FetchRequestSchema = z.object({
  signals: z.array(z.string()).optional(),
  category: z.string().optional(),
  min_gdi: z.number().min(0).max(1).default(0.7),
  limit: z.number().int().min(1).max(100).default(20)
});

// Hello request schema
const HelloRequestSchema = z.object({
  node_type: z.enum(['agent', 'hub', 'client']).optional(),
  version: z.string().optional()
});

// Heartbeat request schema
const HeartbeatRequestSchema = z.object({
  node_id: z.string().min(1),
  status: z.enum(['healthy', 'degraded', 'unhealthy']).optional()
});

// Report request schema
const ReportRequestSchema = z.object({
  asset_id: z.string().min(1),
  success: z.boolean(),
  details: z.record(z.any()).optional()
});

// Revoke request schema
const RevokeRequestSchema = z.object({
  asset_id: z.string().min(1),
  reason: z.string().max(500).optional()
});

// LLM Call options schema
const LLMCallOptionsSchema = z.object({
  model: z.string().optional(),
  max_tokens: z.number().int().min(1).max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  startTime: z.number().optional()
});

module.exports = {
  GeneSchema,
  CapsuleSchema,
  AssetSchema,
  PublishRequestSchema,
  FetchRequestSchema,
  HelloRequestSchema,
  HeartbeatRequestSchema,
  ReportRequestSchema,
  RevokeRequestSchema,
  LLMCallOptionsSchema
};

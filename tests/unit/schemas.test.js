/**
 * Zod Schema Validation Tests
 */

const { z } = require('zod');
const { 
  AssetSchema, 
  GeneSchema, 
  CapsuleSchema,
  PublishRequestSchema 
} = require('../../src/utils/schemas');

describe('Schema Validation', () => {
  describe('GeneSchema', () => {
    const validGene = {
      asset_id: 'gene_1234567890_abcdef',
      type: 'Gene',
      version: '1.0.0',
      signals_match: ['error-handling', 'api-design'],
      summary: 'Test gene summary',
      preconditions: ['node >= 18'],
      constraints: { timeout: 5000 },
      code_diff: 'console.log("test")',
      validate_commands: ['npm test']
    };

    test('should validate valid gene', () => {
      const result = GeneSchema.safeParse(validGene);
      expect(result.success).toBe(true);
    });

    test('should reject missing required fields', () => {
      const invalid = { ...validGene };
      delete invalid.asset_id;
      const result = GeneSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    test('should reject invalid type', () => {
      const invalid = { ...validGene, type: 'Invalid' };
      const result = GeneSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    test('should reject empty signals_match', () => {
      const invalid = { ...validGene, signals_match: [] };
      const result = GeneSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('CapsuleSchema', () => {
    const validCapsule = {
      asset_id: 'capsule_1234567890_abcdef',
      type: 'Capsule',
      version: '1.0.0',
      parent_gene: 'gene_1234567890_abcdef',
      signals_match: ['error-handling'],
      outcome: 'Successfully handled API errors',
      confidence: 0.95,
      blast_radius: ['src/api/', 'tests/api/'],
      env_fingerprint: { node: '18.17.0', os: 'linux' },
      success_rate: 0.92
    };

    test('should validate valid capsule', () => {
      const result = CapsuleSchema.safeParse(validCapsule);
      expect(result.success).toBe(true);
    });

    test('should reject confidence > 1', () => {
      const invalid = { ...validCapsule, confidence: 1.5 };
      const result = CapsuleSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    test('should reject negative success_rate', () => {
      const invalid = { ...validCapsule, success_rate: -0.1 };
      const result = CapsuleSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('PublishRequestSchema', () => {
    const validRequest = {
      payload: {
        assets: [
          {
            asset_id: 'gene_123',
            type: 'Gene',
            version: '1.0.0',
            signals_match: ['test'],
            summary: 'Test gene for validation',
            code_diff: 'console.log("test");',
            validate_commands: ['npm test']
          }
        ]
      }
    };

    test('should validate valid publish request', () => {
      const result = PublishRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    test('should reject empty assets array', () => {
      const invalid = { payload: { assets: [] } };
      const result = PublishRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    test('should reject non-array assets', () => {
      const invalid = { payload: { assets: 'not-an-array' } };
      const result = PublishRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});

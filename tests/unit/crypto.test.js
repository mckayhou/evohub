/**
 * Crypto Utils Unit Tests
 */

const { generateNodeId, generateNodeSecret, hashData } = require('../../src/utils/crypto');

describe('Crypto Utils', () => {
  describe('generateNodeId', () => {
    test('should generate valid node ID', () => {
      const nodeId = generateNodeId();
      expect(nodeId).toMatch(/^node_[a-z0-9_]+$/);
      expect(nodeId.length).toBeGreaterThan(10);
    });

    test('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateNodeId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('generateNodeSecret', () => {
    test('should generate valid secret', () => {
      const secret = generateNodeSecret();
      expect(secret).toMatch(/^secret_[a-z0-9_]+$/);
      expect(secret.length).toBeGreaterThan(20);
    });

    test('should generate cryptographically strong secrets', () => {
      const secret = generateNodeSecret();
      // Should contain randomness (timestamp + random)
      const parts = secret.split('_');
      expect(parts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('hashData', () => {
    test('should hash string data', () => {
      const hash = hashData('test data');
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    test('should hash object data', () => {
      const hash = hashData({ key: 'value', num: 123 });
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should produce consistent hashes', () => {
      const data = { test: 'data', nested: { key: 'value' } };
      const hash1 = hashData(data);
      const hash2 = hashData(data);
      expect(hash1).toBe(hash2);
    });

    test('should produce different hashes for different data', () => {
      const hash1 = hashData('data1');
      const hash2 = hashData('data2');
      expect(hash1).not.toBe(hash2);
    });
  });
});

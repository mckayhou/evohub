/**
 * Jest Test Setup
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/evohub_test';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  generateTestAsset: (overrides = {}) => ({
    asset_id: `gene_test_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    type: 'Gene',
    version: '1.0.0',
    signals_match: ['test-signal'],
    summary: 'Test asset',
    preconditions: ['node >= 18'],
    constraints: {},
    code_diff: 'console.log("test");',
    validate_commands: ['npm test'],
    ...overrides
  })
};

// Console suppression during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn()
// };

/**
 * Jest Configuration
 */

module.exports = {
  testEnvironment: 'node',
  
  // Test directories
  roots: ['<rootDir>/tests'],
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js', // Entry point
    '!**/node_modules/**'
  ],
  
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Module paths
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/logs/'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Fail on console errors/warnings during tests
  errorOnDeprecated: true
};

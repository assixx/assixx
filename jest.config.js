module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: ['**/backend/tests/**/*.test.js', '**/backend/tests/**/*.spec.js'],

  // Coverage settings
  collectCoverageFrom: [
    'backend/src/**/*.js',
    '!backend/src/server.js',
    '!backend/src/database.js',
    '!**/node_modules/**',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/backend/src/$1',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/backend/tests/setup.js'],

  // Verbose output
  verbose: true,
};

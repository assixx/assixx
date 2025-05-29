module.exports = {
  // Test environment
  testEnvironment: 'node',

  // TypeScript preset
  preset: 'ts-jest',

  // Test file patterns - support both JS and TS
  testMatch: [
    '**/backend/tests/**/*.test.js',
    '**/backend/tests/**/*.spec.js',
    '**/backend/tests/**/*.test.ts',
    '**/backend/tests/**/*.spec.ts',
  ],

  // Coverage settings - include both JS and TS files
  collectCoverageFrom: [
    'backend/src/**/*.{js,ts}',
    '!backend/src/server.{js,ts}',
    '!backend/src/database.js',
    '!**/node_modules/**',
    '!**/*.d.ts',
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

  // Setup files - support both JS and TS
  setupFilesAfterEnv: ['<rootDir>/backend/tests/setup.ts'],

  // Transform configuration for TypeScript
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'es2020',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: false, // Relaxed for tests
          skipLibCheck: true,
        },
      },
    ],
    '^.+\\.js$': 'babel-jest',
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],

  // Verbose output
  verbose: true,
};

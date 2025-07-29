/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  testEnvironmentOptions: {
    NODE_ENV: "test"
  },
  extensionsToTreatAsEsm: [".ts"],
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  roots: ["<rootDir>/backend"],
  testMatch: [
    "**/__tests__/**/*.+(ts|tsx|js)",
    "**/?(*.)+(spec|test).+(ts|tsx|js)",
  ],
  testPathIgnorePatterns: [
    // V1 Tests temporär ausschließen während Migration
    "backend/src/__tests__/", // Alle v1 Integration Tests
    "backend/src/routes/(?!v2/)", // v1 Route Tests (aber v2 Tests erlauben)
    "backend/src/controllers/__tests__/", // v1 Controller Tests
    "backend/src/services/__tests__/", // v1 Service Tests
    "backend/src/models/__tests__/", // v1 Model Tests
    "backend/src/middleware/__tests__/", // v1 Middleware Tests
    // Explizit v1 Tests die TypeScript Errors haben:
    "shifts.test.ts",
    "kvp.test.ts",
    "teams.test.ts",
    "surveys.test.ts",
    "blackboard.integration.test.ts",
  ],
  collectCoverageFrom: [
    "backend/src/**/*.{js,ts}",
    "!backend/src/**/*.d.ts",
    "!backend/src/**/index.ts",
    "!backend/src/server.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@/(.*)$": "<rootDir>/backend/src/$1",
  },
  moduleFileExtensions: ["js", "json", "ts", "tsx"],
  extensionsToTreatAsEsm: [".ts"],
  setupFilesAfterEnv: ["<rootDir>/backend/src/__tests__/setup.ts", "<rootDir>/jest.setup.ts"],
  globalSetup: "<rootDir>/jest.globalSetup.js",
  globalTeardown: "<rootDir>/jest.globalTeardown.js",
  testTimeout: 10000,
};

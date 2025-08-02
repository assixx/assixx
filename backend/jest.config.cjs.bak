/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          target: "es2020",
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          moduleResolution: "node",
          resolveJsonModule: true,
          strict: false,
        },
        diagnostics: {
          ignoreCodes: [1343],
        },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/build/"],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  maxWorkers: 4, // VORSICHT: Kann Race Conditions mit DB geben!
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true,
  collectCoverage: false, // Enable with --coverage flag
  collectCoverageFrom: [
    "src/**/*.{js,ts}",
    "!src/**/*.d.ts",
    "!src/**/*.test.{js,ts}",
    "!src/**/__tests__/**",
    "!src/__tests__/**",
    "!src/types/**",
    "!src/server.ts",
    "!src/config/**",
    "!src/routes/mocks/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json"],
  coverageThreshold: {
    global: {
      branches: 0, // Start with 0 and increase gradually
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
};

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
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/build/"],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  maxWorkers: 1,
  testTimeout: 30000,
};

/**
 * Jest Setup File
 * Configuration for test environment
 */

// Jest is available globally in test environment

// Set test environment
process.env["NODE_ENV"] = "test";
process.env["JWT_SECRET"] = "test-secret";
process.env["DB_HOST"] = "localhost";
process.env["DB_USER"] = "test";
process.env["DB_PASSWORD"] = "test";
process.env["DB_NAME"] = "main_test";

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test timeout
jest.setTimeout(30000);

// Mock modules that might not be available in test environment
jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

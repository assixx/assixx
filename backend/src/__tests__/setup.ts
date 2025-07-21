/**
 * Jest Setup File
 * Configuration for test environment
 */

// Jest is available globally in test environment

// Set test environment
process.env["NODE_ENV"] = "test";
process.env["JWT_SECRET"] =
  process.env["JWT_SECRET"] || "test-secret-key-for-testing";

// Database configuration - use GitHub Actions values or local defaults
process.env["DB_HOST"] = process.env["DB_HOST"] || "localhost";
process.env["DB_PORT"] = process.env["DB_PORT"] || "3307";
process.env["DB_USER"] = process.env["DB_USER"] || "assixx_user";
process.env["DB_PASSWORD"] = process.env["DB_PASSWORD"] || "AssixxP@ss2025!";
process.env["DB_NAME"] = process.env["DB_NAME"] || "main_test";

// Redis configuration
process.env["REDIS_HOST"] = process.env["REDIS_HOST"] || "localhost";
process.env["REDIS_PORT"] = process.env["REDIS_PORT"] || "6379";

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

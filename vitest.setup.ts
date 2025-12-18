/**
 * Vitest Global Setup File
 *
 * This file runs before each test file.
 * Use for global mocks, environment setup, etc.
 */
import process from 'node:process';
import { afterEach, beforeEach, vi } from 'vitest';

// Clear all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Reset modules after each test
afterEach(() => {
  vi.resetModules();
});

// Global test environment setup
// Add environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_NAME = 'assixx_test';

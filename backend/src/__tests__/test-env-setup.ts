/**
 * Test Environment Setup
 * Ensures proper test environment configuration
 */

import { config } from "dotenv";
import path from "path";

// Load test environment variables
const envPath = path.resolve(process.cwd(), ".env.test");
config({ path: envPath });

// Set test-specific environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-for-github-actions";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || "test-session-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_USER = process.env.DB_USER || "assixx_user";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "AssixxP@ss2025!";
process.env.DB_NAME = process.env.DB_NAME || "main";
process.env.REDIS_HOST = process.env.REDIS_HOST || "localhost";
process.env.REDIS_PORT = process.env.REDIS_PORT || "6379";

// Disable mock database for tests
process.env.USE_MOCK_DB = "false";

// Session validation disabled for tests (same as production)
process.env.VALIDATE_SESSIONS = "false";

// Set test timeouts
// Note: jest.setTimeout is not available in ESM context
// Timeouts are configured in jest.config.js instead

// Export for use in tests
export const TEST_CONFIG = {
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  isCI: !!process.env.CI,
};

console.log("Test environment configured:", {
  NODE_ENV: process.env.NODE_ENV,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  USE_MOCK_DB: process.env.USE_MOCK_DB,
  CI: process.env.CI,
});

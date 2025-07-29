/**
 * Jest Setup File
 * Runs for each test file
 * Ensures pool is closed after all tests in a file
 */

import { afterAll } from "@jest/globals";
import { closePool } from "./backend/src/config/database.js";

// Close pool after all tests in each file
afterAll(async () => {
  try {
    await closePool();
  } catch (error) {
    // Ignore errors during cleanup
    console.error("Error closing pool in test:", error);
  }
});

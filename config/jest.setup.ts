/**
 * Jest Setup File
 * Runs for each test file
 * Ensures pool is closed after all tests in a file
 */

// afterAll is globally available in Jest
afterAll(async () => {
  try {
    const { closePool } = require("./backend/src/config/database");
    await closePool();
  } catch (error) {
    // Ignore errors during cleanup
    console.error("Error closing pool in test:", error);
  }
});

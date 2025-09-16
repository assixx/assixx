/**
 * Jest Global Setup for Database Tests
 * Closes all database connections after all tests are done
 */
import { closeTestDatabase } from '../mocks/database.js';

// Ensure all database connections are closed after tests
afterAll(async () => {
  await closeTestDatabase();

  // Give time for all async operations to complete
  await new Promise((resolve) => setTimeout(resolve, 100));
});

// Set longer timeout for database tests
jest.setTimeout(30000);

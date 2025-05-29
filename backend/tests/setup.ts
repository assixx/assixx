/**
 * Test Setup File (TypeScript)
 * Global test configurations and utilities
 */

import * as jwt from 'jsonwebtoken';

// Mock für Umgebungsvariablen
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DB_NAME = 'assixx_test';

// Interface for test utilities
interface TestUtils {
  generateTestToken: (userId: number, role: string) => string;
}

// Globale Test-Utilities
const testUtils: TestUtils = {
  // Token für Tests generieren
  generateTestToken: (userId: number, role: string): string => {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET!, {
      expiresIn: '1h',
    });
  },
};

// Make testUtils globally available
declare global {
  var testUtils: TestUtils;
}

// Assign to global
global.testUtils = testUtils;

// Cleanup nach Tests
afterAll(() => {
  // Datenbankverbindungen schließen, etc.
});

export { testUtils };

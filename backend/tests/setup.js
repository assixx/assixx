// Test setup file
// Hier können globale Test-Konfigurationen definiert werden

// Mock für Umgebungsvariablen
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DB_NAME = 'assixx_test';

// Globale Test-Utilities
global.testUtils = {
  // Beispiel: Token für Tests generieren
  generateTestToken: (userId, role) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
  },
};

// Cleanup nach Tests
afterAll(() => {
  // Datenbankverbindungen schließen, etc.
});

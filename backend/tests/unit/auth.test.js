const { generateToken, verifyToken } = require('../../src/auth');

describe('Authentication Tests', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const userId = 123;
      const role = 'admin';
      
      const token = generateToken(userId, role);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });
  });
  
  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const userId = 123;
      const role = 'admin';
      const token = generateToken(userId, role);
      
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe(userId);
      expect(decoded.role).toBe(role);
    });
    
    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      
      expect(() => {
        verifyToken(invalidToken);
      }).toThrow();
    });
  });
});
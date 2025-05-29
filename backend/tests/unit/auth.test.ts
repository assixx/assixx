/**
 * Authentication Tests (TypeScript)
 */

import { generateToken, validateToken } from '../../src/auth';
import { DatabaseUser } from '../../src/types/models';

describe('Authentication Tests', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const mockUser: DatabaseUser = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'User',
        role: 'admin',
        tenant_id: 1,
        department_id: null,
        is_active: true,
        is_archived: false,
        profile_picture: null,
        phone_number: null,
        position: null,
        hire_date: null,
        birth_date: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const token = generateToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', () => {
      const mockUser: DatabaseUser = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'User',
        role: 'admin',
        tenant_id: 1,
        department_id: null,
        is_active: true,
        is_archived: false,
        profile_picture: null,
        phone_number: null,
        position: null,
        hire_date: null,
        birth_date: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const token = generateToken(mockUser);
      const result = validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user!.id).toBe(123);
      expect(result.user!.username).toBe('testuser');
      expect(result.user!.role).toBe('admin');
    });

    it('should return invalid for malformed token', () => {
      const invalidToken = 'invalid.token.here';
      const result = validateToken(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return invalid for empty token', () => {
      const result = validateToken('');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

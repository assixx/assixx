/**
 * Simple Unit Test for Users v2 Service
 * Tests without mocking to verify test setup
 */
import { describe, expect, it } from '@jest/globals';

import { ServiceError } from './users.service.js';

describe('UsersService - Simple Test', () => {
  describe('ServiceError', () => {
    it('should create ServiceError with correct properties', () => {
      const error = new ServiceError('TEST_ERROR', 'Test error message', 400);

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ServiceError');
    });

    it('should use default status code 500', () => {
      const error = new ServiceError('TEST_ERROR', 'Test error');

      expect(error.statusCode).toBe(500);
    });

    it('should include details when provided', () => {
      const details = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' },
      ];

      const error = new ServiceError('VALIDATION_ERROR', 'Validation failed', 400, details);

      expect(error.details).toEqual(details);
    });
  });
});

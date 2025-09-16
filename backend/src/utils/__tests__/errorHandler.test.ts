/**
 * Unit Tests for errorHandler utility
 * Tests error message extraction from various error types
 */
import { getErrorMessage } from '../errorHandler';

describe('errorHandler', () => {
  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error message');
      const result = getErrorMessage(error);
      expect(result).toBe('Test error message');
    });

    it('should extract message from object with message property', () => {
      const error = { message: 'Custom error message' };
      const result = getErrorMessage(error);
      expect(result).toBe('Custom error message');
    });

    it('should convert string error to message', () => {
      const error = 'String error';
      const result = getErrorMessage(error);
      expect(result).toBe('String error');
    });

    it('should handle number error', () => {
      const error = 404;
      const result = getErrorMessage(error);
      expect(result).toBe('An unknown error occurred');
    });

    it('should handle null error', () => {
      const error = null;
      const result = getErrorMessage(error);
      expect(result).toBe('An unknown error occurred');
    });

    it('should handle undefined error', () => {
      const error = undefined;
      const result = getErrorMessage(error);
      expect(result).toBe('An unknown error occurred');
    });

    it('should handle MySQL error format', () => {
      const error = {
        code: 'ER_DUP_ENTRY',
        message: "Duplicate entry 'test@example.com' for key 'email'",
        sqlMessage: "Duplicate entry 'test@example.com' for key 'email'",
      };
      const result = getErrorMessage(error);
      expect(result).toBe("Duplicate entry 'test@example.com' for key 'email'");
    });

    it('should handle empty object', () => {
      const error = {};
      const result = getErrorMessage(error);
      expect(result).toBe('An unknown error occurred');
    });

    it('should handle array error', () => {
      const error = ['Error 1', 'Error 2'];
      const result = getErrorMessage(error);
      expect(result).toBe('An unknown error occurred');
    });

    it('should handle boolean error', () => {
      const error = false;
      const result = getErrorMessage(error);
      expect(result).toBe('An unknown error occurred');
    });

    it('should handle Error with empty message', () => {
      const error = new Error('');
      const result = getErrorMessage(error);
      expect(result).toBe('');
    });

    it('should NOT trim whitespace from error messages', () => {
      const error = new Error('  Whitespace error  ');
      const result = getErrorMessage(error);
      expect(result).toBe('  Whitespace error  ');
    });
  });
});

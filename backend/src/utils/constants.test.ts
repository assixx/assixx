/**
 * Constants Test File
 *
 * Basic test to verify Vitest is working correctly.
 */

import { describe, it, expect } from 'vitest';
import { ROLES, HTTP_STATUS, UPLOAD, PAGINATION, TOKEN } from './constants.js';

describe('Application Constants', () => {
  describe('ROLES', () => {
    it('should have correct role values', () => {
      expect(ROLES.ROOT).toBe('root');
      expect(ROLES.ADMIN).toBe('admin');
      expect(ROLES.EMPLOYEE).toBe('employee');
    });

    it('should have exactly 3 roles', () => {
      expect(Object.keys(ROLES)).toHaveLength(3);
    });
  });

  describe('HTTP_STATUS', () => {
    it('should have correct success status codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
    });

    it('should have correct client error status codes', () => {
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.CONFLICT).toBe(409);
    });

    it('should have correct server error status code', () => {
      expect(HTTP_STATUS.SERVER_ERROR).toBe(500);
    });
  });

  describe('UPLOAD', () => {
    it('should have max file size of 10MB', () => {
      expect(UPLOAD.MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });

    it('should allow jpeg, png, and gif images', () => {
      expect(UPLOAD.ALLOWED_IMAGE_TYPES).toContain('image/jpeg');
      expect(UPLOAD.ALLOWED_IMAGE_TYPES).toContain('image/png');
      expect(UPLOAD.ALLOWED_IMAGE_TYPES).toContain('image/gif');
    });
  });

  describe('PAGINATION', () => {
    it('should have sensible default values', () => {
      expect(PAGINATION.DEFAULT_PAGE).toBe(1);
      expect(PAGINATION.DEFAULT_LIMIT).toBe(10);
      expect(PAGINATION.MAX_LIMIT).toBe(100);
    });

    it('should have max limit greater than default', () => {
      expect(PAGINATION.MAX_LIMIT).toBeGreaterThan(PAGINATION.DEFAULT_LIMIT);
    });
  });

  describe('TOKEN', () => {
    it('should have token expiration settings', () => {
      expect(TOKEN.EXPIRES_IN).toBe('24h');
      expect(TOKEN.REFRESH_EXPIRES_IN).toBe('7d');
    });
  });
});

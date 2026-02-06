/**
 * Unit tests for ActivityLoggerService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Fire-and-forget behavior (never throws),
 *        convenience methods (logCreate, logUpdate, logDelete),
 *        JSON serialization of old/new values.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../../database/database.service.js';
import { ActivityLoggerService } from './activity-logger.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

// =============================================================
// ActivityLoggerService
// =============================================================

describe('ActivityLoggerService', () => {
  let service: ActivityLoggerService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new ActivityLoggerService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // log
  // =============================================================

  describe('log', () => {
    it('should insert activity log entry', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.log({
        tenantId: 10,
        userId: 5,
        action: 'create',
        entityType: 'user',
        entityId: 42,
        details: 'User created',
      });

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[0]).toBe(10); // tenantId
      expect(params?.[1]).toBe(5); // userId
      expect(params?.[2]).toBe('create'); // action
    });

    it('should serialize oldValues and newValues as JSON', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.log({
        tenantId: 10,
        userId: 5,
        action: 'update',
        entityType: 'machine',
        oldValues: { status: 'operational' },
        newValues: { status: 'maintenance' },
      });

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[6]).toBe('{"status":"operational"}');
      expect(params?.[7]).toBe('{"status":"maintenance"}');
    });

    it('should never throw on DB error', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB down'));

      // Should NOT throw
      await service.log({
        tenantId: 10,
        userId: 5,
        action: 'create',
        entityType: 'user',
      });

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should use null for optional params', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.log({
        tenantId: 10,
        userId: 5,
        action: 'login',
        entityType: 'auth',
      });

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[4]).toBeNull(); // entityId
      expect(params?.[5]).toBeNull(); // details
      expect(params?.[6]).toBeNull(); // oldValues
      expect(params?.[7]).toBeNull(); // newValues
    });
  });

  // =============================================================
  // logCreate
  // =============================================================

  describe('logCreate', () => {
    it('should delegate to log with create action', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.logCreate(10, 5, 'document', 42, 'Doc created', {
        name: 'invoice.pdf',
      });

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[2]).toBe('create');
      expect(params?.[3]).toBe('document');
    });
  });

  // =============================================================
  // logUpdate
  // =============================================================

  describe('logUpdate', () => {
    it('should delegate to log with update action', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.logUpdate(10, 5, 'machine', 1, 'Status changed');

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[2]).toBe('update');
    });
  });

  // =============================================================
  // logDelete
  // =============================================================

  describe('logDelete', () => {
    it('should delegate to log with delete action', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.logDelete(10, 5, 'user', 42, 'User deleted');

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[2]).toBe('delete');
    });
  });
});

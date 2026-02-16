/**
 * Unit tests for ActivityLoggerService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Fire-and-forget behavior (never throws),
 *        convenience methods (logCreate, logUpdate, logDelete),
 *        JSON serialization of old/new values,
 *        resolveUserContext denormalization.
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

/** Mock row returned by resolveUserContext SELECT */
const MOCK_USER_CONTEXT_ROW = {
  username: 'testuser',
  role: 'admin',
  employee_number: 'EMP-001',
  first_name: 'Test',
  last_name: 'User',
  department_name: 'Engineering',
  area_name: 'West',
  team_name: 'Alpha',
};

/**
 * Setup mock for both queries: resolveUserContext SELECT + INSERT.
 * Call 0 = SELECT (resolveUserContext), Call 1 = INSERT.
 */
function setupLogMocks(mockDb: ReturnType<typeof createMockDb>): void {
  mockDb.query.mockResolvedValueOnce([MOCK_USER_CONTEXT_ROW]); // resolveUserContext
  mockDb.query.mockResolvedValueOnce([]); // INSERT
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
    it('should call resolveUserContext then INSERT with 19 params', async () => {
      setupLogMocks(mockDb);

      await service.log({
        tenantId: 10,
        userId: 5,
        action: 'create',
        entityType: 'user',
        entityId: 42,
        details: 'User created',
      });

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      // Call 0 = resolveUserContext SELECT
      const selectSql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(selectSql).toContain('SELECT u.username');
      // Call 1 = INSERT with 19 params
      const insertParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(insertParams).toHaveLength(19);
      expect(insertParams?.[0]).toBe(10); // tenantId
      expect(insertParams?.[1]).toBe(5); // userId
      expect(insertParams?.[2]).toBe('create'); // action
      // Denormalized context from resolveUserContext
      expect(insertParams?.[11]).toBe('testuser'); // user_name
      expect(insertParams?.[12]).toBe('admin'); // user_role
      expect(insertParams?.[13]).toBe('EMP-001'); // employee_number
      expect(insertParams?.[14]).toBe('Test'); // first_name
      expect(insertParams?.[15]).toBe('User'); // last_name
      expect(insertParams?.[16]).toBe('Engineering'); // department_name
      expect(insertParams?.[17]).toBe('West'); // area_name
      expect(insertParams?.[18]).toBe('Alpha'); // team_name
    });

    it('should serialize oldValues and newValues as JSON', async () => {
      setupLogMocks(mockDb);

      await service.log({
        tenantId: 10,
        userId: 5,
        action: 'update',
        entityType: 'machine',
        oldValues: { status: 'operational' },
        newValues: { status: 'maintenance' },
      });

      const insertParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(insertParams?.[6]).toBe('{"status":"operational"}');
      expect(insertParams?.[7]).toBe('{"status":"maintenance"}');
    });

    it('should never throw on DB error', async () => {
      // resolveUserContext SELECT fails → catches, returns NULL_CONTEXT
      mockDb.query.mockRejectedValueOnce(new Error('DB down'));
      // INSERT still runs with null context
      mockDb.query.mockResolvedValueOnce([]);

      // Should NOT throw
      await service.log({
        tenantId: 10,
        userId: 5,
        action: 'create',
        entityType: 'user',
      });

      // 2 calls: failed SELECT + INSERT
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      // INSERT uses NULL_CONTEXT values
      const insertParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(insertParams?.[11]).toBeNull(); // user_name = null (failed lookup)
      expect(insertParams?.[12]).toBeNull(); // user_role = null
    });

    it('should use null for optional params', async () => {
      setupLogMocks(mockDb);

      await service.log({
        tenantId: 10,
        userId: 5,
        action: 'login',
        entityType: 'auth',
      });

      const insertParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(insertParams?.[4]).toBeNull(); // entityId
      expect(insertParams?.[5]).toBeNull(); // details
      expect(insertParams?.[6]).toBeNull(); // oldValues
      expect(insertParams?.[7]).toBeNull(); // newValues
    });
  });

  // =============================================================
  // logCreate
  // =============================================================

  describe('logCreate', () => {
    it('should delegate to log with create action', async () => {
      setupLogMocks(mockDb);

      await service.logCreate(10, 5, 'document', 42, 'Doc created', {
        name: 'invoice.pdf',
      });

      const insertParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(insertParams?.[2]).toBe('create');
      expect(insertParams?.[3]).toBe('document');
    });
  });

  // =============================================================
  // logUpdate
  // =============================================================

  describe('logUpdate', () => {
    it('should delegate to log with update action', async () => {
      setupLogMocks(mockDb);

      await service.logUpdate(10, 5, 'machine', 1, 'Status changed');

      const insertParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(insertParams?.[2]).toBe('update');
    });
  });

  // =============================================================
  // logDelete
  // =============================================================

  describe('logDelete', () => {
    it('should delegate to log with delete action', async () => {
      setupLogMocks(mockDb);

      await service.logDelete(10, 5, 'user', 42, 'User deleted');

      const insertParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(insertParams?.[2]).toBe('delete');
    });
  });
});

/**
 * Work Orders Assignees Service — Unit Tests
 *
 * Mocked dependencies: DatabaseService (query, tenantTransaction),
 * ActivityLoggerService (logCreate, logDelete).
 *
 * Tests: assignUsers (happy path, max limit exceeded, WO not found),
 * removeAssignee (happy path, not found, WO not found),
 * getAssignees (mapped array, empty array),
 * getEligibleUsers (with assetId team-filtered, without assetId all employees).
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { WorkOrderAssigneesService } from './work-orders-assignees.service.js';
import type { WorkOrderAssigneeWithNameRow } from './work-orders.types.js';

// ============================================================================
// Mock uuid
// ============================================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('00000000-0000-7000-0000-000000000001'),
}));

// ============================================================================
// Mock factories
// ============================================================================

function createMockDb() {
  return {
    query: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
  };
}

function createAssigneeDbRow(
  overrides: Partial<WorkOrderAssigneeWithNameRow> = {},
): WorkOrderAssigneeWithNameRow {
  return {
    id: 10,
    uuid: '019c9547-bbbb-771a-b022-222222222222',
    tenant_id: 1,
    work_order_id: 1,
    user_id: 42,
    assigned_at: '2026-03-01T09:00:00.000Z',
    assigned_by: 5,
    first_name: 'Anna',
    last_name: 'Schmidt',
    ...overrides,
  };
}

// ============================================================================
// WorkOrderAssigneesService
// ============================================================================

describe('WorkOrderAssigneesService', () => {
  let service: WorkOrderAssigneesService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    mockActivityLogger = createMockActivityLogger();

    mockDb.tenantTransaction.mockImplementation(
      async (
        callback: (client: typeof mockClient) => Promise<unknown>,
      ): Promise<unknown> => await callback(mockClient),
    );

    service = new WorkOrderAssigneesService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // ==========================================================================
  // assignUsers
  // ==========================================================================

  describe('assignUsers()', () => {
    it('should assign users and return mapped assignees', async () => {
      // resolveWorkOrder
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Ölwechsel' }],
      });
      // countAssignees
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '2' }],
      });
      // insertAssignees — one user
      mockClient.query.mockResolvedValueOnce({
        rows: [createAssigneeDbRow()],
      });

      const result = await service.assignUsers(
        1,
        'wo-uuid-001',
        ['user-uuid-a'],
        5,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.uuid).toBe('019c9547-bbbb-771a-b022-222222222222');
      expect(result[0]?.userId).toBe(42);
      expect(result[0]?.userName).toBe('Anna Schmidt');
      expect(result[0]?.assignedAt).toBe('2026-03-01T09:00:00.000Z');
      expect(mockActivityLogger.logCreate).toHaveBeenCalledOnce();
    });

    it('should assign multiple users in sequence', async () => {
      // resolveWorkOrder
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Wartung' }],
      });
      // countAssignees
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });
      // insertAssignees — two users
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createAssigneeDbRow({
            user_id: 42,
            first_name: 'Anna',
            last_name: 'Schmidt',
          }),
        ],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createAssigneeDbRow({
            id: 11,
            user_id: 43,
            first_name: 'Bob',
            last_name: 'Weber',
          }),
        ],
      });

      const result = await service.assignUsers(
        1,
        'wo-uuid-001',
        ['user-uuid-a', 'user-uuid-b'],
        5,
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.userName).toBe('Anna Schmidt');
      expect(result[1]?.userName).toBe('Bob Weber');
    });

    it('should skip duplicates when ON CONFLICT DO NOTHING returns no rows', async () => {
      // resolveWorkOrder
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Wartung' }],
      });
      // countAssignees
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });
      // insertAssignees — duplicate returns empty rows
      mockClient.query.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.assignUsers(
        1,
        'wo-uuid-001',
        ['dup-user'],
        5,
      );

      expect(result).toHaveLength(0);
    });

    it('should throw BadRequestException when max assignees exceeded', async () => {
      // resolveWorkOrder
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Überlauf' }],
      });
      // countAssignees — already 9 assigned
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '9' }],
      });

      await expect(
        service.assignUsers(1, 'wo-uuid-001', ['user-1', 'user-2'], 5),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with correct message at exact boundary', async () => {
      // resolveWorkOrder
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Grenzfall' }],
      });
      // countAssignees — exactly 10 already
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '10' }],
      });

      await expect(
        service.assignUsers(1, 'wo-uuid-001', ['one-more'], 5),
      ).rejects.toThrow('Maximal 10 Zuweisungen pro Auftrag');
    });

    it('should throw NotFoundException when work order not found', async () => {
      // resolveWorkOrder — no rows
      mockClient.query.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        service.assignUsers(1, 'nonexistent-uuid', ['user-uuid-a'], 5),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // removeAssignee
  // ==========================================================================

  describe('removeAssignee()', () => {
    it('should remove assignee and log deletion', async () => {
      // resolveWorkOrder
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Wartung' }],
      });
      // DELETE query — 1 row removed
      mockClient.query.mockResolvedValueOnce({
        rowCount: 1,
      });

      await service.removeAssignee(1, 'wo-uuid-001', 'user-uuid-a', 5);

      expect(mockActivityLogger.logDelete).toHaveBeenCalledExactlyOnceWith(
        1,
        5,
        'work_order',
        1,
        'Benutzer-Zuweisung von "Wartung" entfernt',
        { userUuid: 'user-uuid-a' },
      );
    });

    it('should throw NotFoundException when assignee not found', async () => {
      // resolveWorkOrder
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Wartung' }],
      });
      // DELETE query — 0 rows removed
      mockClient.query.mockResolvedValueOnce({
        rowCount: 0,
      });

      await expect(
        service.removeAssignee(1, 'wo-uuid-001', 'ghost-uuid', 5),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with correct message when assignee missing', async () => {
      // resolveWorkOrder
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Test' }],
      });
      // DELETE — no match
      mockClient.query.mockResolvedValueOnce({
        rowCount: 0,
      });

      await expect(
        service.removeAssignee(1, 'wo-uuid-001', 'missing', 5),
      ).rejects.toThrow('Zuweisung nicht gefunden');
    });

    it('should throw NotFoundException when work order not found', async () => {
      // resolveWorkOrder — no rows
      mockClient.query.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        service.removeAssignee(1, 'nonexistent-uuid', 'user-uuid-a', 5),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // getAssignees
  // ==========================================================================

  describe('getAssignees()', () => {
    it('should return mapped assignees array', async () => {
      mockDb.query.mockResolvedValueOnce([
        createAssigneeDbRow(),
        createAssigneeDbRow({
          id: 11,
          uuid: '019c9547-cccc-771a-b022-333333333333',
          user_id: 43,
          first_name: 'Bob',
          last_name: 'Weber',
          assigned_at: '2026-03-02T10:00:00.000Z',
        }),
      ]);

      const result = await service.getAssignees(1, 'wo-uuid-001');

      expect(result).toHaveLength(2);
      expect(result[0]?.uuid).toBe('019c9547-bbbb-771a-b022-222222222222');
      expect(result[0]?.userId).toBe(42);
      expect(result[0]?.userName).toBe('Anna Schmidt');
      expect(result[1]?.uuid).toBe('019c9547-cccc-771a-b022-333333333333');
      expect(result[1]?.userId).toBe(43);
      expect(result[1]?.userName).toBe('Bob Weber');
    });

    it('should return empty array when no assignees exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAssignees(1, 'wo-uuid-001');

      expect(result).toEqual([]);
    });

    it('should pass correct parameters to db.query', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getAssignees(42, 'specific-wo-uuid');

      expect(mockDb.query).toHaveBeenCalledExactlyOnceWith(expect.any(String), [
        'specific-wo-uuid',
        42,
      ]);
    });
  });

  // ==========================================================================
  // getEligibleUsers
  // ==========================================================================

  describe('getEligibleUsers()', () => {
    const teamFilteredRow = {
      id: 42,
      uuid: '019c9547-eeee-771a-b022-444444444444',
      first_name: 'Anna',
      last_name: 'Schmidt',
      email: 'anna@example.com',
      employee_number: 'EMP-001',
    };

    const allEmployeeRow = {
      id: 43,
      uuid: '019c9547-ffff-771a-b022-555555555555',
      first_name: 'Bob',
      last_name: 'Weber',
      email: 'bob@example.com',
      employee_number: null,
    };

    it('should return team-filtered users when assetId is provided', async () => {
      mockDb.query.mockResolvedValueOnce([teamFilteredRow]);

      const result = await service.getEligibleUsers(1, 99);

      expect(result).toHaveLength(1);
      expect(result[0]?.uuid).toBe('019c9547-eeee-771a-b022-444444444444');
      expect(result[0]?.firstName).toBe('Anna');
      expect(result[0]?.lastName).toBe('Schmidt');
      expect(result[0]?.email).toBe('anna@example.com');
      expect(result[0]?.employeeNumber).toBe('EMP-001');
    });

    it('should pass assetId and tenantId to team-filtered query', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getEligibleUsers(1, 99);

      expect(mockDb.query).toHaveBeenCalledExactlyOnceWith(
        expect.any(String),
        [99, 1],
      );
    });

    it('should return all employees when assetId is undefined', async () => {
      mockDb.query.mockResolvedValueOnce([allEmployeeRow]);

      const result = await service.getEligibleUsers(1);

      expect(result).toHaveLength(1);
      expect(result[0]?.uuid).toBe('019c9547-ffff-771a-b022-555555555555');
      expect(result[0]?.firstName).toBe('Bob');
      expect(result[0]?.lastName).toBe('Weber');
      expect(result[0]?.email).toBe('bob@example.com');
      expect(result[0]?.employeeNumber).toBeNull();
    });

    it('should pass only tenantId to all-employees query', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getEligibleUsers(7);

      expect(mockDb.query).toHaveBeenCalledExactlyOnceWith(
        expect.any(String),
        [7],
      );
    });

    it('should return empty array when no eligible users exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getEligibleUsers(1, 99);

      expect(result).toEqual([]);
    });

    it('should trim uuid whitespace in returned users', async () => {
      mockDb.query.mockResolvedValueOnce([
        { ...teamFilteredRow, uuid: '  spaced-uuid  ' },
      ]);

      const result = await service.getEligibleUsers(1, 99);

      expect(result[0]?.uuid).toBe('spaced-uuid');
    });
  });
});

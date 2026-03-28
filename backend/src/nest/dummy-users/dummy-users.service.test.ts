/**
 * Dummy Users Service — Unit Tests
 *
 * Tests: CRUD operations, auto-generation, permission assignment, edge cases.
 * Pattern: ADR-018 — Mock DatabaseService + ActivityLoggerService.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { DummyUsersService } from './dummy-users.service.js';
import type { DummyUserWithTeamsRow } from './dummy-users.types.js';
import { DUMMY_PERMISSIONS } from './dummy-users.types.js';

// =============================================================
// Mocks
// =============================================================

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('$2a$12$HASHED') },
}));

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('019c9999-0000-7000-8000-000000000001'),
}));

function createMockDb() {
  return { query: vi.fn() };
}
type MockDb = ReturnType<typeof createMockDb>;

const mockActivityLogger = {
  log: vi.fn().mockResolvedValue(undefined),
};

/** Creates a valid DummyUserWithTeamsRow for mocking getByUuid results */
function createDummyRow(overrides: Partial<DummyUserWithTeamsRow> = {}): DummyUserWithTeamsRow {
  return {
    id: 42,
    uuid: '019c9999-0000-7000-8000-000000000001',
    tenant_id: 10,
    email: 'dummy_1@testfirma.display',
    display_name: 'Halle 1 Display',
    employee_number: 'DUMMY-001',
    role: 'dummy',
    is_active: IS_ACTIVE.ACTIVE,
    has_full_access: false,
    created_at: '2026-03-03T10:00:00.000Z',
    updated_at: '2026-03-03T10:00:00.000Z',
    team_ids: null,
    team_names: null,
    department_ids: null,
    department_names: null,
    area_ids: null,
    area_names: null,
    ...overrides,
  };
}

// =============================================================
// Test Suite
// =============================================================

describe('DummyUsersService', () => {
  let service: DummyUsersService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();

    service = new DummyUsersService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =========================================================
  // CREATE
  // =========================================================

  describe('create', () => {
    function setupCreateMocks(
      overrides: { nextEmailNum?: number; nextEmpNum?: number } = {},
    ): void {
      const { nextEmailNum = 1, nextEmpNum = 1 } = overrides;
      // 1. generateEmail → next number query
      mockDb.query.mockResolvedValueOnce([{ next_number: nextEmailNum }]);
      // 2. generateEmail → tenant subdomain query
      mockDb.query.mockResolvedValueOnce([{ subdomain: 'testfirma' }]);
      // 3. generateEmployeeNumber → next number query
      mockDb.query.mockResolvedValueOnce([{ next_number: nextEmpNum }]);
      // 4. INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      // 5. assignDefaultPermissions → 6 × INSERT (ON CONFLICT DO NOTHING)
      for (let i = 0; i < DUMMY_PERMISSIONS.length; i++) {
        mockDb.query.mockResolvedValueOnce([]);
      }
      // 6. activityLogger.log (already mocked)
      // 7. getByUuid → SELECT
      mockDb.query.mockResolvedValueOnce([createDummyRow()]);
    }

    it('should create dummy with auto-generated email and employee number', async () => {
      setupCreateMocks();

      const result = await service.create(
        10,
        { displayName: 'Halle 1 Display', password: 'SuperSicher123!' },
        1,
      );

      expect(result.uuid).toBe('019c9999-0000-7000-8000-000000000001');
      expect(result.displayName).toBe('Halle 1 Display');
      expect(result.email).toBe('dummy_1@testfirma.display');
      expect(result.employeeNumber).toBe('DUMMY-001');
    });

    it('should hash password with bcrypt', async () => {
      setupCreateMocks();

      await service.create(10, { displayName: 'Test', password: 'SuperSicher123!' }, 1);

      // INSERT query (4th call) should contain the hashed password
      const insertParams = mockDb.query.mock.calls[3]?.[1] as unknown[];
      expect(insertParams[3]).toBe('$2a$12$HASHED');
    });

    it('should use sequential email numbering', async () => {
      setupCreateMocks({ nextEmailNum: 5, nextEmpNum: 5 });

      const result = await service.create(
        10,
        { displayName: 'Display 5', password: 'SuperSicher123!' },
        1,
      );

      expect(result.email).toContain('dummy_');
    });

    it('should assign 6 read-only permissions', async () => {
      setupCreateMocks();

      await service.create(10, { displayName: 'Test', password: 'SuperSicher123!' }, 1);

      // Permission INSERTs are calls 4 (insert user) + 1..6 = calls index 4..9
      const permCalls = mockDb.query.mock.calls.slice(4, 10);
      expect(permCalls).toHaveLength(DUMMY_PERMISSIONS.length);

      // Verify each permission call has correct structure
      for (const call of permCalls) {
        const sql = call[0] as string;
        expect(sql).toContain('user_addon_permissions');
        expect(sql).toContain('can_read, can_write, can_delete');
        expect(sql).toContain('true, false, false');
        expect(sql).toContain('ON CONFLICT');
      }
    });

    it('should sync teams when teamIds provided', async () => {
      setupCreateMocks();
      // Add mocks for syncTeams: DELETE + 2 × INSERT
      mockDb.query.mockResolvedValueOnce([]); // DELETE existing
      mockDb.query.mockResolvedValueOnce([]); // INSERT team 1
      mockDb.query.mockResolvedValueOnce([]); // INSERT team 2
      // Re-add getByUuid mock (it will be called after teams)
      // Actually the getByUuid was already set up in setupCreateMocks
      // But syncTeams happens before getByUuid, so we need to adjust

      // Reset and set up properly
      vi.clearAllMocks();
      mockDb = createMockDb();
      service = new DummyUsersService(
        mockDb as unknown as DatabaseService,
        mockActivityLogger as unknown as ActivityLoggerService,
      );

      // 1-3: email/employee generation
      mockDb.query.mockResolvedValueOnce([{ next_number: 1 }]);
      mockDb.query.mockResolvedValueOnce([{ subdomain: 'testfirma' }]);
      mockDb.query.mockResolvedValueOnce([{ next_number: 1 }]);
      // 4: INSERT user
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      // 5: syncTeams DELETE
      mockDb.query.mockResolvedValueOnce([]);
      // 6-7: syncTeams INSERT × 2
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);
      // 8-13: permissions × 6
      for (let i = 0; i < DUMMY_PERMISSIONS.length; i++) {
        mockDb.query.mockResolvedValueOnce([]);
      }
      // 14: getByUuid
      mockDb.query.mockResolvedValueOnce([createDummyRow({ team_ids: '1,2', team_names: 'A,B' })]);

      const result = await service.create(
        10,
        {
          displayName: 'Test',
          password: 'SuperSicher123!',
          teamIds: [1, 2],
        },
        1,
      );

      expect(result.teamIds).toEqual([1, 2]);
    });

    it('should log activity after creation', async () => {
      setupCreateMocks();

      await service.create(10, { displayName: 'Halle 1 Display', password: 'SuperSicher123!' }, 1);

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 10,
          userId: 1,
          action: 'create',
          entityType: 'dummy_user',
          entityId: 42,
        }),
      );
    });

    it('should throw when tenant not found', async () => {
      mockDb.query.mockResolvedValueOnce([{ next_number: 1 }]);
      mockDb.query.mockResolvedValueOnce([]); // No tenant row

      await expect(
        service.create(999, { displayName: 'Test', password: 'SuperSicher123!' }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================
  // LIST
  // =========================================================

  describe('list', () => {
    it('should return paginated results', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '2' }]);
      mockDb.query.mockResolvedValueOnce([
        createDummyRow({ display_name: 'Display A' }),
        createDummyRow({
          id: 43,
          uuid: '019c9999-0000-7000-8000-000000000002',
          display_name: 'Display B',
        }),
      ]);

      const result = await service.list(10, {});

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.items).toHaveLength(2);
    });

    it('should use default page=1 and limit=20', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.list(10, {});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      // Verify LIMIT and OFFSET params
      const dataParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(dataParams).toContain(20); // limit
      expect(dataParams).toContain(0); // offset
    });

    it('should calculate offset from page and limit', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '50' }]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.list(10, { page: 3, limit: 10 });

      const dataParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(dataParams).toContain(10); // limit
      expect(dataParams).toContain(20); // offset = (3-1)*10
    });

    it('should filter by isActive when provided', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);
      mockDb.query.mockResolvedValueOnce([createDummyRow()]);

      await service.list(10, { isActive: 1 });

      const countSql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(countSql).toContain('u.is_active = $');
    });

    it('should exclude soft-deleted by default', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.list(10, {});

      const countSql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(countSql).toContain(`u.is_active != ${IS_ACTIVE.DELETED}`);
    });

    it('should filter by search term', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);
      mockDb.query.mockResolvedValueOnce([createDummyRow()]);

      await service.list(10, { search: 'Halle' });

      const countSql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(countSql).toContain('ILIKE');
      const countParams = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(countParams).toContain('%Halle%');
    });

    it('should always filter by role=dummy', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.list(10, {});

      const countSql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(countSql).toContain("u.role = 'dummy'");
    });

    it('should handle zero count gracefully', async () => {
      mockDb.query.mockResolvedValueOnce([]); // No count row
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.list(10, {});

      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  // =========================================================
  // GET BY UUID
  // =========================================================

  describe('getByUuid', () => {
    it('should return dummy user by UUID', async () => {
      mockDb.query.mockResolvedValueOnce([createDummyRow()]);

      const result = await service.getByUuid(10, DUMMY_UUID);

      expect(result.uuid).toBe(DUMMY_UUID);
      expect(result.displayName).toBe('Halle 1 Display');
    });

    it('should throw NotFoundException when not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getByUuid(10, 'non-existent-uuid')).rejects.toThrow(NotFoundException);
    });

    it('should query with tenant_id and role=dummy', async () => {
      mockDb.query.mockResolvedValueOnce([createDummyRow()]);

      await service.getByUuid(10, DUMMY_UUID);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain("u.role = 'dummy'");
      expect(sql).toContain('u.tenant_id = $1');
      expect(sql).toContain(`u.is_active != ${IS_ACTIVE.DELETED}`);
    });
  });

  // =========================================================
  // UPDATE
  // =========================================================

  describe('update', () => {
    function setupUpdateMocks(): void {
      // 1: Verify exists
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      // 2: UPDATE
      mockDb.query.mockResolvedValueOnce([]);
      // 3: getByUuid (after update)
      mockDb.query.mockResolvedValueOnce([createDummyRow({ display_name: 'Neuer Name' })]);
    }

    it('should update displayName', async () => {
      setupUpdateMocks();

      const result = await service.update(10, DUMMY_UUID, { displayName: 'Neuer Name' }, 1);

      expect(result.displayName).toBe('Neuer Name');
    });

    it('should throw NotFoundException when dummy not found', async () => {
      mockDb.query.mockResolvedValueOnce([]); // Not found

      await expect(service.update(10, 'non-existent', { displayName: 'Test' }, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should build dynamic SET clause with display_name', async () => {
      setupUpdateMocks();

      await service.update(10, DUMMY_UUID, { displayName: 'Updated' }, 1);

      const updateSql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('display_name = $');
      expect(updateSql).toContain('updated_at = NOW()');
    });

    it('should hash password on update', async () => {
      setupUpdateMocks();

      await service.update(10, DUMMY_UUID, { password: 'NewPassword123!' }, 1);

      const updateParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(updateParams).toContain('$2a$12$HASHED');
    });

    it('should sync teams when teamIds provided', async () => {
      // 1: Verify exists
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      // 2: UPDATE
      mockDb.query.mockResolvedValueOnce([]);
      // 3: DELETE existing teams
      mockDb.query.mockResolvedValueOnce([]);
      // 4: INSERT team
      mockDb.query.mockResolvedValueOnce([]);
      // 5: getByUuid
      mockDb.query.mockResolvedValueOnce([createDummyRow({ team_ids: '5', team_names: 'TeamA' })]);

      const result = await service.update(10, DUMMY_UUID, { teamIds: [5] }, 1);

      expect(result.teamIds).toEqual([5]);
    });

    it('should log activity after update', async () => {
      setupUpdateMocks();

      await service.update(10, DUMMY_UUID, { displayName: 'Updated' }, 1);

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 10,
          userId: 1,
          action: 'update',
          entityType: 'dummy_user',
          entityId: 42,
        }),
      );
    });
  });

  // =========================================================
  // DELETE (soft-delete)
  // =========================================================

  describe('delete', () => {
    it('should soft-delete successfully', async () => {
      // UPDATE returns non-empty (affected row)
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      await expect(service.delete(10, DUMMY_UUID, 1)).resolves.toBeUndefined();
    });

    it('should log activity after delete', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      await service.delete(10, DUMMY_UUID, 1);

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 10,
          userId: 1,
          action: 'delete',
          entityType: 'dummy_user',
        }),
      );
    });

    it('should throw NotFoundException when dummy not found', async () => {
      // UPDATE returns empty (no match)
      mockDb.query.mockResolvedValueOnce([]);
      // Check query also returns empty
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.delete(10, 'non-existent', 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when already deleted', async () => {
      // UPDATE returns empty (no match — already is_active=4)
      mockDb.query.mockResolvedValueOnce([]);
      // Check query finds it (exists but is_active=4)
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      await expect(service.delete(10, DUMMY_UUID, 1)).rejects.toThrow(BadRequestException);
    });

    it(`should set is_active = ${IS_ACTIVE.DELETED} in SQL`, async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      await service.delete(10, DUMMY_UUID, 1);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain(`is_active = ${IS_ACTIVE.DELETED}`);
      expect(sql).toContain("role = 'dummy'");
    });
  });
});

// =============================================================
// Test Constants
// =============================================================

const DUMMY_UUID = '019c9999-0000-7000-8000-000000000001';

/**
 * Unit tests for AuditTrailService
 *
 * Phase 9: Service tests — mocked DatabaseService + UserRepository.
 * Focus: row mapper, CSV generation, access control, pagination math,
 *        report summary, stats transformation, WHERE clause builders.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NestAuthUser } from '../common/index.js';
import type { DatabaseService } from '../database/database.service.js';
import type { UserRepository } from '../database/index.js';
import { AuditTrailService } from './audit-trail.service.js';
import type { AuditEntryResponse } from './dto/index.js';

// =============================================================
// Mocks
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockUserRepo() {
  return { getPasswordHash: vi.fn() };
}

function createRootUser(overrides?: Partial<NestAuthUser>): NestAuthUser {
  return {
    id: 1,
    email: 'root@test.com',
    role: 'root',
    activeRole: 'root',
    isRoleSwitched: false,
    tenantId: 42,
    ...overrides,
  };
}

function createAdminUser(overrides?: Partial<NestAuthUser>): NestAuthUser {
  return {
    id: 2,
    email: 'admin@test.com',
    role: 'admin',
    activeRole: 'admin',
    isRoleSwitched: false,
    tenantId: 42,
    ...overrides,
  };
}

function createEmployeeUser(overrides?: Partial<NestAuthUser>): NestAuthUser {
  return {
    id: 3,
    email: 'emp@test.com',
    role: 'employee',
    activeRole: 'employee',
    isRoleSwitched: false,
    tenantId: 42,
    ...overrides,
  };
}

/** Minimal DB row with all fields populated */
function createDbRow(overrides?: Record<string, unknown>) {
  return {
    id: 100,
    tenant_id: 42,
    user_id: 1,
    user_name: 'John Doe',
    user_role: 'admin',
    action: 'update',
    resource_type: 'document',
    resource_id: 5,
    resource_name: 'Report.pdf',
    changes: '{"title":"new"}',
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0',
    status: 'success' as const,
    error_message: null,
    created_at: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

// =============================================================
// AuditTrailService
// =============================================================

describe('AuditTrailService', () => {
  let service: AuditTrailService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockUserRepo: ReturnType<typeof createMockUserRepo>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockUserRepo = createMockUserRepo();
    service = new AuditTrailService(
      mockDb as unknown as DatabaseService,
      mockUserRepo as unknown as UserRepository,
    );
  });

  // =============================================================
  // generateCSV (pure function, no mocks needed)
  // =============================================================

  describe('generateCSV', () => {
    it('should generate CSV with header and quoted data rows', () => {
      const entries: AuditEntryResponse[] = [
        {
          id: 1,
          tenantId: 42,
          userId: 10,
          userName: 'Alice',
          userRole: 'admin',
          action: 'create',
          resourceType: 'document',
          resourceName: 'File.pdf',
          status: 'success',
          ipAddress: '10.0.0.1',
          createdAt: '2026-01-15T10:00:00.000Z',
        },
      ];

      const csv = service.generateCSV(entries);
      const lines = csv.split('\n');

      expect(lines[0]).toBe(
        'ID,Date/Time,User,Role,Action,Resource Type,Resource,Status,IP Address',
      );
      expect(lines[1]).toBe(
        '"1","2026-01-15T10:00:00.000Z","Alice","admin","create","document","File.pdf","success","10.0.0.1"',
      );
    });

    it('should return only header for empty entries', () => {
      const csv = service.generateCSV([]);

      expect(csv).toBe('ID,Date/Time,User,Role,Action,Resource Type,Resource,Status,IP Address');
    });

    it('should use userId when userName is missing', () => {
      const entries: AuditEntryResponse[] = [
        {
          id: 1,
          tenantId: 42,
          userId: 99,
          action: 'read',
          resourceType: 'user',
          status: 'success',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      const csv = service.generateCSV(entries);
      const dataRow = csv.split('\n')[1] ?? '';

      // userName undefined → falls back to userId (99)
      expect(dataRow).toContain('"99"');
      // userRole undefined → empty string
      expect(dataRow).toContain('""');
    });
  });

  // =============================================================
  // getEntryById — row mapping + access control
  // =============================================================

  describe('getEntryById', () => {
    it('should map DB row with all optional fields', async () => {
      mockDb.query.mockResolvedValueOnce([createDbRow()]);

      const result = await service.getEntryById(createRootUser(), 100);

      expect(result).toEqual({
        id: 100,
        tenantId: 42,
        userId: 1,
        userName: 'John Doe',
        userRole: 'admin',
        action: 'update',
        resourceType: 'document',
        resourceId: 5,
        resourceName: 'Report.pdf',
        changes: { title: 'new' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'success',
        createdAt: '2026-01-15T10:00:00.000Z',
      });
    });

    it('should omit optional fields when null', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbRow({
          user_name: null,
          user_role: null,
          resource_id: null,
          resource_name: null,
          changes: null,
          ip_address: null,
          user_agent: null,
          error_message: null,
        }),
      ]);

      const result = await service.getEntryById(createRootUser(), 100);

      expect(result).not.toHaveProperty('userName');
      expect(result).not.toHaveProperty('userRole');
      expect(result).not.toHaveProperty('resourceId');
      expect(result).not.toHaveProperty('resourceName');
      expect(result).not.toHaveProperty('changes');
      expect(result).not.toHaveProperty('ipAddress');
      expect(result).not.toHaveProperty('userAgent');
      expect(result).not.toHaveProperty('errorMessage');
    });

    it('should handle Date object in created_at', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbRow({ created_at: new Date('2026-06-01T12:00:00Z') }),
      ]);

      const result = await service.getEntryById(createRootUser(), 100);

      expect(result.createdAt).toBe('2026-06-01T12:00:00.000Z');
    });

    it('should pass through string created_at unchanged', async () => {
      mockDb.query.mockResolvedValueOnce([createDbRow({ created_at: '2026-06-01T12:00:00Z' })]);

      const result = await service.getEntryById(createRootUser(), 100);

      expect(result.createdAt).toBe('2026-06-01T12:00:00Z');
    });

    it('should return undefined changes for invalid JSON', async () => {
      mockDb.query.mockResolvedValueOnce([createDbRow({ changes: 'not-valid-json{' })]);

      const result = await service.getEntryById(createRootUser(), 100);

      expect(result).not.toHaveProperty('changes');
    });

    it('should include errorMessage when present', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbRow({ error_message: 'Permission denied', status: 'failure' }),
      ]);

      const result = await service.getEntryById(createRootUser(), 100);

      expect(result.errorMessage).toBe('Permission denied');
      expect(result.status).toBe('failure');
    });

    it('should throw NotFoundException when no rows returned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getEntryById(createRootUser(), 999)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-root viewing other user entry', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbRow({ user_id: 99 }), // belongs to user 99
      ]);

      await expect(service.getEntryById(createEmployeeUser({ id: 3 }), 100)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow non-root to view own entry', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbRow({ user_id: 3 }), // belongs to requesting user
      ]);

      const result = await service.getEntryById(createEmployeeUser({ id: 3 }), 100);

      expect(result.userId).toBe(3);
    });
  });

  // =============================================================
  // getEntries — pagination, filtering, access control
  // =============================================================

  describe('getEntries', () => {
    it('should return entries with correct pagination', async () => {
      // Count query
      mockDb.query.mockResolvedValueOnce([{ total: 25 }]);
      // Entries query
      mockDb.query.mockResolvedValueOnce([createDbRow()]);

      const result = await service.getEntries(createRootUser(), {
        page: 2,
        limit: 10,
      });

      expect(result.pagination).toEqual({
        currentPage: 2,
        pageSize: 10,
        totalItems: 25,
        totalPages: 3,
      });
      expect(result.entries).toHaveLength(1);
    });

    it('should force own userId for non-root users', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: 0 }]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.getEntries(createEmployeeUser({ id: 3 }), {
        page: 1,
        limit: 10,
      });

      // The WHERE clause should include user_id filter
      const countSql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(countSql).toContain('user_id');
      const countParams = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(countParams).toContain(3);
    });

    it('should throw ForbiddenException when non-root requests other userId', async () => {
      await expect(
        service.getEntries(createEmployeeUser({ id: 3 }), {
          page: 1,
          limit: 10,
          userId: 99, // trying to view user 99's entries
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow root to filter by any userId', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: 0 }]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.getEntries(createRootUser(), {
        page: 1,
        limit: 10,
        userId: 99,
      });

      const countParams = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(countParams).toContain(99);
    });

    it('should build WHERE clause with search filter (ILIKE)', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: 0 }]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.getEntries(createRootUser(), {
        page: 1,
        limit: 10,
        search: 'test',
      });

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('ILIKE');
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain('%test%');
    });

    it('should pass all filter fields to WHERE clause', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: 0 }]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.getEntries(createRootUser(), {
        page: 1,
        limit: 10,
        action: 'create',
        resourceType: 'document',
        status: 'success',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      });

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('action');
      expect(sql).toContain('resource_type');
      expect(sql).toContain('status');
      expect(sql).toContain('created_at >=');
      expect(sql).toContain('created_at <=');
    });
  });

  // =============================================================
  // getStats — admin access + stats transformation
  // =============================================================

  describe('getStats', () => {
    it('should throw ForbiddenException for employee', async () => {
      await expect(service.getStats(createEmployeeUser(), {})).rejects.toThrow(ForbiddenException);
    });

    it('should transform stats results correctly', async () => {
      // total count
      mockDb.query.mockResolvedValueOnce([{ total: '100' }]);
      // action counts
      mockDb.query.mockResolvedValueOnce([
        { action: 'create', count: '40' },
        { action: 'read', count: '60' },
      ]);
      // resource type counts
      mockDb.query.mockResolvedValueOnce([
        { resource_type: 'document', count: '70' },
        { resource_type: 'user', count: '30' },
      ]);
      // user counts (top 10)
      mockDb.query.mockResolvedValueOnce([
        { user_id: 1, user_name: 'Alice', count: '50' },
        { user_id: 2, user_name: null, count: '50' },
      ]);
      // status counts
      mockDb.query.mockResolvedValueOnce([
        { status: 'success', count: '90' },
        { status: 'failure', count: '10' },
      ]);

      const result = await service.getStats(createAdminUser(), {});

      expect(result.totalEntries).toBe(100);
      expect(result.byAction).toEqual({ create: 40, read: 60 });
      expect(result.byResourceType).toEqual({ document: 70, user: 30 });
      expect(result.byUser).toEqual([
        { userId: 1, userName: 'Alice', count: 50 },
        { userId: 2, userName: 'Unknown', count: 50 },
      ]);
      expect(result.byStatus).toEqual({ success: 90, failure: 10 });
      expect(result.timeRange).toEqual({
        from: 'unlimited',
        to: 'unlimited',
      });
    });

    it('should pass date filters to stats WHERE clause', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.getStats(createRootUser(), {
        dateFrom: '2026-01-01',
        dateTo: '2026-06-30',
      });

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('created_at >=');
      expect(sql).toContain('created_at <=');
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain('2026-01-01');
      expect(params).toContain('2026-06-30');
    });
  });

  // =============================================================
  // generateReport — admin access + report summary
  // =============================================================

  describe('generateReport', () => {
    it('should throw ForbiddenException for employee', async () => {
      await expect(
        service.generateReport(createEmployeeUser(), {
          reportType: 'gdpr',
          dateFrom: '2026-01-01',
          dateTo: '2026-12-31',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should calculate report summary correctly', async () => {
      const rows = [
        createDbRow({
          id: 1,
          user_id: 10,
          action: 'read',
          changes: null,
        }),
        createDbRow({
          id: 2,
          user_id: 10,
          action: 'export',
          changes: null,
        }),
        createDbRow({
          id: 3,
          user_id: 20,
          action: 'create',
          changes: null,
        }),
        createDbRow({
          id: 4,
          user_id: 30,
          action: 'update',
          changes: null,
        }),
        createDbRow({
          id: 5,
          user_id: 30,
          action: 'delete',
          changes: null,
        }),
      ];
      mockDb.query.mockResolvedValueOnce(rows);

      const result = await service.generateReport(createAdminUser(), {
        reportType: 'user_activity',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      });

      expect(result.summary).toEqual({
        totalActions: 5,
        uniqueUsers: 3, // 10, 20, 30
        dataAccessCount: 2, // read + export
        dataModificationCount: 2, // create + update
        dataDeletionCount: 1, // delete
      });
      expect(result.reportType).toBe('user_activity');
      expect(result.tenantId).toBe(42);
    });

    it('should add GDPR-specific filter conditions', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.generateReport(createRootUser(), {
        reportType: 'gdpr',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      });

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('export');
      expect(sql).toContain('delete');
    });

    it('should add data_changes filter conditions', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.generateReport(createRootUser(), {
        reportType: 'data_changes',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      });

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('create');
      expect(sql).toContain('update');
      expect(sql).toContain('bulk_create');
    });
  });

  // =============================================================
  // exportEntries — admin access
  // =============================================================

  describe('exportEntries', () => {
    it('should throw ForbiddenException for employee', async () => {
      await expect(
        service.exportEntries(createEmployeeUser(), {}, '127.0.0.1', 'test'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return entries with default json format', async () => {
      // Count query (queryEntries)
      mockDb.query.mockResolvedValueOnce([{ total: 1 }]);
      // Entries query (queryEntries)
      mockDb.query.mockResolvedValueOnce([createDbRow()]);
      // createEntry: user lookup
      mockDb.query.mockResolvedValueOnce([{ username: 'admin', role: 'admin' }]);
      // createEntry: INSERT
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.exportEntries(createAdminUser(), {}, '127.0.0.1', 'TestAgent');

      expect(result.format).toBe('json');
      expect(result.entries).toHaveLength(1);
    });
  });

  // =============================================================
  // deleteOldEntries — root access + password verification
  // =============================================================

  describe('deleteOldEntries', () => {
    it('should throw ForbiddenException for admin (non-root)', async () => {
      await expect(
        service.deleteOldEntries(
          createAdminUser(),
          { olderThanDays: 90, confirmPassword: 'pass' },
          '127.0.0.1',
          'test',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when user has no password hash', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce(null);

      await expect(
        service.deleteOldEntries(
          createRootUser(),
          { olderThanDays: 90, confirmPassword: 'pass' },
          '127.0.0.1',
          'test',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong password', async () => {
      // bcrypt hash of 'correctpass'
      mockUserRepo.getPasswordHash.mockResolvedValueOnce(
        '$2a$10$invalidhashnotmatching000000000000000000000000000000',
      );

      await expect(
        service.deleteOldEntries(
          createRootUser(),
          { olderThanDays: 90, confirmPassword: 'wrongpass' },
          '127.0.0.1',
          'test',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

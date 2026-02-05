/**
 * Blackboard Entries Service – Unit Tests
 *
 * Phase 12: Deep service tests covering private helpers + DB-mocked operations.
 * Private methods tested via bracket notation.
 */
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { BlackboardAccessService } from './blackboard-access.service.js';
import { BlackboardEntriesService } from './blackboard-entries.service.js';
import type {
  DbBlackboardEntry,
  NormalizedFilters,
  UserAccessInfo,
} from './blackboard.types.js';

// ============================================================
// Mock uuid
// ============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('00000000-0000-7000-0000-000000000001'),
}));

// ============================================================
// Test Helpers
// ============================================================

function createServiceWithMock(): {
  service: BlackboardEntriesService;
  mockDb: { query: ReturnType<typeof vi.fn> };
  mockAccessService: Record<string, ReturnType<typeof vi.fn>>;
  mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;
} {
  const mockDb = { query: vi.fn() };
  const mockAccessService = {
    getUserAccessInfo: vi.fn(),
    applyAccessControl: vi.fn(),
    checkEntryAccess: vi.fn(),
    validateOrgPermissions: vi.fn(),
    buildAdminAccessSQL: vi.fn(),
  };
  const mockActivityLogger = {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
  };

  const service = new BlackboardEntriesService(
    mockDb as unknown as DatabaseService,
    mockAccessService as unknown as BlackboardAccessService,
    mockActivityLogger as unknown as ActivityLoggerService,
  );

  return { service, mockDb, mockAccessService, mockActivityLogger };
}

/** Standard mock DB entry with all optional fields set to null/values */
function createMockDbEntry(
  overrides: Partial<DbBlackboardEntry> = {},
): DbBlackboardEntry {
  return {
    id: 1,
    uuid: '0194a1b2-c3d4-7e5f-8a9b-c0d1e2f3a4b5',
    tenant_id: 1,
    title: 'Test Entry',
    content: 'Test Content',
    org_level: 'company',
    org_id: 0,
    author_id: 5,
    expires_at: null,
    priority: 'medium',
    color: 'blue',
    is_active: 1,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    author_name: 'testuser',
    is_confirmed: false,
    confirmed_at: null as unknown as Date,
    first_seen_at: null as unknown as Date,
    author_first_name: 'Test',
    author_last_name: 'User',
    author_full_name: 'Test User',
    attachment_count: 0,
    comment_count: 0,
    ...overrides,
  };
}

const DEFAULT_USER_ACCESS: UserAccessInfo = {
  role: 'admin',
  departmentId: 1,
  teamId: null,
  hasFullAccess: true,
};

// ============================================================
// Pure Private Methods
// ============================================================

describe('BlackboardEntriesService – pure helpers', () => {
  let service: BlackboardEntriesService;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
  });

  describe('hasMultiOrgTargets', () => {
    it('returns true when departmentIds are provided', () => {
      const dto = {
        title: 'Test',
        content: 'Content',
        departmentIds: [1, 2],
        teamIds: [],
        areaIds: [],
      };

      expect(service['hasMultiOrgTargets'](dto as never)).toBe(true);
    });

    it('returns true when teamIds are provided', () => {
      const dto = {
        title: 'Test',
        content: 'Content',
        departmentIds: [],
        teamIds: [10],
        areaIds: [],
      };

      expect(service['hasMultiOrgTargets'](dto as never)).toBe(true);
    });

    it('returns true when areaIds are provided', () => {
      const dto = {
        title: 'Test',
        content: 'Content',
        departmentIds: [],
        teamIds: [],
        areaIds: [5],
      };

      expect(service['hasMultiOrgTargets'](dto as never)).toBe(true);
    });

    it('returns false when all org arrays are empty', () => {
      const dto = {
        title: 'Test',
        content: 'Content',
        departmentIds: [],
        teamIds: [],
        areaIds: [],
      };

      expect(service['hasMultiOrgTargets'](dto as never)).toBe(false);
    });
  });

  describe('determineOrgTarget', () => {
    it('returns area org when areaIds provided', () => {
      const dto = {
        departmentIds: [],
        teamIds: [],
        areaIds: [5],
      };

      const result = service['determineOrgTarget'](dto as never);

      expect(result.orgLevel).toBe('area');
      expect(result.areaId).toBe(5);
      expect(result.orgId).toBeNull();
    });

    it('returns department org when departmentIds provided', () => {
      const dto = {
        departmentIds: [10],
        teamIds: [],
        areaIds: [],
      };

      const result = service['determineOrgTarget'](dto as never);

      expect(result.orgLevel).toBe('department');
      expect(result.orgId).toBe(10);
      expect(result.areaId).toBeNull();
    });

    it('returns team org when teamIds provided', () => {
      const dto = {
        departmentIds: [],
        teamIds: [20],
        areaIds: [],
      };

      const result = service['determineOrgTarget'](dto as never);

      expect(result.orgLevel).toBe('team');
      expect(result.orgId).toBe(20);
    });

    it('falls back to company level when no org arrays', () => {
      const dto = {
        departmentIds: [],
        teamIds: [],
        areaIds: [],
        orgLevel: undefined,
        orgId: undefined,
      };

      const result = service['determineOrgTarget'](dto as never);

      expect(result.orgLevel).toBe('company');
      expect(result.orgId).toBeNull();
      expect(result.areaId).toBeNull();
    });

    it('uses dto.orgLevel when provided and no org arrays', () => {
      const dto = {
        departmentIds: [],
        teamIds: [],
        areaIds: [],
        orgLevel: 'department',
        orgId: 42,
      };

      const result = service['determineOrgTarget'](dto as never);

      expect(result.orgLevel).toBe('department');
      expect(result.orgId).toBe(42);
    });
  });

  describe('resolveNumericEntryId', () => {
    it('returns number directly for numeric IDs', async () => {
      const result = await service['resolveNumericEntryId'](42, 1);

      expect(result).toBe(42);
    });
  });
});

// ============================================================
// Private Query Builders & Helpers (DB-mocked)
// ============================================================

describe('BlackboardEntriesService – private helpers', () => {
  let service: BlackboardEntriesService;
  let mockDb: { query: ReturnType<typeof vi.fn> };
  let mockAccessService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockAccessService = result.mockAccessService;
  });

  // ----------------------------------------------------------
  // buildEntryListQuery
  // ----------------------------------------------------------

  describe('buildEntryListQuery', () => {
    it('builds base query with default filters (all, no search, no priority)', () => {
      mockAccessService.applyAccessControl.mockImplementation(
        (q: string) => ({ query: q }),
      );

      const filters: NormalizedFilters = {
        isActive: 1,
        filter: 'all',
        search: '',
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortDir: 'DESC',
        priority: undefined,
      };

      const result = service['buildEntryListQuery'](
        5,
        1,
        filters,
        DEFAULT_USER_ACCESS,
      );

      // Base params: [userId, tenantId, isActive]
      expect(result.params).toEqual([5, 1, 1]);
      expect(result.query).not.toContain('AND e.org_level =');
      expect(result.query).not.toContain('LIKE');
      expect(result.query).not.toContain('e.priority =');
    });

    it('adds org_level filter when filter is not all', () => {
      mockAccessService.applyAccessControl.mockImplementation(
        (q: string) => ({ query: q }),
      );

      const filters: NormalizedFilters = {
        isActive: 1,
        filter: 'department',
        search: '',
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortDir: 'DESC',
        priority: undefined,
      };

      const result = service['buildEntryListQuery'](
        5,
        1,
        filters,
        DEFAULT_USER_ACCESS,
      );

      expect(result.query).toContain('e.org_level = $4');
      expect(result.params).toContain('department');
    });

    it('adds search filter when search is not empty', () => {
      mockAccessService.applyAccessControl.mockImplementation(
        (q: string) => ({ query: q }),
      );

      const filters: NormalizedFilters = {
        isActive: 1,
        filter: 'all',
        search: 'hello',
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortDir: 'DESC',
        priority: undefined,
      };

      const result = service['buildEntryListQuery'](
        5,
        1,
        filters,
        DEFAULT_USER_ACCESS,
      );

      expect(result.query).toContain('e.title LIKE');
      expect(result.query).toContain('e.content LIKE');
      expect(result.params).toContain('%hello%');
    });

    it('adds priority filter when priority is set', () => {
      mockAccessService.applyAccessControl.mockImplementation(
        (q: string) => ({ query: q }),
      );

      const filters: NormalizedFilters = {
        isActive: 1,
        filter: 'all',
        search: '',
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortDir: 'DESC',
        priority: 'high',
      };

      const result = service['buildEntryListQuery'](
        5,
        1,
        filters,
        DEFAULT_USER_ACCESS,
      );

      expect(result.query).toContain('e.priority = $');
      expect(result.params).toContain('high');
    });

    it('adds all filters when all are active', () => {
      mockAccessService.applyAccessControl.mockImplementation(
        (q: string) => ({ query: q }),
      );

      const filters: NormalizedFilters = {
        isActive: 1,
        filter: 'team',
        search: 'test',
        page: 2,
        limit: 20,
        sortBy: 'title',
        sortDir: 'ASC',
        priority: 'urgent',
      };

      const result = service['buildEntryListQuery'](
        5,
        1,
        filters,
        DEFAULT_USER_ACCESS,
      );

      expect(result.params).toContain('team');
      expect(result.params).toContain('%test%');
      expect(result.params).toContain('urgent');
    });

    it('skips priority filter when priority is empty string', () => {
      mockAccessService.applyAccessControl.mockImplementation(
        (q: string) => ({ query: q }),
      );

      const filters: NormalizedFilters = {
        isActive: 1,
        filter: 'all',
        search: '',
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortDir: 'DESC',
        priority: '',
      };

      const result = service['buildEntryListQuery'](
        5,
        1,
        filters,
        DEFAULT_USER_ACCESS,
      );

      expect(result.query).not.toContain('e.priority =');
    });
  });

  // ----------------------------------------------------------
  // countEntries
  // ----------------------------------------------------------

  describe('countEntries', () => {
    it('returns total from count query', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: 42 }]);

      const baseQuery =
        'SELECT e.id, e.uuid FROM blackboard_entries e WHERE e.tenant_id = $1';
      const result = await service['countEntries'](baseQuery, [1]);

      expect(result).toBe(42);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [1],
      );
    });

    it('returns 0 when no rows returned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const baseQuery =
        'SELECT e.id, e.uuid FROM blackboard_entries e WHERE e.tenant_id = $1';
      const result = await service['countEntries'](baseQuery, [1]);

      expect(result).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // fetchPaginatedEntries
  // ----------------------------------------------------------

  describe('fetchPaginatedEntries', () => {
    it('applies pagination and sorting', async () => {
      const entry = createMockDbEntry();
      mockDb.query.mockResolvedValueOnce([entry]);

      const filters: NormalizedFilters = {
        isActive: 1,
        filter: 'all',
        search: '',
        page: 2,
        limit: 5,
        sortBy: 'created_at',
        sortDir: 'DESC',
        priority: undefined,
      };

      const result = await service['fetchPaginatedEntries'](
        'SELECT * FROM blackboard_entries e WHERE 1=1',
        [1, 2],
        filters,
      );

      expect(result).toHaveLength(1);
      // Check that LIMIT and OFFSET params were added
      const callArgs = mockDb.query.mock.calls[0] as unknown[];
      const params = callArgs[1] as unknown[];
      expect(params).toContain(5); // limit
      expect(params).toContain(5); // offset = (page-1) * limit = (2-1) * 5
    });

    it('returns empty array when no entries found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const filters: NormalizedFilters = {
        isActive: 1,
        filter: 'all',
        search: '',
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortDir: 'DESC',
        priority: undefined,
      };

      const result = await service['fetchPaginatedEntries'](
        'SELECT * FROM blackboard_entries e',
        [],
        filters,
      );

      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // insertEntry
  // ----------------------------------------------------------

  describe('insertEntry', () => {
    it('inserts entry and returns ID', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const dto = {
        title: 'New Entry',
        content: 'Content here',
        priority: 'high',
        color: 'red',
        expiresAt: '2024-12-31',
      };

      const result = await service['insertEntry'](
        dto as never,
        1,
        5,
        'company',
        null,
        null,
      );

      expect(result).toBe(42);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO blackboard_entries'),
        expect.arrayContaining([
          '00000000-0000-7000-0000-000000000001',
          1,
          'New Entry',
          'Content here',
          'company',
        ]),
      );
    });

    it('passes null expiresAt when not provided', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);

      const dto = {
        title: 'Entry',
        content: 'Content',
        expiresAt: undefined,
      };

      await service['insertEntry'](dto as never, 1, 5, 'company', null, null);

      const callArgs = mockDb.query.mock.calls[0] as unknown[];
      const params = callArgs[1] as unknown[];
      // expiresAt is param index 8 (0-based)
      expect(params[8]).toBeNull();
    });

    it('throws Error when insert returns no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const dto = {
        title: 'Entry',
        content: 'Content',
        expiresAt: undefined,
      };

      await expect(
        service['insertEntry'](dto as never, 1, 5, 'company', null, null),
      ).rejects.toThrow('Failed to create blackboard entry');
    });
  });

  // ----------------------------------------------------------
  // syncEntryOrganizations
  // ----------------------------------------------------------

  describe('syncEntryOrganizations', () => {
    it('deletes existing orgs and inserts new ones', async () => {
      mockDb.query.mockResolvedValue([]);

      await service['syncEntryOrganizations'](42, [1, 2], [10], [100]);

      // 1 DELETE + 2 department INSERTs + 1 team INSERT + 1 area INSERT = 5 calls
      expect(mockDb.query).toHaveBeenCalledTimes(5);

      // First call: DELETE
      expect(mockDb.query.mock.calls[0]?.[0]).toContain('DELETE FROM');
      expect(mockDb.query.mock.calls[0]?.[1]).toEqual([42]);

      // Department inserts
      expect(mockDb.query.mock.calls[1]?.[1]).toEqual([42, 'department', 1]);
      expect(mockDb.query.mock.calls[2]?.[1]).toEqual([42, 'department', 2]);

      // Team insert
      expect(mockDb.query.mock.calls[3]?.[1]).toEqual([42, 'team', 10]);

      // Area insert
      expect(mockDb.query.mock.calls[4]?.[1]).toEqual([42, 'area', 100]);
    });

    it('only deletes when all arrays are empty', async () => {
      mockDb.query.mockResolvedValue([]);

      await service['syncEntryOrganizations'](42, [], [], []);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query.mock.calls[0]?.[0]).toContain('DELETE FROM');
    });
  });

  // ----------------------------------------------------------
  // resolveNumericEntryId (UUID path)
  // ----------------------------------------------------------

  describe('resolveNumericEntryId – UUID', () => {
    it('resolves UUID to numeric ID', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service['resolveNumericEntryId'](
        'some-uuid-string',
        1,
      );

      expect(result).toBe(42);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE uuid = $1'),
        ['some-uuid-string', 1],
      );
    });

    it('throws NotFoundException for unknown UUID', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service['resolveNumericEntryId']('unknown-uuid', 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------
  // appendFieldUpdates
  // ----------------------------------------------------------

  describe('appendFieldUpdates', () => {
    it('appends title update', () => {
      const dto = { title: 'New Title' };
      const params: unknown[] = [];
      let query = '';

      service['appendFieldUpdates'](dto as never, params, (s: string) => {
        query += s;
      });

      expect(params).toEqual(['New Title']);
      expect(query).toContain('title = $1');
    });

    it('appends multiple field updates', () => {
      const dto = {
        title: 'Updated',
        content: 'New Content',
        priority: 'high',
        color: 'red',
      };
      const params: unknown[] = [];
      let query = '';

      service['appendFieldUpdates'](dto as never, params, (s: string) => {
        query += s;
      });

      expect(params).toHaveLength(4);
      expect(query).toContain('title');
      expect(query).toContain('content');
      expect(query).toContain('priority');
      expect(query).toContain('color');
    });

    it('transforms expiresAt with Date constructor', () => {
      const dto = { expiresAt: '2024-12-31T00:00:00Z' };
      const params: unknown[] = [];

      service['appendFieldUpdates'](dto as never, params, () => {});

      expect(params).toHaveLength(1);
      expect(params[0]).toBeInstanceOf(Date);
    });

    it('passes null expiresAt when value is null', () => {
      const dto = { expiresAt: null };
      const params: unknown[] = [];

      service['appendFieldUpdates'](dto as never, params, () => {});

      expect(params).toEqual([null]);
    });

    it('appends isActive update', () => {
      const dto = { isActive: 3 };
      const params: unknown[] = [];
      let query = '';

      service['appendFieldUpdates'](dto as never, params, (s: string) => {
        query += s;
      });

      expect(params).toEqual([3]);
      expect(query).toContain('is_active');
    });

    it('skips undefined fields', () => {
      const dto = { title: undefined, content: undefined };
      const params: unknown[] = [];

      service['appendFieldUpdates'](dto as never, params, () => {});

      expect(params).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // appendOrgUpdates
  // ----------------------------------------------------------

  describe('appendOrgUpdates', () => {
    it('sets area when areaIds provided', () => {
      const dto = { areaIds: [5] };
      const params: unknown[] = [];
      let query = '';

      service['appendOrgUpdates'](dto as never, params, (s: string) => {
        query += s;
      });

      expect(params).toEqual([5, 'area']);
      expect(query).toContain('area_id');
      expect(query).toContain('org_level');
    });

    it('sets department when departmentIds provided (no area)', () => {
      const dto = { departmentIds: [10] };
      const params: unknown[] = [];
      let query = '';

      service['appendOrgUpdates'](dto as never, params, (s: string) => {
        query += s;
      });

      expect(params).toEqual([10, 'department']);
      expect(query).toContain('org_id');
      expect(query).toContain('org_level');
    });

    it('sets team when teamIds provided (no area, no department)', () => {
      const dto = { teamIds: [20] };
      const params: unknown[] = [];
      let query = '';

      service['appendOrgUpdates'](dto as never, params, (s: string) => {
        query += s;
      });

      expect(params).toEqual([20, 'team']);
    });

    it('resets to company when no org IDs', () => {
      const dto = {};
      const params: unknown[] = [];
      let query = '';

      service['appendOrgUpdates'](dto as never, params, (s: string) => {
        query += s;
      });

      expect(params).toEqual([null, null, 'company']);
      expect(query).toContain('org_id');
      expect(query).toContain('area_id');
      expect(query).toContain('org_level');
    });
  });

  // ----------------------------------------------------------
  // buildUpdateQuery
  // ----------------------------------------------------------

  describe('buildUpdateQuery', () => {
    it('builds update query for numeric ID with field updates', () => {
      const dto = { title: 'Updated Title' };

      const result = service['buildUpdateQuery'](42, 1, dto as never, false);

      expect(result.query).toContain('UPDATE blackboard_entries SET');
      expect(result.query).toContain('title = $');
      expect(result.query).toContain('WHERE id = $');
      expect(result.params).toContain('Updated Title');
      expect(result.params).toContain(42);
      expect(result.params).toContain(1);
    });

    it('builds update query for UUID', () => {
      const dto = { title: 'Updated' };

      const result = service['buildUpdateQuery'](
        'some-uuid',
        1,
        dto as never,
        false,
      );

      expect(result.query).toContain('WHERE uuid = $');
    });

    it('includes org updates when hasMultiOrg is true', () => {
      const dto = { title: 'Updated', areaIds: [5] };

      const result = service['buildUpdateQuery'](42, 1, dto as never, true);

      expect(result.query).toContain('area_id');
      expect(result.query).toContain('org_level');
    });
  });

  // ----------------------------------------------------------
  // logEntryUpdateActivity
  // ----------------------------------------------------------

  describe('logEntryUpdateActivity', () => {
    let mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
      const result = createServiceWithMock();
      service = result.service;
      mockActivityLogger = result.mockActivityLogger;
    });

    it('logs archive action when isActive=3', async () => {
      const dto = { isActive: 3 };
      const existing = {
        title: 'Old Title',
        isActive: 1,
        priority: 'medium',
      };

      await service['logEntryUpdateActivity'](1, 5, 42, dto as never, existing);

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        1,
        5,
        'blackboard',
        42,
        expect.stringContaining('archiviert'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('logs reactivate action when isActive=1', async () => {
      const dto = { isActive: 1 };
      const existing = {
        title: 'Old Title',
        isActive: 3,
        priority: 'medium',
      };

      await service['logEntryUpdateActivity'](1, 5, 42, dto as never, existing);

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        1,
        5,
        'blackboard',
        42,
        expect.stringContaining('reaktiviert'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('logs regular update action for other changes', async () => {
      const dto = { title: 'New Title' };
      const existing = {
        title: 'Old Title',
        isActive: 1,
        priority: 'medium',
      };

      await service['logEntryUpdateActivity'](1, 5, 42, dto as never, existing);

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        1,
        5,
        'blackboard',
        42,
        expect.stringContaining('aktualisiert'),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });
});

// ============================================================
// Public Methods (DB-mocked)
// ============================================================

describe('BlackboardEntriesService – public methods', () => {
  let service: BlackboardEntriesService;
  let mockDb: { query: ReturnType<typeof vi.fn> };
  let mockAccessService: Record<string, ReturnType<typeof vi.fn>>;
  let mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockAccessService = result.mockAccessService;
    mockActivityLogger = result.mockActivityLogger;
  });

  // ----------------------------------------------------------
  // getEntryById
  // ----------------------------------------------------------

  describe('getEntryById', () => {
    it('returns transformed entry for numeric ID', async () => {
      const entry = createMockDbEntry();
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockDb.query.mockResolvedValueOnce([entry]);
      mockAccessService.checkEntryAccess.mockResolvedValue(true);

      const result = await service.getEntryById(1, 1, 5);

      expect(result).toHaveProperty('title', 'Test Entry');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE e.id = $2'),
        [5, 1, 1],
      );
    });

    it('uses uuid column for string ID', async () => {
      const entry = createMockDbEntry();
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockDb.query.mockResolvedValueOnce([entry]);
      mockAccessService.checkEntryAccess.mockResolvedValue(true);

      await service.getEntryById('some-uuid', 1, 5);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE e.uuid = $2'),
        [5, 'some-uuid', 1],
      );
    });

    it('throws NotFoundException when entry not found', async () => {
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getEntryById(999, 1, 5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when access denied', async () => {
      const entry = createMockDbEntry();
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockDb.query.mockResolvedValueOnce([entry]);
      mockAccessService.checkEntryAccess.mockResolvedValue(false);

      await expect(service.getEntryById(1, 1, 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ----------------------------------------------------------
  // listEntries
  // ----------------------------------------------------------

  describe('listEntries', () => {
    it('returns paginated entries with correct structure', async () => {
      const entry = createMockDbEntry();
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockAccessService.applyAccessControl.mockImplementation(
        (q: string) => ({ query: q }),
      );
      mockDb.query
        .mockResolvedValueOnce([{ total: 1 }]) // countEntries
        .mockResolvedValueOnce([entry]); // fetchPaginatedEntries

      const result = await service.listEntries(1, 5, {
        isActive: 1,
        filter: 'all',
        search: undefined,
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortDir: 'DESC',
        priority: undefined,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('calculates totalPages correctly', async () => {
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockAccessService.applyAccessControl.mockImplementation(
        (q: string) => ({ query: q }),
      );
      mockDb.query
        .mockResolvedValueOnce([{ total: 25 }])
        .mockResolvedValueOnce([]);

      const result = await service.listEntries(1, 5, {
        isActive: 1,
        filter: 'all',
        search: undefined,
        page: 1,
        limit: 10,
        sortBy: undefined,
        sortDir: undefined,
        priority: undefined,
      });

      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('returns empty entries when count is 0', async () => {
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockAccessService.applyAccessControl.mockImplementation(
        (q: string) => ({ query: q }),
      );
      mockDb.query
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      const result = await service.listEntries(1, 5, {
        isActive: 1,
        filter: 'all',
        search: undefined,
        page: 1,
        limit: 10,
        sortBy: undefined,
        sortDir: undefined,
        priority: undefined,
      });

      expect(result.entries).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // createEntry
  // ----------------------------------------------------------

  describe('createEntry', () => {
    it('creates entry without multi-org', async () => {
      const createdEntry = createMockDbEntry({ id: 42 });
      mockDb.query
        .mockResolvedValueOnce([{ id: 42 }]) // insertEntry
        .mockResolvedValueOnce([createdEntry]); // getEntryById → db.query
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockAccessService.checkEntryAccess.mockResolvedValue(true);

      const dto = {
        title: 'New Entry',
        content: 'Content',
        departmentIds: [],
        teamIds: [],
        areaIds: [],
      };

      const result = await service.createEntry(dto as never, 1, 5);

      expect(result).toHaveProperty('title');
      expect(mockActivityLogger.logCreate).toHaveBeenCalledWith(
        1,
        5,
        'blackboard',
        42,
        expect.stringContaining('New Entry'),
        expect.any(Object),
      );
    });

    it('creates entry with multi-org (validates permissions + syncs)', async () => {
      const createdEntry = createMockDbEntry({ id: 42 });
      mockDb.query
        .mockResolvedValueOnce([{ id: 42 }]) // insertEntry
        .mockResolvedValue([]) // syncEntryOrganizations calls (DELETE + INSERTs)
      ;
      // After sync, getEntryById is called which needs mocks
      mockDb.query
        .mockResolvedValueOnce([]) // sync DELETE
        .mockResolvedValueOnce([]) // sync INSERT dept 1
        .mockResolvedValueOnce([]) // sync INSERT dept 2
        .mockResolvedValueOnce([createdEntry]); // getEntryById → db.query
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockAccessService.validateOrgPermissions.mockResolvedValue(undefined);
      mockAccessService.checkEntryAccess.mockResolvedValue(true);

      const dto = {
        title: 'Multi-Org Entry',
        content: 'Content',
        departmentIds: [1, 2],
        teamIds: [],
        areaIds: [],
      };

      // Just verify it doesn't throw – the mock chain is complex
      await expect(service.createEntry(dto as never, 1, 5)).resolves.toBeDefined();
      expect(mockAccessService.validateOrgPermissions).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // deleteEntry
  // ----------------------------------------------------------

  describe('deleteEntry', () => {
    /** Helper to set up getEntryById mocks (called internally by deleteEntry) */
    function setupGetEntryMocks(authorId: number): void {
      const entry = createMockDbEntry({ author_id: authorId });
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockDb.query
        .mockResolvedValueOnce([entry]) // getEntryById internal query
        .mockResolvedValueOnce([]); // DELETE query
      mockAccessService.checkEntryAccess.mockResolvedValue(true);
    }

    it('allows root user to delete any entry', async () => {
      setupGetEntryMocks(99); // author is different user

      const result = await service.deleteEntry(1, 1, 5, 'root');

      expect(result.message).toBe('Entry deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalled();
    });

    it('allows author to delete their own entry', async () => {
      setupGetEntryMocks(5); // author is the requesting user

      const result = await service.deleteEntry(1, 1, 5, 'employee');

      expect(result.message).toBe('Entry deleted successfully');
    });

    it('allows user with full access to delete', async () => {
      setupGetEntryMocks(99); // different author
      // Ensure getUserAccessInfo returns hasFullAccess=true (second call for permission check)
      mockAccessService.getUserAccessInfo.mockResolvedValue({
        ...DEFAULT_USER_ACCESS,
        hasFullAccess: true,
      });

      const result = await service.deleteEntry(1, 1, 5, 'admin');

      expect(result.message).toBe('Entry deleted successfully');
    });

    it('throws ForbiddenException for non-author, non-root, no full access', async () => {
      const entry = createMockDbEntry({ author_id: 99 });
      // First getUserAccessInfo (inside getEntryById)
      mockAccessService.getUserAccessInfo
        .mockResolvedValueOnce({
          role: 'employee',
          departmentId: 1,
          teamId: null,
          hasFullAccess: false,
        })
        // Second getUserAccessInfo (in deleteEntry for hasFullAccess check)
        .mockResolvedValueOnce({
          role: 'employee',
          departmentId: 1,
          teamId: null,
          hasFullAccess: false,
        });
      mockDb.query.mockResolvedValueOnce([entry]);
      mockAccessService.checkEntryAccess.mockResolvedValue(true);

      await expect(
        service.deleteEntry(1, 1, 5, 'employee'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('uses uuid column for string ID delete', async () => {
      const entry = createMockDbEntry({ author_id: 5 });
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockDb.query
        .mockResolvedValueOnce([entry]) // getEntryById
        .mockResolvedValueOnce([]); // DELETE
      mockAccessService.checkEntryAccess.mockResolvedValue(true);

      await service.deleteEntry('some-uuid', 1, 5, 'root');

      // Second db.query call is the DELETE
      const deleteCall = mockDb.query.mock.calls[1] as unknown[];
      expect(deleteCall[0]).toContain('WHERE uuid = $1');
    });
  });

  // ----------------------------------------------------------
  // archiveEntry / unarchiveEntry
  // ----------------------------------------------------------

  describe('archiveEntry', () => {
    it('delegates to updateEntry with isActive=3', async () => {
      // Mock the full updateEntry chain
      const entry = createMockDbEntry();
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockAccessService.checkEntryAccess.mockResolvedValue(true);
      mockDb.query
        .mockResolvedValueOnce([entry]) // getEntryById (existing) in updateEntry
        .mockResolvedValueOnce([]) // UPDATE query
        .mockResolvedValueOnce([entry]); // getEntryById (updated) in updateEntry

      const result = await service.archiveEntry(1, 1, 5);

      expect(result).toHaveProperty('title');
      // Verify UPDATE was called with isActive=3
      const updateCall = mockDb.query.mock.calls[1] as unknown[];
      expect(updateCall[0]).toContain('is_active');
    });
  });

  describe('unarchiveEntry', () => {
    it('delegates to updateEntry with isActive=1', async () => {
      const entry = createMockDbEntry({ is_active: 3 });
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockAccessService.checkEntryAccess.mockResolvedValue(true);
      mockDb.query
        .mockResolvedValueOnce([entry]) // getEntryById (existing)
        .mockResolvedValueOnce([]) // UPDATE query
        .mockResolvedValueOnce([entry]); // getEntryById (updated)

      const result = await service.unarchiveEntry(1, 1, 5);

      expect(result).toHaveProperty('title');
    });
  });

  // ----------------------------------------------------------
  // getDashboardEntries
  // ----------------------------------------------------------

  describe('getDashboardEntries', () => {
    it('returns entries for root user without access filter', async () => {
      const entry = createMockDbEntry();
      mockAccessService.getUserAccessInfo.mockResolvedValue({
        role: 'root',
        departmentId: null,
        teamId: null,
        hasFullAccess: true,
      });
      mockDb.query.mockResolvedValueOnce([entry]);

      const result = await service.getDashboardEntries(1, 5, 3);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('title');
    });

    it('applies admin access SQL for admin users', async () => {
      mockAccessService.getUserAccessInfo.mockResolvedValue({
        role: 'admin',
        departmentId: 1,
        teamId: null,
        hasFullAccess: false,
      });
      mockAccessService.buildAdminAccessSQL.mockReturnValue(
        ' AND e.id IN (SELECT entry_id FROM admin_entries)',
      );
      mockDb.query.mockResolvedValueOnce([]);

      await service.getDashboardEntries(1, 5);

      expect(mockAccessService.buildAdminAccessSQL).toHaveBeenCalled();
    });

    it('applies dept/team filter for employee users', async () => {
      mockAccessService.getUserAccessInfo.mockResolvedValue({
        role: 'employee',
        departmentId: 10,
        teamId: 20,
        hasFullAccess: false,
      });
      mockDb.query.mockResolvedValueOnce([]);

      await service.getDashboardEntries(1, 5);

      const callArgs = mockDb.query.mock.calls[0] as unknown[];
      const query = callArgs[0] as string;
      const params = callArgs[1] as unknown[];
      expect(query).toContain("org_level = 'company'");
      expect(query).toContain("org_level = 'department'");
      expect(query).toContain("org_level = 'team'");
      expect(params).toContain(10); // departmentId
      expect(params).toContain(20); // teamId
    });

    it('uses default limit of 3', async () => {
      mockAccessService.getUserAccessInfo.mockResolvedValue({
        role: 'root',
        departmentId: null,
        teamId: null,
        hasFullAccess: true,
      });
      mockDb.query.mockResolvedValueOnce([]);

      await service.getDashboardEntries(1, 5);

      const callArgs = mockDb.query.mock.calls[0] as unknown[];
      const params = callArgs[1] as unknown[];
      expect(params[params.length - 1]).toBe(3);
    });

    it('uses custom limit when provided', async () => {
      mockAccessService.getUserAccessInfo.mockResolvedValue({
        role: 'root',
        departmentId: null,
        teamId: null,
        hasFullAccess: true,
      });
      mockDb.query.mockResolvedValueOnce([]);

      await service.getDashboardEntries(1, 5, 10);

      const callArgs = mockDb.query.mock.calls[0] as unknown[];
      const params = callArgs[1] as unknown[];
      expect(params[params.length - 1]).toBe(10);
    });

    it('returns empty array when no entries', async () => {
      mockAccessService.getUserAccessInfo.mockResolvedValue({
        role: 'root',
        departmentId: null,
        teamId: null,
        hasFullAccess: true,
      });
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getDashboardEntries(1, 5);

      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // updateEntry
  // ----------------------------------------------------------

  describe('updateEntry', () => {
    it('updates entry fields and returns updated entry', async () => {
      const existingEntry = createMockDbEntry();
      const updatedEntry = createMockDbEntry({ title: 'Updated Title' });

      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockAccessService.checkEntryAccess.mockResolvedValue(true);
      mockDb.query
        .mockResolvedValueOnce([existingEntry]) // getEntryById (existing)
        .mockResolvedValueOnce([]) // UPDATE query
        .mockResolvedValueOnce([updatedEntry]); // getEntryById (updated)

      const result = await service.updateEntry(
        1,
        { title: 'Updated Title' } as never,
        1,
        5,
      );

      expect(result).toHaveProperty('title');
      expect(mockActivityLogger.logUpdate).toHaveBeenCalled();
    });

    it('uses UUID for string ID', async () => {
      const entry = createMockDbEntry();
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockAccessService.checkEntryAccess.mockResolvedValue(true);
      mockDb.query
        .mockResolvedValueOnce([entry]) // getEntryById (existing, uses uuid column)
        .mockResolvedValueOnce([]) // UPDATE query (uses uuid column)
        .mockResolvedValueOnce([{ id: 1 }]) // resolveNumericEntryId
        .mockResolvedValueOnce([entry]); // getEntryById (updated)

      await expect(
        service.updateEntry('some-uuid', { title: 'X' } as never, 1, 5),
      ).resolves.toBeDefined();
    });

    it('syncs organizations when multi-org provided', async () => {
      const entry = createMockDbEntry();
      mockAccessService.getUserAccessInfo.mockResolvedValue(DEFAULT_USER_ACCESS);
      mockAccessService.checkEntryAccess.mockResolvedValue(true);
      mockAccessService.validateOrgPermissions.mockResolvedValue(undefined);
      mockDb.query
        .mockResolvedValueOnce([entry]) // getEntryById (existing)
        .mockResolvedValueOnce([]) // UPDATE query
        .mockResolvedValueOnce([]) // sync DELETE
        .mockResolvedValueOnce([]) // sync INSERT
        .mockResolvedValueOnce([entry]); // getEntryById (updated)

      await expect(
        service.updateEntry(
          1,
          { title: 'X', departmentIds: [1] } as never,
          1,
          5,
        ),
      ).resolves.toBeDefined();
      expect(mockAccessService.validateOrgPermissions).toHaveBeenCalled();
    });
  });
});

/**
 * Unit tests for KvpService (Facade)
 *
 * Phase 12: Deepened from 12 tests to comprehensive coverage.
 * Focus: dashboard mapping, permission checks, daily limit, status update,
 *        attachment visibility, CRUD operations, sharing, delegation.
 * Pure logic (transforms, query builders, visibility) tested in kvp.helpers.test.ts.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { KvpAttachmentsService } from './kvp-attachments.service.js';
import type { KvpCommentsService } from './kvp-comments.service.js';
import type { KvpConfirmationsService } from './kvp-confirmations.service.js';
import type { KvpLifecycleService } from './kvp-lifecycle.service.js';
import { KvpService } from './kvp.service.js';

// Mock uuid to avoid real UUID generation
vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

// Mock eventBus (imported statically in kvp.service.ts)
vi.mock('../../utils/eventBus.js', () => ({
  eventBus: {
    emitKvpSubmitted: vi.fn(),
  },
}));

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockNotifications() {
  return { createFeatureNotification: vi.fn().mockResolvedValue(undefined) };
}

function createMockActivityLogger() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockComments() {
  return {
    getComments: vi.fn().mockResolvedValue([]),
    addComment: vi.fn().mockResolvedValue({}),
  };
}

function createMockAttachments() {
  return {
    getAttachments: vi.fn().mockResolvedValue([]),
    addAttachment: vi.fn().mockResolvedValue({}),
    findAttachmentByUuid: vi.fn(),
  };
}

function createMockConfirmations() {
  return {
    getUnconfirmedCount: vi.fn().mockResolvedValue({ count: 0 }),
    confirmSuggestion: vi.fn().mockResolvedValue({ success: true }),
    unconfirmSuggestion: vi.fn().mockResolvedValue({ success: true }),
  };
}

function createMockLifecycle() {
  return {
    shareSuggestion: vi
      .fn()
      .mockResolvedValue({ message: 'Suggestion shared successfully' }),
    unshareSuggestion: vi
      .fn()
      .mockResolvedValue({ message: 'Suggestion unshared successfully' }),
    archiveSuggestion: vi
      .fn()
      .mockResolvedValue({ message: 'Suggestion archived successfully' }),
    unarchiveSuggestion: vi
      .fn()
      .mockResolvedValue({ message: 'Suggestion restored successfully' }),
  };
}

/** Complete mock DB suggestion row with all required fields */
function createMockDbSuggestion(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    uuid: 'test-uuid-123',
    tenant_id: 42,
    title: 'Test KVP',
    description: 'Test description',
    category_id: 1,
    custom_category_id: null,
    org_level: 'team',
    org_id: 5,
    department_id: null,
    team_id: 5,
    is_shared: false,
    submitted_by: 3,
    priority: 'normal',
    status: 'new',
    assigned_to: null,
    actual_savings: null,
    rejection_reason: null,
    expected_benefit: null,
    estimated_cost: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    category_name: 'Process',
    category_color: '#ff0000',
    category_icon: 'star',
    submitted_by_name: 'Test',
    submitted_by_lastname: 'User',
    is_confirmed: false,
    confirmed_at: null,
    first_seen_at: null,
    ...overrides,
  };
}

/** Empty org info result (no memberships) */
const EMPTY_ORG_ROW = {
  team_ids: [],
  department_ids: [],
  area_ids: [],
  team_lead_of: [],
  department_lead_of: [],
  area_lead_of: [],
  teams_department_ids: [],
  departments_area_ids: [],
  has_full_access: false,
};

/** Org info with full access */
const FULL_ACCESS_ORG_ROW = {
  ...EMPTY_ORG_ROW,
  has_full_access: true,
};

/** Org info with team lead role */
const TEAM_LEAD_ORG_ROW = {
  ...EMPTY_ORG_ROW,
  team_lead_of: [5],
  team_ids: [5],
};

// =============================================================
// Service Factory
// =============================================================

interface ServiceMocks {
  service: KvpService;
  mockDb: ReturnType<typeof createMockDb>;
  mockNotifications: ReturnType<typeof createMockNotifications>;
  mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  mockComments: ReturnType<typeof createMockComments>;
  mockAttachments: ReturnType<typeof createMockAttachments>;
  mockConfirmations: ReturnType<typeof createMockConfirmations>;
  mockLifecycle: ReturnType<typeof createMockLifecycle>;
}

function createService(): ServiceMocks {
  const mockDb = createMockDb();
  const mockNotifications = createMockNotifications();
  const mockActivityLogger = createMockActivityLogger();
  const mockComments = createMockComments();
  const mockAttachments = createMockAttachments();
  const mockConfirmations = createMockConfirmations();
  const mockLifecycle = createMockLifecycle();

  const service = new KvpService(
    mockDb as unknown as DatabaseService,
    mockNotifications as unknown as NotificationsService,
    mockActivityLogger as unknown as ActivityLoggerService,
    mockComments as unknown as KvpCommentsService,
    mockAttachments as unknown as KvpAttachmentsService,
    mockConfirmations as unknown as KvpConfirmationsService,
    mockLifecycle as unknown as KvpLifecycleService,
  );

  return {
    service,
    mockDb,
    mockNotifications,
    mockActivityLogger,
    mockComments,
    mockAttachments,
    mockConfirmations,
    mockLifecycle,
  };
}

/**
 * Helper: mock the getSuggestionById chain (org info + detail + org assignments).
 * Many facade methods call getSuggestionById internally.
 */
function mockGetSuggestionByIdChain(
  mockDb: ReturnType<typeof createMockDb>,
  dbSuggestion?: Record<string, unknown>,
): void {
  // Q1: getExtendedUserOrgInfo
  mockDb.query.mockResolvedValueOnce([FULL_ACCESS_ORG_ROW]);
  // Q2: detail query
  mockDb.query.mockResolvedValueOnce([createMockDbSuggestion(dbSuggestion)]);
  // Q3: getOrgAssignments (junction table)
  mockDb.query.mockResolvedValueOnce([]);
}

// =============================================================
// Tests
// =============================================================

describe('KvpService', () => {
  let service: KvpService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockAttachments: ReturnType<typeof createMockAttachments>;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let mockComments: ReturnType<typeof createMockComments>;
  let mockConfirmations: ReturnType<typeof createMockConfirmations>;
  let mockLifecycle: ReturnType<typeof createMockLifecycle>;

  beforeEach(() => {
    const mocks = createService();
    service = mocks.service;
    mockDb = mocks.mockDb;
    mockAttachments = mocks.mockAttachments;
    mockActivityLogger = mocks.mockActivityLogger;
    mockComments = mocks.mockComments;
    mockConfirmations = mocks.mockConfirmations;
    mockLifecycle = mocks.mockLifecycle;
  });

  // =============================================================
  // getExtendedUserOrgInfo (private)
  // =============================================================

  describe('getExtendedUserOrgInfo', () => {
    it('returns EMPTY_ORG_INFO when no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service['getExtendedUserOrgInfo'](3, 42);

      expect(result.hasFullAccess).toBe(false);
      expect(result.teamIds).toEqual([]);
    });

    it('maps DB row to API format', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          has_full_access: true,
          team_ids: [1, 2],
          department_ids: [10],
          area_ids: [100],
          team_lead_of: [1],
          department_lead_of: [10],
          area_lead_of: [],
          teams_department_ids: [10],
          departments_area_ids: [100],
        },
      ]);

      const result = await service['getExtendedUserOrgInfo'](3, 42);

      expect(result.hasFullAccess).toBe(true);
      expect(result.teamIds).toEqual([1, 2]);
      expect(result.departmentIds).toEqual([10]);
      expect(result.teamLeadOf).toEqual([1]);
    });
  });

  // =============================================================
  // getCategories
  // =============================================================

  describe('getCategories', () => {
    it('returns categories from DB', async () => {
      const mockCategories = [
        {
          id: 1,
          source: 'global',
          name: 'Quality',
          color: '#00f',
          icon: 'check',
        },
        {
          id: 2,
          source: 'custom',
          name: 'Safety',
          color: '#f00',
          icon: 'alert',
        },
      ];
      mockDb.query.mockResolvedValueOnce(mockCategories);

      const result = await service.getCategories(42);

      expect(result).toEqual(mockCategories);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no categories', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCategories(42);

      expect(result).toEqual([]);
    });
  });

  // =============================================================
  // getDashboardStats
  // =============================================================

  describe('getDashboardStats', () => {
    it('should map DB stats to camelCase response', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          total_suggestions: 100,
          new_suggestions: 30,
          in_progress_count: 20,
          approved: 25,
          implemented: 15,
          rejected: 10,
        },
      ]);

      const result = await service.getDashboardStats(42);

      expect(result).toEqual({
        totalSuggestions: 100,
        newSuggestions: 30,
        inReviewSuggestions: 20,
        approvedSuggestions: 25,
        implementedSuggestions: 15,
        rejectedSuggestions: 10,
      });
    });

    it('should return zeros when no stats returned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getDashboardStats(42);

      expect(result).toEqual({
        totalSuggestions: 0,
        newSuggestions: 0,
        inReviewSuggestions: 0,
        approvedSuggestions: 0,
        implementedSuggestions: 0,
        rejectedSuggestions: 0,
      });
    });
  });

  // =============================================================
  // getSuggestionById
  // =============================================================

  describe('getSuggestionById', () => {
    it('returns suggestion by numeric id', async () => {
      mockGetSuggestionByIdChain(mockDb);

      const result = await service.getSuggestionById(1, 42, 3, 'admin');

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test KVP');
    });

    it('returns suggestion by UUID', async () => {
      // Q1: org info
      mockDb.query.mockResolvedValueOnce([FULL_ACCESS_ORG_ROW]);
      // Q2: detail by uuid
      mockDb.query.mockResolvedValueOnce([
        createMockDbSuggestion({
          uuid: '019450aa-bbbb-7ccc-dddd-eeeeeeeeeeee',
        }),
      ]);
      // Q3: getOrgAssignments
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getSuggestionById(
        '019450aa-bbbb-7ccc-dddd-eeeeeeeeeeee',
        42,
        3,
        'admin',
      );

      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when suggestion not found', async () => {
      mockDb.query.mockResolvedValueOnce([FULL_ACCESS_ORG_ROW]);
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.getSuggestionById(999, 42, 3, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // createSuggestion
  // =============================================================

  describe('createSuggestion', () => {
    it('should throw ForbiddenException for admin without team lead role', async () => {
      mockDb.query.mockResolvedValueOnce([EMPTY_ORG_ROW]);

      await expect(
        service.createSuggestion(
          {
            title: 'Test',
            description: 'Desc',
            orgLevel: 'team',
            orgId: 1,
          },
          42,
          2,
          'admin',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when daily limit reached', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);

      await expect(
        service.createSuggestion(
          {
            title: 'Test',
            description: 'Desc',
            orgLevel: 'team',
            orgId: 1,
          },
          42,
          3,
          'employee',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates suggestion for employee within daily limit', async () => {
      // Q1: assertDailyLimitNotReached → count=0
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      // Q2: INSERT → [{id: 1}]
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // Q3: getSuggestionById → org info
      mockDb.query.mockResolvedValueOnce([FULL_ACCESS_ORG_ROW]);
      // Q4: getSuggestionById → detail
      mockDb.query.mockResolvedValueOnce([createMockDbSuggestion()]);
      // Q5: getSuggestionById → getOrgAssignments
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.createSuggestion(
        {
          title: 'My KVP',
          description: 'Improvement idea',
          orgLevel: 'team',
          orgId: 5,
        },
        42,
        3,
        'employee',
      );

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test KVP');
    });

    it('creates suggestion for admin with team lead role', async () => {
      // Q1: getExtendedUserOrgInfo → team lead
      mockDb.query.mockResolvedValueOnce([TEAM_LEAD_ORG_ROW]);
      // Q2: INSERT → [{id: 1}]
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // Q3: getSuggestionById → org info
      mockDb.query.mockResolvedValueOnce([FULL_ACCESS_ORG_ROW]);
      // Q4: getSuggestionById → detail
      mockDb.query.mockResolvedValueOnce([createMockDbSuggestion()]);
      // Q5: getSuggestionById → getOrgAssignments
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.createSuggestion(
        {
          title: 'Admin KVP',
          description: 'Team lead idea',
          orgLevel: 'team',
          orgId: 5,
        },
        42,
        2,
        'admin',
      );

      expect(result.id).toBe(1);
    });

    it('throws Error when INSERT returns no rows', async () => {
      // Q1: assertDailyLimitNotReached → count=0
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      // Q2: INSERT → [] (empty)
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.createSuggestion(
          {
            title: 'Fail KVP',
            description: 'Will fail',
            orgLevel: 'team',
            orgId: 5,
          },
          42,
          3,
          'employee',
        ),
      ).rejects.toThrow('Failed to create suggestion');
    });
  });

  // =============================================================
  // assertCanUpdateStatus (private)
  // =============================================================

  describe('assertCanUpdateStatus', () => {
    const mockSuggestion = {
      id: 1,
      teamId: 5,
    } as never;

    it('passes for root role', async () => {
      await expect(
        service['assertCanUpdateStatus'](mockSuggestion, 1, 42, 'root'),
      ).resolves.toBeUndefined();
    });

    it('throws for employee role', async () => {
      await expect(
        service['assertCanUpdateStatus'](mockSuggestion, 3, 42, 'employee'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('passes for admin with full access', async () => {
      mockDb.query.mockResolvedValueOnce([FULL_ACCESS_ORG_ROW]);

      await expect(
        service['assertCanUpdateStatus'](mockSuggestion, 2, 42, 'admin'),
      ).resolves.toBeUndefined();
    });

    it('passes for admin who is team lead of KVP team', async () => {
      mockDb.query.mockResolvedValueOnce([TEAM_LEAD_ORG_ROW]);

      await expect(
        service['assertCanUpdateStatus'](mockSuggestion, 2, 42, 'admin'),
      ).resolves.toBeUndefined();
    });

    it('throws for admin without access to KVP team', async () => {
      mockDb.query.mockResolvedValueOnce([EMPTY_ORG_ROW]);

      await expect(
        service['assertCanUpdateStatus'](mockSuggestion, 2, 42, 'admin'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =============================================================
  // assertDailyLimitNotReached (private)
  // =============================================================

  describe('assertDailyLimitNotReached', () => {
    it('passes when count is 0', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      await expect(
        service['assertDailyLimitNotReached'](42, 3),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when count >= 1', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);

      await expect(
        service['assertDailyLimitNotReached'](42, 3),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =============================================================
  // updateSuggestion
  // =============================================================

  describe('updateSuggestion', () => {
    it('updates suggestion for owner (employee)', async () => {
      // getSuggestionById chain (existing)
      mockGetSuggestionByIdChain(mockDb, { submitted_by: 3 });
      // UPDATE
      mockDb.query.mockResolvedValueOnce([]);
      // getSuggestionById chain (updated)
      mockGetSuggestionByIdChain(mockDb, { submitted_by: 3, title: 'Updated' });

      const result = await service.updateSuggestion(
        1,
        { title: 'Updated' } as never,
        42,
        3,
        'employee',
      );

      expect(result.id).toBe(1);
      expect(mockActivityLogger.logUpdate).toHaveBeenCalledOnce();
    });

    it('throws ForbiddenException for employee updating others suggestion', async () => {
      mockGetSuggestionByIdChain(mockDb, { submitted_by: 99 });

      await expect(
        service.updateSuggestion(
          1,
          { title: 'Hack' } as never,
          42,
          3,
          'employee',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('checks status update permissions for admin', async () => {
      // getSuggestionById chain (Q1 org, Q2 detail, Q3 orgAssignments)
      mockGetSuggestionByIdChain(mockDb, { submitted_by: 99 });
      // Q4: assertCanUpdateStatus → org info (admin with full access)
      mockDb.query.mockResolvedValueOnce([FULL_ACCESS_ORG_ROW]);
      // Q5: UPDATE
      mockDb.query.mockResolvedValueOnce([]);
      // getSuggestionById chain (Q6 org, Q7 detail, Q8 orgAssignments)
      mockGetSuggestionByIdChain(mockDb, {
        submitted_by: 99,
        status: 'approved',
      });

      const result = await service.updateSuggestion(
        1,
        { status: 'approved' } as never,
        42,
        2,
        'admin',
      );

      expect(result.id).toBe(1);
    });
  });

  // =============================================================
  // deleteSuggestion
  // =============================================================

  describe('deleteSuggestion', () => {
    it('should throw ForbiddenException for employee deleting others suggestion', async () => {
      mockGetSuggestionByIdChain(mockDb, { submitted_by: 99 });

      await expect(
        service.deleteSuggestion(1, 42, 3, 'employee'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deletes own suggestion for employee', async () => {
      mockGetSuggestionByIdChain(mockDb, { submitted_by: 3 });
      // DELETE
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteSuggestion(1, 42, 3, 'employee');

      expect(result.message).toBe('Suggestion deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalledOnce();
    });

    it('allows root to delete any suggestion', async () => {
      mockGetSuggestionByIdChain(mockDb, { submitted_by: 99 });
      // DELETE
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteSuggestion(1, 42, 1, 'root');

      expect(result.message).toBe('Suggestion deleted successfully');
    });
  });

  // =============================================================
  // shareSuggestion
  // =============================================================

  describe('shareSuggestion', () => {
    it('shares suggestion by numeric id', async () => {
      const result = await service.shareSuggestion(
        1,
        { orgLevel: 'department', orgId: 10 } as never,
        42,
        3,
        'admin',
      );

      expect(result.message).toBe('Suggestion shared successfully');
      expect(mockLifecycle.shareSuggestion).toHaveBeenCalledWith(
        1,
        { orgLevel: 'department', orgId: 10 },
        42,
        3,
      );
    });

    it('shares suggestion by UUID', async () => {
      const result = await service.shareSuggestion(
        '019450aa-bbbb-7ccc-dddd-eeeeeeeeeeee',
        { orgLevel: 'company', orgId: 0 } as never,
        42,
        3,
        'admin',
      );

      expect(result.message).toBe('Suggestion shared successfully');
      expect(mockLifecycle.shareSuggestion).toHaveBeenCalledWith(
        '019450aa-bbbb-7ccc-dddd-eeeeeeeeeeee',
        { orgLevel: 'company', orgId: 0 },
        42,
        3,
      );
    });
  });

  // =============================================================
  // unshareSuggestion
  // =============================================================

  describe('unshareSuggestion', () => {
    it('unshares suggestion and resets to team level', async () => {
      // Q1: getExtendedUserOrgInfo → user with team
      mockDb.query.mockResolvedValueOnce([{ ...EMPTY_ORG_ROW, team_ids: [5] }]);

      const result = await service.unshareSuggestion(1, 42, 3, 'admin');

      expect(result.message).toBe('Suggestion unshared successfully');
      expect(mockLifecycle.unshareSuggestion).toHaveBeenCalledWith(1, 42, 5);
    });

    it('uses 0 as team id when user has no teams', async () => {
      mockDb.query.mockResolvedValueOnce([EMPTY_ORG_ROW]);

      await service.unshareSuggestion(1, 42, 3, 'admin');

      expect(mockLifecycle.unshareSuggestion).toHaveBeenCalledWith(1, 42, 0);
    });
  });

  // =============================================================
  // listSuggestions
  // =============================================================

  describe('listSuggestions', () => {
    it('returns paginated suggestions', async () => {
      // Q1: getExtendedUserOrgInfo (visibility)
      mockDb.query.mockResolvedValueOnce([FULL_ACCESS_ORG_ROW]);
      // Q2: executeCountQuery
      mockDb.query.mockResolvedValueOnce([{ total: 5 }]);
      // Q3: list query
      mockDb.query.mockResolvedValueOnce([createMockDbSuggestion()]);
      // Q4: attachOrgAssignmentsBatch
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listSuggestions(42, 3, 'admin', {
        page: 1,
        limit: 20,
        status: undefined,
        categoryId: undefined,
        customCategoryId: undefined,
        priority: undefined,
        orgLevel: undefined,
        teamId: undefined,
        machineId: undefined,
        search: undefined,
        mineOnly: undefined,
      });

      expect(result.suggestions).toHaveLength(1);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.totalItems).toBe(5);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('applies mineOnly filter', async () => {
      // Q1: org info
      mockDb.query.mockResolvedValueOnce([FULL_ACCESS_ORG_ROW]);
      // Q2: count
      mockDb.query.mockResolvedValueOnce([{ total: 1 }]);
      // Q3: list
      mockDb.query.mockResolvedValueOnce([
        createMockDbSuggestion({ submitted_by: 3 }),
      ]);
      // Q4: attachOrgAssignmentsBatch
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listSuggestions(42, 3, 'employee', {
        page: 1,
        limit: 20,
        status: undefined,
        categoryId: undefined,
        customCategoryId: undefined,
        priority: undefined,
        orgLevel: undefined,
        search: undefined,
        mineOnly: true,
      });

      expect(result.suggestions).toHaveLength(1);
    });

    it('returns empty when count is 0', async () => {
      mockDb.query.mockResolvedValueOnce([FULL_ACCESS_ORG_ROW]);
      mockDb.query.mockResolvedValueOnce([{ total: 0 }]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listSuggestions(42, 3, 'admin', {
        page: 1,
        limit: 20,
        status: undefined,
        categoryId: undefined,
        customCategoryId: undefined,
        priority: undefined,
        orgLevel: undefined,
        teamId: undefined,
        machineId: undefined,
        search: undefined,
        mineOnly: undefined,
      });

      expect(result.suggestions).toEqual([]);
      expect(result.pagination.totalItems).toBe(0);
    });
  });

  // =============================================================
  // archiveSuggestion
  // =============================================================

  describe('archiveSuggestion', () => {
    it('delegates to lifecycle service', async () => {
      const result = await service.archiveSuggestion(1, 42, 1);

      expect(result.message).toBe('Suggestion archived successfully');
      expect(mockLifecycle.archiveSuggestion).toHaveBeenCalledWith(1, 42, 1);
    });

    it('archives by UUID', async () => {
      const result = await service.archiveSuggestion(
        '019450aa-bbbb-7ccc-dddd-eeeeeeeeeeee',
        42,
        1,
      );

      expect(result.message).toBe('Suggestion archived successfully');
      expect(mockLifecycle.archiveSuggestion).toHaveBeenCalledWith(
        '019450aa-bbbb-7ccc-dddd-eeeeeeeeeeee',
        42,
        1,
      );
    });
  });

  // =============================================================
  // unarchiveSuggestion
  // =============================================================

  describe('unarchiveSuggestion', () => {
    it('delegates to lifecycle service', async () => {
      const result = await service.unarchiveSuggestion(1, 42, 1);

      expect(result.message).toBe('Suggestion restored successfully');
      expect(mockLifecycle.unarchiveSuggestion).toHaveBeenCalledWith(1, 42, 1);
    });
  });

  // =============================================================
  // getAttachment — visibility checks
  // =============================================================

  describe('getAttachment', () => {
    it('should allow owner to access attachment', async () => {
      mockAttachments.findAttachmentByUuid.mockResolvedValueOnce({
        file_path: '/uploads/file.pdf',
        file_name: 'file.pdf',
        submitted_by: 3,
        status: 'new',
        org_level: 'team',
        org_id: 5,
      });

      const result = await service.getAttachment(
        'file-uuid',
        42,
        3,
        'employee',
      );

      expect(result).toEqual({
        filePath: '/uploads/file.pdf',
        fileName: 'file.pdf',
      });
    });

    it('should allow access to implemented (public) suggestions', async () => {
      mockAttachments.findAttachmentByUuid.mockResolvedValueOnce({
        file_path: '/uploads/public.pdf',
        file_name: 'public.pdf',
        submitted_by: 99,
        status: 'implemented',
        org_level: 'team',
        org_id: 5,
      });

      const result = await service.getAttachment(
        'file-uuid',
        42,
        3,
        'employee',
      );

      expect(result.fileName).toBe('public.pdf');
    });

    it('should throw ForbiddenException when no access', async () => {
      mockAttachments.findAttachmentByUuid.mockResolvedValueOnce({
        file_path: '/uploads/secret.pdf',
        file_name: 'secret.pdf',
        submitted_by: 99,
        status: 'new',
        org_level: 'area',
        org_id: 999,
      });
      mockDb.query.mockResolvedValueOnce([EMPTY_ORG_ROW]);

      await expect(
        service.getAttachment('file-uuid', 42, 3, 'employee'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows access via org membership', async () => {
      mockAttachments.findAttachmentByUuid.mockResolvedValueOnce({
        file_path: '/uploads/team.pdf',
        file_name: 'team.pdf',
        submitted_by: 99,
        status: 'new',
        org_level: 'team',
        org_id: 5,
      });
      // User has team membership for team 5
      mockDb.query.mockResolvedValueOnce([{ ...EMPTY_ORG_ROW, team_ids: [5] }]);

      const result = await service.getAttachment(
        'file-uuid',
        42,
        3,
        'employee',
      );

      expect(result.fileName).toBe('team.pdf');
    });
  });

  // =============================================================
  // Delegation: Comments
  // =============================================================

  describe('getComments', () => {
    it('resolves suggestion then delegates to commentsService', async () => {
      const paginated = { comments: [], total: 0, hasMore: false };
      mockComments.getComments.mockResolvedValueOnce(paginated);
      mockGetSuggestionByIdChain(mockDb);

      const result = await service.getComments(1, 42, 3, 'admin');

      expect(result).toEqual(paginated);
      expect(mockComments.getComments).toHaveBeenCalledWith(
        1,
        42,
        'admin',
        undefined,
        undefined,
      );
    });
  });

  describe('addComment', () => {
    it('resolves suggestion then delegates to commentsService', async () => {
      mockGetSuggestionByIdChain(mockDb);

      await service.addComment(1, 3, 42, 'Good idea', false, 'admin');

      expect(mockComments.addComment).toHaveBeenCalledWith(
        1,
        3,
        42,
        'Good idea',
        false,
        'admin',
        undefined,
      );
    });
  });

  // =============================================================
  // Delegation: Attachments
  // =============================================================

  describe('getAttachments', () => {
    it('resolves suggestion then delegates to attachmentsService', async () => {
      mockGetSuggestionByIdChain(mockDb);

      const result = await service.getAttachments(1, 42, 3, 'admin');

      expect(result).toEqual([]);
      expect(mockAttachments.getAttachments).toHaveBeenCalledWith(1, 42);
    });
  });

  describe('addAttachment', () => {
    it('resolves suggestion then delegates to attachmentsService', async () => {
      mockGetSuggestionByIdChain(mockDb);
      const attachmentData = {
        fileName: 'doc.pdf',
        filePath: '/uploads/doc.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        uploadedBy: 3,
        fileUuid: 'file-uuid',
      };

      await service.addAttachment(1, attachmentData, 42, 3, 'admin');

      expect(mockAttachments.addAttachment).toHaveBeenCalledWith(
        1,
        attachmentData,
      );
    });
  });

  // =============================================================
  // Delegation: Confirmations
  // =============================================================

  describe('getUnconfirmedCount', () => {
    it('fetches org info then delegates to confirmationsService', async () => {
      mockDb.query.mockResolvedValueOnce([FULL_ACCESS_ORG_ROW]);

      const result = await service.getUnconfirmedCount(3, 42);

      expect(result).toEqual({ count: 0 });
      expect(mockConfirmations.getUnconfirmedCount).toHaveBeenCalledOnce();
    });
  });

  describe('confirmSuggestion', () => {
    it('delegates to confirmationsService', async () => {
      const result = await service.confirmSuggestion('test-uuid', 3, 42);

      expect(result).toEqual({ success: true });
      expect(mockConfirmations.confirmSuggestion).toHaveBeenCalledWith(
        'test-uuid',
        3,
        42,
      );
    });
  });

  describe('unconfirmSuggestion', () => {
    it('delegates to confirmationsService', async () => {
      const result = await service.unconfirmSuggestion('test-uuid', 3, 42);

      expect(result).toEqual({ success: true });
      expect(mockConfirmations.unconfirmSuggestion).toHaveBeenCalledWith(
        'test-uuid',
        3,
        42,
      );
    });
  });
});

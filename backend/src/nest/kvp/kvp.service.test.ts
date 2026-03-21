/**
 * Unit tests for KvpService (Facade)
 *
 * Phase 12: Deepened from 12 tests to comprehensive coverage.
 * Focus: dashboard mapping, permission checks, daily limit, status update,
 *        attachment visibility, CRUD operations, sharing, delegation.
 * Pure logic (transforms, query builders, visibility) tested in kvp.helpers.test.ts.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ClsService } from 'nestjs-cls';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ScopeService } from '../hierarchy-permission/scope.service.js';
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
vi.mock('../../utils/event-bus.js', () => ({
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
  return { createAddonNotification: vi.fn().mockResolvedValue(undefined) };
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
    shareSuggestion: vi.fn().mockResolvedValue({ message: 'Suggestion shared successfully' }),
    unshareSuggestion: vi.fn().mockResolvedValue({ message: 'Suggestion unshared successfully' }),
    archiveSuggestion: vi.fn().mockResolvedValue({ message: 'Suggestion archived successfully' }),
    unarchiveSuggestion: vi.fn().mockResolvedValue({ message: 'Suggestion restored successfully' }),
  };
}

function createMockScope() {
  return {
    getScope: vi.fn().mockResolvedValue({
      type: 'full',
      areaIds: [],
      departmentIds: [],
      teamIds: [],
      leadAreaIds: [],
      leadDepartmentIds: [],
      leadTeamIds: [],
      isAreaLead: false,
      isDepartmentLead: false,
      isTeamLead: false,
      isAnyLead: false,
    }),
  };
}

function createMockCls() {
  const store = new Map<string, unknown>([
    ['userId', 99],
    ['tenantId', 42],
  ]);
  return { get: vi.fn((key: string) => store.get(key)) };
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
  mockScope: ReturnType<typeof createMockScope>;
  mockCls: ReturnType<typeof createMockCls>;
}

function createService(): ServiceMocks {
  const mockDb = createMockDb();
  const mockNotifications = createMockNotifications();
  const mockActivityLogger = createMockActivityLogger();
  const mockComments = createMockComments();
  const mockAttachments = createMockAttachments();
  const mockConfirmations = createMockConfirmations();
  const mockLifecycle = createMockLifecycle();
  const mockScope = createMockScope();
  const mockCls = createMockCls();

  const service = new KvpService(
    mockDb as unknown as DatabaseService,
    mockNotifications as unknown as NotificationsService,
    mockActivityLogger as unknown as ActivityLoggerService,
    mockComments as unknown as KvpCommentsService,
    mockAttachments as unknown as KvpAttachmentsService,
    mockConfirmations as unknown as KvpConfirmationsService,
    mockLifecycle as unknown as KvpLifecycleService,
    mockScope as unknown as ScopeService,
    mockCls as unknown as ClsService,
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
    mockScope,
    mockCls,
  };
}

/**
 * Helper: mock the getSuggestionById chain (detail query only).
 * Many facade methods call getSuggestionById internally.
 */
function mockGetSuggestionByIdChain(
  mockDb: ReturnType<typeof createMockDb>,
  dbSuggestion?: Record<string, unknown>,
): void {
  // Q1: detail query
  mockDb.query.mockResolvedValueOnce([createMockDbSuggestion(dbSuggestion)]);
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
  let mockScope: ReturnType<typeof createMockScope>;
  let mockCls: ReturnType<typeof createMockCls>;

  beforeEach(() => {
    const mocks = createService();
    service = mocks.service;
    mockDb = mocks.mockDb;
    mockAttachments = mocks.mockAttachments;
    mockActivityLogger = mocks.mockActivityLogger;
    mockComments = mocks.mockComments;
    mockConfirmations = mocks.mockConfirmations;
    mockLifecycle = mocks.mockLifecycle;
    mockScope = mocks.mockScope;
    mockCls = mocks.mockCls;
  });

  // =============================================================
  // getExtendedUserOrgInfo (private)
  // =============================================================

  describe('getExtendedUserOrgInfo', () => {
    it('maps scope to org info format', async () => {
      mockScope.getScope.mockResolvedValueOnce({
        type: 'scoped',
        areaIds: [100],
        departmentIds: [10],
        teamIds: [1, 2],
        leadAreaIds: [],
        leadDepartmentIds: [10],
        leadTeamIds: [1],
        isAreaLead: false,
        isDepartmentLead: true,
        isTeamLead: true,
        isAnyLead: true,
      });

      const result = await service['getExtendedUserOrgInfo']();

      expect(result.hasFullAccess).toBe(false);
      expect(result.teamIds).toEqual([1, 2]);
      expect(result.departmentIds).toEqual([10]);
      expect(result.teamLeadOf).toEqual([1]);
    });

    it('maps full scope to hasFullAccess', async () => {
      // Default mock already returns type: 'full'
      const result = await service['getExtendedUserOrgInfo']();

      expect(result.hasFullAccess).toBe(true);
      expect(result.teamIds).toEqual([]);
    });

    it('loads membership from DB for scope type none (employee)', async () => {
      mockScope.getScope.mockResolvedValueOnce({
        type: 'none',
        areaIds: [],
        departmentIds: [],
        teamIds: [],
        leadAreaIds: [],
        leadDepartmentIds: [],
        leadTeamIds: [],
        isAreaLead: false,
        isDepartmentLead: false,
        isTeamLead: false,
        isAnyLead: false,
      });
      mockDb.query.mockResolvedValueOnce([
        {
          team_ids: [86],
          dept_ids: [10],
          dept_area_ids: [1],
          teams_dept_ids: [10],
        },
      ]);

      const result = await service['getExtendedUserOrgInfo']();

      expect(result.hasFullAccess).toBe(false);
      expect(result.teamIds).toEqual([86]);
      expect(result.departmentIds).toEqual([10]);
      expect(result.areaIds).toEqual([1]);
      expect(result.teamsDepartmentIds).toEqual([10]);
      expect(result.teamLeadOf).toEqual([]);
      expect(mockCls.get).toHaveBeenCalledWith('userId');
      expect(mockCls.get).toHaveBeenCalledWith('tenantId');
    });

    it('returns empty arrays when DB returns no rows for scope none', async () => {
      mockScope.getScope.mockResolvedValueOnce({
        type: 'none',
        areaIds: [],
        departmentIds: [],
        teamIds: [],
        leadAreaIds: [],
        leadDepartmentIds: [],
        leadTeamIds: [],
        isAreaLead: false,
        isDepartmentLead: false,
        isTeamLead: false,
        isAnyLead: false,
      });
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service['getExtendedUserOrgInfo']();

      expect(result.teamIds).toEqual([]);
      expect(result.departmentIds).toEqual([]);
    });
  });

  // =============================================================
  // getMyOrganizations
  // =============================================================

  describe('getMyOrganizations', () => {
    it('returns mapped teams with parsed assets', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          team_id: 5,
          team_name: 'Alpha',
          assets: [{ id: 10, name: 'CNC-1' }],
        },
        {
          team_id: 8,
          team_name: 'Bravo',
          assets: [],
        },
      ]);

      const result = await service.getMyOrganizations(3, 42);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        teamId: 5,
        teamName: 'Alpha',
        assets: [{ id: 10, name: 'CNC-1' }],
      });
      expect(result[1]).toEqual({
        teamId: 8,
        teamName: 'Bravo',
        assets: [],
      });
    });

    it('handles string JSON assets from pg', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          team_id: 5,
          team_name: 'Alpha',
          assets: JSON.stringify([{ id: 10, name: 'CNC-1' }]),
        },
      ]);

      const result = await service.getMyOrganizations(3, 42);

      expect(result[0]?.assets).toEqual([{ id: 10, name: 'CNC-1' }]);
    });

    it('returns empty array when user has no teams', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getMyOrganizations(3, 42);

      expect(result).toEqual([]);
    });

    it('handles null assets gracefully', async () => {
      mockDb.query.mockResolvedValueOnce([{ team_id: 5, team_name: 'Alpha', assets: null }]);

      const result = await service.getMyOrganizations(3, 42);

      expect(result[0]?.assets).toEqual([]);
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
          team_total: 40,
          team_implemented: 8,
        },
      ]);

      const result = await service.getDashboardStats(42, 3);

      expect(result).toEqual({
        totalSuggestions: 100,
        newSuggestions: 30,
        inReviewSuggestions: 20,
        approvedSuggestions: 25,
        implementedSuggestions: 15,
        rejectedSuggestions: 10,
        teamTotalSuggestions: 40,
        teamImplementedSuggestions: 8,
      });
    });

    it('should return zeros when no stats returned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getDashboardStats(42, 3);

      expect(result).toEqual({
        totalSuggestions: 0,
        newSuggestions: 0,
        inReviewSuggestions: 0,
        approvedSuggestions: 0,
        implementedSuggestions: 0,
        rejectedSuggestions: 0,
        teamTotalSuggestions: 0,
        teamImplementedSuggestions: 0,
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
      // Q1: detail by uuid
      mockDb.query.mockResolvedValueOnce([
        createMockDbSuggestion({
          uuid: '019450aa-bbbb-7ccc-dddd-eeeeeeeeeeee',
        }),
      ]);

      const result = await service.getSuggestionById(
        '019450aa-bbbb-7ccc-dddd-eeeeeeeeeeee',
        42,
        3,
        'admin',
      );

      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when suggestion not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getSuggestionById(999, 42, 3, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // createSuggestion
  // =============================================================

  describe('createSuggestion', () => {
    it('should throw ForbiddenException for admin without team lead role', async () => {
      // Override: scoped admin without leads → hasFullAccess=false, teamLeadOf=[]
      mockScope.getScope.mockResolvedValueOnce({
        type: 'limited',
        areaIds: [],
        departmentIds: [],
        teamIds: [],
        leadAreaIds: [],
        leadDepartmentIds: [],
        leadTeamIds: [],
        isAreaLead: false,
        isDepartmentLead: false,
        isTeamLead: false,
        isAnyLead: false,
      });
      await expect(
        service.createSuggestion(
          {
            title: 'Test',
            description: 'Desc',
          },
          42,
          2,
          'admin',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when daily limit reached', async () => {
      // Q1: getKvpDailyLimit → default 1
      mockDb.query.mockResolvedValueOnce([{ daily_limit: 1 }]);
      // Q2: todayCount → already at limit
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);

      await expect(
        service.createSuggestion(
          {
            title: 'Test',
            description: 'Desc',
          },
          42,
          3,
          'employee',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates suggestion for employee within daily limit', async () => {
      // Q1: getKvpDailyLimit → default 1
      mockDb.query.mockResolvedValueOnce([{ daily_limit: 1 }]);
      // Q2: assertDailyLimitNotReached → count=0
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      // Q3: getUserTeamId → team_id=86
      mockDb.query.mockResolvedValueOnce([{ team_id: 86 }]);
      // Q4: INSERT → [{id: 1}]
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // Q5: getSuggestionById chain
      mockGetSuggestionByIdChain(mockDb);

      const result = await service.createSuggestion(
        {
          title: 'My KVP',
          description: 'Improvement idea',
        },
        42,
        3,
        'employee',
      );

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test KVP');
    });

    it('creates suggestion for admin with team lead role', async () => {
      // Override scope: admin is team lead of team 5
      mockScope.getScope.mockResolvedValueOnce({
        type: 'scoped',
        areaIds: [],
        departmentIds: [],
        teamIds: [5],
        leadAreaIds: [],
        leadDepartmentIds: [],
        leadTeamIds: [5],
        isAreaLead: false,
        isDepartmentLead: false,
        isTeamLead: true,
        isAnyLead: true,
      });
      // Q1: assertDailyLimitNotReached (admin) → has_full_access=true → skip limit
      mockDb.query.mockResolvedValueOnce([{ has_full_access: true }]);
      // Q2: getUserTeamId → team_id=86
      mockDb.query.mockResolvedValueOnce([{ team_id: 86 }]);
      // Q3: INSERT → [{id: 1}]
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // Q4: getSuggestionById chain
      mockGetSuggestionByIdChain(mockDb);

      const result = await service.createSuggestion(
        {
          title: 'Admin KVP',
          description: 'Team lead idea',
        },
        42,
        2,
        'admin',
      );

      expect(result.id).toBe(1);
    });

    it('truncates long description in notification', async () => {
      const longDesc = 'A'.repeat(150);
      // Q1: getKvpDailyLimit → default 1
      mockDb.query.mockResolvedValueOnce([{ daily_limit: 1 }]);
      // Q2: assertDailyLimitNotReached → count=0
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      // Q3: getUserTeamId → team_id=86
      mockDb.query.mockResolvedValueOnce([{ team_id: 86 }]);
      // Q4: INSERT → [{id: 1}]
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // Q5: getSuggestionById chain
      mockGetSuggestionByIdChain(mockDb);

      await service.createSuggestion(
        {
          title: 'Long Desc KVP',
          description: longDesc,
        },
        42,
        3,
        'employee',
      );

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('throws Error when INSERT returns no rows', async () => {
      // Q1: getKvpDailyLimit → default 1
      mockDb.query.mockResolvedValueOnce([{ daily_limit: 1 }]);
      // Q2: assertDailyLimitNotReached → count=0
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      // Q3: getUserTeamId → team_id=86
      mockDb.query.mockResolvedValueOnce([{ team_id: 86 }]);
      // Q4: INSERT → [] (empty)
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.createSuggestion(
          {
            title: 'Fail KVP',
            description: 'Will fail',
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
      // Default scope returns type: 'full' → hasFullAccess = true
      await expect(
        service['assertCanUpdateStatus'](mockSuggestion, 2, 42, 'admin'),
      ).resolves.toBeUndefined();
    });

    it('passes for admin who is team lead of KVP team', async () => {
      mockScope.getScope.mockResolvedValueOnce({
        type: 'scoped',
        areaIds: [],
        departmentIds: [],
        teamIds: [5],
        leadAreaIds: [],
        leadDepartmentIds: [],
        leadTeamIds: [5],
        isAreaLead: false,
        isDepartmentLead: false,
        isTeamLead: true,
        isAnyLead: true,
      });

      await expect(
        service['assertCanUpdateStatus'](mockSuggestion, 2, 42, 'admin'),
      ).resolves.toBeUndefined();
    });

    it('throws for admin without access to KVP team', async () => {
      mockScope.getScope.mockResolvedValueOnce({
        type: 'scoped',
        areaIds: [],
        departmentIds: [],
        teamIds: [],
        leadAreaIds: [],
        leadDepartmentIds: [],
        leadTeamIds: [],
        isAreaLead: false,
        isDepartmentLead: false,
        isTeamLead: false,
        isAnyLead: false,
      });

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
      // Q1: getKvpDailyLimit → 1
      mockDb.query.mockResolvedValueOnce([{ daily_limit: 1 }]);
      // Q2: todayCount → 0
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      await expect(
        service['assertDailyLimitNotReached'](42, 3, 'employee'),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when count >= 1', async () => {
      // Q1: getKvpDailyLimit → 1
      mockDb.query.mockResolvedValueOnce([{ daily_limit: 1 }]);
      // Q2: todayCount → 1 (at limit)
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);

      await expect(service['assertDailyLimitNotReached'](42, 3, 'employee')).rejects.toThrow(
        ForbiddenException,
      );
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
        service.updateSuggestion(1, { title: 'Hack' } as never, 42, 3, 'employee'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates suggestion by UUID', async () => {
      mockGetSuggestionByIdChain(mockDb, { submitted_by: 3 });
      mockDb.query.mockResolvedValueOnce([]);
      mockGetSuggestionByIdChain(mockDb, {
        submitted_by: 3,
        title: 'Via UUID',
      });

      const result = await service.updateSuggestion(
        '019450aa-bbbb-7ccc-dddd-eeeeeeeeeeee',
        { title: 'Via UUID' } as never,
        42,
        3,
        'employee',
      );

      expect(result.id).toBe(1);
      const updateCall = mockDb.query.mock.calls[1];
      expect(updateCall?.[0]).toContain('uuid');
    });

    it('checks status update permissions for admin', async () => {
      // getSuggestionById chain (Q1 detail)
      mockGetSuggestionByIdChain(mockDb, { submitted_by: 99 });
      // assertCanUpdateStatus uses scope mock (default = full access)
      // Q2: UPDATE
      mockDb.query.mockResolvedValueOnce([]);
      // getSuggestionById chain (Q4 detail)
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

      await expect(service.deleteSuggestion(1, 42, 3, 'employee')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deletes own suggestion for employee', async () => {
      mockGetSuggestionByIdChain(mockDb, { submitted_by: 3 });
      // DELETE
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteSuggestion(1, 42, 3, 'employee');

      expect(result.message).toBe('Suggestion deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalledOnce();
    });

    it('deletes suggestion by UUID', async () => {
      mockGetSuggestionByIdChain(mockDb, { submitted_by: 3 });
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteSuggestion(
        '019450aa-bbbb-7ccc-dddd-eeeeeeeeeeee',
        42,
        3,
        'employee',
      );

      expect(result.message).toBe('Suggestion deleted successfully');
      const deleteCall = mockDb.query.mock.calls[1];
      expect(deleteCall?.[0]).toContain('uuid');
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
    it('unshares suggestion by delegating to lifecycle service', async () => {
      const result = await service.unshareSuggestion(1, 42, 3, 'admin');

      expect(result.message).toBe('Suggestion unshared successfully');
      expect(mockLifecycle.unshareSuggestion).toHaveBeenCalledWith(1, 42);
    });
  });

  // =============================================================
  // listSuggestions
  // =============================================================

  describe('listSuggestions', () => {
    it('returns paginated suggestions', async () => {
      // Q1: executeCountQuery
      mockDb.query.mockResolvedValueOnce([{ total: 5 }]);
      // Q2: list query
      mockDb.query.mockResolvedValueOnce([createMockDbSuggestion()]);

      const result = await service.listSuggestions(42, 3, 'admin', {
        page: 1,
        limit: 20,
        status: undefined,
        categoryId: undefined,
        customCategoryId: undefined,
        priority: undefined,
        orgLevel: undefined,
        teamId: undefined,
        assetId: undefined,
        search: undefined,
        mineOnly: undefined,
      });

      expect(result.suggestions).toHaveLength(1);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.totalItems).toBe(5);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('applies mineOnly filter', async () => {
      // Q1: count
      mockDb.query.mockResolvedValueOnce([{ total: 1 }]);
      // Q2: list
      mockDb.query.mockResolvedValueOnce([createMockDbSuggestion({ submitted_by: 3 })]);

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

    it('uses default page=1 and limit=20 when not provided', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: 1 }]);
      mockDb.query.mockResolvedValueOnce([createMockDbSuggestion()]);

      const result = await service.listSuggestions(42, 3, 'admin', {
        status: undefined,
        categoryId: undefined,
        customCategoryId: undefined,
        priority: undefined,
        orgLevel: undefined,
        teamId: undefined,
        assetId: undefined,
        search: undefined,
        mineOnly: undefined,
      } as never);

      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
    });

    it('returns empty when count is 0', async () => {
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
        assetId: undefined,
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
      const result = await service.archiveSuggestion('019450aa-bbbb-7ccc-dddd-eeeeeeeeeeee', 42, 1);

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

      const result = await service.getAttachment('file-uuid', 42, 3, 'employee');

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

      const result = await service.getAttachment('file-uuid', 42, 3, 'employee');

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
      // Override scope: no access to any org
      mockScope.getScope.mockResolvedValueOnce({
        type: 'scoped',
        areaIds: [],
        departmentIds: [],
        teamIds: [],
        leadAreaIds: [],
        leadDepartmentIds: [],
        leadTeamIds: [],
        isAreaLead: false,
        isDepartmentLead: false,
        isTeamLead: false,
        isAnyLead: false,
      });

      await expect(service.getAttachment('file-uuid', 42, 3, 'employee')).rejects.toThrow(
        ForbiddenException,
      );
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
      // Override scope: user belongs to team 5
      mockScope.getScope.mockResolvedValueOnce({
        type: 'scoped',
        areaIds: [],
        departmentIds: [],
        teamIds: [5],
        leadAreaIds: [],
        leadDepartmentIds: [],
        leadTeamIds: [],
        isAreaLead: false,
        isDepartmentLead: false,
        isTeamLead: false,
        isAnyLead: false,
      });

      const result = await service.getAttachment('file-uuid', 42, 3, 'employee');

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
      expect(mockComments.getComments).toHaveBeenCalledWith(1, 42, 'admin', undefined, undefined);
    });
  });

  describe('getReplies', () => {
    it('delegates to commentsService', async () => {
      const mockReplies = [{ id: 10, suggestionId: 1, comment: 'Reply', parentId: 5 }];
      mockComments.getReplies = vi.fn().mockResolvedValueOnce(mockReplies);

      const result = await service.getReplies(5, 42, 'admin');

      expect(result).toEqual(mockReplies);
      expect(mockComments.getReplies).toHaveBeenCalledWith(5, 42, 'admin');
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

      expect(mockAttachments.addAttachment).toHaveBeenCalledWith(1, attachmentData);
    });
  });

  // =============================================================
  // Delegation: Confirmations
  // =============================================================

  describe('getUnconfirmedCount', () => {
    it('fetches org info then delegates to confirmationsService', async () => {
      // Scope mock (default = full) provides org info via getExtendedUserOrgInfo
      const result = await service.getUnconfirmedCount(3, 42);

      expect(result).toEqual({ count: 0 });
      expect(mockConfirmations.getUnconfirmedCount).toHaveBeenCalledOnce();
    });
  });

  describe('confirmSuggestion', () => {
    it('delegates to confirmationsService', async () => {
      const result = await service.confirmSuggestion('test-uuid', 3, 42);

      expect(result).toEqual({ success: true });
      expect(mockConfirmations.confirmSuggestion).toHaveBeenCalledWith('test-uuid', 3, 42);
    });
  });

  describe('unconfirmSuggestion', () => {
    it('delegates to confirmationsService', async () => {
      const result = await service.unconfirmSuggestion('test-uuid', 3, 42);

      expect(result).toEqual({ success: true });
      expect(mockConfirmations.unconfirmSuggestion).toHaveBeenCalledWith('test-uuid', 3, 42);
    });
  });

  // =============================================================
  // getUserTeamId (private) — line 468
  // =============================================================

  describe('getUserTeamId (private)', () => {
    it('should throw ForbiddenException when user has no team', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no team found

      await expect(service['getUserTeamId'](3, 42)).rejects.toThrow(ForbiddenException);
    });

    it('should return team_id when user is assigned', async () => {
      mockDb.query.mockResolvedValueOnce([{ team_id: 86 }]);

      const teamId = await service['getUserTeamId'](3, 42);

      expect(teamId).toBe(86);
    });
  });

  // =============================================================
  // getKvpSettings + updateKvpSettings — lines 535-558
  // =============================================================

  describe('getKvpSettings', () => {
    it('should return daily limit from tenant addon settings', async () => {
      mockDb.query.mockResolvedValueOnce([{ daily_limit: 5 }]);

      const result = await service.getKvpSettings(42);

      expect(result).toEqual({ dailyLimit: 5 });
    });

    it('should default to 1 when no addon config found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getKvpSettings(42);

      expect(result).toEqual({ dailyLimit: 1 });
    });
  });

  describe('updateKvpSettings', () => {
    it('should update daily limit and return new value', async () => {
      mockDb.query.mockResolvedValueOnce([]); // UPDATE

      const result = await service.updateKvpSettings(42, 10);

      expect(result).toEqual({ dailyLimit: 10 });
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('UPDATE tenant_addons');
      expect(sql).toContain('daily_limit');
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([10, 42]);
    });
  });
});

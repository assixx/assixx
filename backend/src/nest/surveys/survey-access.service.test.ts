/**
 * Survey Access Service – Unit Tests
 *
 * Tests for pure visibility clause builders + DB-mocked access checks.
 * Private methods tested via bracket notation.
 */
import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { OrganigramSettingsService } from '../organigram/organigram-settings.service.js';
import { SurveyAccessService } from './survey-access.service.js';
import type { DbSurvey } from './surveys.types.js';

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(deputyScope: boolean = true): {
  service: SurveyAccessService;
  mockDb: { query: ReturnType<typeof vi.fn>; tenantQuery: ReturnType<typeof vi.fn> };
  mockOrgSettings: { getDeputyHasLeadScope: ReturnType<typeof vi.fn> };
} {
  const qf = vi.fn();
  const mockDb = { query: qf, tenantQuery: qf };
  // ADR-039: deputy scope toggle — default true preserves legacy behavior for existing tests
  const mockOrgSettings = {
    getDeputyHasLeadScope: vi.fn().mockResolvedValue(deputyScope),
  };
  const service = new SurveyAccessService(
    mockDb as unknown as DatabaseService,
    mockOrgSettings as unknown as OrganigramSettingsService,
  );
  return { service, mockDb, mockOrgSettings };
}

/** Minimal DbSurvey factory for test brevity */
function makeSurvey(overrides: Partial<DbSurvey> = {}): DbSurvey {
  return {
    id: 1,
    uuid: 'test-uuid',
    tenant_id: 1,
    title: 'Test Survey',
    created_by: 10,
    status: 'active',
    is_anonymous: false,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

// ============================================================
// Pure Clause Builders
// ============================================================

describe('SECURITY: SurveyAccessService – pure clause builders', () => {
  let service: SurveyAccessService;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
  });

  describe('buildVisibilityClause', () => {
    it('returns SQL fragment with tenant and user params', () => {
      const clause = service['buildVisibilityClause']('$1', '$2', true);

      expect(clause).toContain('s.created_by = $2');
      expect(clause).toContain('sa.assignment_type');
      expect(clause).toContain('all_users');
      expect(clause).toContain('area');
      expect(clause).toContain('department');
      expect(clause).toContain('team');
      expect(clause).toContain('user');
    });

    it('substitutes custom parameter placeholders', () => {
      const clause = service['buildVisibilityClause']('$5', '$6', true);

      expect(clause).toContain('s.created_by = $6');
      expect(clause).toContain('aap.tenant_id = $5');
      expect(clause).toContain('aap.admin_user_id = $6');
    });

    // ==========================================================
    // REGRESSION: Deputy lead visibility at ALL org levels
    // These tests prevent accidental removal of deputy checks.
    // If any deputy_lead_id check is removed from the SQL,
    // the corresponding test will fail immediately.
    // ==========================================================

    it('REGRESSION: includes area_deputy_lead_id for area-assigned surveys', () => {
      const clause = service['buildVisibilityClause']('$1', '$2', true);

      expect(clause).toContain('area_deputy_lead_id');
    });

    it('REGRESSION: includes department_deputy_lead_id for dept-assigned surveys', () => {
      const clause = service['buildVisibilityClause']('$1', '$2', true);

      expect(clause).toContain('department_deputy_lead_id');
    });

    it('REGRESSION: includes team_deputy_lead_id for team-assigned surveys', () => {
      const clause = service['buildVisibilityClause']('$1', '$2', true);

      expect(clause).toContain('team_deputy_lead_id');
    });
  });

  describe('buildManagementVisibilityClause', () => {
    it('returns stricter SQL fragment for management access', () => {
      const clause = service['buildManagementVisibilityClause']('$1', '$2', true);

      expect(clause).toContain('s.created_by = $2');
      expect(clause).toContain('area_lead_id');
      expect(clause).toContain('department_lead_id');
      expect(clause).toContain('team_lead_id');
      // Management clause should NOT contain 'all_users'
      expect(clause).not.toContain("sa.assignment_type = 'all_users'");
    });

    it('substitutes custom parameter placeholders', () => {
      const clause = service['buildManagementVisibilityClause']('$3', '$4', true);

      expect(clause).toContain('s.created_by = $4');
      expect(clause).toContain('a.tenant_id = $3');
      expect(clause).toContain('a.area_lead_id = $4');
    });

    // ==========================================================
    // REGRESSION: Deputy lead management at ALL org levels
    // ==========================================================

    it('REGRESSION: includes area_deputy_lead_id for area management', () => {
      const clause = service['buildManagementVisibilityClause']('$1', '$2', true);

      expect(clause).toContain('area_deputy_lead_id');
    });

    it('REGRESSION: includes department_deputy_lead_id for dept management', () => {
      const clause = service['buildManagementVisibilityClause']('$1', '$2', true);

      expect(clause).toContain('department_deputy_lead_id');
    });

    it('REGRESSION: includes team_deputy_lead_id for team management', () => {
      const clause = service['buildManagementVisibilityClause']('$1', '$2', true);

      expect(clause).toContain('team_deputy_lead_id');
    });
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('SECURITY: SurveyAccessService – DB-mocked methods', () => {
  let service: SurveyAccessService;
  let mockDb: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
  });

  describe('checkUnrestrictedAccess', () => {
    it('returns true for root role without DB query', async () => {
      const result = await service.checkUnrestrictedAccess(1, 1, 'root');

      expect(result).toBe(true);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns true when user has has_full_access', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: true }]);

      const result = await service.checkUnrestrictedAccess(1, 1, 'admin');

      expect(result).toBe(true);
    });

    it('returns false when user lacks has_full_access', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]);

      const result = await service.checkUnrestrictedAccess(1, 1, 'admin');

      expect(result).toBe(false);
    });

    it('returns false when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkUnrestrictedAccess(999, 1, 'employee');

      expect(result).toBe(false);
    });

    it('queries with correct userId and tenantId params', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]);

      await service.checkUnrestrictedAccess(42, 7, 'admin');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('has_full_access'),
        [42, 7],
      );
    });
  });

  // ============================================================
  // checkSurveyAccess
  // ============================================================

  describe('checkSurveyAccess', () => {
    it('skips DB check for root user', async () => {
      await service.checkSurveyAccess(1, 1, 5, 'root');

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('skips visibility query when has_full_access is true', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: true }]);

      await service.checkSurveyAccess(10, 1, 5, 'admin');

      // Only the checkUnrestrictedAccess query, NOT the visibility query
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('allows access when visibility query returns rows', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ has_full_access: false }])
        .mockResolvedValueOnce([{ id: 10 }]);

      await expect(service.checkSurveyAccess(10, 1, 5, 'employee')).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when user has no access', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]).mockResolvedValueOnce([]);

      await expect(service.checkSurveyAccess(1, 1, 5, 'employee')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('passes correct params to visibility query', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ has_full_access: false }])
        .mockResolvedValueOnce([{ id: 10 }]);

      await service.checkSurveyAccess(10, 2, 5, 'employee');

      const visibilityCall = mockDb.query.mock.calls[1];
      expect(visibilityCall?.[1]).toEqual([10, 2, 5]);
    });
  });

  // ============================================================
  // checkSurveyManagementAccess
  // ============================================================

  describe('checkSurveyManagementAccess', () => {
    it('skips management query for root user', async () => {
      await service.checkSurveyManagementAccess(1, 1, 5, 'root');

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('skips management query when has_full_access is true', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: true }]);

      await service.checkSurveyManagementAccess(10, 1, 5, 'admin');

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('allows access when management query returns rows', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ has_full_access: false }])
        .mockResolvedValueOnce([{ id: 10 }]);

      await expect(service.checkSurveyManagementAccess(10, 1, 5, 'admin')).resolves.toBeUndefined();
    });

    // ADR-020: Employee-lead with surveys-manage.canWrite + lead of assigned
    // org unit can manage that survey. The role gate was removed from the
    // controller; scope enforcement happens here via buildManagementVisibilityClause.
    it('allows employee role when management visibility query returns rows (lead scenario)', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ has_full_access: false }])
        .mockResolvedValueOnce([{ id: 10 }]);

      await expect(
        service.checkSurveyManagementAccess(10, 1, 5, 'employee'),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when no management permission', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]).mockResolvedValueOnce([]);

      await expect(service.checkSurveyManagementAccess(1, 1, 5, 'employee')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws with descriptive message', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]).mockResolvedValueOnce([]);

      await expect(service.checkSurveyManagementAccess(1, 1, 5, 'employee')).rejects.toThrow(
        'No management permission for this survey',
      );
    });
  });

  // ============================================================
  // fetchSurveysByAccessLevel
  // ============================================================

  describe('fetchSurveysByAccessLevel', () => {
    const tenantId = 1;
    const userId = 5;
    const limit = 10;
    const offset = 0;

    it('calls unrestricted query when hasUnrestrictedAccess is true', async () => {
      const surveys = [makeSurvey({ id: 1 }), makeSurvey({ id: 2 })];
      mockDb.query.mockResolvedValueOnce(surveys);

      const result = await service.fetchSurveysByAccessLevel(
        tenantId,
        userId,
        undefined,
        limit,
        offset,
        true,
        false,
      );

      expect(result).toEqual(surveys);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      // Unrestricted query has no visibility clause — no 'all_users' assignment check
      expect(sql).toContain('s.tenant_id = $1');
      expect(sql).not.toContain('all_users');
    });

    it('calls unrestricted query with status filter', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.fetchSurveysByAccessLevel(
        tenantId,
        userId,
        'active',
        limit,
        offset,
        true,
        false,
      );

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('s.status = $2');
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain('active');
    });

    it('calls manageable query when isManageMode is true', async () => {
      const surveys = [makeSurvey({ id: 3 })];
      mockDb.query.mockResolvedValueOnce(surveys);

      const result = await service.fetchSurveysByAccessLevel(
        tenantId,
        userId,
        undefined,
        limit,
        offset,
        false,
        true,
      );

      expect(result).toEqual(surveys);
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      // Management clause includes created_by check
      expect(sql).toContain('s.created_by');
    });

    it('calls manageable query with status filter', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.fetchSurveysByAccessLevel(
        tenantId,
        userId,
        'closed',
        limit,
        offset,
        false,
        true,
      );

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain('closed');
    });

    it('calls visibility query when not unrestricted and not manage mode', async () => {
      const surveys = [makeSurvey({ id: 4 })];
      mockDb.query.mockResolvedValueOnce(surveys);

      const result = await service.fetchSurveysByAccessLevel(
        tenantId,
        userId,
        undefined,
        limit,
        offset,
        false,
        false,
      );

      expect(result).toEqual(surveys);
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      // Visibility clause includes user-level assignment check
      expect(sql).toContain('s.created_by');
      expect(sql).toContain('all_users');
    });

    it('calls visibility query with status filter', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.fetchSurveysByAccessLevel(
        tenantId,
        userId,
        'draft',
        limit,
        offset,
        false,
        false,
      );

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain('draft');
    });

    it('passes limit and offset as last params (unrestricted, no status)', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.fetchSurveysByAccessLevel(tenantId, userId, undefined, 25, 50, true, false);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      // [tenantId, limit, offset]
      expect(params).toEqual([tenantId, 25, 50]);
    });

    it('passes limit and offset as last params (unrestricted, with status)', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.fetchSurveysByAccessLevel(tenantId, userId, 'active', 25, 50, true, false);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      // [tenantId, status, limit, offset]
      expect(params).toEqual([tenantId, 'active', 25, 50]);
    });

    it('passes limit and offset as last params (visibility, no status)', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.fetchSurveysByAccessLevel(tenantId, userId, undefined, 10, 20, false, false);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      // [tenantId, userId, limit, offset]
      expect(params).toEqual([tenantId, userId, 10, 20]);
    });

    it('passes limit and offset as last params (visibility, with status)', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.fetchSurveysByAccessLevel(tenantId, userId, 'active', 10, 20, false, false);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      // [tenantId, userId, status, limit, offset]
      expect(params).toEqual([tenantId, userId, 'active', 10, 20]);
    });
  });

  // ============================================================
  // getManageableSurveyIds
  // ============================================================

  describe('getManageableSurveyIds', () => {
    it('returns empty set for empty input', async () => {
      const result = await service.getManageableSurveyIds([], 1, 5);

      expect(result.size).toBe(0);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns set of manageable IDs', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }, { id: 3 }]);

      const result = await service.getManageableSurveyIds([1, 2, 3], 1, 5);

      expect(result.size).toBe(2);
      expect(result.has(1)).toBe(true);
      expect(result.has(3)).toBe(true);
      expect(result.has(2)).toBe(false);
    });

    it('builds correct placeholders for single survey ID', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 99 }]);

      await service.getManageableSurveyIds([99], 1, 5);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('s.id IN ($1)');
      expect(sql).toContain('s.tenant_id = $2');
    });

    it('builds correct placeholders for multiple survey IDs', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getManageableSurveyIds([10, 20, 30], 1, 5);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('s.id IN ($1,$2,$3)');
      expect(sql).toContain('s.tenant_id = $4');
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([10, 20, 30, 1, 5]);
    });
  });

  // ============================================================
  // attachAssignmentsToSurveys
  // ============================================================

  describe('attachAssignmentsToSurveys', () => {
    it('returns early for empty surveys array', async () => {
      await service.attachAssignmentsToSurveys([], 1);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('attaches assignments to a single survey', async () => {
      const survey = makeSurvey({ id: 5 });
      const assignments = [
        {
          id: 100,
          survey_id: 5,
          assignment_type: 'area' as const,
          area_id: 1,
          area_name: 'Production',
        },
      ];
      mockDb.query.mockResolvedValueOnce(assignments);

      await service.attachAssignmentsToSurveys([survey], 1);

      expect(survey.assignments).toHaveLength(1);
      expect(survey.assignments?.[0]?.area_name).toBe('Production');
    });

    it('attaches assignments grouped by survey_id for multiple surveys', async () => {
      const survey1 = makeSurvey({ id: 10 });
      const survey2 = makeSurvey({ id: 20 });
      const assignments = [
        { id: 1, survey_id: 10, assignment_type: 'area' as const },
        { id: 2, survey_id: 10, assignment_type: 'department' as const },
        { id: 3, survey_id: 20, assignment_type: 'all_users' as const },
      ];
      mockDb.query.mockResolvedValueOnce(assignments);

      await service.attachAssignmentsToSurveys([survey1, survey2], 1);

      expect(survey1.assignments).toHaveLength(2);
      expect(survey2.assignments).toHaveLength(1);
    });

    it('sets empty assignments array for surveys with no matching rows', async () => {
      const survey1 = makeSurvey({ id: 10 });
      const survey2 = makeSurvey({ id: 20 });
      mockDb.query.mockResolvedValueOnce([
        { id: 1, survey_id: 10, assignment_type: 'team' as const },
      ]);

      await service.attachAssignmentsToSurveys([survey1, survey2], 1);

      expect(survey1.assignments).toHaveLength(1);
      expect(survey2.assignments).toEqual([]);
    });

    it('builds correct SQL placeholders for survey IDs', async () => {
      const surveys = [makeSurvey({ id: 1 }), makeSurvey({ id: 2 }), makeSurvey({ id: 3 })];
      mockDb.query.mockResolvedValueOnce([]);

      await service.attachAssignmentsToSurveys(surveys, 7);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('sa.survey_id IN ($1,$2,$3)');
      expect(sql).toContain('sa.tenant_id = $4');
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([1, 2, 3, 7]);
    });
  });

  // ============================================================
  // validateAssignmentPermissions
  // ============================================================

  describe('validateAssignmentPermissions', () => {
    it('returns early for empty assignments', async () => {
      await service.validateAssignmentPermissions(1, 1, 'admin', []);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns early for root user', async () => {
      await service.validateAssignmentPermissions(1, 1, 'root', [{ type: 'all_users' }]);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns early for has_full_access user', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: true }]);

      await service.validateAssignmentPermissions(1, 1, 'admin', [{ type: 'all_users' }]);

      // Only the checkUnrestrictedAccess query
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException for all_users assignment by non-root', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]);

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [{ type: 'all_users' }]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws descriptive message for all_users assignment', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]);

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [{ type: 'all_users' }]),
      ).rejects.toThrow('Only users with full access can assign to the entire company');
    });

    it('throws ForbiddenException when user is not area lead', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]).mockResolvedValueOnce([]);

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [{ type: 'area', areaId: 5 }]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validates area assignment successfully when user is lead', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ has_full_access: false }])
        .mockResolvedValueOnce([{ id: 5 }]);

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [{ type: 'area', areaId: 5 }]),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when user is not department lead', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]).mockResolvedValueOnce([]);

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [
          { type: 'department', departmentId: 3 },
        ]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validates department assignment successfully when user is lead', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ has_full_access: false }])
        .mockResolvedValueOnce([{ id: 3 }]);

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [
          { type: 'department', departmentId: 3 },
        ]),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when user is not team lead', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]).mockResolvedValueOnce([]);

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [{ type: 'team', teamId: 8 }]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validates team assignment successfully when user is lead', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ has_full_access: false }])
        .mockResolvedValueOnce([{ id: 8 }]);

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [{ type: 'team', teamId: 8 }]),
      ).resolves.toBeUndefined();
    });

    it('does not throw for user assignment type (default branch)', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]);

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [{ type: 'user', userId: 99 }]),
      ).resolves.toBeUndefined();
    });

    it('does not throw for unknown assignment type (default branch)', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]);

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [{ type: 'unknown_type' }]),
      ).resolves.toBeUndefined();
    });

    it('validates multiple assignments sequentially', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ has_full_access: false }])
        .mockResolvedValueOnce([{ id: 5 }]) // area lead check
        .mockResolvedValueOnce([{ id: 3 }]); // department lead check

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [
          { type: 'area', areaId: 5 },
          { type: 'department', departmentId: 3 },
        ]),
      ).resolves.toBeUndefined();

      // 1 checkUnrestrictedAccess + 2 leadership queries
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('stops on first failing assignment in sequence', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]).mockResolvedValueOnce([]); // first assignment fails

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [
          { type: 'area', areaId: 5 },
          { type: 'department', departmentId: 3 },
        ]),
      ).rejects.toThrow(ForbiddenException);

      // 1 checkUnrestrictedAccess + 1 failed leadership query (second never runs)
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================
  // validateSingleAssignment (private)
  // ============================================================

  describe('validateSingleAssignment (private)', () => {
    it('skips leadership check when area assignment has no areaId', async () => {
      await service['validateSingleAssignment']({ type: 'area', areaId: undefined }, 1, 1, true);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('skips leadership check when department assignment has no departmentId', async () => {
      await service['validateSingleAssignment'](
        { type: 'department', departmentId: undefined },
        1,
        1,
        true,
      );

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('skips leadership check when team assignment has no teamId', async () => {
      await service['validateSingleAssignment']({ type: 'team', teamId: undefined }, 1, 1, true);

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // validateLeadershipPermission (private)
  // ============================================================

  // ==========================================================
  // REGRESSION: Leadership queries include deputy checks when deputyScope=true
  // ADR-039: deputy predicates are conditional — flag=true emits them,
  // flag=false omits them. These tests assert ON behavior (legacy default).
  // ==========================================================

  describe('REGRESSION: Leadership queries include deputy checks (deputyScope=true)', () => {
    it('area query includes area_deputy_lead_id', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);

      await service['validateLeadershipPermission']('area', 5, 1, 1, true);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('area_deputy_lead_id');
    });

    it('department query includes department_deputy_lead_id', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 3 }]);

      await service['validateLeadershipPermission']('department', 3, 1, 1, true);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('department_deputy_lead_id');
    });

    it('department query includes area_deputy_lead_id (inherited)', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 3 }]);

      await service['validateLeadershipPermission']('department', 3, 1, 1, true);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('area_deputy_lead_id');
    });

    it('team query includes team_deputy_lead_id', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 8 }]);

      await service['validateLeadershipPermission']('team', 8, 1, 1, true);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('team_deputy_lead_id');
    });

    it('team query includes department_deputy_lead_id (inherited)', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 8 }]);

      await service['validateLeadershipPermission']('team', 8, 1, 1, true);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('department_deputy_lead_id');
    });

    it('team query includes area_deputy_lead_id (inherited)', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 8 }]);

      await service['validateLeadershipPermission']('team', 8, 1, 1, true);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('area_deputy_lead_id');
    });
  });

  // ==========================================================
  // ADR-039: Leadership queries OMIT deputy checks when deputyScope=false
  // ==========================================================

  describe('ADR-039: Leadership queries OMIT deputy checks (deputyScope=false)', () => {
    it('area query does NOT include area_deputy_lead_id when flag is off', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);

      await service['validateLeadershipPermission']('area', 5, 1, 1, false);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).not.toContain('area_deputy_lead_id');
      expect(sql).toContain('area_lead_id'); // primary lead predicate still present
    });

    it('department query does NOT include deputy_lead_id when flag is off', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 3 }]);

      await service['validateLeadershipPermission']('department', 3, 1, 1, false);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).not.toContain('department_deputy_lead_id');
      expect(sql).not.toContain('area_deputy_lead_id');
      expect(sql).toContain('department_lead_id');
    });

    it('team query does NOT include deputy_lead_id when flag is off', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 8 }]);

      await service['validateLeadershipPermission']('team', 8, 1, 1, false);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).not.toContain('team_deputy_lead_id');
      expect(sql).not.toContain('department_deputy_lead_id');
      expect(sql).not.toContain('area_deputy_lead_id');
      expect(sql).toContain('team_lead_id');
    });

    it('buildVisibilityClause omits all deputy predicates when flag is off', () => {
      const clause = service['buildVisibilityClause']('$1', '$2', false);
      expect(clause).not.toContain('area_deputy_lead_id');
      expect(clause).not.toContain('department_deputy_lead_id');
      expect(clause).not.toContain('team_deputy_lead_id');
      // primary leads still present
      expect(clause).toContain('area_lead_id');
      expect(clause).toContain('department_lead_id');
      expect(clause).toContain('team_lead_id');
    });

    it('buildManagementVisibilityClause omits all deputy predicates when flag is off', () => {
      const clause = service['buildManagementVisibilityClause']('$1', '$2', false);
      expect(clause).not.toContain('area_deputy_lead_id');
      expect(clause).not.toContain('department_deputy_lead_id');
      expect(clause).not.toContain('team_deputy_lead_id');
    });
  });

  describe('validateLeadershipPermission (private)', () => {
    it('returns early when entityId is undefined', async () => {
      await service['validateLeadershipPermission']('area', undefined, 1, 1, true);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns early when entityType is not area/department/team', async () => {
      await service['validateLeadershipPermission']('nonexistent_type', 5, 1, 1, true);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('passes through when leadership query returns rows', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);

      await expect(
        service['validateLeadershipPermission']('area', 5, 1, 1, true),
      ).resolves.toBeUndefined();

      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('areas'), [5, 1, 1]);
    });

    it('throws ForbiddenException when leadership query returns empty', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service['validateLeadershipPermission']('area', 5, 42, 7, true)).rejects.toThrow(
        'No leadership permission for area 5',
      );
    });

    it('uses department query for department entityType', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 3 }]);

      await service['validateLeadershipPermission']('department', 3, 1, 1, true);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('departments');
      expect(sql).toContain('department_lead_id');
    });

    it('uses team query for team entityType', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 8 }]);

      await service['validateLeadershipPermission']('team', 8, 1, 1, true);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('teams');
    });
  });

  // ============================================================
  // getPendingSurveyCount
  // ============================================================

  describe('getPendingSurveyCount', () => {
    it('returns count of pending surveys', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: 3 }]);

      const result = await service.getPendingSurveyCount(5, 1);

      expect(result.count).toBe(3);
    });

    it('returns 0 when no pending surveys', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: 0 }]);

      const result = await service.getPendingSurveyCount(5, 1);

      expect(result.count).toBe(0);
    });

    it('returns 0 when DB returns empty array (null-coalescing fallback)', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getPendingSurveyCount(5, 1);

      expect(result.count).toBe(0);
    });

    it('passes tenantId and userId as query params', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: 0 }]);

      await service.getPendingSurveyCount(42, 7);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(DISTINCT s.id)'),
        [7, 42],
      );
    });

    it('filters for active status and completed responses', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: 2 }]);

      await service.getPendingSurveyCount(5, 1);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain("s.status = 'active'");
      expect(sql).toContain("sr.status = 'completed'");
      expect(sql).toContain('sr.id IS NULL');
    });
  });
});

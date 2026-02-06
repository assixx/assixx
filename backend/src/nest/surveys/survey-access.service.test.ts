/**
 * Survey Access Service – Unit Tests
 *
 * Tests for pure visibility clause builders + DB-mocked access checks.
 * Private methods tested via bracket notation.
 */
import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { SurveyAccessService } from './survey-access.service.js';

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(): {
  service: SurveyAccessService;
  mockDb: { query: ReturnType<typeof vi.fn> };
} {
  const mockDb = { query: vi.fn() };
  const service = new SurveyAccessService(mockDb as unknown as DatabaseService);
  return { service, mockDb };
}

// ============================================================
// Pure Clause Builders
// ============================================================

describe('SurveyAccessService – pure clause builders', () => {
  let service: SurveyAccessService;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
  });

  describe('buildVisibilityClause', () => {
    it('returns SQL fragment with tenant and user params', () => {
      const clause = service['buildVisibilityClause']('$1', '$2');

      expect(clause).toContain('s.created_by = $2');
      expect(clause).toContain('sa.assignment_type');
      expect(clause).toContain('all_users');
      expect(clause).toContain('area');
      expect(clause).toContain('department');
      expect(clause).toContain('team');
      expect(clause).toContain('user');
    });
  });

  describe('buildManagementVisibilityClause', () => {
    it('returns stricter SQL fragment for management access', () => {
      const clause = service['buildManagementVisibilityClause']('$1', '$2');

      expect(clause).toContain('s.created_by = $2');
      expect(clause).toContain('area_lead_id');
      expect(clause).toContain('department_lead_id');
      expect(clause).toContain('team_lead_id');
      // Management clause should NOT contain 'all_users'
      expect(clause).not.toContain("sa.assignment_type = 'all_users'");
    });
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('SurveyAccessService – DB-mocked methods', () => {
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
  });

  describe('checkSurveyAccess', () => {
    it('skips DB check for root user', async () => {
      await service.checkSurveyAccess(1, 1, 5, 'root');

      // Only the checkUnrestrictedAccess call, not the survey visibility query
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when user has no access', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ has_full_access: false }]) // checkUnrestrictedAccess
        .mockResolvedValueOnce([]); // visibility query returns nothing

      await expect(
        service.checkSurveyAccess(1, 1, 5, 'employee'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('checkSurveyManagementAccess', () => {
    it('throws ForbiddenException when no management permission', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ has_full_access: false }]) // checkUnrestrictedAccess
        .mockResolvedValueOnce([]); // management query returns nothing

      await expect(
        service.checkSurveyManagementAccess(1, 1, 5, 'employee'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('validateAssignmentPermissions', () => {
    it('returns early for empty assignments', async () => {
      await service.validateAssignmentPermissions(1, 1, 'admin', []);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns early for root user', async () => {
      await service.validateAssignmentPermissions(1, 1, 'root', [
        { type: 'all_users' },
      ]);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException for all_users assignment by non-root', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]); // checkUnrestrictedAccess

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [
          { type: 'all_users' },
        ]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user is not area lead', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ has_full_access: false }]) // checkUnrestrictedAccess
        .mockResolvedValueOnce([]); // leadership query returns nothing

      await expect(
        service.validateAssignmentPermissions(1, 1, 'admin', [
          { type: 'area', areaId: 5 },
        ]),
      ).rejects.toThrow(ForbiddenException);
    });
  });

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
  });

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
  });
});

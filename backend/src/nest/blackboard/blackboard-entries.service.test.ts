/**
 * Blackboard Entries Service – Unit Tests
 *
 * Tests for pure private methods + DB-mocked error paths.
 * Private methods tested via bracket notation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { BlackboardAccessService } from './blackboard-access.service.js';
import { BlackboardEntriesService } from './blackboard-entries.service.js';

// ============================================================
// Setup
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
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  };

  const service = new BlackboardEntriesService(
    mockDb as unknown as DatabaseService,
    mockAccessService as unknown as BlackboardAccessService,
    mockActivityLogger as unknown as ActivityLoggerService,
  );

  return { service, mockDb, mockAccessService, mockActivityLogger };
}

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

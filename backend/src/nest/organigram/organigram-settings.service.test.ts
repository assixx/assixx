import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { OrganigramSettingsService } from './organigram-settings.service.js';
import { DEFAULT_HIERARCHY_LABELS } from './organigram.types.js';

// =============================================================
// Mocks
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    tenantTransaction: vi.fn(),
    getUserId: vi.fn().mockReturnValue(1),
  };
}

function createMockActivityLogger() {
  return {
    logUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// =============================================================
// Tests
// =============================================================

describe('OrganigramSettingsService', () => {
  let service: OrganigramSettingsService;
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    const mockActivityLogger = createMockActivityLogger();
    service = new OrganigramSettingsService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================================
  // getHierarchyLabels
  // =============================================================

  describe('getHierarchyLabels', () => {
    it('should return defaults when tenant has no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getHierarchyLabels(1);

      expect(result).toEqual(DEFAULT_HIERARCHY_LABELS);
    });

    it('should return defaults when settings is null', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);

      const result = await service.getHierarchyLabels(1);

      expect(result).toEqual(DEFAULT_HIERARCHY_LABELS);
    });

    it('should return defaults when orgHierarchy key is missing', async () => {
      mockDb.query.mockResolvedValueOnce([
        { settings: { someOtherKey: true } },
      ]);

      const result = await service.getHierarchyLabels(1);

      expect(result).toEqual(DEFAULT_HIERARCHY_LABELS);
    });

    it('should return defaults when orgHierarchy.levels is undefined', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { orgHierarchy: {} } }]);

      const result = await service.getHierarchyLabels(1);

      expect(result).toEqual(DEFAULT_HIERARCHY_LABELS);
    });

    it('should merge partial overrides with defaults', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          settings: {
            orgHierarchy: {
              levels: {
                area: 'Werke',
              },
            },
          },
        },
      ]);

      const result = await service.getHierarchyLabels(1);

      expect(result.area).toBe('Werke');
      expect(result.department).toBe(DEFAULT_HIERARCHY_LABELS.department);
      expect(result.team).toBe(DEFAULT_HIERARCHY_LABELS.team);
      expect(result.asset).toBe(DEFAULT_HIERARCHY_LABELS.asset);
    });

    it('should return fully overridden labels', async () => {
      const custom = {
        area: 'Werke',
        department: 'Einheiten',
        team: 'Gruppen',
        asset: 'Maschinen',
      };
      mockDb.query.mockResolvedValueOnce([
        {
          settings: { orgHierarchy: { levels: custom } },
        },
      ]);

      const result = await service.getHierarchyLabels(1);

      expect(result).toEqual(custom);
    });

    it('should query with correct tenant_id', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getHierarchyLabels(42);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT settings FROM tenants'),
        [42],
      );
    });
  });

  // =============================================================
  // updateHierarchyLabels
  // =============================================================

  describe('updateHierarchyLabels', () => {
    let mockClient: { query: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockClient = { query: vi.fn() };
      mockDb.tenantTransaction.mockImplementation(
        async (fn: (client: typeof mockClient) => Promise<void>) =>
          fn(mockClient),
      );
    });

    it('should merge partial update with defaults when no prior settings', async () => {
      // Call 1: getHierarchyLabels → SELECT settings
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);
      // Call 2: settingsRows → SELECT settings
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);

      const result = await service.updateHierarchyLabels(1, {
        levels: { area: 'Werke' },
      });

      expect(result.area).toBe('Werke');
      expect(result.department).toBe(DEFAULT_HIERARCHY_LABELS.department);
      expect(result.team).toBe(DEFAULT_HIERARCHY_LABELS.team);
      expect(result.asset).toBe(DEFAULT_HIERARCHY_LABELS.asset);
    });

    it('should merge partial update with existing labels', async () => {
      const existingSettings = {
        orgHierarchy: {
          levels: {
            area: 'Alte',
            department: 'Sektoren',
          },
        },
      };
      mockDb.query.mockResolvedValueOnce([{ settings: existingSettings }]);
      mockDb.query.mockResolvedValueOnce([{ settings: existingSettings }]);

      const result = await service.updateHierarchyLabels(1, {
        levels: { area: 'Neue' },
      });

      // area overridden by dto
      expect(result.area).toBe('Neue');
      // department preserved from existing
      expect(result.department).toBe('Sektoren');
    });

    it('should preserve other settings keys during write', async () => {
      const existingSettings = {
        someFeature: { enabled: true },
        orgHierarchy: { levels: {} },
      };
      mockDb.query.mockResolvedValueOnce([{ settings: existingSettings }]);
      mockDb.query.mockResolvedValueOnce([{ settings: existingSettings }]);

      await service.updateHierarchyLabels(1, {
        levels: { team: 'Crews' },
      });

      const writtenJson = mockClient.query.mock.calls[0]?.[1]?.[0] as string;
      const writtenSettings = JSON.parse(writtenJson) as Record<
        string,
        unknown
      >;
      expect(writtenSettings['someFeature']).toEqual({ enabled: true });
    });

    it('should use tenantTransaction for the UPDATE', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);

      await service.updateHierarchyLabels(1, {
        levels: { asset: 'Geräte' },
      });

      expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('UPDATE tenants SET settings');
    });

    it('should return the merged result', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);

      const result = await service.updateHierarchyLabels(1, {
        levels: {
          area: 'As',
          department: 'Bs',
          team: 'Cs',
          asset: 'Ds',
        },
      });

      expect(result).toEqual({
        area: 'As',
        department: 'Bs',
        team: 'Cs',
        asset: 'Ds',
      });
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { OrganigramSettingsService } from './organigram-settings.service.js';
import { DEFAULT_HIERARCHY_LABELS, DEFAULT_VIEWPORT } from './organigram.types.js';

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
  // getViewport
  // =============================================================

  describe('getViewport', () => {
    it('should return defaults when tenant has no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getViewport(1);

      expect(result).toEqual(DEFAULT_VIEWPORT);
    });

    it('should return defaults when settings is null', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);

      const result = await service.getViewport(1);

      expect(result).toEqual(DEFAULT_VIEWPORT);
    });

    it('should return defaults when orgViewport key is missing', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { someOtherKey: true } }]);

      const result = await service.getViewport(1);

      expect(result).toEqual(DEFAULT_VIEWPORT);
    });

    it('should return stored viewport when present', async () => {
      const custom = { zoom: 1.5, panX: 100, panY: -50, fontSize: 16 };
      mockDb.query.mockResolvedValueOnce([{ settings: { orgViewport: custom } }]);

      const result = await service.getViewport(1);

      expect(result).toEqual(custom);
    });

    it('should fill missing viewport fields from defaults', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { orgViewport: { zoom: 2 } } }]);

      const result = await service.getViewport(1);

      expect(result.zoom).toBe(2);
      expect(result.panX).toBe(DEFAULT_VIEWPORT.panX);
      expect(result.panY).toBe(DEFAULT_VIEWPORT.panY);
      expect(result.fontSize).toBe(DEFAULT_VIEWPORT.fontSize);
    });

    it('should return defaults when first row is undefined', async () => {
      mockDb.query.mockResolvedValueOnce([undefined]);

      const result = await service.getViewport(1);

      expect(result).toEqual(DEFAULT_VIEWPORT);
    });
  });

  // =============================================================
  // getHallOverrides
  // =============================================================

  describe('getHallOverrides', () => {
    it('should return empty object when no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getHallOverrides(1);

      expect(result).toEqual({});
    });

    it('should return empty object when settings is null', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);

      const result = await service.getHallOverrides(1);

      expect(result).toEqual({});
    });

    it('should return empty object when orgHallOverrides is missing', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { someOtherKey: true } }]);

      const result = await service.getHallOverrides(1);

      expect(result).toEqual({});
    });

    it('should return stored overrides when present', async () => {
      const overrides = {
        'area-uuid-1': { x: 10, y: 20, width: 300, height: 200 },
      };
      mockDb.query.mockResolvedValueOnce([{ settings: { orgHallOverrides: overrides } }]);

      const result = await service.getHallOverrides(1);

      expect(result).toEqual(overrides);
    });
  });

  // =============================================================
  // getCanvasBg
  // =============================================================

  describe('getCanvasBg', () => {
    it('should return null when no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCanvasBg(1);

      expect(result).toBeNull();
    });

    it('should return null when settings is null', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);

      const result = await service.getCanvasBg(1);

      expect(result).toBeNull();
    });

    it('should return null when orgCanvasBg key is missing', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { someOtherKey: true } }]);

      const result = await service.getCanvasBg(1);

      expect(result).toBeNull();
    });

    it('should return stored color when present', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { orgCanvasBg: '#1a2b3c' } }]);

      const result = await service.getCanvasBg(1);

      expect(result).toBe('#1a2b3c');
    });

    it('should query with correct tenant_id', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getCanvasBg(42);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT settings FROM tenants'),
        [42],
      );
    });
  });

  // =============================================================
  // saveCanvasBg
  // =============================================================

  describe('saveCanvasBg', () => {
    let mockClient: { query: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockClient = { query: vi.fn() };
      mockDb.tenantTransaction.mockImplementation(
        async (fn: (client: typeof mockClient) => Promise<void>) => fn(mockClient),
      );
    });

    it('should merge canvasBg into existing settings', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { orgHierarchy: { levels: {} } } }]);

      await service.saveCanvasBg(1, '#ff0000');

      const writtenJson = mockClient.query.mock.calls[0]?.[1]?.[0] as string;
      const written = JSON.parse(writtenJson) as Record<string, unknown>;
      expect(written['orgHierarchy']).toEqual({ levels: {} });
      expect(written['orgCanvasBg']).toBe('#ff0000');
    });

    it('should handle empty settings rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.saveCanvasBg(1, '#abcdef');

      const writtenJson = mockClient.query.mock.calls[0]?.[1]?.[0] as string;
      const written = JSON.parse(writtenJson) as Record<string, unknown>;
      expect(written).toEqual({ orgCanvasBg: '#abcdef' });
    });

    it('should handle null settings value', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);

      await service.saveCanvasBg(1, null);

      expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
    });

    it('should save null to clear canvas background', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { orgCanvasBg: '#ff0000' } }]);

      await service.saveCanvasBg(1, null);

      const writtenJson = mockClient.query.mock.calls[0]?.[1]?.[0] as string;
      const written = JSON.parse(writtenJson) as Record<string, unknown>;
      expect(written['orgCanvasBg']).toBeNull();
    });
  });

  // =============================================================
  // saveHallOverrides
  // =============================================================

  describe('saveHallOverrides', () => {
    let mockClient: { query: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockClient = { query: vi.fn() };
      mockDb.tenantTransaction.mockImplementation(
        async (fn: (client: typeof mockClient) => Promise<void>) => fn(mockClient),
      );
    });

    it('should merge overrides into existing settings', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { orgHierarchy: { levels: {} } } }]);

      const overrides = {
        'area-1': { x: 0, y: 0, width: 100, height: 100 },
      };
      await service.saveHallOverrides(1, overrides);

      const writtenJson = mockClient.query.mock.calls[0]?.[1]?.[0] as string;
      const written = JSON.parse(writtenJson) as Record<string, unknown>;
      expect(written['orgHierarchy']).toEqual({ levels: {} });
      expect(written['orgHallOverrides']).toEqual(overrides);
    });

    it('should handle empty settings rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const overrides = {
        'area-1': { x: 0, y: 0, width: 100, height: 100 },
      };
      await service.saveHallOverrides(1, overrides);

      const writtenJson = mockClient.query.mock.calls[0]?.[1]?.[0] as string;
      const written = JSON.parse(writtenJson) as Record<string, unknown>;
      expect(written).toEqual({ orgHallOverrides: overrides });
    });

    it('should handle null settings value', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);

      await service.saveHallOverrides(1, {});

      expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
    });
  });

  // =============================================================
  // getHallConnectionAnchors
  // =============================================================

  describe('getHallConnectionAnchors', () => {
    it('should return empty object when no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getHallConnectionAnchors(1);

      expect(result).toEqual({});
    });

    it('should return empty object when settings is null', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);

      const result = await service.getHallConnectionAnchors(1);

      expect(result).toEqual({});
    });

    it('should return empty object when key is missing', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { someOtherKey: true } }]);

      const result = await service.getHallConnectionAnchors(1);

      expect(result).toEqual({});
    });

    it('should return stored anchors when present', async () => {
      const anchors = {
        'conn-1': { side: 'top', offset: 0.5 },
        'conn-2': { side: 'left', offset: 0.3 },
      };
      mockDb.query.mockResolvedValueOnce([{ settings: { orgHallConnectionAnchors: anchors } }]);

      const result = await service.getHallConnectionAnchors(1);

      expect(result).toEqual(anchors);
    });
  });

  // =============================================================
  // saveHallConnectionAnchors
  // =============================================================

  describe('saveHallConnectionAnchors', () => {
    let mockClient: { query: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockClient = { query: vi.fn() };
      mockDb.tenantTransaction.mockImplementation(
        async (fn: (client: typeof mockClient) => Promise<void>) => fn(mockClient),
      );
    });

    it('should merge anchors into existing settings', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { orgHierarchy: { levels: {} } } }]);

      const anchors = { 'conn-1': { side: 'top', offset: 0.5 } };
      await service.saveHallConnectionAnchors(1, anchors);

      const writtenJson = mockClient.query.mock.calls[0]?.[1]?.[0] as string;
      const written = JSON.parse(writtenJson) as Record<string, unknown>;
      expect(written['orgHierarchy']).toEqual({ levels: {} });
      expect(written['orgHallConnectionAnchors']).toEqual(anchors);
    });

    it('should handle empty settings rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const anchors = { 'conn-1': { side: 'bottom', offset: 0.8 } };
      await service.saveHallConnectionAnchors(1, anchors);

      const writtenJson = mockClient.query.mock.calls[0]?.[1]?.[0] as string;
      const written = JSON.parse(writtenJson) as Record<string, unknown>;
      expect(written).toEqual({ orgHallConnectionAnchors: anchors });
    });

    it('should handle null settings value', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);

      await service.saveHallConnectionAnchors(1, {});

      expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
    });
  });

  // =============================================================
  // saveViewport
  // =============================================================

  describe('saveViewport', () => {
    let mockClient: { query: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockClient = { query: vi.fn() };
      mockDb.tenantTransaction.mockImplementation(
        async (fn: (client: typeof mockClient) => Promise<void>) => fn(mockClient),
      );
    });

    it('should merge viewport into existing settings', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: { orgHierarchy: { levels: {} } } }]);

      const viewport = { zoom: 2, panX: 50, panY: -30, fontSize: 14 };
      await service.saveViewport(1, viewport);

      const writtenJson = mockClient.query.mock.calls[0]?.[1]?.[0] as string;
      const written = JSON.parse(writtenJson) as Record<string, unknown>;
      expect(written['orgHierarchy']).toEqual({ levels: {} });
      expect(written['orgViewport']).toEqual(viewport);
    });

    it('should handle empty settings rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const viewport = { zoom: 1, panX: 0, panY: 0, fontSize: 13 };
      await service.saveViewport(1, viewport);

      const writtenJson = mockClient.query.mock.calls[0]?.[1]?.[0] as string;
      const written = JSON.parse(writtenJson) as Record<string, unknown>;
      expect(written).toEqual({ orgViewport: viewport });
    });

    it('should use tenantTransaction for the UPDATE', async () => {
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);

      await service.saveViewport(1, DEFAULT_VIEWPORT);

      expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('UPDATE tenants SET settings');
    });
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
      mockDb.query.mockResolvedValueOnce([{ settings: { someOtherKey: true } }]);

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

      expect(result.hall).toBe(DEFAULT_HIERARCHY_LABELS.hall);
      expect(result.area).toBe('Werke');
      expect(result.department).toBe(DEFAULT_HIERARCHY_LABELS.department);
      expect(result.team).toBe(DEFAULT_HIERARCHY_LABELS.team);
      expect(result.asset).toBe(DEFAULT_HIERARCHY_LABELS.asset);
    });

    it('should return fully overridden labels', async () => {
      const custom = {
        hall: 'Gebäude',
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
        async (fn: (client: typeof mockClient) => Promise<void>) => fn(mockClient),
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

      expect(result.hall).toBe(DEFAULT_HIERARCHY_LABELS.hall);
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
      const writtenSettings = JSON.parse(writtenJson) as Record<string, unknown>;
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

    it('should handle empty settingsRows when tenant has no row', async () => {
      // Call 1: getHierarchyLabels → no settings
      mockDb.query.mockResolvedValueOnce([{ settings: null }]);
      // Call 2: settingsRows SELECT → empty (tenant row missing during write)
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.updateHierarchyLabels(1, {
        levels: { area: 'Werke' },
      });

      expect(result.area).toBe('Werke');
      expect(result.department).toBe(DEFAULT_HIERARCHY_LABELS.department);

      // Should write with empty base settings (no prior keys to preserve)
      const writtenJson = mockClient.query.mock.calls[0]?.[1]?.[0] as string;
      const writtenSettings = JSON.parse(writtenJson) as Record<string, unknown>;
      expect(writtenSettings).toEqual({
        orgHierarchy: {
          levels: {
            hall: DEFAULT_HIERARCHY_LABELS.hall,
            area: 'Werke',
            department: DEFAULT_HIERARCHY_LABELS.department,
            team: DEFAULT_HIERARCHY_LABELS.team,
            asset: DEFAULT_HIERARCHY_LABELS.asset,
          },
        },
      });
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
        hall: DEFAULT_HIERARCHY_LABELS.hall,
        area: 'As',
        department: 'Bs',
        team: 'Cs',
        asset: 'Ds',
      });
    });
  });
});

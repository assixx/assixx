/**
 * Unit tests for TpmColorConfigService
 *
 * Mocked dependencies: DatabaseService (query, tenantTransaction).
 * Tests: getColors (default fallback, tenant overrides, merge logic),
 * updateColor (UPSERT), resetToDefaults (DELETE + return defaults).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { TpmColorConfigService } from './tpm-color-config.service.js';
import type { TpmColorConfigRow } from './tpm.types.js';
import {
  CATEGORY_KEYS_ORDERED,
  CATEGORY_LABELS,
  DEFAULT_COLORS,
  DEFAULT_INTERVAL_COLORS,
  INTERVAL_TYPES_ORDERED,
} from './tpm.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createColorRow(overrides?: Partial<TpmColorConfigRow>): TpmColorConfigRow {
  return {
    id: 1,
    tenant_id: 10,
    status_key: 'green',
    color_hex: '#00ff00',
    label: 'Custom Grün',
    include_in_card: false,
    created_at: '2026-02-18T00:00:00.000Z',
    updated_at: '2026-02-18T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================
// TpmColorConfigService
// =============================================================

const mockActivityLogger = {
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue(undefined),
};

describe('TpmColorConfigService', () => {
  let service: TpmColorConfigService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new TpmColorConfigService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // getColors
  // =============================================================

  describe('getColors()', () => {
    it('should return all 4 defaults when no tenant config exists', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getColors(10);

      expect(result).toHaveLength(4);
      expect(result.map((c) => c.statusKey)).toEqual(['green', 'red', 'yellow', 'overdue']);
    });

    it('should use default hex values when no overrides exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getColors(10);

      const green = result.find((c) => c.statusKey === 'green');
      expect(green?.colorHex).toBe(DEFAULT_COLORS.green.hex);
      expect(green?.label).toBe(DEFAULT_COLORS.green.label);
      expect(green?.includeInCard).toBe(false);
    });

    it('should merge tenant overrides with defaults', async () => {
      // Only green is customized
      mockDb.query.mockResolvedValueOnce([
        createColorRow({
          status_key: 'green',
          color_hex: '#00ff00',
          label: 'Custom Grün',
        }),
      ]);

      const result = await service.getColors(10);

      expect(result).toHaveLength(4);

      const green = result.find((c) => c.statusKey === 'green');
      expect(green?.colorHex).toBe('#00ff00');
      expect(green?.label).toBe('Custom Grün');

      const red = result.find((c) => c.statusKey === 'red');
      expect(red?.colorHex).toBe(DEFAULT_COLORS.red.hex);
      expect(red?.label).toBe(DEFAULT_COLORS.red.label);
    });

    it('should handle all 4 statuses overridden', async () => {
      mockDb.query.mockResolvedValueOnce([
        createColorRow({ status_key: 'green', color_hex: '#111111' }),
        createColorRow({ status_key: 'red', color_hex: '#222222' }),
        createColorRow({ status_key: 'yellow', color_hex: '#333333' }),
        createColorRow({ status_key: 'overdue', color_hex: '#444444' }),
      ]);

      const result = await service.getColors(10);

      expect(result).toHaveLength(4);
      expect(result.every((c) => c.colorHex.startsWith('#'))).toBe(true);

      const green = result.find((c) => c.statusKey === 'green');
      expect(green?.colorHex).toBe('#111111');
    });

    it('should return statuses in order: green, red, yellow, overdue', async () => {
      // Return out of order from DB
      mockDb.query.mockResolvedValueOnce([
        createColorRow({ status_key: 'overdue', color_hex: '#aaa' }),
        createColorRow({ status_key: 'green', color_hex: '#bbb' }),
      ]);

      const result = await service.getColors(10);

      expect(result[0]?.statusKey).toBe('green');
      expect(result[1]?.statusKey).toBe('red');
      expect(result[2]?.statusKey).toBe('yellow');
      expect(result[3]?.statusKey).toBe('overdue');
    });
  });

  // =============================================================
  // updateColor
  // =============================================================

  describe('updateColor()', () => {
    it('should UPSERT a color config entry', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createColorRow({
            status_key: 'red',
            color_hex: '#ff0000',
            label: 'Urgent',
          }),
        ],
      });

      const result = await service.updateColor(10, 1, {
        statusKey: 'red',
        colorHex: '#ff0000',
        label: 'Urgent',
      });

      expect(result.statusKey).toBe('red');
      expect(result.colorHex).toBe('#ff0000');
      expect(result.label).toBe('Urgent');
      expect(result.includeInCard).toBe(false);

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE');
    });

    it('should throw when UPSERT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateColor(10, 1, {
          statusKey: 'red',
          colorHex: '#ff0000',
          label: 'Red',
        }),
      ).rejects.toThrow('UPSERT tpm_color_config returned no rows');
    });
  });

  // =============================================================
  // resetToDefaults
  // =============================================================

  describe('resetToDefaults()', () => {
    it('should delete all tenant configs and return defaults', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.resetToDefaults(10, 1);

      expect(result).toHaveLength(4);
      expect(result.map((c) => c.statusKey)).toEqual(['green', 'red', 'yellow', 'overdue']);

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('DELETE FROM tpm_color_config');
    });

    it('should return correct default hex values after reset', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.resetToDefaults(10, 1);

      const green = result.find((c) => c.statusKey === 'green');
      expect(green?.colorHex).toBe('#22c55e');
      expect(green?.includeInCard).toBe(false);

      const red = result.find((c) => c.statusKey === 'red');
      expect(red?.colorHex).toBe('#ef4444');
    });
  });

  // =============================================================
  // getIntervalColors
  // =============================================================

  describe('getIntervalColors()', () => {
    it('should return all 7 defaults when no tenant config exists', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getIntervalColors(10);

      expect(result).toHaveLength(7);
      expect(result.map((c) => c.statusKey)).toEqual([
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'semi_annual',
        'annual',
        'custom',
      ]);
    });

    it('should use DEFAULT_INTERVAL_COLORS when no overrides exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getIntervalColors(10);

      const daily = result.find((c) => c.statusKey === 'daily');
      expect(daily?.colorHex).toBe(DEFAULT_INTERVAL_COLORS.daily.hex);
      expect(daily?.label).toBe(DEFAULT_INTERVAL_COLORS.daily.label);
      expect(daily?.includeInCard).toBe(false);
    });

    it('should merge tenant overrides with defaults', async () => {
      mockDb.query.mockResolvedValueOnce([
        createColorRow({
          status_key: 'weekly',
          color_hex: '#aabbcc',
          label: 'Mein Wöchentlich',
          include_in_card: true,
        }),
      ]);

      const result = await service.getIntervalColors(10);

      expect(result).toHaveLength(7);

      const weekly = result.find((c) => c.statusKey === 'weekly');
      expect(weekly?.colorHex).toBe('#aabbcc');
      expect(weekly?.label).toBe('Mein Wöchentlich');
      expect(weekly?.includeInCard).toBe(true);

      const daily = result.find((c) => c.statusKey === 'daily');
      expect(daily?.colorHex).toBe(DEFAULT_INTERVAL_COLORS.daily.hex);
      expect(daily?.includeInCard).toBe(false);
    });

    it('should pass interval keys as ANY($2) filter', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getIntervalColors(10);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe(10);
      expect(params[1]).toEqual(INTERVAL_TYPES_ORDERED);
    });
  });

  // =============================================================
  // updateIntervalColor
  // =============================================================

  describe('updateIntervalColor()', () => {
    it('should UPSERT with includeInCard=true', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createColorRow({
            status_key: 'monthly',
            color_hex: '#112233',
            label: 'Monat',
            include_in_card: true,
          }),
        ],
      });

      const result = await service.updateIntervalColor(10, 1, {
        intervalKey: 'monthly',
        colorHex: '#112233',
        label: 'Monat',
        includeInCard: true,
      });

      expect(result.statusKey).toBe('monthly');
      expect(result.colorHex).toBe('#112233');
      expect(result.includeInCard).toBe(true);

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('include_in_card');
      expect(sql).toContain('ON CONFLICT');

      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params[4]).toBe(true);
    });

    it('should default includeInCard to false when omitted', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createColorRow({
            status_key: 'daily',
            color_hex: '#ff0000',
            label: 'Täglich',
            include_in_card: false,
          }),
        ],
      });

      await service.updateIntervalColor(10, 1, {
        intervalKey: 'daily',
        colorHex: '#ff0000',
        label: 'Täglich',
      });

      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params[4]).toBe(false);
    });

    it('should throw when UPSERT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateIntervalColor(10, 1, {
          intervalKey: 'weekly',
          colorHex: '#aabbcc',
          label: 'Woche',
        }),
      ).rejects.toThrow('UPSERT tpm_color_config returned no rows');
    });
  });

  // =============================================================
  // resetIntervalColorsToDefaults
  // =============================================================

  describe('resetIntervalColorsToDefaults()', () => {
    it('should delete interval overrides and return 7 defaults', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.resetIntervalColorsToDefaults(10, 1);

      expect(result).toHaveLength(7);
      expect(result.map((c) => c.statusKey)).toEqual([
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'semi_annual',
        'annual',
        'custom',
      ]);

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('DELETE FROM tpm_color_config');
    });

    it('should return correct default hex values after reset', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.resetIntervalColorsToDefaults(10, 1);

      const daily = result.find((c) => c.statusKey === 'daily');
      expect(daily?.colorHex).toBe('#4CAF50');
      expect(daily?.includeInCard).toBe(false);

      const custom = result.find((c) => c.statusKey === 'custom');
      expect(custom?.colorHex).toBe('#FF9800');
      expect(custom?.includeInCard).toBe(false);
    });

    it('should target only interval keys in DELETE', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.resetIntervalColorsToDefaults(10, 1);

      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe(10);
      expect(params[1]).toEqual(INTERVAL_TYPES_ORDERED);
    });
  });

  // =============================================================
  // getCategoryColors
  // =============================================================

  describe('getCategoryColors()', () => {
    it('should return all 3 defaults when no tenant config exists', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCategoryColors(10);

      expect(result).toHaveLength(3);
      expect(result.map((c) => c.categoryKey)).toEqual(CATEGORY_KEYS_ORDERED);
    });

    it('should return colorHex=null for all defaults (no custom color)', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCategoryColors(10);

      for (const entry of result) {
        expect(entry.colorHex).toBeNull();
      }
    });

    it('should use CATEGORY_LABELS for default labels', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCategoryColors(10);

      const reinigung = result.find((c) => c.categoryKey === 'reinigung');
      expect(reinigung?.label).toBe(CATEGORY_LABELS.reinigung);

      const wartung = result.find((c) => c.categoryKey === 'wartung');
      expect(wartung?.label).toBe(CATEGORY_LABELS.wartung);

      const inspektion = result.find((c) => c.categoryKey === 'inspektion');
      expect(inspektion?.label).toBe(CATEGORY_LABELS.inspektion);
    });

    it('should merge tenant overrides with defaults', async () => {
      mockDb.query.mockResolvedValueOnce([
        createColorRow({
          status_key: 'reinigung',
          color_hex: '#0030b4',
          label: 'Reinigung',
        }),
      ]);

      const result = await service.getCategoryColors(10);

      expect(result).toHaveLength(3);

      const reinigung = result.find((c) => c.categoryKey === 'reinigung');
      expect(reinigung?.colorHex).toBe('#0030b4');
      expect(reinigung?.label).toBe('Reinigung');

      const wartung = result.find((c) => c.categoryKey === 'wartung');
      expect(wartung?.colorHex).toBeNull();
      expect(wartung?.label).toBe(CATEGORY_LABELS.wartung);
    });

    it('should handle all 3 categories overridden', async () => {
      mockDb.query.mockResolvedValueOnce([
        createColorRow({
          status_key: 'reinigung',
          color_hex: '#111111',
          label: 'R',
        }),
        createColorRow({
          status_key: 'wartung',
          color_hex: '#222222',
          label: 'W',
        }),
        createColorRow({
          status_key: 'inspektion',
          color_hex: '#333333',
          label: 'I',
        }),
      ]);

      const result = await service.getCategoryColors(10);

      expect(result).toHaveLength(3);
      expect(result.every((c) => c.colorHex !== null)).toBe(true);
    });

    it('should pass category keys as ANY($2) filter', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getCategoryColors(10);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe(10);
      expect(params[1]).toEqual(CATEGORY_KEYS_ORDERED);
    });
  });

  // =============================================================
  // updateCategoryColor
  // =============================================================

  describe('updateCategoryColor()', () => {
    it('should UPSERT a category color entry', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createColorRow({
            status_key: 'reinigung',
            color_hex: '#0030b4',
            label: 'Reinigung',
          }),
        ],
      });

      const result = await service.updateCategoryColor(10, 1, {
        categoryKey: 'reinigung',
        colorHex: '#0030b4',
        label: 'Reinigung',
      });

      expect(result.categoryKey).toBe('reinigung');
      expect(result.colorHex).toBe('#0030b4');
      expect(result.label).toBe('Reinigung');

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE');
    });

    it('should pass correct params to UPSERT', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createColorRow({
            status_key: 'wartung',
            color_hex: '#ff5500',
            label: 'Wartung',
          }),
        ],
      });

      await service.updateCategoryColor(10, 1, {
        categoryKey: 'wartung',
        colorHex: '#ff5500',
        label: 'Wartung',
      });

      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe(10);
      expect(params[1]).toBe('wartung');
      expect(params[2]).toBe('#ff5500');
      expect(params[3]).toBe('Wartung');
    });

    it('should throw when UPSERT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateCategoryColor(10, 1, {
          categoryKey: 'reinigung',
          colorHex: '#0030b4',
          label: 'Reinigung',
        }),
      ).rejects.toThrow('UPSERT tpm_color_config returned no rows');
    });

    it('should call activityLogger.logUpdate', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createColorRow({
            status_key: 'reinigung',
            color_hex: '#0030b4',
            label: 'Reinigung',
          }),
        ],
      });

      await service.updateCategoryColor(10, 1, {
        categoryKey: 'reinigung',
        colorHex: '#0030b4',
        label: 'Reinigung',
      });

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        10,
        1,
        'tpm_color_config',
        0,
        'TPM-Kategoriefarbe aktualisiert: reinigung',
        undefined,
        { categoryKey: 'reinigung', colorHex: '#0030b4' },
      );
    });
  });

  // =============================================================
  // resetCategoryColors
  // =============================================================

  describe('resetCategoryColors()', () => {
    it('should delete category overrides and return 3 defaults', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.resetCategoryColors(10, 1);

      expect(result).toHaveLength(3);
      expect(result.map((c) => c.categoryKey)).toEqual(CATEGORY_KEYS_ORDERED);

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('DELETE FROM tpm_color_config');
    });

    it('should return colorHex=null for all entries after reset', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.resetCategoryColors(10, 1);

      for (const entry of result) {
        expect(entry.colorHex).toBeNull();
      }
    });

    it('should return correct default labels after reset', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.resetCategoryColors(10, 1);

      const reinigung = result.find((c) => c.categoryKey === 'reinigung');
      expect(reinigung?.label).toBe('Reinigung');

      const wartung = result.find((c) => c.categoryKey === 'wartung');
      expect(wartung?.label).toBe('Wartung');
    });

    it('should target only category keys in DELETE', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.resetCategoryColors(10, 1);

      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe(10);
      expect(params[1]).toEqual(CATEGORY_KEYS_ORDERED);
    });

    it('should call activityLogger.logUpdate', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.resetCategoryColors(10, 1);

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        10,
        1,
        'tpm_color_config',
        0,
        'TPM-Kategoriefarben zurückgesetzt',
      );
    });
  });
});

/**
 * Unit tests for TpmColorConfigService
 *
 * Mocked dependencies: DatabaseService (query, tenantTransaction).
 * Tests: getColors (default fallback, tenant overrides, merge logic),
 * updateColor (UPSERT), resetToDefaults (DELETE + return defaults).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TpmColorConfigService } from './tpm-color-config.service.js';
import type { TpmColorConfigRow } from './tpm.types.js';
import { DEFAULT_COLORS } from './tpm.types.js';

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

function createColorRow(
  overrides?: Partial<TpmColorConfigRow>,
): TpmColorConfigRow {
  return {
    id: 1,
    tenant_id: 10,
    status_key: 'green',
    color_hex: '#00ff00',
    label: 'Custom Grün',
    created_at: '2026-02-18T00:00:00.000Z',
    updated_at: '2026-02-18T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================
// TpmColorConfigService
// =============================================================

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

    service = new TpmColorConfigService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // getColors
  // =============================================================

  describe('getColors()', () => {
    it('should return all 4 defaults when no tenant config exists', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getColors(10);

      expect(result).toHaveLength(4);
      expect(result.map((c) => c.statusKey)).toEqual([
        'green',
        'red',
        'yellow',
        'overdue',
      ]);
    });

    it('should use default hex values when no overrides exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getColors(10);

      const green = result.find((c) => c.statusKey === 'green');
      expect(green?.colorHex).toBe(DEFAULT_COLORS.green.hex);
      expect(green?.label).toBe(DEFAULT_COLORS.green.label);
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

      const result = await service.updateColor(10, {
        statusKey: 'red',
        colorHex: '#ff0000',
        label: 'Urgent',
      });

      expect(result.statusKey).toBe('red');
      expect(result.colorHex).toBe('#ff0000');
      expect(result.label).toBe('Urgent');

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE');
    });

    it('should throw when UPSERT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateColor(10, {
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

      const result = await service.resetToDefaults(10);

      expect(result).toHaveLength(4);
      expect(result.map((c) => c.statusKey)).toEqual([
        'green',
        'red',
        'yellow',
        'overdue',
      ]);

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('DELETE FROM tpm_color_config');
    });

    it('should return correct default hex values after reset', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.resetToDefaults(10);

      const green = result.find((c) => c.statusKey === 'green');
      expect(green?.colorHex).toBe('#22c55e');

      const red = result.find((c) => c.statusKey === 'red');
      expect(red?.colorHex).toBe('#ef4444');
    });
  });
});

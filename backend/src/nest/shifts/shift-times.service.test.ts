import { IS_ACTIVE } from '@assixx/shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { ShiftTimesService } from './shift-times.service.js';

// =============================================================
// Mock Setup
// =============================================================

function createMockDb(): DatabaseService {
  const query = vi.fn();
  const queryOne = vi.fn();
  return {
    query,
    queryOne,
    tenantQuery: query,
    tenantQueryOne: queryOne,
    transaction: vi.fn(),
  } as unknown as DatabaseService;
}

function createDefaultDbRows(): Array<{
  shift_key: string;
  label: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  is_active: number;
}> {
  return [
    {
      shift_key: 'early',
      label: 'Frühschicht',
      start_time: '06:00:00',
      end_time: '14:00:00',
      sort_order: 1,
      is_active: IS_ACTIVE.ACTIVE,
    },
    {
      shift_key: 'late',
      label: 'Spätschicht',
      start_time: '14:00:00',
      end_time: '22:00:00',
      sort_order: 2,
      is_active: IS_ACTIVE.ACTIVE,
    },
    {
      shift_key: 'night',
      label: 'Nachtschicht',
      start_time: '22:00:00',
      end_time: '06:00:00',
      sort_order: 3,
      is_active: IS_ACTIVE.ACTIVE,
    },
  ];
}

// =============================================================
// Tests
// =============================================================

describe('ShiftTimesService', () => {
  let service: ShiftTimesService;
  let mockDb: DatabaseService;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new ShiftTimesService(mockDb);
  });

  // -----------------------------------------------------------
  // getByTenant
  // -----------------------------------------------------------

  describe('getByTenant', () => {
    it('should return shift times for a tenant', async () => {
      const rows = createDefaultDbRows();
      vi.mocked(mockDb.query).mockResolvedValueOnce(rows);

      const result = await service.getByTenant(1);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        shiftKey: 'early',
        label: 'Frühschicht',
        startTime: '06:00',
        endTime: '14:00',
        sortOrder: 1,
        isActive: 1,
      });
    });

    it('should strip seconds from PostgreSQL TIME format', async () => {
      const rows = [
        {
          shift_key: 'early',
          label: 'Test',
          start_time: '05:30:00',
          end_time: '13:30:00',
          sort_order: 1,
          is_active: IS_ACTIVE.ACTIVE,
        },
      ];
      vi.mocked(mockDb.query).mockResolvedValueOnce(rows);

      const result = await service.getByTenant(1);

      expect(result[0]?.startTime).toBe('05:30');
      expect(result[0]?.endTime).toBe('13:30');
    });

    it('should lazy-initialize defaults when no rows exist', async () => {
      // First query returns empty (no shift times for this tenant)
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);
      // ensureDefaults: COUNT query
      vi.mocked(mockDb.query).mockResolvedValueOnce([{ count: '0' }]);
      // ensureDefaults: 3 INSERT queries
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);
      // Second SELECT after defaults created
      vi.mocked(mockDb.query).mockResolvedValueOnce(createDefaultDbRows());

      const result = await service.getByTenant(99);

      expect(result).toHaveLength(3);
      expect(result[0]?.shiftKey).toBe('early');
      expect(result[1]?.shiftKey).toBe('late');
      expect(result[2]?.shiftKey).toBe('night');
    });

    it('should return all 3 default shift types', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce(createDefaultDbRows());

      const result = await service.getByTenant(1);

      const keys = result.map((r) => r.shiftKey);
      expect(keys).toEqual(['early', 'late', 'night']);
    });
  });

  // -----------------------------------------------------------
  // update
  // -----------------------------------------------------------

  describe('update', () => {
    it('should update a shift time and return the updated row', async () => {
      // ensureDefaults: COUNT query
      vi.mocked(mockDb.query).mockResolvedValueOnce([{ count: '3' }]);
      // UPDATE RETURNING
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        {
          shift_key: 'early',
          label: 'Morgenschicht',
          start_time: '05:00:00',
          end_time: '13:00:00',
          sort_order: 1,
          is_active: IS_ACTIVE.ACTIVE,
        },
      ]);

      const result = await service.update(1, 'early', {
        label: 'Morgenschicht',
        startTime: '05:00',
        endTime: '13:00',
      });

      expect(result.label).toBe('Morgenschicht');
      expect(result.startTime).toBe('05:00');
      expect(result.endTime).toBe('13:00');
    });

    it('should call ensureDefaults before updating', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([{ count: '3' }]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        {
          shift_key: 'late',
          label: 'Spät',
          start_time: '15:00:00',
          end_time: '23:00:00',
          sort_order: 2,
          is_active: IS_ACTIVE.ACTIVE,
        },
      ]);

      await service.update(1, 'late', {
        label: 'Spät',
        startTime: '15:00',
        endTime: '23:00',
      });

      // First call is ensureDefaults COUNT, second is UPDATE
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should throw if shift key not found after ensureDefaults', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([{ count: '3' }]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([]); // UPDATE returns nothing

      await expect(
        service.update(1, 'early', {
          label: 'Test',
          startTime: '06:00',
          endTime: '14:00',
        }),
      ).rejects.toThrow("Shift time 'early' not found");
    });
  });

  // -----------------------------------------------------------
  // updateAll
  // -----------------------------------------------------------

  describe('updateAll', () => {
    it('should update multiple shift times', async () => {
      const updates = [
        {
          shiftKey: 'early',
          label: 'Morgen',
          startTime: '05:00',
          endTime: '13:00',
        },
        {
          shiftKey: 'late',
          label: 'Nachmittag',
          startTime: '13:00',
          endTime: '21:00',
        },
      ];

      // ensureDefaults for first update
      vi.mocked(mockDb.query).mockResolvedValueOnce([{ count: '3' }]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        {
          shift_key: 'early',
          label: 'Morgen',
          start_time: '05:00:00',
          end_time: '13:00:00',
          sort_order: 1,
          is_active: IS_ACTIVE.ACTIVE,
        },
      ]);
      // ensureDefaults for second update
      vi.mocked(mockDb.query).mockResolvedValueOnce([{ count: '3' }]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        {
          shift_key: 'late',
          label: 'Nachmittag',
          start_time: '13:00:00',
          end_time: '21:00:00',
          sort_order: 2,
          is_active: IS_ACTIVE.ACTIVE,
        },
      ]);

      const result = await service.updateAll(1, updates);

      expect(result).toHaveLength(2);
      expect(result[0]?.label).toBe('Morgen');
      expect(result[1]?.label).toBe('Nachmittag');
    });
  });

  // -----------------------------------------------------------
  // resetToDefaults
  // -----------------------------------------------------------

  describe('resetToDefaults', () => {
    it('should reset all shift times and return defaults', async () => {
      // 3 UPDATE queries for reset
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);
      // getByTenant SELECT
      vi.mocked(mockDb.query).mockResolvedValueOnce(createDefaultDbRows());

      const result = await service.resetToDefaults(1);

      expect(result).toHaveLength(3);
      expect(result[0]?.label).toBe('Frühschicht');
      expect(result[0]?.startTime).toBe('06:00');
      expect(result[1]?.label).toBe('Spätschicht');
      expect(result[2]?.label).toBe('Nachtschicht');
    });

    it('should execute 3 UPDATE queries (one per shift type)', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);
      vi.mocked(mockDb.query).mockResolvedValueOnce(createDefaultDbRows());

      await service.resetToDefaults(1);

      // 3 UPDATEs + 1 SELECT from getByTenant
      expect(mockDb.query).toHaveBeenCalledTimes(4);
    });
  });

  // -----------------------------------------------------------
  // ensureDefaults
  // -----------------------------------------------------------

  describe('ensureDefaults', () => {
    it('should skip if shift times already exist', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([{ count: '3' }]);

      await service.ensureDefaults(1);

      // Only the COUNT query — no INSERTs
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should insert 3 defaults if none exist', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([{ count: '0' }]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);
      vi.mocked(mockDb.query).mockResolvedValueOnce([]);

      await service.ensureDefaults(42);

      // 1 COUNT + 3 INSERTs
      expect(mockDb.query).toHaveBeenCalledTimes(4);
    });

    it('should use ON CONFLICT DO NOTHING for idempotency', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([{ count: '0' }]);
      vi.mocked(mockDb.query).mockResolvedValue([]);

      await service.ensureDefaults(1);

      const insertCalls = vi
        .mocked(mockDb.query)
        .mock.calls.filter(
          (call: unknown[]) =>
            typeof call[0] === 'string' && (call[0] as string).includes('INSERT'),
        );
      for (const call of insertCalls) {
        expect(call[0]).toContain('ON CONFLICT');
        expect(call[0]).toContain('DO NOTHING');
      }
    });

    it('should pass correct tenant_id to INSERT queries', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([{ count: '0' }]);
      vi.mocked(mockDb.query).mockResolvedValue([]);

      await service.ensureDefaults(77);

      const insertCalls = vi
        .mocked(mockDb.query)
        .mock.calls.filter(
          (call: unknown[]) =>
            typeof call[0] === 'string' && (call[0] as string).includes('INSERT'),
        );
      for (const call of insertCalls) {
        const params = call[1] as unknown[];
        expect(params[0]).toBe(77);
      }
    });
  });
});

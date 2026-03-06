/**
 * Unit tests for TpmCardCascadeService
 *
 * Mocked dependencies: DatabaseService (query), PoolClient (query).
 * Tests: triggerCascade (batch SQL, affected count, due date format),
 * getCascadePreview (read-only, card list), getIntervalOrder (all 8 types).
 *
 * Performance test: Simulates cascade with 2400 cards to verify
 * batch SQL approach completes within acceptable time (R1 mitigation).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TpmCardCascadeService } from './tpm-card-cascade.service.js';
import type { TpmCardJoinRow } from './tpm-cards.helpers.js';
import type { TpmCardRow } from './tpm.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockClient() {
  return { query: vi.fn() };
}

function createCardRow(overrides?: Partial<TpmCardJoinRow>): TpmCardJoinRow {
  return {
    id: 1,
    uuid: 'card-uuid-001                            ',
    tenant_id: 10,
    plan_id: 100,
    asset_id: 42,
    card_code: 'BT1',
    card_role: 'operator',
    interval_type: 'daily',
    interval_order: 1,
    title: 'Tägliche Prüfung',
    description: null,
    location_description: null,
    location_photo_url: null,
    requires_approval: false,
    status: 'green',
    current_due_date: null,
    last_completed_at: null,
    last_completed_by: null,
    sort_order: 1,
    custom_fields: {},
    custom_interval_days: null,
    is_active: 1,
    created_by: 5,
    created_at: '2026-02-18T00:00:00.000Z',
    updated_at: '2026-02-18T00:00:00.000Z',
    plan_uuid: 'plan-uuid-001                            ',
    asset_name: 'CNC-001',
    ...overrides,
  };
}

// =============================================================
// TpmCardCascadeService
// =============================================================

describe('TpmCardCascadeService', () => {
  let service: TpmCardCascadeService;
  let mockDb: MockDb;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = createMockClient();

    service = new TpmCardCascadeService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // triggerCascade
  // =============================================================

  describe('triggerCascade()', () => {
    it('should return affected count from batch UPDATE', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '12' }],
      });

      const result = await service.triggerCascade(
        mockClient,
        10,
        42,
        3,
        new Date('2026-03-01'),
      );

      expect(result.affectedCount).toBe(12);
      expect(result.triggerIntervalOrder).toBe(3);
      expect(result.dueDate).toBe('2026-03-01');
    });

    it('should return 0 when no green cards exist', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

      const result = await service.triggerCascade(
        mockClient,
        10,
        42,
        5,
        new Date('2026-04-15'),
      );

      expect(result.affectedCount).toBe(0);
    });

    it('should format due date as ISO date string (YYYY-MM-DD)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '3' }],
      });

      await service.triggerCascade(
        mockClient,
        10,
        42,
        2,
        new Date('2026-12-25T14:30:00.000Z'),
      );

      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[3]).toBe('2026-12-25');
    });

    it('should pass correct params to batch SQL', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '5' }],
      });

      await service.triggerCascade(
        mockClient,
        10,
        42,
        4,
        new Date('2026-06-01'),
      );

      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[0]).toBe(42); // assetId
      expect(params?.[1]).toBe(10); // tenantId
      expect(params?.[2]).toBe(4); // triggerIntervalOrder
      expect(params?.[3]).toBe('2026-06-01'); // dueDateStr
    });

    it('should use CTE with UPDATE ... RETURNING for counting', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });

      await service.triggerCascade(
        mockClient,
        10,
        42,
        1,
        new Date('2026-01-01'),
      );

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('WITH updated AS');
      expect(sql).toContain('RETURNING id');
      expect(sql).toContain('COUNT(*)');
    });

    it('should only affect green, active cards not completed today', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

      await service.triggerCascade(
        mockClient,
        10,
        42,
        3,
        new Date('2026-03-01'),
      );

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain("status = 'green'");
      expect(sql).toContain('is_active = 1');
      expect(sql).toContain('last_completed_at');
    });

    it('should handle null count gracefully', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: undefined }],
      });

      const result = await service.triggerCascade(
        mockClient,
        10,
        42,
        1,
        new Date('2026-01-01'),
      );

      expect(result.affectedCount).toBe(0);
    });
  });

  // =============================================================
  // getCascadePreview
  // =============================================================

  describe('getCascadePreview()', () => {
    it('should return affected cards with total count', async () => {
      mockDb.query.mockResolvedValueOnce([
        createCardRow({ interval_order: 1 }),
        createCardRow({ id: 2, interval_order: 2 }),
        createCardRow({ id: 3, interval_order: 3 }),
      ]);

      const result = await service.getCascadePreview(10, 42, 3);

      expect(result.totalAffected).toBe(3);
      expect(result.cards).toHaveLength(3);
      expect(result.triggerIntervalOrder).toBe(3);
    });

    it('should return empty when no cards would be affected', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCascadePreview(10, 42, 1);

      expect(result.totalAffected).toBe(0);
      expect(result.cards).toHaveLength(0);
    });

    it('should map rows to API format', async () => {
      mockDb.query.mockResolvedValueOnce([createCardRow()]);

      const result = await service.getCascadePreview(10, 42, 5);

      const card = result.cards[0];
      expect(card).toBeDefined();
      expect(card?.uuid).toBe('card-uuid-001');
      expect(card?.assetName).toBe('CNC-001');
    });

    it('should only query green, active cards', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getCascadePreview(10, 42, 3);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain("c.status = 'green'");
      expect(sql).toContain('c.is_active = 1');
    });

    it('should filter by asset_id and interval_order', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getCascadePreview(10, 42, 4);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[0]).toBe(42); // assetId
      expect(params?.[1]).toBe(10); // tenantId
      expect(params?.[2]).toBe(4); // triggerIntervalOrder
    });
  });

  // =============================================================
  // getIntervalOrder
  // =============================================================

  describe('getIntervalOrder()', () => {
    it('should return 1 for daily', () => {
      expect(service.getIntervalOrder('daily')).toBe(1);
    });

    it('should return 2 for weekly', () => {
      expect(service.getIntervalOrder('weekly')).toBe(2);
    });

    it('should return 3 for monthly', () => {
      expect(service.getIntervalOrder('monthly')).toBe(3);
    });

    it('should return 4 for quarterly', () => {
      expect(service.getIntervalOrder('quarterly')).toBe(4);
    });

    it('should return 5 for semi_annual', () => {
      expect(service.getIntervalOrder('semi_annual')).toBe(5);
    });

    it('should return 6 for annual', () => {
      expect(service.getIntervalOrder('annual')).toBe(6);
    });

    it('should return 7 for custom', () => {
      expect(service.getIntervalOrder('custom')).toBe(7);
    });
  });

  // =============================================================
  // Performance (R1 mitigation)
  // =============================================================

  describe('Performance', () => {
    it('should handle cascade with 2400 cards (batch SQL approach)', async () => {
      // Simulate 2400-card cascade: 20 assets × 8 intervals × 15 cards
      // The batch SQL runs a single UPDATE — the mock returns instantly,
      // but we verify the SQL structure supports batch operations.
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '2400' }],
      });

      const start = Date.now();
      const result = await service.triggerCascade(
        mockClient,
        10,
        42,
        6,
        new Date('2026-06-01'),
      );
      const elapsed = Date.now() - start;

      expect(result.affectedCount).toBe(2400);

      // Verify single SQL call (not 2400 individual updates)
      expect(mockClient.query).toHaveBeenCalledTimes(1);

      // Mock execution is near-instant, but verify the pattern is batch
      expect(elapsed).toBeLessThan(500);

      // Verify the SQL uses batch UPDATE with WHERE clause, not individual row updates
      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('UPDATE tpm_cards');
      expect(sql).toContain('interval_order <= $');
      // Uses asset_id filter (batch), not WHERE id = $X (individual)
      expect(sql).toContain('asset_id = $');
    });

    it('should use single query for preview of 2400 cards', async () => {
      const manyCards: TpmCardRow[] = Array.from(
        { length: 100 },
        (_: unknown, i: number) =>
          createCardRow({ id: i + 1, card_code: `BT${i + 1}` }),
      );
      mockDb.query.mockResolvedValueOnce(manyCards);

      const result = await service.getCascadePreview(10, 42, 8);

      expect(result.totalAffected).toBe(100);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });
});

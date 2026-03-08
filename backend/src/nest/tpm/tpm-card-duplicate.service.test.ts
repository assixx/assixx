/**
 * Unit tests for TpmCardDuplicateService
 *
 * Mocked dependencies: DatabaseService (query).
 * Tests: checkDuplicate (found/not found, interval order filtering, ILIKE),
 * findSimilarCards (found/empty, title+description match),
 * escapeLikePattern (special chars %, _, \).
 *
 * All methods are read-only (no mutations).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TpmCardDuplicateService } from './tpm-card-duplicate.service.js';
import type { TpmCardJoinRow } from './tpm-cards.helpers.js';

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
    title: 'Sichtprüfung',
    description: 'Visuelle Kontrolle',
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
    is_active: IS_ACTIVE.ACTIVE,
    created_by: 5,
    created_at: '2026-02-18T00:00:00.000Z',
    updated_at: '2026-02-18T00:00:00.000Z',
    plan_uuid: 'plan-uuid-001                            ',
    asset_name: 'CNC-001',
    ...overrides,
  };
}

// =============================================================
// TpmCardDuplicateService
// =============================================================

describe('TpmCardDuplicateService', () => {
  let service: TpmCardDuplicateService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();

    service = new TpmCardDuplicateService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // checkDuplicate
  // =============================================================

  describe('checkDuplicate()', () => {
    it('should detect duplicate when similar card exists', async () => {
      mockDb.query.mockResolvedValueOnce([
        createCardRow({ title: 'Sichtprüfung' }),
      ]);

      const result = await service.checkDuplicate(
        10,
        42,
        'Sichtprüfung',
        'weekly',
      );

      expect(result.hasDuplicate).toBe(true);
      expect(result.existingCards).toHaveLength(1);
      expect(result.existingCards[0]?.title).toBe('Sichtprüfung');
    });

    it('should return no duplicate when no match found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkDuplicate(
        10,
        42,
        'Completely unique task',
        'monthly',
      );

      expect(result.hasDuplicate).toBe(false);
      expect(result.existingCards).toHaveLength(0);
    });

    it('should use ILIKE for case-insensitive matching', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.checkDuplicate(10, 42, 'Test', 'daily');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('ILIKE');
    });

    it('should use interval_order for filtering shorter intervals', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.checkDuplicate(10, 42, 'Test', 'monthly');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('interval_order <= $');

      // monthly = order 3, so it should match daily(1), weekly(2), monthly(3)
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[3]).toBe(3);
    });

    it('should escape LIKE special characters in title', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.checkDuplicate(10, 42, '50% Prüfung_test', 'daily');

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      const pattern = params?.[2] as string;
      // % and _ should be escaped
      expect(pattern).toContain('\\%');
      expect(pattern).toContain('\\_');
    });

    it('should return multiple duplicates when found', async () => {
      mockDb.query.mockResolvedValueOnce([
        createCardRow({
          id: 1,
          interval_order: 1,
          title: 'Sichtprüfung täglich',
        }),
        createCardRow({
          id: 2,
          interval_order: 2,
          title: 'Sichtprüfung wöchentlich',
        }),
      ]);

      const result = await service.checkDuplicate(
        10,
        42,
        'Sichtprüfung',
        'monthly',
      );

      expect(result.hasDuplicate).toBe(true);
      expect(result.existingCards).toHaveLength(2);
    });

    it('should pass assetId and tenantId correctly', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.checkDuplicate(20, 99, 'Test', 'weekly');

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[0]).toBe(99); // assetId
      expect(params?.[1]).toBe(20); // tenantId
    });

    it('should only search active cards', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.checkDuplicate(10, 42, 'Test', 'daily');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
    });
  });

  // =============================================================
  // findSimilarCards
  // =============================================================

  describe('findSimilarCards()', () => {
    it('should return similar cards matching title or description', async () => {
      mockDb.query.mockResolvedValueOnce([
        createCardRow({ title: 'Ölstand prüfen' }),
        createCardRow({
          id: 2,
          title: 'Ölwechsel',
          description: 'Ölstand kontrollieren',
        }),
      ]);

      const result = await service.findSimilarCards(10, 42, 'Öl');

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no matches', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.findSimilarCards(10, 42, 'Nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should search both title and description with ILIKE', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.findSimilarCards(10, 42, 'Test');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('c.title ILIKE $');
      expect(sql).toContain('c.description ILIKE $');
    });

    it('should escape backslash in search text', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.findSimilarCards(10, 42, 'path\\file');

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      const pattern = params?.[2] as string;
      expect(pattern).toContain('\\\\');
    });

    it('should limit results to max 10', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.findSimilarCards(10, 42, 'Test');

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[3]).toBe(10);
    });
  });
});

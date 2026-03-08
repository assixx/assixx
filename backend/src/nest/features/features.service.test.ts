/**
 * Unit tests for FeaturesService
 *
 * Phase 5: Tests mapper/transformation logic and status calculation.
 * DatabaseService is mocked — no real DB calls.
 *
 * Mapper methods are private, tested indirectly through public methods:
 *   - mapDbFeatureToApi → via getAllFeatures
 *   - mapTenantFeatureRow + parseCustomConfig → via getTenantFeatures
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { FeaturesService } from './features.service.js';

// Factory for mock DatabaseService
function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// Factory for a minimal DB feature row
function createDbFeatureRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: 'shifts',
    name: 'Shift Management',
    description: null as string | null,
    category: 'core',
    base_price: null as string | number | null,
    is_active: IS_ACTIVE.ACTIVE,
    sort_order: 1,
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-15T00:00:00Z'),
    ...overrides,
  };
}

// Factory for a minimal DB tenant feature row
function createDbTenantFeatureRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    tenant_id: 10,
    feature_id: 1,
    feature_code: 'shifts',
    feature_name: 'Shift Management',
    category: 'core',
    default_price: null,
    is_active: IS_ACTIVE.ACTIVE,
    activated_at: new Date('2025-01-01T00:00:00Z'),
    expires_at: null as Date | null,
    activated_by: null as number | null,
    custom_config: null as string | null,
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

// =============================================================
// FeaturesService
// =============================================================

describe('FeaturesService', () => {
  let service: FeaturesService;
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new FeaturesService(mockDb as unknown as DatabaseService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =============================================================
  // getAllFeatures — exercises mapDbFeatureToApi
  // =============================================================

  describe('getAllFeatures', () => {
    it('should map DB row to API feature with all fields', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbFeatureRow({
          description: 'Manage employee shifts',
          base_price: '29.99',
        }),
      ]);

      const result = await service.getAllFeatures();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        code: 'shifts',
        name: 'Shift Management',
        description: 'Manage employee shifts',
        category: 'core',
        price: 29.99,
        isActive: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-15T00:00:00.000Z',
      });
    });

    it('should omit description when null', async () => {
      mockDb.query.mockResolvedValueOnce([createDbFeatureRow()]);

      const result = await service.getAllFeatures();

      expect(result[0]).not.toHaveProperty('description');
    });

    it('should omit price when base_price is null', async () => {
      mockDb.query.mockResolvedValueOnce([createDbFeatureRow()]);

      const result = await service.getAllFeatures();

      expect(result[0]).not.toHaveProperty('price');
    });

    it('should parse string base_price to number', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbFeatureRow({ base_price: '49.99' }),
      ]);

      const result = await service.getAllFeatures();

      expect(result[0]?.price).toBe(49.99);
    });

    it('should convert is_active 0 to false', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbFeatureRow({ is_active: IS_ACTIVE.INACTIVE }),
      ]);

      const result = await service.getAllFeatures();

      expect(result[0]?.isActive).toBe(false);
    });

    it('should convert is_active 1 to true', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbFeatureRow({ is_active: IS_ACTIVE.ACTIVE }),
      ]);

      const result = await service.getAllFeatures();

      expect(result[0]?.isActive).toBe(true);
    });

    it('should query active features only by default', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getAllFeatures();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining(`WHERE is_active = ${IS_ACTIVE.ACTIVE}`),
      );
    });

    it('should query all features when includeInactive is true', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getAllFeatures(true);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.not.stringContaining(`WHERE is_active = ${IS_ACTIVE.ACTIVE}`),
      );
    });
  });

  // =============================================================
  // getTenantFeatures — exercises mapTenantFeatureRow + parseCustomConfig
  // =============================================================

  describe('getTenantFeatures', () => {
    it('should set status to active for active non-expired feature', async () => {
      mockDb.query.mockResolvedValueOnce([createDbTenantFeatureRow()]);

      const result = await service.getTenantFeatures(10);

      expect(result[0]?.status).toBe('active');
      expect(result[0]?.isActive).toBe(true);
    });

    it('should set status to expired for active feature past expiry', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));

      mockDb.query.mockResolvedValueOnce([
        createDbTenantFeatureRow({
          is_active: IS_ACTIVE.ACTIVE,
          expires_at: new Date('2025-06-01T00:00:00Z'),
        }),
      ]);

      const result = await service.getTenantFeatures(10);

      expect(result[0]?.status).toBe('expired');
    });

    it('should set status to active for active feature with future expiry', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-01T00:00:00Z'));

      mockDb.query.mockResolvedValueOnce([
        createDbTenantFeatureRow({
          is_active: IS_ACTIVE.ACTIVE,
          expires_at: new Date('2025-12-31T23:59:59Z'),
        }),
      ]);

      const result = await service.getTenantFeatures(10);

      expect(result[0]?.status).toBe('active');
    });

    it('should set status to disabled for inactive feature', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbTenantFeatureRow({ is_active: IS_ACTIVE.INACTIVE }),
      ]);

      const result = await service.getTenantFeatures(10);

      expect(result[0]?.status).toBe('disabled');
      expect(result[0]?.isActive).toBe(false);
    });

    it('should set validFrom and activatedAt from activated_at', async () => {
      mockDb.query.mockResolvedValueOnce([createDbTenantFeatureRow()]);

      const result = await service.getTenantFeatures(10);

      expect(result[0]?.validFrom).toBe('2025-01-01T00:00:00.000Z');
      expect(result[0]?.activatedAt).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should set validUntil from expires_at', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T00:00:00Z'));

      mockDb.query.mockResolvedValueOnce([
        createDbTenantFeatureRow({
          expires_at: new Date('2025-12-31T23:59:59Z'),
        }),
      ]);

      const result = await service.getTenantFeatures(10);

      expect(result[0]?.validUntil).toBe('2025-12-31T23:59:59.000Z');
    });

    it('should set activatedBy when not null', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbTenantFeatureRow({ activated_by: 42 }),
      ]);

      const result = await service.getTenantFeatures(10);

      expect(result[0]?.activatedBy).toBe(42);
    });

    it('should parse valid JSON custom_config', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbTenantFeatureRow({
          custom_config: '{"maxShifts": 100, "allowOvertime": true}',
        }),
      ]);

      const result = await service.getTenantFeatures(10);

      expect(result[0]?.customConfig).toEqual({
        maxShifts: 100,
        allowOvertime: true,
      });
    });

    it('should set customConfig to empty object for invalid JSON', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbTenantFeatureRow({ custom_config: 'not-valid-json{' }),
      ]);

      const result = await service.getTenantFeatures(10);

      expect(result[0]?.customConfig).toEqual({});
    });

    it('should not set customConfig when custom_config is null', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDbTenantFeatureRow({ custom_config: null }),
      ]);

      const result = await service.getTenantFeatures(10);

      expect(result[0]).not.toHaveProperty('customConfig');
    });
  });

  // =============================================================
  // checkTenantAccess
  // =============================================================

  describe('checkTenantAccess', () => {
    it('should return true when tenant has active non-expired feature', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: 1 });

      const result = await service.checkTenantAccess(10, 'shifts');

      expect(result).toBe(true);
    });

    it('should return false when no matching row found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.checkTenantAccess(10, 'nonexistent');

      expect(result).toBe(false);
    });

    it('should pass correct tenantId and featureCode to query', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await service.checkTenantAccess(42, 'documents');

      expect(mockDb.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('tf.tenant_id = $1'),
        [42, 'documents'],
      );
    });
  });

  // =============================================================
  // getFeatureByCode
  // =============================================================

  describe('getFeatureByCode', () => {
    it('should return mapped feature when found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createDbFeatureRow({ description: 'Test', base_price: '19.99' }),
      );

      const result = await service.getFeatureByCode('shifts');

      expect(result).not.toBeNull();
      expect(result?.code).toBe('shifts');
      expect(result?.price).toBe(19.99);
    });

    it('should return null when feature not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getFeatureByCode('nonexistent');

      expect(result).toBeNull();
    });
  });

  // =============================================================
  // activateFeature
  // =============================================================

  describe('activateFeature', () => {
    const baseRequest = {
      tenantId: 10,
      featureCode: 'vacation',
    };
    const activatedBy = 42;

    it('should INSERT when tenant has no existing entry', async () => {
      // 1st queryOne: getFeatureByCode → feature found
      mockDb.queryOne.mockResolvedValueOnce(
        createDbFeatureRow({ id: 13, code: 'vacation' }),
      );
      // 2nd queryOne: check existing → no row
      mockDb.queryOne.mockResolvedValueOnce(null);
      // query: INSERT
      mockDb.query.mockResolvedValueOnce([]);

      await service.activateFeature(baseRequest, activatedBy);

      // Verify INSERT was called (not UPDATE)
      expect(mockDb.query).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('INSERT INTO tenant_features'),
        [10, 13, true, null, 42, null],
      );
    });

    it('should UPDATE when tenant already has the feature (re-activation)', async () => {
      // 1st queryOne: getFeatureByCode → feature found
      mockDb.queryOne.mockResolvedValueOnce(
        createDbFeatureRow({ id: 13, code: 'vacation' }),
      );
      // 2nd queryOne: check existing → row exists
      mockDb.queryOne.mockResolvedValueOnce({ id: 99 });
      // query: UPDATE
      mockDb.query.mockResolvedValueOnce([]);

      await service.activateFeature(baseRequest, activatedBy);

      expect(mockDb.query).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining(
          `UPDATE tenant_features SET is_active = ${IS_ACTIVE.ACTIVE}`,
        ),
        [null, 42, null, 10, 13],
      );
    });

    it('should pass expiresAt to query when provided', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createDbFeatureRow({ id: 13, code: 'vacation' }),
      );
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce([]);

      await service.activateFeature(
        {
          ...baseRequest,
          options: { expiresAt: '2026-12-31T23:59:59.000Z' },
        },
        activatedBy,
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tenant_features'),
        [10, 13, true, '2026-12-31T23:59:59.000Z', 42, null],
      );
    });

    it('should JSON.stringify customConfig when provided', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createDbFeatureRow({ id: 13, code: 'vacation' }),
      );
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce([]);

      const customConfig = { maxDays: 30, allowCarryOver: true };

      await service.activateFeature(
        { ...baseRequest, options: { customConfig } },
        activatedBy,
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tenant_features'),
        [10, 13, true, null, 42, JSON.stringify(customConfig)],
      );
    });

    it('should throw NotFoundException for unknown featureCode', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(
        service.activateFeature(
          { tenantId: 10, featureCode: 'nonexistent' },
          activatedBy,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // deactivateFeature
  // =============================================================

  describe('deactivateFeature', () => {
    it('should UPDATE and succeed when RETURNING yields a row', async () => {
      // queryOne: getFeatureByCode → feature found
      mockDb.queryOne.mockResolvedValueOnce(
        createDbFeatureRow({ id: 13, code: 'vacation' }),
      );
      // query: UPDATE RETURNING → 1 row
      mockDb.query.mockResolvedValueOnce([{ id: 77 }]);

      await expect(
        service.deactivateFeature(10, 'vacation', 42),
      ).resolves.toBeUndefined();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tenant_features'),
        [10, 13],
      );
    });

    it('should throw NotFoundException for unknown featureCode', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(
        service.deactivateFeature(10, 'nonexistent', 42),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when tenant does not have the feature', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createDbFeatureRow({ id: 13, code: 'vacation' }),
      );
      // UPDATE RETURNING → 0 rows
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.deactivateFeature(10, 'vacation', 42),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

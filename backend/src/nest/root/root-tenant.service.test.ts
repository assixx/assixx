/**
 * Unit tests for RootTenantService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: getTenants (parallel stats aggregation),
 *        getStorageInfo (plan lookup + parallel breakdown).
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { UserRepository } from '../database/repositories/user.repository.js';
import { RootTenantService } from './root-tenant.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./root.helpers.js', () => ({
  ERROR_CODES: { NOT_FOUND: 'NOT_FOUND' },
}));

vi.mock('./root.types.js', () => ({
  STORAGE_LIMITS: {
    basic: 1_073_741_824,
    professional: 5_368_709_120,
    enterprise: 10_737_418_240,
  } as Record<string, number>,
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockUserRepo() {
  return { countByRole: vi.fn() };
}

// =============================================================
// RootTenantService
// =============================================================

describe('RootTenantService', () => {
  let service: RootTenantService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockUserRepo: ReturnType<typeof createMockUserRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockUserRepo = createMockUserRepo();
    service = new RootTenantService(
      mockDb as unknown as DatabaseService,
      mockUserRepo as unknown as UserRepository,
    );
  });

  // =============================================================
  // getTenants
  // =============================================================

  describe('getTenants', () => {
    it('should return empty array when no tenant found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getTenants(10);

      expect(result).toEqual([]);
    });

    it('should return tenant with stats', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 10,
          company_name: 'Acme Corp',
          subdomain: 'acme',
          current_plan: 'professional',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      // adminCount
      mockUserRepo.countByRole.mockResolvedValueOnce(2);
      // employeeCount
      mockUserRepo.countByRole.mockResolvedValueOnce(50);
      // storageUsed
      mockDb.query.mockResolvedValueOnce([{ total: '1048576' }]);

      const result = await service.getTenants(10);

      expect(result).toHaveLength(1);
      expect(result[0]?.companyName).toBe('Acme Corp');
      expect(result[0]?.adminCount).toBe(2);
      expect(result[0]?.employeeCount).toBe(50);
      expect(result[0]?.storageUsed).toBe(1048576);
    });
  });

  // =============================================================
  // getStorageInfo
  // =============================================================

  describe('getStorageInfo', () => {
    it('should throw NotFoundException when tenant not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getStorageInfo(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return storage breakdown', async () => {
      // tenant plan
      mockDb.query.mockResolvedValueOnce([{ current_plan: 'basic' }]);
      // documents
      mockDb.query.mockResolvedValueOnce([{ total: '500000' }]);
      // attachments
      mockDb.query.mockResolvedValueOnce([{ total: '200000' }]);
      // logs
      mockDb.query.mockResolvedValueOnce([{ total: '50000' }]);

      const result = await service.getStorageInfo(10);

      expect(result.used).toBe(750000);
      expect(result.total).toBe(1_073_741_824);
      expect(result.plan).toBe('basic');
      expect(result.breakdown.documents).toBe(500000);
      expect(result.breakdown.attachments).toBe(200000);
      expect(result.breakdown.logs).toBe(50000);
    });

    it('should default to basic when plan unknown', async () => {
      mockDb.query.mockResolvedValueOnce([{ current_plan: 'unknown_plan' }]);
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);

      const result = await service.getStorageInfo(10);

      expect(result.total).toBe(1_073_741_824); // basic fallback
    });
  });
});

/**
 * Unit tests for RootTenantService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: getTenants (parallel stats aggregation),
 *        getStorageInfo (tenant_storage lookup + parallel breakdown).
 */
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

vi.mock('./root.types.js', async () => {
  const actual = await vi.importActual<typeof import('./root.types.js')>('./root.types.js');
  return { ...actual };
});

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn(), systemQuery: vi.fn() };
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
      mockDb.systemQuery.mockResolvedValueOnce([]);

      const result = await service.getTenants(10);

      expect(result).toEqual([]);
    });

    it('should return tenant with stats', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([
        {
          id: 10,
          company_name: 'Acme Corp',
          subdomain: 'acme',
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
      mockDb.systemQuery.mockResolvedValueOnce([{ total: '1048576' }]);

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
    it('should return storage breakdown from tenant_storage', async () => {
      // tenant_storage query
      mockDb.systemQuery.mockResolvedValueOnce([{ storage_limit_gb: 100 }]);
      // documents
      mockDb.systemQuery.mockResolvedValueOnce([{ total: '500000' }]);
      // attachments
      mockDb.systemQuery.mockResolvedValueOnce([{ total: '200000' }]);
      // logs
      mockDb.systemQuery.mockResolvedValueOnce([{ total: '50000' }]);

      const result = await service.getStorageInfo(10);

      expect(result.used).toBe(750000);
      expect(result.total).toBe(100 * 1024 * 1024 * 1024);
      expect(result.storageLimitGb).toBe(100);
      expect(result.breakdown?.documents).toBe(500000);
      expect(result.breakdown?.attachments).toBe(200000);
      expect(result.breakdown?.logs).toBe(50000);
    });

    it('should default to 100 GB when no tenant_storage entry', async () => {
      // tenant_storage returns empty
      mockDb.systemQuery.mockResolvedValueOnce([]);
      // documents, attachments, logs
      mockDb.systemQuery.mockResolvedValueOnce([{ total: '0' }]);
      mockDb.systemQuery.mockResolvedValueOnce([{ total: '0' }]);
      mockDb.systemQuery.mockResolvedValueOnce([{ total: '0' }]);

      const result = await service.getStorageInfo(10);

      expect(result.total).toBe(100 * 1024 * 1024 * 1024);
      expect(result.storageLimitGb).toBe(100);
    });
  });
});

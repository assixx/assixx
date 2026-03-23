/**
 * Assets Service – Unit Tests
 *
 * Tests for DB-mocked public methods + delegation checks.
 * Private methods tested via bracket notation.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { AssetMaintenanceService } from './asset-maintenance.service.js';
import type { AssetTeamService } from './asset-team.service.js';
import { AssetsService } from './assets.service.js';

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(): {
  service: AssetsService;
  mockDb: {
    query: ReturnType<typeof vi.fn>;
    queryOne: ReturnType<typeof vi.fn>;
  };
  mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;
  mockMaintenance: Record<string, ReturnType<typeof vi.fn>>;
  mockTeams: Record<string, ReturnType<typeof vi.fn>>;
} {
  const mockDb = {
    query: vi.fn(),
    queryOne: vi.fn(),
  };
  const mockActivityLogger = {
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  };
  const mockMaintenance = {
    getMaintenanceHistory: vi.fn(),
    addMaintenanceRecord: vi.fn(),
    getUpcomingMaintenance: vi.fn(),
    getStatistics: vi.fn(),
    getCategories: vi.fn(),
  };
  const mockTeams = {
    getAssetTeams: vi.fn(),
    setAssetTeams: vi.fn(),
  };

  const service = new AssetsService(
    mockDb as unknown as DatabaseService,
    mockActivityLogger as unknown as ActivityLoggerService,
    mockMaintenance as unknown as AssetMaintenanceService,
    mockTeams as unknown as AssetTeamService,
  );

  return { service, mockDb, mockActivityLogger, mockMaintenance, mockTeams };
}

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('AssetsService – DB-mocked methods', () => {
  let service: AssetsService;
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
    queryOne: ReturnType<typeof vi.fn>;
  };
  let _mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockMaintenance: Record<string, ReturnType<typeof vi.fn>>;
  let mockTeams: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    _mockActivityLogger = result.mockActivityLogger;
    mockMaintenance = result.mockMaintenance;
    mockTeams = result.mockTeams;
  });

  describe('listAssets', () => {
    it('should include team_id filter using EXISTS on asset_teams', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.listAssets(1, { team_id: 468 });

      const sql = mockDb.query.mock.calls[0][0] as string;
      expect(sql).toContain('asset_teams');
      expect(sql).toContain('mt2.team_id');
      expect(mockDb.query.mock.calls[0][1]).toContain(468);
    });

    it('should not include team_id filter when not provided', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.listAssets(1, {});

      const sql = mockDb.query.mock.calls[0][0] as string;
      expect(sql).not.toContain('mt2.team_id');
    });
  });

  describe('getAssetById', () => {
    it('throws NotFoundException when asset not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.getAssetById(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateSerialNumberUnique', () => {
    it('throws BadRequestException for duplicate serial number', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: 1 }); // existing found

      await expect(service['validateSerialNumberUnique']('SN-001', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns early for empty serial number', async () => {
      await service['validateSerialNumberUnique'](undefined, 1);

      expect(mockDb.queryOne).not.toHaveBeenCalled();
    });

    it('passes when serial number is unique', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null); // no existing

      await expect(service['validateSerialNumberUnique']('SN-NEW', 1)).resolves.toBeUndefined();
    });
  });

  describe('createAsset', () => {
    it('throws InternalServerErrorException when INSERT returns no rows', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null); // validateSerialNumberUnique
      mockDb.query.mockResolvedValueOnce([]); // INSERT returns empty

      await expect(service.createAsset({ name: 'Test Asset' } as never, 1, 5)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('resolveAssetIdByUuid', () => {
    it('throws NotFoundException when UUID not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service['resolveAssetIdByUuid']('non-existent-uuid', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns ID for valid UUID', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service['resolveAssetIdByUuid']('valid-uuid', 1);

      expect(result).toBe(42);
    });
  });

  // ==========================================================================
  // Delegation Tests
  // ==========================================================================

  describe('getStatistics – delegation', () => {
    it('delegates to maintenance sub-service', async () => {
      const expected = { total: 50, operational: 45 };
      mockMaintenance.getStatistics.mockResolvedValueOnce(expected);

      const result = await service.getStatistics(1);

      expect(mockMaintenance.getStatistics).toHaveBeenCalledWith(1);
      expect(result).toBe(expected);
    });
  });

  describe('getCategories – delegation', () => {
    it('delegates to maintenance sub-service', async () => {
      const expected = [{ id: 1, name: 'CNC' }];
      mockMaintenance.getCategories.mockResolvedValueOnce(expected);

      const result = await service.getCategories();

      expect(mockMaintenance.getCategories).toHaveBeenCalledOnce();
      expect(result).toBe(expected);
    });
  });

  describe('getUpcomingMaintenance – delegation', () => {
    it('delegates to maintenance sub-service', async () => {
      mockMaintenance.getUpcomingMaintenance.mockResolvedValueOnce([]);

      const result = await service.getUpcomingMaintenance(1, 30);

      expect(mockMaintenance.getUpcomingMaintenance).toHaveBeenCalledWith(1, 30);
      expect(result).toEqual([]);
    });
  });

  describe('addMaintenanceRecord – pre-check + delegation', () => {
    it('throws NotFoundException when asset does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null); // getAssetById

      await expect(service.addMaintenanceRecord({ assetId: 999 } as never, 1, 5)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockMaintenance.addMaintenanceRecord).not.toHaveBeenCalled();
    });

    it('delegates to maintenance sub-service after verifying asset', async () => {
      const expected = { id: 1, type: 'repair' };
      mockDb.queryOne.mockResolvedValueOnce({
        id: 1,
        uuid: 'u',
        name: 'A',
        tenant_id: 1,
        model: null,
        manufacturer: null,
        serial_number: null,
        asset_number: null,
        department_id: null,
        area_id: null,
        location: null,
        asset_type: 'cnc',
        status: 'operational',
        is_active: IS_ACTIVE.ACTIVE,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null,
        purchase_date: null,
        installation_date: null,
        warranty_until: null,
        last_maintenance: null,
        next_maintenance: null,
        operating_hours: null,
        production_capacity: null,
        energy_consumption: null,
        manual_url: null,
        qr_code: null,
        notes: null,
      }); // getAssetById
      mockMaintenance.addMaintenanceRecord.mockResolvedValueOnce(expected);

      const result = await service.addMaintenanceRecord({ assetId: 1 } as never, 1, 5);

      expect(mockMaintenance.addMaintenanceRecord).toHaveBeenCalledWith({ assetId: 1 }, 1, 5);
      expect(result).toBe(expected);
    });
  });

  const existingAsset = {
    id: 1,
    uuid: 'u',
    name: 'CNC-1',
    tenant_id: 1,
    model: null,
    manufacturer: null,
    serial_number: null,
    serialNumber: null,
    asset_number: null,
    department_id: null,
    area_id: null,
    location: null,
    asset_type: 'cnc',
    status: 'operational',
    is_active: IS_ACTIVE.ACTIVE,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: null,
    updated_by: null,
    purchase_date: null,
    installation_date: null,
    warranty_until: null,
    last_maintenance: null,
    next_maintenance: null,
    operating_hours: null,
    production_capacity: null,
    energy_consumption: null,
    manual_url: null,
    qr_code: null,
    notes: null,
  };

  describe('updateAsset', () => {
    it('validates serial number uniqueness when serial number changes', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce(existingAsset) // getAssetById
        .mockResolvedValueOnce({ id: 99 }); // validateSerialNumberUnique finds duplicate

      await expect(
        service.updateAsset(1, { serialNumber: 'SN-NEW' } as never, 1, 5),
      ).rejects.toThrow(BadRequestException);
    });

    it('skips serial number validation when unchanged', async () => {
      const assetWithSerial = { ...existingAsset, serial_number: 'SN-001', serialNumber: 'SN-001' };
      mockDb.queryOne.mockResolvedValueOnce(assetWithSerial); // getAssetById
      mockDb.query.mockResolvedValueOnce([]); // UPDATE
      mockDb.queryOne.mockResolvedValueOnce(assetWithSerial); // getAssetById (return updated)

      await service.updateAsset(1, { serialNumber: 'SN-001' } as never, 1, 5);

      // validateSerialNumberUnique uses queryOne — only getAssetById calls should exist
      expect(mockDb.queryOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteAsset', () => {
    it('throws NotFoundException when asset does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null); // getAssetById

      await expect(service.deleteAsset(999, 1, 5)).rejects.toThrow(NotFoundException);
    });

    it('deletes asset and logs activity', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        ...existingAsset,
        serial_number: 'SN-001',
        serialNumber: 'SN-001',
      }); // getAssetById
      mockDb.query.mockResolvedValueOnce([]); // DELETE

      await service.deleteAsset(1, 1, 5);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('DELETE FROM assets');
      expect(mockDb.query.mock.calls[0]?.[1]).toEqual([1, 1]);
    });
  });

  describe('deactivateAsset', () => {
    it('should set is_active to INACTIVE', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: 1,
        uuid: 'u',
        name: 'A',
        tenant_id: 1,
        model: null,
        manufacturer: null,
        serial_number: null,
        asset_number: null,
        department_id: null,
        area_id: null,
        location: null,
        asset_type: 'cnc',
        status: 'operational',
        is_active: IS_ACTIVE.ACTIVE,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null,
        purchase_date: null,
        installation_date: null,
        warranty_until: null,
        last_maintenance: null,
        next_maintenance: null,
        operating_hours: null,
        production_capacity: null,
        energy_consumption: null,
        manual_url: null,
        qr_code: null,
        notes: null,
      });
      mockDb.query.mockResolvedValueOnce([]);

      await service.deactivateAsset(1, 1, 5);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('is_active');
    });
  });

  describe('activateAsset', () => {
    it('should set is_active to ACTIVE', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: 1,
        uuid: 'u',
        name: 'A',
        tenant_id: 1,
        model: null,
        manufacturer: null,
        serial_number: null,
        asset_number: null,
        department_id: null,
        area_id: null,
        location: null,
        asset_type: 'cnc',
        status: 'operational',
        is_active: IS_ACTIVE.INACTIVE,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null,
        purchase_date: null,
        installation_date: null,
        warranty_until: null,
        last_maintenance: null,
        next_maintenance: null,
        operating_hours: null,
        production_capacity: null,
        energy_consumption: null,
        manual_url: null,
        qr_code: null,
        notes: null,
      });
      mockDb.query.mockResolvedValueOnce([]);

      await service.activateAsset(1, 1, 5);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('is_active');
    });
  });

  describe('getAssetTeams – delegation', () => {
    it('verifies asset exists and delegates to teams sub-service', async () => {
      // getAssetById succeeds — needs full row for mapDbAssetToApi
      // All optional fields must be null (NOT undefined) to avoid new Date(undefined)
      mockDb.queryOne.mockResolvedValueOnce({
        id: 1,
        uuid: '01953d6a-0000-7000-8000-000000000001',
        name: 'Asset 1',
        tenant_id: 1,
        model: null,
        manufacturer: null,
        serial_number: null,
        asset_number: null,
        department_id: null,
        area_id: null,
        location: null,
        asset_type: 'cnc',
        status: 'operational',
        is_active: IS_ACTIVE.ACTIVE,
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-01'),
        created_by: null,
        updated_by: null,
        purchase_date: null,
        installation_date: null,
        warranty_until: null,
        last_maintenance: null,
        next_maintenance: null,
        operating_hours: null,
        production_capacity: null,
        energy_consumption: null,
        manual_url: null,
        qr_code: null,
        notes: null,
      });
      mockTeams.getAssetTeams.mockResolvedValueOnce([]);

      const result = await service.getAssetTeams(1, 1);

      expect(mockTeams.getAssetTeams).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual([]);
    });

    it('throws NotFoundException when asset does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.getAssetTeams(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // UUID Wrapper Delegation Tests
  // ==========================================================================

  describe('updateAssetByUuid', () => {
    it('resolves UUID and delegates to updateAsset', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]); // resolveAssetIdByUuid
      mockDb.queryOne.mockResolvedValueOnce(existingAsset); // getAssetById (inside updateAsset)
      mockDb.query.mockResolvedValueOnce([]); // UPDATE
      mockDb.queryOne.mockResolvedValueOnce(existingAsset); // getAssetById (return updated)

      await service.updateAssetByUuid('valid-uuid', { name: 'New' } as never, 1, 5);

      expect(mockDb.query.mock.calls[0]?.[1]).toContain('valid-uuid');
    });

    it('throws NotFoundException for unknown UUID', async () => {
      mockDb.query.mockResolvedValueOnce([]); // resolveAssetIdByUuid

      await expect(service.updateAssetByUuid('bad-uuid', {} as never, 1, 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteAssetByUuid', () => {
    it('resolves UUID and delegates to deleteAsset', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]); // resolveAssetIdByUuid
      mockDb.queryOne.mockResolvedValueOnce(existingAsset); // getAssetById
      mockDb.query.mockResolvedValueOnce([]); // DELETE

      await service.deleteAssetByUuid('valid-uuid', 1, 5);

      expect(mockDb.query.mock.calls[1]?.[0]).toContain('DELETE FROM assets');
    });

    it('throws NotFoundException for unknown UUID', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteAssetByUuid('bad-uuid', 1, 5)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateAssetByUuid', () => {
    it('resolves UUID and delegates to deactivateAsset', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]); // resolveAssetIdByUuid
      mockDb.queryOne.mockResolvedValueOnce({ ...existingAsset, is_active: IS_ACTIVE.ACTIVE }); // getAssetById
      mockDb.query.mockResolvedValueOnce([]); // UPDATE is_active

      await service.deactivateAssetByUuid('valid-uuid', 1, 5);

      const sql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(sql).toContain('is_active');
    });

    it('throws NotFoundException for unknown UUID', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deactivateAssetByUuid('bad-uuid', 1, 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activateAssetByUuid', () => {
    it('resolves UUID and delegates to activateAsset', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]); // resolveAssetIdByUuid
      mockDb.queryOne.mockResolvedValueOnce({ ...existingAsset, is_active: IS_ACTIVE.INACTIVE }); // getAssetById
      mockDb.query.mockResolvedValueOnce([]); // UPDATE is_active

      await service.activateAssetByUuid('valid-uuid', 1, 5);

      const sql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(sql).toContain('is_active');
    });

    it('throws NotFoundException for unknown UUID', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.activateAssetByUuid('bad-uuid', 1, 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

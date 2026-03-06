/**
 * Unit tests for TpmLocationsService
 *
 * Mocked dependencies: DatabaseService (query, queryOne, tenantTransaction),
 * ActivityLoggerService (logCreate, logUpdate, logDelete).
 * Tests: listLocations, getLocation, createLocation, updateLocation,
 * deleteLocation, setPhoto, removePhoto.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { TpmLocationsService } from './tpm-locations.service.js';
import type { TpmLocationRow } from './tpm.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

type LocationJoinRow = TpmLocationRow & {
  plan_uuid?: string;
  created_by_name?: string;
};

function createLocationRow(
  overrides?: Partial<LocationJoinRow>,
): LocationJoinRow {
  return {
    id: 1,
    uuid: 'loc-uuid-001                           ',
    tenant_id: 10,
    plan_id: 5,
    position_number: 1,
    title: 'Hydraulikstation A',
    description: 'Prüfpunkt an der Hauptleitung',
    photo_path: null,
    photo_file_name: null,
    photo_file_size: null,
    photo_mime_type: null,
    is_active: 1,
    created_by: 42,
    created_at: '2026-02-25T00:00:00.000Z',
    updated_at: '2026-02-25T00:00:00.000Z',
    ...overrides,
  };
}

const mockActivityLogger = {
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue(undefined),
};

// =============================================================
// TpmLocationsService
// =============================================================

describe('TpmLocationsService', () => {
  let service: TpmLocationsService;
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

    service = new TpmLocationsService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // listLocations
  // =============================================================

  describe('listLocations()', () => {
    it('should return mapped locations ordered by position', async () => {
      mockDb.query.mockResolvedValueOnce([
        createLocationRow({
          position_number: 1,
          title: 'Station A',
          plan_uuid: 'plan-uuid-001',
          created_by_name: 'Max Muster',
        }),
        createLocationRow({
          id: 2,
          uuid: 'loc-uuid-002                           ',
          position_number: 2,
          title: 'Station B',
          plan_uuid: 'plan-uuid-001',
        }),
      ]);

      const result = await service.listLocations(10, 'plan-uuid-001');

      expect(result).toHaveLength(2);
      expect(result[0]?.positionNumber).toBe(1);
      expect(result[0]?.title).toBe('Station A');
      expect(result[0]?.planUuid).toBe('plan-uuid-001');
      expect(result[0]?.createdByName).toBe('Max Muster');
      expect(result[1]?.positionNumber).toBe(2);
    });

    it('should return empty array when no locations exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listLocations(10, 'plan-uuid-001');

      expect(result).toHaveLength(0);
    });

    it('should trim uuid whitespace from DB', async () => {
      mockDb.query.mockResolvedValueOnce([createLocationRow()]);

      const result = await service.listLocations(10, 'plan-uuid-001');

      expect(result[0]?.uuid).toBe('loc-uuid-001');
    });

    it('should convert Date created_at to ISO string', async () => {
      mockDb.query.mockResolvedValueOnce([
        createLocationRow({
          created_at: new Date('2026-02-25T10:00:00Z') as unknown as string,
        }),
      ]);

      const result = await service.listLocations(10, 'plan-uuid-001');

      expect(result[0]?.createdAt).toBe('2026-02-25T10:00:00.000Z');
    });

    it('should pass string created_at through directly', async () => {
      mockDb.query.mockResolvedValueOnce([
        createLocationRow({ created_at: '2026-01-01T00:00:00.000Z' }),
      ]);

      const result = await service.listLocations(10, 'plan-uuid-001');

      expect(result[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  // =============================================================
  // getLocation
  // =============================================================

  describe('getLocation()', () => {
    it('should return a single mapped location', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createLocationRow({
          plan_uuid: 'plan-uuid-001',
          created_by_name: 'Anna Schmidt',
          photo_path: 'uploads/tpm/locations/10/loc-uuid-001/photo.jpg',
          photo_file_name: 'photo.jpg',
          photo_file_size: 204800,
          photo_mime_type: 'image/jpeg',
        }),
      );

      const result = await service.getLocation(10, 'loc-uuid-001');

      expect(result.uuid).toBe('loc-uuid-001');
      expect(result.title).toBe('Hydraulikstation A');
      expect(result.description).toBe('Prüfpunkt an der Hauptleitung');
      expect(result.photoPath).toBe(
        'uploads/tpm/locations/10/loc-uuid-001/photo.jpg',
      );
      expect(result.photoFileName).toBe('photo.jpg');
      expect(result.photoFileSize).toBe(204800);
      expect(result.photoMimeType).toBe('image/jpeg');
      expect(result.createdByName).toBe('Anna Schmidt');
      expect(result.isActive).toBe(1);
    });

    it('should throw NotFoundException when location not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.getLocation(10, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should map null photo fields correctly', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createLocationRow());

      const result = await service.getLocation(10, 'loc-uuid-001');

      expect(result.photoPath).toBeNull();
      expect(result.photoFileName).toBeNull();
      expect(result.photoFileSize).toBeNull();
      expect(result.photoMimeType).toBeNull();
    });

    it('should map null description correctly', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createLocationRow({ description: null }),
      );

      const result = await service.getLocation(10, 'loc-uuid-001');

      expect(result.description).toBeNull();
    });
  });

  // =============================================================
  // createLocation
  // =============================================================

  describe('createLocation()', () => {
    it('should resolve plan UUID and insert location', async () => {
      // resolvePlanId
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 5 }],
      });
      // INSERT RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createLocationRow({ position_number: 3, title: 'Neue Station' }),
        ],
      });

      const result = await service.createLocation(10, 42, {
        planUuid: 'plan-uuid-001',
        positionNumber: 3,
        title: 'Neue Station',
        description: null,
      });

      expect(result.title).toBe('Neue Station');
      expect(result.positionNumber).toBe(3);
    });

    it('should pass null for optional description', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow({ description: null })],
      });

      const result = await service.createLocation(10, 42, {
        planUuid: 'plan-uuid-001',
        positionNumber: 1,
        title: 'Test',
      });

      expect(result.description).toBeNull();

      // Verify null was passed as description param
      const insertParams = mockClient.query.mock.calls[1]?.[1] as unknown[];
      expect(insertParams?.[5]).toBeNull();
    });

    it('should throw NotFoundException when plan not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createLocation(10, 42, {
          planUuid: 'nonexistent-plan',
          positionNumber: 1,
          title: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when INSERT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createLocation(10, 42, {
          planUuid: 'plan-uuid-001',
          positionNumber: 1,
          title: 'Test',
        }),
      ).rejects.toThrow('INSERT into tpm_locations returned no rows');
    });

    it('should call activityLogger.logCreate', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });

      await service.createLocation(10, 42, {
        planUuid: 'plan-uuid-001',
        positionNumber: 1,
        title: 'Hydraulikstation A',
      });

      expect(mockActivityLogger.logCreate).toHaveBeenCalledWith(
        10,
        42,
        'asset',
        0,
        expect.stringContaining('TPM-Standort erstellt'),
        expect.objectContaining({ positionNumber: 1 }),
      );
    });
  });

  // =============================================================
  // updateLocation
  // =============================================================

  describe('updateLocation()', () => {
    it('should update with provided fields', async () => {
      // FOR UPDATE lock
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });
      // UPDATE RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow({ title: 'Umbenannte Station' })],
      });

      const result = await service.updateLocation(10, 42, 'loc-uuid-001', {
        title: 'Umbenannte Station',
      });

      expect(result.title).toBe('Umbenannte Station');
    });

    it('should return existing location when no fields provided', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });

      const result = await service.updateLocation(10, 42, 'loc-uuid-001', {});

      expect(result.title).toBe('Hydraulikstation A');
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('should use FOR UPDATE lock to prevent race conditions', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow({ title: 'Updated' })],
      });

      await service.updateLocation(10, 42, 'loc-uuid-001', {
        title: 'Updated',
      });

      const lockSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(lockSql).toContain('FOR UPDATE');
    });

    it('should build dynamic SET clause for positionNumber only', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow({ position_number: 5 })],
      });

      await service.updateLocation(10, 42, 'loc-uuid-001', {
        positionNumber: 5,
      });

      const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('position_number');
      expect(updateSql).not.toContain('title =');
      expect(updateSql).not.toContain('description =');
    });

    it('should build dynamic SET clause for all fields', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });

      await service.updateLocation(10, 42, 'loc-uuid-001', {
        positionNumber: 10,
        title: 'Neuer Titel',
        description: 'Neue Beschreibung',
      });

      const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('position_number');
      expect(updateSql).toContain('title');
      expect(updateSql).toContain('description');
    });

    it('should throw NotFoundException when location not found for update', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateLocation(10, 42, 'nonexistent', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call activityLogger.logUpdate', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow({ title: 'Updated' })],
      });

      await service.updateLocation(10, 42, 'loc-uuid-001', {
        title: 'Updated',
      });

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        10,
        42,
        'asset',
        0,
        expect.stringContaining('TPM-Standort aktualisiert'),
        undefined,
        expect.objectContaining({ uuid: 'loc-uuid-001', title: 'Updated' }),
      );
    });
  });

  // =============================================================
  // deleteLocation
  // =============================================================

  describe('deleteLocation()', () => {
    it('should soft-delete a location (is_active = 4)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      });

      await expect(
        service.deleteLocation(10, 42, 'loc-uuid-001'),
      ).resolves.toBeUndefined();

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('is_active = 4');
    });

    it('should throw NotFoundException when location not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.deleteLocation(10, 42, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call activityLogger.logDelete', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      });

      await service.deleteLocation(10, 42, 'loc-uuid-001');

      expect(mockActivityLogger.logDelete).toHaveBeenCalledWith(
        10,
        42,
        'asset',
        0,
        expect.stringContaining('TPM-Standort gelöscht'),
        expect.objectContaining({ uuid: 'loc-uuid-001' }),
      );
    });
  });

  // =============================================================
  // setPhoto
  // =============================================================

  describe('setPhoto()', () => {
    const photoData = {
      filePath: 'uploads/tpm/locations/10/loc-uuid-001/photo-uuid.jpg',
      fileName: 'maschine-foto.jpg',
      fileSize: 1048576,
      mimeType: 'image/jpeg',
    };

    it('should update photo metadata on a location', async () => {
      // FOR UPDATE lock
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });
      // UPDATE RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createLocationRow({
            photo_path: photoData.filePath,
            photo_file_name: photoData.fileName,
            photo_file_size: photoData.fileSize,
            photo_mime_type: photoData.mimeType,
          }),
        ],
      });

      const result = await service.setPhoto(10, 42, 'loc-uuid-001', photoData);

      expect(result.photoPath).toBe(photoData.filePath);
      expect(result.photoFileName).toBe(photoData.fileName);
      expect(result.photoFileSize).toBe(photoData.fileSize);
      expect(result.photoMimeType).toBe(photoData.mimeType);
    });

    it('should lock location before updating photo', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });

      await service.setPhoto(10, 42, 'loc-uuid-001', photoData);

      const lockSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(lockSql).toContain('FOR UPDATE');
    });

    it('should throw NotFoundException when location not found for photo', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.setPhoto(10, 42, 'nonexistent', photoData),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when UPDATE returns no rows', async () => {
      // Lock succeeds
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });
      // UPDATE returns nothing
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.setPhoto(10, 42, 'loc-uuid-001', photoData),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call activityLogger.logUpdate for photo', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });

      await service.setPhoto(10, 42, 'loc-uuid-001', photoData);

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        10,
        42,
        'asset',
        0,
        expect.stringContaining('Foto aktualisiert'),
        undefined,
        expect.objectContaining({
          uuid: 'loc-uuid-001',
          fileName: 'maschine-foto.jpg',
        }),
      );
    });
  });

  // =============================================================
  // removePhoto
  // =============================================================

  describe('removePhoto()', () => {
    it('should clear all photo fields', async () => {
      // FOR UPDATE lock
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createLocationRow({
            photo_path: 'uploads/old-photo.jpg',
            photo_file_name: 'old-photo.jpg',
            photo_file_size: 500000,
            photo_mime_type: 'image/jpeg',
          }),
        ],
      });
      // UPDATE RETURNING (photo fields now null)
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });

      const result = await service.removePhoto(10, 42, 'loc-uuid-001');

      expect(result.photoPath).toBeNull();
      expect(result.photoFileName).toBeNull();
      expect(result.photoFileSize).toBeNull();
      expect(result.photoMimeType).toBeNull();
    });

    it('should set photo columns to NULL in SQL', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });

      await service.removePhoto(10, 42, 'loc-uuid-001');

      const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('photo_path = NULL');
      expect(updateSql).toContain('photo_file_name = NULL');
      expect(updateSql).toContain('photo_file_size = NULL');
      expect(updateSql).toContain('photo_mime_type = NULL');
    });

    it('should throw NotFoundException when location not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.removePhoto(10, 42, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when UPDATE returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.removePhoto(10, 42, 'loc-uuid-001')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should call activityLogger.logUpdate for photo removal', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createLocationRow()],
      });

      await service.removePhoto(10, 42, 'loc-uuid-001');

      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        10,
        42,
        'asset',
        0,
        expect.stringContaining('Foto entfernt'),
        undefined,
        expect.objectContaining({ uuid: 'loc-uuid-001' }),
      );
    });
  });
});

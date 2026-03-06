/**
 * Unit tests for WorkOrderPhotosService
 *
 * Mocked dependencies: DatabaseService, ActivityLoggerService, node:fs/promises.
 * Focus: addPhoto (happy path, WO not found, max limit),
 *        getPhotos (happy path, empty result),
 *        deletePhoto (happy path, photo not found).
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { WorkOrderPhotosService } from './work-orders-photos.service.js';
import type { WorkOrderPhotoRow } from './work-orders.types.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// =============================================================
// Mock factories
// =============================================================

const mockDb = {
  query: vi.fn(),
  queryOne: vi.fn(),
};

const mockActivityLogger = {
  logCreate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
};

function makePhotoRow(
  overrides: Partial<WorkOrderPhotoRow> = {},
): WorkOrderPhotoRow {
  return {
    id: 1,
    uuid: '019537a0-0000-7000-8000-000000000001',
    tenant_id: 10,
    work_order_id: 42,
    uploaded_by: 5,
    file_path: 'uploads/work-orders/10/wo-uuid/photo.jpg',
    file_name: 'photo.jpg',
    file_size: 204_800,
    mime_type: 'image/jpeg',
    sort_order: 0,
    created_at: '2026-03-01T12:00:00.000Z',
    ...overrides,
  };
}

const MOCK_FILE = {
  buffer: Buffer.from('fake-image-data'),
  originalname: 'photo.jpg',
  mimetype: 'image/jpeg',
  size: 204_800,
};

// =============================================================
// WorkOrderPhotosService
// =============================================================

describe('WorkOrderPhotosService', () => {
  let service: WorkOrderPhotosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkOrderPhotosService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // addPhoto
  // =============================================================

  describe('addPhoto', () => {
    it('should upload a photo and return mapped API response', async () => {
      // resolveWorkOrder
      mockDb.queryOne.mockResolvedValueOnce({
        id: 42,
        title: 'Pumpe prüfen',
        status: 'open',
      });
      // enforcePhotoLimit
      mockDb.queryOne.mockResolvedValueOnce({ count: '3' });
      // INSERT RETURNING *
      mockDb.queryOne.mockResolvedValueOnce(makePhotoRow());

      const result = await service.addPhoto(10, 5, 'wo-uuid', MOCK_FILE);

      expect(result.uuid).toBe('019537a0-0000-7000-8000-000000000001');
      expect(result.fileName).toBe('photo.jpg');
      expect(result.fileSize).toBe(204_800);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.sortOrder).toBe(0);
      expect(result.createdAt).toBe('2026-03-01T12:00:00.000Z');

      expect(mockDb.queryOne).toHaveBeenCalledTimes(3);
    });

    it('should throw NotFoundException when work order does not exist', async () => {
      // resolveWorkOrder returns null
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(
        service.addPhoto(10, 5, 'missing-wo', MOCK_FILE),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when work order is completed', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: 42,
        title: 'Pumpe prüfen',
        status: 'completed',
      });

      await expect(
        service.addPhoto(10, 5, 'wo-uuid', MOCK_FILE),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when work order is verified', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: 42,
        title: 'Pumpe prüfen',
        status: 'verified',
      });

      await expect(
        service.addPhoto(10, 5, 'wo-uuid', MOCK_FILE),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when photo limit is reached', async () => {
      // resolveWorkOrder
      mockDb.queryOne.mockResolvedValueOnce({
        id: 42,
        title: 'Pumpe prüfen',
        status: 'open',
      });
      // enforcePhotoLimit — count >= 10
      mockDb.queryOne.mockResolvedValueOnce({ count: '10' });

      await expect(
        service.addPhoto(10, 5, 'wo-uuid', MOCK_FILE),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when INSERT returns null', async () => {
      // resolveWorkOrder
      mockDb.queryOne.mockResolvedValueOnce({
        id: 42,
        title: 'Pumpe prüfen',
        status: 'open',
      });
      // enforcePhotoLimit
      mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
      // INSERT returns null
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(
        service.addPhoto(10, 5, 'wo-uuid', MOCK_FILE),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =============================================================
  // getPhotos
  // =============================================================

  describe('getPhotos', () => {
    it('should return mapped photo array', async () => {
      mockDb.query.mockResolvedValueOnce([
        makePhotoRow(),
        makePhotoRow({
          id: 2,
          uuid: '019537a0-0000-7000-8000-000000000002',
          file_name: 'photo2.png',
          mime_type: 'image/png',
          sort_order: 1,
        }),
      ]);

      const result = await service.getPhotos(10, 'wo-uuid');

      expect(result).toHaveLength(2);
      expect(result[0]?.fileName).toBe('photo.jpg');
      expect(result[1]?.fileName).toBe('photo2.png');
      expect(result[1]?.sortOrder).toBe(1);
    });

    it('should return empty array when no photos exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getPhotos(10, 'wo-uuid');

      expect(result).toEqual([]);
    });
  });

  // =============================================================
  // getSourcePhotos
  // =============================================================

  describe('getSourcePhotos', () => {
    it('should return mapped source photos for tpm_defect', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          uuid: '019caf7b-be0f-70c4-b4e1-6b14d55c5bcd',
          file_path: 'uploads/tpm/2/defects/abc/photo.jpg',
          file_name: 'defect-photo.jpg',
          file_size: 14_499,
          mime_type: 'image/jpeg',
          created_at: '2026-03-02T16:57:28.331Z',
        },
      ]);

      const result = await service.getSourcePhotos(10, 'wo-uuid');

      expect(result).toHaveLength(1);
      expect(result[0]?.uuid).toBe('019caf7b-be0f-70c4-b4e1-6b14d55c5bcd');
      expect(result[0]?.filePath).toBe('uploads/tpm/2/defects/abc/photo.jpg');
      expect(result[0]?.fileName).toBe('defect-photo.jpg');
      expect(result[0]?.fileSize).toBe(14_499);
      expect(result[0]?.mimeType).toBe('image/jpeg');
    });

    it('should return empty array when no source photos exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getSourcePhotos(10, 'wo-uuid');

      expect(result).toEqual([]);
    });

    it('should return empty array for manual work order (no tpm_defect match)', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getSourcePhotos(10, 'manual-wo-uuid');

      expect(result).toEqual([]);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // deletePhoto
  // =============================================================

  describe('deletePhoto', () => {
    it('should delete photo from DB and trigger file cleanup', async () => {
      // find photo (owned by user 5)
      mockDb.queryOne.mockResolvedValueOnce({
        id: 1,
        file_path: 'uploads/work-orders/10/wo-uuid/photo.jpg',
        work_order_id: 42,
        uploaded_by: 5,
        wo_status: 'open',
      });
      // DELETE query
      mockDb.query.mockResolvedValueOnce([]);

      await service.deletePhoto(10, 5, 'admin', 'photo-uuid');

      expect(mockDb.queryOne).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should allow admin to delete any photo', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: 1,
        file_path: 'uploads/work-orders/10/wo-uuid/photo.jpg',
        work_order_id: 42,
        uploaded_by: 99,
        wo_status: 'in_progress',
      });
      mockDb.query.mockResolvedValueOnce([]);

      await service.deletePhoto(10, 5, 'admin', 'photo-uuid');

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should allow employee to delete own photo', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: 1,
        file_path: 'uploads/work-orders/10/wo-uuid/photo.jpg',
        work_order_id: 42,
        uploaded_by: 5,
        wo_status: 'open',
      });
      mockDb.query.mockResolvedValueOnce([]);

      await service.deletePhoto(10, 5, 'employee', 'photo-uuid');

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when work order is completed', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: 1,
        file_path: 'uploads/work-orders/10/wo-uuid/photo.jpg',
        work_order_id: 42,
        uploaded_by: 5,
        wo_status: 'completed',
      });

      await expect(
        service.deletePhoto(10, 5, 'admin', 'photo-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when work order is verified', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: 1,
        file_path: 'uploads/work-orders/10/wo-uuid/photo.jpg',
        work_order_id: 42,
        uploaded_by: 5,
        wo_status: 'verified',
      });

      await expect(
        service.deletePhoto(10, 5, 'admin', 'photo-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when employee deletes other photo', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: 1,
        file_path: 'uploads/work-orders/10/wo-uuid/photo.jpg',
        work_order_id: 42,
        uploaded_by: 99,
        wo_status: 'open',
      });

      await expect(
        service.deletePhoto(10, 5, 'employee', 'photo-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when photo does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(
        service.deletePhoto(10, 5, 'admin', 'missing-photo-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { InventoryPhotosService } from './inventory-photos.service.js';
import type { InventoryItemPhotoRow } from './inventory.types.js';

// ── Mock Factories ──────────────────────────────────────────────

const qf = vi.fn();
const qof = vi.fn();
const mockClient = { query: vi.fn() };

function createMockDb() {
  return {
    query: qf,
    tenantQuery: qf,
    queryOne: qof,
    tenantQueryOne: qof,
    tenantTransaction: vi
      .fn()
      .mockImplementation(
        async (cb: (client: typeof mockClient) => Promise<unknown>): Promise<unknown> =>
          await cb(mockClient),
      ),
  };
}

function makePhotoRow(overrides: Partial<InventoryItemPhotoRow> = {}): InventoryItemPhotoRow {
  return {
    id: 'photo-uuid-1',
    tenant_id: 1,
    item_id: 'item-uuid-1',
    file_path: '/uploads/inventory/photo1.jpg',
    caption: 'Vorderansicht',
    sort_order: 0,
    is_active: 1,
    created_by: 10,
    created_at: new Date(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('InventoryPhotosService', () => {
  let service: InventoryPhotosService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    const mockDb = createMockDb();
    service = new InventoryPhotosService(mockDb as unknown as DatabaseService);
  });

  // ── findByItem ──────────────────────────────────────────────

  describe('findByItem', () => {
    it('should return photos ordered by sort_order', async () => {
      const photos = [makePhotoRow({ sort_order: 0 }), makePhotoRow({ sort_order: 1 })];
      qf.mockResolvedValueOnce(photos);

      const result = await service.findByItem('item-uuid-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty for item without photos', async () => {
      qf.mockResolvedValueOnce([]);

      const result = await service.findByItem('item-uuid-1');

      expect(result).toHaveLength(0);
    });
  });

  // ── create ──────────────────────────────────────────────────

  describe('create', () => {
    it('should create a photo record', async () => {
      qf.mockResolvedValueOnce([{ count: '0' }]); // photo count
      qf.mockResolvedValueOnce([makePhotoRow()]);

      const result = await service.create('item-uuid-1', '/uploads/photo.jpg', 'Test', 10);

      expect(result.file_path).toBe('/uploads/inventory/photo1.jpg');
    });

    it('should reject when max photos reached (20)', async () => {
      qf.mockResolvedValueOnce([{ count: '20' }]);

      await expect(service.create('item-uuid-1', '/path.jpg', null, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow photo at limit-1 (19)', async () => {
      qf.mockResolvedValueOnce([{ count: '19' }]);
      qf.mockResolvedValueOnce([makePhotoRow()]);

      await expect(service.create('item-uuid-1', '/path.jpg', null, 10)).resolves.toBeDefined();
    });

    it('should set sort_order to current count', async () => {
      qf.mockResolvedValueOnce([{ count: '5' }]);
      qf.mockResolvedValueOnce([makePhotoRow({ sort_order: 5 })]);

      await service.create('item-uuid-1', '/path.jpg', null, 10);

      const insertParams = qf.mock.calls[1]?.[1] as unknown[];
      expect(insertParams[3]).toBe(5); // sort_order = existing count
    });
  });

  // ── updateCaption ───────────────────────────────────────────

  describe('updateCaption', () => {
    it('should update caption', async () => {
      qf.mockResolvedValueOnce([makePhotoRow({ caption: 'Neue Beschriftung' })]);

      const result = await service.updateCaption('photo-uuid-1', 'Neue Beschriftung');

      expect(result.caption).toBe('Neue Beschriftung');
    });

    it('should allow null caption', async () => {
      qf.mockResolvedValueOnce([makePhotoRow({ caption: null })]);

      const result = await service.updateCaption('photo-uuid-1', null);

      expect(result.caption).toBeNull();
    });

    it('should throw NotFoundException for missing photo', async () => {
      qf.mockResolvedValueOnce([]);

      await expect(service.updateCaption('nonexistent', 'X')).rejects.toThrow(NotFoundException);
    });
  });

  // ── reorder ─────────────────────────────────────────────────

  describe('reorder', () => {
    it('should update sort_order based on array position in transaction', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.reorder('item-uuid-1', ['photo-3', 'photo-1', 'photo-2']);

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      const call0Params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(call0Params[0]).toBe('photo-3');
      expect(call0Params[1]).toBe(0); // first position

      const call2Params = mockClient.query.mock.calls[2]?.[1] as unknown[];
      expect(call2Params[0]).toBe('photo-2');
      expect(call2Params[1]).toBe(2); // third position
    });

    it('should handle empty array without transaction', async () => {
      const mockDb = createMockDb();
      const svc = new InventoryPhotosService(mockDb as unknown as DatabaseService);

      await svc.reorder('item-uuid-1', []);

      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
    });
  });

  // ── softDelete ──────────────────────────────────────────────

  describe('softDelete', () => {
    it('should soft-delete photo', async () => {
      qf.mockResolvedValueOnce([{ id: 'photo-uuid-1' }]);

      await expect(service.softDelete('photo-uuid-1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException for missing photo', async () => {
      qf.mockResolvedValueOnce([]);

      await expect(service.softDelete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});

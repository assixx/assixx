/**
 * Read Tracking Service – Unit Tests
 *
 * Tests markAsRead (UPSERT + fire-and-forget error handling)
 * and markAsReadByUuid (UUID resolution + NotFoundException).
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../../database/database.service.js';
import {
  type ReadTrackingConfig,
  ReadTrackingService,
} from './read-tracking.service.js';

// =============================================================
// Constants
// =============================================================

const CONFIG: ReadTrackingConfig = {
  tableName: 'work_order_read_status',
  entityColumn: 'work_order_id',
  entityTable: 'work_orders',
  entityUuidColumn: 'uuid',
};

const ENTITY_ID = 42;
const USER_ID = 7;
const TENANT_ID = 1;
const ENTITY_UUID = '019462ab-7e2a-7000-8000-000000000001';

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(null),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

// =============================================================
// Test Suite
// =============================================================

describe('ReadTrackingService', () => {
  let service: ReadTrackingService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new ReadTrackingService(mockDb as unknown as DatabaseService);
  });

  // -----------------------------------------------------------
  // markAsRead
  // -----------------------------------------------------------

  describe('markAsRead()', () => {
    it('should execute UPSERT query with correct params', async () => {
      await service.markAsRead(CONFIG, ENTITY_ID, USER_ID, TENANT_ID);

      expect(mockDb.query).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('INSERT INTO work_order_read_status'),
        [ENTITY_ID, USER_ID, TENANT_ID],
      );
    });

    it('should use ON CONFLICT for idempotent upsert', async () => {
      await service.markAsRead(CONFIG, ENTITY_ID, USER_ID, TENANT_ID);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE SET read_at = NOW()');
    });

    it('should include config columns in SQL', async () => {
      await service.markAsRead(CONFIG, ENTITY_ID, USER_ID, TENANT_ID);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain(CONFIG.entityColumn);
      expect(sql).toContain(CONFIG.tableName);
    });

    it('should swallow DB errors (fire-and-forget)', async () => {
      mockDb.query.mockRejectedValue(new Error('connection refused'));

      await expect(
        service.markAsRead(CONFIG, ENTITY_ID, USER_ID, TENANT_ID),
      ).resolves.toBeUndefined();
    });

    it('should swallow non-Error thrown values', async () => {
      mockDb.query.mockRejectedValue('string error');

      await expect(
        service.markAsRead(CONFIG, ENTITY_ID, USER_ID, TENANT_ID),
      ).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------
  // markAsReadByUuid
  // -----------------------------------------------------------

  describe('markAsReadByUuid()', () => {
    it('should resolve UUID to ID and call markAsRead', async () => {
      mockDb.queryOne.mockResolvedValue({ id: ENTITY_ID });

      await service.markAsReadByUuid(CONFIG, ENTITY_UUID, USER_ID, TENANT_ID);

      expect(mockDb.queryOne).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining(`SELECT id FROM ${CONFIG.entityTable}`),
        [ENTITY_UUID, TENANT_ID],
      );
      expect(mockDb.query).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('INSERT INTO'),
        [ENTITY_ID, USER_ID, TENANT_ID],
      );
    });

    it('should use correct UUID column in lookup query', async () => {
      mockDb.queryOne.mockResolvedValue({ id: ENTITY_ID });

      await service.markAsReadByUuid(CONFIG, ENTITY_UUID, USER_ID, TENANT_ID);

      const sql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain(CONFIG.entityUuidColumn);
    });

    it('should throw NotFoundException when UUID not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      await expect(
        service.markAsReadByUuid(CONFIG, ENTITY_UUID, USER_ID, TENANT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include entity info in NotFoundException message', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      await expect(
        service.markAsReadByUuid(CONFIG, ENTITY_UUID, USER_ID, TENANT_ID),
      ).rejects.toThrow(CONFIG.entityTable);
    });

    it('should not call markAsRead when UUID not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      await expect(
        service.markAsReadByUuid(CONFIG, ENTITY_UUID, USER_ID, TENANT_ID),
      ).rejects.toThrow();

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });
});

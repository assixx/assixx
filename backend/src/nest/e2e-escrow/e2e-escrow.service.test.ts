/**
 * Unit tests for E2eEscrowService
 *
 * Mocked dependencies: DatabaseService (tenantTransaction).
 * Tests storeEscrow, getEscrow, updateEscrow.
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 *
 * @see ADR-022 (E2E Key Escrow)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { E2eEscrowService } from './e2e-escrow.service.js';
import type { Argon2Params } from './e2e-escrow.types.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

const SAMPLE_PARAMS: Argon2Params = {
  memory: 65536,
  iterations: 3,
  parallelism: 1,
};

const SAMPLE_ROW = {
  id: '01936e00-0000-7000-8000-000000000001',
  tenant_id: 1,
  user_id: 42,
  encrypted_blob: 'AAAA',
  argon2_salt: 'BBBB',
  xchacha_nonce: 'CCCC',
  argon2_params: SAMPLE_PARAMS,
  blob_version: 1,
  created_at: new Date('2026-02-11T10:00:00Z'),
  updated_at: new Date('2026-02-11T10:00:00Z'),
  is_active: IS_ACTIVE.ACTIVE,
};

// =============================================================
// Test Suite
// =============================================================

describe('E2eEscrowService', () => {
  let service: E2eEscrowService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };

    // tenantTransaction executes callback with mockClient
    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new E2eEscrowService(mockDb as unknown as DatabaseService);
  });

  // -----------------------------------------------------------
  // storeEscrow
  // -----------------------------------------------------------

  describe('storeEscrow()', () => {
    it('should store a new escrow blob and return response', async () => {
      // No existing escrow
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // INSERT RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [SAMPLE_ROW],
      });

      const result = await service.storeEscrow(1, 42, 'AAAA', 'BBBB', 'CCCC', SAMPLE_PARAMS);

      expect(result.encryptedBlob).toBe('AAAA');
      expect(result.argon2Salt).toBe('BBBB');
      expect(result.xchachaNonce).toBe('CCCC');
      expect(result.argon2Params).toEqual(SAMPLE_PARAMS);
      expect(result.blobVersion).toBe(1);
      expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
    });

    it('should throw ConflictException when active escrow already exists', async () => {
      // Existing active escrow
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-id' }],
      });

      await expect(
        service.storeEscrow(1, 42, 'AAAA', 'BBBB', 'CCCC', SAMPLE_PARAMS),
      ).rejects.toThrow(ConflictException);

      // Should NOT attempt INSERT
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('should throw Error when INSERT RETURNING yields no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // No existing
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // INSERT returned nothing

      await expect(
        service.storeEscrow(1, 42, 'AAAA', 'BBBB', 'CCCC', SAMPLE_PARAMS),
      ).rejects.toThrow('RETURNING yielded no rows');
    });

    it('should pass argon2Params as JSON string to query', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });

      await service.storeEscrow(1, 42, 'AAAA', 'BBBB', 'CCCC', SAMPLE_PARAMS);

      // Second call is the INSERT
      const [, params] = mockClient.query.mock.calls[1] as [string, unknown[]];
      // argon2Params is the 7th parameter (index 6)
      expect(params[6]).toBe(JSON.stringify(SAMPLE_PARAMS));
    });
  });

  // -----------------------------------------------------------
  // getEscrow
  // -----------------------------------------------------------

  describe('getEscrow()', () => {
    it('should return escrow data when active escrow exists', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [SAMPLE_ROW],
      });

      const result = await service.getEscrow(1, 42);

      expect(result).not.toBeNull();
      expect(result?.encryptedBlob).toBe('AAAA');
      expect(result?.argon2Salt).toBe('BBBB');
      expect(result?.xchachaNonce).toBe('CCCC');
      expect(result?.blobVersion).toBe(1);
    });

    it('should return null when no active escrow exists', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getEscrow(1, 42);

      expect(result).toBeNull();
    });

    it('should query with correct tenant_id and user_id', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.getEscrow(7, 99);

      const [sql, params] = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
      expect(params).toEqual([7, 99]);
    });
  });

  // -----------------------------------------------------------
  // updateEscrow
  // -----------------------------------------------------------

  describe('updateEscrow()', () => {
    it('should update and return the escrow with incremented blob_version', async () => {
      const updatedRow = { ...SAMPLE_ROW, blob_version: 2 };
      mockClient.query.mockResolvedValueOnce({
        rows: [updatedRow],
      });

      const result = await service.updateEscrow(
        1,
        42,
        'AAAA-v2',
        'BBBB-v2',
        'CCCC-v2',
        SAMPLE_PARAMS,
      );

      expect(result).not.toBeNull();
      expect(result?.blobVersion).toBe(2);
    });

    it('should return null when no active escrow exists to update', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.updateEscrow(1, 42, 'AAAA', 'BBBB', 'CCCC', SAMPLE_PARAMS);

      expect(result).toBeNull();
    });

    it('should pass new blob data and argon2Params as JSON', async () => {
      const updatedRow = { ...SAMPLE_ROW, blob_version: 2 };
      mockClient.query.mockResolvedValueOnce({ rows: [updatedRow] });

      await service.updateEscrow(1, 42, 'new-blob', 'new-salt', 'new-nonce', SAMPLE_PARAMS);

      const [sql, params] = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('blob_version = blob_version + 1');
      expect(params[0]).toBe(1); // tenantId
      expect(params[1]).toBe(42); // userId
      expect(params[2]).toBe('new-blob');
      expect(params[3]).toBe('new-salt');
      expect(params[4]).toBe('new-nonce');
      expect(params[5]).toBe(JSON.stringify(SAMPLE_PARAMS));
    });
  });
});

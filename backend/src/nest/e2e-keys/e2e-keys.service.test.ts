/**
 * Unit tests for E2eKeysService
 *
 * Mocked dependencies: DatabaseService (tenantTransaction).
 * Tests registerKeys, getOwnKeys, getPublicKey, hasKeys, validateKeyVersion, resetKeys.
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { E2eKeysService } from './e2e-keys.service.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

// =============================================================
// Test Suite
// =============================================================

describe('E2eKeysService', () => {
  let service: E2eKeysService;
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

    service = new E2eKeysService(mockDb as unknown as DatabaseService);
  });

  // -----------------------------------------------------------
  // registerKeys
  // -----------------------------------------------------------

  describe('registerKeys()', () => {
    it('should register a new key and return key data', async () => {
      // No existing key
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // INSERT RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: '01234567-0123-7890-abcd-012345678901',
            public_key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            fingerprint: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            key_version: 1,
            created_at: new Date('2026-02-10T12:00:00Z'),
          },
        ],
      });

      const result = await service.registerKeys(
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        1,
        42,
      );

      expect(result.publicKey).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
      expect(result.keyVersion).toBe(1);
      expect(result.fingerprint).toBeDefined();
      expect(result.createdAt).toBe('2026-02-10T12:00:00.000Z');
      expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
    });

    it('should throw ConflictException when active key already exists', async () => {
      // Existing active key
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-id' }],
      });

      await expect(service.registerKeys('someKey', 1, 42)).rejects.toThrow(ConflictException);

      // Should NOT attempt INSERT
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('should throw Error when INSERT RETURNING yields no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // No existing
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // INSERT returned nothing

      await expect(service.registerKeys('someKey', 1, 42)).rejects.toThrow(
        'RETURNING yielded no rows',
      );
    });
  });

  // -----------------------------------------------------------
  // getOwnKeys
  // -----------------------------------------------------------

  describe('getOwnKeys()', () => {
    it('should return key data when active key exists', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'key-id',
            public_key: 'pubkey-base64',
            fingerprint: 'abc123',
            key_version: 1,
            created_at: new Date('2026-02-10T10:00:00Z'),
          },
        ],
      });

      const result = await service.getOwnKeys(1, 42);

      expect(result).not.toBeNull();
      expect(result?.publicKey).toBe('pubkey-base64');
      expect(result?.keyVersion).toBe(1);
    });

    it('should return null when no active key exists', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getOwnKeys(1, 42);

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------
  // getPublicKey
  // -----------------------------------------------------------

  describe('getPublicKey()', () => {
    it('should return public key for another user', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            public_key: 'bob-pubkey',
            fingerprint: 'bob-fp',
            key_version: 1,
          },
        ],
      });

      const result = await service.getPublicKey(1, 99);

      expect(result).not.toBeNull();
      expect(result?.publicKey).toBe('bob-pubkey');
      expect(result?.fingerprint).toBe('bob-fp');
    });

    it('should return null when user has no key', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getPublicKey(1, 99);

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------
  // hasKeys
  // -----------------------------------------------------------

  describe('hasKeys()', () => {
    it('should return true when user has active key', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ exists: true }],
      });

      const result = await service.hasKeys(1, 42);

      expect(result).toBe(true);
    });

    it('should return false when user has no key', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ exists: false }],
      });

      const result = await service.hasKeys(1, 42);

      expect(result).toBe(false);
    });

    it('should return false when query returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.hasKeys(1, 42);

      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // validateKeyVersion
  // -----------------------------------------------------------

  describe('validateKeyVersion()', () => {
    it('should return true when version matches', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ key_version: 1 }],
      });

      const result = await service.validateKeyVersion(1, 42, 1);

      expect(result).toBe(true);
    });

    it('should return false when version does not match', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ key_version: 1 }],
      });

      const result = await service.validateKeyVersion(1, 42, 2);

      expect(result).toBe(false);
    });

    it('should return false when user has no key', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.validateKeyVersion(1, 42, 1);

      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // resetKeys
  // -----------------------------------------------------------

  describe('resetKeys()', () => {
    it(`should mark active key as deleted (is_active = ${IS_ACTIVE.DELETED})`, async () => {
      // 1st: UPDATE e2e_user_keys → 1 row
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
      // 2nd: UPDATE e2e_key_escrow (cascade) → 1 row (escrow existed)
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      await service.resetKeys(1, 42, 1);

      const [sql, params] = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain(`is_active = ${IS_ACTIVE.DELETED}`);
      expect(sql).toContain('e2e_user_keys');
      expect(params).toEqual([1, 42]);
    });

    // ADR-022 cascade guarantee: admin reset MUST revoke the escrow blob in
    // the same transaction. Orphan escrow causes the multi-device divergence
    // bug (2026-04-23 incident: "delete key in DB but error comes back").
    it('should cascade-revoke escrow blob in same transaction', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // keys UPDATE
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // escrow UPDATE

      await service.resetKeys(1, 42, 1);

      expect(mockClient.query).toHaveBeenCalledTimes(2);
      const [escrowSql, escrowParams] = mockClient.query.mock.calls[1] as [string, unknown[]];
      expect(escrowSql).toContain('e2e_key_escrow');
      expect(escrowSql).toContain(`is_active = ${IS_ACTIVE.DELETED}`);
      expect(escrowSql).toContain('updated_at = NOW()');
      expect(escrowParams).toEqual([1, 42]);
    });

    it('should succeed even when user has no escrow blob (cascade is best-effort)', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // keys UPDATE — found
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 }); // escrow UPDATE — no blob

      await expect(service.resetKeys(1, 42, 1)).resolves.toBeUndefined();
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when no active key found and SKIP escrow cascade', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(service.resetKeys(1, 99, 1)).rejects.toThrow(NotFoundException);
      // Escrow cascade MUST NOT fire if the key revocation had nothing to revoke —
      // a missing active key means either already-reset or wrong user; cascading
      // the escrow anyway would orphan-delete recoverable state.
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });
  });
});

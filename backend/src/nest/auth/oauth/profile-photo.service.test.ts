/**
 * ProfilePhotoService — unit tests.
 *
 * Scope (FEAT_OAUTH_PROFILE_PHOTO, Phase 3):
 *   - ETag cache fast-path: skip binary when metadata ETag matches stored value
 *   - "No photo" signals from Graph (null metadata) clear DB + file
 *   - Manual-upload protection: photos whose path lacks the `oauth_` prefix are
 *     user-uploaded and MUST NOT be overwritten (R5)
 *   - File/DB ordering: rename → DB update → stale-file cleanup (Spec Deviation D4)
 *   - DB failure after file activation unlinks the orphan (R6)
 *   - Top-level try/catch: NO internal failure ever propagates to the caller (R1)
 *
 * Mocks:
 *   - MicrosoftProvider: `fetchPhotoMetadata` + `fetchPhotoBinary`
 *   - OAuthAccountRepository: `getPhotoEtag` + `updatePhotoEtag`
 *   - DatabaseService: `queryAsTenant` (for users.* reads) + `transaction`
 *     (the callback receives a mock PoolClient whose `query` is a vi.fn)
 *   - `node:fs/promises`: module-level `vi.mock` with inline fn stubs
 */
import { promises as fs } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../../database/database.service.js';
import type { OAuthAccountRepository } from './oauth-account.repository.js';
import type { PhotoMetadata } from './oauth.types.js';
import { ProfilePhotoService } from './profile-photo.service.js';
import type { MicrosoftProvider } from './providers/microsoft.provider.js';

// ─── node:fs mock ──────────────────────────────────────────────────────────
// Everything fs-related is stubbed at the module boundary — the service under
// test calls `fs.writeFile`, `fs.rename`, etc. through the promise namespace.
vi.mock('node:fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

// ─── Fixtures ──────────────────────────────────────────────────────────────

const TENANT_ID = 42;
const USER_ID = 7;
const USER_UUID = '019d9707-1896-74fd-821e-2a2d1bd41660';
const ACCESS_TOKEN = 'ms-access-token';

function createMetadata(overrides?: Partial<PhotoMetadata>): PhotoMetadata {
  return {
    etag: 'BA09D118',
    width: 240,
    height: 240,
    contentType: 'image/jpeg',
    ...overrides,
  };
}

function createMockProvider(): {
  fetchPhotoMetadata: ReturnType<typeof vi.fn>;
  fetchPhotoBinary: ReturnType<typeof vi.fn>;
} {
  return {
    fetchPhotoMetadata: vi.fn(),
    fetchPhotoBinary: vi.fn(),
  };
}

function createMockRepo(): {
  getPhotoEtag: ReturnType<typeof vi.fn>;
  updatePhotoEtag: ReturnType<typeof vi.fn>;
} {
  return {
    getPhotoEtag: vi.fn(),
    updatePhotoEtag: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * `transaction()` mock that actually invokes the callback with a dummy client.
 * Returns a handle to both the outer mock and the client so tests can assert
 * on both: did we reach the transaction, and what ran inside.
 */
function createMockDb(): {
  db: {
    queryAsTenant: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
  innerClient: { query: ReturnType<typeof vi.fn> };
} {
  const innerClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
  const transaction = vi.fn().mockImplementation(async (cb: (client: unknown) => unknown) => {
    return await cb(innerClient);
  });
  return {
    db: {
      queryAsTenant: vi.fn(),
      transaction,
    },
    innerClient,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ProfilePhotoService', () => {
  let service: ProfilePhotoService;
  let mockProvider: ReturnType<typeof createMockProvider>;
  let mockRepo: ReturnType<typeof createMockRepo>;
  let mockDbHandle: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = createMockProvider();
    mockRepo = createMockRepo();
    mockDbHandle = createMockDb();
    service = new ProfilePhotoService(
      mockProvider as unknown as MicrosoftProvider,
      mockRepo as unknown as OAuthAccountRepository,
      mockDbHandle.db as unknown as DatabaseService,
    );

    // Default: user has NO profile picture yet (first sync path).
    mockDbHandle.db.queryAsTenant.mockImplementation(async (sql: string): Promise<unknown[]> => {
      if (sql.includes('profile_picture')) return [{ profile_picture: null }];
      if (sql.includes('uuid')) return [{ uuid: USER_UUID }];
      return [];
    });
  });

  // ─── ETag cache / happy path ────────────────────────────────────────────

  describe('ETag cache', () => {
    it('skips binary download + DB write when stored ETag matches metadata ETag', async () => {
      mockProvider.fetchPhotoMetadata.mockResolvedValueOnce(createMetadata({ etag: 'SAME' }));
      mockRepo.getPhotoEtag.mockResolvedValueOnce('SAME');

      await service.syncIfChanged(USER_ID, TENANT_ID, ACCESS_TOKEN);

      expect(mockProvider.fetchPhotoBinary).not.toHaveBeenCalled();
      expect(mockDbHandle.db.transaction).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('downloads binary + commits when stored ETag differs (photo changed server-side)', async () => {
      mockProvider.fetchPhotoMetadata.mockResolvedValueOnce(createMetadata({ etag: 'NEW' }));
      mockRepo.getPhotoEtag.mockResolvedValueOnce('OLD');
      mockProvider.fetchPhotoBinary.mockResolvedValueOnce(Buffer.from('JPEG-BYTES'));

      await service.syncIfChanged(USER_ID, TENANT_ID, ACCESS_TOKEN);

      expect(mockProvider.fetchPhotoBinary).toHaveBeenCalledWith(ACCESS_TOKEN);
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.rename).toHaveBeenCalledTimes(1);
      expect(mockDbHandle.db.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepo.updatePhotoEtag).toHaveBeenCalledWith(
        expect.anything(),
        USER_ID,
        'microsoft',
        'NEW',
      );
    });
  });

  // ─── First-ever sync (stored etag null) ─────────────────────────────────

  describe('first-ever sync', () => {
    it('downloads + stores a photo when no cached ETag exists yet', async () => {
      mockProvider.fetchPhotoMetadata.mockResolvedValueOnce(createMetadata());
      mockRepo.getPhotoEtag.mockResolvedValueOnce(null);
      mockProvider.fetchPhotoBinary.mockResolvedValueOnce(Buffer.from('JPEG-BYTES'));

      await service.syncIfChanged(USER_ID, TENANT_ID, ACCESS_TOKEN);

      // File name embeds <uuid>_<etagShort>.jpg — content-addressed for cache busting.
      const writePath = vi.mocked(fs.writeFile).mock.calls[0]?.[0] as string;
      expect(writePath).toContain(`oauth_${USER_UUID}_BA09D118`);
      expect(writePath).toContain('.tmp-'); // tmp file, not final
      const renamePath = vi.mocked(fs.rename).mock.calls[0]?.[1] as string;
      expect(renamePath).toContain(`oauth_${USER_UUID}_BA09D118.jpg`);
      // Per Spec Deviation D4: rename BEFORE DB update — ordering matters.
      expect(vi.mocked(fs.rename).mock.invocationCallOrder[0]).toBeLessThan(
        mockDbHandle.db.transaction.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
      );
    });
  });

  // ─── No-photo signal (Graph → null metadata) ────────────────────────────

  describe('metadata null ("no photo" from Graph)', () => {
    it('clears DB + deletes cached file when Graph returns null AND a cached oauth file exists', async () => {
      mockDbHandle.db.queryAsTenant.mockImplementation(async (sql: string): Promise<unknown[]> => {
        if (sql.includes('profile_picture')) {
          return [{ profile_picture: 'uploads/profile_pictures/oauth_abc_OLDETAG.jpg' }];
        }
        return [];
      });
      mockProvider.fetchPhotoMetadata.mockResolvedValueOnce(null);

      await service.syncIfChanged(USER_ID, TENANT_ID, ACCESS_TOKEN);

      // Transaction opened, photo_etag set to null, profile_picture set to NULL.
      expect(mockDbHandle.db.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepo.updatePhotoEtag).toHaveBeenCalledWith(
        expect.anything(),
        USER_ID,
        'microsoft',
        null,
      );
      // Stale file unlinked.
      expect(fs.unlink).toHaveBeenCalledTimes(1);
      // Binary endpoint MUST NOT be called once metadata signals "no photo".
      expect(mockProvider.fetchPhotoBinary).not.toHaveBeenCalled();
    });

    it('is a no-op when Graph returns null AND no cached photo exists (nothing to clean)', async () => {
      mockProvider.fetchPhotoMetadata.mockResolvedValueOnce(null);

      await service.syncIfChanged(USER_ID, TENANT_ID, ACCESS_TOKEN);

      expect(mockDbHandle.db.transaction).not.toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });

  // ─── Manual-upload protection (R5) ──────────────────────────────────────

  describe('manual upload protection', () => {
    it('skips sync when users.profile_picture was set by the user (non-oauth_ prefix)', async () => {
      mockDbHandle.db.queryAsTenant.mockImplementation(async (sql: string): Promise<unknown[]> => {
        if (sql.includes('profile_picture')) {
          return [{ profile_picture: 'uploads/profile_pictures/user_upload_abc.jpg' }];
        }
        return [];
      });

      await service.syncIfChanged(USER_ID, TENANT_ID, ACCESS_TOKEN);

      // No Graph calls, no DB writes, no filesystem touches.
      expect(mockProvider.fetchPhotoMetadata).not.toHaveBeenCalled();
      expect(mockProvider.fetchPhotoBinary).not.toHaveBeenCalled();
      expect(mockDbHandle.db.transaction).not.toHaveBeenCalled();
    });

    it('treats a path with leading-slash + oauth_ prefix as ours (legacy absolute form)', async () => {
      mockDbHandle.db.queryAsTenant.mockImplementation(async (sql: string): Promise<unknown[]> => {
        if (sql.includes('profile_picture')) {
          return [{ profile_picture: '/uploads/profile_pictures/oauth_abc_OLD.jpg' }];
        }
        return [];
      });
      mockProvider.fetchPhotoMetadata.mockResolvedValueOnce(null);

      await service.syncIfChanged(USER_ID, TENANT_ID, ACCESS_TOKEN);

      // Leading slash should still match the oauth_ prefix — clear path proceeds.
      expect(mockProvider.fetchPhotoMetadata).toHaveBeenCalledTimes(1);
      expect(mockDbHandle.db.transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Binary fetch returns null — keep old photo ─────────────────────────

  describe('binary fetch null', () => {
    it('keeps the old cached photo when metadata said "exists" but binary download failed', async () => {
      mockProvider.fetchPhotoMetadata.mockResolvedValueOnce(createMetadata({ etag: 'NEW' }));
      mockRepo.getPhotoEtag.mockResolvedValueOnce('OLD');
      mockProvider.fetchPhotoBinary.mockResolvedValueOnce(null);

      await service.syncIfChanged(USER_ID, TENANT_ID, ACCESS_TOKEN);

      // No file write, no DB update — the cached photo_etag = OLD stays stale,
      // the next login will retry the sync.
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(mockDbHandle.db.transaction).not.toHaveBeenCalled();
    });
  });

  // ─── Orphan cleanup on DB failure (R6) ──────────────────────────────────

  describe('DB failure after rename', () => {
    it('unlinks the newly-renamed file when the transaction throws', async () => {
      mockProvider.fetchPhotoMetadata.mockResolvedValueOnce(createMetadata({ etag: 'NEW' }));
      mockRepo.getPhotoEtag.mockResolvedValueOnce(null);
      mockProvider.fetchPhotoBinary.mockResolvedValueOnce(Buffer.from('JPEG-BYTES'));

      mockDbHandle.db.transaction.mockRejectedValueOnce(new Error('pg connection lost'));

      await service.syncIfChanged(USER_ID, TENANT_ID, ACCESS_TOKEN);

      // The service swallows the error (top-level try/catch) but unlinks the
      // orphan BEFORE rethrow — so we expect exactly one unlink call on newPath.
      expect(fs.unlink).toHaveBeenCalledTimes(1);
      const unlinkPath = vi.mocked(fs.unlink).mock.calls[0]?.[0] as string;
      expect(unlinkPath).toContain(`oauth_${USER_UUID}_`);
    });
  });

  // ─── Defensive: no user uuid ────────────────────────────────────────────

  describe('defensive', () => {
    it("logs + returns when users.uuid row is missing (shouldn't happen, but handled)", async () => {
      mockProvider.fetchPhotoMetadata.mockResolvedValueOnce(createMetadata());
      mockRepo.getPhotoEtag.mockResolvedValueOnce(null);
      mockProvider.fetchPhotoBinary.mockResolvedValueOnce(Buffer.from('BYTES'));

      mockDbHandle.db.queryAsTenant.mockImplementation(async (sql: string): Promise<unknown[]> => {
        if (sql.includes('profile_picture')) return [{ profile_picture: null }];
        if (sql.includes('uuid')) return []; // no row!
        return [];
      });

      await service.syncIfChanged(USER_ID, TENANT_ID, ACCESS_TOKEN);

      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(mockDbHandle.db.transaction).not.toHaveBeenCalled();
    });
  });

  // ─── Top-level error swallowing (R1 invariant) ──────────────────────────

  describe('never-throw contract (R1)', () => {
    it('returns without throwing when provider.fetchPhotoMetadata itself throws', async () => {
      mockProvider.fetchPhotoMetadata.mockRejectedValueOnce(new Error('boom'));

      await expect(
        service.syncIfChanged(USER_ID, TENANT_ID, ACCESS_TOKEN),
      ).resolves.toBeUndefined();

      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(mockDbHandle.db.transaction).not.toHaveBeenCalled();
    });

    it('returns without throwing when queryAsTenant (readProfilePicture) throws', async () => {
      mockDbHandle.db.queryAsTenant.mockRejectedValueOnce(new Error('pg down'));

      await expect(
        service.syncIfChanged(USER_ID, TENANT_ID, ACCESS_TOKEN),
      ).resolves.toBeUndefined();
    });
  });
});

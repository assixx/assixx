/**
 * Unit tests for `ShiftHandoverAttachmentsService` — Plan §2.4, Phase 3 mandate.
 *
 * Plan DoD scenarios (all covered below with named tests):
 *   6th attachment → BadRequestException (5 cap)
 *   Wrong MIME type → BadRequestException
 *   Oversize file → BadRequestException (5 MB, parity with Inventory's
 *     `MAX_PHOTO_FILE_SIZE` — plan §2.4 locks 5 MB; plan DoD text says
 *     "10 MB" from an earlier draft and was reconciled in Session 5)
 *   Delete on submitted entry → BadRequestException
 *
 * Plus full coverage of the authorisation matrix for `deleteAttachment`
 * (creator, canManage override, forbidden) and the stream happy/404 paths.
 *
 * Mocking strategy:
 *  - `DatabaseService.tenantTransaction` — callback invoked against
 *    `mockClient.query` (canonical pattern).
 *  - `DatabaseService.tenantQuery` — direct `vi.fn()`.
 *  - `node:fs` — module-level `vi.mock` returning a `promises` object with
 *    `mkdir`/`writeFile` stubs. The service imports
 *    `{ promises as fs } from 'node:fs'`, so the mock factory must expose
 *    the `promises` subkey (not be hoisted as `node:fs/promises`).
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Phase 3 — Attachments service
 * @see ./shift-handover-attachments.service.ts
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MulterFile } from '../common/interfaces/multer.interface.js';
import type { DatabaseService } from '../database/database.service.js';
import { ShiftHandoverAttachmentsService } from './shift-handover-attachments.service.js';

// Module-level fs stub — mirrors `auth/oauth/profile-photo.service.test.ts`
// exactly. The service code imports `{ promises as fs } from 'node:fs'`, so
// the factory returns a `.promises` subkey rather than a flat module.
vi.mock('node:fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

// =============================================================
// Mock factories
// =============================================================

interface MockClient {
  query: ReturnType<typeof vi.fn>;
}

function createMockDb() {
  return {
    tenantQuery: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}

function bindTransactionTo(db: ReturnType<typeof createMockDb>, client: MockClient): void {
  db.tenantTransaction.mockImplementation(
    async (callback: (c: MockClient) => Promise<unknown>): Promise<unknown> => callback(client),
  );
}

/** Build a minimal valid MulterFile — JPEG, 1 KB, non-empty buffer. */
function validFile(overrides: Partial<MulterFile> = {}): MulterFile {
  return {
    fieldname: 'file',
    originalname: 'shot.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('test-bytes'),
    ...overrides,
  };
}

/** Mutable-entry row as returned by `loadMutableEntry`. */
function mutableEntryRow() {
  return { rowCount: 1, rows: [{ tenant_id: 1, team_id: 10, status: 'draft' }] };
}

/** Count-under-cap response for `assertUnderCap`. */
function countRow(n: number) {
  return { rowCount: 1, rows: [{ count: String(n) }] };
}

// =============================================================
// ShiftHandoverAttachmentsService
// =============================================================

describe('ShiftHandoverAttachmentsService', () => {
  let service: ShiftHandoverAttachmentsService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockClient: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    bindTransactionTo(mockDb, mockClient);
    service = new ShiftHandoverAttachmentsService(mockDb as unknown as DatabaseService);
  });

  // ---------------------------------------------------------------
  // uploadForEntry — happy + validation + cap + lock
  // ---------------------------------------------------------------

  describe('uploadForEntry', () => {
    it('persists the file to disk and INSERTs the attachment row on the happy path', async () => {
      const insertedRow = {
        id: 'att-1',
        tenant_id: 1,
        entry_id: 'entry-1',
        file_path: '/uploads/shift-handover/1/entry-1/foo.jpg',
        file_name: 'shot.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 1024,
        created_by: 5,
        is_active: 1,
      };
      mockClient.query
        .mockResolvedValueOnce(mutableEntryRow()) // loadMutableEntry
        .mockResolvedValueOnce(countRow(2)) // assertUnderCap — 2/5, room for one more
        .mockResolvedValueOnce({ rowCount: 1, rows: [insertedRow] }); // INSERT

      const result = await service.uploadForEntry('entry-1', validFile(), 5);

      expect(result).toEqual(insertedRow);
      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('shift-handover/1/entry-1'), {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
    });

    it('rejects an oversize file BEFORE opening any DB transaction', async () => {
      const oversize = validFile({ size: 6 * 1024 * 1024 }); // 6 MB > 5 MB cap

      await expect(service.uploadForEntry('entry-1', oversize, 5)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('rejects a non-whitelisted MIME type (e.g., application/pdf)', async () => {
      const bad = validFile({ mimetype: 'application/pdf' });

      await expect(service.uploadForEntry('entry-1', bad, 5)).rejects.toThrow(BadRequestException);
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
    });

    it('rejects an empty file (size 0) before touching the DB', async () => {
      const empty = validFile({ size: 0 });

      await expect(service.uploadForEntry('entry-1', empty, 5)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the entry does not exist', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      await expect(service.uploadForEntry('missing', validFile(), 5)).rejects.toThrow(
        NotFoundException,
      );
      // Stops before cap-check + disk-write + INSERT.
      expect(mockClient.query).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the entry is submitted (status locked)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ tenant_id: 1, team_id: 10, status: 'submitted' }],
      });

      await expect(service.uploadForEntry('entry-1', validFile(), 5)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockClient.query).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('rejects a 6th attachment when the entry already has 5 (cap)', async () => {
      mockClient.query.mockResolvedValueOnce(mutableEntryRow()).mockResolvedValueOnce(countRow(5)); // at cap

      await expect(service.uploadForEntry('entry-1', validFile(), 5)).rejects.toThrow(
        BadRequestException,
      );
      // Disk-write + INSERT must not happen after the cap violation.
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------
  // deleteAttachment — authorisation matrix + lock
  // ---------------------------------------------------------------

  describe('deleteAttachment', () => {
    /** Row returned by `loadAttachmentContext` — parametrised per test. */
    function ctxRow(overrides: Partial<{ created_by: number; entry_status: string }> = {}) {
      return {
        rowCount: 1,
        rows: [
          {
            created_by: 5,
            file_path: '/x/y.jpg',
            entry_status: 'draft',
            ...overrides,
          },
        ],
      };
    }

    it('allows the creator to soft-delete their own attachment', async () => {
      mockClient.query
        .mockResolvedValueOnce(ctxRow({ created_by: 5, entry_status: 'draft' }))
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE

      await expect(
        service.deleteAttachment('entry-1', 'att-1', { userId: 5, canManage: false }),
      ).resolves.toBeUndefined();

      // Second call is the soft-delete UPDATE.
      const updateCall = mockClient.query.mock.calls[1];
      expect(updateCall?.[0]).toContain('UPDATE shift_handover_attachments');
      expect((updateCall?.[1] as unknown[])[0]).toBe(0); // IS_ACTIVE.INACTIVE
    });

    it('allows a team-lead (canManage=true) to delete a non-owned attachment', async () => {
      mockClient.query
        .mockResolvedValueOnce(ctxRow({ created_by: 7, entry_status: 'draft' }))
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      await expect(
        service.deleteAttachment('entry-1', 'att-1', { userId: 99, canManage: true }),
      ).resolves.toBeUndefined();
    });

    it('forbids a non-creator without canManage (ForbiddenException)', async () => {
      mockClient.query.mockResolvedValueOnce(ctxRow({ created_by: 7, entry_status: 'draft' }));

      await expect(
        service.deleteAttachment('entry-1', 'att-1', { userId: 5, canManage: false }),
      ).rejects.toThrow(ForbiddenException);
      // UPDATE must not run — only the loadAttachmentContext query fired.
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('rejects a delete on a submitted entry (BadRequestException, lock)', async () => {
      mockClient.query.mockResolvedValueOnce(ctxRow({ created_by: 5, entry_status: 'submitted' }));

      await expect(
        service.deleteAttachment('entry-1', 'att-1', { userId: 5, canManage: false }),
      ).rejects.toThrow(BadRequestException);
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when the attachment does not exist on the entry', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      await expect(
        service.deleteAttachment('entry-1', 'missing', { userId: 5, canManage: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------
  // streamAttachment — RLS-scoped read
  // ---------------------------------------------------------------

  describe('streamAttachment', () => {
    it('returns the file path + MIME + filename for a matching row', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
        {
          file_path: '/uploads/shift-handover/1/e1/a.jpg',
          mime_type: 'image/jpeg',
          file_name: 'shot.jpg',
        },
      ]);

      const result = await service.streamAttachment('att-1');

      expect(result).toEqual({
        filePath: '/uploads/shift-handover/1/e1/a.jpg',
        mimeType: 'image/jpeg',
        fileName: 'shot.jpg',
      });
      const [sql, params] = mockDb.tenantQuery.mock.calls[0] ?? [];
      expect(sql).toContain('FROM shift_handover_attachments');
      expect(sql).toContain('is_active = $2');
      expect(params).toEqual(['att-1', 1]);
    });

    it('throws NotFoundException when no active row matches', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.streamAttachment('missing')).rejects.toThrow(NotFoundException);
    });
  });
});

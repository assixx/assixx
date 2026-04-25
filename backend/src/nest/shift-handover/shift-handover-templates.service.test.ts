/**
 * Unit tests for `ShiftHandoverTemplatesService` — Plan §2.2, Phase 3 mandate.
 *
 * Covers all 4 public methods + every Zod defense-in-depth rejection path
 * the plan's DoD enumerates explicitly:
 *   Upsert insert / Upsert update / Duplicate key / >30 fields /
 *   Invalid key regex / `select` without options / Team not in tenant /
 *   Soft-delete / NotFoundException on empty delete / `getMyPermissions`
 *   full-access short-circuit / `getMyPermissions` row-resolution defaults.
 *
 * Mocking strategy:
 *  - `DatabaseService.tenantQuery` — `vi.fn()` with staged responses.
 *  - `DatabaseService.tenantTransaction(cb)` — `mockImplementation` that
 *    invokes the callback with a `mockClient` whose `query()` is a spy;
 *    the test stages `mockClient.query.mockResolvedValueOnce(...)` once
 *    per SQL statement inside the transaction (team-check + upsert).
 *  - Shared Zod schema runs LIVE (not mocked) — the plan's "duplicate key"
 *    / ">30 fields" / "invalid regex" assertions depend on the real schema
 *    enforcing the rule; mocking would verify nothing.
 *
 * Tenant isolation: RLS is enforced at the PostgreSQL engine level
 * (ADR-019); unit tests cannot assert row-level leakage, only that the
 * service uses `tenantQuery`/`tenantTransaction` (RLS-scoped app_user)
 * and never `systemQuery`/`systemTransaction` (BYPASSRLS).
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Phase 3 — Template service
 * @see ./shift-handover-templates.service.ts
 */
import type { ShiftHandoverFieldDef } from '@assixx/shared/shift-handover';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { ShiftHandoverTemplatesService } from './shift-handover-templates.service.js';

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

/** Wires `tenantTransaction` to invoke its callback against the supplied
 *  client mock — one spy covers every `client.query()` inside the tx. */
function bindTransactionTo(db: ReturnType<typeof createMockDb>, client: MockClient): void {
  db.tenantTransaction.mockImplementation(
    async (callback: (c: MockClient) => Promise<unknown>): Promise<unknown> => callback(client),
  );
}

/** Minimal valid FieldDef — reused across many upsert tests. */
function validTextField(key = 'note'): ShiftHandoverFieldDef {
  return { key, label: 'Note', type: 'text', required: true };
}

// =============================================================
// ShiftHandoverTemplatesService
// =============================================================

describe('ShiftHandoverTemplatesService', () => {
  let service: ShiftHandoverTemplatesService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockClient: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    bindTransactionTo(mockDb, mockClient);
    service = new ShiftHandoverTemplatesService(mockDb as unknown as DatabaseService);
  });

  // ---------------------------------------------------------------
  // getTemplateForTeam
  // ---------------------------------------------------------------

  describe('getTemplateForTeam', () => {
    it('returns the first active row when one exists', async () => {
      const row = {
        id: 't-1',
        tenant_id: 1,
        team_id: 10,
        fields: [validTextField()],
        is_active: 1,
      };
      mockDb.tenantQuery.mockResolvedValueOnce([row]);

      const result = await service.getTemplateForTeam(10);

      expect(result).toEqual(row);
      const [sql, params] = mockDb.tenantQuery.mock.calls[0] ?? [];
      expect(sql).toContain('FROM shift_handover_templates');
      expect(sql).toContain('is_active = $2');
      expect(params).toEqual([10, 1]); // IS_ACTIVE.ACTIVE = 1
    });

    it('returns null when no active row exists', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.getTemplateForTeam(10);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // upsertTemplate — happy paths + SQL structure
  // ---------------------------------------------------------------

  describe('upsertTemplate', () => {
    it('INSERTs a new template and returns the resulting row', async () => {
      const insertedRow = {
        id: 't-42',
        tenant_id: 1,
        team_id: 10,
        fields: [validTextField()],
        is_active: 1,
        created_by: 5,
        updated_by: 5,
      };
      mockClient.query
        // Team exists in the tenant (RLS-filtered).
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 10 }] })
        // ON CONFLICT upsert returns the final row.
        .mockResolvedValueOnce({ rowCount: 1, rows: [insertedRow] });

      const result = await service.upsertTemplate(10, [validTextField()], 5);

      expect(result).toEqual(insertedRow);
      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });

    it('uses ON CONFLICT DO UPDATE with updated_by = EXCLUDED (idempotent upsert)', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 10 }] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              id: 't-1',
              tenant_id: 1,
              team_id: 10,
              fields: [validTextField()],
              is_active: 1,
              updated_by: 7,
            },
          ],
        });

      await service.upsertTemplate(10, [validTextField()], 7);

      // calls[0] = team check; calls[1] = upsert. Index into the upsert.
      const upsertCall = mockClient.query.mock.calls[1];
      const sql = upsertCall?.[0] as string;
      const params = upsertCall?.[1] as unknown[];
      expect(sql).toContain('INSERT INTO shift_handover_templates');
      expect(sql).toContain('ON CONFLICT (tenant_id, team_id) DO UPDATE');
      expect(sql).toContain('updated_by  = EXCLUDED.updated_by');
      expect(sql).toContain('RETURNING *');
      // tenant_id derives from RLS GUC — NOT from a positional param.
      expect(sql).toContain("NULLIF(current_setting('app.tenant_id'");
      // $4 is the userId for both created_by and updated_by.
      expect(params[3]).toBe(7);
    });

    it('throws BadRequestException when the team is not in the tenant', async () => {
      mockClient.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      await expect(service.upsertTemplate(999, [validTextField()], 5)).rejects.toThrow(
        BadRequestException,
      );
      // Upsert SQL must NOT run after the team check fails.
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('uses tenantTransaction, never systemTransaction (RLS discipline)', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 10 }] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 't-1', tenant_id: 1, team_id: 10, fields: [], is_active: 1 }],
        });

      await service.upsertTemplate(10, [validTextField()], 5);

      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
      // A cross-tenant helper would exist on the mock as `systemTransaction` /
      // `systemQuery`. We deliberately did not stub them — asserting their
      // absence would be tautological. Instead: any BYPASSRLS slip would
      // surface as "tenantTransaction called 0 times" on this assertion.
    });

    it('accepts an empty fields array (below the 30-cap, zero duplicates)', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 10 }] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 't-1', tenant_id: 1, team_id: 10, fields: [], is_active: 1 }],
        });

      await expect(service.upsertTemplate(10, [], 5)).resolves.toBeDefined();
    });
  });

  // ---------------------------------------------------------------
  // upsertTemplate — Zod defense-in-depth rejections (plan §R7)
  // ---------------------------------------------------------------

  describe('upsertTemplate — validation failures', () => {
    it('rejects duplicate field keys with BadRequestException', async () => {
      const dupFields: ShiftHandoverFieldDef[] = [
        { key: 'note', label: 'First', type: 'text', required: true },
        { key: 'note', label: 'Duplicate', type: 'text', required: false },
      ];

      await expect(service.upsertTemplate(10, dupFields, 5)).rejects.toThrow(BadRequestException);
      // Fails before the transaction is even opened — Zod runs synchronously first.
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
    });

    it('rejects >30 fields with BadRequestException', async () => {
      const tooMany: ShiftHandoverFieldDef[] = Array.from({ length: 31 }, (_, i) => ({
        key: `k${i}`,
        label: `Field ${i}`,
        type: 'text',
        required: false,
      }));

      await expect(service.upsertTemplate(10, tooMany, 5)).rejects.toThrow(BadRequestException);
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
    });

    it('rejects an invalid field-key (uppercase) with BadRequestException', async () => {
      const badKeyFields: ShiftHandoverFieldDef[] = [
        { key: 'UPPERCASE', label: 'Bad', type: 'text', required: false },
      ];

      await expect(service.upsertTemplate(10, badKeyFields, 5)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an invalid field-key (starts-with-digit) with BadRequestException', async () => {
      const badKeyFields: ShiftHandoverFieldDef[] = [
        { key: '1bad', label: 'Bad', type: 'text', required: false },
      ];

      await expect(service.upsertTemplate(10, badKeyFields, 5)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a `select` field with no options via BadRequestException', async () => {
      const badSelect: ShiftHandoverFieldDef[] = [
        { key: 'pri', label: 'Priority', type: 'select', required: true, options: [] },
      ];

      await expect(service.upsertTemplate(10, badSelect, 5)).rejects.toThrow(BadRequestException);
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // deleteTemplate — soft-delete + NotFoundException
  // ---------------------------------------------------------------

  describe('deleteTemplate', () => {
    it('soft-deletes by flipping is_active to INACTIVE', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 't-1' }]);

      await expect(service.deleteTemplate(10, 7)).resolves.toBeUndefined();
      const [sql, params] = mockDb.tenantQuery.mock.calls[0] ?? [];
      expect(sql).toContain('UPDATE shift_handover_templates');
      expect(sql).toContain('SET is_active  = $1');
      expect(sql).toContain('RETURNING id');
      // Params: [INACTIVE, userId, teamId, ACTIVE] per service signature.
      expect(params).toEqual([0, 7, 10, 1]);
    });

    it('throws NotFoundException when no active template exists', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.deleteTemplate(10, 7)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------
  // getMyPermissions — ADR-045 Layer-2 self-lookup
  // ---------------------------------------------------------------

  describe('getMyPermissions', () => {
    it('short-circuits to full permissions on both modules when hasFullAccess=true', async () => {
      const result = await service.getMyPermissions(5, true);

      expect(result).toEqual({
        templates: { canRead: true, canWrite: true, canDelete: true },
        entries: { canRead: true, canWrite: true, canDelete: true },
      });
      // No DB query on the short-circuit path — critical for perf.
      expect(mockDb.tenantQuery).not.toHaveBeenCalled();
    });

    it('resolves per-module permissions from user_addon_permissions rows', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
        {
          module_code: 'shift-handover-templates',
          can_read: true,
          can_write: true,
          can_delete: false,
        },
        {
          module_code: 'shift-handover-entries',
          can_read: true,
          can_write: false,
          can_delete: false,
        },
      ]);

      const result = await service.getMyPermissions(5, false);

      expect(result.templates).toEqual({ canRead: true, canWrite: true, canDelete: false });
      expect(result.entries).toEqual({ canRead: true, canWrite: false, canDelete: false });
    });

    it('defaults every permission to false when the module row is missing', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.getMyPermissions(5, false);

      expect(result).toEqual({
        templates: { canRead: false, canWrite: false, canDelete: false },
        entries: { canRead: false, canWrite: false, canDelete: false },
      });
    });

    it('scopes the lookup to the shift_planning addon code', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.getMyPermissions(5, false);

      const [sql, params] = mockDb.tenantQuery.mock.calls[0] ?? [];
      expect(sql).toContain('FROM user_addon_permissions');
      expect(sql).toContain('addon_code = $2');
      expect(params).toEqual([5, 'shift_planning']);
    });

    it('resolves mixed per-module permissions independently', async () => {
      // Only templates has a row; entries should default to all-false.
      mockDb.tenantQuery.mockResolvedValueOnce([
        {
          module_code: 'shift-handover-templates',
          can_read: true,
          can_write: false,
          can_delete: true,
        },
      ]);

      const result = await service.getMyPermissions(5, false);

      expect(result.templates).toEqual({ canRead: true, canWrite: false, canDelete: true });
      expect(result.entries).toEqual({ canRead: false, canWrite: false, canDelete: false });
    });
  });
});

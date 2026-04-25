/**
 * Unit tests for `ShiftHandoverEntriesService` — Plan §2.5 (the heart),
 * Phase 3 mandate.
 *
 * Plan DoD scenarios (named tests inline):
 *   R1 — handled in active-shift-resolver.service.test.ts (delegation)
 *   R2 — `submitEntry` snapshots the live template into `schema_snapshot`
 *        so later template edits do not alter historical renderings.
 *   R3 — `submitEntry` locks the row via `SELECT … FOR UPDATE` and
 *        rejects a second submit with `BadRequestException`.
 *   R5 — `getOrCreateDraft` delegates the write-window rule to the
 *        resolver, which is fed the injected `clock()` instant.
 *
 * All six remaining public methods (`updateDraft`, `reopenEntry`,
 * `listEntriesForTeam`, `getEntry`, `isTeamMember`, `runAutoLockSweep`)
 * are covered with happy + failure tests + (for the auto-lock sweep) the
 * architectural assertion that the cross-tenant path uses
 * `systemTransaction` (BYPASSRLS per ADR-019) and never
 * `tenantTransaction`.
 *
 * Clock injection: `SHIFT_HANDOVER_CLOCK` is fed a `vi.fn()` returning
 * a fixed instant. The resolver mock then simply returns `true`/`false`
 * — we test that the service DELEGATES, not that it re-implements TZ math
 * (that's the resolver's contract, already covered in its own test).
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Phase 3 — Entries service
 * @see ./shift-handover-entries.service.ts
 */
import type { ShiftHandoverFieldDef } from '@assixx/shared/shift-handover';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ActiveShiftResolverService } from './active-shift-resolver.service.js';
import { ShiftHandoverEntriesService } from './shift-handover-entries.service.js';
import type { ShiftHandoverTemplatesService } from './shift-handover-templates.service.js';

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
    systemTransaction: vi.fn(),
  };
}

function bindTenantTx(db: ReturnType<typeof createMockDb>, client: MockClient): void {
  db.tenantTransaction.mockImplementation(
    async (callback: (c: MockClient) => Promise<unknown>): Promise<unknown> => callback(client),
  );
}

function bindSystemTx(db: ReturnType<typeof createMockDb>, client: MockClient): void {
  db.systemTransaction.mockImplementation(
    async (callback: (c: MockClient) => Promise<unknown>): Promise<unknown> => callback(client),
  );
}

function createMockTemplates() {
  return {
    getTemplateForTeam: vi.fn(),
  } as unknown as ShiftHandoverTemplatesService & {
    getTemplateForTeam: ReturnType<typeof vi.fn>;
  };
}

function createMockResolver() {
  return {
    canWriteForShift: vi.fn(),
  } as unknown as ActiveShiftResolverService & {
    canWriteForShift: ReturnType<typeof vi.fn>;
  };
}

function createMockLogger() {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  } as unknown as ActivityLoggerService & { log: ReturnType<typeof vi.fn> };
}

/** Row-shape helper for `loadEntryForUpdate` / `findEntry` returns. */
function entryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'entry-1',
    tenant_id: 1,
    team_id: 10,
    shift_date: new Date('2026-04-22T00:00:00Z'),
    shift_key: 'early',
    protocol_text: '',
    custom_values: {},
    schema_snapshot: [],
    status: 'draft',
    submitted_at: null,
    submitted_by: null,
    reopened_at: null,
    reopened_by: null,
    reopen_reason: null,
    is_active: 1,
    created_at: new Date('2026-04-22T09:00:00Z'),
    updated_at: new Date('2026-04-22T09:00:00Z'),
    created_by: 5,
    updated_by: 5,
    ...overrides,
  };
}

function qResult<T>(rows: T[], rowCount = rows.length) {
  return { rows, rowCount };
}

// =============================================================
// ShiftHandoverEntriesService
// =============================================================

describe('ShiftHandoverEntriesService', () => {
  let service: ShiftHandoverEntriesService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockClient: MockClient;
  let mockClock: ReturnType<typeof vi.fn>;
  let mockTemplates: ReturnType<typeof createMockTemplates>;
  let mockResolver: ReturnType<typeof createMockResolver>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  const FIXED_NOW = new Date('2026-04-22T10:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    bindTenantTx(mockDb, mockClient);
    bindSystemTx(mockDb, mockClient);
    mockClock = vi.fn(() => FIXED_NOW);
    mockTemplates = createMockTemplates();
    mockResolver = createMockResolver();
    mockLogger = createMockLogger();

    service = new ShiftHandoverEntriesService(
      mockDb as unknown as DatabaseService,
      mockClock,
      mockTemplates,
      mockResolver,
      mockLogger,
    );
  });

  // ---------------------------------------------------------------
  // getOrCreateDraft — race-safe + write-window + shift_times check
  // ---------------------------------------------------------------

  describe('getOrCreateDraft', () => {
    it('returns the existing draft without checking the write window', async () => {
      const existing = entryRow();
      mockClient.query
        // assertShiftKeyConfigured — shift_times row exists.
        .mockResolvedValueOnce(qResult([{ id: 1 }]))
        // findEntry — existing draft returned.
        .mockResolvedValueOnce(qResult([existing]));

      const result = await service.getOrCreateDraft(
        1,
        10,
        new Date('2026-04-22T00:00:00Z'),
        'early',
        5,
      );

      expect(result).toEqual(existing);
      // Existing row → no write-window check, no INSERT.
      expect(mockResolver.canWriteForShift).not.toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });

    it('INSERTs a new draft after verifying the write window passes', async () => {
      const inserted = entryRow({ id: 'entry-new' });
      mockResolver.canWriteForShift.mockResolvedValueOnce({ allowed: true });
      mockClient.query
        .mockResolvedValueOnce(qResult([{ id: 1 }])) // shift_times check
        .mockResolvedValueOnce(qResult([])) // findEntry — none
        .mockResolvedValueOnce(qResult([inserted])); // INSERT RETURNING *

      const result = await service.getOrCreateDraft(
        1,
        10,
        new Date('2026-04-22T00:00:00Z'),
        'early',
        5,
      );

      expect(result).toEqual(inserted);
      expect(mockResolver.canWriteForShift).toHaveBeenCalledTimes(1);
      // Clock was read so the resolver gets a deterministic instant.
      expect(mockClock).toHaveBeenCalled();
      // INSERT SQL contains the race-safe ON CONFLICT DO NOTHING path.
      const insertSql = mockClient.query.mock.calls[2]?.[0] as string;
      expect(insertSql).toContain(
        'ON CONFLICT (tenant_id, team_id, shift_date, shift_key) DO NOTHING',
      );
      expect(insertSql).toContain("NULLIF(current_setting('app.tenant_id'");
    });

    it('throws BadRequestException when shift_times is not configured for the slot', async () => {
      mockClient.query.mockResolvedValueOnce(qResult([], 0));

      await expect(
        service.getOrCreateDraft(1, 10, new Date('2026-04-22T00:00:00Z'), 'early', 5),
      ).rejects.toThrow(BadRequestException);
      expect(mockResolver.canWriteForShift).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException with a German reason message when outside the write window', async () => {
      mockResolver.canWriteForShift.mockResolvedValueOnce({
        allowed: false,
        reason: 'outside_window',
      });
      mockClient.query
        .mockResolvedValueOnce(qResult([{ id: 1 }]))
        .mockResolvedValueOnce(qResult([])); // no existing

      await expect(
        service.getOrCreateDraft(1, 10, new Date('2026-04-22T00:00:00Z'), 'early', 5),
      ).rejects.toThrow(/Bearbeitung nicht mehr möglich/u);
      // INSERT must not run after forbidden check.
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });

    it('throws ForbiddenException with the not_assignee German message when user is not on the roster', async () => {
      mockResolver.canWriteForShift.mockResolvedValueOnce({
        allowed: false,
        reason: 'not_assignee',
      });
      mockClient.query
        .mockResolvedValueOnce(qResult([{ id: 1 }]))
        .mockResolvedValueOnce(qResult([]));

      await expect(
        service.getOrCreateDraft(1, 10, new Date('2026-04-22T00:00:00Z'), 'early', 5),
      ).rejects.toThrow(/nicht eingeteilt/u);
    });

    it('falls back to a fetch when ON CONFLICT DO NOTHING returns no row (race)', async () => {
      const raced = entryRow({ id: 'entry-raced' });
      mockResolver.canWriteForShift.mockResolvedValueOnce({ allowed: true });
      mockClient.query
        .mockResolvedValueOnce(qResult([{ id: 1 }]))
        .mockResolvedValueOnce(qResult([])) // findEntry — none initially
        .mockResolvedValueOnce(qResult([])) // INSERT returns empty (conflict)
        .mockResolvedValueOnce(qResult([raced])); // fallback fetch wins

      const result = await service.getOrCreateDraft(
        1,
        10,
        new Date('2026-04-22T00:00:00Z'),
        'early',
        5,
      );

      expect(result).toEqual(raced);
      expect(mockClient.query).toHaveBeenCalledTimes(4);
    });
  });

  // ---------------------------------------------------------------
  // updateDraft — mutable-status gate + Zod re-parse against template
  // ---------------------------------------------------------------

  describe('updateDraft', () => {
    it('updates protocol_text and custom_values on a draft entry', async () => {
      const existing = entryRow({ status: 'draft', custom_values: {} });
      const updated = entryRow({ protocol_text: 'new text', custom_values: {} });
      mockTemplates.getTemplateForTeam.mockResolvedValueOnce({ fields: [] });
      mockClient.query
        .mockResolvedValueOnce(qResult([existing])) // loadEntryForUpdate (FOR UPDATE)
        .mockResolvedValueOnce(qResult([updated])); // UPDATE RETURNING *

      const result = await service.updateDraft(
        'entry-1',
        { protocolText: 'new text', customValues: {} },
        5,
      );

      expect(result).toEqual(updated);
      // loadEntryForUpdate uses SELECT … FOR UPDATE.
      const loadSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(loadSql).toContain('FOR UPDATE');
    });

    it('allows editing a reopened entry (mutable status set)', async () => {
      const reopened = entryRow({ status: 'reopened' });
      mockClient.query
        .mockResolvedValueOnce(qResult([reopened]))
        .mockResolvedValueOnce(qResult([reopened]));

      await expect(
        service.updateDraft('entry-1', { protocolText: 'continued' }, 5),
      ).resolves.toBeDefined();
    });

    it('rejects an update on a submitted entry (locked)', async () => {
      mockClient.query.mockResolvedValueOnce(qResult([entryRow({ status: 'submitted' })]));

      await expect(service.updateDraft('entry-1', { protocolText: 'x' }, 5)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects custom_values that fail the shared template schema', async () => {
      const fields: ShiftHandoverFieldDef[] = [
        { key: 'count', label: 'Count', type: 'integer', required: true },
      ];
      mockTemplates.getTemplateForTeam.mockResolvedValueOnce({ fields });
      mockClient.query.mockResolvedValueOnce(qResult([entryRow({ status: 'draft' })]));

      await expect(
        service.updateDraft('entry-1', { customValues: { count: 3.14 } }, 5),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the target entry does not exist', async () => {
      mockClient.query.mockResolvedValueOnce(qResult([], 0));

      await expect(service.updateDraft('missing', { protocolText: 'x' }, 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------
  // submitEntry — §R2 schema_snapshot + §R3 FOR UPDATE + audit log
  // ---------------------------------------------------------------

  describe('submitEntry', () => {
    it('§R2: snapshots the current template fields into schema_snapshot on submit', async () => {
      const fields: ShiftHandoverFieldDef[] = [
        { key: 'note', label: 'Note', type: 'text', required: true },
      ];
      const entry = entryRow({ status: 'draft', custom_values: { note: 'ok' } });
      const submittedRow = entryRow({ status: 'submitted', schema_snapshot: fields });
      mockTemplates.getTemplateForTeam.mockResolvedValueOnce({ fields });
      mockClient.query
        .mockResolvedValueOnce(qResult([entry])) // loadEntryForUpdate
        .mockResolvedValueOnce(qResult([submittedRow])); // UPDATE RETURNING

      const result = await service.submitEntry('entry-1', 5);

      expect(result).toEqual(submittedRow);
      // The UPDATE params must include the snapshot as JSON-stringified fields.
      const updateCall = mockClient.query.mock.calls[1];
      const updateParams = updateCall?.[1] as unknown[];
      expect(updateParams[0]).toBe(JSON.stringify(fields));
      const updateSql = updateCall?.[0] as string;
      expect(updateSql).toContain("status          = 'submitted'::shift_handover_status");
      expect(updateSql).toContain('schema_snapshot = $1::jsonb');
    });

    it('§R3: loads the row with SELECT … FOR UPDATE (concurrent-safety lock)', async () => {
      const entry = entryRow({ status: 'draft' });
      mockTemplates.getTemplateForTeam.mockResolvedValueOnce({ fields: [] });
      mockClient.query
        .mockResolvedValueOnce(qResult([entry]))
        .mockResolvedValueOnce(qResult([entryRow({ status: 'submitted' })]));

      await service.submitEntry('entry-1', 5);

      const loadSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(loadSql).toContain('SELECT * FROM shift_handover_entries');
      expect(loadSql).toContain('FOR UPDATE');
    });

    it('rejects a second submit on an already-submitted entry', async () => {
      mockClient.query.mockResolvedValueOnce(qResult([entryRow({ status: 'submitted' })]));

      await expect(service.submitEntry('entry-1', 5)).rejects.toThrow(BadRequestException);
    });

    it('rejects a submit when custom_values fail validation against the current template', async () => {
      const fields: ShiftHandoverFieldDef[] = [
        { key: 'note', label: 'Note', type: 'text', required: true },
      ];
      // Entry has no `note` but template marks it required — Zod fails.
      const entry = entryRow({ status: 'draft', custom_values: {} });
      mockTemplates.getTemplateForTeam.mockResolvedValueOnce({ fields });
      mockClient.query.mockResolvedValueOnce(qResult([entry]));

      await expect(service.submitEntry('entry-1', 5)).rejects.toThrow(BadRequestException);
      // UPDATE must NOT run after validation failure.
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('writes an audit-log entry on successful submit', async () => {
      const entry = entryRow({ status: 'draft', custom_values: {} });
      const submittedRow = entryRow({ status: 'submitted' });
      mockTemplates.getTemplateForTeam.mockResolvedValueOnce({ fields: [] });
      mockClient.query
        .mockResolvedValueOnce(qResult([entry]))
        .mockResolvedValueOnce(qResult([submittedRow]));

      await service.submitEntry('entry-1', 5);

      expect(mockLogger.log).toHaveBeenCalledTimes(1);
      const logArg = mockLogger.log.mock.calls[0]?.[0] as {
        tenantId: number;
        userId: number;
        action: string;
        entityType: string;
        newValues: { status: string };
      };
      expect(logArg.tenantId).toBe(1);
      expect(logArg.userId).toBe(5);
      expect(logArg.entityType).toBe('shift');
      expect(logArg.newValues.status).toBe('submitted');
    });

    it('throws NotFoundException when the entry does not exist', async () => {
      mockClient.query.mockResolvedValueOnce(qResult([], 0));

      await expect(service.submitEntry('missing', 5)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------
  // reopenEntry — only-from-submitted + audit
  // ---------------------------------------------------------------

  describe('reopenEntry', () => {
    it('transitions a submitted entry to reopened and writes an audit entry', async () => {
      const entry = entryRow({ status: 'submitted' });
      const reopened = entryRow({ status: 'reopened', reopen_reason: 'Typo fix' });
      mockClient.query
        .mockResolvedValueOnce(qResult([entry]))
        .mockResolvedValueOnce(qResult([reopened]));

      const result = await service.reopenEntry('entry-1', 7, 'Typo fix');

      expect(result).toEqual(reopened);
      expect(mockLogger.log).toHaveBeenCalledTimes(1);
      const logArg = mockLogger.log.mock.calls[0]?.[0] as {
        newValues: { status: string; reason: string };
      };
      expect(logArg.newValues.status).toBe('reopened');
      expect(logArg.newValues.reason).toBe('Typo fix');
    });

    it('rejects a reopen on a draft entry (only submitted is reopenable)', async () => {
      mockClient.query.mockResolvedValueOnce(qResult([entryRow({ status: 'draft' })]));

      await expect(service.reopenEntry('entry-1', 7, 'no reason')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when the entry does not exist', async () => {
      mockClient.query.mockResolvedValueOnce(qResult([], 0));

      await expect(service.reopenEntry('missing', 7, 'r')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------
  // listEntriesForTeam — pagination + filters + window-total
  // ---------------------------------------------------------------

  describe('listEntriesForTeam', () => {
    it('returns items + total extracted from the COUNT(*) OVER() window', async () => {
      const rows = [
        { ...entryRow({ id: 'e1' }), total: '42' },
        { ...entryRow({ id: 'e2' }), total: '42' },
      ];
      mockDb.tenantQuery.mockResolvedValueOnce(rows);

      const result = await service.listEntriesForTeam(10, { page: 1, limit: 20 });

      expect(result.total).toBe(42);
      expect(result.items).toHaveLength(2);
      // `total` is stripped from the items (not a column in the public row).
      expect((result.items[0] as { total?: string }).total).toBeUndefined();
    });

    it('applies status + date-range filters in the WHERE clause', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.listEntriesForTeam(10, {
        status: 'submitted',
        from: '2026-04-01',
        to: '2026-04-30',
      });

      const [sql, params] = mockDb.tenantQuery.mock.calls[0] ?? [];
      expect(sql).toContain('status = $3::shift_handover_status');
      expect(sql).toContain('shift_date >= $4::date');
      expect(sql).toContain('shift_date <= $5::date');
      expect(params).toEqual([10, 1, 'submitted', '2026-04-01', '2026-04-30', 20, 0]);
    });

    it('defaults page=1, limit=20 and caps limit at 100', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      // Caller asks for limit=500 → capped to 100.
      const result = await service.listEntriesForTeam(10, { limit: 500 });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(100);
      const params = mockDb.tenantQuery.mock.calls[0]?.[1] as unknown[];
      // Last two params are LIMIT + OFFSET.
      expect(params[params.length - 2]).toBe(100);
      expect(params[params.length - 1]).toBe(0);
    });

    it('returns total=0 when no rows match', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.listEntriesForTeam(10, {});

      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // getEntry — RLS-scoped read
  // ---------------------------------------------------------------

  describe('getEntry', () => {
    it('returns the entry row when present', async () => {
      const row = entryRow();
      mockDb.tenantQuery.mockResolvedValueOnce([row]);

      const result = await service.getEntry('entry-1');

      expect(result).toEqual(row);
    });

    it('throws NotFoundException when no row matches', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.getEntry('missing')).rejects.toThrow(NotFoundException);
    });

    it('JOINs users for created_by_name and surfaces it on the result (Session 24)', async () => {
      const row = { ...entryRow(), created_by_name: 'Erika Mustermann' };
      mockDb.tenantQuery.mockResolvedValueOnce([row]);

      const result = await service.getEntry('entry-1');

      expect(result.created_by_name).toBe('Erika Mustermann');
      const sql = mockDb.tenantQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain('LEFT JOIN users u ON u.id = e.created_by');
      expect(sql).toContain('AS created_by_name');
    });

    it('passes through a null created_by_name when the JOIN finds no user row', async () => {
      const row = { ...entryRow(), created_by_name: null };
      mockDb.tenantQuery.mockResolvedValueOnce([row]);

      const result = await service.getEntry('entry-1');

      expect(result.created_by_name).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // isTeamMember — plain user_teams lookup for read-scope filter
  // ---------------------------------------------------------------

  describe('isTeamMember', () => {
    it('returns true when a user_teams row exists', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ user_id: 5 }]);

      await expect(service.isTeamMember(5, 10)).resolves.toBe(true);
    });

    it('returns false when the user is not on the team', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.isTeamMember(5, 10)).resolves.toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // runAutoLockSweep — cross-tenant + BYPASSRLS
  // ---------------------------------------------------------------

  describe('runAutoLockSweep', () => {
    it('returns lockedCount + lockedIds collected via systemTransaction', async () => {
      mockClient.query.mockResolvedValueOnce(qResult([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]));

      const result = await service.runAutoLockSweep(new Date('2026-04-23T10:00:00Z'));

      expect(result.lockedCount).toBe(3);
      expect(result.lockedIds).toEqual(['e1', 'e2', 'e3']);
      // Architectural invariant: cross-tenant sweep uses systemTransaction
      // (sys_user, BYPASSRLS per ADR-019), NEVER tenantTransaction.
      expect(mockDb.systemTransaction).toHaveBeenCalledTimes(1);
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
    });

    it('returns lockedCount=0 when no drafts are past the 24 h Berlin cutoff', async () => {
      mockClient.query.mockResolvedValueOnce(qResult([], 0));

      const result = await service.runAutoLockSweep(new Date('2026-04-22T10:00:00Z'));

      expect(result.lockedCount).toBe(0);
      expect(result.lockedIds).toEqual([]);
    });

    it('matches only drafts older than shift_end + 24 h (SQL structure)', async () => {
      mockClient.query.mockResolvedValueOnce(qResult([]));

      await service.runAutoLockSweep(new Date('2026-04-22T10:00:00Z'));

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain("e.status      = 'draft'::shift_handover_status");
      expect(sql).toContain("AT TIME ZONE 'Europe/Berlin'");
      expect(sql).toContain("interval '24 hours'");
      // Snapshots the CURRENT template per matched row (correlated subquery).
      expect(sql).toContain('SELECT fields');
      expect(sql).toContain('FROM shift_handover_templates t');
    });
  });
});

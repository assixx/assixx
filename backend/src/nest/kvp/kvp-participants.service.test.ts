/**
 * Unit tests for KvpParticipantsService
 *
 * Phase 3 of FEAT_KVP_PARTICIPANTS_MASTERPLAN — covers the 12 mandatory
 * scenarios from the masterplan §Phase 3 table plus a few quality-of-coverage
 * extras (no-CLS-tenant guard, types-filter, unknown-types fallback).
 *
 * Mock strategy mirrors `kvp.service.test.ts` (Step 2.3 changelog 1.0.3): a
 * single `qf = vi.fn()` is shared between the direct `tenantQuery` path and
 * the transaction-internal `client.query` path (the wrapper transforms `T[]`
 * → `{ rows: T[] }` to match `pg`'s `PoolClient` shape). This keeps the queue
 * model trivial — one `mockResolvedValueOnce` per executed query, in source-
 * code order.
 *
 * Scope boundary (re-confirmed with user 2026-04-26):
 *  - Real-DB tenant isolation, cascade FK behaviour, CHECK / UNIQUE DB-level
 *    constraint behaviour are deferred to Phase 4 (`kvp.api.test.ts`).
 *  - In this unit suite they degenerate to:
 *      • tenant isolation  → "service uses tenantQuery / tenantTransaction
 *        (RLS-scoped variants), not query/systemQuery" — i.e. assertion that
 *        the wiring is correct.
 *      • cascade           → "if DB returns N rows, service returns N rows"
 *        — i.e. service does no extra filtering that would re-introduce
 *        ghost-chips after a cascade.
 *      • CHECK / UNIQUE    → simulate the pg error path (rejection) and
 *        verify the service surfaces it without swallowing.
 *
 * @see docs/FEAT_KVP_PARTICIPANTS_MASTERPLAN.md §Phase 3
 * @see ./kvp-participants.service.ts — system under test
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { KvpParticipantsService } from './kvp-participants.service.js';

// =============================================================
// Mock factories
// =============================================================

/**
 * Single-queue mock DB. The `tenantTransaction` wrapper routes the callback's
 * `client.query` back to the same `qf` mock (wrapping `T[]` → `{ rows: T[] }`
 * to satisfy `pg`'s PoolClient contract). Same shape as `kvp.service.test.ts`
 * — keep them in lock-step so future maintainers only learn one pattern.
 */
function createMockDb() {
  const qf = vi.fn();
  const txClientQuery = vi.fn(async (...args: unknown[]) => ({
    rows: (await qf(...args)) as unknown[],
  }));
  const tenantTransaction = vi.fn(
    async <T>(callback: (client: { query: typeof txClientQuery }) => Promise<T>): Promise<T> =>
      await callback({ query: txClientQuery }),
  );
  const getTenantId = vi.fn((): number | undefined => 42);
  return { query: qf, tenantQuery: qf, tenantTransaction, getTenantId };
}

function createMockActivityLogger() {
  return {
    log: vi.fn().mockResolvedValue(undefined),
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
  };
}

// =============================================================
// KvpParticipantsService
// =============================================================

describe('KvpParticipantsService', () => {
  let service: KvpParticipantsService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockLogger: ReturnType<typeof createMockActivityLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockLogger = createMockActivityLogger();
    service = new KvpParticipantsService(
      mockDb as unknown as DatabaseService,
      mockLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // replaceParticipants
  // =============================================================

  describe('replaceParticipants', () => {
    // Scenario #1 — replace empty list → empty list
    it('handles empty → empty as a no-op (no INSERT, no audit churn)', async () => {
      // Queue: snapshot returns [] (no prior rows), DELETE returns []
      mockDb.query.mockResolvedValueOnce([]); // snapshot
      mockDb.query.mockResolvedValueOnce([]); // DELETE

      await service.replaceParticipants(101, [], 7);

      // tenantTransaction opened exactly once (own tx, no parent client passed)
      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
      // exactly two queries hit the wire: snapshot + DELETE
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      // no INSERT was issued — verify by inspecting all SQL strings
      const allSql = mockDb.query.mock.calls.map((c): string => c[0] as string).join('\n');
      expect(allSql).not.toContain('INSERT INTO kvp_participants');
      // no audit logging when before == after == empty
      expect(mockLogger.logCreate).not.toHaveBeenCalled();
      expect(mockLogger.logDelete).not.toHaveBeenCalled();
    });

    // Scenario #2 — replace empty → [user, team, dept, area]
    it('inserts one row per type and emits 4 logCreate entries (no logDelete)', async () => {
      // Queue (PARTICIPANT_TYPES iteration order: user, team, department, area):
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]); // validate users
      mockDb.query.mockResolvedValueOnce([{ id: 10 }]); // validate teams
      mockDb.query.mockResolvedValueOnce([{ id: 20 }]); // validate departments
      mockDb.query.mockResolvedValueOnce([{ id: 30 }]); // validate areas
      mockDb.query.mockResolvedValueOnce([]); // snapshot — was empty
      mockDb.query.mockResolvedValueOnce([]); // DELETE
      mockDb.query.mockResolvedValueOnce([]); // INSERT

      await service.replaceParticipants(
        101,
        [
          { type: 'user', id: 5 },
          { type: 'team', id: 10 },
          { type: 'department', id: 20 },
          { type: 'area', id: 30 },
        ],
        7,
      );

      // 7 queries total: 4 validates + snapshot + DELETE + INSERT
      expect(mockDb.query).toHaveBeenCalledTimes(7);
      // 4 logCreate, 0 logDelete (nothing was removed)
      expect(mockLogger.logCreate).toHaveBeenCalledTimes(4);
      expect(mockLogger.logDelete).not.toHaveBeenCalled();
      // logCreate signature: (tenantId, userId, entityType, entityId, details, newValues)
      expect(mockLogger.logCreate).toHaveBeenCalledWith(
        42, // tenantId from getTenantId mock
        7, // addedBy
        'kvp',
        101,
        expect.stringContaining('hinzugefügt'),
        expect.objectContaining({ suggestionId: 101 }),
      );
    });

    // Scenario #3 — replace [user] → [user] (idempotent)
    it('is idempotent when input equals current state (no audit churn)', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]); // validate users
      // snapshot reports the same user already there — service-side it lives in a
      // PoolClient row so all 4 nullable columns must be present.
      mockDb.query.mockResolvedValueOnce([
        { user_id: 5, team_id: null, department_id: null, area_id: null },
      ]);
      mockDb.query.mockResolvedValueOnce([]); // DELETE
      mockDb.query.mockResolvedValueOnce([]); // INSERT

      await service.replaceParticipants(101, [{ type: 'user', id: 5 }], 7);

      // before == after == { user:5 } → no diff entries fire
      expect(mockLogger.logCreate).not.toHaveBeenCalled();
      expect(mockLogger.logDelete).not.toHaveBeenCalled();
    });

    // Scenario #4 — replace [user1, user2] → [user1, user3]
    it('emits logCreate for added and logDelete for removed (DELETE-INSERT diff)', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }, { id: 3 }]); // validate users (input ids = [1,3])
      mockDb.query.mockResolvedValueOnce([
        { user_id: 1, team_id: null, department_id: null, area_id: null },
        { user_id: 2, team_id: null, department_id: null, area_id: null },
      ]); // snapshot — was [user1, user2]
      mockDb.query.mockResolvedValueOnce([]); // DELETE
      mockDb.query.mockResolvedValueOnce([]); // INSERT

      await service.replaceParticipants(
        101,
        [
          { type: 'user', id: 1 },
          { type: 'user', id: 3 },
        ],
        7,
      );

      // Diff: added user:3, removed user:2, kept user:1
      expect(mockLogger.logCreate).toHaveBeenCalledTimes(1);
      expect(mockLogger.logCreate).toHaveBeenCalledWith(
        42,
        7,
        'kvp',
        101,
        expect.stringContaining('user #3'),
        expect.objectContaining({ participantType: 'user', participantId: 3 }),
      );
      expect(mockLogger.logDelete).toHaveBeenCalledTimes(1);
      expect(mockLogger.logDelete).toHaveBeenCalledWith(
        42,
        7,
        'kvp',
        101,
        expect.stringContaining('user #2'),
        expect.objectContaining({ participantType: 'user', participantId: 2 }),
      );
    });

    // Scenario #5 — soft-deleted user rejected with field-level details
    it('throws BadRequestException when a user id is soft-deleted (is_active = DELETED)', async () => {
      // validateTargets users for [99]: soft-deleted → returned as 0 rows by SQL
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.replaceParticipants(101, [{ type: 'user', id: 99 }], 7),
      ).rejects.toBeInstanceOf(BadRequestException);

      // validate the SQL filters out IS_ACTIVE.DELETED — guards against magic-number drift
      const validateCall = mockDb.query.mock.calls[0];
      expect(validateCall?.[0]).toContain(`is_active != ${IS_ACTIVE.DELETED}`);
      expect(validateCall?.[0]).toContain('FROM users');
      // the test promise above already verified the throw; if it threw, snapshot/DELETE/INSERT
      // were never reached → exactly 1 query total.
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      // no audit logging if the call aborted before the diff stage
      expect(mockLogger.logCreate).not.toHaveBeenCalled();
      expect(mockLogger.logDelete).not.toHaveBeenCalled();
    });

    // Scenario #6 — cross-tenant id (RLS hides → SELECT returns 0 → BadRequest)
    it('throws BadRequestException with field details when an area id belongs to another tenant', async () => {
      // validateTargets areas for [200]: RLS in tenant 42 hides tenant-B rows → 0
      mockDb.query.mockResolvedValueOnce([]);

      // Value-capture pattern (avoids vitest/no-conditional-expect): turn the
      // rejection into a regular value, then assert top-level on it.
      const err = await service.replaceParticipants(101, [{ type: 'area', id: 200 }], 7).then(
        (): unknown => {
          throw new Error('expected BadRequestException');
        },
        (e: unknown): unknown => e,
      );
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as {
        code: string;
        details: { field: string; message: string }[];
      };
      expect(response.code).toBe('INVALID_PARTICIPANTS');
      expect(response.details).toHaveLength(1);
      expect(response.details[0]?.field).toBe('participants[0]');
      expect(response.details[0]?.message).toContain('area #200');
    });

    // Scenario #7 (mock-level proxy) — tenant-isolation wiring
    it('opens an RLS-scoped tenantTransaction (not a system transaction)', async () => {
      mockDb.query.mockResolvedValueOnce([]); // snapshot
      mockDb.query.mockResolvedValueOnce([]); // DELETE

      await service.replaceParticipants(101, [], 7);

      // the canonical RLS guarantee at the unit level: the service calls the
      // tenant-scoped wrapper, never `query` (global) or `systemQuery` (BYPASSRLS).
      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
    });

    // Bonus — guard against silent CLS misconfiguration
    it('throws if tenantId is not in CLS context', async () => {
      mockDb.getTenantId.mockReturnValueOnce(undefined);

      await expect(service.replaceParticipants(101, [{ type: 'user', id: 5 }], 7)).rejects.toThrow(
        /tenantId/,
      );
    });

    // Scenario #9 — DB CHECK violation surfaces (service does not swallow)
    it('lets DB constraint errors bubble up (CHECK exactly_one_target violation)', async () => {
      const checkErr = Object.assign(new Error('check constraint violation'), { code: '23514' });
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]); // validate users
      mockDb.query.mockResolvedValueOnce([]); // snapshot
      mockDb.query.mockResolvedValueOnce([]); // DELETE
      mockDb.query.mockRejectedValueOnce(checkErr); // INSERT rejects with CHECK error

      await expect(
        service.replaceParticipants(101, [{ type: 'user', id: 5 }], 7),
      ).rejects.toMatchObject({ code: '23514' });
    });

    // Scenario #10 — pre-flight dedupe via assertNoDuplicates
    it('throws ConflictException with friendly message when input has duplicate (type,id)', async () => {
      // dedupe check fires BEFORE any query — no mock queue entries needed.
      // Value-capture pattern (avoids vitest/no-conditional-expect).
      const err = await service
        .replaceParticipants(
          101,
          [
            { type: 'user', id: 5 },
            { type: 'user', id: 5 },
          ],
          7,
        )
        .then(
          (): unknown => {
            throw new Error('expected ConflictException');
          },
          (e: unknown): unknown => e,
        );
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).message).toContain('Duplicate participant user #5');
      // user-facing copy is mixed English/German (matches the service literal)
      expect((err as ConflictException).message).toContain('tagged only once per KVP-Vorschlag');
      // no DB call leaked through — the duplicate guard fires first
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
    });

    // Bonus — same id under different types is NOT a duplicate
    it('treats {user:5} and {team:5} as distinct (no ConflictException)', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]); // validate users
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]); // validate teams
      mockDb.query.mockResolvedValueOnce([]); // snapshot
      mockDb.query.mockResolvedValueOnce([]); // DELETE
      mockDb.query.mockResolvedValueOnce([]); // INSERT

      await expect(
        service.replaceParticipants(
          101,
          [
            { type: 'user', id: 5 },
            { type: 'team', id: 5 },
          ],
          7,
        ),
      ).resolves.toBeUndefined();

      expect(mockLogger.logCreate).toHaveBeenCalledTimes(2);
    });

    // Bonus — parent-tx integration: when a client is passed, no inner tenantTransaction is opened
    it('uses the caller-provided client and does NOT open a new tenantTransaction', async () => {
      const callerClient = {
        query: vi.fn(async () => ({ rows: [] as unknown[] })),
      };
      // No prior participants, no validation needed (input is empty)
      callerClient.query.mockResolvedValueOnce({ rows: [] }); // snapshot
      callerClient.query.mockResolvedValueOnce({ rows: [] }); // DELETE

      await service.replaceParticipants(
        101,
        [],
        7,
        callerClient as unknown as Parameters<typeof service.replaceParticipants>[3],
      );

      // queries flow through the caller's client, not the service's own transaction
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
      expect(callerClient.query).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================
  // getParticipants
  // =============================================================

  describe('getParticipants', () => {
    // Scenario #8 — cascade-effect at unit level (service returns whatever DB yields)
    it('returns enriched rows mapped from the union-all SELECT', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
        { type: 'user', id: 5, label: 'Anna Müller', sublabel: 'Sales' },
        { type: 'team', id: 10, label: 'Team Montage', sublabel: 'Halle 1' },
      ]);

      const result = await service.getParticipants(101);

      expect(result).toEqual([
        { type: 'user', id: 5, label: 'Anna Müller', sublabel: 'Sales' },
        { type: 'team', id: 10, label: 'Team Montage', sublabel: 'Halle 1' },
      ]);
      // verify the SQL filters soft-deleted users — keeps the IS_ACTIVE constant honest
      const sql = mockDb.tenantQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain(`u.is_active != ${IS_ACTIVE.DELETED}`);
      expect(sql).toContain('UNION ALL');
    });

    // Scenario #7/#8 follow-up — tenant isolation proxy + cascade-leaves-no-ghost
    it('returns whatever tenantQuery yields, with no extra in-service filtering', async () => {
      // Simulate a cascade-deleted user: DB returns only the surviving rows.
      // The service must not re-add ghost rows from any internal cache.
      mockDb.tenantQuery.mockResolvedValueOnce([
        { type: 'team', id: 10, label: 'Team Montage', sublabel: 'Halle 1' },
      ]);

      const result = await service.getParticipants(101);

      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('team');
      // tenantQuery was used (RLS-scoped) — not query/systemQuery
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when the DB has no participants for this suggestion', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.getParticipants(101);

      expect(result).toEqual([]);
    });
  });

  // =============================================================
  // searchOptions
  // =============================================================

  describe('searchOptions', () => {
    // Scenario #11 — empty q → top 50 of each type, no ILIKE
    it('returns top results per type when q is empty (no ILIKE filter in SQL)', async () => {
      // Queue order matches Promise.all([searchUsers, searchTeams, searchDepartments, searchAreas]).
      // vitest's `vi.fn().mockResolvedValueOnce` is FIFO; the awaits inside Promise.all dispatch
      // in array order, so the queue order matches.
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 1, label: 'Anna', sublabel: 'Sales' }]);
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 10, label: 'Team A', sublabel: 'Halle 1' }]);
      mockDb.tenantQuery.mockResolvedValueOnce([
        { id: 20, label: 'Produktion', sublabel: 'Werk 1' },
      ]);
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 30, label: 'Werk 1', sublabel: '' }]);

      const result = await service.searchOptions();

      expect(result.users).toHaveLength(1);
      expect(result.teams).toHaveLength(1);
      expect(result.departments).toHaveLength(1);
      expect(result.areas).toHaveLength(1);
      // 4 SELECTs total
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(4);
      // empty q → no ILIKE clause and empty params for each call
      for (const call of mockDb.tenantQuery.mock.calls) {
        const sql = call[0] as string;
        const params = call[1] as unknown[] | undefined;
        expect(sql).not.toContain('ILIKE');
        expect(params).toEqual([]);
        expect(sql).toContain('LIMIT 50'); // hard cap honoured
      }
    });

    // Scenario #12 — q="ann" → ILIKE filter applied across all 4 types
    it('applies ILIKE filter and forwards trimmed q as $1 across all 4 types', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 1, label: 'Anna Müller', sublabel: '' }]);
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 10, label: 'Annahme', sublabel: 'Halle 1' }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.searchOptions('  ann  ');

      expect(result.users).toHaveLength(1);
      expect(result.teams).toHaveLength(1);
      expect(result.departments).toHaveLength(0);
      expect(result.areas).toHaveLength(0);

      // every call carries the trimmed `ann` term and an ILIKE clause
      for (const call of mockDb.tenantQuery.mock.calls) {
        const sql = call[0] as string;
        const params = call[1] as unknown[];
        expect(sql).toContain('ILIKE');
        expect(params).toEqual(['ann']);
      }
    });

    // Bonus — types filter narrows the parallel set
    it('only queries the requested types when types="user,team"', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 1, label: 'Anna', sublabel: '' }]);
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 10, label: 'Team A', sublabel: '' }]);

      const result = await service.searchOptions(undefined, 'user,team');

      // exactly 2 queries (not 4) — departments and areas were skipped
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(2);
      expect(result.users).toHaveLength(1);
      expect(result.teams).toHaveLength(1);
      expect(result.departments).toEqual([]);
      expect(result.areas).toEqual([]);
    });

    // Bonus — unknown / empty types fall back to all 4
    it('falls back to all 4 types when types is empty or unknown', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.searchOptions(undefined, 'foobar,baz');

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(4);
    });
  });
});

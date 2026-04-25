/**
 * Unit tests for `ActiveShiftResolverService` — Plan §2.3, §R1/R5/R9.
 *
 * Covers all 4 public methods + every branch of the TZ-aware write-window
 * rule. The service is purity-contracted (every timing input is a
 * parameter), so the only collaborator to mock is `DatabaseService`. The
 * mock stages raw query rows so the tests verify the JS branching logic
 * — PostgreSQL's `AT TIME ZONE 'Europe/Berlin'` math stays out of scope
 * (it belongs to the engine's DST table, not to this unit).
 *
 * Key risk coverage (named per plan DoD):
 *  - §R1: Active-shift resolver handles night shift crossing midnight —
 *    user opens at Mon 23:30 AND at Tue 03:00, both resolve to true.
 *  - §R5: "Today only" rule + timezone. Matrix: today early/late/night OK,
 *    yesterday-night within window OK, yesterday-night past window NOT OK,
 *    yesterday non-night NOT OK, future date NOT OK.
 *  - §R9: `resolveAssignees` unions `shifts` AND `shift_rotation_history`
 *    (ADR-011 dual-source), filtering NULL `user_id` server-side.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Phase 3 — Active-shift resolver
 * @see ./active-shift-resolver.service.ts
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { ActiveShiftResolverService } from './active-shift-resolver.service.js';
import type { ActiveShiftContext } from './shift-handover.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    queryAsTenant: vi.fn(),
    query: vi.fn(),
  };
}

// =============================================================
// ActiveShiftResolverService
// =============================================================

describe('ActiveShiftResolverService', () => {
  let service: ActiveShiftResolverService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new ActiveShiftResolverService(mockDb as unknown as DatabaseService);
  });

  // ---------------------------------------------------------------
  // resolveAssignees — §0.8 enum-equivalence mapping + ADR-011 union
  // ---------------------------------------------------------------

  describe('resolveAssignees', () => {
    it('returns user IDs unioned from shifts + shift_rotation_history', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([{ user_id: 5 }, { user_id: 7 }]);

      const result = await service.resolveAssignees(1, 10, new Date('2026-04-22'), 'early');

      expect(result).toEqual([5, 7]);
      const call = mockDb.queryAsTenant.mock.calls[0];
      const sql = call?.[0] as string;
      expect(sql).toContain('FROM shifts');
      expect(sql).toContain('shift_rotation_history');
      expect(sql).toContain('UNION');
      expect(sql).toContain('user_id IS NOT NULL');
    });

    it('maps slot "early" to shifts.type ∈ {early,F} + rotation_type = "F"', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([]);

      await service.resolveAssignees(1, 10, new Date('2026-04-22'), 'early');

      const params = mockDb.queryAsTenant.mock.calls[0]?.[1] as [number, string, string[], string];
      expect(params[2]).toEqual(['early', 'F']);
      expect(params[3]).toBe('F');
    });

    it('maps slot "late" to shifts.type ∈ {late,S} + rotation_type = "S"', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([]);

      await service.resolveAssignees(1, 10, new Date('2026-04-22'), 'late');

      const params = mockDb.queryAsTenant.mock.calls[0]?.[1] as [number, string, string[], string];
      expect(params[2]).toEqual(['late', 'S']);
      expect(params[3]).toBe('S');
    });

    it('maps slot "night" to shifts.type ∈ {night,N} + rotation_type = "N"', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([]);

      await service.resolveAssignees(1, 10, new Date('2026-04-22'), 'night');

      const params = mockDb.queryAsTenant.mock.calls[0]?.[1] as [number, string, string[], string];
      expect(params[2]).toEqual(['night', 'N']);
      expect(params[3]).toBe('N');
    });

    it('returns an empty array when no rows match', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([]);

      const result = await service.resolveAssignees(1, 10, new Date('2026-04-22'), 'early');

      expect(result).toEqual([]);
      // tenantId is the third argument to queryAsTenant (explicit-tenant RLS).
      expect(mockDb.queryAsTenant.mock.calls[0]?.[2]).toBe(1);
    });
  });

  // ---------------------------------------------------------------
  // canWriteForShift — assignee gate + TZ-aware write window (§R5)
  // ---------------------------------------------------------------

  describe('canWriteForShift', () => {
    /**
     * Helper: build a base context. Tests override only the fields they care
     * about (shiftKey, shiftDate, nowUtc). `tenantId=1, userId=5, teamId=10`
     * are fixed so the assignee mock can match by membership.
     */
    function ctx(overrides: Partial<ActiveShiftContext> = {}): ActiveShiftContext {
      return {
        tenantId: 1,
        userId: 5,
        teamId: 10,
        shiftDate: new Date('2026-04-22T00:00:00Z'),
        shiftKey: 'early',
        nowUtc: new Date('2026-04-22T10:00:00Z'),
        ...overrides,
      };
    }

    it('denies with not_assignee when the user is not on the roster (short-circuits)', async () => {
      // Mock only the resolveAssignees call; the window query must never run.
      mockDb.queryAsTenant.mockResolvedValueOnce([{ user_id: 99 }]);

      const result = await service.canWriteForShift(ctx());

      expect(result).toEqual({ allowed: false, reason: 'not_assignee' });
      expect(mockDb.queryAsTenant).toHaveBeenCalledTimes(1);
    });

    it('allows when assignee writes on the same Berlin day (early slot)', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([{ user_id: 5 }]).mockResolvedValueOnce([
        {
          today_berlin: '2026-04-22',
          shift_end_utc: new Date('2026-04-22T12:00:00Z'),
        },
      ]);

      const result = await service.canWriteForShift(ctx());

      expect(result).toEqual({ allowed: true });
    });

    it('allows a night shift opened before midnight Berlin (§R1 part 1)', async () => {
      // User opens at Mon 23:30 Berlin (= 21:30 UTC CEST, 22:30 UTC CET).
      // shiftDate = Monday (today); straight same-day branch.
      mockDb.queryAsTenant.mockResolvedValueOnce([{ user_id: 5 }]).mockResolvedValueOnce([
        {
          today_berlin: '2026-04-21',
          shift_end_utc: new Date('2026-04-22T04:00:00Z'),
        },
      ]);

      const result = await service.canWriteForShift(
        ctx({
          shiftKey: 'night',
          shiftDate: new Date('2026-04-21T00:00:00Z'),
          nowUtc: new Date('2026-04-21T21:30:00Z'),
        }),
      );

      expect(result).toEqual({ allowed: true });
    });

    it('allows same night shift reopened after midnight, still within window (§R1 part 2 + §R5)', async () => {
      // User opens at Tue 03:00 Berlin; shiftDate is still Monday; Berlin "today"
      // has rolled to Tuesday. Yesterday-night branch applies.
      mockDb.queryAsTenant.mockResolvedValueOnce([{ user_id: 5 }]).mockResolvedValueOnce([
        {
          today_berlin: '2026-04-22',
          shift_end_utc: new Date('2026-04-22T04:00:00Z'),
        },
      ]);

      const result = await service.canWriteForShift(
        ctx({
          shiftKey: 'night',
          shiftDate: new Date('2026-04-21T00:00:00Z'),
          nowUtc: new Date('2026-04-22T01:00:00Z'),
        }),
      );

      expect(result).toEqual({ allowed: true });
    });

    it('denies with outside_window for yesterday-night after the 24 h grace has elapsed', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([{ user_id: 5 }]).mockResolvedValueOnce([
        {
          today_berlin: '2026-04-22',
          shift_end_utc: new Date('2026-04-22T04:00:00Z'),
        },
      ]);

      const result = await service.canWriteForShift(
        ctx({
          shiftKey: 'night',
          shiftDate: new Date('2026-04-21T00:00:00Z'),
          // Clock is PAST the shift_end_utc — window closed.
          nowUtc: new Date('2026-04-22T05:00:00Z'),
        }),
      );

      expect(result).toEqual({ allowed: false, reason: 'outside_window' });
    });

    it('denies with outside_window for yesterday non-night slot (no overnight grace for early/late)', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([{ user_id: 5 }]).mockResolvedValueOnce([
        {
          today_berlin: '2026-04-22',
          shift_end_utc: new Date('2026-04-21T16:00:00Z'),
        },
      ]);

      const result = await service.canWriteForShift(
        ctx({
          shiftKey: 'early',
          shiftDate: new Date('2026-04-21T00:00:00Z'),
          nowUtc: new Date('2026-04-22T10:00:00Z'),
        }),
      );

      expect(result).toEqual({ allowed: false, reason: 'outside_window' });
    });

    it('denies with outside_window for a future shift date', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([{ user_id: 5 }]).mockResolvedValueOnce([
        {
          today_berlin: '2026-04-22',
          shift_end_utc: new Date('2026-04-23T12:00:00Z'),
        },
      ]);

      const result = await service.canWriteForShift(
        ctx({
          shiftDate: new Date('2026-04-23T00:00:00Z'),
        }),
      );

      expect(result).toEqual({ allowed: false, reason: 'outside_window' });
    });

    it('denies with shift_times_missing when the tenant has no row for this slot', async () => {
      // Assignee OK, but the window query returns zero rows → tenant has not
      // configured the slot; fail closed with a distinct reason so the UI
      // can tell the user to contact IT instead of waiting for the right day.
      mockDb.queryAsTenant.mockResolvedValueOnce([{ user_id: 5 }]).mockResolvedValueOnce([]);

      const result = await service.canWriteForShift(ctx());

      expect(result).toEqual({ allowed: false, reason: 'shift_times_missing' });
    });
  });

  // ---------------------------------------------------------------
  // getShiftEndClock — shift_times lookup + NotFound path
  // ---------------------------------------------------------------

  describe('getShiftEndClock', () => {
    it('returns start_time and end_time as HH:MM:SS strings', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([
        { start_time: '22:00:00', end_time: '06:00:00' },
      ]);

      const result = await service.getShiftEndClock(1, 'night');

      expect(result).toEqual({ startTime: '22:00:00', endTime: '06:00:00' });
    });

    it('throws NotFoundException when the tenant has no row for the slot', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([]);

      await expect(service.getShiftEndClock(1, 'night')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------
  // getAutoLockCutoff — pure PostgreSQL TZ math, no tenant scope
  // ---------------------------------------------------------------

  describe('getAutoLockCutoff', () => {
    it('returns true when PostgreSQL reports cutoff_passed=true', async () => {
      mockDb.query.mockResolvedValueOnce([{ cutoff_passed: true }]);

      const result = await service.getAutoLockCutoff(
        { shiftDate: new Date('2026-04-20T00:00:00Z'), shiftEndTime: '06:00:00' },
        new Date('2026-04-22T10:00:00Z'),
      );

      expect(result).toBe(true);
      // Uses `db.query` (system pool) — no tenant scope needed, no RLS context.
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.queryAsTenant).not.toHaveBeenCalled();
    });

    it('returns false when cutoff_passed=false or row is missing', async () => {
      mockDb.query.mockResolvedValueOnce([{ cutoff_passed: false }]);
      let result = await service.getAutoLockCutoff(
        { shiftDate: new Date('2026-04-22T00:00:00Z'), shiftEndTime: '06:00:00' },
        new Date('2026-04-22T10:00:00Z'),
      );
      expect(result).toBe(false);

      // Defense in depth: empty row set must also yield false.
      mockDb.query.mockResolvedValueOnce([]);
      result = await service.getAutoLockCutoff(
        { shiftDate: new Date('2026-04-22T00:00:00Z'), shiftEndTime: '06:00:00' },
        new Date('2026-04-22T10:00:00Z'),
      );
      expect(result).toBe(false);
    });
  });
});

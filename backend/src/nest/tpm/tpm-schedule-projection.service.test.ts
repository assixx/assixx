/**
 * Unit tests for TpmScheduleProjectionService
 *
 * Mocked dependencies: DatabaseService, TpmPlansIntervalService.
 * Tests: projectSchedules — plan-derived interval projection (monthly,
 * quarterly, semi_annual, annual), seed calculation, deduplication,
 * time windows, sort order, excludePlanUuid.
 *
 * Intervall-Kaskade Prinzip: All 4 intervals derive from plan config
 * (base_weekday + base_repeat_every + created_at). No cards needed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { TpmPlansIntervalService } from './tpm-plans-interval.service.js';
import { TpmScheduleProjectionService } from './tpm-schedule-projection.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockIntervalService() {
  return {
    calculateIntervalDate: vi.fn(),
    getNthWeekdayOfMonth: vi.fn(),
  };
}
type MockInterval = ReturnType<typeof createMockIntervalService>;

/** DB row shape from fetchActivePlans query */
interface PlanRow {
  plan_uuid: string;
  plan_name: string;
  asset_id: number;
  asset_name: string;
  base_weekday: number;
  base_repeat_every: number;
  base_time: string | null;
  buffer_hours: string;
  plan_created_at: string;
}

/** Helper: create a PlanRow with sensible defaults */
function makeRow(overrides: Partial<PlanRow> = {}): PlanRow {
  return {
    plan_uuid: 'plan-1',
    plan_name: 'Test Plan A',
    asset_id: 1,
    asset_name: 'Asset A',
    base_weekday: 0, // Monday (TPM: 0=Mon)
    base_repeat_every: 1, // 1st Monday of month
    base_time: '09:00',
    buffer_hours: '4',
    plan_created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================
// TpmScheduleProjectionService
// =============================================================

describe('TpmScheduleProjectionService', () => {
  let service: TpmScheduleProjectionService;
  let mockDb: MockDb;
  let mockInterval: MockInterval;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockInterval = createMockIntervalService();

    service = new TpmScheduleProjectionService(
      mockDb as unknown as DatabaseService,
      mockInterval as unknown as TpmPlansIntervalService,
    );
  });

  // =============================================================
  // Empty results
  // =============================================================

  it('should return empty result for tenant with no plans', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-07',
    );

    expect(result.slots).toHaveLength(0);
    expect(result.planCount).toBe(0);
    expect(result.dateRange).toEqual({
      start: '2026-03-01',
      end: '2026-03-07',
    });
  });

  // =============================================================
  // Core: 4 intervals projected automatically
  // =============================================================

  it('should project monthly, quarterly, semi_annual, annual for each plan', async () => {
    mockDb.query.mockResolvedValueOnce([makeRow()]);

    // Seed: 1st Monday of Jan 2026 = Jan 5
    const seed = new Date('2026-01-05');
    mockInterval.getNthWeekdayOfMonth.mockReturnValue(seed);

    // For the range Mar 1-3, only monthly has dates
    // Monthly: seed Jan 5 → Feb 2 → Mar 2 (in range) → Apr 6 (out)
    // Quarterly: seed Jan 5 → Apr 6 (out of range)
    // Semi_annual: seed Jan 5 → Jul 6 (out of range)
    // Annual: seed Jan 5 → Jan 2027 (out of range)
    mockInterval.calculateIntervalDate
      // Monthly chain: Jan 5 → Feb 2 → Mar 2 → Apr 6
      .mockReturnValueOnce(new Date('2026-02-02'))
      .mockReturnValueOnce(new Date('2026-03-02'))
      .mockReturnValueOnce(new Date('2026-04-06'))
      // Quarterly chain: Jan 5 → Apr 6
      .mockReturnValueOnce(new Date('2026-04-06'))
      // Semi_annual chain: Jan 5 → Jul 6
      .mockReturnValueOnce(new Date('2026-07-06'))
      // Annual chain: Jan 5 → Jan 2027
      .mockReturnValueOnce(new Date('2027-01-05'));

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-03',
    );

    // Only monthly's Mar 2 falls in range
    expect(result.planCount).toBe(1);
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0]?.date).toBe('2026-03-02');
    expect(result.slots[0]?.intervalTypes).toContain('monthly');
  });

  // =============================================================
  // Cascade: multiple intervals on the same date
  // =============================================================

  it('should merge intervalTypes when multiple intervals hit the same date', async () => {
    mockDb.query.mockResolvedValueOnce([makeRow()]);

    // Seed: Mar 2 (1st Monday of March)
    const seed = new Date('2026-03-02');
    mockInterval.getNthWeekdayOfMonth.mockReturnValue(seed);

    // All 4 intervals start at seed = Mar 2
    // Monthly: Mar 2 (in range) → Apr 6 (out)
    // Quarterly: Mar 2 (in range) → Jun 1 (out)
    // Semi_annual: Mar 2 (in range) → Sep 7 (out)
    // Annual: Mar 2 (in range) → Mar 2027 (out)
    mockInterval.calculateIntervalDate
      .mockReturnValueOnce(new Date('2026-04-06')) // monthly next
      .mockReturnValueOnce(new Date('2026-06-01')) // quarterly next
      .mockReturnValueOnce(new Date('2026-09-07')) // semi_annual next
      .mockReturnValueOnce(new Date('2027-03-02')); // annual next

    const result = await service.projectSchedules(
      10,
      '2026-03-02',
      '2026-03-02',
    );

    // All 4 intervals land on Mar 2 → deduped into 1 slot
    expect(result.slots).toHaveLength(1);
    const slot = result.slots[0];
    expect(slot?.date).toBe('2026-03-02');
    expect(slot?.intervalTypes).toContain('monthly');
    expect(slot?.intervalTypes).toContain('quarterly');
    expect(slot?.intervalTypes).toContain('semi_annual');
    expect(slot?.intervalTypes).toContain('annual');
    expect(slot?.intervalTypes).toHaveLength(4);
  });

  // =============================================================
  // Seed calculation
  // =============================================================

  it('should use Nth weekday of creation month when still in future', async () => {
    // Plan created Jan 1, 1st Monday of Jan = Jan 5 (after Jan 1)
    mockDb.query.mockResolvedValueOnce([
      makeRow({ plan_created_at: '2026-01-01T00:00:00.000Z' }),
    ]);

    const jan5 = new Date('2026-01-05');
    mockInterval.getNthWeekdayOfMonth.mockReturnValue(jan5);

    // Just need enough mocks to avoid errors
    mockInterval.calculateIntervalDate.mockReturnValue(new Date('2027-01-01'));

    await service.projectSchedules(10, '2026-01-01', '2026-01-31');

    // First call: same month (Jan)
    expect(mockInterval.getNthWeekdayOfMonth).toHaveBeenCalledWith(
      2026,
      0,
      0,
      1,
    );
    // Should only be called once (same month works)
    expect(mockInterval.getNthWeekdayOfMonth).toHaveBeenCalledTimes(1);
  });

  it('should use next month when Nth weekday already passed in creation month', async () => {
    // Plan created Jan 10, 1st Monday of Jan = Jan 5 (before Jan 10!)
    mockDb.query.mockResolvedValueOnce([
      makeRow({ plan_created_at: '2026-01-10T00:00:00.000Z' }),
    ]);

    const jan5 = new Date('2026-01-05'); // before created → skip
    const feb2 = new Date('2026-02-02'); // next month's 1st Monday

    mockInterval.getNthWeekdayOfMonth
      .mockReturnValueOnce(jan5) // same month → too early
      .mockReturnValueOnce(feb2); // next month → use this

    mockInterval.calculateIntervalDate.mockReturnValue(new Date('2027-01-01'));

    await service.projectSchedules(10, '2026-02-01', '2026-02-28');

    // Called twice: once for Jan (rejected), once for Feb (accepted)
    expect(mockInterval.getNthWeekdayOfMonth).toHaveBeenCalledTimes(2);
    expect(mockInterval.getNthWeekdayOfMonth).toHaveBeenCalledWith(
      2026,
      0,
      0,
      1,
    ); // Jan
    expect(mockInterval.getNthWeekdayOfMonth).toHaveBeenCalledWith(
      2026,
      1,
      0,
      1,
    ); // Feb
  });

  // =============================================================
  // Time window calculation
  // =============================================================

  it('should calculate correct startTime/endTime from base_time + buffer_hours', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({ base_time: '09:00', buffer_hours: '5' }),
    ]);

    const seed = new Date('2026-03-02');
    mockInterval.getNthWeekdayOfMonth.mockReturnValue(seed);
    mockInterval.calculateIntervalDate.mockReturnValue(new Date('2027-01-01'));

    const result = await service.projectSchedules(
      10,
      '2026-03-02',
      '2026-03-02',
    );

    expect(result.slots.length).toBeGreaterThan(0);
    const slot = result.slots[0];
    expect(slot?.startTime).toBe('09:00');
    expect(slot?.endTime).toBe('14:00');
    expect(slot?.isFullDay).toBe(false);
    expect(slot?.bufferHours).toBe(5);
  });

  it('should set isFullDay=true when base_time is null', async () => {
    mockDb.query.mockResolvedValueOnce([makeRow({ base_time: null })]);

    const seed = new Date('2026-03-02');
    mockInterval.getNthWeekdayOfMonth.mockReturnValue(seed);
    mockInterval.calculateIntervalDate.mockReturnValue(new Date('2027-01-01'));

    const result = await service.projectSchedules(
      10,
      '2026-03-02',
      '2026-03-02',
    );

    const slot = result.slots[0];
    expect(slot?.startTime).toBeNull();
    expect(slot?.endTime).toBeNull();
    expect(slot?.isFullDay).toBe(true);
  });

  it('should handle buffer hours crossing midnight (22:00 + 4h → 02:00)', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({ base_time: '22:00', buffer_hours: '4' }),
    ]);

    const seed = new Date('2026-03-02');
    mockInterval.getNthWeekdayOfMonth.mockReturnValue(seed);
    mockInterval.calculateIntervalDate.mockReturnValue(new Date('2027-01-01'));

    const result = await service.projectSchedules(
      10,
      '2026-03-02',
      '2026-03-02',
    );

    expect(result.slots[0]?.startTime).toBe('22:00');
    expect(result.slots[0]?.endTime).toBe('02:00');
  });

  it('should handle fractional buffer hours (08:00 + 2.5h → 10:30)', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({ base_time: '08:00', buffer_hours: '2.5' }),
    ]);

    const seed = new Date('2026-03-02');
    mockInterval.getNthWeekdayOfMonth.mockReturnValue(seed);
    mockInterval.calculateIntervalDate.mockReturnValue(new Date('2027-01-01'));

    const result = await service.projectSchedules(
      10,
      '2026-03-02',
      '2026-03-02',
    );

    expect(result.slots[0]?.endTime).toBe('10:30');
  });

  // =============================================================
  // Multiple plans
  // =============================================================

  it('should project slots for multiple plans independently', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({ plan_uuid: 'plan-1', plan_name: 'Plan A' }),
      makeRow({
        plan_uuid: 'plan-2',
        plan_name: 'Plan B',
        asset_id: 2,
        asset_name: 'Asset B',
      }),
    ]);

    const seed = new Date('2026-03-02');
    mockInterval.getNthWeekdayOfMonth.mockReturnValue(seed);
    // Each plan × 4 intervals: first call returns seed (in range), second goes out
    mockInterval.calculateIntervalDate.mockReturnValue(new Date('2027-01-01'));

    const result = await service.projectSchedules(
      10,
      '2026-03-02',
      '2026-03-02',
    );

    expect(result.planCount).toBe(2);
    // Each plan has 4 intervals hitting seed date, deduped to 1 slot per plan
    expect(result.slots).toHaveLength(2);

    const planASlot = result.slots.find((s) => s.planName === 'Plan A');
    const planBSlot = result.slots.find((s) => s.planName === 'Plan B');
    expect(planASlot?.intervalTypes).toHaveLength(4);
    expect(planBSlot?.intervalTypes).toHaveLength(4);
  });

  // =============================================================
  // excludePlanUuid
  // =============================================================

  it('should pass excludePlanUuid to the database query', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-07',
      'plan-to-exclude',
    );

    expect(mockDb.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('uuid != $2');
    expect(params).toContain('plan-to-exclude');
  });

  it('should not include exclude clause when excludePlanUuid is undefined', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    await service.projectSchedules(10, '2026-03-01', '2026-03-07');

    const [sql, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('uuid != $2');
    expect(params).toHaveLength(1);
    expect(params[0]).toBe(10);
  });

  // =============================================================
  // Sort order
  // =============================================================

  it('should sort by date ASC then startTime ASC (nulls last)', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        plan_uuid: 'plan-a',
        plan_name: 'Plan A',
        base_time: '14:00',
      }),
      makeRow({
        plan_uuid: 'plan-b',
        plan_name: 'Plan B',
        asset_id: 2,
        base_time: '08:00',
      }),
      makeRow({
        plan_uuid: 'plan-c',
        plan_name: 'Plan C',
        asset_id: 3,
        base_time: null,
      }),
    ]);

    const seed = new Date('2026-03-02');
    mockInterval.getNthWeekdayOfMonth.mockReturnValue(seed);
    mockInterval.calculateIntervalDate.mockReturnValue(new Date('2027-01-01'));

    const result = await service.projectSchedules(
      10,
      '2026-03-02',
      '2026-03-02',
    );

    // 3 plans, each deduped to 1 slot, sorted by startTime
    expect(result.slots).toHaveLength(3);
    expect(result.slots[0]?.planName).toBe('Plan B'); // 08:00
    expect(result.slots[1]?.planName).toBe('Plan A'); // 14:00
    expect(result.slots[2]?.planName).toBe('Plan C'); // null (full day → last)
  });

  // =============================================================
  // Plan metadata in slots
  // =============================================================

  it('should include correct plan metadata in projected slots', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        plan_uuid: 'uuid-abc',
        plan_name: 'Hydraulik Check',
        asset_id: 42,
        asset_name: 'Presse P17',
        base_time: '10:30',
        buffer_hours: '2.5',
      }),
    ]);

    const seed = new Date('2026-03-02');
    mockInterval.getNthWeekdayOfMonth.mockReturnValue(seed);
    mockInterval.calculateIntervalDate.mockReturnValue(new Date('2027-01-01'));

    const result = await service.projectSchedules(
      10,
      '2026-03-02',
      '2026-03-02',
    );

    const slot = result.slots[0];
    expect(slot?.planUuid).toBe('uuid-abc');
    expect(slot?.planName).toBe('Hydraulik Check');
    expect(slot?.assetId).toBe(42);
    expect(slot?.assetName).toBe('Presse P17');
    expect(slot?.startTime).toBe('10:30');
    expect(slot?.endTime).toBe('13:00');
    expect(slot?.bufferHours).toBe(2.5);
  });

  // =============================================================
  // No daily/weekly in projection
  // =============================================================

  it('should never include daily or weekly interval types', async () => {
    mockDb.query.mockResolvedValueOnce([makeRow()]);

    const seed = new Date('2026-03-02');
    mockInterval.getNthWeekdayOfMonth.mockReturnValue(seed);
    mockInterval.calculateIntervalDate.mockReturnValue(new Date('2027-01-01'));

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-31',
    );

    for (const slot of result.slots) {
      for (const it of slot.intervalTypes) {
        expect(it).not.toBe('daily');
        expect(it).not.toBe('weekly');
      }
    }
  });

  // =============================================================
  // Deduplication preserves correct structure
  // =============================================================

  it('should deduplicate same plan+date but keep different plans separate', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({ plan_uuid: 'plan-1', plan_name: 'Plan A' }),
      makeRow({
        plan_uuid: 'plan-2',
        plan_name: 'Plan B',
        asset_id: 2,
      }),
    ]);

    const seed = new Date('2026-03-02');
    mockInterval.getNthWeekdayOfMonth.mockReturnValue(seed);
    // All intervals converge on seed, then jump far out
    mockInterval.calculateIntervalDate.mockReturnValue(new Date('2027-01-01'));

    const result = await service.projectSchedules(
      10,
      '2026-03-02',
      '2026-03-02',
    );

    // 2 plans × 4 intervals → deduped to 2 slots (1 per plan)
    expect(result.slots).toHaveLength(2);
    const plan1 = result.slots.find((s) => s.planUuid === 'plan-1');
    const plan2 = result.slots.find((s) => s.planUuid === 'plan-2');
    expect(plan1?.intervalTypes).toHaveLength(4);
    expect(plan2?.intervalTypes).toHaveLength(4);
  });

  // =============================================================
  // SQL query structure (no card JOIN)
  // =============================================================

  it('should query plans without card JOIN', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    await service.projectSchedules(10, '2026-03-01', '2026-03-07');

    const [sql] = mockDb.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('tpm_maintenance_plans');
    expect(sql).not.toContain('tpm_cards');
    expect(sql).not.toContain('LEFT JOIN');
    expect(sql).not.toContain('interval_type');
  });
});

/**
 * Unit tests for TpmScheduleProjectionService
 *
 * Mocked dependencies: DatabaseService, TpmPlansIntervalService.
 * Tests: projectSchedules (date generation, deduplication, time windows,
 * sort order, excludePlanUuid, various interval types).
 *
 * All methods are read-only (no mutations).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { TpmPlansIntervalService } from './tpm-plans-interval.service.js';
import { TpmScheduleProjectionService } from './tpm-schedule-projection.service.js';
import type { TpmIntervalType } from './tpm.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockIntervalService() {
  return { calculateIntervalDate: vi.fn() };
}
type MockInterval = ReturnType<typeof createMockIntervalService>;

/** DB row shape from fetchPlanCards JOIN query */
interface PlanCardRow {
  plan_uuid: string;
  plan_name: string;
  machine_id: number;
  machine_name: string;
  base_weekday: number;
  base_repeat_every: number;
  base_time: string | null;
  buffer_hours: string;
  plan_created_at: string;
  interval_type: TpmIntervalType;
  custom_interval_days: number | null;
  weekday_override: number | null;
  current_due_date: string | null;
}

/** Helper: create a PlanCardRow with sensible defaults */
function makeRow(overrides: Partial<PlanCardRow> = {}): PlanCardRow {
  return {
    plan_uuid: 'plan-1',
    plan_name: 'Test Plan A',
    machine_id: 1,
    machine_name: 'Machine A',
    base_weekday: 0, // Monday (TPM: 0=Mon)
    base_repeat_every: 1,
    base_time: '09:00',
    buffer_hours: '4',
    plan_created_at: '2026-01-01T00:00:00.000Z',
    interval_type: 'weekly',
    custom_interval_days: null,
    weekday_override: null,
    current_due_date: '2026-03-02', // Monday
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
  // Daily interval
  // =============================================================

  it('should generate one slot per day for daily interval over 7 days', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({ interval_type: 'daily', current_due_date: '2026-03-01' }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-07',
    );

    expect(result.slots).toHaveLength(7);
    expect(result.planCount).toBe(1);
    expect(result.slots[0]?.date).toBe('2026-03-01');
    expect(result.slots[6]?.date).toBe('2026-03-07');
  });

  // =============================================================
  // Time window calculation
  // =============================================================

  it('should calculate correct startTime/endTime from base_time + buffer_hours', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'daily',
        base_time: '09:00',
        buffer_hours: '5',
        current_due_date: '2026-03-01',
      }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-01',
    );

    expect(result.slots).toHaveLength(1);
    expect(result.slots[0]?.startTime).toBe('09:00');
    expect(result.slots[0]?.endTime).toBe('14:00');
    expect(result.slots[0]?.isFullDay).toBe(false);
    expect(result.slots[0]?.bufferHours).toBe(5);
  });

  it('should set isFullDay=true when base_time is null', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'daily',
        base_time: null,
        current_due_date: '2026-03-01',
      }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-01',
    );

    expect(result.slots).toHaveLength(1);
    expect(result.slots[0]?.startTime).toBeNull();
    expect(result.slots[0]?.endTime).toBeNull();
    expect(result.slots[0]?.isFullDay).toBe(true);
  });

  it('should handle buffer hours crossing midnight (22:00 + 4h → 02:00)', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'daily',
        base_time: '22:00',
        buffer_hours: '4',
        current_due_date: '2026-03-01',
      }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-01',
    );

    expect(result.slots[0]?.startTime).toBe('22:00');
    expect(result.slots[0]?.endTime).toBe('02:00');
  });

  it('should handle fractional buffer hours (08:00 + 2.5h → 10:30)', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'daily',
        base_time: '08:00',
        buffer_hours: '2.5',
        current_due_date: '2026-03-01',
      }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-01',
    );

    expect(result.slots[0]?.endTime).toBe('10:30');
  });

  // =============================================================
  // Multiple plans
  // =============================================================

  it('should project slots for multiple plans', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        plan_uuid: 'plan-1',
        plan_name: 'Plan A',
        interval_type: 'daily',
        current_due_date: '2026-03-01',
      }),
      makeRow({
        plan_uuid: 'plan-2',
        plan_name: 'Plan B',
        machine_id: 2,
        machine_name: 'Machine B',
        interval_type: 'daily',
        current_due_date: '2026-03-01',
      }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-03',
    );

    // 3 days × 2 plans = 6 slots
    expect(result.slots).toHaveLength(6);
    expect(result.planCount).toBe(2);
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
  // Deduplication (same plan+date, different intervals)
  // =============================================================

  it('should deduplicate same plan+date into merged intervalTypes', async () => {
    // daily + weekly for the same plan; both hit 2026-03-02 (Monday)
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'daily',
        current_due_date: '2026-03-01',
      }),
      makeRow({
        interval_type: 'weekly',
        current_due_date: '2026-03-02', // Monday seed
      }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-03-02',
      '2026-03-02',
    );

    const plan1Slots = result.slots.filter((s) => s.planUuid === 'plan-1');
    expect(plan1Slots).toHaveLength(1);
    expect(plan1Slots[0]?.intervalTypes).toContain('daily');
    expect(plan1Slots[0]?.intervalTypes).toContain('weekly');
  });

  // =============================================================
  // Sort order
  // =============================================================

  it('should sort by date ASC then startTime ASC (nulls last)', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        plan_uuid: 'plan-a',
        plan_name: 'Plan A',
        interval_type: 'daily',
        base_time: '14:00',
        current_due_date: '2026-03-01',
      }),
      makeRow({
        plan_uuid: 'plan-b',
        plan_name: 'Plan B',
        machine_id: 2,
        interval_type: 'daily',
        base_time: '08:00',
        current_due_date: '2026-03-01',
      }),
      makeRow({
        plan_uuid: 'plan-c',
        plan_name: 'Plan C',
        machine_id: 3,
        interval_type: 'daily',
        base_time: null,
        current_due_date: '2026-03-01',
      }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-01',
    );

    expect(result.slots).toHaveLength(3);
    expect(result.slots[0]?.planName).toBe('Plan B'); // 08:00
    expect(result.slots[1]?.planName).toBe('Plan A'); // 14:00
    expect(result.slots[2]?.planName).toBe('Plan C'); // null (full day → last)
  });

  // =============================================================
  // Weekly interval
  // =============================================================

  it('should generate weekly dates on correct weekday', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'weekly',
        base_weekday: 0, // Monday
        base_repeat_every: 1,
        current_due_date: '2026-03-02', // Monday
      }),
    ]);

    // Mondays in March 2026: 2, 9, 16, 23, 30
    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-31',
    );

    expect(result.slots).toHaveLength(5);
    for (const slot of result.slots) {
      expect(new Date(slot.date).getDay()).toBe(1); // JS Monday = 1
    }
  });

  it('should respect base_repeat_every for bi-weekly', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'weekly',
        base_weekday: 0,
        base_repeat_every: 2, // every 2nd week
        current_due_date: '2026-03-02',
      }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-31',
    );

    // From Mar 2 every 2 weeks: Mar 2, Mar 16, Mar 30
    expect(result.slots).toHaveLength(3);
    expect(result.slots[0]?.date).toBe('2026-03-02');
    expect(result.slots[1]?.date).toBe('2026-03-16');
    expect(result.slots[2]?.date).toBe('2026-03-30');
  });

  // =============================================================
  // Monthly+ interval (delegates to intervalService)
  // =============================================================

  it('should delegate to calculateIntervalDate for monthly intervals', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'monthly',
        current_due_date: '2026-03-02',
      }),
    ]);

    mockInterval.calculateIntervalDate
      .mockReturnValueOnce(new Date('2026-04-06'))
      .mockReturnValueOnce(new Date('2026-05-04')); // outside range

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-04-30',
    );

    expect(result.slots).toHaveLength(2);
    expect(result.slots[0]?.date).toBe('2026-03-02');
    expect(result.slots[1]?.date).toBe('2026-04-06');
    expect(mockInterval.calculateIntervalDate).toHaveBeenCalled();
  });

  // =============================================================
  // weekday_override
  // =============================================================

  it('should use weekday_override when present on card', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'weekly',
        base_weekday: 0, // Monday
        weekday_override: 2, // Wednesday
        current_due_date: '2026-03-04', // Wednesday
      }),
    ]);

    // Wednesdays in March 2026: 4, 11, 18, 25
    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-31',
    );

    expect(result.slots).toHaveLength(4);
    for (const slot of result.slots) {
      expect(new Date(slot.date).getDay()).toBe(3); // JS Wednesday = 3
    }
  });

  // =============================================================
  // Custom interval
  // =============================================================

  it('should pass customIntervalDays to calculateIntervalDate', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'custom',
        custom_interval_days: 10,
        current_due_date: '2026-03-01',
      }),
    ]);

    mockInterval.calculateIntervalDate
      .mockReturnValueOnce(new Date('2026-03-11'))
      .mockReturnValueOnce(new Date('2026-03-21'))
      .mockReturnValueOnce(new Date('2026-03-31'))
      .mockReturnValueOnce(new Date('2026-04-10')); // outside range

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-31',
    );

    expect(result.slots).toHaveLength(4);
    expect(mockInterval.calculateIntervalDate).toHaveBeenCalledWith(
      expect.any(Date),
      'custom',
      10,
      expect.objectContaining({ weekday: 0, nth: 1 }),
    );
  });

  // =============================================================
  // Seed fallback
  // =============================================================

  it('should use plan_created_at as seed when current_due_date is null', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'daily',
        current_due_date: null,
        plan_created_at: '2026-03-01T00:00:00.000Z',
      }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-03',
    );

    expect(result.slots).toHaveLength(3);
  });

  // =============================================================
  // Same interval type deduplication (groupByPlan)
  // =============================================================

  it('should deduplicate same interval type within a plan', async () => {
    // Two 'weekly' cards for the same plan — groupByPlan keeps only first
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'weekly',
        current_due_date: '2026-03-02',
      }),
      makeRow({
        interval_type: 'weekly',
        current_due_date: '2026-03-09', // second card, same interval
      }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-31',
    );

    // Should produce 5 Mondays (not 10) — dedup prevents double counting
    const uniqueDates = new Set(result.slots.map((s) => s.date));
    expect(uniqueDates.size).toBe(result.slots.length);
  });

  // =============================================================
  // Large range
  // =============================================================

  it('should handle 365-day range with daily interval', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        interval_type: 'daily',
        current_due_date: '2026-01-01',
      }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-01-01',
      '2026-12-31',
    );

    expect(result.slots).toHaveLength(365);
  });

  // =============================================================
  // Plan metadata in slots
  // =============================================================

  it('should include correct plan metadata in projected slots', async () => {
    mockDb.query.mockResolvedValueOnce([
      makeRow({
        plan_uuid: 'uuid-abc',
        plan_name: 'Hydraulik Check',
        machine_id: 42,
        machine_name: 'Presse P17',
        interval_type: 'daily',
        base_time: '10:30',
        buffer_hours: '2.5',
        current_due_date: '2026-03-01',
      }),
    ]);

    const result = await service.projectSchedules(
      10,
      '2026-03-01',
      '2026-03-01',
    );

    const slot = result.slots[0];
    expect(slot?.planUuid).toBe('uuid-abc');
    expect(slot?.planName).toBe('Hydraulik Check');
    expect(slot?.machineId).toBe(42);
    expect(slot?.machineName).toBe('Presse P17');
    expect(slot?.startTime).toBe('10:30');
    expect(slot?.endTime).toBe('13:00');
    expect(slot?.bufferHours).toBe(2.5);
    expect(slot?.intervalTypes).toContain('daily');
  });
});

/**
 * Vacation Settings Service – Unit Tests
 *
 * Mocked dependencies: DatabaseService (tenantTransaction), ActivityLoggerService, uuid.
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 *
 * Key areas: auto-default creation, dynamic buildSetClauses, NUMERIC→Number mapping.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { VacationSettingsService } from './vacation-settings.service.js';
import type { VacationSettingsRow } from './vacation.types.js';

// =============================================================
// Module Mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-settings-uuid'),
}));

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return { tenantTransaction: vi.fn() };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return { log: vi.fn().mockResolvedValue(undefined) };
}

function createMockClient() {
  return { query: vi.fn() };
}
type MockClient = ReturnType<typeof createMockClient>;

function createSettingsRow(
  overrides?: Partial<VacationSettingsRow>,
): VacationSettingsRow {
  return {
    id: 'settings-001',
    tenant_id: 1,
    default_annual_days: '30',
    max_carry_over_days: '10',
    carry_over_deadline_month: 3,
    carry_over_deadline_day: 31,
    advance_notice_days: 0,
    max_consecutive_days: null,
    is_active: 1,
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Flush fire-and-forget promise chains (void activityLogger.log). */
async function flushPromises(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

// =============================================================
// Test Suite
// =============================================================

describe('VacationSettingsService', () => {
  let service: VacationSettingsService;
  let mockDb: MockDb;
  let mockClient: MockClient;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = createMockClient();
    mockActivityLogger = createMockActivityLogger();

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new VacationSettingsService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // -----------------------------------------------------------
  // getSettings
  // -----------------------------------------------------------

  describe('getSettings()', () => {
    it('should return existing settings', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createSettingsRow()],
      });

      const result = await service.getSettings(1);

      expect(result.id).toBe('settings-001');
      expect(result.defaultAnnualDays).toBe(30);
      expect(result.maxCarryOverDays).toBe(10);
      expect(result.carryOverDeadlineMonth).toBe(3);
      expect(result.carryOverDeadlineDay).toBe(31);
      expect(result.advanceNoticeDays).toBe(0);
      expect(result.maxConsecutiveDays).toBeNull();
    });

    it('should auto-create defaults when no settings exist', async () => {
      // 1. findSettings → no rows
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 2. ensureDefaults INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 3. re-fetch after INSERT
      mockClient.query.mockResolvedValueOnce({
        rows: [createSettingsRow()],
      });

      const result = await service.getSettings(1);

      expect(result.defaultAnnualDays).toBe(30);
      // Verify INSERT was called with ON CONFLICT
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        ['mock-settings-uuid', 1, null],
      );
    });

    it('should convert NUMERIC strings to JavaScript numbers', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createSettingsRow({
            default_annual_days: '25.5',
            max_carry_over_days: '7.5',
          }),
        ],
      });

      const result = await service.getSettings(1);

      expect(result.defaultAnnualDays).toBe(25.5);
      expect(result.maxCarryOverDays).toBe(7.5);
      expect(typeof result.defaultAnnualDays).toBe('number');
      expect(typeof result.maxCarryOverDays).toBe('number');
    });

    it('should handle Date objects in created_at/updated_at', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createSettingsRow({
            created_at: new Date(
              '2026-06-15T10:00:00.000Z',
            ) as unknown as string,
            updated_at: new Date(
              '2026-06-15T12:00:00.000Z',
            ) as unknown as string,
          }),
        ],
      });

      const result = await service.getSettings(1);

      expect(result.createdAt).toBe('2026-06-15T10:00:00.000Z');
      expect(result.updatedAt).toBe('2026-06-15T12:00:00.000Z');
    });

    it('should throw Error if re-fetch after default creation returns undefined', async () => {
      // 1. findSettings → no rows
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 2. ensureDefaults INSERT → ok
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 3. re-fetch → still empty (edge case: concurrent delete)
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.getSettings(1)).rejects.toThrow(
        'Failed to create default vacation settings',
      );
    });
  });

  // -----------------------------------------------------------
  // updateSettings
  // -----------------------------------------------------------

  describe('updateSettings()', () => {
    it('should update and return updated settings', async () => {
      const dto: UpdateSettingsDto = {
        defaultAnnualDays: 28,
        advanceNoticeDays: 5,
      } as UpdateSettingsDto;

      // 1. findSettings → existing row
      mockClient.query.mockResolvedValueOnce({
        rows: [createSettingsRow()],
      });
      // 2. UPDATE RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createSettingsRow({
            default_annual_days: '28',
            advance_notice_days: 5,
          }),
        ],
      });

      const result = await service.updateSettings(1, 10, dto);
      await flushPromises();

      expect(result.defaultAnnualDays).toBe(28);
      expect(result.advanceNoticeDays).toBe(5);
      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 1,
          userId: 10,
          action: 'update',
          entityType: 'vacation_settings',
        }),
      );
    });

    it('should auto-create defaults before update when none exist', async () => {
      const dto: UpdateSettingsDto = {
        advanceNoticeDays: 3,
      } as UpdateSettingsDto;

      // 1. findSettings → no rows
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 2. ensureDefaults INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 3. ensureDefaults re-fetch
      mockClient.query.mockResolvedValueOnce({
        rows: [createSettingsRow()],
      });
      // 4. applyUpdate → UPDATE RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [createSettingsRow({ advance_notice_days: 3 })],
      });

      const result = await service.updateSettings(1, 10, dto);

      expect(result.advanceNoticeDays).toBe(3);
      // Verify ensureDefaults was called (INSERT with ON CONFLICT)
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array),
      );
    });

    it('should still run UPDATE with empty DTO (created_by always set)', async () => {
      const dto: UpdateSettingsDto = {} as UpdateSettingsDto;

      // 1. findSettings → existing row
      mockClient.query.mockResolvedValueOnce({
        rows: [createSettingsRow()],
      });
      // 2. applyUpdate → UPDATE with just created_by + updated_at
      mockClient.query.mockResolvedValueOnce({
        rows: [createSettingsRow()],
      });

      const result = await service.updateSettings(1, 10, dto);

      expect(result.defaultAnnualDays).toBe(30);
      // buildSetClauses always adds created_by, so UPDATE runs even with empty DTO
      const updateCall = mockClient.query.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('UPDATE'),
      );
      expect(updateCall).toBeDefined();
      const sql = updateCall![0] as string;
      expect(sql).toContain('created_by = $1');
      expect(sql).toContain('updated_at = NOW()');
      // Params: [userId(10), tenantId(1)]
      expect(updateCall![1]).toEqual([10, 1]);
    });

    it('should build correct SET clauses for partial update', async () => {
      const dto: UpdateSettingsDto = {
        maxCarryOverDays: 15,
        carryOverDeadlineMonth: 6,
      } as UpdateSettingsDto;

      // 1. findSettings
      mockClient.query.mockResolvedValueOnce({
        rows: [createSettingsRow()],
      });
      // 2. UPDATE RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createSettingsRow({
            max_carry_over_days: '15',
            carry_over_deadline_month: 6,
          }),
        ],
      });

      await service.updateSettings(1, 10, dto);

      // Find the UPDATE call
      const updateCall = mockClient.query.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('UPDATE'),
      );
      expect(updateCall).toBeDefined();
      const sql = updateCall![0] as string;
      // Should have max_carry_over_days = $1, carry_over_deadline_month = $2, created_by = $3, updated_at = NOW()
      expect(sql).toContain('max_carry_over_days = $1');
      expect(sql).toContain('carry_over_deadline_month = $2');
      expect(sql).toContain('created_by = $3');
      expect(sql).toContain('updated_at = NOW()');
      // Params: [15, 6, userId(10), tenantId(1)]
      expect(updateCall![1]).toEqual([15, 6, 10, 1]);
    });

    it('should handle all 6 fields in full update', async () => {
      const dto: UpdateSettingsDto = {
        defaultAnnualDays: 25,
        maxCarryOverDays: 5,
        carryOverDeadlineMonth: 4,
        carryOverDeadlineDay: 15,
        advanceNoticeDays: 7,
        maxConsecutiveDays: 14,
      } as UpdateSettingsDto;

      // 1. findSettings
      mockClient.query.mockResolvedValueOnce({
        rows: [createSettingsRow()],
      });
      // 2. UPDATE RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createSettingsRow({
            default_annual_days: '25',
            max_carry_over_days: '5',
            carry_over_deadline_month: 4,
            carry_over_deadline_day: 15,
            advance_notice_days: 7,
            max_consecutive_days: 14,
          }),
        ],
      });

      const result = await service.updateSettings(1, 10, dto);

      expect(result.defaultAnnualDays).toBe(25);
      expect(result.maxCarryOverDays).toBe(5);
      expect(result.carryOverDeadlineMonth).toBe(4);
      expect(result.carryOverDeadlineDay).toBe(15);
      expect(result.advanceNoticeDays).toBe(7);
      expect(result.maxConsecutiveDays).toBe(14);

      // Verify all 6 fields + created_by in params → 7 + tenantId = 8
      const updateCall = mockClient.query.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('UPDATE'),
      );
      expect(updateCall![1]).toHaveLength(8);
    });

    it('should throw Error when UPDATE returns no rows', async () => {
      const dto: UpdateSettingsDto = {
        advanceNoticeDays: 3,
      } as UpdateSettingsDto;

      // 1. findSettings
      mockClient.query.mockResolvedValueOnce({
        rows: [createSettingsRow()],
      });
      // 2. UPDATE RETURNING → empty (e.g. concurrent delete)
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.updateSettings(1, 10, dto)).rejects.toThrow(
        'Settings update returned no rows',
      );
    });

    it('should throw Error when empty DTO UPDATE returns no rows', async () => {
      const dto: UpdateSettingsDto = {} as UpdateSettingsDto;

      // 1. findSettings → existing (so no ensureDefaults)
      mockClient.query.mockResolvedValueOnce({
        rows: [createSettingsRow()],
      });
      // 2. applyUpdate runs UPDATE (created_by always set) → returns empty
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.updateSettings(1, 10, dto)).rejects.toThrow(
        'Settings update returned no rows',
      );
    });
  });
});

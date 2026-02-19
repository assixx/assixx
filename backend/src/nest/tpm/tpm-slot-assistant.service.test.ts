/**
 * Unit tests for TpmSlotAssistantService
 *
 * Mocked dependencies: DatabaseService (query, queryOne, generateInPlaceholders).
 * Tests: getAvailableSlots (4 data sources combined, MAX_RANGE_DAYS validation,
 * per-day conflict resolution), checkSlotAvailability (single-date check),
 * getTeamAvailability (team members + unavailability lookup),
 * validateShiftPlanExists (E15 validation).
 *
 * All methods are read-only (no mutations).
 */
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TpmSlotAssistantService } from './tpm-slot-assistant.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    generateInPlaceholders: vi.fn().mockReturnValue({
      placeholders: '$3, $4',
      nextIndex: 5,
    }),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

// =============================================================
// TpmSlotAssistantService
// =============================================================

describe('TpmSlotAssistantService', () => {
  let service: TpmSlotAssistantService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();

    service = new TpmSlotAssistantService(
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // getAvailableSlots
  // =============================================================

  describe('getAvailableSlots()', () => {
    it('should return per-day availability for a date range', async () => {
      // hasShiftPlan → true
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      // fetchMachineDowntimes → none
      mockDb.query.mockResolvedValueOnce([]);
      // fetchExistingTpmDueDates → none
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAvailableSlots(
        10,
        42,
        '2026-03-01',
        '2026-03-03',
      );

      expect(result.machineId).toBe(42);
      expect(result.startDate).toBe('2026-03-01');
      expect(result.endDate).toBe('2026-03-03');
      expect(result.totalDays).toBe(3);
      expect(result.availableDays).toBe(3);
      expect(result.days).toHaveLength(3);
    });

    it('should mark days as unavailable when no shift plan exists', async () => {
      // hasShiftPlan → false
      mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAvailableSlots(
        10,
        42,
        '2026-03-01',
        '2026-03-01',
      );

      expect(result.availableDays).toBe(0);
      expect(result.days[0]?.isAvailable).toBe(false);
      expect(result.days[0]?.conflicts[0]?.type).toBe('no_shift_plan');
    });

    it('should detect machine downtime conflicts', async () => {
      // hasShiftPlan → true
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      // fetchMachineDowntimes → one downtime covering the date
      mockDb.query.mockResolvedValueOnce([
        {
          status: 'maintenance',
          start_date: '2026-03-01',
          end_date: '2026-03-01',
          reason: 'Geplante Wartung',
        },
      ]);
      // fetchExistingTpmDueDates → none
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAvailableSlots(
        10,
        42,
        '2026-03-01',
        '2026-03-01',
      );

      expect(result.availableDays).toBe(0);
      const conflict = result.days[0]?.conflicts.find(
        (c) => c.type === 'machine_downtime',
      );
      expect(conflict).toBeDefined();
      expect(conflict?.description).toContain('maintenance');
    });

    it('should detect existing TPM due date conflicts', async () => {
      // hasShiftPlan → true
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      // fetchMachineDowntimes → none
      mockDb.query.mockResolvedValueOnce([]);
      // fetchExistingTpmDueDates → one due card
      mockDb.query.mockResolvedValueOnce([
        {
          current_due_date: '2026-03-02',
          card_code: 'BT3',
          title: 'Sichtprüfung',
        },
      ]);

      const result = await service.getAvailableSlots(
        10,
        42,
        '2026-03-01',
        '2026-03-03',
      );

      // Day 1 and 3 should be available, day 2 has TPM conflict
      expect(result.availableDays).toBe(2);
      const day2 = result.days[1];
      expect(day2?.isAvailable).toBe(false);
      expect(day2?.conflicts[0]?.type).toBe('existing_tpm');
      expect(day2?.conflicts[0]?.description).toContain('BT3');
    });

    it('should throw BadRequestException when range exceeds 90 days', async () => {
      await expect(
        service.getAvailableSlots(10, 42, '2026-01-01', '2026-06-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle single-day range', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAvailableSlots(
        10,
        42,
        '2026-03-15',
        '2026-03-15',
      );

      expect(result.totalDays).toBe(1);
      expect(result.days).toHaveLength(1);
      expect(result.days[0]?.date).toBe('2026-03-15');
    });

    it('should combine multiple conflict types on the same day', async () => {
      // No shift plan
      mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
      // Machine downtime
      mockDb.query.mockResolvedValueOnce([
        {
          status: 'repair',
          start_date: '2026-03-01',
          end_date: '2026-03-01',
          reason: null,
        },
      ]);
      // Existing TPM
      mockDb.query.mockResolvedValueOnce([
        {
          current_due_date: '2026-03-01',
          card_code: 'IV1',
          title: 'Ölwechsel',
        },
      ]);

      const result = await service.getAvailableSlots(
        10,
        42,
        '2026-03-01',
        '2026-03-01',
      );

      expect(result.days[0]?.conflicts).toHaveLength(3);
      const types = result.days[0]?.conflicts.map((c) => c.type);
      expect(types).toContain('no_shift_plan');
      expect(types).toContain('machine_downtime');
      expect(types).toContain('existing_tpm');
    });
  });

  // =============================================================
  // checkSlotAvailability
  // =============================================================

  describe('checkSlotAvailability()', () => {
    it('should return available when no conflicts', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkSlotAvailability(10, 42, '2026-03-01');

      expect(result.isAvailable).toBe(true);
      expect(result.hasShiftPlan).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect missing shift plan', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkSlotAvailability(10, 42, '2026-03-01');

      expect(result.isAvailable).toBe(false);
      expect(result.hasShiftPlan).toBe(false);
      expect(result.conflicts[0]?.type).toBe('no_shift_plan');
    });

    it('should detect machine downtime with reason', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      mockDb.query.mockResolvedValueOnce([
        {
          status: 'maintenance',
          start_date: '2026-03-01',
          end_date: '2026-03-01',
          reason: 'Jahresinspektion',
        },
      ]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkSlotAvailability(10, 42, '2026-03-01');

      expect(result.isAvailable).toBe(false);
      const conflict = result.conflicts.find(
        (c) => c.type === 'machine_downtime',
      );
      expect(conflict?.description).toContain('Jahresinspektion');
    });

    it('should detect machine downtime without reason', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      mockDb.query.mockResolvedValueOnce([
        {
          status: 'repair',
          start_date: '2026-03-01',
          end_date: '2026-03-01',
          reason: null,
        },
      ]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkSlotAvailability(10, 42, '2026-03-01');

      const conflict = result.conflicts.find(
        (c) => c.type === 'machine_downtime',
      );
      expect(conflict?.description).toBe('Maschine repair');
    });

    it('should detect existing TPM due dates', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([
        {
          current_due_date: '2026-03-01',
          card_code: 'BT2',
          title: 'Dichtungsprüfung',
        },
      ]);

      const result = await service.checkSlotAvailability(10, 42, '2026-03-01');

      expect(result.isAvailable).toBe(false);
      expect(result.conflicts[0]?.type).toBe('existing_tpm');
      expect(result.conflicts[0]?.description).toContain('BT2');
    });
  });

  // =============================================================
  // getTeamAvailability
  // =============================================================

  describe('getTeamAvailability()', () => {
    it('should return all members available when no unavailability entries', async () => {
      // fetchTeamMembers
      mockDb.query.mockResolvedValueOnce([
        { user_id: 1, username: 'Alice' },
        { user_id: 2, username: 'Bob' },
      ]);
      // fetchUserUnavailability → none
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getTeamAvailability(10, 5, '2026-03-01');

      expect(result.teamId).toBe(5);
      expect(result.date).toBe('2026-03-01');
      expect(result.totalCount).toBe(2);
      expect(result.availableCount).toBe(2);
      expect(result.members[0]?.isAvailable).toBe(true);
      expect(result.members[1]?.isAvailable).toBe(true);
    });

    it('should mark unavailable members correctly', async () => {
      mockDb.query.mockResolvedValueOnce([
        { user_id: 1, username: 'Alice' },
        { user_id: 2, username: 'Bob' },
        { user_id: 3, username: 'Charlie' },
      ]);
      // Bob is on vacation
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 2,
          status: 'vacation',
          start_date: '2026-03-01',
          end_date: '2026-03-07',
        },
      ]);

      const result = await service.getTeamAvailability(10, 5, '2026-03-01');

      expect(result.availableCount).toBe(2);
      expect(result.totalCount).toBe(3);

      const bob = result.members.find((m) => m.userId === 2);
      expect(bob?.isAvailable).toBe(false);
      expect(bob?.unavailabilityReason).toBe('vacation');

      const alice = result.members.find((m) => m.userId === 1);
      expect(alice?.isAvailable).toBe(true);
      expect(alice?.unavailabilityReason).toBeNull();
    });

    it('should return empty result for team with no members', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getTeamAvailability(10, 99, '2026-03-01');

      expect(result.totalCount).toBe(0);
      expect(result.availableCount).toBe(0);
      expect(result.members).toHaveLength(0);
    });

    it('should handle multiple unavailable members', async () => {
      mockDb.query.mockResolvedValueOnce([
        { user_id: 1, username: 'Alice' },
        { user_id: 2, username: 'Bob' },
      ]);
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 1,
          status: 'sick',
          start_date: '2026-03-01',
          end_date: '2026-03-03',
        },
        {
          user_id: 2,
          status: 'training',
          start_date: '2026-03-01',
          end_date: '2026-03-01',
        },
      ]);

      const result = await service.getTeamAvailability(10, 5, '2026-03-01');

      expect(result.availableCount).toBe(0);
      expect(result.totalCount).toBe(2);
    });

    it('should call generateInPlaceholders for user IDs', async () => {
      mockDb.query.mockResolvedValueOnce([
        { user_id: 1, username: 'Alice' },
        { user_id: 2, username: 'Bob' },
      ]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.getTeamAvailability(10, 5, '2026-03-01');

      expect(mockDb.generateInPlaceholders).toHaveBeenCalledWith(2, 3);
    });
  });

  // =============================================================
  // validateShiftPlanExists (E15)
  // =============================================================

  describe('validateShiftPlanExists()', () => {
    it('should return true when published/locked shift plan exists', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '1' });

      const result = await service.validateShiftPlanExists(
        10,
        42,
        '2026-03-01',
        '2026-03-07',
      );

      expect(result).toBe(true);
    });

    it('should return false when no shift plan covers the range', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '0' });

      const result = await service.validateShiftPlanExists(
        10,
        42,
        '2026-06-01',
        '2026-06-07',
      );

      expect(result).toBe(false);
    });

    it('should handle null count result', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.validateShiftPlanExists(
        10,
        42,
        '2026-03-01',
        '2026-03-07',
      );

      expect(result).toBe(false);
    });
  });
});

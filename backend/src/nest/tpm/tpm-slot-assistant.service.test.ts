/**
 * Unit tests for TpmSlotAssistantService
 *
 * Mocked dependencies: DatabaseService, TpmScheduleProjectionService.
 * Tests: getAvailableSlots (data sources combined, MAX_RANGE_DAYS validation,
 * per-day conflict resolution), checkSlotAvailability (single-date check),
 * getTeamAvailability (team members + unavailability lookup).
 *
 * All methods are read-only (no mutations).
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { TpmScheduleProjectionService } from './tpm-schedule-projection.service.js';
import { TpmSlotAssistantService } from './tpm-slot-assistant.service.js';
import type { ProjectedSlot, ScheduleProjectionResult } from './tpm.types.js';

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

function createMockProjection() {
  return {
    projectSchedules: vi.fn(),
  };
}
type MockProjection = ReturnType<typeof createMockProjection>;

/** Helper: create an empty projection result */
function emptyProjection(startDate: string, endDate: string): ScheduleProjectionResult {
  return {
    slots: [],
    dateRange: { start: startDate, end: endDate },
    planCount: 0,
  };
}

/** Helper: create a projected slot */
function makeSlot(overrides: Partial<ProjectedSlot> = {}): ProjectedSlot {
  return {
    planUuid: 'plan-uuid-other',
    planName: 'Plan X',
    assetId: 99,
    assetName: 'Anlage X',
    intervalTypes: ['weekly'],
    date: '2026-03-01',
    startTime: '09:00',
    endTime: '14:00',
    bufferHours: 5,
    isFullDay: false,
    ...overrides,
  };
}

// =============================================================
// TpmSlotAssistantService
// =============================================================

describe('TpmSlotAssistantService', () => {
  let service: TpmSlotAssistantService;
  let mockDb: MockDb;
  let mockProjection: MockProjection;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockProjection = createMockProjection();

    service = new TpmSlotAssistantService(
      mockDb as unknown as DatabaseService,
      mockProjection as unknown as TpmScheduleProjectionService,
    );
  });

  // =============================================================
  // getAvailableSlots
  // =============================================================

  describe('getAvailableSlots()', () => {
    it('should return per-day availability for a date range', async () => {
      // fetchExistingTpmDueDates → none
      mockDb.query.mockResolvedValueOnce([]);
      // scheduleProjection → empty
      mockProjection.projectSchedules.mockResolvedValueOnce(
        emptyProjection('2026-03-01', '2026-03-03'),
      );

      const result = await service.getAvailableSlots(10, 42, '2026-03-01', '2026-03-03');

      expect(result.assetId).toBe(42);
      expect(result.startDate).toBe('2026-03-01');
      expect(result.endDate).toBe('2026-03-03');
      expect(result.totalDays).toBe(3);
      expect(result.availableDays).toBe(3);
      expect(result.days).toHaveLength(3);
    });

    it('should detect existing TPM due date conflicts', async () => {
      // fetchExistingTpmDueDates → one due card
      mockDb.query.mockResolvedValueOnce([
        {
          current_due_date: '2026-03-02',
          card_code: 'BT3',
          title: 'Sichtprüfung',
        },
      ]);
      // scheduleProjection → empty
      mockProjection.projectSchedules.mockResolvedValueOnce(
        emptyProjection('2026-03-01', '2026-03-03'),
      );

      const result = await service.getAvailableSlots(10, 42, '2026-03-01', '2026-03-03');

      // Day 1 and 3 should be available, day 2 has TPM conflict
      expect(result.availableDays).toBe(2);
      const day2 = result.days[1];
      expect(day2?.isAvailable).toBe(false);
      expect(day2?.conflicts[0]?.type).toBe('existing_tpm');
      expect(day2?.conflicts[0]?.description).toContain('BT3');
    });

    it('should throw BadRequestException when range exceeds 90 days', async () => {
      await expect(service.getAvailableSlots(10, 42, '2026-01-01', '2026-06-01')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle single-day range', async () => {
      // fetchExistingTpmDueDates → none
      mockDb.query.mockResolvedValueOnce([]);
      mockProjection.projectSchedules.mockResolvedValueOnce(
        emptyProjection('2026-03-15', '2026-03-15'),
      );

      const result = await service.getAvailableSlots(10, 42, '2026-03-15', '2026-03-15');

      expect(result.totalDays).toBe(1);
      expect(result.days).toHaveLength(1);
      expect(result.days[0]?.date).toBe('2026-03-15');
    });

    it('should combine multiple conflict types on the same day', async () => {
      // Existing TPM
      mockDb.query.mockResolvedValueOnce([
        {
          current_due_date: '2026-03-01',
          card_code: 'IV1',
          title: 'Ölwechsel',
        },
      ]);
      // Schedule conflict from another asset
      mockProjection.projectSchedules.mockResolvedValueOnce({
        slots: [makeSlot({ date: '2026-03-01', assetId: 99 })],
        dateRange: { start: '2026-03-01', end: '2026-03-01' },
        planCount: 1,
      });

      const result = await service.getAvailableSlots(10, 42, '2026-03-01', '2026-03-01');

      expect(result.days[0]?.conflicts).toHaveLength(2);
      const types = result.days[0]?.conflicts.map((c) => c.type);
      expect(types).toContain('existing_tpm');
      expect(types).toContain('tpm_schedule');
    });

    // =========================================================
    // tpm_schedule conflict tests
    // =========================================================

    it('should detect tpm_schedule conflicts from other assets', async () => {
      // fetchExistingTpmDueDates → none
      mockDb.query.mockResolvedValueOnce([]);
      // Projected slot from a DIFFERENT asset (99 != 42)
      mockProjection.projectSchedules.mockResolvedValueOnce({
        slots: [makeSlot({ date: '2026-03-01', assetId: 99 })],
        dateRange: { start: '2026-03-01', end: '2026-03-01' },
        planCount: 1,
      });

      const result = await service.getAvailableSlots(10, 42, '2026-03-01', '2026-03-01');

      expect(result.availableDays).toBe(0);
      const conflict = result.days[0]?.conflicts.find((c) => c.type === 'tpm_schedule');
      expect(conflict).toBeDefined();
      expect(conflict?.description).toContain('Plan X');
      expect(conflict?.description).toContain('Anlage X');
      expect(conflict?.description).toContain('weekly');
      expect(conflict?.description).toContain('09:00');
    });

    it('should exclude same-asset projected slots (no self-conflict)', async () => {
      // fetchExistingTpmDueDates → none
      mockDb.query.mockResolvedValueOnce([]);
      // Projected slot for the SAME asset (42 === 42) → should be excluded
      mockProjection.projectSchedules.mockResolvedValueOnce({
        slots: [makeSlot({ date: '2026-03-01', assetId: 42 })],
        dateRange: { start: '2026-03-01', end: '2026-03-01' },
        planCount: 1,
      });

      const result = await service.getAvailableSlots(10, 42, '2026-03-01', '2026-03-01');

      expect(result.availableDays).toBe(1);
      expect(result.days[0]?.isAvailable).toBe(true);
      expect(result.days[0]?.conflicts).toHaveLength(0);
    });

    it('should show full-day schedule conflict with Ganztägig', async () => {
      // fetchExistingTpmDueDates → none
      mockDb.query.mockResolvedValueOnce([]);
      mockProjection.projectSchedules.mockResolvedValueOnce({
        slots: [
          makeSlot({
            date: '2026-03-01',
            assetId: 99,
            startTime: null,
            endTime: null,
            isFullDay: true,
          }),
        ],
        dateRange: { start: '2026-03-01', end: '2026-03-01' },
        planCount: 1,
      });

      const result = await service.getAvailableSlots(10, 42, '2026-03-01', '2026-03-01');

      const conflict = result.days[0]?.conflicts.find((c) => c.type === 'tpm_schedule');
      expect(conflict?.description).toContain('Ganztägig');
    });

    it('should handle multiple projected slots on the same day', async () => {
      // fetchExistingTpmDueDates → none
      mockDb.query.mockResolvedValueOnce([]);
      mockProjection.projectSchedules.mockResolvedValueOnce({
        slots: [
          makeSlot({
            date: '2026-03-01',
            assetId: 99,
            planName: 'Plan A',
          }),
          makeSlot({
            date: '2026-03-01',
            assetId: 88,
            planName: 'Plan B',
            assetName: 'Anlage Y',
          }),
        ],
        dateRange: { start: '2026-03-01', end: '2026-03-01' },
        planCount: 2,
      });

      const result = await service.getAvailableSlots(10, 42, '2026-03-01', '2026-03-01');

      const schedConflicts = result.days[0]?.conflicts.filter((c) => c.type === 'tpm_schedule');
      expect(schedConflicts).toHaveLength(2);
      expect(schedConflicts?.[0]?.description).toContain('Plan A');
      expect(schedConflicts?.[1]?.description).toContain('Plan B');
    });

    it('should combine tpm_schedule with existing_tpm conflict', async () => {
      // fetchExistingTpmDueDates → one existing
      mockDb.query.mockResolvedValueOnce([
        {
          current_due_date: '2026-03-01',
          card_code: 'BT1',
          title: 'Prüfung',
        },
      ]);
      // Schedule conflict from another asset
      mockProjection.projectSchedules.mockResolvedValueOnce({
        slots: [makeSlot({ date: '2026-03-01', assetId: 99 })],
        dateRange: { start: '2026-03-01', end: '2026-03-01' },
        planCount: 1,
      });

      const result = await service.getAvailableSlots(10, 42, '2026-03-01', '2026-03-01');

      const types = result.days[0]?.conflicts.map((c) => c.type);
      expect(types).toContain('existing_tpm');
      expect(types).toContain('tpm_schedule');
      expect(result.days[0]?.conflicts).toHaveLength(2);
    });
  });

  // =============================================================
  // checkSlotAvailability
  // =============================================================

  describe('checkSlotAvailability()', () => {
    it('should return available when no conflicts', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkSlotAvailability(10, 42, '2026-03-01');

      expect(result.isAvailable).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect existing TPM due dates', async () => {
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

    it('should fall back to username when first_name or last_name is null', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 1,
          username: 'alice42',
          first_name: null,
          last_name: null,
          profile_picture: null,
        },
        {
          user_id: 2,
          username: 'bob99',
          first_name: 'Bob',
          last_name: null,
          profile_picture: null,
        },
      ]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getTeamAvailability(10, 5, '2026-03-01');

      expect(result.members[0]?.userName).toBe('alice42');
      expect(result.members[1]?.userName).toBe('bob99');
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
  // resolveAssetIdByUuid
  // =============================================================

  describe('resolveAssetIdByUuid()', () => {
    it('should return asset id when found', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: 42 });

      const result = await service.resolveAssetIdByUuid(10, 'abc-uuid');

      expect(result).toBe(42);
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM assets'),
        ['abc-uuid', 10],
      );
    });

    it('should throw NotFoundException when asset not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.resolveAssetIdByUuid(10, 'missing-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // getAssetTeamAvailability
  // =============================================================

  describe('getAssetTeamAvailability()', () => {
    it('should return empty result when asset has no teams', async () => {
      // fetchAssetTeams → empty
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAssetTeamAvailability(10, 42, '2026-03-01');

      expect(result.assetId).toBe(42);
      expect(result.date).toBe('2026-03-01');
      expect(result.teams).toHaveLength(0);
      expect(result.members).toHaveLength(0);
      expect(result.availableCount).toBe(0);
      expect(result.totalCount).toBe(0);
    });

    it('should merge members from multiple teams', async () => {
      // fetchAssetTeams → 2 teams
      mockDb.query.mockResolvedValueOnce([
        { team_id: 1, team_name: 'Team Alpha' },
        { team_id: 2, team_name: 'Team Beta' },
      ]);
      // Promise.all interleaving: BOTH fetchTeamMembers fire before either fetchUserUnavailability
      // team 1: fetchTeamMembers
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 10,
          username: 'Alice',
          first_name: 'Alice',
          last_name: 'A',
          profile_picture: null,
        },
      ]);
      // team 2: fetchTeamMembers
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 20,
          username: 'Bob',
          first_name: 'Bob',
          last_name: 'B',
          profile_picture: null,
        },
      ]);
      // team 1: fetchUserUnavailability
      mockDb.query.mockResolvedValueOnce([]);
      // team 2: fetchUserUnavailability
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAssetTeamAvailability(10, 42, '2026-03-01');

      expect(result.teams).toHaveLength(2);
      expect(result.teams[0]?.teamName).toBe('Team Alpha');
      expect(result.teams[1]?.teamName).toBe('Team Beta');
      expect(result.members).toHaveLength(2);
      expect(result.availableCount).toBe(2);
      expect(result.totalCount).toBe(2);
    });

    it('should deduplicate members shared across teams', async () => {
      // fetchAssetTeams → 2 teams
      mockDb.query.mockResolvedValueOnce([
        { team_id: 1, team_name: 'Team A' },
        { team_id: 2, team_name: 'Team B' },
      ]);
      // Promise.all interleaving: both fetchTeamMembers before either fetchUserUnavailability
      // team 1: fetchTeamMembers (same user_id=10)
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 10,
          username: 'Alice',
          first_name: 'Alice',
          last_name: 'A',
          profile_picture: null,
        },
      ]);
      // team 2: fetchTeamMembers (same user_id=10)
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 10,
          username: 'Alice',
          first_name: 'Alice',
          last_name: 'A',
          profile_picture: null,
        },
      ]);
      // team 1: fetchUserUnavailability
      mockDb.query.mockResolvedValueOnce([]);
      // team 2: fetchUserUnavailability
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAssetTeamAvailability(10, 42, '2026-03-01');

      expect(result.members).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });

    it('should count unavailable members correctly', async () => {
      // fetchAssetTeams → 1 team
      mockDb.query.mockResolvedValueOnce([{ team_id: 1, team_name: 'Team A' }]);
      // fetchTeamMembers
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 10,
          username: 'Alice',
          first_name: 'Alice',
          last_name: 'A',
          profile_picture: null,
        },
        {
          user_id: 20,
          username: 'Bob',
          first_name: 'Bob',
          last_name: 'B',
          profile_picture: null,
        },
      ]);
      // fetchUserUnavailability → Bob on vacation
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 20,
          status: 'vacation',
          start_date: '2026-03-01',
          end_date: '2026-03-07',
        },
      ]);

      const result = await service.getAssetTeamAvailability(10, 42, '2026-03-01');

      expect(result.availableCount).toBe(1);
      expect(result.totalCount).toBe(2);
    });
  });

});

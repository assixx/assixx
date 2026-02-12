/**
 * Vacation Capacity Service – Unit Tests (Phase 3, Session 14)
 *
 * THE HEART OF THE SYSTEM — analyzeCapacity() orchestrates:
 * 1. Team context gathering (DB queries)
 * 2. Sub-service queries (holidays, blackouts, staffing)
 * 3. Per-day capacity computation (team + machines)
 * 4. Entitlement check, substitute check, overall status
 *
 * Mocked dependencies: DatabaseService, VacationHolidaysService,
 * VacationEntitlementsService, VacationBlackoutsService, VacationStaffingRulesService.
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 * Multiple tenantTransaction calls happen (gatherTeamContext, getWorkdayDates,
 * checkSubstitute).
 */
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { VacationBlackoutsService } from './vacation-blackouts.service.js';
import {
  type CapacityAnalysisParams,
  VacationCapacityService,
} from './vacation-capacity.service.js';
import type { VacationEntitlementsService } from './vacation-entitlements.service.js';
import type { VacationHolidaysService } from './vacation-holidays.service.js';
import type { VacationStaffingRulesService } from './vacation-staffing-rules.service.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockHolidaysService() {
  return {
    countWorkdays: vi.fn(),
    getHolidays: vi.fn(),
    createHoliday: vi.fn(),
    updateHoliday: vi.fn(),
    deleteHoliday: vi.fn(),
    isHoliday: vi.fn(),
  };
}

function createMockEntitlementsService() {
  return {
    getEntitlement: vi.fn(),
    getBalance: vi.fn(),
    createOrUpdateEntitlement: vi.fn(),
    addDays: vi.fn(),
    carryOverRemainingDays: vi.fn(),
    updateEntitlement: vi.fn(),
  };
}

function createMockBlackoutsService() {
  return {
    getBlackouts: vi.fn(),
    createBlackout: vi.fn(),
    updateBlackout: vi.fn(),
    deleteBlackout: vi.fn(),
    getConflicts: vi.fn(),
  };
}

function createMockStaffingRulesService() {
  return {
    getStaffingRules: vi.fn(),
    createStaffingRule: vi.fn(),
    updateStaffingRule: vi.fn(),
    deleteStaffingRule: vi.fn(),
    getForMachines: vi.fn(),
  };
}

/** Standard base params for analyzeCapacity */
function createBaseParams(
  overrides?: Partial<CapacityAnalysisParams>,
): CapacityAnalysisParams {
  return {
    tenantId: 1,
    startDate: '2026-06-01', // Monday
    endDate: '2026-06-05', // Friday
    requesterId: 5,
    ...overrides,
  };
}

// =============================================================
// Test Suite
// =============================================================

describe('VacationCapacityService', () => {
  let service: VacationCapacityService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let mockHolidays: ReturnType<typeof createMockHolidaysService>;
  let mockEntitlements: ReturnType<typeof createMockEntitlementsService>;
  let mockBlackouts: ReturnType<typeof createMockBlackoutsService>;
  let mockStaffingRules: ReturnType<typeof createMockStaffingRulesService>;

  /**
   * Configure standard tenantTransaction responses.
   * tenantTransaction is called multiple times:
   * Call 1: gatherTeamContext
   * Call 2: getWorkdayDates
   * Call 3 (optional): checkSubstitute
   */
  function setupGatherTeamContext(opts?: {
    teamRow?: object;
    members?: object[];
    machines?: object[];
    approvedAbsences?: object[];
    availabilityAbsences?: object[];
  }): void {
    const teamRow = opts?.teamRow ?? {
      team_id: 10,
      team_name: 'Team Alpha',
      department_id: 3,
    };
    const members = opts?.members ?? [
      { user_id: 5, first_name: 'Max', last_name: 'Mustermann' },
      { user_id: 6, first_name: 'Anna', last_name: 'Schmidt' },
      { user_id: 7, first_name: 'Ben', last_name: 'Weber' },
      { user_id: 8, first_name: 'Clara', last_name: 'Fischer' },
    ];
    const machines = opts?.machines ?? [
      { machine_id: 100, machine_name: 'CNC Mill' },
    ];
    const approvedAbsences = opts?.approvedAbsences ?? [];
    const availabilityAbsences = opts?.availabilityAbsences ?? [];

    // gatherTeamContext: findRequesterTeam, then 4 parallel queries
    const contextClient = { query: vi.fn() };
    // Query 1: findRequesterTeam
    contextClient.query.mockResolvedValueOnce({ rows: [teamRow] });
    // Query 2: loadTeamMembers
    contextClient.query.mockResolvedValueOnce({ rows: members });
    // Query 3: loadTeamMachines
    contextClient.query.mockResolvedValueOnce({ rows: machines });
    // Query 4: loadApprovedAbsences
    contextClient.query.mockResolvedValueOnce({ rows: approvedAbsences });
    // Query 5: loadAvailabilityAbsences
    contextClient.query.mockResolvedValueOnce({ rows: availabilityAbsences });

    // getWorkdayDates: holiday query
    const workdayClient = { query: vi.fn() };
    workdayClient.query.mockResolvedValueOnce({ rows: [] }); // No holidays

    // Wire up tenantTransaction to use different clients per call
    let callCount = 0;
    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: unknown) => Promise<unknown>) => {
        callCount++;
        if (callCount === 1) {
          return await callback(contextClient);
        }
        if (callCount === 2) {
          return await callback(workdayClient);
        }
        // Call 3+: checkSubstitute
        return await callback(mockClient);
      },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    mockHolidays = createMockHolidaysService();
    mockEntitlements = createMockEntitlementsService();
    mockBlackouts = createMockBlackoutsService();
    mockStaffingRules = createMockStaffingRulesService();

    service = new VacationCapacityService(
      mockDb as unknown as DatabaseService,
      mockHolidays as unknown as VacationHolidaysService,
      mockEntitlements as unknown as VacationEntitlementsService,
      mockBlackouts as unknown as VacationBlackoutsService,
      mockStaffingRules as unknown as VacationStaffingRulesService,
    );

    // Default sub-service responses
    mockHolidays.countWorkdays.mockResolvedValue(5);
    mockBlackouts.getConflicts.mockResolvedValue([]);
    mockStaffingRules.getForMachines.mockResolvedValue(new Map());
    mockEntitlements.getBalance.mockResolvedValue({
      year: 2026,
      totalDays: 30,
      carriedOverDays: 0,
      effectiveCarriedOver: 0,
      additionalDays: 0,
      availableDays: 30,
      usedDays: 0,
      remainingDays: 30,
      pendingDays: 0,
      projectedRemaining: 30,
    });
  });

  // -----------------------------------------------------------
  // analyzeCapacity — basic happy path
  // -----------------------------------------------------------

  describe('analyzeCapacity() — happy path', () => {
    it('should return ok status with sufficient capacity', async () => {
      setupGatherTeamContext();

      const result = await service.analyzeCapacity(createBaseParams());

      expect(result.overallStatus).toBe('ok');
      expect(result.workdays).toBe(5);
      expect(result.blackoutConflicts).toHaveLength(0);
      expect(result.entitlementCheck.sufficient).toBe(true);
      expect(result.entitlementCheck.availableDays).toBe(30);
      expect(result.entitlementCheck.requestedDays).toBe(5);
    });

    it('should compute team analysis with correct member counts', async () => {
      setupGatherTeamContext(); // 4 members, no absences

      const result = await service.analyzeCapacity(createBaseParams());

      expect(result.teamAnalysis).toHaveLength(1);
      const team = result.teamAnalysis[0];
      expect(team?.teamId).toBe(10);
      expect(team?.teamName).toBe('Team Alpha');
      expect(team?.totalMembers).toBe(4);
      // 4 members - 0 absent - 1 requester = 3 available after approval
      expect(team?.availableAfterApproval).toBe(3);
      expect(team?.status).toBe('ok'); // 3/4 = 0.75 > 0.7
    });
  });

  // -----------------------------------------------------------
  // analyzeCapacity — team member absent
  // -----------------------------------------------------------

  describe('analyzeCapacity() — absences', () => {
    it('should account for approved vacation absences', async () => {
      setupGatherTeamContext({
        approvedAbsences: [
          {
            requester_id: 6, // Anna is on vacation
            start_date: '2026-06-01',
            end_date: '2026-06-05',
            half_day_start: 'none',
            half_day_end: 'none',
          },
        ],
      });

      const result = await service.analyzeCapacity(createBaseParams());

      const team = result.teamAnalysis[0];
      // 4 members - 1 absent (Anna) - 1 requester (Max) = 2 available
      expect(team?.absentMembers).toBe(1);
      expect(team?.availableAfterApproval).toBe(2);
    });

    it('should account for availability absences', async () => {
      setupGatherTeamContext({
        availabilityAbsences: [
          {
            user_id: 7, // Ben is sick
            start_date: '2026-06-02',
            end_date: '2026-06-04',
          },
        ],
      });

      const result = await service.analyzeCapacity(createBaseParams());

      const team = result.teamAnalysis[0];
      expect(team?.absentMembers).toBe(1);
      expect(team?.availableAfterApproval).toBe(2);
    });

    it('should not count requester as absent', async () => {
      setupGatherTeamContext({
        approvedAbsences: [
          {
            requester_id: 5, // The requester themselves
            start_date: '2026-05-25',
            end_date: '2026-06-02',
            half_day_start: 'none',
            half_day_end: 'none',
          },
        ],
      });

      const result = await service.analyzeCapacity(createBaseParams());

      const team = result.teamAnalysis[0];
      // Requester's own existing vacation is excluded from absence count
      expect(team?.absentMembers).toBe(0);
      expect(team?.availableAfterApproval).toBe(3);
    });
  });

  // -----------------------------------------------------------
  // analyzeCapacity — no team
  // -----------------------------------------------------------

  describe('analyzeCapacity() — no team', () => {
    it('should throw BadRequestException when requester has no team', async () => {
      const contextClient = { query: vi.fn() };
      contextClient.query.mockResolvedValueOnce({ rows: [] }); // No team found

      mockDb.tenantTransaction.mockImplementation(
        async (callback: (client: unknown) => Promise<unknown>) => {
          return await callback(contextClient);
        },
      );

      await expect(service.analyzeCapacity(createBaseParams())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // -----------------------------------------------------------
  // analyzeCapacity — blackout conflicts → blocked
  // -----------------------------------------------------------

  describe('analyzeCapacity() — blackout conflicts', () => {
    it('should return blocked when blackout conflicts exist', async () => {
      setupGatherTeamContext();
      mockBlackouts.getConflicts.mockResolvedValue([
        {
          blackoutId: 'bo-001',
          name: 'Summer Freeze',
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          scopeType: 'global',
        },
      ]);

      const result = await service.analyzeCapacity(createBaseParams());

      expect(result.overallStatus).toBe('blocked');
      expect(result.blackoutConflicts).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------
  // analyzeCapacity — insufficient entitlement → blocked
  // -----------------------------------------------------------

  describe('analyzeCapacity() — insufficient entitlement', () => {
    it('should return blocked when not enough vacation days', async () => {
      setupGatherTeamContext();
      mockEntitlements.getBalance.mockResolvedValue({
        year: 2026,
        totalDays: 30,
        carriedOverDays: 0,
        effectiveCarriedOver: 0,
        additionalDays: 0,
        availableDays: 30,
        usedDays: 28,
        remainingDays: 2, // Only 2 days left, requesting 5
        pendingDays: 0,
        projectedRemaining: 2,
      });

      const result = await service.analyzeCapacity(createBaseParams());

      expect(result.overallStatus).toBe('blocked');
      expect(result.entitlementCheck.sufficient).toBe(false);
      expect(result.entitlementCheck.remainingAfterApproval).toBe(-3);
    });
  });

  // -----------------------------------------------------------
  // analyzeCapacity — machine capacity
  // -----------------------------------------------------------

  describe('analyzeCapacity() — machine capacity', () => {
    it('should compute machine analysis with staffing rules', async () => {
      setupGatherTeamContext();
      // Machine 100 (CNC Mill) requires min 2 staff
      mockStaffingRules.getForMachines.mockResolvedValue(new Map([[100, 2]]));

      const result = await service.analyzeCapacity(createBaseParams());

      expect(result.machineAnalysis).toHaveLength(1);
      const machine = result.machineAnalysis[0];
      expect(machine?.machineId).toBe(100);
      expect(machine?.machineName).toBe('CNC Mill');
      expect(machine?.minStaffRequired).toBe(2);
      // 4 members - 0 absent = 4 available, - 1 requester = 3 after approval
      expect(machine?.availableAfterApproval).toBe(3);
      expect(machine?.status).toBe('ok'); // 3 > 2
    });

    it('should return critical when machine falls below min staff', async () => {
      setupGatherTeamContext({
        members: [
          { user_id: 5, first_name: 'Max', last_name: 'M' },
          { user_id: 6, first_name: 'Anna', last_name: 'S' },
          { user_id: 7, first_name: 'Ben', last_name: 'W' },
        ],
        approvedAbsences: [
          {
            requester_id: 6,
            start_date: '2026-06-01',
            end_date: '2026-06-05',
            half_day_start: 'none',
            half_day_end: 'none',
          },
        ],
      });
      // min 2 staff, but only 3 members - 1 absent - 1 requester = 1 available
      mockStaffingRules.getForMachines.mockResolvedValue(new Map([[100, 2]]));

      const result = await service.analyzeCapacity(createBaseParams());

      const machine = result.machineAnalysis[0];
      expect(machine?.availableAfterApproval).toBe(1);
      expect(machine?.status).toBe('critical'); // 1 < 2
      expect(result.overallStatus).toBe('blocked'); // critical machine → blocked
    });

    it('should return warning when machine equals min staff', async () => {
      setupGatherTeamContext({
        members: [
          { user_id: 5, first_name: 'Max', last_name: 'M' },
          { user_id: 6, first_name: 'Anna', last_name: 'S' },
          { user_id: 7, first_name: 'Ben', last_name: 'W' },
        ],
      });
      // min 2 staff, 3 members - 0 absent - 1 requester = 2 available = min
      mockStaffingRules.getForMachines.mockResolvedValue(new Map([[100, 2]]));

      const result = await service.analyzeCapacity(createBaseParams());

      const machine = result.machineAnalysis[0];
      expect(machine?.availableAfterApproval).toBe(2);
      expect(machine?.status).toBe('warning'); // 2 === 2
      expect(result.overallStatus).toBe('warning');
    });

    it('should skip machines without staffing rules', async () => {
      setupGatherTeamContext(); // Has machine 100
      mockStaffingRules.getForMachines.mockResolvedValue(new Map()); // No rules

      const result = await service.analyzeCapacity(createBaseParams());

      expect(result.machineAnalysis).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------
  // analyzeCapacity — substitute check
  // -----------------------------------------------------------

  describe('analyzeCapacity() — substitute check', () => {
    it('should include substitute check when substituteId provided', async () => {
      setupGatherTeamContext();
      // checkSubstitute uses tenantTransaction (call 3)
      // Query 1: get substitute name
      mockClient.query.mockResolvedValueOnce({
        rows: [{ first_name: 'Substitute', last_name: 'Person' }],
      });
      // Query 2: check conflicts → none
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.analyzeCapacity(
        createBaseParams({ substituteId: 20 }),
      );

      expect(result.substituteCheck).toBeDefined();
      expect(result.substituteCheck?.substituteId).toBe(20);
      expect(result.substituteCheck?.substituteName).toBe('Substitute Person');
      expect(result.substituteCheck?.available).toBe(true);
    });

    it('should detect substitute conflicts', async () => {
      setupGatherTeamContext();
      // substitute name
      mockClient.query.mockResolvedValueOnce({
        rows: [{ first_name: 'Busy', last_name: 'Sub' }],
      });
      // substitute has conflicting vacation
      mockClient.query.mockResolvedValueOnce({
        rows: [{ start_date: '2026-06-02', end_date: '2026-06-04' }],
      });

      const result = await service.analyzeCapacity(
        createBaseParams({ substituteId: 20 }),
      );

      expect(result.substituteCheck?.available).toBe(false);
      expect(result.substituteCheck?.conflictDates).toHaveLength(1);
    });

    it('should not include substitute check when no substituteId', async () => {
      setupGatherTeamContext();

      const result = await service.analyzeCapacity(createBaseParams());

      expect(result.substituteCheck).toBeUndefined();
    });
  });

  // -----------------------------------------------------------
  // analyzeCapacity — empty workdays (e.g., requesting weekends only)
  // -----------------------------------------------------------

  describe('analyzeCapacity() — edge cases', () => {
    it('should handle empty workday range (weekend only)', async () => {
      // 2026-06-06 (Sat) to 2026-06-07 (Sun) → no workdays
      setupGatherTeamContext();
      mockHolidays.countWorkdays.mockResolvedValue(0);

      const result = await service.analyzeCapacity(
        createBaseParams({ startDate: '2026-06-06', endDate: '2026-06-07' }),
      );

      expect(result.workdays).toBe(0);
      expect(result.teamAnalysis).toHaveLength(0);
      expect(result.machineAnalysis).toHaveLength(0);
    });

    it('should handle team with no machines', async () => {
      setupGatherTeamContext({ machines: [] });

      const result = await service.analyzeCapacity(createBaseParams());

      expect(result.machineAnalysis).toHaveLength(0);
      expect(result.overallStatus).toBe('ok');
    });
  });
});

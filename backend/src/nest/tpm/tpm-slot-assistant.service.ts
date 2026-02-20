/**
 * TPM Slot Availability Assistant
 *
 * Combines 4 data sources to determine when a machine is available
 * for maintenance scheduling:
 *   1. shift_plans — E15: shift plan must exist for the period
 *   2. machine_availability — planned downtime (maintenance, repair, etc.)
 *   3. tpm_cards — already scheduled TPM due dates
 *   4. user_availability — team member vacation/sick status
 *
 * All methods are read-only. Uses DatabaseService directly to avoid
 * cross-module coupling (no ShiftsModule/MachinesModule/UsersModule imports).
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

// ============================================================================
// Exported Types
// ============================================================================

/** Types of scheduling conflicts */
export type SlotConflictType =
  | 'no_shift_plan'
  | 'machine_downtime'
  | 'existing_tpm';

/** A single scheduling conflict */
export interface SlotConflict {
  type: SlotConflictType;
  description: string;
}

/** Availability for a single day */
export interface DayAvailability {
  date: string;
  isAvailable: boolean;
  conflicts: SlotConflict[];
}

/** Result of getAvailableSlots() */
export interface SlotAvailabilityResult {
  machineId: number;
  startDate: string;
  endDate: string;
  days: DayAvailability[];
  availableDays: number;
  totalDays: number;
}

/** Result of checkSlotAvailability() */
export interface SlotCheckResult {
  isAvailable: boolean;
  hasShiftPlan: boolean;
  conflicts: SlotConflict[];
}

/** Single team member's availability */
export interface TeamMemberStatus {
  userId: number;
  userName: string;
  isAvailable: boolean;
  unavailabilityReason: string | null;
}

/** Result of getTeamAvailability() */
export interface TeamAvailabilityResult {
  teamId: number;
  date: string;
  members: TeamMemberStatus[];
  availableCount: number;
  totalCount: number;
}

/** Team info for machine_teams lookup */
export interface MachineTeamInfo {
  teamId: number;
  teamName: string;
}

/** Result of getMachineTeamAvailability() — all teams for a machine */
export interface MachineTeamAvailabilityResult {
  machineId: number;
  date: string;
  teams: MachineTeamInfo[];
  members: TeamMemberStatus[];
  availableCount: number;
  totalCount: number;
}

// ============================================================================
// Internal DB Row Types
// ============================================================================

interface ShiftPlanCountRow {
  count: string;
}

interface MachineDowntimeRow {
  status: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

interface TpmDueDateRow {
  current_due_date: string;
  card_code: string;
  title: string;
}

interface TeamMemberRow {
  user_id: number;
  username: string;
}

interface UserAvailabilityRow {
  user_id: number;
  status: string;
  start_date: string;
  end_date: string;
}

interface MachineTeamRow {
  team_id: number;
  team_name: string;
}

/** Max days allowed in a single range query */
const MAX_RANGE_DAYS = 90;

@Injectable()
export class TpmSlotAssistantService {
  private readonly logger = new Logger(TpmSlotAssistantService.name);

  constructor(private readonly db: DatabaseService) {}

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Get per-day availability for a machine over a date range.
   * Combines shift plan (E15), machine downtime, and existing TPM slots.
   */
  async getAvailableSlots(
    tenantId: number,
    machineId: number,
    startDate: string,
    endDate: string,
  ): Promise<SlotAvailabilityResult> {
    const days = generateDateRange(startDate, endDate);
    if (days.length > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Maximaler Zeitraum: ${MAX_RANGE_DAYS} Tage (angefragt: ${days.length})`,
      );
    }

    // Batch-fetch all 3 data sources for the full range
    const [shiftPlanExists, downtimes, tpmDueDates] = await Promise.all([
      this.hasShiftPlan(tenantId, machineId, startDate, endDate),
      this.fetchMachineDowntimes(tenantId, machineId, startDate, endDate),
      this.fetchExistingTpmDueDates(tenantId, machineId, startDate, endDate),
    ]);

    // Build per-day conflict map
    const downtimeSet = buildDateOverlapSet(downtimes, days);
    const tpmDateSet = new Set(
      tpmDueDates.map((r: TpmDueDateRow) => r.current_due_date),
    );

    this.logger.debug(
      `Slot-Abfrage: Maschine ${machineId}, ${startDate} bis ${endDate} (${days.length} Tage)`,
    );

    const dayResults = days.map((date: string) =>
      buildDayConflicts(
        date,
        shiftPlanExists,
        downtimeSet,
        tpmDueDates,
        tpmDateSet,
      ),
    );
    const availableDays = dayResults.filter(
      (d: DayAvailability) => d.isAvailable,
    ).length;

    return {
      machineId,
      startDate,
      endDate,
      days: dayResults,
      availableDays,
      totalDays: days.length,
    };
  }

  /**
   * Check availability for a single date.
   * Returns boolean + list of conflicts.
   */
  async checkSlotAvailability(
    tenantId: number,
    machineId: number,
    date: string,
  ): Promise<SlotCheckResult> {
    const [hasShiftPlan, downtimes, tpmDueDates] = await Promise.all([
      this.hasShiftPlan(tenantId, machineId, date, date),
      this.fetchMachineDowntimes(tenantId, machineId, date, date),
      this.fetchExistingTpmDueDates(tenantId, machineId, date, date),
    ]);

    const conflicts: SlotConflict[] = [];

    if (!hasShiftPlan) {
      conflicts.push({
        type: 'no_shift_plan',
        description: 'Kein Schichtplan für dieses Datum (E15)',
      });
    }

    for (const dt of downtimes) {
      conflicts.push({
        type: 'machine_downtime',
        description: `Maschine ${dt.status}${dt.reason !== null ? `: ${dt.reason}` : ''}`,
      });
    }

    for (const card of tpmDueDates) {
      conflicts.push({
        type: 'existing_tpm',
        description: `TPM-Karte ${card.card_code} fällig: ${card.title}`,
      });
    }

    return {
      isAvailable: conflicts.length === 0,
      hasShiftPlan,
      conflicts,
    };
  }

  /**
   * Get team member availability for a specific date.
   * Resolves team → members → individual availability.
   */
  async getTeamAvailability(
    tenantId: number,
    teamId: number,
    date: string,
  ): Promise<TeamAvailabilityResult> {
    const teamMembers = await this.fetchTeamMembers(tenantId, teamId);

    if (teamMembers.length === 0) {
      return {
        teamId,
        date,
        members: [],
        availableCount: 0,
        totalCount: 0,
      };
    }

    const userIds = teamMembers.map((m: TeamMemberRow) => m.user_id);
    const unavailabilityMap = await this.fetchUserUnavailability(
      tenantId,
      userIds,
      date,
    );

    const members: TeamMemberStatus[] = teamMembers.map(
      (member: TeamMemberRow) => {
        const unavailability = unavailabilityMap.get(member.user_id);
        return {
          userId: member.user_id,
          userName: member.username,
          isAvailable: unavailability === undefined,
          unavailabilityReason: unavailability?.status ?? null,
        };
      },
    );

    const availableCount = members.filter(
      (m: TeamMemberStatus) => m.isAvailable,
    ).length;

    return {
      teamId,
      date,
      members,
      availableCount,
      totalCount: members.length,
    };
  }

  /**
   * E15 Validation: Check if an active shift plan covers this machine+date range.
   * Only published or locked plans count.
   */
  async validateShiftPlanExists(
    tenantId: number,
    machineId: number,
    startDate: string,
    endDate: string,
  ): Promise<boolean> {
    return await this.hasShiftPlan(tenantId, machineId, startDate, endDate);
  }

  /**
   * Get combined team member availability for all teams assigned to a machine.
   * Resolves machine → machine_teams → team members → individual availability.
   */
  async getMachineTeamAvailability(
    tenantId: number,
    machineId: number,
    date: string,
  ): Promise<MachineTeamAvailabilityResult> {
    const machineTeams = await this.fetchMachineTeams(tenantId, machineId);

    if (machineTeams.length === 0) {
      return {
        machineId,
        date,
        teams: [],
        members: [],
        availableCount: 0,
        totalCount: 0,
      };
    }

    const teams = machineTeams.map((t: MachineTeamRow) => ({
      teamId: t.team_id,
      teamName: t.team_name,
    }));

    const teamResults = await Promise.all(
      machineTeams.map((t: MachineTeamRow) =>
        this.getTeamAvailability(tenantId, t.team_id, date),
      ),
    );

    // Merge members across teams, dedupe by userId
    const members = dedupeTeamMembers(teamResults);
    const availableCount = members.filter(
      (m: TeamMemberStatus) => m.isAvailable,
    ).length;

    return {
      machineId,
      date,
      teams,
      members,
      availableCount,
      totalCount: members.length,
    };
  }

  // ============================================================================
  // PRIVATE DATA SOURCE QUERIES
  // ============================================================================

  /**
   * Data source 1: Check if ANY shift coverage exists for machine + date range.
   * Checks all 3 sources (see ADR-011):
   *   1. shift_plans — manual plans (direct machine_id OR via team_id)
   *   2. shift_rotation_patterns — rotation-based (via team_id → machine_teams)
   *   3. shifts — individual shifts without plan (direct machine_id OR via team_id)
   */
  private async hasShiftPlan(
    tenantId: number,
    machineId: number,
    startDate: string,
    endDate: string,
  ): Promise<boolean> {
    const row = await this.db.queryOne<ShiftPlanCountRow>(
      `WITH mt AS (
         SELECT team_id FROM machine_teams
         WHERE machine_id = $1 AND tenant_id = $2
       )
       SELECT CASE WHEN (
         EXISTS (
           SELECT 1 FROM shift_plans
           WHERE tenant_id = $2
             AND (machine_id = $1 OR team_id IN (SELECT team_id FROM mt))
             AND start_date <= $4::date AND end_date >= $3::date
             AND status IN ('published', 'locked')
         ) OR EXISTS (
           SELECT 1 FROM shift_rotation_patterns
           WHERE tenant_id = $2
             AND team_id IN (SELECT team_id FROM mt)
             AND starts_at <= $4::date AND ends_at >= $3::date
             AND is_active = 1
         ) OR EXISTS (
           SELECT 1 FROM shifts
           WHERE tenant_id = $2
             AND (machine_id = $1 OR team_id IN (SELECT team_id FROM mt))
             AND date BETWEEN $3::date AND $4::date
         )
       ) THEN 1 ELSE 0 END AS count`,
      [machineId, tenantId, startDate, endDate],
    );
    return Number.parseInt(row?.count ?? '0', 10) > 0;
  }

  /** Data source 2: Fetch machine downtime entries overlapping the range */
  private async fetchMachineDowntimes(
    tenantId: number,
    machineId: number,
    startDate: string,
    endDate: string,
  ): Promise<MachineDowntimeRow[]> {
    return await this.db.query<MachineDowntimeRow>(
      `SELECT status, start_date::text, end_date::text, reason
       FROM machine_availability
       WHERE machine_id = $1
         AND tenant_id = $2
         AND start_date <= $4::date
         AND end_date >= $3::date
         AND status != 'operational'
       ORDER BY start_date ASC`,
      [machineId, tenantId, startDate, endDate],
    );
  }

  /** Data source 3: Fetch existing TPM cards with due dates in the range */
  private async fetchExistingTpmDueDates(
    tenantId: number,
    machineId: number,
    startDate: string,
    endDate: string,
  ): Promise<TpmDueDateRow[]> {
    return await this.db.query<TpmDueDateRow>(
      `SELECT current_due_date::text, card_code, title
       FROM tpm_cards
       WHERE machine_id = $1
         AND tenant_id = $2
         AND current_due_date BETWEEN $3::date AND $4::date
         AND status IN ('red', 'overdue')
         AND is_active = 1
       ORDER BY current_due_date ASC`,
      [machineId, tenantId, startDate, endDate],
    );
  }

  /** Data source 4: Fetch team members for a given team */
  private async fetchTeamMembers(
    tenantId: number,
    teamId: number,
  ): Promise<TeamMemberRow[]> {
    return await this.db.query<TeamMemberRow>(
      `SELECT ut.user_id, u.username
       FROM user_teams ut
       JOIN users u ON ut.user_id = u.id AND u.tenant_id = ut.tenant_id
       WHERE ut.team_id = $1
         AND ut.tenant_id = $2
         AND u.is_active = 1
       ORDER BY u.username ASC`,
      [teamId, tenantId],
    );
  }

  /** Fetch user unavailability entries covering a specific date */
  private async fetchUserUnavailability(
    tenantId: number,
    userIds: number[],
    date: string,
  ): Promise<Map<number, UserAvailabilityRow>> {
    if (userIds.length === 0) return new Map();

    const { placeholders } = this.db.generateInPlaceholders(userIds.length, 3);

    const rows = await this.db.query<UserAvailabilityRow>(
      `SELECT user_id, status, start_date::text, end_date::text
       FROM user_availability
       WHERE tenant_id = $1
         AND user_id IN (${placeholders})
         AND start_date <= $2::date
         AND end_date >= $2::date
         AND status != 'available'
       ORDER BY user_id`,
      [tenantId, date, ...userIds],
    );

    const result = new Map<number, UserAvailabilityRow>();
    for (const row of rows) {
      if (!result.has(row.user_id)) {
        result.set(row.user_id, row);
      }
    }
    return result;
  }

  /** Data source 5: Fetch teams assigned to a machine via machine_teams */
  private async fetchMachineTeams(
    tenantId: number,
    machineId: number,
  ): Promise<MachineTeamRow[]> {
    return await this.db.query<MachineTeamRow>(
      `SELECT mt.team_id, t.name AS team_name
       FROM machine_teams mt
       JOIN teams t ON mt.team_id = t.id AND t.tenant_id = mt.tenant_id
       WHERE mt.machine_id = $1
         AND mt.tenant_id = $2
       ORDER BY mt.is_primary DESC, t.name ASC`,
      [machineId, tenantId],
    );
  }
}

// ============================================================================
// PURE HELPER FUNCTIONS
// ============================================================================

/** Generate an array of ISO date strings for each day in the range (inclusive) */
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  current.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Build a Map<dateString, downtimeRow> for quick per-day lookup.
 * A downtime entry spans multiple days — expand it to cover each day.
 */
function buildDateOverlapSet(
  downtimes: MachineDowntimeRow[],
  days: string[],
): Map<string, MachineDowntimeRow> {
  const daySet = new Set(days);
  const result = new Map<string, MachineDowntimeRow>();

  for (const dt of downtimes) {
    const dtStart = new Date(dt.start_date);
    const dtEnd = new Date(dt.end_date);
    dtStart.setHours(0, 0, 0, 0);
    dtEnd.setHours(0, 0, 0, 0);

    const cursor = new Date(dtStart);
    while (cursor <= dtEnd) {
      const dateStr = cursor.toISOString().slice(0, 10);
      if (daySet.has(dateStr) && !result.has(dateStr)) {
        result.set(dateStr, dt);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return result;
}

/** Merge team members across multiple teams, deduplicate by userId */
function dedupeTeamMembers(
  teamResults: TeamAvailabilityResult[],
): TeamMemberStatus[] {
  const seen = new Set<number>();
  const members: TeamMemberStatus[] = [];
  for (const result of teamResults) {
    for (const member of result.members) {
      if (!seen.has(member.userId)) {
        seen.add(member.userId);
        members.push(member);
      }
    }
  }
  return members;
}

/** Build conflicts for a single day from pre-fetched data sources */
function buildDayConflicts(
  date: string,
  shiftPlanExists: boolean,
  downtimeSet: Map<string, MachineDowntimeRow>,
  tpmDueDates: TpmDueDateRow[],
  tpmDateSet: Set<string>,
): DayAvailability {
  const conflicts: SlotConflict[] = [];

  if (!shiftPlanExists) {
    conflicts.push({
      type: 'no_shift_plan',
      description: 'Kein Schichtplan für diesen Zeitraum (E15)',
    });
  }

  const downtime = downtimeSet.get(date);
  if (downtime !== undefined) {
    conflicts.push({
      type: 'machine_downtime',
      description: `Maschine ${downtime.status}${downtime.reason !== null ? `: ${downtime.reason}` : ''}`,
    });
  }

  if (tpmDateSet.has(date)) {
    for (const card of tpmDueDates) {
      if (card.current_due_date === date) {
        conflicts.push({
          type: 'existing_tpm',
          description: `TPM-Karte ${card.card_code} fällig: ${card.title}`,
        });
      }
    }
  }

  return { date, isAvailable: conflicts.length === 0, conflicts };
}

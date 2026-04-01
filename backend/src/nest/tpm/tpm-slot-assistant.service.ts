/**
 * TPM Slot Availability Assistant
 *
 * Combines 3 data sources to determine when a asset is available
 * for maintenance scheduling:
 *   1. tpm_cards — already scheduled TPM due dates
 *   2. user_availability — team member vacation/sick status
 *   3. tpm_schedule — projected schedules from other plans (cross-plan conflicts)
 *
 * All methods are read-only. Uses DatabaseService directly to avoid
 * cross-module coupling (no ShiftsModule/AssetsModule/UsersModule imports).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { TpmScheduleProjectionService } from './tpm-schedule-projection.service.js';
import type { ProjectedSlot } from './tpm.types.js';

// ============================================================================
// Exported Types
// ============================================================================

/** Types of scheduling conflicts */
export type SlotConflictType = 'existing_tpm' | 'tpm_schedule';

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
  assetId: number;
  startDate: string;
  endDate: string;
  days: DayAvailability[];
  availableDays: number;
  totalDays: number;
}

/** Result of checkSlotAvailability() */
export interface SlotCheckResult {
  isAvailable: boolean;
  conflicts: SlotConflict[];
}

/** Single team member's availability */
export interface TeamMemberStatus {
  userId: number;
  userName: string;
  firstName: string | null;
  lastName: string | null;
  profilePicture: string | null;
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

/** Team info for asset_teams lookup */
export interface AssetTeamInfo {
  teamId: number;
  teamName: string;
}

/** Result of getAssetTeamAvailability() — all teams for a asset */
export interface AssetTeamAvailabilityResult {
  assetId: number;
  date: string;
  teams: AssetTeamInfo[];
  members: TeamMemberStatus[];
  availableCount: number;
  totalCount: number;
}

// ============================================================================
// Internal DB Row Types
// ============================================================================

interface TpmDueDateRow {
  current_due_date: string;
  card_code: string;
  title: string;
}

interface TeamMemberRow {
  user_id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
}

interface UserAvailabilityRow {
  user_id: number;
  status: string;
  start_date: string;
  end_date: string;
}

interface AssetTeamRow {
  team_id: number;
  team_name: string;
}

/** Max days allowed in a single range query */
const MAX_RANGE_DAYS = 90;

@Injectable()
export class TpmSlotAssistantService {
  private readonly logger = new Logger(TpmSlotAssistantService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly scheduleProjection: TpmScheduleProjectionService,
  ) {}

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Get per-day availability for a asset over a date range.
   * Combines existing TPM slots and projected schedules.
   */
  async getAvailableSlots(
    tenantId: number,
    assetId: number,
    startDate: string,
    endDate: string,
  ): Promise<SlotAvailabilityResult> {
    const days = generateDateRange(startDate, endDate);
    if (days.length > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Maximaler Zeitraum: ${MAX_RANGE_DAYS} Tage (angefragt: ${days.length})`,
      );
    }

    // Batch-fetch data sources for the full range
    const [tpmDueDates, projection] = await Promise.all([
      this.fetchExistingTpmDueDates(tenantId, assetId, startDate, endDate),
      this.scheduleProjection.projectSchedules(tenantId, startDate, endDate),
    ]);

    // Build per-day conflict map
    const tpmDateSet = new Set(tpmDueDates.map((r: TpmDueDateRow) => r.current_due_date));

    // Build projected schedule map (exclude current asset — no self-conflict)
    const scheduleMap = buildScheduleMap(projection.slots, assetId);

    this.logger.debug(
      `Slot-Abfrage: Anlage ${assetId}, ${startDate} bis ${endDate} (${days.length} Tage)`,
    );

    const dayResults = days.map((date: string) =>
      buildDayConflicts(date, tpmDueDates, tpmDateSet, scheduleMap),
    );
    const availableDays = dayResults.filter((d: DayAvailability) => d.isAvailable).length;

    return {
      assetId,
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
    assetId: number,
    date: string,
  ): Promise<SlotCheckResult> {
    const tpmDueDates = await this.fetchExistingTpmDueDates(tenantId, assetId, date, date);

    const conflicts: SlotConflict[] = [];

    for (const card of tpmDueDates) {
      conflicts.push({
        type: 'existing_tpm',
        description: `TPM-Karte ${card.card_code} fällig: ${card.title}`,
      });
    }

    return {
      isAvailable: conflicts.length === 0,
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
    const unavailabilityMap = await this.fetchUserUnavailability(tenantId, userIds, date);

    const members: TeamMemberStatus[] = teamMembers.map((member: TeamMemberRow) => {
      const unavailability = unavailabilityMap.get(member.user_id);
      const fullName =
        member.first_name !== null && member.last_name !== null ?
          `${member.first_name} ${member.last_name}`
        : member.username;
      return {
        userId: member.user_id,
        userName: fullName,
        firstName: member.first_name,
        lastName: member.last_name,
        profilePicture: member.profile_picture,
        isAvailable: unavailability === undefined,
        unavailabilityReason: unavailability?.status ?? null,
      };
    });

    const availableCount = members.filter((m: TeamMemberStatus) => m.isAvailable).length;

    return {
      teamId,
      date,
      members,
      availableCount,
      totalCount: members.length,
    };
  }

  /**
   * Get combined team member availability for all teams assigned to a asset.
   * Resolves asset → asset_teams → team members → individual availability.
   */
  async getAssetTeamAvailability(
    tenantId: number,
    assetId: number,
    date: string,
  ): Promise<AssetTeamAvailabilityResult> {
    const assetTeams = await this.fetchAssetTeams(tenantId, assetId);

    if (assetTeams.length === 0) {
      return {
        assetId,
        date,
        teams: [],
        members: [],
        availableCount: 0,
        totalCount: 0,
      };
    }

    const teams = assetTeams.map((t: AssetTeamRow) => ({
      teamId: t.team_id,
      teamName: t.team_name,
    }));

    const teamResults = await Promise.all(
      assetTeams.map((t: AssetTeamRow) => this.getTeamAvailability(tenantId, t.team_id, date)),
    );

    // Merge members across teams, dedupe by userId
    const members = dedupeTeamMembers(teamResults);
    const availableCount = members.filter((m: TeamMemberStatus) => m.isAvailable).length;

    return {
      assetId,
      date,
      teams,
      members,
      availableCount,
      totalCount: members.length,
    };
  }

  /**
   * Resolve asset UUID to numeric ID (D11: direct DB query, no AssetsModule import).
   * Used by the create-mode endpoint where no plan UUID exists yet.
   */
  async resolveAssetIdByUuid(tenantId: number, assetUuid: string): Promise<number> {
    const row = await this.db.queryOne<{ id: number }>(
      `SELECT id FROM assets
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [assetUuid, tenantId],
    );
    if (row === null) {
      throw new NotFoundException(`Anlage ${assetUuid} nicht gefunden`);
    }
    return row.id;
  }

  // ============================================================================
  // PRIVATE DATA SOURCE QUERIES
  // ============================================================================

  /** Fetch existing TPM cards with due dates in the range */
  private async fetchExistingTpmDueDates(
    tenantId: number,
    assetId: number,
    startDate: string,
    endDate: string,
  ): Promise<TpmDueDateRow[]> {
    return await this.db.query<TpmDueDateRow>(
      `SELECT current_due_date::text, card_code, title
       FROM tpm_cards
       WHERE asset_id = $1
         AND tenant_id = $2
         AND current_due_date BETWEEN $3::date AND $4::date
         AND status IN ('red', 'overdue')
         AND interval_type NOT IN ('daily', 'weekly')
         AND is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY current_due_date ASC`,
      [assetId, tenantId, startDate, endDate],
    );
  }

  /** Data source 3: Fetch team members for a given team */
  private async fetchTeamMembers(tenantId: number, teamId: number): Promise<TeamMemberRow[]> {
    return await this.db.query<TeamMemberRow>(
      `SELECT ut.user_id, u.username, u.first_name, u.last_name, u.profile_picture
       FROM user_teams ut
       JOIN users u ON ut.user_id = u.id AND u.tenant_id = ut.tenant_id
       WHERE ut.team_id = $1
         AND ut.tenant_id = $2
         AND u.is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY u.last_name ASC, u.first_name ASC`,
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

  /** Data source 4: Fetch teams assigned to a asset via asset_teams */
  private async fetchAssetTeams(tenantId: number, assetId: number): Promise<AssetTeamRow[]> {
    return await this.db.query<AssetTeamRow>(
      `SELECT mt.team_id, t.name AS team_name
       FROM asset_teams mt
       JOIN teams t ON mt.team_id = t.id AND t.tenant_id = mt.tenant_id
       WHERE mt.asset_id = $1
         AND mt.tenant_id = $2
       ORDER BY mt.is_primary DESC, t.name ASC`,
      [assetId, tenantId],
    );
  }
}

// ============================================================================
// PURE HELPER FUNCTIONS
// ============================================================================

/** Generate an array of ISO date strings for each day in the range (inclusive) */
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/** Merge team members across multiple teams, deduplicate by userId */
function dedupeTeamMembers(teamResults: TeamAvailabilityResult[]): TeamMemberStatus[] {
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
  tpmDueDates: TpmDueDateRow[],
  tpmDateSet: Set<string>,
  scheduleMap: Map<string, ProjectedSlot[]> = new Map<string, ProjectedSlot[]>(),
): DayAvailability {
  const conflicts: SlotConflict[] = [];

  collectTpmDueDateConflicts(conflicts, date, tpmDueDates, tpmDateSet);
  collectScheduleConflicts(conflicts, scheduleMap.get(date));

  return { date, isAvailable: conflicts.length === 0, conflicts };
}

/** Append existing TPM due date conflicts for this date */
function collectTpmDueDateConflicts(
  conflicts: SlotConflict[],
  date: string,
  tpmDueDates: TpmDueDateRow[],
  tpmDateSet: Set<string>,
): void {
  if (!tpmDateSet.has(date)) return;

  for (const card of tpmDueDates) {
    if (card.current_due_date === date) {
      conflicts.push({
        type: 'existing_tpm',
        description: `TPM-Karte ${card.card_code} fällig: ${card.title}`,
      });
    }
  }
}

/** Append projected schedule conflicts for this date */
function collectScheduleConflicts(
  conflicts: SlotConflict[],
  scheduledSlots: ProjectedSlot[] | undefined,
): void {
  if (scheduledSlots === undefined) return;

  for (const slot of scheduledSlots) {
    const intervals = slot.intervalTypes.join(', ');
    const timeRange =
      slot.startTime !== null && slot.endTime !== null ?
        `${slot.startTime}–${slot.endTime}`
      : 'Ganztägig';

    conflicts.push({
      type: 'tpm_schedule',
      description: `TPM Plan '${slot.planName}' (${slot.assetName}, ${intervals}): ${timeRange}`,
    });
  }
}

/**
 * Build a Map<date, ProjectedSlot[]> from projected slots, excluding a specific asset.
 * Excludes the current asset to avoid self-conflict (this asset's own plan).
 */
function buildScheduleMap(
  slots: ProjectedSlot[],
  excludeAssetId: number,
): Map<string, ProjectedSlot[]> {
  const map = new Map<string, ProjectedSlot[]>();

  for (const slot of slots) {
    if (slot.assetId === excludeAssetId) continue;

    const existing = map.get(slot.date);
    if (existing === undefined) {
      map.set(slot.date, [slot]);
    } else {
      existing.push(slot);
    }
  }

  return map;
}

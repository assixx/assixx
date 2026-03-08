/**
 * Vacation Capacity Service
 *
 * THE HEART OF THE SYSTEM.
 *
 * Answers the question: "Can this employee take vacation on these dates?"
 * by analyzing team staffing, asset coverage, blackout conflicts,
 * and entitlement balance.
 *
 * Single public method: `analyzeCapacity()`
 *
 * Algorithm:
 * 1. Find requester's team via `user_teams`
 * 2. Find all assets for that team via `asset_teams`
 * 3. For each workday: count absent members, compute available staff
 * 4. Return worst-case day per team and per asset
 * 5. Check blackout conflicts
 * 6. Check entitlement balance
 * 7. Determine overall status (ok / warning / blocked)
 *
 * Dependencies: holidays, entitlements, blackouts, staffing rules
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../database/database.service.js';
import { VacationBlackoutsService } from './vacation-blackouts.service.js';
import { VacationEntitlementsService } from './vacation-entitlements.service.js';
import { VacationHolidaysService } from './vacation-holidays.service.js';
import { VacationStaffingRulesService } from './vacation-staffing-rules.service.js';
import type {
  AbsentMemberInfo,
  AssetCapacityItem,
  BlackoutConflict,
  CapacityStatus,
  EntitlementCheckResult,
  OverallCapacityStatus,
  SubstituteCheckResult,
  TeamCapacityItem,
  VacationCapacityAnalysis,
  VacationHalfDay,
} from './vacation.types.js';

// ============================================================================
// Internal types for DB queries
// ============================================================================

/** Team member from user_teams + users JOIN */
interface TeamMemberRow {
  user_id: number;
  first_name: string;
  last_name: string;
}

/** Asset assigned to a team from asset_teams + assets JOIN */
interface TeamAssetRow {
  asset_id: number;
  asset_name: string;
}

/** Approved vacation request overlapping the analysis range */
interface ApprovedAbsenceRow {
  requester_id: number;
  start_date: string;
  end_date: string;
  half_day_start: VacationHalfDay;
  half_day_end: VacationHalfDay;
}

/** User availability record overlapping the analysis range */
interface AvailabilityAbsenceRow {
  user_id: number;
  start_date: string;
  end_date: string;
}

/** Substitute overlap check result */
interface SubstituteConflictRow {
  start_date: string;
  end_date: string;
}

/** Gathered context for capacity analysis */
interface CapacityContext {
  teamId: number;
  teamName: string;
  departmentId: number | null;
  members: TeamMemberRow[];
  assets: TeamAssetRow[];
  approvedAbsences: ApprovedAbsenceRow[];
  availabilityAbsences: AvailabilityAbsenceRow[];
}

/** Per-day snapshot for worst-case tracking */
interface DaySnapshot {
  totalMembers: number;
  absentMemberIds: Set<number>;
  availableCount: number;
}

/** Parameters for the analyzeCapacity method */
export interface CapacityAnalysisParams {
  tenantId: number;
  startDate: string;
  endDate: string;
  requesterId: number;
  halfDayStart?: VacationHalfDay;
  halfDayEnd?: VacationHalfDay;
  substituteId?: number;
}

@Injectable()
export class VacationCapacityService {
  private readonly logger: Logger = new Logger(VacationCapacityService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly holidaysService: VacationHolidaysService,
    private readonly entitlementsService: VacationEntitlementsService,
    private readonly blackoutsService: VacationBlackoutsService,
    private readonly staffingRulesService: VacationStaffingRulesService,
  ) {}

  /**
   * Analyze whether a vacation request can be approved.
   * Returns a comprehensive analysis covering team, assets,
   * blackouts, entitlements, and substitute availability.
   */
  async analyzeCapacity(
    params: CapacityAnalysisParams,
  ): Promise<VacationCapacityAnalysis> {
    const { tenantId, startDate, endDate, requesterId } = params;

    // Phase 1: Gather team context (single transaction)
    const ctx: CapacityContext = await this.gatherTeamContext(
      tenantId,
      requesterId,
      startDate,
      endDate,
    );

    // Phase 2: Parallel sub-service queries + per-day computation
    const subServiceData = await this.runSubServiceQueries(params, ctx);

    // Phase 3: Per-day capacity computation
    const { teamAnalysis, assetAnalysis } = await this.runCapacityComputation(
      tenantId,
      startDate,
      endDate,
      requesterId,
      ctx,
      subServiceData.staffingMap,
    );

    // Phase 4-6: Checks + final assembly
    return await this.assembleResult(
      params,
      subServiceData,
      teamAnalysis,
      assetAnalysis,
    );
  }

  /** Run parallel sub-service queries (workdays, blackouts, staffing). */
  private async runSubServiceQueries(
    params: CapacityAnalysisParams,
    ctx: CapacityContext,
  ): Promise<{
    workdays: number;
    blackoutConflicts: BlackoutConflict[];
    staffingMap: Map<number, number>;
  }> {
    const {
      tenantId,
      startDate,
      endDate,
      halfDayStart = 'none',
      halfDayEnd = 'none',
    } = params;

    const assetIds: number[] = ctx.assets.map((m: TeamAssetRow) => m.asset_id);

    const [workdays, blackoutConflicts, staffingMap] = await Promise.all([
      this.holidaysService.countWorkdays(
        tenantId,
        startDate,
        endDate,
        halfDayStart,
        halfDayEnd,
      ),
      this.blackoutsService.getConflicts(
        tenantId,
        startDate,
        endDate,
        ctx.teamId,
        ctx.departmentId ?? undefined,
      ),
      this.staffingRulesService.getForAssets(tenantId, assetIds),
    ]);

    return { workdays, blackoutConflicts, staffingMap };
  }

  /** Run per-day capacity computation for team and assets. */
  private async runCapacityComputation(
    tenantId: number,
    startDate: string,
    endDate: string,
    requesterId: number,
    ctx: CapacityContext,
    staffingMap: Map<number, number>,
  ): Promise<{
    teamAnalysis: TeamCapacityItem[];
    assetAnalysis: AssetCapacityItem[];
  }> {
    const workdayDates: Date[] = await this.getWorkdayDates(
      tenantId,
      startDate,
      endDate,
    );

    return {
      teamAnalysis: this.computeTeamCapacity(ctx, workdayDates, requesterId),
      assetAnalysis: this.computeAssetCapacity(
        ctx,
        workdayDates,
        requesterId,
        staffingMap,
      ),
    };
  }

  /** Assemble final result with entitlement check, substitute, and overall status. */
  private async assembleResult(
    params: CapacityAnalysisParams,
    subServiceData: {
      workdays: number;
      blackoutConflicts: BlackoutConflict[];
    },
    teamAnalysis: TeamCapacityItem[],
    assetAnalysis: AssetCapacityItem[],
  ): Promise<VacationCapacityAnalysis> {
    const { tenantId, startDate, endDate, requesterId } = params;
    const { workdays, blackoutConflicts } = subServiceData;

    const entitlementCheck: EntitlementCheckResult =
      await this.checkEntitlement(tenantId, requesterId, workdays);

    const substituteCheck: SubstituteCheckResult | undefined =
      params.substituteId !== undefined ?
        await this.checkSubstitute(
          tenantId,
          params.substituteId,
          startDate,
          endDate,
        )
      : undefined;

    const overallStatus: OverallCapacityStatus = this.determineOverallStatus(
      assetAnalysis,
      blackoutConflicts,
      entitlementCheck,
    );

    this.logger.log(
      `Capacity analyzed: requester=${requesterId} ${startDate}–${endDate} → ${overallStatus}`,
    );

    const result: VacationCapacityAnalysis = {
      workdays,
      teamAnalysis,
      assetAnalysis,
      blackoutConflicts,
      entitlementCheck,
      overallStatus,
    };

    if (substituteCheck !== undefined) {
      result.substituteCheck = substituteCheck;
    }

    return result;
  }

  // ==========================================================================
  // Phase 1: Gather team context
  // ==========================================================================

  /**
   * Load requester's team, all team members, assigned assets,
   * and absence data in a single transaction.
   */
  private async gatherTeamContext(
    tenantId: number,
    requesterId: number,
    startDate: string,
    endDate: string,
  ): Promise<CapacityContext> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<CapacityContext> => {
        // 1. Find requester's team
        const teamRow:
          | {
              team_id: number;
              team_name: string;
              department_id: number | null;
            }
          | undefined = await this.findRequesterTeam(
          client,
          tenantId,
          requesterId,
        );

        if (teamRow === undefined) {
          throw new BadRequestException(
            'Requester is not assigned to any team',
          );
        }

        // 2-5. Parallel queries within the same transaction
        const [members, assets, approvedAbsences, availabilityAbsences] =
          await Promise.all([
            this.loadTeamMembers(client, tenantId, teamRow.team_id),
            this.loadTeamAssets(client, tenantId, teamRow.team_id),
            this.loadApprovedAbsences(
              client,
              tenantId,
              teamRow.team_id,
              startDate,
              endDate,
            ),
            this.loadAvailabilityAbsences(
              client,
              tenantId,
              teamRow.team_id,
              startDate,
              endDate,
            ),
          ]);

        return {
          teamId: teamRow.team_id,
          teamName: teamRow.team_name,
          departmentId: teamRow.department_id,
          members,
          assets,
          approvedAbsences,
          availabilityAbsences,
        };
      },
    );
  }

  /** Find the requester's team via user_teams. */
  private async findRequesterTeam(
    client: PoolClient,
    tenantId: number,
    requesterId: number,
  ): Promise<
    | { team_id: number; team_name: string; department_id: number | null }
    | undefined
  > {
    const result = await client.query<{
      team_id: number;
      team_name: string;
      department_id: number | null;
    }>(
      `SELECT ut.team_id, t.name AS team_name, t.department_id
       FROM user_teams ut
       JOIN teams t ON ut.team_id = t.id
       WHERE ut.user_id = $1 AND ut.tenant_id = $2 AND t.is_active = ${IS_ACTIVE.ACTIVE}`,
      [requesterId, tenantId],
    );

    return result.rows[0];
  }

  /** Load all active members of a team. */
  private async loadTeamMembers(
    client: PoolClient,
    tenantId: number,
    teamId: number,
  ): Promise<TeamMemberRow[]> {
    const result = await client.query<TeamMemberRow>(
      `SELECT u.id AS user_id, u.first_name, u.last_name
       FROM user_teams ut
       JOIN users u ON ut.user_id = u.id
       WHERE ut.team_id = $1 AND ut.tenant_id = $2 AND u.is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY u.last_name, u.first_name`,
      [teamId, tenantId],
    );

    return result.rows;
  }

  /** Load all assets assigned to a team via asset_teams. */
  private async loadTeamAssets(
    client: PoolClient,
    tenantId: number,
    teamId: number,
  ): Promise<TeamAssetRow[]> {
    const result = await client.query<TeamAssetRow>(
      `SELECT m.id AS asset_id, m.name AS asset_name
       FROM asset_teams mt
       JOIN assets m ON mt.asset_id = m.id
       WHERE mt.team_id = $1 AND mt.tenant_id = $2 AND m.is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY m.name`,
      [teamId, tenantId],
    );

    return result.rows;
  }

  /** Load all approved vacation requests for team members overlapping the date range. */
  private async loadApprovedAbsences(
    client: PoolClient,
    tenantId: number,
    teamId: number,
    startDate: string,
    endDate: string,
  ): Promise<ApprovedAbsenceRow[]> {
    const result = await client.query<ApprovedAbsenceRow>(
      `SELECT vr.requester_id, vr.start_date, vr.end_date,
              vr.half_day_start, vr.half_day_end
       FROM vacation_requests vr
       JOIN user_teams ut ON vr.requester_id = ut.user_id AND ut.tenant_id = $1
       WHERE vr.tenant_id = $1
         AND ut.team_id = $2
         AND vr.status = 'approved'
         AND vr.is_active = ${IS_ACTIVE.ACTIVE}
         AND vr.start_date <= $4
         AND vr.end_date >= $3`,
      [tenantId, teamId, startDate, endDate],
    );

    return result.rows;
  }

  /** Load user_availability records where status != 'available' for team members. */
  private async loadAvailabilityAbsences(
    client: PoolClient,
    tenantId: number,
    teamId: number,
    startDate: string,
    endDate: string,
  ): Promise<AvailabilityAbsenceRow[]> {
    const result = await client.query<AvailabilityAbsenceRow>(
      `SELECT ua.user_id, ua.start_date, ua.end_date
       FROM user_availability ua
       JOIN user_teams ut ON ua.user_id = ut.user_id AND ut.tenant_id = $1
       WHERE ua.tenant_id = $1
         AND ut.team_id = $2
         AND ua.status != 'available'
         AND ua.start_date <= $4
         AND ua.end_date >= $3`,
      [tenantId, teamId, startDate, endDate],
    );

    return result.rows;
  }

  // ==========================================================================
  // Phase 2: Workday enumeration
  // ==========================================================================

  /** Get the list of actual workday Dates (excluding weekends + holidays). */
  private async getWorkdayDates(
    tenantId: number,
    startDate: string,
    endDate: string,
  ): Promise<Date[]> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<Date[]> => {
        const start: Date = new Date(startDate);
        const end: Date = new Date(endDate);

        // Load holiday set for O(1) lookup
        const holidayResult = await client.query<{
          holiday_date: string;
          recurring: boolean;
        }>(
          `SELECT holiday_date, recurring
           FROM vacation_holidays
           WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE}
             AND (
               (recurring = false AND holiday_date >= $2 AND holiday_date <= $3)
               OR recurring = true
             )`,
          [tenantId, startDate, endDate],
        );

        const holidaySet: Set<string> = new Set<string>();
        for (const row of holidayResult.rows) {
          if (row.recurring) {
            this.projectRecurringHoliday(
              row.holiday_date,
              start,
              end,
              holidaySet,
            );
          } else {
            holidaySet.add(this.formatDate(new Date(row.holiday_date)));
          }
        }

        const workdays: Date[] = [];
        const current: Date = new Date(start);
        while (current <= end) {
          const dayOfWeek: number = current.getDay();
          const isWeekend: boolean = dayOfWeek === 0 || dayOfWeek === 6;
          if (!isWeekend && !holidaySet.has(this.formatDate(current))) {
            workdays.push(new Date(current));
          }
          current.setDate(current.getDate() + 1);
        }

        return workdays;
      },
    );
  }

  // ==========================================================================
  // Phase 3: Capacity computation
  // ==========================================================================

  /** Compute worst-case team capacity across all workdays. */
  private computeTeamCapacity(
    ctx: CapacityContext,
    workdayDates: Date[],
    requesterId: number,
  ): TeamCapacityItem[] {
    if (workdayDates.length === 0) {
      return [];
    }

    let worstAbsent: number = 0;

    for (const day of workdayDates) {
      const snapshot: DaySnapshot = this.computeDaySnapshot(
        ctx,
        day,
        requesterId,
      );
      if (snapshot.absentMemberIds.size > worstAbsent) {
        worstAbsent = snapshot.absentMemberIds.size;
      }
    }

    const totalMembers: number = ctx.members.length;
    const availableAfterApproval: number = totalMembers - worstAbsent - 1;

    return [
      {
        teamId: ctx.teamId,
        teamName: ctx.teamName,
        totalMembers,
        absentMembers: worstAbsent,
        availableAfterApproval: Math.max(0, availableAfterApproval),
        status: this.computeTeamStatus(totalMembers, availableAfterApproval),
      },
    ];
  }

  /** Compute worst-case asset capacity across all workdays. */
  private computeAssetCapacity(
    ctx: CapacityContext,
    workdayDates: Date[],
    requesterId: number,
    staffingMap: Map<number, number>,
  ): AssetCapacityItem[] {
    if (workdayDates.length === 0 || ctx.assets.length === 0) {
      return [];
    }

    return ctx.assets
      .filter((m: TeamAssetRow) => staffingMap.has(m.asset_id))
      .map((asset: TeamAssetRow) =>
        this.computeSingleAssetCapacity(
          ctx,
          workdayDates,
          requesterId,
          asset,
          staffingMap.get(asset.asset_id) ?? 1,
        ),
      );
  }

  /** Compute worst-case capacity for a single asset. */
  private computeSingleAssetCapacity(
    ctx: CapacityContext,
    workdayDates: Date[],
    requesterId: number,
    asset: TeamAssetRow,
    minStaff: number,
  ): AssetCapacityItem {
    let worstAvailable: number = ctx.members.length;
    let worstAvailableAfter: number = ctx.members.length;
    const absentUserIds: Set<number> = new Set<number>();

    for (const day of workdayDates) {
      const snapshot: DaySnapshot = this.computeDaySnapshot(
        ctx,
        day,
        requesterId,
      );
      const currentAvailable: number = snapshot.availableCount;
      const afterApproval: number = currentAvailable - 1;

      if (afterApproval < worstAvailableAfter) {
        worstAvailable = currentAvailable;
        worstAvailableAfter = afterApproval;
        for (const uid of snapshot.absentMemberIds) {
          absentUserIds.add(uid);
        }
      }
    }

    const absentMembers: AbsentMemberInfo[] = this.buildAbsentMemberInfo(
      ctx,
      absentUserIds,
    );

    const availableAfterApproval: number = Math.max(0, worstAvailableAfter);

    return {
      assetId: asset.asset_id,
      assetName: asset.asset_name,
      minStaffRequired: minStaff,
      currentlyAvailable: Math.max(0, worstAvailable),
      availableAfterApproval,
      absentMembers,
      status: this.computeAssetStatus(availableAfterApproval, minStaff),
    };
  }

  /**
   * Compute a day-level snapshot: who is absent and how many are available.
   * Checks both approved vacation requests and user_availability records.
   */
  private computeDaySnapshot(
    ctx: CapacityContext,
    day: Date,
    requesterId: number,
  ): DaySnapshot {
    const dayStr: string = this.formatDate(day);
    const memberIds: Set<number> = new Set<number>(
      ctx.members.map((m: TeamMemberRow) => m.user_id),
    );

    const absentMemberIds: Set<number> = new Set<number>();
    this.collectAbsentFromVacations(
      ctx,
      dayStr,
      requesterId,
      memberIds,
      absentMemberIds,
    );
    this.collectAbsentFromAvailability(
      ctx,
      dayStr,
      requesterId,
      memberIds,
      absentMemberIds,
    );

    const totalMembers: number = ctx.members.length;
    return {
      totalMembers,
      absentMemberIds,
      availableCount: totalMembers - absentMemberIds.size,
    };
  }

  /** Add team members absent due to approved vacation on a specific day. */
  private collectAbsentFromVacations(
    ctx: CapacityContext,
    dayStr: string,
    requesterId: number,
    memberIds: Set<number>,
    absentMemberIds: Set<number>,
  ): void {
    for (const absence of ctx.approvedAbsences) {
      if (absence.requester_id === requesterId) {
        continue;
      }
      const isOverlapping: boolean = this.dateOverlapsRange(
        dayStr,
        absence.start_date,
        absence.end_date,
      );
      if (isOverlapping && memberIds.has(absence.requester_id)) {
        absentMemberIds.add(absence.requester_id);
      }
    }
  }

  /** Add team members absent due to user_availability records on a specific day. */
  private collectAbsentFromAvailability(
    ctx: CapacityContext,
    dayStr: string,
    requesterId: number,
    memberIds: Set<number>,
    absentMemberIds: Set<number>,
  ): void {
    for (const avail of ctx.availabilityAbsences) {
      if (avail.user_id === requesterId) {
        continue;
      }
      const isOverlapping: boolean = this.dateOverlapsRange(
        dayStr,
        avail.start_date,
        avail.end_date,
      );
      if (isOverlapping && memberIds.has(avail.user_id)) {
        absentMemberIds.add(avail.user_id);
      }
    }
  }

  // ==========================================================================
  // Phase 4: Entitlement check
  // ==========================================================================

  /** Check if requester has enough remaining vacation days. */
  private async checkEntitlement(
    tenantId: number,
    requesterId: number,
    requestedDays: number,
  ): Promise<EntitlementCheckResult> {
    const balance = await this.entitlementsService.getBalance(
      tenantId,
      requesterId,
    );

    const remainingAfterApproval: number =
      balance.remainingDays - requestedDays;

    return {
      sufficient: remainingAfterApproval >= 0,
      availableDays: balance.remainingDays,
      requestedDays,
      remainingAfterApproval,
    };
  }

  // ==========================================================================
  // Phase 5: Substitute check
  // ==========================================================================

  /** Check if the proposed substitute is available during the requested dates. */
  private async checkSubstitute(
    tenantId: number,
    substituteId: number,
    startDate: string,
    endDate: string,
  ): Promise<SubstituteCheckResult> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<SubstituteCheckResult> => {
        // Get substitute name
        const userResult = await client.query<{
          first_name: string;
          last_name: string;
        }>(
          `SELECT first_name, last_name FROM users
           WHERE id = $1 AND is_active = ${IS_ACTIVE.ACTIVE}`,
          [substituteId],
        );

        const userName: string =
          userResult.rows[0] !== undefined ?
            `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`
          : 'Unknown';

        // Check for overlapping approved vacations
        const conflicts = await client.query<SubstituteConflictRow>(
          `SELECT start_date, end_date
           FROM vacation_requests
           WHERE tenant_id = $1
             AND requester_id = $2
             AND status = 'approved'
             AND is_active = ${IS_ACTIVE.ACTIVE}
             AND start_date <= $4
             AND end_date >= $3
           ORDER BY start_date`,
          [tenantId, substituteId, startDate, endDate],
        );

        const base: SubstituteCheckResult = {
          substituteId,
          substituteName: userName,
          available: conflicts.rows.length === 0,
        };

        if (conflicts.rows.length > 0) {
          base.conflictDates = conflicts.rows.map(
            (r: SubstituteConflictRow) =>
              `${this.formatDate(new Date(r.start_date))}–${this.formatDate(new Date(r.end_date))}`,
          );
        }

        return base;
      },
    );
  }

  // ==========================================================================
  // Phase 6: Overall status
  // ==========================================================================

  /** Determine the overall capacity status. */
  private determineOverallStatus(
    assetAnalysis: AssetCapacityItem[],
    blackoutConflicts: BlackoutConflict[],
    entitlementCheck: EntitlementCheckResult,
  ): OverallCapacityStatus {
    // Blocked if: blackout conflict, insufficient entitlement, or critical asset
    if (blackoutConflicts.length > 0) {
      return 'blocked';
    }
    if (!entitlementCheck.sufficient) {
      return 'blocked';
    }
    if (assetAnalysis.some((m: AssetCapacityItem) => m.status === 'critical')) {
      return 'blocked';
    }

    // Warning if: any asset at warning level
    if (assetAnalysis.some((m: AssetCapacityItem) => m.status === 'warning')) {
      return 'warning';
    }

    return 'ok';
  }

  // ==========================================================================
  // Utility helpers
  // ==========================================================================

  /** Check if a single date falls within a date range (inclusive). */
  private dateOverlapsRange(
    dayStr: string,
    rangeStart: string | Date,
    rangeEnd: string | Date,
  ): boolean {
    const start: string =
      typeof rangeStart === 'string' ?
        rangeStart.slice(0, 10)
      : this.formatDate(rangeStart);
    const end: string =
      typeof rangeEnd === 'string' ?
        rangeEnd.slice(0, 10)
      : this.formatDate(rangeEnd);

    return dayStr >= start && dayStr <= end;
  }

  /** Build AbsentMemberInfo array from a set of user IDs. */
  private buildAbsentMemberInfo(
    ctx: CapacityContext,
    absentUserIds: Set<number>,
  ): AbsentMemberInfo[] {
    return ctx.members
      .filter((m: TeamMemberRow) => absentUserIds.has(m.user_id))
      .map((m: TeamMemberRow) => ({
        userId: m.user_id,
        userName: `${m.first_name} ${m.last_name}`,
        dates: this.getAbsenceDatesForUser(ctx, m.user_id),
      }));
  }

  /** Get formatted absence date ranges for a specific user. */
  private getAbsenceDatesForUser(ctx: CapacityContext, userId: number): string {
    const ranges: string[] = [];

    for (const absence of ctx.approvedAbsences) {
      if (absence.requester_id === userId) {
        ranges.push(
          `${this.sliceDate(absence.start_date)}–${this.sliceDate(absence.end_date)}`,
        );
      }
    }

    for (const avail of ctx.availabilityAbsences) {
      if (avail.user_id === userId) {
        ranges.push(
          `${this.sliceDate(avail.start_date)}–${this.sliceDate(avail.end_date)}`,
        );
      }
    }

    return ranges.join(', ');
  }

  /** Compute team capacity status based on available percentage. */
  private computeTeamStatus(
    totalMembers: number,
    availableAfterApproval: number,
  ): CapacityStatus {
    if (totalMembers === 0) {
      return 'ok';
    }
    const ratio: number = availableAfterApproval / totalMembers;
    if (ratio < 0.5) {
      return 'critical';
    }
    if (ratio < 0.7) {
      return 'warning';
    }
    return 'ok';
  }

  /** Compute asset capacity status based on min staff requirement. */
  private computeAssetStatus(
    availableAfterApproval: number,
    minStaffRequired: number,
  ): CapacityStatus {
    if (availableAfterApproval < minStaffRequired) {
      return 'critical';
    }
    if (availableAfterApproval === minStaffRequired) {
      return 'warning';
    }
    return 'ok';
  }

  /** Project a recurring holiday into each year of the range. */
  private projectRecurringHoliday(
    holidayDate: string | Date,
    startDate: Date,
    endDate: Date,
    holidaySet: Set<string>,
  ): void {
    const date: Date = new Date(holidayDate);
    const hMonth: number = date.getMonth();
    const hDay: number = date.getDate();

    for (
      let year: number = startDate.getFullYear();
      year <= endDate.getFullYear();
      year++
    ) {
      const projected: Date = new Date(year, hMonth, hDay);
      if (projected >= startDate && projected <= endDate) {
        holidaySet.add(this.formatDate(projected));
      }
    }
  }

  /** Slice a date string or Date to YYYY-MM-DD. */
  private sliceDate(date: string | Date): string {
    if (typeof date === 'string') {
      return date.slice(0, 10);
    }
    return this.formatDate(date);
  }

  /** Format a Date as YYYY-MM-DD (no timezone issues). */
  private formatDate(date: Date): string {
    const year: number = date.getFullYear();
    const month: string = String(date.getMonth() + 1).padStart(2, '0');
    const day: string = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

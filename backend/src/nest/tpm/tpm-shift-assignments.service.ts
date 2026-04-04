/**
 * TPM Plan Assignments Service
 *
 * Manages direct employee-to-plan-date assignments (tpm_plan_assignments table).
 *
 * Read endpoints:
 *   - getShiftAssignments()     → Gesamtansicht "Zugewiesene Mitarbeiter" row
 *   - getCalendarAssignments()  → Calendar page TPM entries
 *   - getAssignmentsForPlan()   → Plan-specific assignment list
 *
 * Write endpoints:
 *   - setAssignments()          → Replace assignments for plan + date
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import { DEFAULT_INTERVAL_COLORS } from './tpm.types.js';

// ============================================================================
// DB ROW INTERFACES
// ============================================================================

interface DbShiftAssignmentRow {
  plan_uuid: string;
  asset_id: number;
  shift_date: string;
  user_id: number;
  first_name: string;
  last_name: string;
  shift_type: string;
}

interface DbCalendarAssignmentRow {
  plan_uuid: string;
  shift_date: string;
  asset_name: string;
  plan_name: string;
  interval_types: string[];
  shift_type: string;
}

interface DbPlanAssignmentRow {
  uuid: string;
  user_id: number;
  first_name: string;
  last_name: string;
  user_name: string;
  scheduled_date: string;
}

interface DbPlanIdRow {
  id: number;
  asset_id: number;
}

// ============================================================================
// API RESPONSE INTERFACES
// ============================================================================

/** API response shape for a single shift assignment (Gesamtansicht) */
export interface TpmShiftAssignment {
  planUuid: string;
  assetId: number;
  shiftDate: string;
  userId: number;
  firstName: string;
  lastName: string;
  shiftType: string;
}

/** Lightweight calendar entry — one row per (plan, date) with scheduled interval types */
export interface CalendarTpmAssignment {
  planUuid: string;
  shiftDate: string;
  assetName: string;
  planName: string;
  intervalTypes: string[];
  shiftType: string;
  colorHex: string;
}

/** Single plan assignment (employee to plan on specific date) */
export interface TpmPlanAssignment {
  uuid: string;
  userId: number;
  firstName: string;
  lastName: string;
  userName: string;
  scheduledDate: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Interval significance (lower = more significant, shown in calendar).
 * Used to pick the primary color when multiple intervals fall on one date.
 */
const INTERVAL_SIGNIFICANCE: Record<string, number> = {
  annual: 1,
  semi_annual: 2,
  quarterly: 3,
  monthly: 4,
  long_runner: 5,
  custom: 6,
};

@Injectable()
export class TpmShiftAssignmentsService {
  private readonly logger = new Logger(TpmShiftAssignmentsService.name);

  constructor(private readonly db: DatabaseService) {}

  // ==========================================================================
  // WRITE: Set assignments for a plan on a specific date
  // ==========================================================================

  /**
   * Replaces all assignments for a plan on a given date.
   * Empty userIds removes all assignments for that date.
   */
  async setAssignments(
    tenantId: number,
    createdBy: number,
    planUuid: string,
    userIds: number[],
    scheduledDate: string,
  ): Promise<TpmPlanAssignment[]> {
    const plan = await this.resolvePlanId(tenantId, planUuid);

    // Deactivate users NOT in the new list
    await this.db.tenantQuery(
      `UPDATE tpm_plan_assignments
       SET is_active = ${IS_ACTIVE.DELETED}, updated_at = now()
       WHERE plan_id = $1
         AND scheduled_date = $2
         AND is_active = ${IS_ACTIVE.ACTIVE}
         AND user_id != ALL($3::int[])`,
      [plan.id, scheduledDate, userIds],
    );

    // Upsert each user (ON CONFLICT reactivates previously removed rows)
    for (const userId of userIds) {
      await this.db.tenantQuery(
        `INSERT INTO tpm_plan_assignments
           (uuid, tenant_id, plan_id, user_id, scheduled_date, created_by, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, ${IS_ACTIVE.ACTIVE}, now(), now())
         ON CONFLICT (plan_id, user_id, scheduled_date)
         DO UPDATE SET is_active = ${IS_ACTIVE.ACTIVE}, updated_at = now()`,
        [uuidv7(), tenantId, plan.id, userId, scheduledDate, createdBy],
      );
    }

    this.logger.debug(`Set ${userIds.length} assignments for plan ${planUuid} on ${scheduledDate}`);

    return await this.getAssignmentsForPlan(tenantId, planUuid, scheduledDate, scheduledDate);
  }

  // ==========================================================================
  // READ: Plan-specific assignments
  // ==========================================================================

  /** Fetch assignments for a specific plan within a date range */
  async getAssignmentsForPlan(
    tenantId: number,
    planUuid: string,
    startDate: string,
    endDate: string,
  ): Promise<TpmPlanAssignment[]> {
    const rows = await this.db.tenantQuery<DbPlanAssignmentRow>(
      `SELECT
        pa.uuid,
        pa.user_id,
        u.first_name,
        u.last_name,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) AS user_name,
        pa.scheduled_date::text
      FROM tpm_plan_assignments pa
      JOIN tpm_maintenance_plans mp
        ON mp.id = pa.plan_id AND mp.tenant_id = pa.tenant_id
      JOIN users u
        ON u.id = pa.user_id AND u.tenant_id = pa.tenant_id
      WHERE pa.tenant_id = $1
        AND mp.uuid = $2
        AND pa.scheduled_date BETWEEN $3 AND $4
        AND pa.is_active = ${IS_ACTIVE.ACTIVE}
        AND mp.is_active = ${IS_ACTIVE.ACTIVE}
      ORDER BY pa.scheduled_date, u.last_name`,
      [tenantId, planUuid, startDate, endDate],
    );

    return rows.map((row: DbPlanAssignmentRow) => ({
      uuid: row.uuid.trim(),
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      userName: row.user_name,
      scheduledDate: row.scheduled_date,
    }));
  }

  // ==========================================================================
  // READ: Cross-plan assignments (Gesamtansicht)
  // ==========================================================================

  /**
   * Fetches employees assigned to TPM maintenance within a date range.
   * Used by the Gesamtansicht "Zugewiesene Mitarbeiter" row.
   */
  async getShiftAssignments(
    tenantId: number,
    startDate: string,
    endDate: string,
  ): Promise<TpmShiftAssignment[]> {
    this.logger.debug(`Fetching TPM assignments for tenant ${tenantId}: ${startDate} – ${endDate}`);

    const rows = await this.db.tenantQuery<DbShiftAssignmentRow>(
      `SELECT DISTINCT
        mp.uuid AS plan_uuid,
        mp.asset_id,
        pa.scheduled_date::text AS shift_date,
        pa.user_id,
        u.first_name,
        u.last_name,
        'assigned' AS shift_type
      FROM tpm_plan_assignments pa
      JOIN tpm_maintenance_plans mp
        ON mp.id = pa.plan_id
       AND mp.tenant_id = pa.tenant_id
       AND mp.is_active = ${IS_ACTIVE.ACTIVE}
      JOIN users u
        ON u.id = pa.user_id
       AND u.tenant_id = pa.tenant_id
      WHERE pa.tenant_id = $1
        AND pa.scheduled_date BETWEEN $2 AND $3
        AND pa.is_active = ${IS_ACTIVE.ACTIVE}
      ORDER BY mp.uuid, shift_date, u.last_name`,
      [tenantId, startDate, endDate],
    );

    return rows.map((row: DbShiftAssignmentRow) => ({
      planUuid: row.plan_uuid.trim(),
      assetId: row.asset_id,
      shiftDate: row.shift_date,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      shiftType: row.shift_type,
    }));
  }

  // ==========================================================================
  // READ: Calendar view of assignments
  // ==========================================================================

  /**
   * Lightweight calendar view of TPM assignments.
   * Returns one entry per (plan, date) enriched with interval types
   * scheduled on that day. Excludes daily/weekly (too noisy for calendar).
   * Non-admin users only see dates where they are personally assigned.
   */
  async getCalendarAssignments(
    tenantId: number,
    userId: number,
    isAdmin: boolean,
    startDate: string,
    endDate: string,
  ): Promise<CalendarTpmAssignment[]> {
    this.logger.debug(
      `Fetching calendar assignments for tenant ${tenantId}, user ${userId} (admin=${isAdmin}): ${startDate} – ${endDate}`,
    );

    const userFilter = isAdmin ? '' : 'AND pa.user_id = $4';
    const params: (number | string)[] = [tenantId, startDate, endDate];
    if (!isAdmin) params.push(userId);

    const rows = await this.db.tenantQuery<DbCalendarAssignmentRow>(
      `SELECT *
      FROM (
        SELECT DISTINCT
          mp.uuid  AS plan_uuid,
          pa.scheduled_date::text AS shift_date,
          a.name   AS asset_name,
          mp.name  AS plan_name,
          'assigned' AS shift_type,
          COALESCE(
            (SELECT array_agg(DISTINCT c.interval_type::text ORDER BY c.interval_type::text)
             FROM tpm_cards c
             JOIN tpm_scheduled_dates sd ON sd.card_id = c.id
             WHERE c.plan_id = mp.id
               AND sd.scheduled_date = pa.scheduled_date
               AND c.interval_type NOT IN ('daily', 'weekly')
            ), ARRAY[]::text[]
          ) AS interval_types
        FROM tpm_plan_assignments pa
        JOIN tpm_maintenance_plans mp
          ON mp.id = pa.plan_id
         AND mp.tenant_id = pa.tenant_id
         AND mp.is_active = ${IS_ACTIVE.ACTIVE}
        JOIN assets a
          ON a.id = mp.asset_id
         AND a.tenant_id = pa.tenant_id
        WHERE pa.tenant_id = $1
          AND pa.scheduled_date BETWEEN $2 AND $3
          AND pa.is_active = ${IS_ACTIVE.ACTIVE}
          ${userFilter}
      ) sub
      WHERE array_length(sub.interval_types, 1) > 0
      ORDER BY shift_date, asset_name`,
      params,
    );

    const tenantColors = await this.loadIntervalColors(tenantId);
    return rows.map((row: DbCalendarAssignmentRow) => mapCalendarRow(row, tenantColors));
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /** Resolve plan UUID to internal ID (with existence check) */
  private async resolvePlanId(tenantId: number, planUuid: string): Promise<DbPlanIdRow> {
    const rows = await this.db.tenantQuery<DbPlanIdRow>(
      `SELECT id, asset_id
       FROM tpm_maintenance_plans
       WHERE tenant_id = $1 AND uuid = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [tenantId, planUuid],
    );
    const plan = rows[0];
    if (plan === undefined) {
      throw new NotFoundException(`Wartungsplan nicht gefunden: ${planUuid}`);
    }
    return plan;
  }

  /** Load tenant-specific interval colors (fallback handled by caller) */
  private async loadIntervalColors(tenantId: number): Promise<Map<string, string>> {
    const rows = await this.db.tenantQuery<{
      status_key: string;
      color_hex: string;
    }>(
      `SELECT status_key, color_hex FROM tpm_color_config
       WHERE tenant_id = $1
         AND status_key NOT IN ('green', 'red', 'yellow', 'overdue')`,
      [tenantId],
    );
    return new Map(
      rows.map((r: { status_key: string; color_hex: string }) => [r.status_key, r.color_hex]),
    );
  }
}

// ============================================================================
// Module-level pure functions
// ============================================================================

/** Map a DB row to API response, resolving the primary interval color */
function mapCalendarRow(
  row: DbCalendarAssignmentRow,
  tenantColors: Map<string, string>,
): CalendarTpmAssignment {
  const sorted = [...row.interval_types].sort(
    (a: string, b: string) => (INTERVAL_SIGNIFICANCE[a] ?? 99) - (INTERVAL_SIGNIFICANCE[b] ?? 99),
  );
  const primary: string = sorted[0] ?? 'monthly';
  const colorHex =
    tenantColors.get(primary) ??
    (DEFAULT_INTERVAL_COLORS as Record<string, { hex: string }>)[primary]?.hex ??
    '#FF9800';

  return {
    planUuid: row.plan_uuid.trim(),
    shiftDate: row.shift_date,
    assetName: row.asset_name,
    planName: row.plan_name,
    intervalTypes: row.interval_types,
    shiftType: row.shift_type,
    colorHex,
  };
}

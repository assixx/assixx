/**
 * TPM Shift Assignments Service
 *
 * Queries which employees are assigned to TPM maintenance shifts.
 * Joins shifts (via shift_plans with is_tpm_mode = true) against
 * tpm_maintenance_plans (by asset) to build the "Zugewiesene Mitarbeiter"
 * row in the Gesamtansicht.
 *
 * NOTE: interval_type is NOT determined here. The frontend already has the
 * projected schedule slots and cross-references employee dates against those
 * to determine which intervals each employee covers.
 */
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

/** DB row returned by the shift assignments query */
interface DbShiftAssignmentRow {
  plan_uuid: string;
  asset_id: number;
  shift_date: string;
  user_id: number;
  first_name: string;
  last_name: string;
  shift_type: string;
}

/** API response shape for a single shift assignment */
export interface TpmShiftAssignment {
  planUuid: string;
  assetId: number;
  shiftDate: string;
  userId: number;
  firstName: string;
  lastName: string;
  shiftType: string;
}

@Injectable()
export class TpmShiftAssignmentsService {
  private readonly logger = new Logger(TpmShiftAssignmentsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Fetches employees assigned to TPM maintenance within a date range.
   *
   * The query joins:
   * 1. shifts — actual employee assignments on specific dates
   * 2. shift_plans — filtered by is_tpm_mode = true (TPM maintenance teams)
   * 3. tpm_maintenance_plans — matched by asset_id (which asset this team maintains)
   * 4. users — employee names
   *
   * No dependency on tpm_cards or tpm_scheduled_dates — assignments exist
   * as soon as a TPM shift plan is created for a asset that has a TPM plan.
   */
  async getShiftAssignments(
    tenantId: number,
    startDate: string,
    endDate: string,
  ): Promise<TpmShiftAssignment[]> {
    this.logger.debug(
      `Fetching TPM shift assignments for tenant ${tenantId}: ${startDate} – ${endDate}`,
    );

    const rows = await this.db.query<DbShiftAssignmentRow>(
      `SELECT DISTINCT
        mp.uuid AS plan_uuid,
        mp.asset_id,
        s.date::text AS shift_date,
        s.user_id,
        u.first_name,
        u.last_name,
        s.type  AS shift_type
      FROM shifts s
      JOIN shift_plans sp
        ON sp.id = s.plan_id
       AND sp.is_tpm_mode = true
      JOIN tpm_maintenance_plans mp
        ON mp.asset_id = sp.asset_id
       AND mp.tenant_id = sp.tenant_id
       AND mp.is_active = 1
      JOIN users u
        ON u.id = s.user_id
       AND u.tenant_id = sp.tenant_id
      WHERE sp.tenant_id = $1
        AND s.date BETWEEN $2 AND $3
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
}

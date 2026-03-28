/**
 * Vacation Approver Service
 *
 * Determines who approves a vacation request based on organizational hierarchy:
 *   - area_lead user → auto-approve
 *   - root → auto-approve
 *   - admin → area_lead (or auto-approve if none)
 *   - employee → team_lead (or deputy if lead absent, or escalate to area_lead if lead IS the user)
 *
 * Self-approval prevention (Risk R5): team_lead cannot approve own vacation.
 * Extracted from VacationService to maintain max-lines limit.
 *
 * All queries via db.tenantTransaction() (ADR-019).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../database/database.service.js';
import type { ApproverResult } from './vacation.types.js';

/** User role lookup row */
interface UserRoleRow {
  id: number;
  role: string;
}

/** Team info with lead/deputy */
interface UserTeamInfoRow {
  team_id: number;
  team_name: string;
  team_lead_id: number | null;
  team_deputy_lead_id: number | null;
  department_id: number | null;
}

/** Area lead lookup row */
interface AreaLeadRow {
  area_lead_id: number | null;
}

@Injectable()
export class VacationApproverService {
  constructor(private readonly db: DatabaseService) {}

  /** Determine the approver for a vacation request. */
  async getApprover(tenantId: number, userId: number): Promise<ApproverResult> {
    return await this.db.tenantTransaction(async (client: PoolClient): Promise<ApproverResult> => {
      if (await this.isUserAreaLead(client, tenantId, userId)) {
        return { approverId: null, autoApproved: true };
      }
      const user = await this.getUserRole(client, tenantId, userId);
      if (user.role === 'root') return { approverId: null, autoApproved: true };
      if (user.role === 'admin') {
        return await this.resolveAreaLeadOrAutoApprove(client, userId);
      }
      return await this.getApproverForEmployee(client, tenantId, userId);
    });
  }

  // ==========================================================================
  // Private — Approver determination
  // ==========================================================================

  /** When requester is lead or deputy, the other one approves — else escalate */
  private resolveCounterpartOrEscalate(counterpartId: number | null): ApproverResult | null {
    if (counterpartId !== null) return { approverId: counterpartId, autoApproved: false };
    return null;
  }

  private async getApproverForEmployee(
    client: PoolClient,
    tenantId: number,
    userId: number,
  ): Promise<ApproverResult> {
    const teamInfo = await this.getUserTeamInfo(client, tenantId, userId);
    const leadId = teamInfo.team_lead_id;
    const deputyId = teamInfo.team_deputy_lead_id;

    if (leadId === null && deputyId === null) {
      throw new BadRequestException('Team has no lead assigned. Contact your administrator.');
    }

    // Requester IS lead or deputy → counterpart approves, else escalate
    if (leadId === userId) {
      return (
        this.resolveCounterpartOrEscalate(deputyId) ??
        (await this.resolveAreaLeadOrAutoApprove(client, userId))
      );
    }
    if (deputyId === userId) {
      return (
        this.resolveCounterpartOrEscalate(leadId) ??
        (await this.resolveAreaLeadOrAutoApprove(client, userId))
      );
    }

    // Regular employee → first available (lead preferred)
    return await this.resolveFirstAvailable(client, userId, leadId, deputyId);
  }

  /** Try lead, then deputy — escalate if both absent */
  private async resolveFirstAvailable(
    client: PoolClient,
    userId: number,
    leadId: number | null,
    deputyId: number | null,
  ): Promise<ApproverResult> {
    if (leadId !== null && !(await this.isUserAbsent(client, leadId))) {
      return { approverId: leadId, autoApproved: false };
    }
    if (deputyId !== null && !(await this.isUserAbsent(client, deputyId))) {
      return { approverId: deputyId, autoApproved: false };
    }
    return await this.resolveAreaLeadOrAutoApprove(client, userId);
  }

  private async resolveAreaLeadOrAutoApprove(
    client: PoolClient,
    userId: number,
  ): Promise<ApproverResult> {
    const result = await client.query<AreaLeadRow & { area_deputy_lead_id: number | null }>(
      `SELECT a.area_lead_id, a.area_deputy_lead_id FROM areas a
       JOIN departments d ON a.id = d.area_id
       JOIN user_departments ud ON d.id = ud.department_id
       WHERE ud.user_id = $1 AND ud.is_primary = true`,
      [userId],
    );
    const row = result.rows[0];
    const areaLeadId = row?.area_lead_id;
    if (areaLeadId !== undefined && areaLeadId !== null && areaLeadId !== userId) {
      return { approverId: areaLeadId, autoApproved: false };
    }
    const areaDeputyLeadId = row?.area_deputy_lead_id;
    if (
      areaDeputyLeadId !== undefined &&
      areaDeputyLeadId !== null &&
      areaDeputyLeadId !== userId
    ) {
      return { approverId: areaDeputyLeadId, autoApproved: false };
    }
    return { approverId: null, autoApproved: true };
  }

  private async isUserAreaLead(
    client: PoolClient,
    tenantId: number,
    userId: number,
  ): Promise<boolean> {
    const result = await client.query<{ found: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM areas WHERE area_lead_id = $1 AND tenant_id = $2) AS found`,
      [userId, tenantId],
    );
    return result.rows[0]?.found === true;
  }

  private async isUserAbsent(client: PoolClient, userId: number): Promise<boolean> {
    const result = await client.query<{ found: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM user_availability
        WHERE user_id = $1 AND status != 'available'
          AND start_date <= NOW() AND end_date >= NOW()
      ) AS found`,
      [userId],
    );
    return result.rows[0]?.found === true;
  }

  // ==========================================================================
  // Private — DB helpers (duplicated from VacationService for isolation)
  // ==========================================================================

  private async getUserTeamInfo(
    client: PoolClient,
    tenantId: number,
    userId: number,
  ): Promise<UserTeamInfoRow> {
    const result = await client.query<UserTeamInfoRow>(
      `SELECT t.id AS team_id, t.name AS team_name,
              t.team_lead_id, t.team_deputy_lead_id, t.department_id
       FROM teams t JOIN user_teams ut ON t.id = ut.team_id
       WHERE ut.user_id = $1 AND t.tenant_id = $2 AND t.is_active = ${IS_ACTIVE.ACTIVE}`,
      [userId, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new BadRequestException(
        'Employee must be assigned to a team before requesting vacation',
      );
    }
    return row;
  }

  private async getUserRole(
    client: PoolClient,
    tenantId: number,
    userId: number,
  ): Promise<UserRoleRow> {
    const result = await client.query<UserRoleRow>(
      `SELECT id, role FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [userId, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) throw new NotFoundException(`User ${String(userId)} not found`);
    return row;
  }
}

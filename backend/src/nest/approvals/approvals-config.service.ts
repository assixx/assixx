/**
 * Approvals Config Service — CRUD for approval_configs + dynamic approver resolution
 * @module approvals/approvals-config.service
 *
 * Manages who can approve what per addon per tenant.
 * resolveApprovers() uses a single UNION ALL query for all approver types.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { ApprovalConfig, ApprovalConfigRow } from './approvals.types.js';
import { mapConfigRowToApi } from './approvals.types.js';
import type { UpsertApprovalConfigDto } from './dto/index.js';

/** Row type for the UNION ALL resolver query */
interface ResolvedApproverRow {
  approver_id: number;
}

/**
 * Normalize a scope array for storage: sort ascending, convert empty/undefined to null.
 * Sorted arrays ensure unique index consistency (immutable_int_array_text).
 */
function normalizeScopeArray(arr: number[] | null | undefined): number[] | null {
  if (arr === null || arr === undefined || arr.length === 0) {
    return null;
  }
  return [...arr].sort((a: number, b: number) => a - b);
}

/**
 * $1 = addonCode, $2 = requestingUserId
 *
 * CTE `requester_org` resolves the requesting user's organizational context
 * (area_id, department_id, team_id) for scope matching in user/position branches.
 *
 * Scope filter (user + position branches only):
 * - All three scope columns NULL = whole tenant (match all)
 * - Otherwise: requester's org membership must overlap with at least one scope array
 *
 * Hierarchy branches (team_lead, area_lead, department_lead) have implicit scope
 * via their JOIN paths — no scope columns needed.
 */
const RESOLVE_APPROVERS_QUERY = `
  WITH requester_org AS (
    SELECT DISTINCT d.area_id, t.department_id, ut.team_id
    FROM user_teams ut
    JOIN teams t ON t.id = ut.team_id AND t.is_active = 1
    JOIN departments d ON d.id = t.department_id AND d.is_active = 1
    WHERE ut.user_id = $2
    UNION
    SELECT DISTINCT d2.area_id, ud.department_id, NULL::integer AS team_id
    FROM user_departments ud
    JOIN departments d2 ON d2.id = ud.department_id AND d2.is_active = 1
    WHERE ud.user_id = $2
  )
  SELECT DISTINCT approver_id FROM (
    -- type='user': scope-filtered
    SELECT ac.approver_user_id AS approver_id
    FROM approval_configs ac
    WHERE ac.addon_code = $1
      AND ac.approver_type = 'user'
      AND ac.approver_user_id IS NOT NULL
      AND ac.is_active = 1
      AND (
        (ac.scope_area_ids IS NULL AND ac.scope_department_ids IS NULL AND ac.scope_team_ids IS NULL)
        OR EXISTS (SELECT 1 FROM requester_org ro WHERE ro.area_id = ANY(ac.scope_area_ids))
        OR EXISTS (SELECT 1 FROM requester_org ro WHERE ro.department_id = ANY(ac.scope_department_ids))
        OR EXISTS (SELECT 1 FROM requester_org ro WHERE ro.team_id = ANY(ac.scope_team_ids))
      )

    UNION ALL

    -- type='team_lead': implicit scope (unchanged)
    SELECT t.team_lead_id AS approver_id
    FROM approval_configs ac
    INNER JOIN user_teams ut ON ut.user_id = $2
    INNER JOIN teams t ON t.id = ut.team_id
      AND t.team_lead_id IS NOT NULL
      AND t.is_active = 1
    WHERE ac.addon_code = $1
      AND ac.approver_type = 'team_lead'
      AND ac.is_active = 1

    UNION ALL

    -- type='team_lead' deputy: implicit scope (unchanged)
    SELECT t2.team_deputy_lead_id AS approver_id
    FROM approval_configs ac
    INNER JOIN user_teams ut2 ON ut2.user_id = $2
    INNER JOIN teams t2 ON t2.id = ut2.team_id
      AND t2.team_deputy_lead_id IS NOT NULL
      AND t2.is_active = 1
    WHERE ac.addon_code = $1
      AND ac.approver_type = 'team_lead'
      AND ac.is_active = 1

    UNION ALL

    -- type='area_lead': implicit scope (unchanged)
    SELECT a.area_lead_id AS approver_id
    FROM approval_configs ac
    INNER JOIN user_departments ud ON ud.user_id = $2
    INNER JOIN departments d ON d.id = ud.department_id
    INNER JOIN areas a ON a.id = d.area_id
      AND a.area_lead_id IS NOT NULL
      AND a.is_active = 1
    WHERE ac.addon_code = $1
      AND ac.approver_type = 'area_lead'
      AND ac.is_active = 1

    UNION ALL

    -- type='area_lead' deputy: implicit scope (unchanged)
    SELECT a2.area_deputy_lead_id AS approver_id
    FROM approval_configs ac
    INNER JOIN user_departments ud3 ON ud3.user_id = $2
    INNER JOIN departments d3 ON d3.id = ud3.department_id
    INNER JOIN areas a2 ON a2.id = d3.area_id
      AND a2.area_deputy_lead_id IS NOT NULL
      AND a2.is_active = 1
    WHERE ac.addon_code = $1
      AND ac.approver_type = 'area_lead'
      AND ac.is_active = 1

    UNION ALL

    -- type='department_lead': implicit scope (unchanged)
    SELECT d2.department_lead_id AS approver_id
    FROM approval_configs ac
    INNER JOIN user_departments ud2 ON ud2.user_id = $2
    INNER JOIN departments d2 ON d2.id = ud2.department_id
      AND d2.department_lead_id IS NOT NULL
      AND d2.is_active = 1
    WHERE ac.addon_code = $1
      AND ac.approver_type = 'department_lead'
      AND ac.is_active = 1

    UNION ALL

    -- type='department_lead' deputy: implicit scope (unchanged)
    SELECT d4.department_deputy_lead_id AS approver_id
    FROM approval_configs ac
    INNER JOIN user_departments ud4 ON ud4.user_id = $2
    INNER JOIN departments d4 ON d4.id = ud4.department_id
      AND d4.department_deputy_lead_id IS NOT NULL
      AND d4.is_active = 1
    WHERE ac.addon_code = $1
      AND ac.approver_type = 'department_lead'
      AND ac.is_active = 1

    UNION ALL

    -- type='position': scope-filtered
    SELECT DISTINCT u.id AS approver_id
    FROM approval_configs ac
    INNER JOIN user_positions up ON up.position_id = ac.approver_position_id
    INNER JOIN users u ON u.id = up.user_id
      AND u.is_active = 1
    WHERE ac.addon_code = $1
      AND ac.approver_type = 'position'
      AND ac.approver_position_id IS NOT NULL
      AND ac.is_active = 1
      AND (
        (ac.scope_area_ids IS NULL AND ac.scope_department_ids IS NULL AND ac.scope_team_ids IS NULL)
        OR EXISTS (SELECT 1 FROM requester_org ro WHERE ro.area_id = ANY(ac.scope_area_ids))
        OR EXISTS (SELECT 1 FROM requester_org ro WHERE ro.department_id = ANY(ac.scope_department_ids))
        OR EXISTS (SELECT 1 FROM requester_org ro WHERE ro.team_id = ANY(ac.scope_team_ids))
      )
  ) AS resolved
  WHERE approver_id IS NOT NULL
`;

@Injectable()
export class ApprovalsConfigService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /** List all configs for a tenant */
  async getConfigs(): Promise<ApprovalConfig[]> {
    const rows = await this.db.tenantTransaction(async (client: PoolClient) => {
      const result = await client.query<
        ApprovalConfigRow & {
          approver_user_name: string | null;
          approver_position_name: string | null;
        }
      >(
        `SELECT ac.*,
           u.first_name || ' ' || u.last_name AS approver_user_name,
           pc.name AS approver_position_name
         FROM approval_configs ac
         LEFT JOIN users u ON u.id = ac.approver_user_id
         LEFT JOIN position_catalog pc ON pc.id = ac.approver_position_id
         WHERE ac.is_active = ${IS_ACTIVE.ACTIVE}
         ORDER BY ac.addon_code, ac.approver_type`,
        [],
      );
      return result.rows;
    });

    return rows.map(mapConfigRowToApi);
  }

  /** Create a config entry */
  async createConfig(
    dto: UpsertApprovalConfigDto,
    tenantId: number,
    createdBy: number,
  ): Promise<ApprovalConfig> {
    const row = await this.db.tenantTransaction(async (client: PoolClient) => {
      await this.assertNoDuplicateConfig(client, tenantId, dto);

      const uuid = uuidv7();
      const positionId = dto.approverPositionId ?? null;
      const userId = dto.approverUserId ?? null;
      const scopeAreaIds = normalizeScopeArray(dto.scopeAreaIds);
      const scopeDeptIds = normalizeScopeArray(dto.scopeDepartmentIds);
      const scopeTeamIds = normalizeScopeArray(dto.scopeTeamIds);

      const result = await client.query<
        ApprovalConfigRow & {
          approver_user_name: string | null;
          approver_position_name: string | null;
        }
      >(
        `INSERT INTO approval_configs
           (uuid, tenant_id, addon_code, approver_type, approver_user_id, approver_position_id,
            scope_area_ids, scope_department_ids, scope_team_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *,
           (SELECT first_name || ' ' || last_name FROM users WHERE id = $5) AS approver_user_name,
           (SELECT name FROM position_catalog WHERE id = $6) AS approver_position_name`,
        [
          uuid,
          tenantId,
          dto.addonCode,
          dto.approverType,
          userId,
          positionId,
          scopeAreaIds,
          scopeDeptIds,
          scopeTeamIds,
        ],
      );

      const inserted = result.rows[0];
      if (inserted === undefined) {
        throw new Error('Insert returned no rows');
      }
      return inserted;
    });

    void this.activityLogger.logCreate(
      tenantId,
      createdBy,
      'approval_config',
      row.id,
      `Approval master: ${dto.approverType} for ${dto.addonCode}`,
      { addonCode: dto.addonCode, approverType: dto.approverType },
    );

    return mapConfigRowToApi(row);
  }

  /** Soft-delete a config entry */
  async deleteConfig(uuid: string, tenantId: number, deletedBy: number): Promise<void> {
    const affected = await this.db.tenantTransaction(async (client: PoolClient) => {
      const res = await client.query(
        `UPDATE approval_configs
         SET is_active = ${IS_ACTIVE.DELETED}, updated_at = NOW()
         WHERE uuid = $1 AND is_active = ${IS_ACTIVE.ACTIVE}`,
        [uuid],
      );
      return res.rowCount ?? 0;
    });

    if (affected === 0) {
      throw new NotFoundException('Approval config not found');
    }

    void this.activityLogger.logDelete(
      tenantId,
      deletedBy,
      'approval_config',
      0,
      `Approval config removed: ${uuid}`,
      { uuid },
    );
  }

  /**
   * Resolve all configured approvers for an addon.
   * Single UNION ALL query — 1 DB round-trip (5 branches incl. position).
   */
  async resolveApprovers(addonCode: string, requestingUserId: number): Promise<number[]> {
    const rows = await this.db.tenantTransaction(async (client: PoolClient) => {
      const result = await client.query<ResolvedApproverRow>(RESOLVE_APPROVERS_QUERY, [
        addonCode,
        requestingUserId,
      ]);
      return result.rows;
    });

    return rows.map((r: ResolvedApproverRow) => r.approver_id);
  }

  /** Check for duplicate config (user_id + position_id + scope dimensions) */
  private async assertNoDuplicateConfig(
    client: PoolClient,
    tenantId: number,
    dto: UpsertApprovalConfigDto,
  ): Promise<void> {
    const NULL_UUID = '00000000-0000-0000-0000-000000000000';
    const scopeAreaIds = normalizeScopeArray(dto.scopeAreaIds);
    const scopeDeptIds = normalizeScopeArray(dto.scopeDepartmentIds);
    const scopeTeamIds = normalizeScopeArray(dto.scopeTeamIds);

    const existing = await client.query<{ uuid: string }>(
      `SELECT uuid FROM approval_configs
       WHERE tenant_id = $1 AND addon_code = $2
         AND approver_type = $3
         AND COALESCE(approver_user_id, 0) = $4
         AND COALESCE(approver_position_id, '${NULL_UUID}'::uuid) = $5
         AND immutable_int_array_text(scope_area_ids) = immutable_int_array_text($6::integer[])
         AND immutable_int_array_text(scope_department_ids) = immutable_int_array_text($7::integer[])
         AND immutable_int_array_text(scope_team_ids) = immutable_int_array_text($8::integer[])
         AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [
        tenantId,
        dto.addonCode,
        dto.approverType,
        dto.approverUserId ?? 0,
        dto.approverPositionId ?? NULL_UUID,
        scopeAreaIds,
        scopeDeptIds,
        scopeTeamIds,
      ],
    );

    if (existing.rows.length > 0) {
      throw new ConflictException(`Config exists for ${dto.addonCode} / ${dto.approverType}`);
    }
  }
}

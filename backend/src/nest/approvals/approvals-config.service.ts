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

/** $1 = addonCode, $2 = requestingUserId */
const RESOLVE_APPROVERS_QUERY = `
  SELECT DISTINCT approver_id FROM (
    SELECT ac.approver_user_id AS approver_id
    FROM approval_configs ac
    WHERE ac.addon_code = $1
      AND ac.approver_type = 'user'
      AND ac.approver_user_id IS NOT NULL
      AND ac.is_active = 1

    UNION ALL

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

    SELECT DISTINCT u.id AS approver_id
    FROM approval_configs ac
    INNER JOIN user_positions up ON up.position_id = ac.approver_position_id
    INNER JOIN users u ON u.id = up.user_id
      AND u.is_active = 1
    WHERE ac.addon_code = $1
      AND ac.approver_type = 'position'
      AND ac.approver_position_id IS NOT NULL
      AND ac.is_active = 1
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

      const result = await client.query<
        ApprovalConfigRow & {
          approver_user_name: string | null;
          approver_position_name: string | null;
        }
      >(
        `INSERT INTO approval_configs
           (uuid, tenant_id, addon_code, approver_type, approver_user_id, approver_position_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *,
           (SELECT first_name || ' ' || last_name FROM users WHERE id = $5) AS approver_user_name,
           (SELECT name FROM position_catalog WHERE id = $6) AS approver_position_name`,
        [uuid, tenantId, dto.addonCode, dto.approverType, userId, positionId],
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

  /** Check for duplicate config (user_id + position_id dimensions) */
  private async assertNoDuplicateConfig(
    client: PoolClient,
    tenantId: number,
    dto: UpsertApprovalConfigDto,
  ): Promise<void> {
    const NULL_UUID = '00000000-0000-0000-0000-000000000000';
    const existing = await client.query<{ uuid: string }>(
      `SELECT uuid FROM approval_configs
       WHERE tenant_id = $1 AND addon_code = $2
         AND approver_type = $3
         AND COALESCE(approver_user_id, 0) = $4
         AND COALESCE(approver_position_id, '${NULL_UUID}'::uuid) = $5
         AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [
        tenantId,
        dto.addonCode,
        dto.approverType,
        dto.approverUserId ?? 0,
        dto.approverPositionId ?? NULL_UUID,
      ],
    );

    if (existing.rows.length > 0) {
      throw new ConflictException(`Config exists for ${dto.addonCode} / ${dto.approverType}`);
    }
  }
}

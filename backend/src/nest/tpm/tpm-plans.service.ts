/**
 * TPM Plans Service
 *
 * CRUD operations for maintenance plans.
 * Each plan belongs to exactly one asset (UNIQUE constraint).
 * Uses tenantTransaction() for mutations, direct queries for reads.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ScopeService } from '../hierarchy-permission/scope.service.js';
import type { CreateMaintenancePlanDto } from './dto/create-maintenance-plan.dto.js';
import type { UpdateMaintenancePlanDto } from './dto/update-maintenance-plan.dto.js';
import {
  type TpmPlanJoinRow,
  buildPlanUpdateFields,
  detectChangedFields,
  insertRevisionSnapshot,
  mapPlanRowToApi,
} from './tpm-plans.helpers.js';
import type {
  TpmIntervalType,
  TpmMyPermissions,
  TpmPlan,
  TpmScopedAsset,
  TpmScopedDepartment,
  TpmScopedOrgData,
} from './tpm.types.js';

/** Single entry in the interval matrix: one plan × one interval */
export interface IntervalMatrixEntry {
  planUuid: string;
  intervalType: TpmIntervalType;
  cardCount: number;
  greenCount: number;
  redCount: number;
  yellowCount: number;
  overdueCount: number;
}

/** Paginated plan list response */
export interface PaginatedPlans {
  data: TpmPlan[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// Org data row types + mappers (for getScopedOrgData)
// ============================================================================

interface OrgAreaRow {
  id: number;
  name: string;
  uuid: string;
}
interface OrgDeptRow {
  id: number;
  name: string;
  uuid: string;
  area_id: number;
}
interface OrgAssetRow {
  id: number;
  name: string;
  uuid: string;
  department_id: number;
  asset_number: string | null;
  status: string;
}

function mapDeptRow(d: OrgDeptRow): TpmScopedDepartment {
  return { id: d.id, name: d.name, uuid: d.uuid, areaId: d.area_id };
}

function mapAssetRow(a: OrgAssetRow): TpmScopedAsset {
  return {
    id: a.id,
    name: a.name,
    uuid: a.uuid,
    departmentId: a.department_id,
    assetNumber: a.asset_number,
    status: a.status,
  };
}

@Injectable()
export class TpmPlansService {
  private readonly logger = new Logger(TpmPlansService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly scopeService: ScopeService,
  ) {}

  // ============================================================================
  // SCOPE + PERMISSION HELPERS
  // ============================================================================

  /** Resolve team IDs for scope-filtered queries. Returns null for full-access users. */
  private async resolveScopeTeamIds(user: NestAuthUser): Promise<number[] | null> {
    if (user.hasFullAccess) return null;

    const scope = await this.scopeService.getScope();
    if (scope.type === 'full') return null;
    if (scope.type === 'limited') return scope.teamIds;

    // Non-lead employees: ScopeService returns 'none' (designed for hierarchy management).
    // Fall back to their direct team assignments so they see TPM plans for their teams.
    const rows = await this.db.tenantQuery<{ team_id: number }>(
      'SELECT team_id FROM user_teams WHERE user_id = $1 AND tenant_id = $2',
      [user.id, user.tenantId],
    );
    return rows.map((r: { team_id: number }) => r.team_id);
  }

  /** Get the calling user's effective TPM permissions across all modules. */
  async getMyPermissions(userId: number, hasFullAccess: boolean): Promise<TpmMyPermissions> {
    if (hasFullAccess) {
      return {
        plans: { canRead: true, canWrite: true, canDelete: true },
        cards: { canRead: true, canWrite: true, canDelete: true },
        executions: { canRead: true, canWrite: true },
        config: { canRead: true, canWrite: true },
        locations: { canRead: true, canWrite: true, canDelete: true },
      };
    }

    interface PermRow {
      module_code: string;
      can_read: boolean;
      can_write: boolean;
      can_delete: boolean;
    }

    const rows = await this.db.tenantQuery<PermRow>(
      `SELECT module_code, can_read, can_write, can_delete
       FROM user_addon_permissions
       WHERE user_id = $1 AND addon_code = 'tpm'`,
      [userId],
    );

    const perms = new Map(rows.map((r: PermRow) => [r.module_code, r]));
    const get = (code: string): { canRead: boolean; canWrite: boolean; canDelete: boolean } => {
      const row = perms.get(code);
      return {
        canRead: row?.can_read ?? false,
        canWrite: row?.can_write ?? false,
        canDelete: row?.can_delete ?? false,
      };
    };

    return {
      plans: get('tpm-plans'),
      cards: get('tpm-cards'),
      executions: {
        canRead: get('tpm-executions').canRead,
        canWrite: get('tpm-executions').canWrite,
      },
      config: { canRead: get('tpm-config').canRead, canWrite: get('tpm-config').canWrite },
      locations: get('tpm-locations'),
    };
  }

  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /** Get a single plan by UUID */
  async getPlan(tenantId: number, planUuid: string): Promise<TpmPlan> {
    const row = await this.db.tenantQueryOne<TpmPlanJoinRow>(
      `SELECT p.*, m.uuid AS asset_uuid, m.name AS asset_name, d.name AS department_name, u.username AS created_by_name,
              latest_approval.approval_status,
              latest_approval.approval_decision_note,
              latest_approval.approval_decided_by_name
       FROM tpm_maintenance_plans p
       LEFT JOIN assets m ON p.asset_id = m.id AND m.tenant_id = p.tenant_id
       LEFT JOIN departments d ON m.department_id = d.id
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN LATERAL (
         SELECT a.status AS approval_status,
                a.decision_note AS approval_decision_note,
                COALESCE(NULLIF(CONCAT(du.first_name, ' ', du.last_name), ' '), du.username) AS approval_decided_by_name
         FROM approvals a
         LEFT JOIN users du ON du.id = a.decided_by
         WHERE a.addon_code = 'tpm'
           AND a.source_entity_type = 'tpm_plan'
           AND a.source_uuid = p.uuid
           AND a.is_active = ${IS_ACTIVE.ACTIVE}
         ORDER BY a.created_at DESC
         LIMIT 1
       ) latest_approval ON true
       WHERE p.uuid = $1 AND p.tenant_id = $2 AND p.is_active IN (${IS_ACTIVE.ACTIVE}, ${IS_ACTIVE.ARCHIVED})`,
      [planUuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException(`Wartungsplan ${planUuid} nicht gefunden`);
    }

    return mapPlanRowToApi(row);
  }

  /** List plans with pagination, scoped by user's teams for non-full-access users */
  async listPlans(
    tenantId: number,
    page: number = 1,
    pageSize: number = 20,
    user: NestAuthUser,
  ): Promise<PaginatedPlans> {
    const offset = (page - 1) * pageSize;
    const teamIds = await this.resolveScopeTeamIds(user);

    // Dynamic scope filter: when teamIds is set, restrict to plans whose asset is linked to those teams
    const scopeClause =
      teamIds !== null ?
        `AND EXISTS (SELECT 1 FROM asset_teams ats WHERE ats.asset_id = p.asset_id AND ats.team_id = ANY($4::int[]))`
      : '';
    const baseParams: unknown[] = [tenantId, pageSize, offset];
    const allParams = teamIds !== null ? [...baseParams, teamIds] : baseParams;

    const countResult = await this.db.tenantQueryOne<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM tpm_maintenance_plans p
       WHERE p.tenant_id = $1 AND p.is_active IN (${IS_ACTIVE.ACTIVE}, ${IS_ACTIVE.ARCHIVED})
       ${teamIds !== null ? `AND EXISTS (SELECT 1 FROM asset_teams ats WHERE ats.asset_id = p.asset_id AND ats.team_id = ANY($2::int[]))` : ''}`,
      teamIds !== null ? [tenantId, teamIds] : [tenantId],
    );
    const total = Number.parseInt(countResult?.count ?? '0', 10);

    const rows = await this.db.tenantQuery<TpmPlanJoinRow>(
      `SELECT p.*, m.uuid AS asset_uuid, m.name AS asset_name, d.name AS department_name, u.username AS created_by_name,
              latest_approval.approval_status,
              latest_approval.approval_decision_note,
              latest_approval.approval_decided_by_name
       FROM tpm_maintenance_plans p
       LEFT JOIN assets m ON p.asset_id = m.id AND m.tenant_id = p.tenant_id
       LEFT JOIN departments d ON m.department_id = d.id
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN LATERAL (
         SELECT a.status AS approval_status,
                a.decision_note AS approval_decision_note,
                COALESCE(NULLIF(CONCAT(du.first_name, ' ', du.last_name), ' '), du.username) AS approval_decided_by_name
         FROM approvals a
         LEFT JOIN users du ON du.id = a.decided_by
         WHERE a.addon_code = 'tpm'
           AND a.source_entity_type = 'tpm_plan'
           AND a.source_uuid = p.uuid
           AND a.is_active = ${IS_ACTIVE.ACTIVE}
         ORDER BY a.created_at DESC
         LIMIT 1
       ) latest_approval ON true
       WHERE p.tenant_id = $1 AND p.is_active IN (${IS_ACTIVE.ACTIVE}, ${IS_ACTIVE.ARCHIVED})
       ${scopeClause}
       ORDER BY p.is_active ASC, p.name ASC
       LIMIT $2 OFFSET $3`,
      allParams,
    );

    return {
      data: rows.map(mapPlanRowToApi),
      total,
      page,
      pageSize,
    };
  }

  /** Get interval matrix: which plans have cards for which interval types (scoped) */
  async getIntervalMatrix(tenantId: number, user: NestAuthUser): Promise<IntervalMatrixEntry[]> {
    interface MatrixRow {
      plan_uuid: string;
      interval_type: TpmIntervalType;
      card_count: string;
      green_count: string;
      red_count: string;
      yellow_count: string;
      overdue_count: string;
    }

    const teamIds = await this.resolveScopeTeamIds(user);
    const scopeClause =
      teamIds !== null ?
        `AND EXISTS (SELECT 1 FROM asset_teams ats WHERE ats.asset_id = p.asset_id AND ats.team_id = ANY($2::int[]))`
      : '';

    const rows = await this.db.tenantQuery<MatrixRow>(
      `SELECT p.uuid AS plan_uuid,
              c.interval_type,
              COUNT(*)::text AS card_count,
              COUNT(*) FILTER (WHERE c.status = 'green')::text AS green_count,
              COUNT(*) FILTER (WHERE c.status = 'red')::text AS red_count,
              COUNT(*) FILTER (WHERE c.status = 'yellow')::text AS yellow_count,
              COUNT(*) FILTER (WHERE c.status = 'overdue')::text AS overdue_count
       FROM tpm_cards c
       JOIN tpm_maintenance_plans p ON c.plan_id = p.id
       WHERE c.tenant_id = $1 AND c.is_active = ${IS_ACTIVE.ACTIVE} AND p.is_active = ${IS_ACTIVE.ACTIVE}
       ${scopeClause}
       GROUP BY p.uuid, c.interval_type
       ORDER BY p.uuid, c.interval_type`,
      teamIds !== null ? [tenantId, teamIds] : [tenantId],
    );

    return rows.map((r: MatrixRow) => ({
      planUuid: r.plan_uuid,
      intervalType: r.interval_type,
      cardCount: Number.parseInt(r.card_count, 10),
      greenCount: Number.parseInt(r.green_count, 10),
      redCount: Number.parseInt(r.red_count, 10),
      yellowCount: Number.parseInt(r.yellow_count, 10),
      overdueCount: Number.parseInt(r.overdue_count, 10),
    }));
  }

  /** Get org data (areas, departments, assets) scoped to user's teams for plan creation */
  async getScopedOrgData(tenantId: number, user: NestAuthUser): Promise<TpmScopedOrgData> {
    const teamIds = await this.resolveScopeTeamIds(user);
    return teamIds === null ?
        await this.loadAllOrgData(tenantId)
      : await this.loadScopedOrgData(tenantId, teamIds);
  }

  /** Load all org data for full-access users */
  private async loadAllOrgData(tenantId: number): Promise<TpmScopedOrgData> {
    const [areas, depts, assets] = await Promise.all([
      this.db.tenantQuery<OrgAreaRow>(
        `SELECT id, name, uuid FROM areas WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE} ORDER BY name`,
        [tenantId],
      ),
      this.db.tenantQuery<OrgDeptRow>(
        `SELECT id, name, uuid, area_id FROM departments WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE} ORDER BY name`,
        [tenantId],
      ),
      this.db.tenantQuery<OrgAssetRow>(
        `SELECT id, name, uuid, department_id, asset_number, status FROM assets WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE} ORDER BY name`,
        [tenantId],
      ),
    ]);
    return { areas, departments: depts.map(mapDeptRow), assets: assets.map(mapAssetRow) };
  }

  /** Load org data scoped to specific teams via asset_teams */
  private async loadScopedOrgData(tenantId: number, teamIds: number[]): Promise<TpmScopedOrgData> {
    const assets = await this.db.tenantQuery<OrgAssetRow>(
      `SELECT DISTINCT a.id, a.name, a.uuid, a.department_id, a.asset_number, a.status
       FROM assets a JOIN asset_teams at ON a.id = at.asset_id
       WHERE a.tenant_id = $1 AND a.is_active = ${IS_ACTIVE.ACTIVE} AND at.team_id = ANY($2::int[])
       ORDER BY a.name`,
      [tenantId, teamIds],
    );

    const deptIds = [...new Set(assets.map((a: OrgAssetRow) => a.department_id))];
    const depts =
      deptIds.length > 0 ?
        await this.db.tenantQuery<OrgDeptRow>(
          `SELECT id, name, uuid, area_id FROM departments WHERE id = ANY($1::int[]) AND is_active = ${IS_ACTIVE.ACTIVE}`,
          [deptIds],
        )
      : [];

    const areaIds = [...new Set(depts.map((d: OrgDeptRow) => d.area_id))];
    const areas =
      areaIds.length > 0 ?
        await this.db.tenantQuery<OrgAreaRow>(
          `SELECT id, name, uuid FROM areas WHERE id = ANY($1::int[]) AND is_active = ${IS_ACTIVE.ACTIVE}`,
          [areaIds],
        )
      : [];

    return { areas, departments: depts.map(mapDeptRow), assets: assets.map(mapAssetRow) };
  }

  /** Get plan by asset ID (for slot assistant and inter-service lookups) */
  async getPlanByAssetId(tenantId: number, assetId: number): Promise<TpmPlan | null> {
    const row = await this.db.tenantQueryOne<TpmPlanJoinRow>(
      `SELECT p.*, m.uuid AS asset_uuid, m.name AS asset_name, d.name AS department_name, u.username AS created_by_name
       FROM tpm_maintenance_plans p
       LEFT JOIN assets m ON p.asset_id = m.id AND m.tenant_id = p.tenant_id
       LEFT JOIN departments d ON m.department_id = d.id
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.asset_id = $1 AND p.tenant_id = $2 AND p.is_active = ${IS_ACTIVE.ACTIVE}`,
      [assetId, tenantId],
    );

    if (row === null) return null;

    return mapPlanRowToApi(row);
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  /** Create a new maintenance plan */
  async createPlan(
    tenantId: number,
    userId: number,
    dto: CreateMaintenancePlanDto,
  ): Promise<TpmPlan> {
    this.logger.debug(`Creating plan "${dto.name}" for asset ${dto.assetUuid}`);

    const plan = await this.db.tenantTransaction(async (client: PoolClient): Promise<TpmPlan> => {
      // Resolve asset UUID → internal ID
      const assetId = await this.resolveAssetId(client, tenantId, dto.assetUuid);

      // Check uniqueness: one active plan per asset
      await this.ensureNoPlanForAsset(client, tenantId, assetId);

      // INSERT
      const uuid = uuidv7();
      const result = await client.query<TpmPlanJoinRow>(
        `INSERT INTO tpm_maintenance_plans
             (uuid, tenant_id, asset_id, name, base_weekday, base_repeat_every,
              base_time, buffer_hours, notes, created_by, is_active,
              approval_version, revision_minor)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, 0, 0)
           RETURNING *`,
        [
          uuid,
          tenantId,
          assetId,
          dto.name,
          dto.baseWeekday,
          dto.baseRepeatEvery,
          dto.baseTime ?? null,
          dto.bufferHours,
          dto.notes ?? null,
          userId,
        ],
      );

      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('INSERT into tpm_maintenance_plans returned no rows');
      }

      // Create v0.0 revision snapshot (initial baseline, pending approval)
      await insertRevisionSnapshot(client, tenantId, row, 1, 0, 0, userId, 'Initial version', []);

      return mapPlanRowToApi(row);
    });

    void this.activityLogger.logCreate(
      tenantId,
      userId,
      'tpm_plan',
      plan.assetId,
      `TPM-Wartungsplan erstellt (v1): ${plan.name}`,
      { planUuid: plan.uuid, assetName: plan.assetName },
    );

    return plan;
  }

  /** Update an existing maintenance plan */
  async updatePlan(
    tenantId: number,
    userId: number,
    planUuid: string,
    dto: UpdateMaintenancePlanDto,
  ): Promise<TpmPlan> {
    const plan = await this.db.tenantTransaction(async (client: PoolClient): Promise<TpmPlan> => {
      // Lock the row
      const existing = await this.lockPlanByUuid(client, tenantId, planUuid);

      // Build dynamic SET clause
      const { setClauses, params, nextParamIndex } = buildPlanUpdateFields(
        dto as Record<string, unknown>,
      );

      if (setClauses.length === 0) {
        return mapPlanRowToApi(existing);
      }

      // Detect which fields actually changed (values differ, not just provided)
      const changedFields = detectChangedFields(existing, dto as Record<string, unknown>);

      if (changedFields.length === 0) {
        // Fields provided but values identical → no revision needed
        return mapPlanRowToApi(existing);
      }

      const newRevision = existing.revision_number + 1;
      const newMinor = existing.revision_minor + 1;

      // Append revision_number + revision_minor + WHERE params
      setClauses.push(`revision_number = $${nextParamIndex}`);
      params.push(newRevision);
      setClauses.push(`revision_minor = $${nextParamIndex + 1}`);
      params.push(newMinor);
      const whereIdx = nextParamIndex + 2;
      params.push(planUuid, tenantId);
      const sql = `UPDATE tpm_maintenance_plans
                     SET ${setClauses.join(', ')}, updated_at = NOW()
                     WHERE uuid = $${whereIdx} AND tenant_id = $${whereIdx + 1} AND is_active = ${IS_ACTIVE.ACTIVE}
                     RETURNING *`;

      const result = await client.query<TpmPlanJoinRow>(sql, params);
      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('UPDATE tpm_maintenance_plans returned no rows');
      }

      // Create revision snapshot of NEW state
      await insertRevisionSnapshot(
        client,
        tenantId,
        row,
        newRevision,
        existing.approval_version,
        newMinor,
        userId,
        dto.changeReason ?? null,
        changedFields,
      );

      return mapPlanRowToApi(row);
    });

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'tpm_plan',
      plan.assetId,
      `TPM-Wartungsplan aktualisiert (v${plan.revisionNumber}): ${plan.name}`,
      { planUuid, changedFields: dto },
      dto as Record<string, unknown>,
    );

    return plan;
  }

  /** Soft-delete a maintenance plan (is_active = 4) */
  async deletePlan(tenantId: number, userId: number, planUuid: string): Promise<void> {
    const plan = await this.db.tenantTransaction(async (client: PoolClient): Promise<TpmPlan> => {
      const existing = await this.lockPlanByUuid(client, tenantId, planUuid);

      await client.query(
        `UPDATE tpm_maintenance_plans
           SET is_active = ${IS_ACTIVE.DELETED}, updated_at = NOW()
           WHERE uuid = $1 AND tenant_id = $2`,
        [planUuid, tenantId],
      );

      return mapPlanRowToApi(existing);
    });

    void this.activityLogger.logDelete(
      tenantId,
      userId,
      'tpm_plan',
      plan.assetId,
      `TPM-Wartungsplan gelöscht: ${plan.name}`,
      { planUuid, assetName: plan.assetName },
    );
  }

  /** Archive a maintenance plan (is_active = 3) */
  async archivePlan(tenantId: number, userId: number, planUuid: string): Promise<TpmPlan> {
    const plan = await this.db.tenantTransaction(async (client: PoolClient): Promise<TpmPlan> => {
      const existing = await this.lockPlanByUuid(client, tenantId, planUuid);

      await client.query(
        `UPDATE tpm_maintenance_plans
           SET is_active = ${IS_ACTIVE.ARCHIVED}, updated_at = NOW()
           WHERE uuid = $1 AND tenant_id = $2`,
        [planUuid, tenantId],
      );

      return mapPlanRowToApi(existing);
    });

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'tpm_plan',
      plan.assetId,
      `TPM-Wartungsplan archiviert: ${plan.name}`,
      { planUuid, assetName: plan.assetName },
      { isActive: 3 },
    );

    return plan;
  }

  /** Unarchive a maintenance plan (is_active = 1) */
  async unarchivePlan(tenantId: number, userId: number, planUuid: string): Promise<TpmPlan> {
    const plan = await this.db.tenantTransaction(async (client: PoolClient): Promise<TpmPlan> => {
      const existing = await this.lockPlanByUuidAnyStatus(client, tenantId, planUuid);

      if (existing.is_active !== 3) {
        throw new ConflictException('Nur archivierte Pläne können wiederhergestellt werden');
      }

      // Ensure no other active plan exists for the same asset
      await this.ensureNoPlanForAsset(client, tenantId, existing.asset_id);

      await client.query(
        `UPDATE tpm_maintenance_plans
           SET is_active = ${IS_ACTIVE.ACTIVE}, updated_at = NOW()
           WHERE uuid = $1 AND tenant_id = $2`,
        [planUuid, tenantId],
      );

      return mapPlanRowToApi(existing);
    });

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'tpm_plan',
      plan.assetId,
      `TPM-Wartungsplan wiederhergestellt: ${plan.name}`,
      { planUuid, assetName: plan.assetName },
      { isActive: 1 },
    );

    return plan;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /** Resolve asset UUID to internal ID within a transaction */
  private async resolveAssetId(
    client: PoolClient,
    tenantId: number,
    assetUuid: string,
  ): Promise<number> {
    const result = await client.query<{ id: number }>(
      `SELECT id FROM assets WHERE uuid = $1 AND tenant_id = $2`,
      [assetUuid, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Anlage ${assetUuid} nicht gefunden`);
    }
    return row.id;
  }

  /** Ensure no active plan exists for this asset (UNIQUE constraint guard) */
  private async ensureNoPlanForAsset(
    client: PoolClient,
    tenantId: number,
    assetId: number,
  ): Promise<void> {
    const result = await client.query<{ uuid: string }>(
      `SELECT uuid FROM tpm_maintenance_plans
       WHERE tenant_id = $1 AND asset_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [tenantId, assetId],
    );
    if (result.rows[0] !== undefined) {
      throw new ConflictException('Für diese Anlage existiert bereits ein aktiver Wartungsplan');
    }
  }

  /** Lock a plan row by UUID for safe mutation (SELECT ... FOR UPDATE) */
  private async lockPlanByUuid(
    client: PoolClient,
    tenantId: number,
    planUuid: string,
  ): Promise<TpmPlanJoinRow> {
    const result = await client.query<TpmPlanJoinRow>(
      `SELECT * FROM tpm_maintenance_plans
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
       FOR UPDATE`,
      [planUuid, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Wartungsplan ${planUuid} nicht gefunden`);
    }
    return row;
  }

  /** Lock a plan row regardless of is_active status (for unarchive) */
  private async lockPlanByUuidAnyStatus(
    client: PoolClient,
    tenantId: number,
    planUuid: string,
  ): Promise<TpmPlanJoinRow> {
    const result = await client.query<TpmPlanJoinRow>(
      `SELECT * FROM tpm_maintenance_plans
       WHERE uuid = $1 AND tenant_id = $2 AND is_active IN (${IS_ACTIVE.ACTIVE}, ${IS_ACTIVE.ARCHIVED})
       FOR UPDATE`,
      [planUuid, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Wartungsplan ${planUuid} nicht gefunden`);
    }
    return row;
  }
}

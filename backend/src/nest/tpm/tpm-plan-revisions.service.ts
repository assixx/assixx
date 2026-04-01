/**
 * TPM Plan Revisions Service — Read-only access to plan revision history
 *
 * Immutable revision snapshots for ISO 9001 Chapter 7.5.3 compliance.
 * No mutations — revisions are created by TpmPlansService on create/update.
 */
import { Injectable, NotFoundException } from '@nestjs/common';

import { toIsoString } from '../../utils/db-helpers.js';
import { DatabaseService } from '../database/database.service.js';
import type { TpmPlanRevision, TpmPlanRevisionList, TpmPlanRevisionRow } from './tpm.types.js';

/** Extended row type including JOIN columns */
interface RevisionJoinRow extends TpmPlanRevisionRow {
  changed_by_name: string;
  asset_name: string;
  plan_name: string;
  plan_uuid: string;
  current_revision_number: number;
  total_count: string;
}

function mapRevisionRowToApi(row: RevisionJoinRow): TpmPlanRevision {
  return {
    uuid: row.uuid.trim(),
    revisionNumber: row.revision_number,
    approvalVersion: row.approval_version,
    revisionMinor: row.revision_minor,
    name: row.name,
    assetId: row.asset_id,
    baseWeekday: row.base_weekday,
    baseRepeatEvery: row.base_repeat_every,
    baseTime: row.base_time,
    bufferHours: Number(row.buffer_hours),
    notes: row.notes,
    changedBy: row.changed_by,
    changedByName: row.changed_by_name,
    changeReason: row.change_reason,
    changedFields: row.changed_fields,
    createdAt: toIsoString(row.created_at),
  };
}

@Injectable()
export class TpmPlanRevisionsService {
  constructor(private readonly db: DatabaseService) {}

  async listRevisions(
    tenantId: number,
    planUuid: string,
    page: number,
    limit: number,
  ): Promise<TpmPlanRevisionList> {
    // Verify plan exists and get current info
    const plan = await this.db.queryOne<{
      id: number;
      name: string;
      revision_number: number;
      approval_version: number;
      revision_minor: number;
      asset_name: string;
    }>(
      `SELECT p.id, p.name, p.revision_number, p.approval_version, p.revision_minor,
              COALESCE(a.name, 'Unbekannt') AS asset_name
       FROM tpm_maintenance_plans p
       LEFT JOIN assets a ON a.id = p.asset_id
       WHERE p.uuid = $1 AND p.tenant_id = $2 AND p.is_active IN (0, 1, 3)`,
      [planUuid, tenantId],
    );

    if (!plan) {
      throw new NotFoundException(`Wartungsplan ${planUuid} nicht gefunden`);
    }

    const offset = (page - 1) * limit;

    // Count total revisions
    const countResult = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM tpm_plan_revisions
       WHERE plan_id = $1 AND tenant_id = $2`,
      [plan.id, tenantId],
    );

    const total = Number(countResult?.count ?? '0');

    // Fetch revisions with user names, newest first
    const rows = await this.db.query<RevisionJoinRow>(
      `SELECT r.*,
              COALESCE(NULLIF(CONCAT(u.first_name, ' ', u.last_name), ' '), u.username) AS changed_by_name,
              COALESCE(a.name, 'Unbekannt') AS asset_name,
              $3::text AS plan_name,
              $4::text AS plan_uuid,
              $5::integer AS current_revision_number,
              '0' AS total_count
       FROM tpm_plan_revisions r
       LEFT JOIN users u ON u.id = r.changed_by
       LEFT JOIN assets a ON a.id = r.asset_id
       WHERE r.plan_id = $1 AND r.tenant_id = $2
       ORDER BY r.revision_number DESC
       LIMIT $6 OFFSET $7`,
      [plan.id, tenantId, plan.name, planUuid, plan.revision_number, limit, offset],
    );

    return {
      currentVersion: plan.revision_number,
      currentApprovalVersion: plan.approval_version,
      currentRevisionMinor: plan.revision_minor,
      planName: plan.name,
      assetName: plan.asset_name,
      revisions: rows.map(mapRevisionRowToApi),
      total,
    };
  }

  async getRevision(tenantId: number, revisionUuid: string): Promise<TpmPlanRevision> {
    const row = await this.db.queryOne<RevisionJoinRow>(
      `SELECT r.*,
              COALESCE(NULLIF(CONCAT(u.first_name, ' ', u.last_name), ' '), u.username) AS changed_by_name,
              COALESCE(a.name, 'Unbekannt') AS asset_name,
              '' AS plan_name,
              '' AS plan_uuid,
              0 AS current_revision_number,
              '0' AS total_count
       FROM tpm_plan_revisions r
       LEFT JOIN users u ON u.id = r.changed_by
       LEFT JOIN assets a ON a.id = r.asset_id
       WHERE r.uuid = $1 AND r.tenant_id = $2`,
      [revisionUuid, tenantId],
    );

    if (!row) {
      throw new NotFoundException(`Revision ${revisionUuid} nicht gefunden`);
    }

    return mapRevisionRowToApi(row);
  }
}

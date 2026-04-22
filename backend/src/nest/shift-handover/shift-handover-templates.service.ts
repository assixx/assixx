/**
 * Shift Handover — Templates Service (Plan §2.2).
 *
 * Manages per-team handover templates. One active row per (tenant, team),
 * enforced by the `UNIQUE (tenant_id, team_id)` constraint from Phase 1.
 * Idempotent upsert (single endpoint for create + update); soft-delete via
 * `is_active = IS_ACTIVE.INACTIVE`.
 *
 * Validation boundary:
 *  - DTO layer (`CreateTemplateDto`, `UpdateTemplateDto`) runs the shared
 *    Zod schema first — 30-field cap, duplicate-key rejection, per-type
 *    invariants, `key` regex `/^[a-z][a-z0-9_]*$/`. Plan §R7 mandates a
 *    single source of truth; the service RE-PARSES for defense-in-depth
 *    so internal callers (future cron jobs, imports, scripts) that skip
 *    the HTTP pipeline still cannot persist malformed `fields`
 *    (Power-of-Ten Rule 5 — min 2 assertions per function).
 *
 * Tenant isolation:
 *  - All statements run inside `tenantQuery()` / `tenantTransaction()` on
 *    the `app_user` pool with strict-mode RLS (ADR-019). Cross-tenant
 *    access is impossible at the DB engine level. The explicit
 *    `tenant_id` column write uses `current_setting('app.tenant_id', ...)`
 *    so the INSERT's value necessarily matches the RLS policy's value —
 *    no risk of caller passing a mismatched tenantId.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.2
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  type ShiftHandoverFieldDef,
  ShiftHandoverTemplateFieldsSchema,
} from '@assixx/shared/shift-handover';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { getErrorMessage } from '../common/index.js';
import { DatabaseService } from '../database/database.service.js';
import type { ShiftHandoverTemplateRow } from './shift-handover.types.js';

/**
 * Canonical SQL fragment for "tenant_id derived from the current RLS
 * session". Mirrors the policy's `NULLIF(current_setting(...), '')`
 * pattern verbatim so INSERT-target === policy-check value.
 */
const TENANT_ID_FROM_RLS = `NULLIF(current_setting('app.tenant_id', true), '')::integer`;

@Injectable()
export class ShiftHandoverTemplatesService {
  private readonly logger = new Logger(ShiftHandoverTemplatesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Returns the active template row for a team, or `null` if none exists.
   * Controller (Phase 2.6) may synthesise an empty `{ fields: [] }`
   * default for the GET response — the service stays honest.
   */
  async getTemplateForTeam(teamId: number): Promise<ShiftHandoverTemplateRow | null> {
    this.logger.debug(`getTemplateForTeam team=${teamId}`);
    const rows = await this.db.tenantQuery<ShiftHandoverTemplateRow>(
      `SELECT *
         FROM shift_handover_templates
        WHERE team_id = $1
          AND is_active = $2`,
      [teamId, IS_ACTIVE.ACTIVE],
    );
    return rows[0] ?? null;
  }

  /**
   * Idempotent upsert. First call INSERTs; subsequent calls UPDATE
   * `fields`/`updated_*` in place; a previously soft-deleted row is
   * revived by flipping `is_active` back to `IS_ACTIVE.ACTIVE`.
   *
   * Contract:
   *  - `fields` re-validated via shared schema (defense in depth).
   *  - Target `teamId` must exist in the caller's tenant (RLS-filtered
   *    pre-check; prevents silent FK rejection with an opaque SQLSTATE
   *    23503 and gives the caller a readable message).
   */
  async upsertTemplate(
    teamId: number,
    fields: ShiftHandoverFieldDef[],
    userId: number,
  ): Promise<ShiftHandoverTemplateRow> {
    this.logger.debug(`upsertTemplate team=${teamId} fields=${fields.length}`);
    this.validateFields(fields);
    return await this.db.tenantTransaction(async (client: PoolClient) => {
      const teamCheck = await client.query<{ id: number }>(`SELECT id FROM teams WHERE id = $1`, [
        teamId,
      ]);
      if (teamCheck.rowCount === 0) {
        throw new BadRequestException(`Team ${teamId} does not exist in this tenant`);
      }
      const upsert = await client.query<ShiftHandoverTemplateRow>(
        `INSERT INTO shift_handover_templates
           (tenant_id, team_id, fields, is_active, created_by, updated_by)
         VALUES (${TENANT_ID_FROM_RLS}, $1, $2::jsonb, $3, $4, $4)
         ON CONFLICT (tenant_id, team_id) DO UPDATE SET
           fields      = EXCLUDED.fields,
           is_active   = $3,
           updated_at  = now(),
           updated_by  = EXCLUDED.updated_by
         RETURNING *`,
        [teamId, JSON.stringify(fields), IS_ACTIVE.ACTIVE, userId],
      );
      const row = upsert.rows[0];
      if (row === undefined) {
        // Should be impossible: RETURNING always yields one row on success,
        // and RLS/CHECK violations surface as thrown errors upstream.
        throw new Error('Template upsert returned no row');
      }
      return row;
    });
  }

  /**
   * Soft-delete the active template. Throws `NotFoundException` when no
   * active row exists so callers can distinguish "already gone" from
   * "silently succeeded". RLS guarantees tenant isolation on the UPDATE.
   */
  async deleteTemplate(teamId: number, userId: number): Promise<void> {
    this.logger.debug(`deleteTemplate team=${teamId}`);
    const updated = await this.db.tenantQuery<{ id: string }>(
      `UPDATE shift_handover_templates
          SET is_active  = $1,
              updated_at = now(),
              updated_by = $2
        WHERE team_id   = $3
          AND is_active = $4
        RETURNING id`,
      [IS_ACTIVE.INACTIVE, userId, teamId, IS_ACTIVE.ACTIVE],
    );
    if (updated.length === 0) {
      throw new NotFoundException(`No active template found for team ${teamId}`);
    }
  }

  /**
   * Re-validate the fields array through the shared schema. In practice
   * the DTO layer already ran this check; the duplication exists so that
   * non-HTTP callers (cron, admin scripts, future migrations) cannot
   * persist malformed data.
   */
  private validateFields(fields: ShiftHandoverFieldDef[]): void {
    const result = ShiftHandoverTemplateFieldsSchema.safeParse(fields);
    if (!result.success) {
      throw new BadRequestException(`Invalid template fields: ${getErrorMessage(result.error)}`);
    }
  }
}

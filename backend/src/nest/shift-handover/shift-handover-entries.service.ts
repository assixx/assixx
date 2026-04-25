/**
 * Shift Handover — Entries Service (Plan §2.5, the heart).
 *
 * Owns the full lifecycle of `shift_handover_entries` rows:
 *
 *  - `getOrCreateDraft` — idempotent per `(tenant, team, date, slot)`;
 *    race-safe via `INSERT … ON CONFLICT DO NOTHING RETURNING *` plus a
 *    fallback SELECT when a concurrent request wins the UNIQUE. The
 *    caller's write-window is validated through the resolver
 *    (§2.3/R1/R5) before any INSERT.
 *
 *  - `updateDraft` — patches `protocol_text` and/or `custom_values` on a
 *    row in a mutable status. `custom_values` is re-parsed through a
 *    Zod schema built from the **live** template (R7 — single source
 *    of truth across BE + FE). Submitted entries reject all edits.
 *
 *    Plan deviation (documented): §2.5 text says "only if status='draft'",
 *    but §2.5 `reopenEntry` also says reopened entries "allow further
 *    edits until next submit". Reading the two together: mutable status
 *    set = `{draft, reopened}`. Restricting updates to `draft` only
 *    would make reopen pointless. MUTABLE_ENTRY_STATUSES captures this
 *    reconciliation.
 *
 *  - `submitEntry` — tx + `SELECT … FOR UPDATE` row lock (R3); snapshots
 *    the current template's `fields` into `schema_snapshot` (R2 drift
 *    safety); flips `status → 'submitted'`; writes audit entry via
 *    `ActivityLoggerService`.
 *
 *  - `reopenEntry` — Team-Lead only (enforced at the controller via
 *    `@RequirePermission` + `canManage`); `submitted → reopened`; audit.
 *
 *  - `listEntriesForTeam` — paginated with window-function total count
 *    (`count(*) OVER ()`) so we keep it at one query per page.
 *
 *  - `getEntry` — fetches by id, RLS-scoped. Same-team filter is a
 *    controller concern (depends on `orgScope` which is not in service
 *    land).
 *
 *  - `runAutoLockSweep(nowUtc)` — cross-tenant bulk UPDATE via
 *    `systemTransaction` (sys_user, BYPASSRLS, ADR-019). Matches drafts
 *    where `(shift_date + shift_times.end_time) AT TIME ZONE
 *    'Europe/Berlin' + 24h < nowUtc`. Snapshots the current template
 *    per matched row. Auto-locked rows carry `submitted_by = NULL`
 *    (sentinel for "system-auto").
 *
 * Clock injection: `SHIFT_HANDOVER_CLOCK` (plan §2.3 purity hard rule
 * extended to §2.5). `new Date()` appears nowhere in this file — tests
 * bind a fixed instant so night-shift edge cases and auto-lock windows
 * are deterministic.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.5 + §R2/R3/R5
 * @see docs/infrastructure/adr/ADR-007-api-response-standardization.md
 * @see docs/infrastructure/adr/ADR-009-central-audit-logging.md
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { type ShiftHandoverFieldDef } from '@assixx/shared/shift-handover';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

import { getErrorMessage } from '../common/index.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ActiveShiftResolverService } from './active-shift-resolver.service.js';
// Zod schema lives backend-side per ADR-030 §7 — moved out of @assixx/shared
// 2026-04-23 (Spec Deviation #8) so the SvelteKit client never imports Zod.
import { buildEntryValuesSchema } from './field-validators.js';
import { ShiftHandoverTemplatesService } from './shift-handover-templates.service.js';
import { SHIFT_HANDOVER_CLOCK, type ShiftHandoverClock } from './shift-handover.tokens.js';
import type {
  ShiftHandoverEntryRow,
  ShiftHandoverEntryRowWithAuthor,
  ShiftHandoverEntryStatus,
  ShiftHandoverSlot,
} from './shift-handover.types.js';

/** `tenant_id` is sourced from the RLS GUC inside INSERT so the value
 *  always matches the policy check. Mirrors the same fragment in the
 *  Templates service. */
const TENANT_ID_FROM_RLS = `NULLIF(current_setting('app.tenant_id', true), '')::integer`;

/** Statuses that permit draft edits + (re-)submission. `submitted` is a
 *  terminal state until a Team-Lead calls `reopenEntry`. */
const MUTABLE_ENTRY_STATUSES: readonly ShiftHandoverEntryStatus[] = ['draft', 'reopened'];

/** Statuses from which `reopenEntry` may transition. V1 only supports
 *  reopening a submitted entry; reopening an already-reopened row is a
 *  no-op by design (no status transition needed). */
const REOPENABLE_STATUSES: readonly ShiftHandoverEntryStatus[] = ['submitted'];

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 20;

/**
 * German user-facing messages for the 3 write-denied reasons from the
 * resolver's `ShiftHandoverWriteDecision`. Surfaced verbatim to the UI
 * via the global toast component — the `/shift-handover/new` SSR loader
 * forwards the text as a `handover-error` query param on /shifts (see
 * Session 15 modal → page migration, 2026-04-23).
 *
 * Kept here, not in the resolver, so the resolver stays UI-agnostic and
 * can be reused for other callers (e.g. a future red-border hint on the
 * shift-grid button — plan §5.1 Spec Deviation #7).
 *
 * Smoke-test finding 2026-04-23: the prior single English message
 * "User may not create a draft for this shift right now" conflated all
 * three causes and leaked English into the UI. This table splits them
 * so the user learns WHICH cause applies.
 */
const WRITE_DENIED_MESSAGES: Record<
  'not_assignee' | 'outside_window' | 'shift_times_missing',
  string
> = {
  not_assignee: 'Du bist für diese Schicht nicht eingeteilt.',
  outside_window:
    'Bearbeitung nicht mehr möglich — Übergaben können nur während der Schicht oder bis zu 24 Stunden nach Schichtende erstellt werden.',
  shift_times_missing:
    'Schichtzeiten sind für diese Schicht nicht hinterlegt — bitte beim Team-Lead melden.',
};

export interface UpdateDraftInput {
  protocolText?: string;
  customValues?: Record<string, unknown>;
}

export interface ListEntriesQuery {
  page?: number;
  limit?: number;
  status?: ShiftHandoverEntryStatus;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export interface ListEntriesResult {
  items: ShiftHandoverEntryRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AutoLockSweepResult {
  lockedCount: number;
  lockedIds: string[];
}

/** Extends the row type with the `COUNT(*) OVER()` window total for
 *  one-query pagination. */
type EntryRowWithTotal = ShiftHandoverEntryRow & { total: string };

@Injectable()
export class ShiftHandoverEntriesService {
  private readonly logger = new Logger(ShiftHandoverEntriesService.name);

  constructor(
    private readonly db: DatabaseService,
    @Inject(SHIFT_HANDOVER_CLOCK) private readonly clock: ShiftHandoverClock,
    private readonly templates: ShiftHandoverTemplatesService,
    private readonly resolver: ActiveShiftResolverService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ────────────────────────────────────────────────────────────────────
  // Public methods
  // ────────────────────────────────────────────────────────────────────

  async getOrCreateDraft(
    tenantId: number,
    teamId: number,
    shiftDate: Date,
    shiftKey: ShiftHandoverSlot,
    userId: number,
  ): Promise<ShiftHandoverEntryRow> {
    const shiftDateStr = toIsoDateUtc(shiftDate);
    this.logger.debug(
      `getOrCreateDraft tenant=${tenantId} team=${teamId} date=${shiftDateStr} slot=${shiftKey} user=${userId}`,
    );
    return await this.db.tenantTransaction(async (client: PoolClient) => {
      await this.assertShiftKeyConfigured(client, shiftKey);
      const existing = await this.findEntry(client, teamId, shiftDateStr, shiftKey);
      if (existing !== null) {
        return existing;
      }
      await this.assertWriteAllowed(tenantId, teamId, shiftDate, shiftKey, userId);
      return await this.insertDraftOrFetch(client, teamId, shiftDateStr, shiftKey, userId);
    });
  }

  async updateDraft(
    entryId: string,
    dto: UpdateDraftInput,
    userId: number,
  ): Promise<ShiftHandoverEntryRow> {
    this.logger.debug(`updateDraft entry=${entryId} user=${userId}`);
    return await this.db.tenantTransaction(async (client: PoolClient) => {
      const entry = await this.loadEntryForUpdate(client, entryId);
      if (!MUTABLE_ENTRY_STATUSES.includes(entry.status)) {
        throw new BadRequestException(`Entry is locked (status=${entry.status})`);
      }
      if (dto.customValues !== undefined) {
        await this.validateCustomValues(entry.team_id, dto.customValues, 'draft');
      }
      const nextProtocol = dto.protocolText ?? entry.protocol_text;
      const nextCustom = dto.customValues ?? entry.custom_values;
      const updated = await client.query<ShiftHandoverEntryRow>(
        `UPDATE shift_handover_entries
            SET protocol_text = $1,
                custom_values = $2::jsonb,
                updated_at    = now(),
                updated_by    = $3
          WHERE id = $4
          RETURNING *`,
        [nextProtocol, JSON.stringify(nextCustom), userId, entryId],
      );
      return requireRow(updated, 'updateDraft');
    });
  }

  async submitEntry(entryId: string, userId: number): Promise<ShiftHandoverEntryRow> {
    this.logger.debug(`submitEntry entry=${entryId} user=${userId}`);
    return await this.db.tenantTransaction(async (client: PoolClient) => {
      const entry = await this.loadEntryForUpdate(client, entryId);
      if (!MUTABLE_ENTRY_STATUSES.includes(entry.status)) {
        throw new BadRequestException(`Entry is already ${entry.status}; cannot re-submit`);
      }
      const fields = await this.resolveSnapshotFields(entry.team_id);
      // Submit is strict: every required field MUST be present + pass type
      // validation. Drafts use the lenient `'draft'` mode in updateDraft; the
      // gate flips to strict only at submit-time. See Session 23.
      const parsed = buildEntryValuesSchema(fields, 'strict').safeParse(entry.custom_values);
      if (!parsed.success) {
        throw new BadRequestException(
          `custom_values fails template validation: ${getErrorMessage(parsed.error)}`,
        );
      }
      const updated = await client.query<ShiftHandoverEntryRow>(
        `UPDATE shift_handover_entries
            SET status          = 'submitted'::shift_handover_status,
                schema_snapshot = $1::jsonb,
                submitted_at    = now(),
                submitted_by    = $2,
                updated_at      = now(),
                updated_by      = $2
          WHERE id = $3
          RETURNING *`,
        [JSON.stringify(fields), userId, entryId],
      );
      const row = requireRow(updated, 'submitEntry');
      this.logSubmit(row, userId);
      return row;
    });
  }

  async reopenEntry(
    entryId: string,
    userId: number,
    reason: string,
  ): Promise<ShiftHandoverEntryRow> {
    this.logger.debug(`reopenEntry entry=${entryId} user=${userId}`);
    return await this.db.tenantTransaction(async (client: PoolClient) => {
      const entry = await this.loadEntryForUpdate(client, entryId);
      if (!REOPENABLE_STATUSES.includes(entry.status)) {
        throw new BadRequestException(
          `Only submitted entries can be reopened (status=${entry.status})`,
        );
      }
      const updated = await client.query<ShiftHandoverEntryRow>(
        `UPDATE shift_handover_entries
            SET status        = 'reopened'::shift_handover_status,
                reopened_at   = now(),
                reopened_by   = $1,
                reopen_reason = $2,
                updated_at    = now(),
                updated_by    = $1
          WHERE id = $3
          RETURNING *`,
        [userId, reason, entryId],
      );
      const row = requireRow(updated, 'reopenEntry');
      this.logReopen(row, userId, reason);
      return row;
    });
  }

  async listEntriesForTeam(teamId: number, query: ListEntriesQuery): Promise<ListEntriesResult> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? DEFAULT_LIST_LIMIT), MAX_LIST_LIMIT);
    const offset = (page - 1) * limit;
    const { whereSql, params } = buildListFilters(teamId, query);
    params.push(limit, offset);
    const rows = await this.db.tenantQuery<EntryRowWithTotal>(
      `SELECT *, COUNT(*) OVER() AS total
         FROM shift_handover_entries
        WHERE ${whereSql}
        ORDER BY shift_date DESC, shift_key ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const total = rows[0] ? Number(rows[0].total) : 0;
    const items = rows.map(stripTotal);
    return { items, total, page, limit };
  }

  /**
   * Single-entry detail read with the author display name JOINed in.
   *
   * `created_by_name` denormalises `users.first_name + ' ' + last_name` (or
   * `email` if both name parts are blank) into the row so the detail page
   * can show "who had the shift" in the meta block without a second
   * round-trip. JOIN runs through `tenantQuery` (app_user, RLS strict-mode
   * per ADR-019) so a foreign-tenant `users` row is impossible to surface.
   * `LEFT JOIN` so a soft-deleted creator (legacy data) doesn't 0-row the
   * entry — the meta just shows "Unbekannt" in that edge case.
   *
   * Resolves the Session-18 Known Limitation ("no assignee display on
   * the detail page" — modal era had grid state, page era did not).
   * Inventory items + KVP suggestions use the same JOIN pattern. Session 24.
   */
  async getEntry(entryId: string): Promise<ShiftHandoverEntryRowWithAuthor> {
    const rows = await this.db.tenantQuery<ShiftHandoverEntryRowWithAuthor>(
      `SELECT e.*,
              COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email)
                AS created_by_name
         FROM shift_handover_entries e
         LEFT JOIN users u ON u.id = e.created_by
        WHERE e.id = $1 AND e.is_active = $2`,
      [entryId, IS_ACTIVE.ACTIVE],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Entry ${entryId} not found`);
    }
    return row;
  }

  /**
   * Read-scope helper for the controller (plan §2.6 "same-team" filter).
   * Returns `true` iff the user has a `user_teams` row for the given team
   * in the current tenant. RLS tenant-filter is enforced automatically
   * (ADR-019).
   *
   * Scope resolution layering at the controller:
   *  1. `hasFullAccess || role === 'root'` short-circuits (ADR-010).
   *  2. `ScopeService.getScope().teamIds` covers management scope
   *     (leads + hierarchy-permission cascades).
   *  3. This method covers plain team membership (employees not in any
   *     lead position but assigned to the team via `user_teams`).
   *
   * Kept on EntriesService (not on a generic helper) because it mirrors
   * the module's existing `tenantQuery` usage and keeps the controller
   * free from direct `DatabaseService` wiring.
   */
  async isTeamMember(userId: number, teamId: number): Promise<boolean> {
    const rows = await this.db.tenantQuery<{ user_id: number }>(
      `SELECT user_id FROM user_teams WHERE user_id = $1 AND team_id = $2 LIMIT 1`,
      [userId, teamId],
    );
    return rows.length > 0;
  }

  /**
   * Cross-tenant bulk auto-lock. Runs on sys_user (BYPASSRLS) — the only
   * method in this service that does, because the sweep is intentionally
   * tenant-agnostic. Snapshots the current template per matched row via
   * correlated subquery. Matched rows get `submitted_by = NULL` as the
   * "system auto-locked" sentinel (column is nullable, plan §1.2).
   */
  async runAutoLockSweep(nowUtc: Date): Promise<AutoLockSweepResult> {
    this.logger.debug(`runAutoLockSweep nowUtc=${nowUtc.toISOString()}`);
    return await this.db.systemTransaction(async (client: PoolClient) => {
      const result = await client.query<{ id: string }>(
        `UPDATE shift_handover_entries e
            SET status          = 'submitted'::shift_handover_status,
                submitted_at    = $1::timestamptz,
                schema_snapshot = COALESCE(
                  (SELECT fields
                     FROM shift_handover_templates t
                    WHERE t.tenant_id = e.tenant_id
                      AND t.team_id   = e.team_id
                      AND t.is_active = 1),
                  '[]'::jsonb
                ),
                updated_at      = now()
           FROM shift_times st
          WHERE st.tenant_id  = e.tenant_id
            AND st.shift_key  = e.shift_key
            AND st.is_active  = 1
            AND e.status      = 'draft'::shift_handover_status
            AND e.is_active   = 1
            AND ((e.shift_date + st.end_time) AT TIME ZONE 'Europe/Berlin' + interval '24 hours')
                < $1::timestamptz
          RETURNING e.id`,
        [nowUtc.toISOString()],
      );
      const lockedIds = result.rows.map((r: { id: string }) => r.id);
      return { lockedCount: lockedIds.length, lockedIds };
    });
  }

  // ────────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────────

  private async assertShiftKeyConfigured(
    client: PoolClient,
    shiftKey: ShiftHandoverSlot,
  ): Promise<void> {
    const res = await client.query<{ id: number }>(
      `SELECT id FROM shift_times WHERE shift_key = $1 AND is_active = $2`,
      [shiftKey, IS_ACTIVE.ACTIVE],
    );
    if (res.rowCount === 0) {
      throw new BadRequestException(
        `shift_times not configured for slot "${shiftKey}" in this tenant`,
      );
    }
  }

  private async findEntry(
    client: PoolClient,
    teamId: number,
    shiftDateIso: string,
    shiftKey: ShiftHandoverSlot,
  ): Promise<ShiftHandoverEntryRow | null> {
    const res = await client.query<ShiftHandoverEntryRow>(
      `SELECT * FROM shift_handover_entries
        WHERE team_id    = $1
          AND shift_date = $2::date
          AND shift_key  = $3
          AND is_active  = $4`,
      [teamId, shiftDateIso, shiftKey, IS_ACTIVE.ACTIVE],
    );
    return res.rows[0] ?? null;
  }

  private async assertWriteAllowed(
    tenantId: number,
    teamId: number,
    shiftDate: Date,
    shiftKey: ShiftHandoverSlot,
    userId: number,
  ): Promise<void> {
    const decision = await this.resolver.canWriteForShift({
      tenantId,
      teamId,
      shiftDate,
      shiftKey,
      userId,
      nowUtc: this.clock(),
    });
    if (!decision.allowed) {
      throw new ForbiddenException(WRITE_DENIED_MESSAGES[decision.reason]);
    }
  }

  /**
   * Race-safe INSERT. ON CONFLICT DO NOTHING lets a concurrent
   * transaction win; on that path our RETURNING yields nothing and we
   * re-fetch the committed row. The composite UNIQUE constraint is
   * intentionally non-DEFERRABLE — see Spec Deviation #5 in the
   * masterplan: PostgreSQL rejects ON CONFLICT against deferrable
   * constraints, which is why migration #145 dropped the original
   * DEFERRABLE INITIALLY IMMEDIATE clause.
   */
  private async insertDraftOrFetch(
    client: PoolClient,
    teamId: number,
    shiftDateIso: string,
    shiftKey: ShiftHandoverSlot,
    userId: number,
  ): Promise<ShiftHandoverEntryRow> {
    const inserted = await client.query<ShiftHandoverEntryRow>(
      `INSERT INTO shift_handover_entries
         (tenant_id, team_id, shift_date, shift_key, created_by, updated_by)
       VALUES (${TENANT_ID_FROM_RLS}, $1, $2::date, $3, $4, $4)
       ON CONFLICT (tenant_id, team_id, shift_date, shift_key) DO NOTHING
       RETURNING *`,
      [teamId, shiftDateIso, shiftKey, userId],
    );
    if (inserted.rows[0] !== undefined) {
      return inserted.rows[0];
    }
    const raced = await this.findEntry(client, teamId, shiftDateIso, shiftKey);
    if (raced === null) {
      throw new Error('Race: INSERT conflicted but existing row not visible');
    }
    return raced;
  }

  private async loadEntryForUpdate(
    client: PoolClient,
    entryId: string,
  ): Promise<ShiftHandoverEntryRow> {
    const res = await client.query<ShiftHandoverEntryRow>(
      `SELECT * FROM shift_handover_entries
        WHERE id = $1 AND is_active = $2
        FOR UPDATE`,
      [entryId, IS_ACTIVE.ACTIVE],
    );
    const row = res.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Entry ${entryId} not found`);
    }
    return row;
  }

  /**
   * Type-validates `custom_values` against the team's live template fields.
   *
   * `mode='draft'` (default for `updateDraft`) keeps every field optional —
   * a partial fill is valid; only provided values are type-checked. This is
   * the user-experience contract for drafts: incremental edits, no forced
   * completion (Session 23 finding 2026-04-25).
   *
   * `mode='strict'` is reserved for `submitEntry` — required fields MUST be
   * present and pass type validation; that's the gate that seals the entry.
   */
  private async validateCustomValues(
    teamId: number,
    values: Record<string, unknown>,
    mode: 'draft' | 'strict',
  ): Promise<void> {
    const fields = await this.resolveSnapshotFields(teamId);
    const parsed = buildEntryValuesSchema(fields, mode).safeParse(values);
    if (!parsed.success) {
      throw new BadRequestException(`Invalid custom_values: ${getErrorMessage(parsed.error)}`);
    }
  }

  /** Loads the live template fields, or `[]` when no template exists. */
  private async resolveSnapshotFields(teamId: number): Promise<ShiftHandoverFieldDef[]> {
    const template = await this.templates.getTemplateForTeam(teamId);
    return template?.fields ?? [];
  }

  private logSubmit(row: ShiftHandoverEntryRow, userId: number): void {
    void this.activityLogger.log({
      tenantId: row.tenant_id,
      userId,
      action: 'update',
      entityType: 'shift',
      details: `Schichtübergabe eingereicht (team=${row.team_id}, shift=${toIsoDateUtc(row.shift_date)}/${row.shift_key})`,
      newValues: { entryId: row.id, status: 'submitted' },
    });
  }

  private logReopen(row: ShiftHandoverEntryRow, userId: number, reason: string): void {
    void this.activityLogger.log({
      tenantId: row.tenant_id,
      userId,
      action: 'update',
      entityType: 'shift',
      details: `Schichtübergabe wiedergeöffnet (team=${row.team_id}, shift=${toIsoDateUtc(row.shift_date)}/${row.shift_key})`,
      newValues: { entryId: row.id, status: 'reopened', reason },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Module-level helpers (pure, not tied to instance state)
// ─────────────────────────────────────────────────────────────────────

/** See `ActiveShiftResolverService` for the correctness proof. Backend
 *  runs UTC in Docker; `DATE` columns surface as UTC-midnight Date
 *  objects whose UTC date equals the Berlin calendar date. */
function toIsoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Narrows a RETURNING query to a single row or throws — used to keep
 *  main method bodies flat and to surface impossible states as 500s
 *  rather than silent undefined. `T extends QueryResultRow` to match
 *  `pg`'s `QueryResult` constraint. */
function requireRow<T extends QueryResultRow>(result: QueryResult<T>, op: string): T {
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error(`${op} returned no row (should be impossible)`);
  }
  return row;
}

/** Builds a WHERE clause + param list from a list query. Extracted from
 *  `listEntriesForTeam` to keep that method under the 60-LOC cap. */
function buildListFilters(
  teamId: number,
  query: ListEntriesQuery,
): { whereSql: string; params: unknown[] } {
  const conditions: string[] = ['team_id = $1', 'is_active = $2'];
  const params: unknown[] = [teamId, IS_ACTIVE.ACTIVE];
  if (query.status !== undefined) {
    params.push(query.status);
    conditions.push(`status = $${params.length}::shift_handover_status`);
  }
  if (query.from !== undefined) {
    params.push(query.from);
    conditions.push(`shift_date >= $${params.length}::date`);
  }
  if (query.to !== undefined) {
    params.push(query.to);
    conditions.push(`shift_date <= $${params.length}::date`);
  }
  return { whereSql: conditions.join(' AND '), params };
}

/** Strips the `total` window-count from a combined row. `void total`
 *  consumes the binding so `no-unused-vars` stays happy; the
 *  leading-underscore rename trick isn't permitted under this repo's
 *  `@typescript-eslint/naming-convention` `variable` selector. */
function stripTotal(row: EntryRowWithTotal): ShiftHandoverEntryRow {
  const { total, ...rest } = row;
  void total;
  return rest;
}

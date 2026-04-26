/**
 * KVP Participants Sub-Service
 *
 * Manages co-originator ("Beteiligte") tagging for KVP suggestions. The
 * `kvp_participants` table is polymorphic — each row references EXACTLY ONE
 * of (user, team, department, area), enforced by the `exactly_one_target`
 * CHECK constraint at the DB level (migration 20260425234025136).
 *
 * V1 semantics (locked in 2026-04-26 — see masterplan §0):
 *  - Informational only: no permission grant, no notification, no creator-bypass extension.
 *  - Tenant-wide search by design (Q3): a tag is a reference, not a management
 *    action — ADR-036 organizational scope does not apply. RLS (ADR-019) is
 *    the security boundary.
 *  - Participants are immutable after create — `replaceParticipants` is only
 *    invoked from `KvpService.create()`. UpdateSuggestionDto deliberately does
 *    not accept the field (no Edit UI; see masterplan Known Limitations §1).
 *
 * Critical patterns enforced here:
 *  - All queries use $1, $2, … placeholders (no string concatenation).
 *  - IS_ACTIVE constants from `@assixx/shared/constants` (no magic numbers,
 *    architectural test enforces this — `shared/src/architectural.test.ts`).
 *  - `?? null` not `||` for nullable defaults.
 *  - Audit logging is fire-and-forget via `void` (matches KvpCommentsService
 *    pattern). The logger uses `queryAsTenant` which opens its own connection,
 *    so audit rows persist independently of the participant transaction.
 *  - Application-side UUIDv7 generation (HOW-TO-INTEGRATE-FEATURE convention,
 *    no DB-side default — Phase 1 migration confirmed).
 *
 * @see docs/FEAT_KVP_PARTICIPANTS_MASTERPLAN.md §2.2 — design contract
 * @see ../common/services/activity-logger.service.ts — audit log API
 * @see ./kvp.service.ts — Step 2.3 wires `create()` to call `replaceParticipants`
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { Participant } from './dto/participant.dto.js';

type ParticipantType = 'user' | 'team' | 'department' | 'area';

const PARTICIPANT_TYPES: readonly ParticipantType[] = [
  'user',
  'team',
  'department',
  'area',
] as const;

/** Map participant type → target table name (for validation queries). */
const TYPE_TO_TABLE: Record<ParticipantType, 'users' | 'teams' | 'departments' | 'areas'> = {
  user: 'users',
  team: 'teams',
  department: 'departments',
  area: 'areas',
};

/** Enriched participant row returned by `getParticipants` (used by detail view). */
export interface EnrichedParticipant {
  type: ParticipantType;
  id: number;
  label: string;
  sublabel: string;
}

/** One option row in the `/options` search response. */
export interface ParticipantOptionRow {
  id: number;
  label: string;
  sublabel: string;
}

/** Grouped response shape for the `/options` endpoint (Step 2.4 controller wires this). */
export interface ParticipantOptions {
  users: ParticipantOptionRow[];
  teams: ParticipantOptionRow[];
  departments: ParticipantOptionRow[];
  areas: ParticipantOptionRow[];
}

@Injectable()
export class KvpParticipantsService {
  private readonly logger = new Logger(KvpParticipantsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /**
   * Full-state replacement of a suggestion's participant list. DELETE-INSERT
   * semantic — the DB has no soft-delete on this relation table by design
   * (masterplan §1.2: relation-table semantic, not entity).
   *
   * @param client  Optional PoolClient. When provided, queries run inside the
   *                caller's transaction (RLS context already set by parent —
   *                see Step 2.3 where `KvpService.create()` passes its own
   *                transaction client to keep the suggestion-INSERT and the
   *                participants-INSERT atomic, closing risk R7). When omitted,
   *                this method opens its own `tenantTransaction()`.
   */
  async replaceParticipants(
    suggestionId: number,
    participants: Participant[],
    addedBy: number,
    client?: PoolClient,
  ): Promise<void> {
    if (client !== undefined) {
      await this.runReplace(client, suggestionId, participants, addedBy);
      return;
    }
    await this.db.tenantTransaction(async (txClient: PoolClient): Promise<void> => {
      await this.runReplace(txClient, suggestionId, participants, addedBy);
    });
  }

  /**
   * Six-step orchestration per masterplan §2.2. Single connection (`client`)
   * for the whole flow so RLS context propagates and rollback is atomic.
   */
  private async runReplace(
    client: PoolClient,
    suggestionId: number,
    input: Participant[],
    addedBy: number,
  ): Promise<void> {
    const tenantId = this.db.getTenantId();
    if (tenantId === undefined) {
      throw new Error('replaceParticipants called without tenantId in CLS context');
    }

    // Step 0 — pre-flight dedupe. The DB UNIQUE constraint would also reject,
    // but a friendly ConflictException beats a raw 500/duplicate-key error.
    this.assertNoDuplicates(input);

    // Step 1 — group by type (4 ID arrays).
    const grouped = this.groupByType(input);

    // Step 2-3 — validate every (type, id) exists and is not soft-deleted.
    // RLS (ADR-019) auto-filters to current tenant; cross-tenant IDs return as
    // "not found" → BadRequestException. Closes risk R6 (deleted users) and
    // contributes to R5 (mis-typed targets caught early).
    await this.validateTargets(client, grouped);

    // Step 4 — snapshot current participants before DELETE for the audit diff.
    const before = await this.snapshotParticipants(client, suggestionId);

    // Step 5 — wipe existing rows (RLS scopes to tenant).
    await client.query<QueryResultRow>(`DELETE FROM kvp_participants WHERE suggestion_id = $1`, [
      suggestionId,
    ]);

    // Step 6 — bulk insert new rows (skipped when input is empty).
    if (input.length > 0) {
      await this.insertParticipants(client, tenantId, suggestionId, input, addedBy);
    }

    // Step 7 — fire audit-log diff (one row per add/remove). Fire-and-forget
    // matches the existing KvpCommentsService.addComment pattern. The logger
    // uses queryAsTenant on a separate connection, so audit rows commit
    // independently of this participant transaction. Acceptable trade-off:
    // if the parent tx rolls back AFTER this point, we have orphan audit
    // rows — but `runReplace` returns immediately after, so the window is
    // microseconds and no observed parent-tx COMMIT failure mode exists.
    this.fireAuditDiff(suggestionId, addedBy, before, input);
  }

  /**
   * Reject duplicate (type, id) pairs in a single replace call. Each
   * participant may appear at most once per suggestion (masterplan
   * Known Limitations §6: self-tag allowed but idempotent).
   */
  private assertNoDuplicates(input: Participant[]): void {
    const seen = new Set<string>();
    for (const p of input) {
      const key = `${p.type}:${String(p.id)}`;
      if (seen.has(key)) {
        throw new ConflictException(
          `Duplicate participant ${p.type} #${String(p.id)} — each participant may be tagged only once per KVP-Vorschlag.`,
        );
      }
      seen.add(key);
    }
  }

  private groupByType(input: Participant[]): Record<ParticipantType, number[]> {
    const grouped: Record<ParticipantType, number[]> = {
      user: [],
      team: [],
      department: [],
      area: [],
    };
    for (const p of input) {
      grouped[p.type].push(p.id);
    }
    return grouped;
  }

  /**
   * For each type, fetch which input IDs actually exist & are not soft-deleted
   * within the current tenant. Compute `input - found` per type → if any entry
   * is missing, surface a field-level BadRequestException so the caller (and
   * eventually the UI) sees exactly which participant is invalid.
   */
  private async validateTargets(
    client: PoolClient,
    grouped: Record<ParticipantType, number[]>,
  ): Promise<void> {
    const invalid: { type: ParticipantType; id: number }[] = [];

    for (const type of PARTICIPANT_TYPES) {
      const ids = grouped[type];
      if (ids.length === 0) continue;

      const table = TYPE_TO_TABLE[type];
      // Inline table interpolation is safe — `table` is a closed enum value,
      // not user input. is_active interpolation uses the IS_ACTIVE constant
      // (architectural test exempts the constant interpolation pattern).
      const result = await client.query<{ id: number }>(
        `SELECT id FROM ${table}
            WHERE id = ANY($1::int[])
              AND is_active != ${IS_ACTIVE.DELETED}`,
        [ids],
      );
      const found = new Set<number>(result.rows.map((r: { id: number }): number => r.id));

      for (const id of ids) {
        if (!found.has(id)) invalid.push({ type, id });
      }
    }

    if (invalid.length > 0) {
      throw new BadRequestException({
        message: 'Ungültige Beteiligte',
        code: 'INVALID_PARTICIPANTS',
        details: invalid.map(
          (
            e: { type: ParticipantType; id: number },
            idx: number,
          ): { field: string; message: string } => ({
            field: `participants[${String(idx)}]`,
            message: `${e.type} #${String(e.id)} nicht gefunden oder inaktiv in diesem Mandanten`,
          }),
        ),
      });
    }
  }

  /** Read the current participant rows and lift them back into Participant shape. */
  private async snapshotParticipants(
    client: PoolClient,
    suggestionId: number,
  ): Promise<Participant[]> {
    const rows = await client.query<{
      user_id: number | null;
      team_id: number | null;
      department_id: number | null;
      area_id: number | null;
    }>(
      `SELECT user_id, team_id, department_id, area_id
         FROM kvp_participants WHERE suggestion_id = $1`,
      [suggestionId],
    );
    const out: Participant[] = [];
    for (const r of rows.rows) {
      if (r.user_id !== null) out.push({ type: 'user', id: r.user_id });
      else if (r.team_id !== null) out.push({ type: 'team', id: r.team_id });
      else if (r.department_id !== null) out.push({ type: 'department', id: r.department_id });
      else if (r.area_id !== null) out.push({ type: 'area', id: r.area_id });
      // The CHECK constraint guarantees exactly one is set; the trailing else
      // is unreachable and intentionally omitted (would never fire).
    }
    return out;
  }

  /**
   * Bulk INSERT. Each row sets EXACTLY ONE of (user_id, team_id, department_id,
   * area_id) so the `exactly_one_target` CHECK is satisfied. UUIDv7 is
   * application-generated (HOW-TO-INTEGRATE-FEATURE convention).
   */
  private async insertParticipants(
    client: PoolClient,
    tenantId: number,
    suggestionId: number,
    input: Participant[],
    addedBy: number,
  ): Promise<void> {
    const placeholders: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    for (const p of input) {
      placeholders.push(
        `($${String(i)}, $${String(i + 1)}, $${String(i + 2)}, $${String(i + 3)}, $${String(i + 4)}, $${String(i + 5)}, $${String(i + 6)}, $${String(i + 7)})`,
      );
      params.push(
        uuidv7(),
        tenantId,
        suggestionId,
        p.type === 'user' ? p.id : null,
        p.type === 'team' ? p.id : null,
        p.type === 'department' ? p.id : null,
        p.type === 'area' ? p.id : null,
        addedBy,
      );
      i += 8;
    }

    await client.query<QueryResultRow>(
      `INSERT INTO kvp_participants
         (id, tenant_id, suggestion_id, user_id, team_id, department_id, area_id, added_by)
         VALUES ${placeholders.join(', ')}`,
      params,
    );
  }

  /**
   * Emit one audit-log entry per added/removed participant. Fire-and-forget
   * via `void`. ActivityLoggerService swallows its own errors (never throws),
   * matching the project-wide audit-log contract (see ADR-009).
   */
  private fireAuditDiff(
    suggestionId: number,
    actorUserId: number,
    before: Participant[],
    after: Participant[],
  ): void {
    const tenantId = this.db.getTenantId();
    if (tenantId === undefined) return; // safety net; runReplace already validated

    const beforeKeys = new Set<string>(
      before.map((p: Participant): string => `${p.type}:${String(p.id)}`),
    );
    const afterKeys = new Set<string>(
      after.map((p: Participant): string => `${p.type}:${String(p.id)}`),
    );

    for (const p of after) {
      if (!beforeKeys.has(`${p.type}:${String(p.id)}`)) {
        void this.activityLogger.logCreate(
          tenantId,
          actorUserId,
          'kvp',
          suggestionId,
          `KVP-Beteiligter hinzugefügt: ${p.type} #${String(p.id)}`,
          { suggestionId, participantType: p.type, participantId: p.id },
        );
      }
    }
    for (const p of before) {
      if (!afterKeys.has(`${p.type}:${String(p.id)}`)) {
        void this.activityLogger.logDelete(
          tenantId,
          actorUserId,
          'kvp',
          suggestionId,
          `KVP-Beteiligter entfernt: ${p.type} #${String(p.id)}`,
          { suggestionId, participantType: p.type, participantId: p.id },
        );
      }
    }
  }

  /**
   * Fetch enriched participants for one suggestion. Filters soft-deleted users
   * (masterplan Known Limitations §5: hidden, not anonymized). Teams /
   * departments / areas are not filtered — their lifecycle is hard-cascade,
   * so a row only exists if the entity is still present.
   *
   * The UNION ALL pattern lets us return a single typed row shape across the
   * 4 polymorphic targets. RLS (ADR-019) guarantees tenant scoping; the
   * service does not need explicit `tenant_id =` filters.
   */
  async getParticipants(suggestionId: number): Promise<EnrichedParticipant[]> {
    const rows = await this.db.tenantQuery<{
      type: ParticipantType;
      id: number;
      label: string;
      sublabel: string;
    }>(
      `SELECT 'user'::text AS type, u.id AS id,
              (u.first_name || ' ' || u.last_name) AS label,
              COALESCE(d.name, '') AS sublabel
         FROM kvp_participants p
         INNER JOIN users u ON u.id = p.user_id
         LEFT  JOIN user_departments ud ON ud.user_id = u.id AND ud.is_primary = true
         LEFT  JOIN departments d ON d.id = ud.department_id
         WHERE p.suggestion_id = $1
           AND p.user_id IS NOT NULL
           AND u.is_active != ${IS_ACTIVE.DELETED}
       UNION ALL
       SELECT 'team', t.id, t.name, COALESCE(d.name, '')
         FROM kvp_participants p
         INNER JOIN teams t ON t.id = p.team_id
         LEFT  JOIN departments d ON d.id = t.department_id
         WHERE p.suggestion_id = $1 AND p.team_id IS NOT NULL
       UNION ALL
       SELECT 'department', d.id, d.name, COALESCE(a.name, '')
         FROM kvp_participants p
         INNER JOIN departments d ON d.id = p.department_id
         LEFT  JOIN areas a ON a.id = d.area_id
         WHERE p.suggestion_id = $1 AND p.department_id IS NOT NULL
       UNION ALL
       SELECT 'area', a.id, a.name, ''::text
         FROM kvp_participants p
         INNER JOIN areas a ON a.id = p.area_id
         WHERE p.suggestion_id = $1 AND p.area_id IS NOT NULL
       ORDER BY type, label`,
      [suggestionId],
    );

    return rows.map(
      (r: {
        type: ParticipantType;
        id: number;
        label: string;
        sublabel: string;
      }): EnrichedParticipant => ({
        type: r.type,
        id: r.id,
        label: r.label,
        sublabel: r.sublabel,
      }),
    );
  }

  /**
   * Server-side search across users, teams, departments, areas. Tenant-scoped
   * automatically via RLS (Q3 in masterplan §0: tenant-wide search by design).
   * Hard cap of 50 per type (server policy, masterplan R3); empty `q` returns
   * the top 50 of each enabled type.
   *
   * `types` is a comma-separated whitelist. Unknown tokens are ignored;
   * empty / all-unknown → fall back to all four types (avoids silently
   * returning nothing on a typo).
   */
  async searchOptions(q?: string, types?: string): Promise<ParticipantOptions> {
    const enabledTypes = this.parseTypesFilter(types);
    const trimmedQ = q !== undefined && q.trim() !== '' ? q.trim() : null;

    this.logger.debug(
      `searchOptions q=${trimmedQ ?? '<empty>'} types=[${[...enabledTypes].join(',')}]`,
    );

    const empty = (): Promise<ParticipantOptionRow[]> => Promise.resolve([]);
    const [users, teams, departments, areas] = await Promise.all([
      enabledTypes.has('user') ? this.searchUsers(trimmedQ) : empty(),
      enabledTypes.has('team') ? this.searchTeams(trimmedQ) : empty(),
      enabledTypes.has('department') ? this.searchDepartments(trimmedQ) : empty(),
      enabledTypes.has('area') ? this.searchAreas(trimmedQ) : empty(),
    ]);

    return { users, teams, departments, areas };
  }

  private parseTypesFilter(types?: string): Set<ParticipantType> {
    if (types === undefined || types.trim() === '') {
      return new Set(PARTICIPANT_TYPES);
    }
    const requested = new Set<ParticipantType>();
    for (const raw of types.split(',')) {
      const t = raw.trim();
      if (t === 'user' || t === 'team' || t === 'department' || t === 'area') {
        requested.add(t);
      }
    }
    if (requested.size === 0) return new Set(PARTICIPANT_TYPES);
    return requested;
  }

  private async searchUsers(q: string | null): Promise<ParticipantOptionRow[]> {
    const filterClause =
      q === null ? '' : `AND (u.first_name || ' ' || u.last_name) ILIKE '%' || $1 || '%'`;
    const params: unknown[] = q === null ? [] : [q];
    return await this.db.tenantQuery<ParticipantOptionRow>(
      `SELECT u.id,
              (u.first_name || ' ' || u.last_name) AS label,
              COALESCE(d.name, '') AS sublabel
         FROM users u
         LEFT JOIN user_departments ud ON ud.user_id = u.id AND ud.is_primary = true
         LEFT JOIN departments d ON d.id = ud.department_id
        WHERE u.is_active != ${IS_ACTIVE.DELETED}
          ${filterClause}
        ORDER BY label
        LIMIT 50`,
      params,
    );
  }

  private async searchTeams(q: string | null): Promise<ParticipantOptionRow[]> {
    const filterClause = q === null ? '' : `AND t.name ILIKE '%' || $1 || '%'`;
    const params: unknown[] = q === null ? [] : [q];
    return await this.db.tenantQuery<ParticipantOptionRow>(
      `SELECT t.id, t.name AS label, COALESCE(d.name, '') AS sublabel
         FROM teams t
         LEFT JOIN departments d ON d.id = t.department_id
        WHERE t.is_active != ${IS_ACTIVE.DELETED}
          ${filterClause}
        ORDER BY label
        LIMIT 50`,
      params,
    );
  }

  private async searchDepartments(q: string | null): Promise<ParticipantOptionRow[]> {
    const filterClause = q === null ? '' : `AND d.name ILIKE '%' || $1 || '%'`;
    const params: unknown[] = q === null ? [] : [q];
    return await this.db.tenantQuery<ParticipantOptionRow>(
      `SELECT d.id, d.name AS label, COALESCE(a.name, '') AS sublabel
         FROM departments d
         LEFT JOIN areas a ON a.id = d.area_id
        WHERE d.is_active != ${IS_ACTIVE.DELETED}
          ${filterClause}
        ORDER BY label
        LIMIT 50`,
      params,
    );
  }

  private async searchAreas(q: string | null): Promise<ParticipantOptionRow[]> {
    const filterClause = q === null ? '' : `AND a.name ILIKE '%' || $1 || '%'`;
    const params: unknown[] = q === null ? [] : [q];
    return await this.db.tenantQuery<ParticipantOptionRow>(
      `SELECT a.id, a.name AS label, ''::text AS sublabel
         FROM areas a
        WHERE a.is_active != ${IS_ACTIVE.DELETED}
          ${filterClause}
        ORDER BY label
        LIMIT 50`,
      params,
    );
  }
}

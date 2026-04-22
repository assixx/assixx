/**
 * Migration: Create shift_handover_entries (+ shift_handover_status enum)
 *
 * Purpose: Per-shift-slot handover records — one row per
 * (tenant_id, team_id, shift_date, shift_key) identifies a single handover.
 * Holds a free-text protocol, typed custom_values JSONB keyed by the team's
 * template.fields, and a schema_snapshot frozen at submit-time for drift
 * safety. Lifecycle: draft → submitted → optionally reopened (Team-Lead).
 * A cron auto-lock sweep (Phase 2.8, every 6 h) transitions abandoned drafts
 * to submitted after shift-end + 24 h.
 *
 * Related:
 *   - Plan: docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Step 1.2 (Session 2, 2026-04-22)
 *   - R2:  schema_snapshot JSONB — frozen at submit-time. Template edits never
 *          retroactively reshape already-submitted entries.
 *   - R3:  Composite UNIQUE (tenant_id, team_id, shift_date, shift_key) +
 *          SELECT … FOR UPDATE in submitEntry() guarantees exactly-one-winner
 *          when two assignees submit simultaneously.
 *   - R13: shift_key VARCHAR(20)+CHECK (not an enum) because shift_times.shift_key
 *          is tenant-configurable VARCHAR(20). V1 locks allowed values to the
 *          Session 1 spike finding — {'early','late','night'} across every
 *          tenant with shift_times configured. V2 path: relax the CHECK, migrate
 *          data. The existing shifts_type enum is MIXED (14 values: slot markers
 *          + labor-law reasons) and is deliberately NOT reused here.
 *   - ADR-019: strict-mode RLS (NULLIF-based, no bypass clause)
 *   - ADR-033: shift_planning addon (gate in Phase 2 controller)
 *   - ADR-045: permission stack — registered in Phase 2.7 as `shift-handover-entries`
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Entry lifecycle state machine. Three states:
    --   'draft'     — created, editable by assignee(s) (Team-Lead may also edit)
    --   'submitted' — locked by submitEntry(); schema_snapshot frozen
    --   'reopened'  — Team-Lead reopen() for correction; editable again until re-submit
    -- New ENUM type, not a reuse of shifts_type (see plan R13 justification).
    CREATE TYPE shift_handover_status AS ENUM ('draft', 'submitted', 'reopened');

    CREATE TABLE shift_handover_entries (
      id UUID PRIMARY KEY DEFAULT uuidv7(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      -- Calendar day of the shift in Europe/Berlin (R5). Resolver in Phase 2.3
      -- converts UTC → Berlin before comparing with shift_date.
      shift_date DATE NOT NULL,
      -- shift_key mirrors shift_times.shift_key (VARCHAR(20), tenant-configurable).
      -- NOT an FK — composite tenant-scoped FK would complicate RLS. The service
      -- layer MUST additionally validate that (tenant_id, shift_key) exists in
      -- shift_times on every write. V1 locks allowed values via CHECK (R13).
      shift_key VARCHAR(20) NOT NULL
        CHECK (shift_key IN ('early', 'late', 'night')),
      -- Free-text handover note. NOT NULL + empty-string default keeps the
      -- upsert-on-getOrCreateDraft path clean (no "missing vs empty" ambiguity).
      protocol_text TEXT NOT NULL DEFAULT '',
      -- User-entered values for the team's template custom fields. Keyed by
      -- template.field[].key. Validated app-side via a Zod schema built from
      -- @assixx/shared/shift-handover (draft → from live template; submitted →
      -- from schema_snapshot). Empty object when no custom fields filled.
      custom_values JSONB NOT NULL DEFAULT '{}'::jsonb,
      -- Frozen copy of template.fields at submitEntry() time (R2 drift safety).
      -- After status='submitted', all renders + re-validation use THIS snapshot,
      -- never the live template. Empty array for still-draft rows.
      schema_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
      -- Lifecycle state. Default 'draft' on INSERT (getOrCreateDraft path).
      status shift_handover_status NOT NULL DEFAULT 'draft',
      -- Audit: who locked this entry + when. NULL while still draft.
      submitted_at TIMESTAMPTZ,
      submitted_by INTEGER REFERENCES users(id),
      -- Audit: Team-Lead reopen. reopen_reason is required app-side via DTO
      -- validation (Phase 2.6) — kept as free-text in the DB rather than
      -- an enum so future categorisation can evolve without a migration.
      reopened_at TIMESTAMPTZ,
      reopened_by INTEGER REFERENCES users(id),
      reopen_reason TEXT,
      -- Soft-delete lifecycle (Assixx convention: 0=inactive, 1=active,
      -- 3=archived, 4=deleted). Entries are rarely hard-deleted in practice.
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      -- NOT NULL here (contrast: templates.created_by is nullable). Every entry
      -- MUST have an authenticated creator — system-created entries do not exist.
      -- All creations flow through getOrCreateDraft which requires a logged-in
      -- assignee.
      created_by INTEGER NOT NULL REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      -- Composite identity: one handover row per (tenant, team, day, shift-slot).
      -- DEFERRABLE INITIALLY IMMEDIATE: default behaviour is the normal IMMEDIATE
      -- check, but migration / bulk-reseed / test-setup scenarios can temporarily
      -- defer to end-of-transaction via SET CONSTRAINTS ALL DEFERRED. Costs nothing
      -- on the hot path.
      UNIQUE (tenant_id, team_id, shift_date, shift_key) DEFERRABLE INITIALLY IMMEDIATE
    );

    -- RLS: strict-mode per ADR-019 — NO "IS NULL OR" bypass clause.
    -- Auto-lock cron sweep runs cross-tenant via sys_user (BYPASSRLS), not via
    -- app_user without context.
    ALTER TABLE shift_handover_entries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shift_handover_entries FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON shift_handover_entries
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Triple-User-Model GRANTs (ADR-019). UUID PK — no sequence GRANTs needed.
    GRANT SELECT, INSERT, UPDATE, DELETE ON shift_handover_entries TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON shift_handover_entries TO sys_user;

    -- Hot-path index: listEntriesForTeam sorted by date DESC.
    CREATE INDEX idx_she_team_date
      ON shift_handover_entries(tenant_id, team_id, shift_date DESC)
      WHERE is_active = 1;

    -- Status filter index: "show all submitted / all drafts per tenant".
    CREATE INDEX idx_she_status
      ON shift_handover_entries(tenant_id, status)
      WHERE is_active = 1;

    -- Auto-lock sweep index (plan §Step 2.5 runAutoLockSweep / §Step 2.8 cron):
    --   SELECT id FROM shift_handover_entries
    --   WHERE tenant_id=$1 AND status='draft' AND is_active=1
    --     AND shift_date < <cutoff>
    -- Partial predicate restricts the index to just draft-active rows; including
    -- status in columns is deliberate for covering-index paths when the query
    -- drops the shift_date filter (rare, but zero-cost).
    CREATE INDEX idx_she_autolock
      ON shift_handover_entries(tenant_id, status, shift_date)
      WHERE status = 'draft' AND is_active = 1;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Rollback order matters:
  //   1. DROP TABLE first — removes every column that references the enum.
  //      CASCADE is defensive; no FK currently points INTO this table in V1,
  //      but shift_handover_attachments (§Step 1.3, if applied) would — and
  //      run-migrations.sh enforces reverse-order rollback, so the attachments
  //      migration rolls back first.
  //   2. DROP TYPE second — safe only once no column uses it.
  // IF EXISTS is allowed in down() per DATABASE-MIGRATION-GUIDE §Required Patterns.
  pgm.sql(`
    DROP TABLE IF EXISTS shift_handover_entries CASCADE;
    DROP TYPE IF EXISTS shift_handover_status;
  `);
}

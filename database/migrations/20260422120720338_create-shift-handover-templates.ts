/**
 * Migration: Create shift_handover_templates
 *
 * Purpose: Per-team handover templates that define the custom-field shape a
 * team's shift-handover entry uses. One row per (tenant_id, team_id) — Team-Lead
 * edits inline; there is no template versioning in V1. Drift safety for already-
 * submitted entries is handled downstream by shift_handover_entries.schema_snapshot
 * (frozen at submit time — FEAT_SHIFT_HANDOVER_MASTERPLAN.md R2 + §Step 1.2).
 *
 * Related:
 *   - Plan: docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Step 1.1 (Session 2, 2026-04-22)
 *   - ADR-019: strict-mode RLS (NULLIF-based policy, no bypass clause)
 *   - ADR-033: shift_planning addon (access gate enforced in Phase 2 controller)
 *   - ADR-045: permission stack — registered in Phase 2.7 as `shift-handover-templates`
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE shift_handover_templates (
      id UUID PRIMARY KEY DEFAULT uuidv7(),
      -- FK to tenants: CASCADE so that tenant deletion (via deletion-worker) wipes
      -- templates automatically. tenant_id is NOT NULL and always set by RLS context.
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      -- FK to teams: CASCADE because a template is meaningless without its team.
      -- Team deletion removes the whole handover config for that team.
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      -- JSONB array of FieldDef objects: { key, label, type, required, options? }.
      -- Validated against a shared Zod schema on every write (Phase 2, @assixx/shared/shift-handover).
      -- Max 30 fields per template is enforced application-layer, not as a DB CHECK
      -- (cheaper + easier to evolve).
      fields JSONB NOT NULL DEFAULT '[]'::jsonb,
      -- Soft-delete lifecycle (Assixx convention, see docs/DATABASE-MIGRATION-GUIDE.md §is_active):
      --   0 = inactive, 1 = active, 3 = archived, 4 = deleted.
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      -- One active or inactive template row per team. Upsert-only API in the service
      -- (no separate create+update). A soft-deleted row still occupies this slot —
      -- revival is an UPDATE, not a new INSERT.
      UNIQUE (tenant_id, team_id)
    );

    -- RLS: strict-mode policy per ADR-019 — NO "IS NULL OR" bypass clause.
    -- Cross-tenant operations (cron sweeps, root-admin queries) must use sys_user
    -- (BYPASSRLS) via DatabaseService.systemQuery() / systemTransaction(), not
    -- app_user without context. Requests without app.tenant_id return 0 rows.
    ALTER TABLE shift_handover_templates ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shift_handover_templates FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON shift_handover_templates
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Triple-User-Model GRANTs (ADR-019). No sequence GRANTs needed — UUID PK,
    -- no implicit sequence. assixx_user already has BYPASSRLS + DDL rights;
    -- no explicit GRANT required (superuser).
    GRANT SELECT, INSERT, UPDATE, DELETE ON shift_handover_templates TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON shift_handover_templates TO sys_user;

    -- Partial index: only active rows are on the hot path (getTemplateForTeam,
    -- listActiveTemplates). Soft-deleted rows (is_active != 1) do not need this
    -- index and would just bloat it — hence WHERE is_active = 1.
    CREATE INDEX idx_sht_tenant_team
      ON shift_handover_templates(tenant_id, team_id)
      WHERE is_active = 1;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Rollback drops the table entirely. CASCADE is defensive — no other table
  // FKs into shift_handover_templates in V1 (entries decouple via schema_snapshot
  // rather than a template_id FK, see plan §1.2), but future additions won't
  // silently break rollback.
  // IF EXISTS is allowed in down() per DATABASE-MIGRATION-GUIDE §Required Patterns.
  pgm.sql(`DROP TABLE IF EXISTS shift_handover_templates CASCADE;`);
}

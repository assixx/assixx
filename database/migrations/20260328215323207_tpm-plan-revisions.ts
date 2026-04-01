/**
 * Migration: TPM Plan Revision History
 *
 * Purpose: ISO 9001 Chapter 7.5.3 compliance — every plan change must be traceable.
 *          Adds revision_number to tpm_maintenance_plans and creates
 *          tpm_plan_revisions table for immutable snapshots of plan state.
 *
 * Design: See docs/FEAT_TPM_PLAN_REVISIONS_MASTERPLAN.md (D1-D8)
 *         - Snapshot approach (full plan state per revision)
 *         - Immutable table (INSERT + SELECT only, no UPDATE/DELETE)
 *         - Integer versioning (v1, v2, v3, ...)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // ─── 1. Add revision_number to existing plans table ───────────────
  pgm.sql(`
    ALTER TABLE tpm_maintenance_plans
      ADD COLUMN revision_number INTEGER NOT NULL DEFAULT 1;
  `);

  // ─── 2. Create tpm_plan_revisions table ───────────────────────────
  pgm.sql(`
    CREATE TABLE tpm_plan_revisions (
      id              SERIAL PRIMARY KEY,
      uuid            CHAR(36) NOT NULL,
      tenant_id       INTEGER NOT NULL,
      plan_id         INTEGER NOT NULL,
      revision_number INTEGER NOT NULL,

      -- Full snapshot of plan fields (7 fields)
      name                VARCHAR(255) NOT NULL,
      asset_id            INTEGER NOT NULL,
      base_weekday        INTEGER NOT NULL,
      base_repeat_every   INTEGER NOT NULL,
      base_time           TIME,
      buffer_hours        NUMERIC(4,1) NOT NULL,
      notes               TEXT,

      -- Change metadata
      changed_by      INTEGER NOT NULL,
      change_reason   TEXT,
      changed_fields  TEXT[] NOT NULL DEFAULT '{}',

      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Constraints
      CONSTRAINT uq_tpm_revisions_uuid UNIQUE (uuid),
      CONSTRAINT uq_tpm_revisions_plan_number UNIQUE (plan_id, revision_number),
      CONSTRAINT fk_tpm_revisions_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
      CONSTRAINT fk_tpm_revisions_plan
        FOREIGN KEY (plan_id) REFERENCES tpm_maintenance_plans(id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
      CONSTRAINT fk_tpm_revisions_changed_by
        FOREIGN KEY (changed_by) REFERENCES users(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
    );
  `);

  // ─── 3. Row Level Security (ADR-019 NULLIF pattern) ───────────────
  pgm.sql(`
    ALTER TABLE tpm_plan_revisions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_plan_revisions FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_plan_revisions
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );
  `);

  // ─── 4. Grants: INSERT + SELECT only (immutable!) ─────────────────
  // Default ACL auto-grants arwd to app_user on all new tables.
  // Explicitly revoke UPDATE + DELETE to enforce immutability.
  pgm.sql(`
    GRANT SELECT, INSERT ON tpm_plan_revisions TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_plan_revisions_id_seq TO app_user;
    REVOKE UPDATE, DELETE ON tpm_plan_revisions FROM app_user;
  `);

  // ─── 5. Indexes ───────────────────────────────────────────────────
  pgm.sql(`
    CREATE INDEX idx_tpm_revisions_plan
      ON tpm_plan_revisions (plan_id, revision_number DESC);

    CREATE INDEX idx_tpm_revisions_tenant
      ON tpm_plan_revisions (tenant_id);
  `);

  // ─── 6. Backfill existing plans with v1 revision ──────────────────
  // Table currently has 0 rows (2026-03-28), so this is a no-op safety net.
  // gen_random_uuid() produces UUIDv4 — acceptable for backfill of 0 rows.
  pgm.sql(`
    INSERT INTO tpm_plan_revisions (
      uuid, tenant_id, plan_id, revision_number,
      name, asset_id, base_weekday, base_repeat_every, base_time,
      buffer_hours, notes,
      changed_by, change_reason, changed_fields, created_at
    )
    SELECT
      gen_random_uuid()::CHAR(36), p.tenant_id, p.id, 1,
      p.name, p.asset_id, p.base_weekday, p.base_repeat_every, p.base_time,
      p.buffer_hours, p.notes,
      p.created_by, 'Backfill: initial version', '{}', p.created_at
    FROM tpm_maintenance_plans p
    WHERE p.is_active IN (0, 1, 3);
  `);
}

export function down(pgm: MigrationBuilder): void {
  // ─── Reverse: drop table first (has FK to plans), then column ─────
  pgm.sql(`
    DROP TABLE IF EXISTS tpm_plan_revisions CASCADE;
  `);

  pgm.sql(`
    ALTER TABLE tpm_maintenance_plans
      DROP COLUMN IF EXISTS revision_number;
  `);
}

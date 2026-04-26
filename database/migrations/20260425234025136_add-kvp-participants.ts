/**
 * Migration: Add kvp_participants — informational tagging of co-originators.
 *
 * Purpose: Allow KVP suggestion authors to tag co-originators (users, teams,
 * departments, areas) of an idea. Pure annotation — no notifications, no
 * permission grant, no creator-bypass extension (ADR-045 boundary).
 *
 * Schema decisions (FEAT_KVP_PARTICIPANTS_MASTERPLAN.md §1.2):
 *  - Polymorphic table: exactly one of (user_id, team_id, department_id,
 *    area_id) is set per row, enforced by CHECK constraint. Alternative
 *    (4 junction tables) rejected for KISS.
 *  - UUID PK, application-generated UUIDv7 (HOW-TO-INTEGRATE-FEATURE
 *    convention; service uses `import { v7 as uuidv7 } from 'uuid'`,
 *    no DB-side default).
 *  - No is_active column: relation/junction-table semantic is DELETE-INSERT,
 *    not soft-delete. Audit trail captures who/when at the API call level
 *    (ADR-009).
 *  - Strict RLS mode per ADR-019 (NULLIF + cast pattern; no app.tenant_id
 *    set means 0 rows visible).
 *  - GRANTs to app_user AND sys_user (Triple-User Model, ADR-019).
 *  - Two indexes: (tenant_id, suggestion_id) for primary read, user_id
 *    partial for "where am I tagged?". team/dept/area indexes intentionally
 *    omitted — no documented consumer query, FK cascade scans on rare
 *    hard-deletes are acceptable given small per-tenant cardinality.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE kvp_participants (
        id UUID PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        suggestion_id INTEGER NOT NULL REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
        area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE,
        added_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT exactly_one_target CHECK (
            (user_id IS NOT NULL)::int +
            (team_id IS NOT NULL)::int +
            (department_id IS NOT NULL)::int +
            (area_id IS NOT NULL)::int = 1
        ),
        CONSTRAINT uq_kvp_participant_user UNIQUE (tenant_id, suggestion_id, user_id),
        CONSTRAINT uq_kvp_participant_team UNIQUE (tenant_id, suggestion_id, team_id),
        CONSTRAINT uq_kvp_participant_dept UNIQUE (tenant_id, suggestion_id, department_id),
        CONSTRAINT uq_kvp_participant_area UNIQUE (tenant_id, suggestion_id, area_id)
    );

    -- Primary read pattern: list a suggestion's participants.
    CREATE INDEX idx_kvp_participants_suggestion
        ON kvp_participants(tenant_id, suggestion_id);

    -- Anticipated future read: "where am I tagged?" — partial index excludes
    -- non-user rows for storage efficiency.
    CREATE INDEX idx_kvp_participants_user
        ON kvp_participants(user_id) WHERE user_id IS NOT NULL;

    ALTER TABLE kvp_participants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE kvp_participants FORCE ROW LEVEL SECURITY;

    -- Strict-mode tenant isolation (ADR-019): empty tenant context → 0 rows.
    -- Cross-tenant operations use sys_user (BYPASSRLS).
    CREATE POLICY tenant_isolation ON kvp_participants
        FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON kvp_participants TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON kvp_participants TO sys_user;
    -- No sequence GRANT — UUIDv7 PK has no sequence.
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS kvp_participants CASCADE;`);
}

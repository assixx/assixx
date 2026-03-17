/**
 * Migration: TPM Execution Participants
 * Date: 2026-02-25
 *
 * Creates tpm_execution_participants junction table for M:N relationship
 * between tpm_card_executions and users (employees).
 *
 * Purpose: Track which employees participated in a maintenance execution,
 * beyond just the executed_by (creator). Max 10 participants per execution.
 *
 * References: ADR-026 TPM Architecture
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- tpm_execution_participants — employees involved in a maintenance execution
    -- ==========================================================================

    CREATE TABLE tpm_execution_participants (
      id                    SERIAL PRIMARY KEY,
      uuid                  CHAR(36) NOT NULL,
      tenant_id             INTEGER NOT NULL,
      execution_id          INTEGER NOT NULL,
      user_id               INTEGER NOT NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_tpm_exec_part_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_exec_part_execution
        FOREIGN KEY (execution_id)
        REFERENCES tpm_card_executions(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_exec_part_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      -- No duplicate user per execution
      CONSTRAINT uq_tpm_exec_part_execution_user
        UNIQUE (execution_id, user_id)
    );

    -- Indexes
    CREATE UNIQUE INDEX idx_tpm_exec_part_uuid
      ON tpm_execution_participants (uuid);

    CREATE INDEX idx_tpm_exec_part_tenant
      ON tpm_execution_participants (tenant_id);

    CREATE INDEX idx_tpm_exec_part_execution
      ON tpm_execution_participants (execution_id);

    CREATE INDEX idx_tpm_exec_part_user
      ON tpm_execution_participants (user_id);

    -- RLS (ADR-019)
    ALTER TABLE tpm_execution_participants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_execution_participants FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_execution_participants
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- GRANTs for app_user
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_execution_participants TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_execution_participants_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS tpm_execution_participants CASCADE;`);
}

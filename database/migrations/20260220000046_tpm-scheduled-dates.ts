/**
 * Migration: TPM Scheduled Dates (Phase 2 — Scheduling Wiring)
 * Date: 2026-02-20
 *
 * Creates the tpm_scheduled_dates table for year-ahead pre-calculated
 * due dates per card. Each card generates ~365 rows (daily) down to ~1 row
 * (annual). The cron service uses this table + tpm_cards.current_due_date
 * to trigger the Kamishibai cascade.
 *
 * Design:
 *   - One row per (card_id, scheduled_date) — unique constraint
 *   - is_completed tracks which dates have been fulfilled
 *   - current_due_date on tpm_cards always reflects the next uncompleted date
 *
 * Dependencies:
 *   - tpm_cards table (migration 042)
 *   - tenants table (baseline)
 *
 * Every table follows ADR-019 (RLS) and has GRANT to app_user.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- tpm_scheduled_dates — year-ahead pre-calculated due dates per card
    -- ==========================================================================

    CREATE TABLE tpm_scheduled_dates (
      id                SERIAL PRIMARY KEY,
      tenant_id         INTEGER NOT NULL,
      card_id           INTEGER NOT NULL,
      scheduled_date    DATE NOT NULL,
      is_completed      BOOLEAN NOT NULL DEFAULT false,
      completed_at      TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_tsd_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tsd_card
        FOREIGN KEY (card_id)
        REFERENCES tpm_cards(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE
    );

    -- One scheduled date per card per date (prevent duplicates)
    CREATE UNIQUE INDEX uq_tsd_card_date
      ON tpm_scheduled_dates(card_id, scheduled_date);

    -- Fast lookup: next uncompleted date for a card
    CREATE INDEX idx_tsd_next_uncompleted
      ON tpm_scheduled_dates(card_id, is_completed, scheduled_date)
      WHERE is_completed = false;

    -- Tenant-level lookups
    CREATE INDEX idx_tsd_tenant
      ON tpm_scheduled_dates(tenant_id);

    -- RLS (ADR-019)
    ALTER TABLE tpm_scheduled_dates ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_scheduled_dates FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_scheduled_dates
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_scheduled_dates TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_scheduled_dates_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS tpm_scheduled_dates CASCADE;`);
}

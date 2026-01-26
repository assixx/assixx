/**
 * Migration: KVP confirmations - first_seen_at + is_confirmed
 * Date: 2026-01-23 (original) / 2026-01-27 (wrapped)
 *
 * Same pattern as blackboard (011-blackboard-confirmations-first-seen):
 * - "Neu" badge = first_seen_at IS NULL
 * - "Ungelesen" eye = is_confirmed = false
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE kvp_confirmations
    ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE kvp_confirmations
    ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT true;

    UPDATE kvp_confirmations
    SET first_seen_at = confirmed_at
    WHERE first_seen_at IS NULL AND confirmed_at IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_kvp_confirmations_is_confirmed
    ON kvp_confirmations(suggestion_id, user_id, is_confirmed);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_kvp_confirmations_is_confirmed;
    ALTER TABLE kvp_confirmations DROP COLUMN IF EXISTS is_confirmed;
    ALTER TABLE kvp_confirmations DROP COLUMN IF EXISTS first_seen_at;
  `);
}

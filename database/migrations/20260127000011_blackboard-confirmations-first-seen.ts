/**
 * Migration: Blackboard confirmations - first_seen_at + is_confirmed
 * Date: 2026-01-23 (original) / 2026-01-27 (wrapped)
 *
 * Separates "Neu" badge from read status:
 * - first_seen_at: When user FIRST saw the entry (never reset)
 * - is_confirmed: Current read status (can toggle true/false)
 * - "Neu" badge = first_seen_at IS NULL
 * - "Ungelesen" eye = is_confirmed = false
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE blackboard_confirmations
    ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE blackboard_confirmations
    ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT true;

    UPDATE blackboard_confirmations
    SET first_seen_at = confirmed_at
    WHERE first_seen_at IS NULL AND confirmed_at IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_blackboard_confirmations_is_confirmed
    ON blackboard_confirmations(entry_id, user_id, is_confirmed);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_blackboard_confirmations_is_confirmed;
    ALTER TABLE blackboard_confirmations DROP COLUMN IF EXISTS is_confirmed;
    ALTER TABLE blackboard_confirmations DROP COLUMN IF EXISTS first_seen_at;
  `);
}

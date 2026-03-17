/**
 * Migration: Add DEFAULT NOW() to timestamp columns for safety
 * Date: 2026-01-28
 *
 * Purpose: Prevent NULL timestamps when INSERT misses the column.
 *
 * Problem discovered: blackboard_confirmations had first_seen_at = NULL
 * for old entries because the column was added later without DEFAULT.
 * The "Neu" badge never disappeared because first_seen_at was NULL.
 *
 * This migration adds DEFAULT NOW() to:
 * - blackboard_confirmations.confirmed_at, first_seen_at (backup for code)
 * - kvp_confirmations.first_seen_at (same pattern)
 * - documents.uploaded_at (BUG: code never sets this!)
 * - kvp_attachments.uploaded_at (BUG: code never sets this!)
 * - machine_documents.uploaded_at (unused table, but safe)
 *
 * NOT included: shift_rotation_history.confirmed_at
 * (should remain NULL until user confirms - intentional)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Backup for code that already sets these (defensive)
    ALTER TABLE blackboard_confirmations
    ALTER COLUMN confirmed_at SET DEFAULT NOW();

    ALTER TABLE blackboard_confirmations
    ALTER COLUMN first_seen_at SET DEFAULT NOW();

    ALTER TABLE kvp_confirmations
    ALTER COLUMN first_seen_at SET DEFAULT NOW();

    -- BUG FIXES: Code never sets these columns!
    ALTER TABLE documents
    ALTER COLUMN uploaded_at SET DEFAULT NOW();

    ALTER TABLE kvp_attachments
    ALTER COLUMN uploaded_at SET DEFAULT NOW();

    ALTER TABLE machine_documents
    ALTER COLUMN uploaded_at SET DEFAULT NOW();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE blackboard_confirmations
    ALTER COLUMN confirmed_at DROP DEFAULT;

    ALTER TABLE blackboard_confirmations
    ALTER COLUMN first_seen_at DROP DEFAULT;

    ALTER TABLE kvp_confirmations
    ALTER COLUMN first_seen_at DROP DEFAULT;

    ALTER TABLE documents
    ALTER COLUMN uploaded_at DROP DEFAULT;

    ALTER TABLE kvp_attachments
    ALTER COLUMN uploaded_at DROP DEFAULT;

    ALTER TABLE machine_documents
    ALTER COLUMN uploaded_at DROP DEFAULT;
  `);
}

/**
 * Migration: Blackboard status ENUM -> is_active INTEGER
 * Date: 2026-01-20 (original) / 2026-01-27 (wrapped)
 *
 * Migrates from status ENUM ('active','archived') to is_active INTEGER.
 * Consistent with rest of app: 0=inactive, 1=active, 3=archive, 4=deleted.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    UPDATE blackboard_entries
    SET is_active = CASE
        WHEN status = 'active' THEN 1
        WHEN status = 'archived' THEN 3
        ELSE 1
    END;

    DROP INDEX IF EXISTS idx_19037_idx_status;
    ALTER TABLE blackboard_entries DROP COLUMN IF EXISTS status;
    DROP TYPE IF EXISTS blackboard_entries_status;

    ALTER TABLE blackboard_entries
        ALTER COLUMN is_active SET NOT NULL,
        ALTER COLUMN is_active SET DEFAULT 1;
  `);
}

export function down(): void {
  throw new Error(
    'Cannot rollback ENUM-to-INTEGER migration. The ENUM type and status column were dropped. Restore from backup.',
  );
}

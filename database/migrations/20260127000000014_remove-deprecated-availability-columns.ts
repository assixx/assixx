/**
 * Migration: Remove deprecated availability columns from users table
 * Date: 2026-01-24 (original) / 2026-01-27 (wrapped)
 *
 * Migrates existing availability data from users to employee_availability,
 * then drops the deprecated columns.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    INSERT INTO employee_availability (employee_id, tenant_id, status, start_date, end_date, notes, created_at, updated_at)
    SELECT
        u.id,
        u.tenant_id,
        u.availability_status::TEXT::employee_availability_status,
        u.availability_start,
        u.availability_end,
        u.availability_notes,
        NOW(),
        NOW()
    FROM users u
    WHERE u.availability_status IS NOT NULL
      AND u.availability_status::TEXT != 'available'
      AND u.availability_start IS NOT NULL
      AND u.availability_end IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM employee_availability ea
        WHERE ea.employee_id = u.id
          AND ea.start_date = u.availability_start
          AND ea.end_date = u.availability_end
      );

    ALTER TABLE users DROP COLUMN IF EXISTS availability_status;
    ALTER TABLE users DROP COLUMN IF EXISTS availability_start;
    ALTER TABLE users DROP COLUMN IF EXISTS availability_end;
    ALTER TABLE users DROP COLUMN IF EXISTS availability_notes;
  `);
}

export function down(): void {
  throw new Error(
    'Cannot rollback column removal - data was migrated to employee_availability and columns dropped. Restore from backup.',
  );
}

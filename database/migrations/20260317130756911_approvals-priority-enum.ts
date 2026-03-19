/**
 * Migration: Convert approvals.priority from VARCHAR(10) to ENUM
 * Date: 2026-03-17
 *
 * Purpose: Consistency with work_order_priority ENUM (ADR-028).
 * The approvals table was created with priority as VARCHAR(10) — this
 * converts it to a proper ENUM type for type safety and consistency.
 * Table is empty at this point, so no data conversion risk.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TYPE approval_priority AS ENUM ('low', 'medium', 'high');

    -- Drop default BEFORE type change (PG cannot auto-cast default)
    ALTER TABLE approvals ALTER COLUMN priority DROP DEFAULT;

    ALTER TABLE approvals
      ALTER COLUMN priority TYPE approval_priority
      USING priority::approval_priority;

    ALTER TABLE approvals
      ALTER COLUMN priority SET DEFAULT 'medium'::approval_priority;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE approvals
      ALTER COLUMN priority SET DEFAULT 'medium';

    ALTER TABLE approvals
      ALTER COLUMN priority TYPE VARCHAR(10)
      USING priority::text;

    DROP TYPE IF EXISTS approval_priority;
  `);
}

/**
 * Migration: Position Catalog — ENUM Extension (Step 1 of 2)
 *
 * Purpose: Add 'position' value to approval_approver_type ENUM.
 * Must run in a separate, non-transactional migration because PostgreSQL requires
 * a COMMIT between ALTER TYPE ... ADD VALUE and any usage of the new value
 * (CHECK constraints, inserts, etc.). See ADR-038.
 *
 * WARNING: ALTER TYPE ... ADD VALUE is IRREVERSIBLE in PostgreSQL.
 * The down() function uses the detach-drop-recreate pattern to roll back the ENUM.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.noTransaction();
  pgm.sql(`
    ALTER TYPE approval_approver_type ADD VALUE IF NOT EXISTS 'position';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.noTransaction();
  pgm.sql(`
    -- ENUM rollback: detach column, recreate type without 'position'
    -- PREREQUISITE: position-catalog-tables down() must run FIRST
    -- (deletes position rows, drops CHECK, drops column)
    ALTER TABLE approval_configs ALTER COLUMN approver_type TYPE VARCHAR(20);
    DROP TYPE IF EXISTS approval_approver_type;
    CREATE TYPE approval_approver_type AS ENUM ('user', 'team_lead', 'area_lead', 'department_lead');
    ALTER TABLE approval_configs ALTER COLUMN approver_type TYPE approval_approver_type
      USING approver_type::approval_approver_type;
  `);
}

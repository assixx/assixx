/**
 * Migration: Add department_deputy_lead_id to departments
 *
 * Purpose: Enable deputy leads at the department level (Stellvertreter).
 * Deputies have equal permissions and visibility as their department lead (DEPUTY_EQUALS_LEAD).
 *
 * @see docs/FEAT_DEPUTY_LEADS_MASTERPLAN.md
 * @see ADR-035 (Organizational Hierarchy)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE departments ADD COLUMN department_deputy_lead_id INTEGER;

    ALTER TABLE departments ADD CONSTRAINT fk_departments_deputy_lead
      FOREIGN KEY (department_deputy_lead_id) REFERENCES users(id)
      ON UPDATE RESTRICT ON DELETE SET NULL;

    CREATE INDEX idx_departments_deputy_lead ON departments (department_deputy_lead_id);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_departments_deputy_lead;
    ALTER TABLE departments DROP CONSTRAINT IF EXISTS fk_departments_deputy_lead;
    ALTER TABLE departments DROP COLUMN IF EXISTS department_deputy_lead_id;
  `);
}

/**
 * Migration: Add area_deputy_lead_id to areas
 *
 * Purpose: Enable deputy leads at the area level (Stellvertreter).
 * Deputies have equal permissions and visibility as their area lead (DEPUTY_EQUALS_LEAD).
 *
 * @see docs/FEAT_DEPUTY_LEADS_MASTERPLAN.md
 * @see ADR-035 (Organizational Hierarchy)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE areas ADD COLUMN area_deputy_lead_id INTEGER;

    ALTER TABLE areas ADD CONSTRAINT fk_areas_deputy_lead
      FOREIGN KEY (area_deputy_lead_id) REFERENCES users(id)
      ON UPDATE RESTRICT ON DELETE SET NULL;

    CREATE INDEX idx_areas_deputy_lead ON areas (area_deputy_lead_id);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_areas_deputy_lead;
    ALTER TABLE areas DROP CONSTRAINT IF EXISTS fk_areas_deputy_lead;
    ALTER TABLE areas DROP COLUMN IF EXISTS area_deputy_lead_id;
  `);
}

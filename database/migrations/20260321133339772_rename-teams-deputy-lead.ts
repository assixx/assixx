/**
 * Migration: Rename teams.deputy_lead_id → teams.team_deputy_lead_id
 *
 * Purpose: Naming consistency — all lead columns follow {entity}_*_lead_id pattern.
 * With deputies on all 3 levels (area, department, team), the unprefixed
 * `deputy_lead_id` becomes ambiguous. Rename to `team_deputy_lead_id`.
 *
 * Also renames position_catalog entry: deputy_lead → team_deputy_lead.
 *
 * @see docs/FEAT_DEPUTY_LEADS_MASTERPLAN.md (Step 1.3)
 * @see ADR-035, ADR-038
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE teams RENAME COLUMN deputy_lead_id TO team_deputy_lead_id;

    ALTER INDEX idx_teams_deputy_lead RENAME TO idx_teams_team_deputy_lead;

    UPDATE position_catalog SET name = 'team_deputy_lead' WHERE name = 'deputy_lead';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE teams RENAME COLUMN team_deputy_lead_id TO deputy_lead_id;

    ALTER INDEX idx_teams_team_deputy_lead RENAME TO idx_teams_deputy_lead;

    UPDATE position_catalog SET name = 'deputy_lead' WHERE name = 'team_deputy_lead';
  `);
}

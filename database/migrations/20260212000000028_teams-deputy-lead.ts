/**
 * Migration: Teams Deputy Lead + One-Team-Per-User Constraint
 * Date: 2026-02-12
 *
 * 1. Adds `deputy_lead_id` column to `teams` table — used for vacation
 *    approval escalation when the team lead is absent.
 *
 * 2. Creates a UNIQUE index on `user_teams(user_id)` to enforce Business
 *    Rule A1: each employee belongs to exactly one team.
 *    A pre-check DO $$ block verifies no user is currently in multiple
 *    teams and RAISE EXCEPTION if violated (migration aborts safely).
 *
 * References: FEAT_VACCATION_MASTERPLAN.md (Phase 1, Step 1.1)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Pre-check: verify no user is in multiple teams (R1 mitigation)
    -- ==========================================================================

    DO $$
    DECLARE
        _count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO _count
        FROM (
            SELECT user_id
            FROM user_teams
            GROUP BY user_id
            HAVING COUNT(team_id) > 1
        ) AS multi_team_users;

        IF _count > 0 THEN
            RAISE EXCEPTION 'MIGRATION BLOCKED: % user(s) belong to multiple teams. '
                'Fix user_teams data before applying this migration. '
                'Query: SELECT user_id, COUNT(team_id) FROM user_teams GROUP BY user_id HAVING COUNT(team_id) > 1;',
                _count;
        END IF;
    END $$;

    -- ==========================================================================
    -- Teams: add deputy_lead_id for vacation approval escalation
    -- ==========================================================================

    ALTER TABLE teams
        ADD COLUMN IF NOT EXISTS deputy_lead_id INTEGER REFERENCES users(id)
            ON UPDATE RESTRICT ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_teams_deputy_lead
        ON teams(deputy_lead_id);

    COMMENT ON COLUMN teams.deputy_lead_id IS
        'Stellvertretender Teamleiter — übernimmt Urlaubsgenehmigung wenn team_lead abwesend';

    -- ==========================================================================
    -- user_teams: enforce one team per user (Business Rule A1)
    -- ==========================================================================

    CREATE UNIQUE INDEX IF NOT EXISTS idx_ut_one_team_per_user
        ON user_teams(user_id);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_ut_one_team_per_user;
    DROP INDEX IF EXISTS idx_teams_deputy_lead;
    ALTER TABLE teams DROP COLUMN IF EXISTS deputy_lead_id;
  `);
}

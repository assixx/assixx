/**
 * Migration: Drop DEFERRABLE clause from shift_handover_entries unique constraint.
 *
 * Purpose: Migration #143 (`create-shift-handover-entries`, 2026-04-22) created
 * the composite unique constraint on `(tenant_id, team_id, shift_date, shift_key)`
 * as `DEFERRABLE INITIALLY IMMEDIATE`. Plan §1.2 added the modifier "for no
 * deferred surprise" semantics, but the EntriesService never calls
 * `SET CONSTRAINTS DEFERRED` — so DEFERRABLE buys nothing AND blocks the
 * `INSERT … ON CONFLICT (tenant_id, team_id, shift_date, shift_key) DO NOTHING`
 * pattern that `ShiftHandoverEntriesService.insertDraftOrFetch` relies on
 * (Phase 2.5 race-safety pattern, plan §2.5).
 *
 * PostgreSQL rejects ON CONFLICT against deferrable constraints (documented
 * limitation — the conflict arbiter must be evaluable at INSERT time):
 *
 *   ERROR: ON CONFLICT does not support deferrable unique constraints/
 *   exclusion constraints as arbiters
 *
 * Surfaced 2026-04-22 by the Phase-4 API integration tests
 * (`backend/test/shift-handover.api.test.ts`) — first real INSERT call.
 * Unit tests (Session 7) mocked the DB so the conflict was invisible.
 *
 * Drop + recreate is the simplest correct fix; the constraint is preserved
 * with the same name and column set, only the DEFERRABLE clause is removed.
 * Behavioural change: zero (initially-immediate is the default for plain
 * UNIQUE). Service code unchanged.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §1.2 (original constraint),
 *      §2.5 (insertDraftOrFetch ON CONFLICT pattern), §Phase 4 (failure mode)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE shift_handover_entries
      DROP CONSTRAINT shift_handover_entries_tenant_id_team_id_shift_date_shift_k_key;

    ALTER TABLE shift_handover_entries
      ADD CONSTRAINT shift_handover_entries_tenant_id_team_id_shift_date_shift_k_key
      UNIQUE (tenant_id, team_id, shift_date, shift_key);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE shift_handover_entries
      DROP CONSTRAINT shift_handover_entries_tenant_id_team_id_shift_date_shift_k_key;

    ALTER TABLE shift_handover_entries
      ADD CONSTRAINT shift_handover_entries_tenant_id_team_id_shift_date_shift_k_key
      UNIQUE (tenant_id, team_id, shift_date, shift_key) DEFERRABLE INITIALLY IMMEDIATE;
  `);
}

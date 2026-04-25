/**
 * Migration: tenants.deletion_status NOT NULL — defense against R15 host-resolver bug
 *
 * Purpose:
 *   Backfill any historic NULLs to 'active' and add a NOT NULL constraint to
 *   `tenants.deletion_status`. Closes the bug-class where a NULL value made the
 *   subdomain-routing host resolver query
 *     `WHERE subdomain = $1 AND deletion_status = 'active'`
 *   return zero rows — leaving `req.hostTenantId` null and bouncing every
 *   OAuth handoff with `HANDOFF_HOST_MISMATCH` (ADR-050 R15).
 *
 *   Root cause was `tenant-deletion.service.ts:211` setting `deletion_status = NULL`
 *   on cancellation (fixed in same PR). This migration is the structural
 *   defense — even if another code path or direct psql writes NULL again, the
 *   constraint rejects it.
 *
 *   The column DEFAULT 'active' was already set in the baseline schema, so
 *   we only add NOT NULL here. The backfill UPDATE is a defensive no-op when
 *   the bug-state has already been manually repaired (idempotent).
 *
 * @see backend/src/nest/common/middleware/tenant-host-resolver.middleware.ts (host→tenant query)
 * @see backend/src/nest/tenant-deletion/tenant-deletion.service.ts (cancelDeletion fix)
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §R15
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Session 21 (smoke-test discovery)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Backfill any historic NULLs to 'active'. Idempotent: 0 rows on a
    -- repaired DB. Required as a precondition for the NOT NULL constraint
    -- below — the ALTER would otherwise fail loud on the first NULL.
    UPDATE tenants SET deletion_status = 'active' WHERE deletion_status IS NULL;

    -- Structural defense — closes the NULL injection path documented in the
    -- header. ENUM type tenants_deletion_status, default 'active' already on
    -- the column from the baseline schema (verified via \\d tenants).
    ALTER TABLE tenants ALTER COLUMN deletion_status SET NOT NULL;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // WARNING: One-way migration in semantic terms. Rolling back drops the
  // constraint but does NOT restore the NULL values that were backfilled —
  // those NULLs were the bug-state we are fixing, restoring them would
  // re-open the R15 host-resolver bug. The column reverts to NULLABLE so
  // structural rollback succeeds, but the data stays in the recovered state.
  pgm.sql(`
    ALTER TABLE tenants ALTER COLUMN deletion_status DROP NOT NULL;
  `);
}

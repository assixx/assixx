/**
 * Migration: Make swap request shift IDs nullable
 *
 * Purpose: Shifts from shift_rotation_history have no shifts.id — swap requests
 * for rotation-generated shifts need nullable anchor IDs. executeSwap already
 * resolves shifts by user_id + date range, not by anchor IDs.
 *
 * WARNING: One-way migration. Rollback deletes rows with NULL shift IDs.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE shift_swap_requests ALTER COLUMN requester_shift_id DROP NOT NULL;
    ALTER TABLE shift_swap_requests ALTER COLUMN target_shift_id DROP NOT NULL;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DELETE FROM shift_swap_requests WHERE requester_shift_id IS NULL OR target_shift_id IS NULL;
    ALTER TABLE shift_swap_requests ALTER COLUMN requester_shift_id SET NOT NULL;
    ALTER TABLE shift_swap_requests ALTER COLUMN target_shift_id SET NOT NULL;
  `);
}

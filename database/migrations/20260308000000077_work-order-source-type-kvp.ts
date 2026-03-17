/**
 * Migration: Add 'kvp_proposal' to work_order_source_type ENUM
 *
 * Enables creating work orders from KVP proposals (Verbesserungsvorschläge),
 * completing the closed loop: KVP → Arbeitsauftrag → Bearbeitung → Verifizierung.
 *
 * WARNING: ENUM ADD VALUE cannot run inside a transaction in PostgreSQL.
 * node-pg-migrate handles this automatically.
 *
 * WARNING: One-way migration. PostgreSQL cannot remove ENUM values.
 * Rollback raises an exception instead.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TYPE work_order_source_type ADD VALUE IF NOT EXISTS 'kvp_proposal';
  `);
}

// eslint-disable-next-line no-unused-vars -- signature required by node-pg-migrate
export function down(_pgm: MigrationBuilder): void {
  throw new Error(
    'Irreversible migration: PostgreSQL cannot remove ENUM values. ' +
      'To remove kvp_proposal, use the detach-drop-recreate pattern.',
  );
}

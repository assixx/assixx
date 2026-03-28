/**
 * Migration: Fix ASCII-encoded umlauts in users.position
 * Date: 2026-02-02
 *
 * Problem: Legacy position values used ASCII substitutions
 * (geschaeftsfuehrer, qualitaetsleiter) instead of proper
 * German umlauts (geschäftsführer, qualitätsleiter).
 *
 * This migration normalizes existing DB values to match the
 * corrected frontend POSITION_MAP keys.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    UPDATE users SET position = 'geschäftsführer'
    WHERE position = 'geschaeftsfuehrer';

    UPDATE users SET position = 'qualitätsleiter'
    WHERE position = 'qualitaetsleiter';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    UPDATE users SET position = 'geschaeftsfuehrer'
    WHERE position = 'geschäftsführer';

    UPDATE users SET position = 'qualitaetsleiter'
    WHERE position = 'qualitätsleiter';
  `);
}

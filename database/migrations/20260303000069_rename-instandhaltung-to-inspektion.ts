/**
 * Migration: Rename tpm_card_category ENUM value 'instandhaltung' → 'inspektion'
 *
 * Purpose: Category label better reflects the actual task — inspection, not repair.
 * "Instandhaltung" (maintenance/repair) was misleading; these cards are about
 * checking/verifying equipment condition, which is "Inspektion" (inspection).
 *
 * Note: RENAME VALUE updates all stored ENUM data in-place (OID stays the same).
 * No UPDATE on tpm_cards needed — PostgreSQL handles that automatically.
 * Only tpm_color_config.status_key (VARCHAR) needs explicit UPDATE.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // RENAME VALUE changes the ENUM label — all stored data updates automatically
  pgm.sql(
    `ALTER TYPE tpm_card_category RENAME VALUE 'instandhaltung' TO 'inspektion';`,
  );

  // tpm_color_config.status_key is VARCHAR, not ENUM — needs explicit UPDATE
  pgm.sql(`
    UPDATE tpm_color_config
    SET status_key = 'inspektion'
    WHERE status_key = 'instandhaltung';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(
    `ALTER TYPE tpm_card_category RENAME VALUE 'inspektion' TO 'instandhaltung';`,
  );

  pgm.sql(`
    UPDATE tpm_color_config
    SET status_key = 'instandhaltung'
    WHERE status_key = 'inspektion';
  `);
}

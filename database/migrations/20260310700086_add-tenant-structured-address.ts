/**
 * Migration: Replace unstructured address TEXT with structured address fields
 *
 * Replaces the single `address` TEXT column with proper structured fields
 * for international address support (ISO 3166-1 alpha-2 country codes).
 *
 * All columns nullable — existing tenants have no address data.
 * Signup form enforces required fields at application level.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Drop unstructured address field (no existing data)
    ALTER TABLE tenants DROP COLUMN address;

    -- Add structured address columns
    ALTER TABLE tenants
      ADD COLUMN street VARCHAR(255),
      ADD COLUMN house_number VARCHAR(20),
      ADD COLUMN postal_code VARCHAR(20),
      ADD COLUMN city VARCHAR(100),
      ADD COLUMN country_code CHAR(2);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tenants
      DROP COLUMN street,
      DROP COLUMN house_number,
      DROP COLUMN postal_code,
      DROP COLUMN city,
      DROP COLUMN country_code;

    -- Restore original unstructured field
    ALTER TABLE tenants ADD COLUMN address TEXT;
  `);
}

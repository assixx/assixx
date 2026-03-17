/**
 * Migration: Add 'dummy' value to users_role ENUM
 * Date: 2026-03-03
 *
 * Part 1 of 2 for Dummy Users feature.
 *
 * Purpose:
 *   Extends the users_role ENUM with 'dummy' for anonymous display accounts
 *   (factory TVs and screens).
 *
 * IMPORTANT: This migration ONLY adds the enum value. Column + constraints
 *   are in a separate migration (067) because PostgreSQL requires new enum
 *   values to be committed before they can be referenced in CHECK constraints
 *   (error 55P04). Run this migration first, then create + run 067.
 *
 * WARNING: One-way migration. ENUM values cannot be removed without
 * detach-drop-recreate pattern. Rollback is a no-op for the enum value.
 *
 * Dependencies:
 *   - users table (baseline)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TYPE users_role ADD VALUE 'dummy';`);
}

export function down(): void {
  // ENUM value 'dummy' CANNOT be removed without detach-drop-recreate.
  // This is a lossy rollback — documented intentionally.
}

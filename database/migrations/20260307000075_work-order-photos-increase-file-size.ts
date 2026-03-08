/**
 * Migration: Increase work_order_photos file_size CHECK constraint from 5 MB to 10 MB
 *
 * Reason: PDF attachments (maintenance reports, checklists) are typically 1-8 MB.
 * The existing 5 MB limit blocks legitimate uploads. 10 MB is consistent with
 * the blackboard attachment limit (FILE_UPLOAD_CONFIG.MAX_SIZE_MB: 10).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE work_order_photos
      DROP CONSTRAINT work_order_photos_file_size_check;
    ALTER TABLE work_order_photos
      ADD CONSTRAINT work_order_photos_file_size_check
      CHECK (file_size > 0 AND file_size <= 10485760);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE work_order_photos
      DROP CONSTRAINT work_order_photos_file_size_check;
    ALTER TABLE work_order_photos
      ADD CONSTRAINT work_order_photos_file_size_check
      CHECK (file_size > 0 AND file_size <= 5242880);
  `);
}

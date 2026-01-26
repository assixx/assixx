/**
 * Migration: Add feature_id to notifications (ADR-004)
 * Date: 2026-01-15 (original) / 2026-01-27 (wrapped)
 *
 * Enables persistent notification counts for surveys, documents, and KVP
 * by linking notifications to their source features.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS feature_id INTEGER;

    COMMENT ON COLUMN notifications.feature_id IS
    'ID of the source feature (survey_id, document_id, or kvp_id). Used with type column to identify the original entity.';

    CREATE INDEX IF NOT EXISTS idx_notifications_type_feature
    ON notifications(tenant_id, type, feature_id)
    WHERE feature_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_notifications_feature_types
    ON notifications(tenant_id, recipient_type, recipient_id, type)
    WHERE type IN ('survey', 'document', 'kvp');

    CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_feature
    ON notifications(tenant_id, type, feature_id, recipient_type, COALESCE(recipient_id, 0))
    WHERE feature_id IS NOT NULL;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_notifications_unique_feature;
    DROP INDEX IF EXISTS idx_notifications_feature_types;
    DROP INDEX IF EXISTS idx_notifications_type_feature;
    ALTER TABLE notifications DROP COLUMN IF EXISTS feature_id;
  `);
}

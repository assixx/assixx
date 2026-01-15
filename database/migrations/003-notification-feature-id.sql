-- =====================================================
-- Migration: Add feature_id to notifications for ADR-004
-- Date: 2026-01-15
-- Author: Development Team
-- ADR: ADR-004-persistent-notification-counts
--
-- Purpose: Enable persistent notification counts for
-- surveys, documents, and KVP by linking notifications
-- to their source features.
-- =====================================================

-- 1. Add feature_id column to link notifications to source entity
-- This allows finding the original survey/document/kvp
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS feature_id INTEGER;

COMMENT ON COLUMN notifications.feature_id IS
'ID of the source feature (survey_id, document_id, or kvp_id). Used with type column to identify the original entity.';

-- 2. Add index for efficient queries by type and feature
-- Used when querying notifications for a specific feature
CREATE INDEX IF NOT EXISTS idx_notifications_type_feature
ON notifications(tenant_id, type, feature_id)
WHERE feature_id IS NOT NULL;

-- 3. Add index for unread count queries (used by /stats/me)
-- Optimizes the GROUP BY type query for feature notifications
CREATE INDEX IF NOT EXISTS idx_notifications_feature_types
ON notifications(tenant_id, recipient_type, recipient_id, type)
WHERE type IN ('survey', 'document', 'kvp');

-- 4. Add unique constraint to prevent duplicate notifications
-- One notification per feature per recipient combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_feature
ON notifications(tenant_id, type, feature_id, recipient_type, COALESCE(recipient_id, 0))
WHERE feature_id IS NOT NULL;

-- 5. Verify migration
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notifications' AND column_name = 'feature_id'
    ) THEN
        RAISE NOTICE '✅ Migration successful: feature_id column added to notifications';
    ELSE
        RAISE EXCEPTION '❌ Migration failed: feature_id column not found';
    END IF;
END $$;

-- Note: RLS policies already exist on notifications table
-- No additional RLS changes needed - feature_id is covered by existing tenant_isolation policy

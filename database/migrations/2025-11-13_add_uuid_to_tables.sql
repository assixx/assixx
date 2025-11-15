-- =====================================================
-- UUIDv7 Migration for Assixx
-- Date: 2025-11-13
-- Purpose: Add UUIDv7 columns to tables with exposed IDs
-- Strategy: Dual-ID approach (numeric id + external uuid)
-- =====================================================
--
-- WHY: Security - Prevent IDOR attacks and information leakage
-- WHAT: Add uuid CHAR(36) to user-facing tables
-- HOW: Keep numeric id for performance, add uuid for external API
--
-- TABLES AFFECTED:
-- 1. kvp_suggestions (PRIMARY - /kvp-detail?id=)
-- 2. surveys (/survey-results?id=)
-- 3. documents (/api/documents/:id)
-- 4. calendar_events (/api/events/:id)
-- 5. shift_plans (/api/plan/:id)
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

USE main;

-- =====================================================
-- STEP 1: Add UUID columns
-- =====================================================

-- 1.1: KVP Suggestions (PRIMARY TARGET)
ALTER TABLE kvp_suggestions
  ADD COLUMN uuid CHAR(36) DEFAULT NULL AFTER id,
  ADD COLUMN uuid_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Track when UUID was generated';

-- 1.2: Surveys
ALTER TABLE surveys
  ADD COLUMN uuid CHAR(36) DEFAULT NULL AFTER id,
  ADD COLUMN uuid_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 1.3: Documents
ALTER TABLE documents
  ADD COLUMN uuid CHAR(36) DEFAULT NULL AFTER id,
  ADD COLUMN uuid_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 1.4: Calendar Events
ALTER TABLE calendar_events
  ADD COLUMN uuid CHAR(36) DEFAULT NULL AFTER id,
  ADD COLUMN uuid_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 1.5: Shift Plans
ALTER TABLE shift_plans
  ADD COLUMN uuid CHAR(36) DEFAULT NULL AFTER id,
  ADD COLUMN uuid_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- =====================================================
-- STEP 2: Generate UUIDs for existing records
-- =====================================================
-- NOTE: Using MySQL UUID() as temporary solution
-- Backend will generate UUIDv7 for new records
-- =====================================================

UPDATE kvp_suggestions SET uuid = UUID() WHERE uuid IS NULL;
UPDATE surveys SET uuid = UUID() WHERE uuid IS NULL;
UPDATE documents SET uuid = UUID() WHERE uuid IS NULL;
UPDATE calendar_events SET uuid = UUID() WHERE uuid IS NULL;
UPDATE shift_plans SET uuid = UUID() WHERE uuid IS NULL;

-- =====================================================
-- STEP 3: Make UUID NOT NULL
-- =====================================================

ALTER TABLE kvp_suggestions MODIFY uuid CHAR(36) NOT NULL;
ALTER TABLE surveys MODIFY uuid CHAR(36) NOT NULL;
ALTER TABLE documents MODIFY uuid CHAR(36) NOT NULL;
ALTER TABLE calendar_events MODIFY uuid CHAR(36) NOT NULL;
ALTER TABLE shift_plans MODIFY uuid CHAR(36) NOT NULL;

-- =====================================================
-- STEP 4: Add UNIQUE indexes for UUID lookup
-- =====================================================

CREATE UNIQUE INDEX idx_kvp_uuid ON kvp_suggestions(uuid);
CREATE UNIQUE INDEX idx_survey_uuid ON surveys(uuid);
CREATE UNIQUE INDEX idx_document_uuid ON documents(uuid);
CREATE UNIQUE INDEX idx_calendar_event_uuid ON calendar_events(uuid);
CREATE UNIQUE INDEX idx_shift_plan_uuid ON shift_plans(uuid);

-- =====================================================
-- STEP 5: Add tenant_id compound indexes (performance)
-- =====================================================
-- These ensure fast lookups with tenant isolation
-- =====================================================

CREATE INDEX idx_kvp_tenant_uuid ON kvp_suggestions(tenant_id, uuid);
CREATE INDEX idx_survey_tenant_uuid ON surveys(tenant_id, uuid);
CREATE INDEX idx_document_tenant_uuid ON documents(tenant_id, uuid);
CREATE INDEX idx_calendar_tenant_uuid ON calendar_events(tenant_id, uuid);
CREATE INDEX idx_shift_plan_tenant_uuid ON shift_plans(tenant_id, uuid);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify migration success
-- =====================================================

-- Check UUID distribution
-- SELECT
--   'kvp_suggestions' as table_name,
--   COUNT(*) as total_rows,
--   COUNT(DISTINCT uuid) as unique_uuids,
--   COUNT(CASE WHEN uuid IS NULL THEN 1 END) as null_uuids
-- FROM kvp_suggestions
-- UNION ALL
-- SELECT 'surveys', COUNT(*), COUNT(DISTINCT uuid), COUNT(CASE WHEN uuid IS NULL THEN 1 END) FROM surveys
-- UNION ALL
-- SELECT 'documents', COUNT(*), COUNT(DISTINCT uuid), COUNT(CASE WHEN uuid IS NULL THEN 1 END) FROM documents
-- UNION ALL
-- SELECT 'calendar_events', COUNT(*), COUNT(DISTINCT uuid), COUNT(CASE WHEN uuid IS NULL THEN 1 END) FROM calendar_events
-- UNION ALL
-- SELECT 'shift_plans', COUNT(*), COUNT(DISTINCT uuid), COUNT(CASE WHEN uuid IS NULL THEN 1 END) FROM shift_plans;

-- Check index creation
-- SHOW INDEX FROM kvp_suggestions WHERE Key_name LIKE '%uuid%';
-- SHOW INDEX FROM surveys WHERE Key_name LIKE '%uuid%';
-- SHOW INDEX FROM documents WHERE Key_name LIKE '%uuid%';
-- SHOW INDEX FROM calendar_events WHERE Key_name LIKE '%uuid%';
-- SHOW INDEX FROM shift_plans WHERE Key_name LIKE '%uuid%';

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- NEXT STEPS:
-- 1. Update backend model to generate UUIDv7 on INSERT
-- 2. Update backend service to support uuid lookup
-- 3. Update backend controller to accept both id and uuid
-- 4. Update frontend to use uuid in URLs
-- 5. Test with existing data
-- 6. Monitor performance
-- =====================================================

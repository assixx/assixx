-- =====================================================
-- Migration: Document Storage UUID Enhancement
-- Date: 2025-11-06
-- Author: Claude Code
-- Description: Add UUID-based storage, checksums, and versioning
-- =====================================================

-- Step 1: Add new columns for UUID-based storage
ALTER TABLE documents
    -- UUID for collision-proof filenames
    ADD COLUMN file_uuid VARCHAR(36) NULL COMMENT 'UUID v4 for unique filename' AFTER id,

    -- SHA-256 checksum for file integrity
    ADD COLUMN file_checksum VARCHAR(64) NULL COMMENT 'SHA-256 hash for integrity verification' AFTER file_size,

    -- Storage type (database, filesystem, s3)
    ADD COLUMN storage_type ENUM('database', 'filesystem', 's3') DEFAULT 'filesystem'
        COMMENT 'Where the file is stored' AFTER file_content,

    -- Version support
    ADD COLUMN version INT DEFAULT 1 COMMENT 'Version number for file versioning' AFTER file_uuid,
    ADD COLUMN parent_version_id INT NULL COMMENT 'Previous version ID for versioning' AFTER version;

-- Step 2: Add indexes for performance
ALTER TABLE documents
    ADD INDEX idx_file_uuid (file_uuid),
    ADD INDEX idx_file_checksum (file_checksum),
    ADD INDEX idx_storage_type (storage_type),
    ADD INDEX idx_version (version),
    ADD INDEX idx_tenant_category_date (tenant_id, category, uploaded_at);

-- Step 3: Add foreign key for versioning (optional)
-- ALTER TABLE documents
--     ADD CONSTRAINT fk_parent_version
--     FOREIGN KEY (parent_version_id) REFERENCES documents(id)
--     ON DELETE SET NULL;

-- Step 4: Update existing records to set storage_type based on file_content
UPDATE documents
SET storage_type = CASE
    WHEN file_content IS NOT NULL THEN 'database'
    ELSE 'filesystem'
END
WHERE storage_type IS NULL OR storage_type = 'filesystem';

-- Step 5: Notes on columns to potentially remove later
-- The following columns are redundant (already have uploaded_at):
-- - year: Can use YEAR(uploaded_at)
-- - month: Can use MONTH(uploaded_at) or DATE_FORMAT(uploaded_at, '%M')
--
-- DO NOT remove yet - wait until all code is updated!
-- Future migration:
-- ALTER TABLE documents DROP COLUMN year, DROP COLUMN month;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check new columns exist
SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'documents'
    AND COLUMN_NAME IN ('file_uuid', 'file_checksum', 'storage_type', 'version', 'parent_version_id')
ORDER BY ORDINAL_POSITION;

-- Check indexes
SELECT
    INDEX_NAME,
    COLUMN_NAME,
    NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'documents'
    AND INDEX_NAME IN ('idx_file_uuid', 'idx_file_checksum', 'idx_storage_type', 'idx_version', 'idx_tenant_category_date')
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Check storage_type distribution
SELECT
    storage_type,
    COUNT(*) as count
FROM documents
GROUP BY storage_type;

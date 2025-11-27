-- =====================================================
-- Migration: Add 'blackboard' to documents access_scope enum
-- Date: 2025-11-24
-- Author: Claude
-- Purpose: Enable blackboard attachments to be stored in documents table
-- =====================================================

-- 1. Extend access_scope enum to include 'blackboard'
ALTER TABLE documents
MODIFY COLUMN access_scope ENUM('personal','team','department','company','payroll','blackboard') NOT NULL;

-- 2. Add blackboard_entry_id column for entry reference
ALTER TABLE documents
ADD COLUMN blackboard_entry_id INT NULL AFTER salary_month;

-- 3. Add foreign key constraint (SET NULL on delete - keeps document even if entry deleted)
ALTER TABLE documents
ADD CONSTRAINT fk_documents_blackboard_entry
    FOREIGN KEY (blackboard_entry_id) REFERENCES blackboard_entries(id)
    ON DELETE SET NULL;

-- 4. Create index for fast lookup by entry_id
CREATE INDEX idx_documents_blackboard_entry ON documents(blackboard_entry_id);

-- 5. Verify migration
SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'documents'
AND COLUMN_NAME IN ('access_scope', 'blackboard_entry_id');

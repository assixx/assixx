-- =====================================================
-- Migration: Fix Document Columns
-- Date: 2025-01-08
-- Author: System
-- Description: Adds missing columns for document uploads
--              to support file content storage and date categorization
-- =====================================================

-- IMPORTANT: This migration has been applied manually via phpMyAdmin
-- The following commands were executed on 2025-01-08:

-- 1. Add file_content column if it doesn't exist
-- This column stores the actual file binary data
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'documents' 
AND COLUMN_NAME = 'file_content';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE documents ADD COLUMN file_content LONGBLOB AFTER file_size',
    'SELECT ''Column file_content already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Add year column if it doesn't exist
-- Used for categorizing documents by year (e.g., salary documents)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'documents' 
AND COLUMN_NAME = 'year';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE documents ADD COLUMN year INT AFTER description',
    'SELECT ''Column year already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add month column if it doesn't exist
-- Used for categorizing documents by month (German month names supported)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'documents' 
AND COLUMN_NAME = 'month';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE documents ADD COLUMN month VARCHAR(20) AFTER year',
    'SELECT ''Column month already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Update indexes for better performance with year/month queries
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'documents'
AND INDEX_NAME = 'idx_documents_year_month';

SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_documents_year_month ON documents(year, month)',
    'SELECT ''Index idx_documents_year_month already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migration complete!
-- Status: APPLIED via phpMyAdmin on 2025-01-08
-- 
-- To verify:
-- DESCRIBE documents;
-- Should show: file_content (LONGBLOB), year (INT), month (VARCHAR(20))
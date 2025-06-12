-- =====================================================
-- Migration: Add availability columns to users table
-- Date: 2025-06-12
-- Author: System
-- =====================================================

-- Check if columns exist and add them if they don't
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'users' 
AND COLUMN_NAME = 'availability_status';

SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE users ADD COLUMN availability_status ENUM(''available'', ''unavailable'', ''vacation'', ''sick'') DEFAULT ''available''',
    'SELECT ''Column availability_status already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add availability_start if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'users' 
AND COLUMN_NAME = 'availability_start';

SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE users ADD COLUMN availability_start DATE DEFAULT NULL',
    'SELECT ''Column availability_start already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add availability_end if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'users' 
AND COLUMN_NAME = 'availability_end';

SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE users ADD COLUMN availability_end DATE DEFAULT NULL',
    'SELECT ''Column availability_end already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add availability_notes if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'users' 
AND COLUMN_NAME = 'availability_notes';

SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE users ADD COLUMN availability_notes TEXT DEFAULT NULL',
    'SELECT ''Column availability_notes already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for faster queries
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'users'
AND INDEX_NAME = 'idx_users_availability_status';

SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_users_availability_status ON users(availability_status)',
    'SELECT ''Index idx_users_availability_status already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing records to have default availability
UPDATE users 
SET availability_status = 'available' 
WHERE availability_status IS NULL;
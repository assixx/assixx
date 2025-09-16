-- =====================================================
-- Migration: Add team_id to kvp_suggestions
-- Date: 2025-09-02
-- Author: Claude
-- Description: Add team_id column to track which team a KVP suggestion belongs to
-- =====================================================

-- Check if team_id column exists
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_suggestions'
    AND COLUMN_NAME = 'team_id'
);

-- Add team_id column if it doesn't exist
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE kvp_suggestions ADD COLUMN team_id INT DEFAULT NULL AFTER submitted_by',
    'SELECT "Column team_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if foreign key exists
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_suggestions'
    AND COLUMN_NAME = 'team_id'
    AND REFERENCED_TABLE_NAME = 'teams'
);

-- Add foreign key constraint if it doesn't exist
SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE kvp_suggestions ADD CONSTRAINT fk_kvp_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "Foreign key already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if index exists
SET @index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_suggestions'
    AND INDEX_NAME = 'idx_kvp_team_id'
);

-- Add index if it doesn't exist
SET @sql = IF(@index_exists = 0,
    'CREATE INDEX idx_kvp_team_id ON kvp_suggestions(team_id)',
    'SELECT "Index already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing records where org_level = 'team' to set team_id from org_id
UPDATE kvp_suggestions 
SET team_id = org_id 
WHERE org_level = 'team' AND team_id IS NULL;
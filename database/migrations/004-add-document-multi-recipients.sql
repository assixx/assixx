-- =====================================================
-- Migration: Add Multi-Recipient Support for Documents
-- Date: 2025-01-06
-- Author: System
-- Description: Extends documents table to support uploads
--              for teams, departments, and entire company
-- =====================================================

-- 1. Backup existing documents structure (for safety)
-- Note: Make sure to run quick-backup.sh before this migration

-- 2. Add new columns to documents table
-- Check if columns exist first
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'documents' 
AND COLUMN_NAME = 'recipient_type';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE documents ADD COLUMN recipient_type ENUM(''user'', ''team'', ''department'', ''company'') DEFAULT ''user'' AFTER user_id',
    'SELECT ''Column recipient_type already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add team_id column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'documents' 
AND COLUMN_NAME = 'team_id';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE documents ADD COLUMN team_id INT NULL AFTER recipient_type',
    'SELECT ''Column team_id already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add department_id column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'documents' 
AND COLUMN_NAME = 'department_id';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE documents ADD COLUMN department_id INT NULL AFTER team_id',
    'SELECT ''Column department_id already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Update existing records to have recipient_type = 'user'
UPDATE documents 
SET recipient_type = 'user' 
WHERE recipient_type IS NULL;

-- 4. Add foreign key constraints
-- Check and add foreign key for team_id
SET @fk_exists = 0;
SELECT COUNT(*) INTO @fk_exists
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'documents'
AND CONSTRAINT_NAME = 'fk_documents_team_id';

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE documents ADD CONSTRAINT fk_documents_team_id FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE',
    'SELECT ''Foreign key fk_documents_team_id already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add foreign key for department_id
SET @fk_exists = 0;
SELECT COUNT(*) INTO @fk_exists
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'documents'
AND CONSTRAINT_NAME = 'fk_documents_department_id';

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE documents ADD CONSTRAINT fk_documents_department_id FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE',
    'SELECT ''Foreign key fk_documents_department_id already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Create indexes for better query performance
-- Check and create index for recipient_type
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'documents'
AND INDEX_NAME = 'idx_documents_recipient_type';

SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_documents_recipient_type ON documents(recipient_type)',
    'SELECT ''Index idx_documents_recipient_type already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and create index for team_id
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'documents'
AND INDEX_NAME = 'idx_documents_team_id';

SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_documents_team_id ON documents(team_id)',
    'SELECT ''Index idx_documents_team_id already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and create index for department_id
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'documents'
AND INDEX_NAME = 'idx_documents_department_id';

SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_documents_department_id ON documents(department_id)',
    'SELECT ''Index idx_documents_department_id already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Create a view for easier document queries with recipient info
CREATE OR REPLACE VIEW v_documents_with_recipients AS
SELECT 
    d.*,
    -- User info (for user-specific documents)
    u.first_name as user_first_name,
    u.last_name as user_last_name,
    u.email as user_email,
    -- Team info (for team documents)
    t.name as team_name,
    t.description as team_description,
    -- Department info (for department documents)
    dept.name as department_name,
    dept.description as department_description,
    -- Uploaded by info
    uploader.first_name as uploader_first_name,
    uploader.last_name as uploader_last_name,
    uploader.email as uploader_email,
    -- Calculate recipient display name
    CASE 
        WHEN d.recipient_type = 'user' THEN CONCAT(u.first_name, ' ', u.last_name)
        WHEN d.recipient_type = 'team' THEN CONCAT('Team: ', t.name)
        WHEN d.recipient_type = 'department' THEN CONCAT('Abteilung: ', dept.name)
        WHEN d.recipient_type = 'company' THEN 'Gesamte Firma'
        ELSE 'Unbekannt'
    END as recipient_display_name
FROM documents d
LEFT JOIN users u ON d.user_id = u.id AND d.recipient_type = 'user'
LEFT JOIN teams t ON d.team_id = t.id AND d.recipient_type = 'team'
LEFT JOIN departments dept ON d.department_id = dept.id AND d.recipient_type = 'department'
LEFT JOIN users uploader ON d.created_by = uploader.id;

-- 7. Update the old file_name and file_content columns to match new schema
-- Note: The current schema uses filename, file_path instead of file_name, file_content
-- This needs to be addressed in a separate migration or code update

-- 8. Note: Functions and triggers removed due to privilege requirements
-- The validation logic will be implemented in the application layer instead

-- 9. Grant necessary permissions (if needed)
-- Note: Adjust based on your user setup

-- Migration complete!
-- To verify:
-- SELECT recipient_type, COUNT(*) FROM documents GROUP BY recipient_type;
-- SHOW CREATE TABLE documents;
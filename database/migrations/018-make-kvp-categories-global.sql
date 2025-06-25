-- =====================================================
-- Migration: Make KVP Categories Global (Remove tenant_id)
-- Date: 2025-06-21
-- Author: Simon & Claude
-- Description: Convert KVP categories from tenant-specific to global
-- =====================================================

-- Step 1: Drop the foreign key constraint if it exists
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_categories'
    AND CONSTRAINT_NAME = 'kvp_categories_ibfk_1'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE kvp_categories DROP FOREIGN KEY kvp_categories_ibfk_1',
    'SELECT "Foreign key does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Drop indexes if they exist
SET @idx_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_categories'
    AND INDEX_NAME = 'tenant_id_2'
);

SET @sql = IF(@idx_exists > 0,
    'ALTER TABLE kvp_categories DROP INDEX tenant_id_2',
    'SELECT "Index tenant_id_2 does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop tenant_id index if exists
SET @idx_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_categories'
    AND INDEX_NAME = 'tenant_id'
);

SET @sql = IF(@idx_exists > 0,
    'ALTER TABLE kvp_categories DROP INDEX tenant_id',
    'SELECT "Index tenant_id does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: Handle foreign key constraint from kvp_suggestions
-- Temporarily disable foreign key checks
SET FOREIGN_KEY_CHECKS = 0;

-- Remove duplicate categories (keep only one of each)
-- Create mapping of old IDs to new IDs
CREATE TEMPORARY TABLE category_id_mapping AS
SELECT 
    old_cat.id as old_id,
    MIN(new_cat.id) as new_id
FROM kvp_categories old_cat
JOIN (
    SELECT MIN(id) as id, name 
    FROM kvp_categories 
    GROUP BY name
) new_cat ON old_cat.name = new_cat.name
GROUP BY old_cat.id;

-- Update kvp_suggestions to use the new category IDs
UPDATE kvp_suggestions s
JOIN category_id_mapping m ON s.category_id = m.old_id
SET s.category_id = m.new_id
WHERE m.old_id != m.new_id;

-- Delete duplicate categories (keep the ones with lowest ID)
DELETE c1 FROM kvp_categories c1
INNER JOIN kvp_categories c2 
WHERE c1.id > c2.id AND c1.name = c2.name;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Drop temporary table
DROP TEMPORARY TABLE category_id_mapping;

-- Step 4: Drop the tenant_id column
ALTER TABLE kvp_categories DROP COLUMN tenant_id;

-- Step 5: Add unique constraint on name only
ALTER TABLE kvp_categories ADD UNIQUE KEY unique_name (name);

-- Step 6: Ensure all categories have correct icons (in case some are still broken)
UPDATE kvp_categories SET icon = '🛡️' WHERE name = 'Sicherheit';
UPDATE kvp_categories SET icon = '⚡' WHERE name = 'Effizienz';
UPDATE kvp_categories SET icon = '⭐' WHERE name = 'Qualität';
UPDATE kvp_categories SET icon = '🌱' WHERE name = 'Umwelt';
UPDATE kvp_categories SET icon = '💤' WHERE name = 'Ergonomie';
UPDATE kvp_categories SET icon = '💰' WHERE name = 'Kosteneinsparung';

-- Step 7: Insert any missing standard categories
INSERT IGNORE INTO kvp_categories (name, description, color, icon) VALUES
('Sicherheit', 'Verbesserungen zur Arbeitssicherheit', '#e74c3c', '🛡️'),
('Effizienz', 'Prozessoptimierungen und Zeitersparnis', '#2ecc71', '⚡'),
('Qualität', 'Qualitätsverbesserungen und Fehlervermeidung', '#3498db', '⭐'),
('Umwelt', 'Umweltfreundliche Verbesserungen', '#27ae60', '🌱'),
('Ergonomie', 'Arbeitsplatzverbesserungen', '#9b59b6', '💤'),
('Kosteneinsparung', 'Maßnahmen zur Kostenreduzierung', '#f39c12', '💰');

-- Verify the changes
SELECT 'KVP Categories after migration:' as Info;
SELECT id, name, icon, color FROM kvp_categories ORDER BY id;
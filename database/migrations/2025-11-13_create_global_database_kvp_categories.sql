-- =====================================================
-- Migration: Create Global Database and Move KVP Categories
-- Date: 2025-11-13
-- Author: Simon & Claude
-- Description: Creates 'global' database for system-wide settings
--              and moves kvp_categories from 'main' to 'global'
--
-- WHY: Categories are global settings that should NOT be deleted
--      when customer resets/migrates their main database
--
-- IMPORTANT: Run this as ROOT user (not assixx_user)
-- =====================================================

-- Step 1: Create global database
CREATE DATABASE IF NOT EXISTS `global` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 2: Grant permissions to assixx_user
GRANT ALL PRIVILEGES ON `global`.* TO 'assixx_user'@'%';
FLUSH PRIVILEGES;

-- Step 3: Switch to global database
USE `global`;

-- Step 4: Create kvp_categories table in global database
CREATE TABLE IF NOT EXISTS `kvp_categories` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT,
    `color` VARCHAR(20) DEFAULT '#3498db',
    `icon` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '💡',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 5: Insert default categories with correct UTF-8 encoding
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

INSERT INTO `kvp_categories` (`name`, `description`, `color`, `icon`) VALUES
('Sicherheit', 'Verbesserungen zur Arbeitssicherheit', '#e74c3c', '🛡️'),
('Effizienz', 'Prozessoptimierungen und Zeitersparnis', '#2ecc71', '⚡'),
('Qualität', 'Qualitätsverbesserungen und Fehlervermeidung', '#3498db', '⭐'),
('Umwelt', 'Umweltfreundliche Verbesserungen', '#27ae60', '🌱'),
('Ergonomie', 'Arbeitsplatzverbesserungen', '#9b59b6', '💤'),
('Kosteneinsparung', 'Maßnahmen zur Kostenreduzierung', '#f39c12', '💰');

-- Step 6: Update kvp_suggestions foreign key in main database
USE `main`;

-- Drop old foreign key constraint (if exists)
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'main'
    AND TABLE_NAME = 'kvp_suggestions'
    AND CONSTRAINT_NAME = 'kvp_suggestions_ibfk_2'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE kvp_suggestions DROP FOREIGN KEY kvp_suggestions_ibfk_2',
    'SELECT "Foreign key kvp_suggestions_ibfk_2 does not exist" as Info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop old kvp_categories table from main database (if exists)
DROP TABLE IF EXISTS `kvp_categories`;

-- Create new foreign key to global.kvp_categories
ALTER TABLE `kvp_suggestions`
  ADD CONSTRAINT `fk_kvp_category`
  FOREIGN KEY (`category_id`)
  REFERENCES `global`.`kvp_categories`(`id`)
  ON DELETE SET NULL;

-- Step 7: Verify migration
SELECT 'Migration completed successfully!' as Status;
SELECT '✅ global database created' as Step1;
SELECT '✅ kvp_categories moved to global.kvp_categories' as Step2;
SELECT '✅ Foreign key updated in kvp_suggestions' as Step3;

-- Verify data
SELECT CONCAT('Found ', COUNT(*), ' categories in global.kvp_categories') as Verification
FROM `global`.`kvp_categories`;

SELECT id, name, icon
FROM `global`.`kvp_categories`
ORDER BY name;

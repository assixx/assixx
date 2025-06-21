-- =====================================================
-- Migration: Recreate KVP Categories Table
-- Date: 2025-06-21
-- Author: Simon & Claude
-- Description: Drop and recreate table with correct encoding
-- =====================================================

-- Temporarily store the category data
CREATE TEMPORARY TABLE temp_kvp_categories AS
SELECT id, name, description, color FROM kvp_categories;

-- Disable foreign key checks
SET FOREIGN_KEY_CHECKS = 0;

-- Drop and recreate the table with explicit charset
DROP TABLE IF EXISTS kvp_categories;

CREATE TABLE kvp_categories (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#3498db',
    icon VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '💡',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Insert data with correct icons
INSERT INTO kvp_categories (name, description, color, icon) VALUES
('Sicherheit', 'Verbesserungen zur Arbeitssicherheit', '#e74c3c', '🛡️'),
('Effizienz', 'Prozessoptimierungen und Zeitersparnis', '#2ecc71', '⚡'),
('Qualität', 'Qualitätsverbesserungen und Fehlervermeidung', '#3498db', '⭐'),
('Umwelt', 'Umweltfreundliche Verbesserungen', '#27ae60', '🌱'),
('Ergonomie', 'Arbeitsplatzverbesserungen', '#9b59b6', '💤'),
('Kosteneinsparung', 'Maßnahmen zur Kostenreduzierung', '#f39c12', '💰');

-- Drop temporary table
DROP TEMPORARY TABLE temp_kvp_categories;

-- Verify the fix
SELECT 'Recreated KVP Categories:' as Info;
SELECT id, name, icon, LENGTH(icon) as icon_length, CHAR_LENGTH(icon) as char_length FROM kvp_categories ORDER BY name;
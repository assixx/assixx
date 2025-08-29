-- Migration: Fix KVP categories encoding issues
-- Date: 2025-08-28
-- Description: Fixes UTF8MB4 encoding issues for emoji icons

-- First ensure the table uses UTF8MB4
ALTER TABLE kvp_categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Ensure the icon column uses UTF8MB4
ALTER TABLE kvp_categories 
MODIFY COLUMN icon VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '💡';

-- Fix the broken emoji data
UPDATE kvp_categories SET icon = '🛡️' WHERE id = 1;
UPDATE kvp_categories SET icon = '⚡' WHERE id = 2;
UPDATE kvp_categories SET icon = '⭐' WHERE id = 3;
UPDATE kvp_categories SET icon = '🌱' WHERE id = 4;
UPDATE kvp_categories SET icon = '👥' WHERE id = 5;
UPDATE kvp_categories SET icon = '💰' WHERE id = 6;

-- Verify the fix
SELECT id, name, HEX(icon) as icon_hex, icon FROM kvp_categories;
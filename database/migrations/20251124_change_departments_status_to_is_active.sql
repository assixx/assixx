-- Migration: Change departments.status ENUM to is_active TINYINT(1)
-- Date: 2024-11-24
-- Purpose: Align departments table with teams and areas tables

-- Step 1: Add new is_active column
ALTER TABLE departments
ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER area_id;

-- Step 2: Migrate data from status to is_active
UPDATE departments
SET is_active = CASE
    WHEN status = 'active' THEN 1
    WHEN status = 'inactive' THEN 0
    ELSE 1
END;

-- Step 3: Add index on is_active for performance
ALTER TABLE departments
ADD INDEX idx_is_active (is_active);

-- Step 4: Drop old status column
ALTER TABLE departments
DROP COLUMN status;

-- Step 5: Drop old visibility column (not used anymore)
ALTER TABLE departments
DROP COLUMN visibility;

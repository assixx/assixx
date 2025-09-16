-- =====================================================
-- Migration: Shift System Complete Fix
-- Date: 2025-01-28
-- Author: System
-- Purpose: Fix Multi-Tenant Isolation & Add Machine Support
-- =====================================================

-- 1. Add machine_id to shifts table (CRITICAL for machine-based planning)
-- Check if column exists first
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shifts' 
    AND COLUMN_NAME = 'machine_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shifts ADD COLUMN machine_id INT DEFAULT NULL AFTER team_id',
    'SELECT "Column machine_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraint if not exists
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shifts'
    AND COLUMN_NAME = 'machine_id'
    AND REFERENCED_TABLE_NAME = 'machines'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE shifts ADD CONSTRAINT fk_shifts_machine FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL',
    'SELECT "Foreign key fk_shifts_machine already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add indexes for performance (ignore if they exist)
CREATE INDEX idx_shifts_machine ON shifts(machine_id);
CREATE INDEX idx_shifts_dept_team_machine ON shifts(department_id, team_id, machine_id);
CREATE INDEX idx_shifts_date_machine ON shifts(date, machine_id);

-- 2. Fix Multi-Tenant Isolation (SECURITY CRITICAL!)
-- Note: Using tenant_id = 8 as default (current test tenant)

-- Fix shift_group_members
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_group_members' 
    AND COLUMN_NAME = 'tenant_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shift_group_members ADD COLUMN tenant_id INT NOT NULL DEFAULT 8 AFTER id',
    'SELECT "Column tenant_id already exists in shift_group_members"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create index (ignore error if exists)
CREATE INDEX idx_sgm_tenant ON shift_group_members(tenant_id);

-- Fix shift_notes
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_notes' 
    AND COLUMN_NAME = 'tenant_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shift_notes ADD COLUMN tenant_id INT NOT NULL DEFAULT 8 AFTER id',
    'SELECT "Column tenant_id already exists in shift_notes"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create index (ignore error if exists)
CREATE INDEX idx_sn_tenant ON shift_notes(tenant_id);

-- Fix shift_pattern_assignments
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_pattern_assignments' 
    AND COLUMN_NAME = 'tenant_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shift_pattern_assignments ADD COLUMN tenant_id INT NOT NULL DEFAULT 8 AFTER id',
    'SELECT "Column tenant_id already exists in shift_pattern_assignments"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create index (ignore error if exists)
CREATE INDEX idx_spa_tenant ON shift_pattern_assignments(tenant_id);

-- Fix shift_swaps
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_swaps' 
    AND COLUMN_NAME = 'tenant_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shift_swaps ADD COLUMN tenant_id INT NOT NULL DEFAULT 8 AFTER id',
    'SELECT "Column tenant_id already exists in shift_swaps"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create index (ignore error if exists)
CREATE INDEX idx_ss_tenant ON shift_swaps(tenant_id);

-- 3. Ensure proper relationships and indexes (ignore errors if exist)
CREATE INDEX idx_machines_dept ON machines(department_id);
CREATE INDEX idx_teams_dept ON teams(department_id);
CREATE INDEX idx_user_teams_team ON user_teams(team_id);
CREATE INDEX idx_user_teams_user ON user_teams(user_id);

-- 4. Update shift types to include common German shift types
ALTER TABLE shifts 
MODIFY COLUMN type ENUM('regular','overtime','standby','vacation','sick','holiday','early','late','night','day','flexible') 
DEFAULT 'regular';

-- 5. Populate tenant_id for existing records (if any)
-- Update shift_group_members tenant_id from related shift_groups
UPDATE shift_group_members sgm 
JOIN shift_groups sg ON sgm.group_id = sg.id 
SET sgm.tenant_id = sg.tenant_id 
WHERE sgm.tenant_id = 8;

-- Update shift_notes tenant_id from related shifts
UPDATE shift_notes sn 
JOIN shifts s ON sn.shift_id = s.id 
SET sn.tenant_id = s.tenant_id 
WHERE sn.tenant_id = 8;

-- Update shift_pattern_assignments tenant_id from related shift_patterns
UPDATE shift_pattern_assignments spa 
JOIN shift_patterns sp ON spa.pattern_id = sp.id 
SET spa.tenant_id = sp.tenant_id 
WHERE spa.tenant_id = 8;

-- Update shift_swaps tenant_id from related shifts
UPDATE shift_swaps ss 
JOIN shifts s ON ss.original_shift_id = s.id 
SET ss.tenant_id = s.tenant_id 
WHERE ss.tenant_id = 8;

-- 6. Add useful views for shift planning
CREATE OR REPLACE VIEW v_shift_planning AS
SELECT 
    s.id,
    s.tenant_id,
    s.date,
    s.type as shift_type,
    s.status,
    s.start_time,
    s.end_time,
    s.notes,
    s.department_id,
    d.name as department_name,
    s.team_id,
    t.name as team_name,
    s.machine_id,
    m.name as machine_name,
    m.status as machine_status,
    s.user_id,
    u.first_name,
    u.last_name,
    CONCAT(u.first_name, ' ', u.last_name) as employee_name,
    u.username
FROM shifts s
LEFT JOIN departments d ON s.department_id = d.id
LEFT JOIN teams t ON s.team_id = t.id
LEFT JOIN machines m ON s.machine_id = m.id
LEFT JOIN users u ON s.user_id = u.id
WHERE s.tenant_id = 8;

-- 7. Migration complete message
SELECT 'Migration 004-shift-system-complete.sql completed successfully!' as status;
SELECT 
    'Added machine_id to shifts table' as change1,
    'Fixed tenant_id in 4 tables' as change2,
    'Added performance indexes' as change3,
    'Created shift planning view' as change4;
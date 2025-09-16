-- Migration: Area-Department-Machine-Team Relationships
-- Date: 2025-01-09
-- Description: Establishes proper hierarchical relationships between areas, departments, machines and teams
-- Author: Claude

-- ====================================
-- STEP 1: Add area_id to departments
-- ====================================
ALTER TABLE departments 
ADD COLUMN area_id INT DEFAULT NULL AFTER parent_id,
ADD INDEX idx_area_id (area_id),
ADD CONSTRAINT fk_departments_area 
    FOREIGN KEY (area_id) REFERENCES areas(id) 
    ON DELETE SET NULL;

-- ====================================
-- STEP 2: Add proper FK constraint to machines.area_id
-- ====================================
-- First check if area_id column exists (it does)
-- Add the foreign key constraint
ALTER TABLE machines 
ADD CONSTRAINT fk_machines_area 
    FOREIGN KEY (area_id) REFERENCES areas(id) 
    ON DELETE SET NULL;

-- ====================================
-- STEP 3: Create machine_teams junction table
-- ====================================
-- This allows many-to-many relationship: 
-- Multiple teams can work on one machine (shifts)
-- One team can work on multiple machines
CREATE TABLE IF NOT EXISTS machine_teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    machine_id INT NOT NULL,
    team_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT DEFAULT NULL,
    is_primary BOOLEAN DEFAULT FALSE COMMENT 'Main team responsible for this machine',
    notes TEXT,
    
    -- Indexes for performance
    INDEX idx_tenant_machine_teams (tenant_id),
    INDEX idx_machine_id (machine_id),
    INDEX idx_team_id (team_id),
    INDEX idx_assigned_at (assigned_at),
    
    -- Foreign keys with tenant isolation
    CONSTRAINT fk_machine_teams_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_machine_teams_machine 
        FOREIGN KEY (machine_id) REFERENCES machines(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_machine_teams_team 
        FOREIGN KEY (team_id) REFERENCES teams(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_machine_teams_assigned_by 
        FOREIGN KEY (assigned_by) REFERENCES users(id) 
        ON DELETE SET NULL,
    
    -- Ensure unique assignment per tenant
    UNIQUE KEY unique_machine_team_per_tenant (tenant_id, machine_id, team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================
-- STEP 4: Drop redundant user_teams table if not used
-- ====================================
-- Check if user_teams is actually used anywhere
-- If not used, uncomment to drop:
-- DROP TABLE IF EXISTS user_teams;

-- ====================================
-- STEP 5: Add comments for documentation
-- ====================================
ALTER TABLE areas COMMENT = 'Physical locations/areas (e.g., buildings, halls, warehouses)';
ALTER TABLE departments COMMENT = 'Organizational departments within areas';
ALTER TABLE machines COMMENT = 'Machines located in departments/areas';
ALTER TABLE teams COMMENT = 'Teams that work in departments and operate machines';
ALTER TABLE machine_teams COMMENT = 'Junction table: which teams work on which machines';

-- ====================================
-- VERIFICATION QUERIES (Run manually to check)
-- ====================================
-- Check the new structure:
-- SHOW CREATE TABLE departments;
-- SHOW CREATE TABLE machines; 
-- SHOW CREATE TABLE machine_teams;

-- Check relationships:
-- SELECT 
--     a.name as area,
--     d.name as department,
--     m.name as machine,
--     t.name as team
-- FROM areas a
-- LEFT JOIN departments d ON d.area_id = a.id
-- LEFT JOIN machines m ON m.department_id = d.id AND m.area_id = a.id
-- LEFT JOIN machine_teams mt ON mt.machine_id = m.id
-- LEFT JOIN teams t ON t.id = mt.team_id
-- WHERE a.tenant_id = ?;
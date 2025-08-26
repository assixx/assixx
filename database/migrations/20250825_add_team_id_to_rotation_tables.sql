-- =====================================================
-- Migration: Add team_id to shift rotation tables
-- Date: 2025-08-25
-- Author: Claude
-- =====================================================

-- 1. Add team_id to shift_rotation_patterns
ALTER TABLE shift_rotation_patterns 
ADD COLUMN team_id INT DEFAULT NULL AFTER tenant_id,
ADD CONSTRAINT fk_rotation_patterns_team 
    FOREIGN KEY (team_id) REFERENCES teams(id) 
    ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_shift_rotation_patterns_team_id ON shift_rotation_patterns(team_id);

-- 2. Add team_id to shift_rotation_assignments  
ALTER TABLE shift_rotation_assignments 
ADD COLUMN team_id INT DEFAULT NULL AFTER user_id,
ADD CONSTRAINT fk_rotation_assignments_team 
    FOREIGN KEY (team_id) REFERENCES teams(id) 
    ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_shift_rotation_assignments_team_id ON shift_rotation_assignments(team_id);

-- 3. Add team_id to shift_rotation_history
ALTER TABLE shift_rotation_history 
ADD COLUMN team_id INT DEFAULT NULL AFTER user_id,
ADD CONSTRAINT fk_rotation_history_team 
    FOREIGN KEY (team_id) REFERENCES teams(id) 
    ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_shift_rotation_history_team_id ON shift_rotation_history(team_id);

-- 4. Update existing records with team_id from user_teams table where possible
-- For shift_rotation_assignments
UPDATE shift_rotation_assignments sra
INNER JOIN user_teams ut ON sra.user_id = ut.user_id
SET sra.team_id = ut.team_id
WHERE sra.team_id IS NULL;

-- For shift_rotation_history
UPDATE shift_rotation_history srh
INNER JOIN user_teams ut ON srh.user_id = ut.user_id
SET srh.team_id = ut.team_id
WHERE srh.team_id IS NULL;

-- For shift_rotation_patterns - update based on first user's team in assignments
UPDATE shift_rotation_patterns srp
INNER JOIN (
    SELECT pattern_id, MIN(team_id) as team_id
    FROM shift_rotation_assignments
    WHERE team_id IS NOT NULL
    GROUP BY pattern_id
) AS team_data ON srp.id = team_data.pattern_id
SET srp.team_id = team_data.team_id
WHERE srp.team_id IS NULL;
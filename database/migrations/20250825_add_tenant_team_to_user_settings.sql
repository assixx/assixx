-- Migration: Add tenant_id and team_id to user_settings table
-- Date: 2025-08-25
-- Purpose: Enable team-specific settings with proper multi-tenant isolation

-- Step 1: Add tenant_id column (required for multi-tenant isolation)
ALTER TABLE user_settings 
ADD COLUMN tenant_id INT NULL AFTER user_id;

-- Step 2: Add team_id column (for team-specific settings)
ALTER TABLE user_settings 
ADD COLUMN team_id INT NULL AFTER tenant_id;

-- Step 3: Populate tenant_id from users table for existing records
UPDATE user_settings us
JOIN users u ON us.user_id = u.id
SET us.tenant_id = u.tenant_id
WHERE us.tenant_id IS NULL;

-- Step 4: Make tenant_id NOT NULL after population
ALTER TABLE user_settings 
MODIFY COLUMN tenant_id INT NOT NULL;

-- Step 5: Drop the old unique constraint
ALTER TABLE user_settings 
DROP INDEX unique_user_setting;

-- Step 6: Create new unique constraint including tenant_id and team_id
-- This allows same user to have different settings for different teams
ALTER TABLE user_settings 
ADD UNIQUE KEY unique_user_team_setting (user_id, tenant_id, team_id, setting_key);

-- Step 7: Add foreign key constraints
ALTER TABLE user_settings
ADD CONSTRAINT user_settings_tenant_fk 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE user_settings
ADD CONSTRAINT user_settings_team_fk 
FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

-- Step 8: Add indexes for performance
CREATE INDEX idx_tenant_id ON user_settings(tenant_id);
CREATE INDEX idx_team_id ON user_settings(team_id);
CREATE INDEX idx_user_tenant_team ON user_settings(user_id, tenant_id, team_id);

-- Step 9: Update existing rotation settings to be global (no team_id)
-- They will be NULL for team_id meaning they apply to all teams
UPDATE user_settings 
SET team_id = NULL 
WHERE setting_key IN ('shift_rotation_enabled', 'shift_autofill_enabled', 'shift_autofill_config');

-- Step 10: Add comment to table
ALTER TABLE user_settings COMMENT = 'User settings with team-specific support and multi-tenant isolation';
-- Add tenant_id to survey_assignments table for multi-tenant isolation
ALTER TABLE survey_assignments 
ADD COLUMN tenant_id INT NOT NULL AFTER id;

-- Add foreign key constraint
ALTER TABLE survey_assignments
ADD CONSTRAINT fk_survey_assignments_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Add index for performance
ALTER TABLE survey_assignments
ADD INDEX idx_tenant_id (tenant_id);

-- Update the unique constraint to include tenant_id
ALTER TABLE survey_assignments
DROP INDEX unique_assignment;

ALTER TABLE survey_assignments
ADD UNIQUE KEY unique_assignment (tenant_id, survey_id, assignment_type, department_id, team_id, user_id);
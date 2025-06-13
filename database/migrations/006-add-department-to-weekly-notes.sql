-- =====================================================
-- Migration: Add department_id to weekly_shift_notes
-- Date: 2025-06-12
-- Author: System
-- =====================================================

-- Add department_id column as NOT NULL (since table is empty)
ALTER TABLE weekly_shift_notes 
ADD COLUMN department_id INT NOT NULL AFTER tenant_id,
ADD INDEX idx_weekly_notes_dept (tenant_id, department_id, date),
ADD CONSTRAINT fk_weekly_notes_department 
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

-- Update the unique key to include department_id
ALTER TABLE weekly_shift_notes 
DROP INDEX unique_week_tenant,
ADD UNIQUE KEY unique_week_tenant_dept (tenant_id, department_id, date);

-- Verify the changes
DESCRIBE weekly_shift_notes;
-- Migration: Rename manager_id to department_lead_id in departments table
-- Date: 2025-11-29
-- Reason: More descriptive naming - "department_lead_id" is clearer than generic "manager_id"

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE departments DROP FOREIGN KEY departments_ibfk_2;

-- Step 2: Drop the existing index
ALTER TABLE departments DROP INDEX idx_manager_id;

-- Step 3: Rename the column
ALTER TABLE departments CHANGE COLUMN manager_id department_lead_id INT;

-- Step 4: Recreate the foreign key with new column name
ALTER TABLE departments
ADD CONSTRAINT fk_departments_lead
FOREIGN KEY (department_lead_id) REFERENCES users(id) ON DELETE SET NULL;

-- Step 5: Recreate the index with new name
CREATE INDEX idx_department_lead_id ON departments(department_lead_id);

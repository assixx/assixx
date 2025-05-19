-- Add new columns to departments table
ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive') DEFAULT 'active',
ADD COLUMN IF NOT EXISTS visibility ENUM('public', 'private') DEFAULT 'public';

-- Add an index for better performance
CREATE INDEX IF NOT EXISTS idx_departments_status ON departments(status);
CREATE INDEX IF NOT EXISTS idx_departments_visibility ON departments(visibility);
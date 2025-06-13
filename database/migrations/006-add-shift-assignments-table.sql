-- =====================================================
-- Migration: Add shift_assignments table for new shift planning system
-- Date: 2025-01-11
-- Author: Claude
-- =====================================================

-- Create shift_assignments table to link employees to shifts
CREATE TABLE IF NOT EXISTS shift_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  shift_id INT NOT NULL,
  user_id INT NOT NULL,
  assignment_type ENUM('assigned', 'requested', 'available', 'unavailable') DEFAULT 'assigned',
  status ENUM('pending', 'accepted', 'declined', 'cancelled') DEFAULT 'pending',
  assigned_by INT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  response_at TIMESTAMP NULL,
  notes TEXT,
  overtime_hours DECIMAL(4,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_shift_user (shift_id, user_id),
  INDEX idx_user_status (user_id, status),
  INDEX idx_shift_type (shift_id, assignment_type),
  INDEX idx_assigned_by (assigned_by),
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create shift_plans table for organizing shifts
CREATE TABLE IF NOT EXISTS shift_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  department_id INT,
  team_id INT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('draft', 'published', 'locked', 'archived') DEFAULT 'draft',
  created_by INT NOT NULL,
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_dates (tenant_id, start_date, end_date),
  INDEX idx_department (department_id),
  INDEX idx_team (team_id),
  INDEX idx_status (status),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Add plan_id column to shifts table if it doesn't exist
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shifts' 
    AND COLUMN_NAME = 'plan_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shifts ADD COLUMN plan_id INT DEFAULT 1 AFTER tenant_id',
    'SELECT "Column plan_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add department_id column to shifts table if it doesn't exist
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shifts' 
    AND COLUMN_NAME = 'department_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shifts ADD COLUMN department_id INT AFTER notes',
    'SELECT "Column department_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add team_id column to shifts table if it doesn't exist
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shifts' 
    AND COLUMN_NAME = 'team_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shifts ADD COLUMN team_id INT AFTER department_id',
    'SELECT "Column team_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add title column to shifts table if it doesn't exist
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shifts' 
    AND COLUMN_NAME = 'title'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shifts ADD COLUMN title VARCHAR(200) AFTER end_time',
    'SELECT "Column title already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add required_employees column to shifts table if it doesn't exist
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shifts' 
    AND COLUMN_NAME = 'required_employees'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shifts ADD COLUMN required_employees INT DEFAULT 1 AFTER title',
    'SELECT "Column required_employees already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Insert default shift plan
INSERT IGNORE INTO shift_plans (id, tenant_id, name, description, start_date, end_date, status, created_by)
VALUES (1, 1, 'Default Plan', 'Default shift plan for weekly scheduling', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY), 'published', 1);

-- Update foreign key for plan_id
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shifts' 
    AND COLUMN_NAME = 'plan_id' 
    AND REFERENCED_TABLE_NAME = 'shift_plans'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE shifts ADD FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE',
    'SELECT "Foreign key for plan_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update foreign key for department_id
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shifts' 
    AND COLUMN_NAME = 'department_id' 
    AND REFERENCED_TABLE_NAME = 'departments'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE shifts ADD FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL',
    'SELECT "Foreign key for department_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update foreign key for team_id
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shifts' 
    AND COLUMN_NAME = 'team_id' 
    AND REFERENCED_TABLE_NAME = 'teams'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE shifts ADD FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL',
    'SELECT "Foreign key for team_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create employee_availability table for managing availability
CREATE TABLE IF NOT EXISTS employee_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  availability_type ENUM('available', 'preferred', 'unavailable', 'sick', 'vacation') DEFAULT 'available',
  start_time TIME,
  end_time TIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_date (user_id, date),
  INDEX idx_user_availability (user_id, availability_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create shift_exchange_requests table for shift swapping
CREATE TABLE IF NOT EXISTS shift_exchange_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  shift_id INT NOT NULL,
  requester_id INT NOT NULL,
  target_user_id INT,
  exchange_type ENUM('give_away', 'swap', 'request_coverage') DEFAULT 'give_away',
  target_shift_id INT,
  message TEXT,
  status ENUM('pending', 'accepted', 'declined', 'cancelled', 'completed') DEFAULT 'pending',
  response_message TEXT,
  approved_by INT,
  approved_at TIMESTAMP NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_requester (requester_id),
  INDEX idx_target_user (target_user_id),
  INDEX idx_status (status),
  INDEX idx_shift (shift_id),
  INDEX idx_target_shift (target_shift_id),
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (target_shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
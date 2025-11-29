-- ============================================================================
-- Migration: Create user_departments table (N:M relationship)
-- Part of: Assignment System Refactoring - Consistency
-- Date: 2025-11-27
--
-- Purpose: Replace users.department_id (1:1) with N:M junction table
--          Consistent with user_teams and user_area_permissions pattern
--
-- WICHTIG: Diese Migration ist NON-BREAKING
--          users.department_id bleibt vorerst bestehen (wird in Mission 6 entfernt)
-- ============================================================================

-- Create junction table for user-department N:M relationship
CREATE TABLE IF NOT EXISTS user_departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  department_id INT NOT NULL,

  -- Primary department flag (for payroll, HR reports, etc.)
  is_primary TINYINT(1) NOT NULL DEFAULT 1,

  -- Audit fields
  assigned_by INT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign Keys
  CONSTRAINT fk_ud_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_ud_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ud_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  CONSTRAINT fk_ud_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  UNIQUE KEY uq_user_department_tenant (user_id, department_id, tenant_id),

  -- Indexes for common queries
  INDEX idx_ud_tenant_user (tenant_id, user_id),
  INDEX idx_ud_tenant_department (tenant_id, department_id),
  INDEX idx_ud_primary (tenant_id, is_primary)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Verification query (run after migration)
-- ============================================================================
-- DESCRIBE user_departments;
-- SHOW CREATE TABLE user_departments;

-- Migration: Create user_area_permissions table
-- Date: 2025-11-27
-- Purpose: Allow users (admin/employee) to be assigned to Areas for hierarchical permissions
-- Part of: Assignment System Refactoring (Mission 2)

-- Step 1: Create the table
CREATE TABLE IF NOT EXISTS user_area_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  area_id INT NOT NULL,
  can_read TINYINT(1) NOT NULL DEFAULT 1,
  can_write TINYINT(1) NOT NULL DEFAULT 0,
  can_delete TINYINT(1) NOT NULL DEFAULT 0,
  assigned_by INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign key constraints
  CONSTRAINT fk_uap_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_uap_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uap_area FOREIGN KEY (area_id)
    REFERENCES areas(id) ON DELETE CASCADE,
  CONSTRAINT fk_uap_assigned_by FOREIGN KEY (assigned_by)
    REFERENCES users(id) ON DELETE RESTRICT,

  -- Unique constraint: One permission entry per user-area-tenant combination
  UNIQUE KEY uq_user_area_tenant (user_id, area_id, tenant_id),

  -- Indexes for efficient queries
  INDEX idx_uap_tenant_user (tenant_id, user_id),
  INDEX idx_uap_tenant_area (tenant_id, area_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verification queries:
-- SHOW CREATE TABLE user_area_permissions;
-- SELECT COUNT(*) FROM user_area_permissions;

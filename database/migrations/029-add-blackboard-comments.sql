-- Migration: 029-add-blackboard-comments.sql
-- Date: 2025-11-24
-- Purpose: Add comments table for blackboard entries (mirroring kvp_comments structure)

-- Create blackboard_comments table
CREATE TABLE IF NOT EXISTS blackboard_comments (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  entry_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  is_internal TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  -- Indexes for performance
  KEY idx_blackboard_comments_entry_id (entry_id),
  KEY idx_blackboard_comments_user_id (user_id),
  KEY idx_blackboard_comments_tenant_id (tenant_id),
  KEY idx_blackboard_comments_tenant_entry (tenant_id, entry_id),
  KEY idx_blackboard_comments_created_at (created_at),

  -- Foreign Keys
  CONSTRAINT fk_blackboard_comments_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_blackboard_comments_entry
    FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
  CONSTRAINT fk_blackboard_comments_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify table was created
SELECT 'blackboard_comments table created successfully' AS status;

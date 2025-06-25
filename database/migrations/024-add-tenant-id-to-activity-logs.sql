-- =====================================================
-- Migration: Add tenant_id to activity_logs
-- Date: 2025-06-25
-- Description: Fixes critical security issue where logs
--              from all tenants were visible to each other
-- =====================================================

-- 1. Add tenant_id column to activity_logs
ALTER TABLE activity_logs 
ADD COLUMN tenant_id INT NULL AFTER id;

-- 2. Update existing records to set tenant_id from users table
UPDATE activity_logs al
INNER JOIN users u ON al.user_id = u.id
SET al.tenant_id = u.tenant_id
WHERE al.tenant_id IS NULL;

-- 3. Make tenant_id NOT NULL after data migration
ALTER TABLE activity_logs 
MODIFY COLUMN tenant_id INT NOT NULL;

-- 4. Add foreign key constraint
ALTER TABLE activity_logs
ADD CONSTRAINT fk_activity_logs_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- 5. Add index for performance
ALTER TABLE activity_logs
ADD INDEX idx_tenant_id (tenant_id);

-- 6. Verify the changes
SELECT 
    COLUMN_NAME,
    IS_NULLABLE,
    DATA_TYPE,
    COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'activity_logs'
AND COLUMN_NAME = 'tenant_id';
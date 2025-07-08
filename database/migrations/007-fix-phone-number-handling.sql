-- =====================================================
-- Migration: Fix Phone Number Handling
-- Date: 2025-01-08
-- Author: System
-- Description: 
--   - Add UNIQUE constraint to users.phone
--   - Standardize phone format (remove spaces)
--   - Ensure phone is stored in users table
--   - Fix existing data
-- =====================================================

-- 1. Update existing phone numbers to remove spaces
UPDATE tenants SET phone = REPLACE(phone, ' ', '') WHERE phone IS NOT NULL;
UPDATE users SET phone = REPLACE(phone, ' ', '') WHERE phone IS NOT NULL;

-- 2. Copy phone numbers from tenants to root users where missing
UPDATE users u
INNER JOIN tenant_admins ta ON u.id = ta.user_id AND ta.is_primary = 1
INNER JOIN tenants t ON ta.tenant_id = t.id
SET u.phone = t.phone
WHERE u.role = 'root' AND u.phone IS NULL AND t.phone IS NOT NULL;

-- 3. Make phone column wider to accommodate international formats
ALTER TABLE users MODIFY COLUMN phone VARCHAR(30);
ALTER TABLE tenants MODIFY COLUMN phone VARCHAR(30);

-- 4. Add UNIQUE constraint to users.phone
-- Add unique index only for non-NULL values
ALTER TABLE users ADD UNIQUE INDEX idx_users_phone (phone);

-- 5. Note: Phone format validation will be done in application layer
-- MySQL CHECK constraints are not well supported in all versions

-- 7. Log migration completion
INSERT INTO migration_log (migration_name, executed_at, status) 
VALUES ('007-fix-phone-number-handling', NOW(), 'completed')
ON DUPLICATE KEY UPDATE executed_at = NOW(), status = 'completed';
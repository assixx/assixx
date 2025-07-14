-- =====================================================
-- Migration: Rename admin_id to user_id in admin_logs
-- Date: 2025-07-07
-- Author: System
-- Description: Macht die Benennung konsistenter mit anderen Tabellen
-- =====================================================

-- 1. Rename column admin_id to user_id
ALTER TABLE admin_logs 
CHANGE COLUMN admin_id user_id INT NOT NULL;

-- 2. Rename index
ALTER TABLE admin_logs 
DROP INDEX idx_admin_id,
ADD INDEX idx_user_id (user_id);

-- 3. Update foreign key constraint name for consistency
ALTER TABLE admin_logs
DROP FOREIGN KEY admin_logs_ibfk_2;

ALTER TABLE admin_logs
ADD CONSTRAINT admin_logs_user_fk 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 4. Add comment for clarity
ALTER TABLE admin_logs 
COMMENT = 'Logs all administrative actions performed by users';
-- =====================================================
-- Migration: 001-tenant-isolation-fixes.sql
-- Date: 2025-06-01
-- Purpose: Fix critical tenant isolation security issues
-- =====================================================

-- =====================================================
-- STEP 1: Add missing tenant_id columns
-- =====================================================

-- Fix messages table (CRITICAL)
ALTER TABLE messages 
ADD COLUMN tenant_id INT AFTER id;

-- Fix user_teams table (CRITICAL)
ALTER TABLE user_teams 
ADD COLUMN tenant_id INT AFTER id;

-- Fix security_logs table
ALTER TABLE security_logs 
ADD COLUMN tenant_id INT AFTER id;

-- Fix user_chat_status table
ALTER TABLE user_chat_status 
ADD COLUMN tenant_id INT AFTER user_id;

-- Fix message_read_receipts table
ALTER TABLE message_read_receipts 
ADD COLUMN tenant_id INT AFTER id;

-- Fix message_attachments table
ALTER TABLE message_attachments 
ADD COLUMN tenant_id INT AFTER id;

-- Fix chat_notifications table
ALTER TABLE chat_notifications 
ADD COLUMN tenant_id INT AFTER id;

-- Fix calendar_shares table
ALTER TABLE calendar_shares 
ADD COLUMN tenant_id INT AFTER id;

-- Fix calendar_reminders table
ALTER TABLE calendar_reminders 
ADD COLUMN tenant_id INT AFTER id;

-- =====================================================
-- STEP 2: Update existing data with tenant_id
-- =====================================================

-- Update messages with sender's tenant_id
UPDATE messages m
JOIN users u ON m.sender_id = u.id
SET m.tenant_id = u.tenant_id
WHERE m.tenant_id IS NULL;

-- Update user_teams with user's tenant_id
UPDATE user_teams ut
JOIN users u ON ut.user_id = u.id
SET ut.tenant_id = u.tenant_id
WHERE ut.tenant_id IS NULL;

-- Update security_logs with user's tenant_id
UPDATE security_logs sl
JOIN users u ON sl.user_id = u.id
SET sl.tenant_id = u.tenant_id
WHERE sl.tenant_id IS NULL AND sl.user_id IS NOT NULL;

-- Update user_chat_status with user's tenant_id
UPDATE user_chat_status ucs
JOIN users u ON ucs.user_id = u.id
SET ucs.tenant_id = u.tenant_id
WHERE ucs.tenant_id IS NULL;

-- Update message_read_receipts with message's tenant_id
UPDATE message_read_receipts mrr
JOIN messages m ON mrr.message_id = m.id
SET mrr.tenant_id = m.tenant_id
WHERE mrr.tenant_id IS NULL;

-- Update message_attachments with message's tenant_id
UPDATE message_attachments ma
JOIN messages m ON ma.message_id = m.id
SET ma.tenant_id = m.tenant_id
WHERE ma.tenant_id IS NULL;

-- Update chat_notifications with user's tenant_id
UPDATE chat_notifications cn
JOIN users u ON cn.user_id = u.id
SET cn.tenant_id = u.tenant_id
WHERE cn.tenant_id IS NULL;

-- Update calendar_shares with owner's tenant_id
UPDATE calendar_shares cs
JOIN users u ON cs.calendar_owner_id = u.id
SET cs.tenant_id = u.tenant_id
WHERE cs.tenant_id IS NULL;

-- Update calendar_reminders with event's tenant_id
UPDATE calendar_reminders cr
JOIN calendar_events ce ON cr.event_id = ce.id
SET cr.tenant_id = ce.tenant_id
WHERE cr.tenant_id IS NULL;

-- =====================================================
-- STEP 3: Add NOT NULL constraints and foreign keys
-- =====================================================

-- Make tenant_id NOT NULL and add foreign keys
ALTER TABLE messages 
MODIFY tenant_id INT NOT NULL,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

ALTER TABLE user_teams 
MODIFY tenant_id INT NOT NULL,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

ALTER TABLE user_chat_status 
MODIFY tenant_id INT NOT NULL,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

ALTER TABLE message_read_receipts 
MODIFY tenant_id INT NOT NULL,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

ALTER TABLE message_attachments 
MODIFY tenant_id INT NOT NULL,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

ALTER TABLE chat_notifications 
MODIFY tenant_id INT NOT NULL,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

ALTER TABLE calendar_shares 
MODIFY tenant_id INT NOT NULL,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

ALTER TABLE calendar_reminders 
MODIFY tenant_id INT NOT NULL,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

-- Security logs can have NULL tenant_id for system-level logs
ALTER TABLE security_logs 
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

-- =====================================================
-- STEP 4: Create validation triggers
-- =====================================================

DELIMITER //

-- Ensure messages are only between users of same tenant
CREATE TRIGGER validate_message_tenant_before_insert
BEFORE INSERT ON messages
FOR EACH ROW
BEGIN
    DECLARE sender_tenant INT;
    DECLARE receiver_tenant INT;
    
    SELECT tenant_id INTO sender_tenant FROM users WHERE id = NEW.sender_id;
    
    IF NEW.receiver_id IS NOT NULL THEN
        SELECT tenant_id INTO receiver_tenant FROM users WHERE id = NEW.receiver_id;
        IF sender_tenant != receiver_tenant THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Cannot send messages between different tenants';
        END IF;
    END IF;
    
    -- Set tenant_id from sender
    SET NEW.tenant_id = sender_tenant;
END//

-- Ensure calendar shares are within same tenant
CREATE TRIGGER validate_calendar_share_before_insert
BEFORE INSERT ON calendar_shares
FOR EACH ROW
BEGIN
    DECLARE owner_tenant INT;
    DECLARE shared_tenant INT;
    
    SELECT tenant_id INTO owner_tenant FROM users WHERE id = NEW.calendar_owner_id;
    SELECT tenant_id INTO shared_tenant FROM users WHERE id = NEW.shared_with_id;
    
    IF owner_tenant != shared_tenant THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Cannot share calendars between different tenants';
    END IF;
    
    SET NEW.tenant_id = owner_tenant;
END//

-- Ensure team assignments are within same tenant
CREATE TRIGGER validate_user_team_before_insert
BEFORE INSERT ON user_teams
FOR EACH ROW
BEGIN
    DECLARE user_tenant INT;
    DECLARE team_tenant INT;
    
    SELECT tenant_id INTO user_tenant FROM users WHERE id = NEW.user_id;
    SELECT t.tenant_id INTO team_tenant FROM teams t WHERE t.id = NEW.team_id;
    
    IF user_tenant != team_tenant THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Cannot assign users to teams from different tenants';
    END IF;
    
    SET NEW.tenant_id = user_tenant;
END//

DELIMITER ;

-- =====================================================
-- STEP 5: Update Views with tenant filtering
-- =====================================================

-- Fix employee_overview view
CREATE OR REPLACE VIEW employee_overview AS
SELECT 
    u.id,
    u.tenant_id,
    u.email,
    u.first_name,
    u.last_name,
    u.phone,
    u.role,
    u.status,
    u.created_at,
    u.last_login,
    d.name AS department_name,
    t.name AS team_name,
    COUNT(DISTINCT doc.id) AS document_count,
    COUNT(DISTINCT msg.id) AS message_count
FROM users u
LEFT JOIN departments d ON u.department_id = d.id AND d.tenant_id = u.tenant_id
LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
LEFT JOIN teams t ON ut.team_id = t.id AND t.tenant_id = u.tenant_id
LEFT JOIN documents doc ON u.id = doc.user_id AND doc.tenant_id = u.tenant_id
LEFT JOIN messages msg ON u.id = msg.sender_id AND msg.tenant_id = u.tenant_id
WHERE u.role = 'employee'
GROUP BY u.id;

-- =====================================================
-- STEP 6: Verification queries
-- =====================================================

-- Check for any cross-tenant messages (should return 0)
SELECT COUNT(*) as cross_tenant_messages
FROM messages m
JOIN users sender ON m.sender_id = sender.id
LEFT JOIN users receiver ON m.receiver_id = receiver.id
WHERE receiver.id IS NOT NULL 
  AND sender.tenant_id != receiver.tenant_id;

-- Check for any cross-tenant team assignments (should return 0)
SELECT COUNT(*) as cross_tenant_teams
FROM user_teams ut
JOIN users u ON ut.user_id = u.id
JOIN teams t ON ut.team_id = t.id
WHERE u.tenant_id != t.tenant_id;
-- =====================================================
-- Tenant Isolation Security Fixes
-- =====================================================
-- CRITICAL: These fixes must be applied to prevent
-- cross-tenant data leakage in the multi-tenant system
-- =====================================================

-- =====================================================
-- PRIORITY 1: CRITICAL DATA LEAK FIXES
-- =====================================================

-- Fix 1: Add tenant_id to messages table
ALTER TABLE messages 
ADD COLUMN tenant_id INT NOT NULL AFTER id,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

-- Fix 2: Add tenant_id to user_teams
ALTER TABLE user_teams 
ADD COLUMN tenant_id INT NOT NULL AFTER id,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

-- Fix 3: Add tenant_id to security_logs
ALTER TABLE security_logs 
ADD COLUMN tenant_id INT AFTER id,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

-- Fix 4: Add tenant_id to user_chat_status
ALTER TABLE user_chat_status 
ADD COLUMN tenant_id INT NOT NULL AFTER user_id,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

-- Fix 5: Add tenant_id to message_read_receipts
ALTER TABLE message_read_receipts 
ADD COLUMN tenant_id INT NOT NULL AFTER id,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

-- Fix 6: Add tenant_id to message_attachments
ALTER TABLE message_attachments 
ADD COLUMN tenant_id INT NOT NULL AFTER id,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

-- Fix 7: Add tenant_id to chat_notifications
ALTER TABLE chat_notifications 
ADD COLUMN tenant_id INT NOT NULL AFTER id,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

-- Fix 8: Add tenant_id to calendar_shares
ALTER TABLE calendar_shares 
ADD COLUMN tenant_id INT NOT NULL AFTER id,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

-- Fix 9: Add tenant_id to calendar_reminders
ALTER TABLE calendar_reminders 
ADD COLUMN tenant_id INT NOT NULL AFTER id,
ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
ADD INDEX idx_tenant_id (tenant_id);

-- =====================================================
-- PRIORITY 2: CROSS-TENANT VALIDATION TRIGGERS
-- =====================================================

DELIMITER //

-- Trigger 1: Validate tenant_admins assignments
CREATE TRIGGER validate_tenant_admin_before_insert
BEFORE INSERT ON tenant_admins
FOR EACH ROW
BEGIN
    DECLARE user_tenant_id INT;
    SELECT tenant_id INTO user_tenant_id FROM users WHERE id = NEW.user_id;
    IF user_tenant_id != NEW.tenant_id THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Admin user must belong to the same tenant';
    END IF;
END//

-- Trigger 2: Validate department manager assignment
CREATE TRIGGER validate_department_manager_before_insert
BEFORE INSERT ON departments
FOR EACH ROW
BEGIN
    DECLARE manager_tenant_id INT;
    IF NEW.manager_id IS NOT NULL THEN
        SELECT tenant_id INTO manager_tenant_id FROM users WHERE id = NEW.manager_id;
        IF manager_tenant_id != NEW.tenant_id THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Department manager must belong to the same tenant';
        END IF;
    END IF;
END//

CREATE TRIGGER validate_department_manager_before_update
BEFORE UPDATE ON departments
FOR EACH ROW
BEGIN
    DECLARE manager_tenant_id INT;
    IF NEW.manager_id IS NOT NULL AND NEW.manager_id != OLD.manager_id THEN
        SELECT tenant_id INTO manager_tenant_id FROM users WHERE id = NEW.manager_id;
        IF manager_tenant_id != NEW.tenant_id THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Department manager must belong to the same tenant';
        END IF;
    END IF;
END//

-- Trigger 3: Validate team lead assignment
CREATE TRIGGER validate_team_lead_before_insert
BEFORE INSERT ON teams
FOR EACH ROW
BEGIN
    DECLARE lead_tenant_id INT;
    IF NEW.team_lead_id IS NOT NULL THEN
        SELECT tenant_id INTO lead_tenant_id FROM users WHERE id = NEW.team_lead_id;
        IF lead_tenant_id != NEW.tenant_id THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Team lead must belong to the same tenant';
        END IF;
    END IF;
END//

CREATE TRIGGER validate_team_lead_before_update
BEFORE UPDATE ON teams
FOR EACH ROW
BEGIN
    DECLARE lead_tenant_id INT;
    IF NEW.team_lead_id IS NOT NULL AND NEW.team_lead_id != OLD.team_lead_id THEN
        SELECT tenant_id INTO lead_tenant_id FROM users WHERE id = NEW.team_lead_id;
        IF lead_tenant_id != NEW.tenant_id THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Team lead must belong to the same tenant';
        END IF;
    END IF;
END//

-- Trigger 4: Validate message sender/receiver same tenant
CREATE TRIGGER validate_message_users_before_insert
BEFORE INSERT ON messages
FOR EACH ROW
BEGIN
    DECLARE sender_tenant_id INT;
    DECLARE receiver_tenant_id INT;
    
    SELECT tenant_id INTO sender_tenant_id FROM users WHERE id = NEW.sender_id;
    
    -- Set the tenant_id for the message
    SET NEW.tenant_id = sender_tenant_id;
    
    -- If it's a direct message, check receiver is in same tenant
    IF NEW.receiver_id IS NOT NULL THEN
        SELECT tenant_id INTO receiver_tenant_id FROM users WHERE id = NEW.receiver_id;
        IF sender_tenant_id != receiver_tenant_id THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Cannot send messages across tenants';
        END IF;
    END IF;
    
    -- If it's a group message, check group is in same tenant
    IF NEW.group_id IS NOT NULL THEN
        DECLARE group_tenant_id INT;
        SELECT tenant_id INTO group_tenant_id FROM message_groups WHERE id = NEW.group_id;
        IF sender_tenant_id != group_tenant_id THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Cannot send messages to groups in different tenants';
        END IF;
    END IF;
END//

-- Trigger 5: Validate document creator same tenant
CREATE TRIGGER validate_document_creator_before_insert
BEFORE INSERT ON documents
FOR EACH ROW
BEGIN
    DECLARE creator_tenant_id INT;
    IF NEW.created_by IS NOT NULL THEN
        SELECT tenant_id INTO creator_tenant_id FROM users WHERE id = NEW.created_by;
        IF creator_tenant_id != NEW.tenant_id THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Document creator must belong to the same tenant';
        END IF;
    END IF;
END//

-- Trigger 6: Validate calendar share same tenant
CREATE TRIGGER validate_calendar_share_before_insert
BEFORE INSERT ON calendar_shares
FOR EACH ROW
BEGIN
    DECLARE owner_tenant_id INT;
    DECLARE shared_tenant_id INT;
    
    SELECT tenant_id INTO owner_tenant_id FROM users WHERE id = NEW.calendar_owner_id;
    SELECT tenant_id INTO shared_tenant_id FROM users WHERE id = NEW.shared_with_id;
    
    IF owner_tenant_id != shared_tenant_id THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Cannot share calendars across tenants';
    END IF;
    
    -- Set the tenant_id for the share record
    SET NEW.tenant_id = owner_tenant_id;
END//

-- Trigger 7: Validate user teams same tenant
CREATE TRIGGER validate_user_team_before_insert
BEFORE INSERT ON user_teams
FOR EACH ROW
BEGIN
    DECLARE user_tenant_id INT;
    DECLARE team_tenant_id INT;
    
    SELECT tenant_id INTO user_tenant_id FROM users WHERE id = NEW.user_id;
    SELECT tenant_id INTO team_tenant_id FROM teams WHERE id = NEW.team_id;
    
    IF user_tenant_id != team_tenant_id THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'User and team must belong to the same tenant';
    END IF;
    
    -- Set the tenant_id for the user_team record
    SET NEW.tenant_id = user_tenant_id;
END//

DELIMITER ;

-- =====================================================
-- PRIORITY 3: UPDATE EXISTING DATA
-- =====================================================

-- Update messages with tenant_id from sender
UPDATE messages m
JOIN users u ON m.sender_id = u.id
SET m.tenant_id = u.tenant_id
WHERE m.tenant_id IS NULL;

-- Update user_teams with tenant_id from user
UPDATE user_teams ut
JOIN users u ON ut.user_id = u.id
SET ut.tenant_id = u.tenant_id
WHERE ut.tenant_id IS NULL;

-- Update security_logs with tenant_id from user
UPDATE security_logs sl
JOIN users u ON sl.user_id = u.id
SET sl.tenant_id = u.tenant_id
WHERE sl.tenant_id IS NULL AND sl.user_id IS NOT NULL;

-- Update user_chat_status with tenant_id from user
UPDATE user_chat_status ucs
JOIN users u ON ucs.user_id = u.id
SET ucs.tenant_id = u.tenant_id
WHERE ucs.tenant_id IS NULL;

-- Update message_read_receipts with tenant_id from message
UPDATE message_read_receipts mrr
JOIN messages m ON mrr.message_id = m.id
SET mrr.tenant_id = m.tenant_id
WHERE mrr.tenant_id IS NULL;

-- Update message_attachments with tenant_id from message
UPDATE message_attachments ma
JOIN messages m ON ma.message_id = m.id
SET ma.tenant_id = m.tenant_id
WHERE ma.tenant_id IS NULL;

-- Update chat_notifications with tenant_id from user
UPDATE chat_notifications cn
JOIN users u ON cn.user_id = u.id
SET cn.tenant_id = u.tenant_id
WHERE cn.tenant_id IS NULL;

-- Update calendar_shares with tenant_id from owner
UPDATE calendar_shares cs
JOIN users u ON cs.calendar_owner_id = u.id
SET cs.tenant_id = u.tenant_id
WHERE cs.tenant_id IS NULL;

-- Update calendar_reminders with tenant_id from event
UPDATE calendar_reminders cr
JOIN calendar_events ce ON cr.event_id = ce.id
SET cr.tenant_id = ce.tenant_id
WHERE cr.tenant_id IS NULL;

-- =====================================================
-- PRIORITY 4: CREATE SECURE VIEWS
-- =====================================================

-- Drop existing insecure views
DROP VIEW IF EXISTS employee_overview;
DROP VIEW IF EXISTS active_shifts_today;
DROP VIEW IF EXISTS chat_activity;
DROP VIEW IF EXISTS employees_without_documents;

-- Note: Views should be created at runtime with tenant filtering
-- Example stored procedure to create tenant-specific view:

DELIMITER //

CREATE PROCEDURE create_tenant_employee_overview(IN p_tenant_id INT)
BEGIN
    SET @sql = CONCAT('
    CREATE OR REPLACE VIEW tenant_', p_tenant_id, '_employee_overview AS
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
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN user_teams ut ON u.id = ut.user_id
    LEFT JOIN teams t ON ut.team_id = t.id
    LEFT JOIN documents doc ON u.id = doc.user_id
    LEFT JOIN messages msg ON u.id = msg.sender_id
    WHERE u.role = ''employee''
    AND u.tenant_id = ', p_tenant_id, '
    GROUP BY u.id');
    
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END//

DELIMITER ;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check for messages without tenant_id
SELECT COUNT(*) as messages_without_tenant 
FROM messages 
WHERE tenant_id IS NULL;

-- Check for cross-tenant messages
SELECT m.id, m.sender_id, m.receiver_id, 
       u1.tenant_id as sender_tenant, 
       u2.tenant_id as receiver_tenant
FROM messages m
JOIN users u1 ON m.sender_id = u1.id
LEFT JOIN users u2 ON m.receiver_id = u2.id
WHERE u2.id IS NOT NULL 
AND u1.tenant_id != u2.tenant_id;

-- Check for cross-tenant team assignments
SELECT ut.*, u.tenant_id as user_tenant, t.tenant_id as team_tenant
FROM user_teams ut
JOIN users u ON ut.user_id = u.id
JOIN teams t ON ut.team_id = t.id
WHERE u.tenant_id != t.tenant_id;

-- Check for cross-tenant calendar shares
SELECT cs.*, u1.tenant_id as owner_tenant, u2.tenant_id as shared_tenant
FROM calendar_shares cs
JOIN users u1 ON cs.calendar_owner_id = u1.id
JOIN users u2 ON cs.shared_with_id = u2.id
WHERE u1.tenant_id != u2.tenant_id;
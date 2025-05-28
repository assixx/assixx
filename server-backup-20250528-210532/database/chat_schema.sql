-- Chat System Database Schema für Assixx
-- Mit Berechtigungen und Nachrichtenplanung

-- 1. Conversations (Chat-Räume zwischen Benutzern)
CREATE TABLE conversations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type ENUM('direct', 'group') DEFAULT 'direct',
    name VARCHAR(255) NULL,
    description TEXT NULL,
    created_by INT NOT NULL,
    tenant_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tenant_conversations (tenant_id),
    INDEX idx_created_by (created_by),
    INDEX idx_active_conversations (is_active, tenant_id)
);

-- 2. Conversation Participants (Wer kann in welchem Chat schreiben)
CREATE TABLE conversation_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('member', 'admin') DEFAULT 'member',
    can_send_messages BOOLEAN DEFAULT TRUE,
    can_add_participants BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP NULL,
    last_seen_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_conversation_user (conversation_id, user_id),
    INDEX idx_user_conversations (user_id, is_active),
    INDEX idx_conversation_participants (conversation_id, is_active)
);

-- 3. Messages (Nachrichten mit Planungsfunktion)
CREATE TABLE messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    recipient_id INT NULL, -- Für direkte Nachrichten
    content TEXT NOT NULL,
    message_type ENUM('text', 'file', 'image', 'system') DEFAULT 'text',
    
    -- Nachrichtenplanung
    delivery_type ENUM('immediate', 'break_time', 'after_work', 'scheduled') DEFAULT 'immediate',
    scheduled_for TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    is_delivered BOOLEAN DEFAULT FALSE,
    
    -- Status und Metadata
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    edited_at TIMESTAMP NULL,
    
    -- Multi-Tenant Support
    tenant_id INT NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_conversation_messages (conversation_id, created_at),
    INDEX idx_sender_messages (sender_id, created_at),
    INDEX idx_recipient_messages (recipient_id, is_read),
    INDEX idx_tenant_messages (tenant_id),
    INDEX idx_delivery_queue (is_delivered, delivery_type, scheduled_for),
    INDEX idx_unread_messages (recipient_id, is_read, is_delivered)
);

-- 4. Message Attachments (Dateianhänge)
CREATE TABLE message_attachments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type ENUM('image', 'document', 'audio', 'video', 'other') DEFAULT 'other',
    thumbnail_path VARCHAR(500) NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    INDEX idx_message_attachments (message_id),
    INDEX idx_file_type (file_type)
);

-- 5. Chat Permissions (Berechtigungen zwischen Rollen)
CREATE TABLE chat_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    from_role ENUM('root', 'admin', 'employee') NOT NULL,
    to_role ENUM('root', 'admin', 'employee') NOT NULL,
    can_initiate_chat BOOLEAN DEFAULT FALSE,
    can_send_messages BOOLEAN DEFAULT FALSE,
    can_send_files BOOLEAN DEFAULT FALSE,
    tenant_id INT NULL, -- NULL für globale Regeln
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_role_permission (from_role, to_role, tenant_id),
    INDEX idx_tenant_permissions (tenant_id)
);

-- 6. Work Schedules (Arbeitszeiten für Nachrichtenplanung)
CREATE TABLE work_schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NULL, -- NULL für Firmen-Standard
    day_of_week TINYINT NOT NULL, -- 1=Montag, 7=Sonntag
    work_start_time TIME NOT NULL,
    work_end_time TIME NOT NULL,
    break_start_time TIME NULL,
    break_end_time TIME NULL,
    is_work_day BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_day (user_id, day_of_week),
    INDEX idx_tenant_schedules (tenant_id),
    INDEX idx_work_days (day_of_week, is_work_day)
);

-- 7. Message Queue (Warteschlange für geplante Nachrichten)
CREATE TABLE message_queue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    recipient_id INT NOT NULL,
    delivery_type ENUM('break_time', 'after_work', 'scheduled') NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    status ENUM('pending', 'processing', 'delivered', 'failed') DEFAULT 'pending',
    error_message TEXT NULL,
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_delivery_queue (status, scheduled_for),
    INDEX idx_recipient_queue (recipient_id, status),
    INDEX idx_processing_queue (status, attempts, max_attempts)
);

-- 8. Message Read Receipts (Lesebestätigungen)
CREATE TABLE message_read_receipts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_message_user_read (message_id, user_id),
    INDEX idx_user_read_receipts (user_id, read_at)
);

-- Standard Chat-Berechtigungen einfügen
INSERT INTO chat_permissions (from_role, to_role, can_initiate_chat, can_send_messages, can_send_files) VALUES
-- Root kann mit allen kommunizieren
('root', 'root', TRUE, TRUE, TRUE),
('root', 'admin', TRUE, TRUE, TRUE),
('root', 'employee', TRUE, TRUE, TRUE),

-- Admin kann mit Root und Employees kommunizieren
('admin', 'root', TRUE, TRUE, TRUE),
('admin', 'admin', TRUE, TRUE, TRUE),
('admin', 'employee', TRUE, TRUE, TRUE),

-- Employee kann nur an Admins schreiben (nicht initiieren)
('employee', 'admin', FALSE, TRUE, TRUE),
('employee', 'root', FALSE, FALSE, FALSE),
('employee', 'employee', FALSE, FALSE, FALSE);

-- Standard-Arbeitszeiten einfügen (Montag-Freitag, 8-17 Uhr, Pause 12-13 Uhr)
INSERT INTO work_schedules (tenant_id, user_id, day_of_week, work_start_time, work_end_time, break_start_time, break_end_time, is_work_day) VALUES
-- Für alle Tenants als Standard (tenant_id wird später durch Trigger/Procedure gesetzt)
(1, NULL, 1, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE),  -- Montag
(1, NULL, 2, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE),  -- Dienstag
(1, NULL, 3, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE),  -- Mittwoch
(1, NULL, 4, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE),  -- Donnerstag
(1, NULL, 5, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE),  -- Freitag
(1, NULL, 6, '08:00:00', '17:00:00', NULL, NULL, FALSE),             -- Samstag
(1, NULL, 7, '08:00:00', '17:00:00', NULL, NULL, FALSE);             -- Sonntag

-- Trigger für automatische Tenant-Zuordnung bei neuen Nachrichten
DELIMITER //
CREATE TRIGGER set_message_tenant_id
    BEFORE INSERT ON messages
    FOR EACH ROW
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id 
        FROM users 
        WHERE id = NEW.sender_id;
    END IF;
END//
DELIMITER ;

-- Trigger für automatische Tenant-Zuordnung bei neuen Conversations
DELIMITER //
CREATE TRIGGER set_conversation_tenant_id
    BEFORE INSERT ON conversations
    FOR EACH ROW
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id 
        FROM users 
        WHERE id = NEW.created_by;
    END IF;
END//
DELIMITER ;

-- View für ungelesene Nachrichten pro Benutzer
CREATE VIEW unread_messages_view AS
SELECT 
    m.recipient_id,
    COUNT(*) as unread_count,
    MAX(m.created_at) as latest_message_at
FROM messages m
WHERE m.is_read = FALSE 
    AND m.is_delivered = TRUE 
    AND m.is_deleted = FALSE
GROUP BY m.recipient_id;

-- View für aktive Conversations pro Benutzer
CREATE VIEW user_conversations_view AS
SELECT 
    cp.user_id,
    c.id as conversation_id,
    c.name as conversation_name,
    c.type as conversation_type,
    cp.last_read_at,
    cp.last_seen_at,
    COUNT(m.id) as total_messages,
    COUNT(CASE WHEN m.is_read = FALSE AND m.recipient_id = cp.user_id THEN 1 END) as unread_count,
    MAX(m.created_at) as last_message_at,
    u.username as created_by_username,
    u.first_name as created_by_first_name,
    u.last_name as created_by_last_name
FROM conversation_participants cp
JOIN conversations c ON cp.conversation_id = c.id
LEFT JOIN messages m ON c.id = m.conversation_id AND m.is_deleted = FALSE
LEFT JOIN users u ON c.created_by = u.id
WHERE cp.is_active = TRUE AND c.is_active = TRUE
GROUP BY cp.user_id, c.id, c.name, c.type, cp.last_read_at, cp.last_seen_at, u.username, u.first_name, u.last_name;
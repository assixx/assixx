-- Chat-System Datenbank Schema für Assixx
-- Erstellt: 2025-05-23

-- Conversations Table (Unterhaltungen)
CREATE TABLE IF NOT EXISTS conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NULL,
    is_group BOOLEAN DEFAULT FALSE,
    tenant_id INT NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_created_by (created_by),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Conversation Participants Table (Teilnehmer der Unterhaltungen)
CREATE TABLE IF NOT EXISTS conversation_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    user_id INT NOT NULL,
    tenant_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    UNIQUE KEY unique_participant (conversation_id, user_id),
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_user_id (user_id),
    INDEX idx_tenant_id (tenant_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Messages Table (Nachrichten)
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    content TEXT NOT NULL,
    message_type ENUM('text', 'file', 'system') DEFAULT 'text',
    is_read BOOLEAN DEFAULT FALSE,
    scheduled_delivery TIMESTAMP NULL,
    delivery_status ENUM('sent', 'delivered', 'read', 'scheduled', 'failed') DEFAULT 'sent',
    tenant_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_sender_id (sender_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_scheduled_delivery (scheduled_delivery),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Message Attachments Table (Dateianhänge)
CREATE TABLE IF NOT EXISTS message_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    tenant_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_message_id (message_id),
    INDEX idx_tenant_id (tenant_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Chat Permissions Table (Berechtigungen für Chat)
CREATE TABLE IF NOT EXISTS chat_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_role ENUM('admin', 'employee', 'root') NOT NULL,
    to_role ENUM('admin', 'employee', 'root') NOT NULL,
    can_send BOOLEAN DEFAULT FALSE,
    can_receive BOOLEAN DEFAULT FALSE,
    tenant_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_permission (from_role, to_role, tenant_id),
    INDEX idx_tenant_id (tenant_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Message Delivery Queue Table (Warteschlange für Nachrichten)
CREATE TABLE IF NOT EXISTS message_delivery_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    recipient_id INT NOT NULL,
    status ENUM('pending', 'processing', 'delivered', 'failed') DEFAULT 'pending',
    attempts INT DEFAULT 0,
    last_attempt TIMESTAMP NULL,
    tenant_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_message_id (message_id),
    INDEX idx_recipient_id (recipient_id),
    INDEX idx_status (status),
    INDEX idx_tenant_id (tenant_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Work Schedules Table (Arbeitszeiten für Nachrichtenplanung)
CREATE TABLE IF NOT EXISTS work_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    day_of_week TINYINT NOT NULL, -- 0 = Sonntag, 1 = Montag, etc.
    work_start_time TIME NOT NULL DEFAULT '08:00:00',
    work_end_time TIME NOT NULL DEFAULT '17:00:00',
    break_start_time TIME NOT NULL DEFAULT '12:00:00',
    break_end_time TIME NOT NULL DEFAULT '13:00:00',
    is_working_day BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_schedule (tenant_id, day_of_week),
    INDEX idx_tenant_id (tenant_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Standard Chat-Berechtigungen einfügen
INSERT INTO chat_permissions (from_role, to_role, can_send, can_receive, tenant_id) VALUES
-- Admins können an alle schreiben
('admin', 'employee', TRUE, TRUE, NULL),
('admin', 'admin', TRUE, TRUE, NULL),
('admin', 'root', TRUE, TRUE, NULL),
-- Employees können nur an Admins schreiben/antworten
('employee', 'admin', TRUE, TRUE, NULL),
('employee', 'employee', FALSE, FALSE, NULL),
('employee', 'root', FALSE, FALSE, NULL),
-- Root kann an alle schreiben
('root', 'admin', TRUE, TRUE, NULL),
('root', 'employee', TRUE, TRUE, NULL),
('root', 'root', TRUE, TRUE, NULL)
ON DUPLICATE KEY UPDATE 
    can_send = VALUES(can_send),
    can_receive = VALUES(can_receive);

-- Standard Arbeitszeiten einfügen (Montag bis Freitag)
INSERT INTO work_schedules (tenant_id, day_of_week, work_start_time, work_end_time, break_start_time, break_end_time, is_working_day) VALUES
(1, 1, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE), -- Montag
(1, 2, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE), -- Dienstag
(1, 3, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE), -- Mittwoch
(1, 4, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE), -- Donnerstag
(1, 5, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE), -- Freitag
(1, 6, '08:00:00', '17:00:00', '12:00:00', '13:00:00', FALSE), -- Samstag
(1, 0, '08:00:00', '17:00:00', '12:00:00', '13:00:00', FALSE)  -- Sonntag
ON DUPLICATE KEY UPDATE 
    work_start_time = VALUES(work_start_time),
    work_end_time = VALUES(work_end_time);
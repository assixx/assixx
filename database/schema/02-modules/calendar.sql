-- =====================================================
-- calendar.sql - Kalender-System
-- =====================================================
-- Verwaltung von Terminen, Events und Erinnerungen
-- Mit Einladungen, Wiederholungen und Kategorien
-- =====================================================

-- Kalender-Events
CREATE TABLE IF NOT EXISTS calendar_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    type ENUM('meeting', 'training', 'vacation', 'sick_leave', 'other') DEFAULT 'other',
    status ENUM('tentative', 'confirmed', 'cancelled') DEFAULT 'confirmed',
    is_private BOOLEAN DEFAULT FALSE,
    reminder_minutes INT,
    color VARCHAR(7) DEFAULT '#3498db',
    recurrence_rule VARCHAR(500),
    parent_event_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_start_date (start_date),
    INDEX idx_end_date (end_date),
    INDEX idx_type (type),
    INDEX idx_status (status)
);

-- Event-Teilnehmer
CREATE TABLE IF NOT EXISTS calendar_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    response_status ENUM('pending', 'accepted', 'declined', 'tentative') DEFAULT 'pending',
    is_organizer BOOLEAN DEFAULT FALSE,
    is_required BOOLEAN DEFAULT TRUE,
    responded_at TIMESTAMP NULL,
    
    -- Foreign Keys
    FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_participant (event_id, user_id),
    INDEX idx_event_id (event_id),
    INDEX idx_user_id (user_id),
    INDEX idx_response_status (response_status)
);

-- Event-Kategorien
CREATE TABLE IF NOT EXISTS calendar_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3498db',
    icon VARCHAR(50),
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_category_per_tenant (tenant_id, name),
    INDEX idx_tenant_id (tenant_id)
);

-- Event-Erinnerungen
CREATE TABLE IF NOT EXISTS calendar_reminders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    minutes_before INT NOT NULL,
    type ENUM('email', 'notification', 'both') DEFAULT 'notification',
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP NULL,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_event_id (event_id),
    INDEX idx_user_id (user_id),
    INDEX idx_is_sent (is_sent)
);

-- Geteilte Kalender
CREATE TABLE IF NOT EXISTS calendar_shares (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    calendar_owner_id INT NOT NULL,
    shared_with_id INT NOT NULL,
    permission_level ENUM('view', 'edit') DEFAULT 'view',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (calendar_owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_share (calendar_owner_id, shared_with_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_calendar_owner_id (calendar_owner_id),
    INDEX idx_shared_with_id (shared_with_id)
);
-- =====================================================
-- 06-settings.sql - Einstellungen
-- =====================================================
-- System-, Tenant- und Benutzer-Einstellungen
-- Mit Default-Werten und Überschreibungen
-- =====================================================

-- System-weite Einstellungen
CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    value_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    category VARCHAR(50),
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_category (category),
    INDEX idx_is_public (is_public)
);

-- Tenant-spezifische Einstellungen
CREATE TABLE IF NOT EXISTS tenant_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    value_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_tenant_setting (tenant_id, setting_key),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_category (category)
);

-- Benutzer-spezifische Einstellungen
CREATE TABLE IF NOT EXISTS user_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    value_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_user_setting (user_id, setting_key),
    INDEX idx_user_id (user_id),
    INDEX idx_category (category)
);

-- Email-Templates
CREATE TABLE IF NOT EXISTS email_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT,
    template_key VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    variables JSON,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_template (COALESCE(tenant_id, 0), template_key),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_template_key (template_key),
    INDEX idx_is_active (is_active)
);

-- Benachrichtigungs-Einstellungen
CREATE TABLE IF NOT EXISTS notification_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    frequency ENUM('immediate', 'hourly', 'daily', 'weekly') DEFAULT 'immediate',
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_notification_pref (user_id, notification_type),
    INDEX idx_user_id (user_id),
    INDEX idx_notification_type (notification_type)
);

-- Standard System-Einstellungen einfügen
INSERT INTO system_settings (setting_key, setting_value, value_type, category, description, is_public) VALUES
('app_name', 'Assixx', 'string', 'general', 'Name der Anwendung', TRUE),
('default_language', 'de', 'string', 'localization', 'Standard-Sprache', TRUE),
('max_upload_size', '10485760', 'number', 'limits', 'Maximale Upload-Größe in Bytes (10MB)', FALSE),
('session_timeout', '7200', 'number', 'security', 'Session-Timeout in Sekunden (2 Stunden)', FALSE),
('password_min_length', '8', 'number', 'security', 'Minimale Passwortlänge', TRUE),
('trial_days', '30', 'number', 'billing', 'Anzahl der Testtage', TRUE),
('maintenance_mode', 'false', 'boolean', 'system', 'Wartungsmodus aktiviert', FALSE),
('allow_registration', 'true', 'boolean', 'system', 'Registrierung erlaubt', TRUE)
ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    value_type = VALUES(value_type),
    category = VALUES(category),
    description = VALUES(description),
    is_public = VALUES(is_public);
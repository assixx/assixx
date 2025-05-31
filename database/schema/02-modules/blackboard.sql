-- =====================================================
-- blackboard.sql - Digitales Schwarzes Brett
-- =====================================================
-- System für Ankündigungen und wichtige Mitteilungen
-- Mit Tags, Prioritäten und Lesebestätigungen
-- =====================================================

-- Haupttabelle für Einträge
CREATE TABLE IF NOT EXISTS blackboard_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    author_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    category VARCHAR(50),
    valid_from DATE,
    valid_until DATE,
    is_pinned BOOLEAN DEFAULT FALSE,
    views INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    requires_confirmation BOOLEAN DEFAULT FALSE,
    attachment_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_author_id (author_id),
    INDEX idx_priority (priority),
    INDEX idx_valid_dates (valid_from, valid_until),
    INDEX idx_is_active (is_active),
    INDEX idx_is_pinned (is_pinned)
);

-- Tags für Kategorisierung
CREATE TABLE IF NOT EXISTS blackboard_tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#0066cc',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_tag_per_tenant (tenant_id, name),
    INDEX idx_tenant_id (tenant_id)
);

-- Verknüpfung Einträge <-> Tags
CREATE TABLE IF NOT EXISTS blackboard_entry_tags (
    entry_id INT NOT NULL,
    tag_id INT NOT NULL,
    
    -- Primary Key
    PRIMARY KEY (entry_id, tag_id),
    
    -- Foreign Keys
    FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES blackboard_tags(id) ON DELETE CASCADE
);

-- Lesebestätigungen
CREATE TABLE IF NOT EXISTS blackboard_confirmations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entry_id INT NOT NULL,
    user_id INT NOT NULL,
    confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_confirmation (entry_id, user_id),
    INDEX idx_entry_id (entry_id),
    INDEX idx_user_id (user_id)
);
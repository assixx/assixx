-- =====================================================
-- kvp.sql - Kontinuierlicher Verbesserungsprozess
-- =====================================================
-- Verwaltung von Verbesserungsvorschlägen
-- Mit Bewertungen, Umsetzungsstatus und Prämien
-- =====================================================

-- KVP-Vorschläge
CREATE TABLE IF NOT EXISTS kvp_suggestions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    submitter_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category ENUM('quality', 'efficiency', 'safety', 'cost', 'environment', 'other') DEFAULT 'other',
    department_id INT,
    status ENUM('draft', 'submitted', 'review', 'approved', 'rejected', 'implemented', 'archived') DEFAULT 'draft',
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    estimated_savings DECIMAL(10,2),
    actual_savings DECIMAL(10,2),
    implementation_cost DECIMAL(10,2),
    reward_amount DECIMAL(10,2),
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    implemented_by INT,
    implemented_at TIMESTAMP NULL,
    rejection_reason TEXT,
    attachments JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (submitter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (implemented_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_submitter_id (submitter_id),
    INDEX idx_department_id (department_id),
    INDEX idx_status (status),
    INDEX idx_category (category),
    INDEX idx_priority (priority),
    INDEX idx_created_at (created_at)
);

-- KVP-Kommentare
CREATE TABLE IF NOT EXISTS kvp_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    suggestion_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_suggestion_id (suggestion_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- KVP-Bewertungen
CREATE TABLE IF NOT EXISTS kvp_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    suggestion_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_rating (suggestion_id, user_id),
    INDEX idx_suggestion_id (suggestion_id),
    INDEX idx_user_id (user_id)
);

-- KVP-Team-Mitglieder (Bewertungsteam)
CREATE TABLE IF NOT EXISTS kvp_team_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('member', 'lead', 'admin') DEFAULT 'member',
    department_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_team_member (tenant_id, user_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_department_id (department_id),
    INDEX idx_is_active (is_active)
);

-- KVP-Kategorien (Benutzerdefiniert)
CREATE TABLE IF NOT EXISTS kvp_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3498db',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_category_per_tenant (tenant_id, name),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_is_active (is_active)
);

-- KVP-Prämien-Historie
CREATE TABLE IF NOT EXISTS kvp_rewards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    suggestion_id INT NOT NULL,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'approved', 'paid', 'cancelled') DEFAULT 'pending',
    approved_by INT,
    approved_at TIMESTAMP NULL,
    paid_at TIMESTAMP NULL,
    payment_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_suggestion_id (suggestion_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- KVP-Statistiken (Materialized View Alternative)
CREATE TABLE IF NOT EXISTS kvp_statistics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    total_suggestions INT DEFAULT 0,
    approved_suggestions INT DEFAULT 0,
    implemented_suggestions INT DEFAULT 0,
    total_savings DECIMAL(10,2) DEFAULT 0.00,
    total_rewards DECIMAL(10,2) DEFAULT 0.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_user_stats (tenant_id, user_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id)
);
-- =====================================================
-- 04-departments.sql - Abteilungen und Teams
-- =====================================================
-- Organisationsstruktur mit Abteilungen und Teams
-- Hierarchische Struktur mit Manager-Zuordnungen
-- =====================================================

-- Abteilungen
CREATE TABLE IF NOT EXISTS departments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT DEFAULT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id INT,
    parent_id INT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    visibility ENUM('public', 'private') DEFAULT 'public',
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_manager_id (manager_id),
    INDEX idx_parent_id (parent_id),
    INDEX idx_status (status),
    INDEX idx_visibility (visibility),
    UNIQUE KEY unique_dept_name_per_tenant (tenant_id, name)
);

-- Teams innerhalb von Abteilungen
CREATE TABLE IF NOT EXISTS teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    department_id INT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    team_lead_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_lead_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_department_id (department_id),
    INDEX idx_team_lead_id (team_lead_id),
    INDEX idx_is_active (is_active),
    UNIQUE KEY unique_team_name_per_dept (department_id, name)
);

-- Benutzer-Team-Zuordnungen
CREATE TABLE IF NOT EXISTS user_teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    team_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role ENUM('member', 'lead') DEFAULT 'member',
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_user_team (user_id, team_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_team_id (team_id)
);

-- Nachträgliche Foreign Keys für users Tabelle
ALTER TABLE users 
ADD CONSTRAINT fk_users_department 
FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
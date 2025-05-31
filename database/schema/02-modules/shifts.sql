-- =====================================================
-- shifts.sql - Schichtplanungs-System
-- =====================================================
-- Verwaltung von Schichtplänen, Vorlagen und Tausch
-- Mit Team-Zuordnungen und Urlaubsintegration
-- =====================================================

-- Schichtvorlagen
CREATE TABLE IF NOT EXISTS shift_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INT DEFAULT 0,
    color VARCHAR(7) DEFAULT '#3498db',
    is_night_shift BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_is_active (is_active)
);

-- Schichtpläne
CREATE TABLE IF NOT EXISTS shifts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    template_id INT,
    date DATE NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    actual_start DATETIME,
    actual_end DATETIME,
    break_minutes INT DEFAULT 0,
    status ENUM('planned', 'confirmed', 'in_progress', 'completed', 'cancelled') DEFAULT 'planned',
    type ENUM('regular', 'overtime', 'standby', 'vacation', 'sick', 'holiday') DEFAULT 'regular',
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES shift_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_date (date),
    INDEX idx_status (status),
    INDEX idx_type (type),
    UNIQUE KEY unique_user_shift (user_id, date, start_time)
);

-- Schicht-Notizen
CREATE TABLE IF NOT EXISTS shift_notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    shift_id INT NOT NULL,
    user_id INT NOT NULL,
    note TEXT NOT NULL,
    type ENUM('info', 'warning', 'important') DEFAULT 'info',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_shift_id (shift_id),
    INDEX idx_user_id (user_id),
    INDEX idx_type (type)
);

-- Schichttausch-Anfragen
CREATE TABLE IF NOT EXISTS shift_swaps (
    id INT PRIMARY KEY AUTO_INCREMENT,
    requester_id INT NOT NULL,
    shift_id INT NOT NULL,
    target_user_id INT,
    target_shift_id INT,
    reason TEXT,
    status ENUM('pending', 'accepted', 'rejected', 'cancelled') DEFAULT 'pending',
    responded_at TIMESTAMP NULL,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_requester_id (requester_id),
    INDEX idx_shift_id (shift_id),
    INDEX idx_target_user_id (target_user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Schichtgruppen/Teams
CREATE TABLE IF NOT EXISTS shift_groups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id INT,
    color VARCHAR(7) DEFAULT '#3498db',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_manager_id (manager_id),
    INDEX idx_is_active (is_active)
);

-- Schichtgruppen-Mitglieder
CREATE TABLE IF NOT EXISTS shift_group_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('member', 'lead', 'substitute') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (group_id) REFERENCES shift_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_group_member (group_id, user_id),
    INDEX idx_group_id (group_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role (role)
);

-- Schichtmuster/Rotationen
CREATE TABLE IF NOT EXISTS shift_patterns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    pattern_data JSON NOT NULL,
    cycle_days INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_is_active (is_active)
);

-- Schichtmuster-Zuweisungen
CREATE TABLE IF NOT EXISTS shift_pattern_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pattern_id INT NOT NULL,
    user_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Foreign Keys
    FOREIGN KEY (pattern_id) REFERENCES shift_patterns(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_pattern_id (pattern_id),
    INDEX idx_user_id (user_id),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_is_active (is_active)
);

-- Abwesenheiten (Urlaub, Krankheit, etc.)
CREATE TABLE IF NOT EXISTS absences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    type ENUM('vacation', 'sick', 'training', 'other') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    approved_by INT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_type (type),
    INDEX idx_status (status)
);
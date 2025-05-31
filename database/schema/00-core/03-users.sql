-- =====================================================
-- 03-users.sql - User Management System
-- =====================================================
-- Benutzer-Verwaltung für alle Rollen (root, admin, employee)
-- Mit erweitertem Profil und Archivierungs-Funktionen
-- =====================================================

-- Haupt-Benutzer-Tabelle
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT DEFAULT 1,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) NOT NULL,
    profile_picture_url VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    role ENUM('root', 'admin', 'employee') NOT NULL DEFAULT 'employee',
    
    -- Basis-Profildaten
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    age INT,
    employee_id VARCHAR(50),
    iban VARCHAR(50),
    company VARCHAR(100),
    notes TEXT,
    
    -- Erweiterte Profildaten
    department_id INT,
    position VARCHAR(100),
    phone VARCHAR(20),
    mobile VARCHAR(50),
    profile_picture VARCHAR(255),
    address TEXT,
    birthday DATE,
    date_of_birth DATE,
    hire_date DATE,
    emergency_contact TEXT,
    editable_fields JSON,
    notification_preferences JSON,
    
    -- Status und Sicherheit
    is_active BOOLEAN DEFAULT TRUE,
    is_archived TINYINT(1) DEFAULT 0,
    status ENUM('active', 'inactive') DEFAULT 'active',
    last_login TIMESTAMP NULL,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP NULL,
    two_factor_secret VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    archived_at TIMESTAMP NULL,
    created_by INT,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    -- department_id FK wird in departments.sql hinzugefügt
    
    -- Indexes
    INDEX idx_tenant_users (tenant_id),
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_status (status),
    INDEX idx_is_active (is_active),
    INDEX idx_archived (is_archived)
);

-- Foreign Keys die users referenzieren (nachträglich)
ALTER TABLE tenant_admins 
ADD CONSTRAINT fk_tenant_admins_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE tenant_admins 
ADD CONSTRAINT fk_tenant_admins_assigned_by 
FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tenants 
ADD CONSTRAINT fk_tenants_created_by 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
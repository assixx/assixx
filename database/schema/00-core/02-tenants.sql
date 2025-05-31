-- =====================================================
-- 02-tenants.sql - Tenant Management System
-- =====================================================
-- Multi-Tenant Architektur für SaaS-Platform
-- Verwaltet Firmen/Mandanten mit Self-Service Registration
-- =====================================================

-- Haupt-Tenant-Tabelle
CREATE TABLE IF NOT EXISTS tenants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    status ENUM('trial', 'active', 'suspended', 'cancelled') DEFAULT 'trial',
    trial_ends_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    settings JSON,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    current_plan ENUM('basic', 'premium', 'enterprise') DEFAULT 'basic',
    billing_email VARCHAR(255),
    logo_url VARCHAR(500),
    primary_color VARCHAR(7) DEFAULT '#0066cc',
    created_by INT,
    INDEX idx_subdomain (subdomain),
    INDEX idx_status (status),
    INDEX idx_trial_ends (trial_ends_at)
);

-- Tenant-Admin-Zuordnungen
CREATE TABLE IF NOT EXISTS tenant_admins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    -- user_id FK wird in users.sql hinzugefügt
    UNIQUE KEY unique_admin (tenant_id, user_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id)
);

-- Tenant-Subscriptions
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    plan_id INT,
    status ENUM('active', 'cancelled', 'expired', 'suspended') DEFAULT 'active',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    stripe_subscription_id VARCHAR(255),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at)
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),
    max_users INT,
    max_storage_gb INT,
    features JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_is_active (is_active)
);
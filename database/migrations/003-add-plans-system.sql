-- =====================================================
-- Migration: Add Plans System
-- Date: 02.06.2025
-- Description: Adds subscription plans, plan features, and addons
-- =====================================================

-- Drop existing tables if they exist
DROP VIEW IF EXISTS v_tenant_plan_overview;
DROP TABLE IF EXISTS tenant_addons;
DROP TABLE IF EXISTS tenant_plans;
DROP TABLE IF EXISTS plan_features;

-- Drop foreign key constraint if exists before dropping plans table
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'tenants' 
    AND COLUMN_NAME = 'current_plan_id' 
    AND REFERENCED_TABLE_NAME = 'plans'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE tenants DROP FOREIGN KEY tenants_ibfk_1',
    'SELECT "Foreign key does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop current_plan_id column if exists
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'tenants' 
    AND COLUMN_NAME = 'current_plan_id'
);

SET @sql = IF(@column_exists > 0,
    'ALTER TABLE tenants DROP COLUMN current_plan_id',
    'SELECT "Column does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS plans;

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_employees INT,
    max_admins INT,
    max_storage_gb INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_code (code),
    INDEX idx_is_active (is_active)
);

-- Insert default plans
INSERT INTO plans (code, name, description, base_price, max_employees, max_admins, max_storage_gb, sort_order) VALUES
('basic', 'Basic', 'Perfekt für kleine Teams und Startups', 49.00, 10, 1, 100, 1),
('professional', 'Professional', 'Für wachsende Unternehmen', 149.00, 50, 3, 500, 2),
('enterprise', 'Enterprise', 'Für große Organisationen', 299.00, NULL, NULL, 1000, 3);

-- Plan features mapping
CREATE TABLE IF NOT EXISTS plan_features (
    id INT PRIMARY KEY AUTO_INCREMENT,
    plan_id INT NOT NULL,
    feature_id INT NOT NULL,
    is_included BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    UNIQUE KEY unique_plan_feature (plan_id, feature_id),
    INDEX idx_plan_id (plan_id),
    INDEX idx_feature_id (feature_id)
);

-- Tenant plans (which plan a tenant has)
CREATE TABLE IF NOT EXISTS tenant_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    plan_id INT NOT NULL,
    status ENUM('active', 'trial', 'cancelled', 'expired') DEFAULT 'active',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    custom_price DECIMAL(10,2) NULL,
    billing_cycle ENUM('monthly', 'yearly') DEFAULT 'monthly',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at)
);

-- Tenant addons (additional resources)
CREATE TABLE IF NOT EXISTS tenant_addons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    addon_type ENUM('employees', 'admins', 'storage_gb') NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    status ENUM('active', 'cancelled') DEFAULT 'active',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tenant_addon (tenant_id, addon_type),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_addon_type (addon_type),
    INDEX idx_status (status)
);

-- Default addon prices
INSERT INTO tenant_addons (tenant_id, addon_type, quantity, unit_price, status) 
SELECT id, 'employees', 0, 5.00, 'active' FROM tenants WHERE NOT EXISTS (
    SELECT 1 FROM tenant_addons WHERE tenant_id = tenants.id AND addon_type = 'employees'
);

INSERT INTO tenant_addons (tenant_id, addon_type, quantity, unit_price, status) 
SELECT id, 'admins', 0, 10.00, 'active' FROM tenants WHERE NOT EXISTS (
    SELECT 1 FROM tenant_addons WHERE tenant_id = tenants.id AND addon_type = 'admins'
);

INSERT INTO tenant_addons (tenant_id, addon_type, quantity, unit_price, status) 
SELECT id, 'storage_gb', 0, 0.10, 'active' FROM tenants WHERE NOT EXISTS (
    SELECT 1 FROM tenant_addons WHERE tenant_id = tenants.id AND addon_type = 'storage_gb'
);

-- Populate plan_features based on the frontend logic
-- Basic plan features
INSERT INTO plan_features (plan_id, feature_id) 
SELECT p.id, f.id FROM plans p, features f 
WHERE p.code = 'basic' 
AND f.code IN ('basic_employees', 'document_upload', 'email_notifications');

-- Professional plan features (includes all Basic features plus more)
INSERT INTO plan_features (plan_id, feature_id) 
SELECT p.id, f.id FROM plans p, features f 
WHERE p.code = 'professional' 
AND f.code IN ('basic_employees', 'document_upload', 'email_notifications', 
               'blackboard', 'chat', 'calendar', 'team_management', 'advanced_reports');

-- Enterprise plan features (all features)
INSERT INTO plan_features (plan_id, feature_id) 
SELECT p.id, f.id FROM plans p, features f 
WHERE p.code = 'enterprise' 
AND f.is_active = true;

-- Set all existing tenants to Enterprise plan (for development)
INSERT INTO tenant_plans (tenant_id, plan_id, status) 
SELECT t.id, p.id, 'active' 
FROM tenants t, plans p 
WHERE p.code = 'enterprise' 
AND NOT EXISTS (
    SELECT 1 FROM tenant_plans tp WHERE tp.tenant_id = t.id
);

-- Add plan info to tenants table for quick access
-- Check if column exists before adding
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'tenants' 
    AND COLUMN_NAME = 'current_plan_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE tenants ADD COLUMN current_plan_id INT',
    'SELECT "Column already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key if not exists
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'tenants' 
    AND COLUMN_NAME = 'current_plan_id' 
    AND REFERENCED_TABLE_NAME = 'plans'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE tenants ADD FOREIGN KEY (current_plan_id) REFERENCES plans(id)',
    'SELECT "Foreign key already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index if not exists
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'tenants' 
    AND INDEX_NAME = 'idx_current_plan'
);

SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE tenants ADD INDEX idx_current_plan (current_plan_id)',
    'SELECT "Index already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update current_plan_id
UPDATE tenants t 
JOIN tenant_plans tp ON t.id = tp.tenant_id 
JOIN plans p ON tp.plan_id = p.id 
SET t.current_plan_id = p.id 
WHERE tp.status = 'active';

-- View for easy plan overview
CREATE OR REPLACE VIEW v_tenant_plan_overview AS
SELECT 
    t.id as tenant_id,
    t.company_name,
    t.subdomain,
    p.code as plan_code,
    p.name as plan_name,
    p.base_price as plan_price,
    tp.status as plan_status,
    tp.started_at as plan_started,
    tp.custom_price,
    COALESCE(tp.custom_price, p.base_price) as effective_price,
    (SELECT SUM(total_price) FROM tenant_addons WHERE tenant_id = t.id AND status = 'active') as addon_cost,
    COALESCE(tp.custom_price, p.base_price) + 
    COALESCE((SELECT SUM(total_price) FROM tenant_addons WHERE tenant_id = t.id AND status = 'active'), 0) as total_monthly_cost
FROM tenants t
LEFT JOIN tenant_plans tp ON t.id = tp.tenant_id AND tp.status = 'active'
LEFT JOIN plans p ON tp.plan_id = p.id;
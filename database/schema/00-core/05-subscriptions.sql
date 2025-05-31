-- =====================================================
-- 05-subscriptions.sql - Abonnement-Verwaltung
-- =====================================================
-- Verwaltung von Tarifen und Abonnements
-- Mit Preismodellen und Abrechnungszyklen
-- =====================================================

-- Abonnement-Pläne
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),
    max_users INT,
    max_storage_gb INT,
    features JSON,
    is_active BOOLEAN DEFAULT TRUE,
    is_custom BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_is_active (is_active),
    INDEX idx_name (name)
);

-- Standard-Pläne einfügen
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, max_users, max_storage_gb, features) VALUES
('Free', 'Kostenloser Basis-Plan', 0.00, 0.00, 5, 1, '["basic_employees", "document_upload", "payslip_management"]'),
('Starter', 'Für kleine Teams', 29.99, 299.99, 25, 10, '["basic_employees", "document_upload", "payslip_management", "email_notifications", "employee_self_service"]'),
('Professional', 'Für wachsende Unternehmen', 79.99, 799.99, 100, 50, '["unlimited_employees", "document_upload", "payslip_management", "email_notifications", "employee_self_service", "team_management", "calendar", "chat", "blackboard"]'),
('Enterprise', 'Für große Organisationen', 199.99, 1999.99, NULL, 500, '["unlimited_employees", "document_upload", "payslip_management", "email_notifications", "advanced_reports", "api_access", "custom_branding", "priority_support", "automation", "employee_self_service", "multi_language", "audit_trail", "data_export", "team_management", "calendar", "blackboard", "shift_planning", "kvp", "chat", "surveys"]')
ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    price_monthly = VALUES(price_monthly),
    price_yearly = VALUES(price_yearly),
    max_users = VALUES(max_users),
    max_storage_gb = VALUES(max_storage_gb),
    features = VALUES(features);

-- Tenant-Abonnements
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    plan_id INT NOT NULL,
    status ENUM('trial', 'active', 'paused', 'cancelled', 'expired') DEFAULT 'trial',
    billing_cycle ENUM('monthly', 'yearly') DEFAULT 'monthly',
    start_date DATE NOT NULL,
    end_date DATE,
    trial_ends_at DATE,
    next_billing_date DATE,
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    payment_method VARCHAR(50),
    auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_plan_id (plan_id),
    INDEX idx_status (status),
    INDEX idx_next_billing_date (next_billing_date)
);

-- Zahlungshistorie
CREATE TABLE IF NOT EXISTS payment_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    subscription_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    payment_method VARCHAR(50),
    transaction_id VARCHAR(100),
    invoice_number VARCHAR(50),
    invoice_url VARCHAR(500),
    failure_reason TEXT,
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES tenant_subscriptions(id),
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_subscription_id (subscription_id),
    INDEX idx_status (status),
    INDEX idx_invoice_number (invoice_number),
    INDEX idx_created_at (created_at)
);

-- Nutzungslimits und Kontingente
CREATE TABLE IF NOT EXISTS usage_quotas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    resource_type ENUM('users', 'storage', 'api_calls', 'documents', 'messages') NOT NULL,
    used_amount INT DEFAULT 0,
    limit_amount INT,
    reset_period ENUM('daily', 'weekly', 'monthly', 'yearly') DEFAULT 'monthly',
    last_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_quota (tenant_id, resource_type),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_resource_type (resource_type)
);
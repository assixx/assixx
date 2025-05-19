-- Tenant-Tabelle für Self-Service Registration
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

-- Admin-Benutzer für Tenants
CREATE TABLE IF NOT EXISTS tenant_admins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tenant_user (tenant_id, user_id)
);
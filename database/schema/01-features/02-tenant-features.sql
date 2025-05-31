-- =====================================================
-- 02-tenant-features.sql - Feature-Aktivierungen
-- =====================================================
-- Verknüpft Tenants mit ihren aktivierten Features
-- Mit Ablaufdaten und benutzerdefinierten Konfigurationen
-- =====================================================

-- Tenant-Feature-Zuordnungen
CREATE TABLE IF NOT EXISTS tenant_features (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    feature_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_by INT,
    expires_at TIMESTAMP NULL,
    custom_config JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    FOREIGN KEY (activated_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_tenant_feature (tenant_id, feature_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_feature_id (feature_id),
    INDEX idx_is_active (is_active)
);

-- Plan-Feature-Zuordnungen
CREATE TABLE IF NOT EXISTS plan_features (
    id INT PRIMARY KEY AUTO_INCREMENT,
    plan_id INT NOT NULL,
    feature_id INT NOT NULL,
    included BOOLEAN DEFAULT TRUE,
    usage_limit INT,
    
    -- Foreign Keys
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_plan_feature (plan_id, feature_id),
    INDEX idx_plan_id (plan_id),
    INDEX idx_feature_id (feature_id)
);

-- Feature-Nutzungs-Logs
CREATE TABLE IF NOT EXISTS feature_usage_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    feature_id INT NOT NULL,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_feature_id (feature_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);
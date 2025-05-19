-- Feature Management System für Assixx
-- Ermöglicht modulare Aktivierung/Deaktivierung von Features pro Tenant

-- Feature-Definitionen (alle verfügbaren Features)
CREATE TABLE IF NOT EXISTS features (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL, -- z.B. 'email_notifications', 'advanced_reports'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category ENUM('basic', 'premium', 'enterprise') DEFAULT 'basic',
    base_price DECIMAL(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tenant-Feature-Zuordnung (welcher Tenant hat welche Features)
CREATE TABLE IF NOT EXISTS tenant_features (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    feature_id INT NOT NULL,
    status ENUM('active', 'trial', 'expired', 'disabled') DEFAULT 'disabled',
    valid_from DATE,
    valid_until DATE,
    custom_price DECIMAL(10,2), -- Überschreibt base_price wenn gesetzt
    trial_days INT DEFAULT 0,
    usage_limit INT DEFAULT NULL, -- z.B. max Anzahl E-Mails pro Monat
    current_usage INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    activated_by INT,
    FOREIGN KEY (feature_id) REFERENCES features(id),
    UNIQUE KEY unique_tenant_feature (tenant_id, feature_id)
);

-- Subscription Plans (Pakete von Features)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    billing_period ENUM('monthly', 'yearly') DEFAULT 'monthly',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plan-Feature-Zuordnung (welche Features gehören zu welchem Plan)
CREATE TABLE IF NOT EXISTS plan_features (
    id INT PRIMARY KEY AUTO_INCREMENT,
    plan_id INT NOT NULL,
    feature_id INT NOT NULL,
    included_usage INT DEFAULT NULL, -- z.B. 1000 E-Mails im Plan enthalten
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES features(id),
    UNIQUE KEY unique_plan_feature (plan_id, feature_id)
);

-- Tenant Subscriptions (aktuelle Abonnements)
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    plan_id INT NOT NULL,
    status ENUM('active', 'cancelled', 'expired', 'trial') DEFAULT 'trial',
    start_date DATE NOT NULL,
    end_date DATE,
    next_billing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP NULL,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

-- Feature Usage Logs (Nutzungsstatistiken)
CREATE TABLE IF NOT EXISTS feature_usage_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    feature_id INT NOT NULL,
    user_id INT,
    usage_count INT DEFAULT 1,
    usage_date DATE NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feature_id) REFERENCES features(id),
    INDEX idx_usage_date (usage_date),
    INDEX idx_tenant_feature (tenant_id, feature_id)
);

-- Beispiel-Features einfügen
INSERT INTO features (code, name, description, category, base_price) VALUES
('basic_employees', 'Basis Mitarbeiterverwaltung', 'Bis zu 10 Mitarbeiter verwalten', 'basic', 0.00),
('unlimited_employees', 'Unbegrenzte Mitarbeiter', 'Keine Begrenzung der Mitarbeiteranzahl', 'premium', 15.00),
('document_upload', 'Dokument Upload', 'Basis Dokumenten-Upload Funktion', 'basic', 0.00),
('payslip_management', 'Lohnabrechnungsverwaltung', 'Lohnabrechnungen hochladen und verwalten', 'basic', 0.00),
('email_notifications', 'E-Mail Benachrichtigungen', 'Automatische E-Mail Benachrichtigungen', 'premium', 10.00),
('advanced_reports', 'Erweiterte Berichte', 'Detaillierte Auswertungen und Statistiken', 'premium', 20.00),
('api_access', 'API Zugang', 'REST API für Integration', 'enterprise', 50.00),
('custom_branding', 'Custom Branding', 'Eigenes Logo und Farben', 'enterprise', 30.00),
('priority_support', 'Priority Support', '24/7 Support mit garantierter Antwortzeit', 'enterprise', 40.00),
('automation', 'Automatisierung', 'Automatische Workflows und Imports', 'enterprise', 35.00),
('multi_tenant', 'Multi-Mandanten', 'Mehrere Unternehmen verwalten', 'enterprise', 60.00),
('audit_logs', 'Audit Logs', 'Detaillierte Aktivitätsprotokolle', 'premium', 15.00);

-- Beispiel-Subscription Plans
INSERT INTO subscription_plans (name, description, price, billing_period) VALUES
('Basic', 'Grundfunktionen für kleine Unternehmen', 0.00, 'monthly'),
('Premium', 'Erweiterte Funktionen für wachsende Unternehmen', 49.00, 'monthly'),
('Enterprise', 'Vollständiger Funktionsumfang für große Unternehmen', 149.00, 'monthly');

-- Plan-Feature Zuordnungen
-- Basic Plan
INSERT INTO plan_features (plan_id, feature_id) 
SELECT 1, id FROM features WHERE code IN ('basic_employees', 'document_upload', 'payslip_management');

-- Premium Plan
INSERT INTO plan_features (plan_id, feature_id, included_usage) 
SELECT 2, id, CASE 
    WHEN code = 'email_notifications' THEN 1000 
    ELSE NULL 
END 
FROM features 
WHERE category IN ('basic', 'premium');

-- Enterprise Plan (alle Features)
INSERT INTO plan_features (plan_id, feature_id, included_usage) 
SELECT 3, id, CASE 
    WHEN code = 'email_notifications' THEN 10000 
    ELSE NULL 
END 
FROM features;
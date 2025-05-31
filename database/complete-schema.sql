-- =====================================================
-- Assixx Complete Database Schema
-- Generated: 2025-05-31T22:37:27.409Z
-- =====================================================
-- Diese Datei wurde automatisch generiert.
-- Änderungen bitte in den Modul-Dateien vornehmen!
-- =====================================================


-- =====================================================
-- 00-CORE
-- =====================================================

-- -----------------------------------------------------
-- Source: 00-core/01-database.sql
-- -----------------------------------------------------

-- =====================================================
-- 01-database.sql - Datenbank-Erstellung
-- =====================================================
-- Erstellt die Assixx Datenbank mit korrekten Einstellungen
-- Muss als erstes ausgeführt werden
-- =====================================================

-- Datenbank erstellen wenn nicht vorhanden
CREATE DATABASE IF NOT EXISTS assixx 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- Datenbank verwenden
USE assixx;

-- Charset sicherstellen
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- -----------------------------------------------------
-- Source: 00-core/02-tenants.sql
-- -----------------------------------------------------

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

-- -----------------------------------------------------
-- Source: 00-core/03-users.sql
-- -----------------------------------------------------

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

-- -----------------------------------------------------
-- Source: 00-core/04-departments.sql
-- -----------------------------------------------------

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
    user_id INT NOT NULL,
    team_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role ENUM('member', 'lead') DEFAULT 'member',
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_user_team (user_id, team_id),
    INDEX idx_user_id (user_id),
    INDEX idx_team_id (team_id)
);

-- Nachträgliche Foreign Keys für users Tabelle
ALTER TABLE users 
ADD CONSTRAINT fk_users_department 
FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- -----------------------------------------------------
-- Source: 00-core/05-subscriptions.sql
-- -----------------------------------------------------

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

-- -----------------------------------------------------
-- Source: 00-core/06-settings.sql
-- -----------------------------------------------------

-- =====================================================
-- 06-settings.sql - Einstellungen
-- =====================================================
-- System-, Tenant- und Benutzer-Einstellungen
-- Mit Default-Werten und Überschreibungen
-- =====================================================

-- System-weite Einstellungen
CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    value_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    category VARCHAR(50),
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_category (category),
    INDEX idx_is_public (is_public)
);

-- Tenant-spezifische Einstellungen
CREATE TABLE IF NOT EXISTS tenant_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    value_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_tenant_setting (tenant_id, setting_key),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_category (category)
);

-- Benutzer-spezifische Einstellungen
CREATE TABLE IF NOT EXISTS user_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    value_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_user_setting (user_id, setting_key),
    INDEX idx_user_id (user_id),
    INDEX idx_category (category)
);

-- Email-Templates
CREATE TABLE IF NOT EXISTS email_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT,
    template_key VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    variables JSON,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_template (COALESCE(tenant_id, 0), template_key),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_template_key (template_key),
    INDEX idx_is_active (is_active)
);

-- Benachrichtigungs-Einstellungen
CREATE TABLE IF NOT EXISTS notification_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    frequency ENUM('immediate', 'hourly', 'daily', 'weekly') DEFAULT 'immediate',
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_notification_pref (user_id, notification_type),
    INDEX idx_user_id (user_id),
    INDEX idx_notification_type (notification_type)
);

-- Standard System-Einstellungen einfügen
INSERT INTO system_settings (setting_key, setting_value, value_type, category, description, is_public) VALUES
('app_name', 'Assixx', 'string', 'general', 'Name der Anwendung', TRUE),
('default_language', 'de', 'string', 'localization', 'Standard-Sprache', TRUE),
('max_upload_size', '10485760', 'number', 'limits', 'Maximale Upload-Größe in Bytes (10MB)', FALSE),
('session_timeout', '7200', 'number', 'security', 'Session-Timeout in Sekunden (2 Stunden)', FALSE),
('password_min_length', '8', 'number', 'security', 'Minimale Passwortlänge', TRUE),
('trial_days', '30', 'number', 'billing', 'Anzahl der Testtage', TRUE),
('maintenance_mode', 'false', 'boolean', 'system', 'Wartungsmodus aktiviert', FALSE),
('allow_registration', 'true', 'boolean', 'system', 'Registrierung erlaubt', TRUE)
ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    value_type = VALUES(value_type),
    category = VALUES(category),
    description = VALUES(description),
    is_public = VALUES(is_public);


-- =====================================================
-- 01-FEATURES
-- =====================================================

-- -----------------------------------------------------
-- Source: 01-features/01-features.sql
-- -----------------------------------------------------

-- =====================================================
-- 01-features.sql - Feature Management System
-- =====================================================
-- Verwaltung aller verfügbaren Features/Module
-- Mit Preisen, Kategorien und Aktivierungsstatus
-- =====================================================

-- Feature-Definitionen
CREATE TABLE IF NOT EXISTS features (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category ENUM('basic', 'core', 'premium', 'enterprise') DEFAULT 'basic',
    base_price DECIMAL(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    requires_setup BOOLEAN DEFAULT FALSE,
    setup_instructions TEXT,
    icon VARCHAR(100),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_code (code),
    INDEX idx_category (category),
    INDEX idx_is_active (is_active)
);

-- Standard-Features einfügen
INSERT INTO features (code, name, description, category, base_price, icon, sort_order) VALUES
('basic_employees', 'Basis Mitarbeiterverwaltung', 'Verwaltung von bis zu 50 Mitarbeitern', 'basic', 0.00, 'users', 1),
('unlimited_employees', 'Unbegrenzte Mitarbeiter', 'Keine Begrenzung der Mitarbeiteranzahl', 'premium', 49.99, 'users-plus', 2),
('document_upload', 'Dokument Upload', 'Upload und Verwaltung von Dokumenten', 'basic', 0.00, 'file-text', 3),
('payslip_management', 'Lohnabrechnungsverwaltung', 'Digitale Lohnabrechnungen verwalten', 'basic', 0.00, 'file-invoice-dollar', 4),
('email_notifications', 'E-Mail Benachrichtigungen', 'Automatische E-Mail Benachrichtigungen', 'premium', 19.99, 'envelope', 5),
('advanced_reports', 'Erweiterte Berichte', 'Detaillierte Auswertungen und Statistiken', 'premium', 29.99, 'chart-bar', 6),
('api_access', 'API Zugang', 'Vollständiger API-Zugriff für Integrationen', 'enterprise', 99.99, 'plug', 7),
('custom_branding', 'Custom Branding', 'Eigenes Logo und Farbschema', 'enterprise', 49.99, 'palette', 8),
('priority_support', 'Priority Support', '24/7 Priority Support mit SLA', 'enterprise', 149.99, 'headset', 9),
('automation', 'Automatisierung', 'Workflows und Prozesse automatisieren', 'enterprise', 79.99, 'robot', 10),
('employee_self_service', 'Mitarbeiter Self-Service', 'Mitarbeiter können eigene Daten verwalten', 'premium', 24.99, 'user-edit', 11),
('multi_language', 'Mehrsprachigkeit', 'Interface in mehreren Sprachen', 'premium', 19.99, 'language', 12),
('audit_trail', 'Audit Trail', 'Vollständige Aktivitätsprotokolle', 'enterprise', 39.99, 'history', 13),
('data_export', 'Daten Export', 'Export in verschiedene Formate', 'premium', 14.99, 'download', 14),
('team_management', 'Team Verwaltung', 'Teams und Abteilungen verwalten', 'premium', 34.99, 'users-cog', 15),
('calendar', 'Kalender-System', 'Termine, Events und Erinnerungen verwalten', 'premium', 24.99, 'calendar', 16),
('blackboard', 'Digitales Schwarzes Brett', 'Ankündigungen und wichtige Informationen teilen', 'premium', 19.99, 'clipboard', 17),
('shift_planning', 'Schichtplanungs-System', 'Erweiterte Schichtplanung mit Teams und Vorlagen', 'enterprise', 49.99, 'clock', 18),
('kvp', 'Kontinuierlicher Verbesserungsprozess', 'KVP-Vorschläge sammeln und verwalten', 'enterprise', 39.99, 'trending-up', 19),
('chat', 'Chat System', 'Interne Kommunikation mit Gruppen-Chats', 'premium', 19.99, 'message-circle', 20),
('surveys', 'Umfrage-Tool', 'Erstellen und Auswerten von Mitarbeiterumfragen', 'premium', 29.99, 'bar-chart', 21)
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    base_price = VALUES(base_price),
    icon = VALUES(icon),
    sort_order = VALUES(sort_order);

-- -----------------------------------------------------
-- Source: 01-features/02-tenant-features.sql
-- -----------------------------------------------------

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


-- =====================================================
-- 02-MODULES
-- =====================================================

-- -----------------------------------------------------
-- Source: 02-modules/admin-logs.sql
-- -----------------------------------------------------

-- =====================================================
-- admin-logs.sql - Administrative Logs
-- =====================================================
-- Protokollierung aller administrativen Aktionen
-- Für Audit-Trail und Sicherheitsüberwachung
-- =====================================================

-- Admin-Aktivitätslogs
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    admin_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_admin_id (admin_id),
    INDEX idx_action (action),
    INDEX idx_entity_type (entity_type),
    INDEX idx_created_at (created_at)
);

-- Security Logs (Login-Versuche etc.)
CREATE TABLE IF NOT EXISTS security_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action ENUM('login_success', 'login_failed', 'logout', 'password_reset', 'account_locked', 'suspicious_activity') NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_ip_address (ip_address),
    INDEX idx_created_at (created_at)
);

-- API Access Logs
CREATE TABLE IF NOT EXISTS api_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT,
    user_id INT,
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    status_code INT,
    request_body TEXT,
    response_time_ms INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_endpoint (endpoint),
    INDEX idx_status_code (status_code),
    INDEX idx_created_at (created_at)
);

-- System Event Logs
CREATE TABLE IF NOT EXISTS system_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    level ENUM('debug', 'info', 'warning', 'error', 'critical') NOT NULL,
    category VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    context JSON,
    stack_trace TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_level (level),
    INDEX idx_category (category),
    INDEX idx_created_at (created_at)
);

-- -----------------------------------------------------
-- Source: 02-modules/blackboard.sql
-- -----------------------------------------------------

-- =====================================================
-- blackboard.sql - Digitales Schwarzes Brett
-- =====================================================
-- System für Ankündigungen und wichtige Mitteilungen
-- Mit Tags, Prioritäten und Lesebestätigungen
-- =====================================================

-- Haupttabelle für Einträge
CREATE TABLE IF NOT EXISTS blackboard_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    author_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    category VARCHAR(50),
    valid_from DATE,
    valid_until DATE,
    is_pinned BOOLEAN DEFAULT FALSE,
    views INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    requires_confirmation BOOLEAN DEFAULT FALSE,
    attachment_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_author_id (author_id),
    INDEX idx_priority (priority),
    INDEX idx_valid_dates (valid_from, valid_until),
    INDEX idx_is_active (is_active),
    INDEX idx_is_pinned (is_pinned)
);

-- Tags für Kategorisierung
CREATE TABLE IF NOT EXISTS blackboard_tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#0066cc',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_tag_per_tenant (tenant_id, name),
    INDEX idx_tenant_id (tenant_id)
);

-- Verknüpfung Einträge <-> Tags
CREATE TABLE IF NOT EXISTS blackboard_entry_tags (
    entry_id INT NOT NULL,
    tag_id INT NOT NULL,
    
    -- Primary Key
    PRIMARY KEY (entry_id, tag_id),
    
    -- Foreign Keys
    FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES blackboard_tags(id) ON DELETE CASCADE
);

-- Lesebestätigungen
CREATE TABLE IF NOT EXISTS blackboard_confirmations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entry_id INT NOT NULL,
    user_id INT NOT NULL,
    confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_confirmation (entry_id, user_id),
    INDEX idx_entry_id (entry_id),
    INDEX idx_user_id (user_id)
);

-- -----------------------------------------------------
-- Source: 02-modules/calendar.sql
-- -----------------------------------------------------

-- =====================================================
-- calendar.sql - Kalender-System
-- =====================================================
-- Verwaltung von Terminen, Events und Erinnerungen
-- Mit Einladungen, Wiederholungen und Kategorien
-- =====================================================

-- Kalender-Events
CREATE TABLE IF NOT EXISTS calendar_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    type ENUM('meeting', 'training', 'vacation', 'sick_leave', 'other') DEFAULT 'other',
    status ENUM('tentative', 'confirmed', 'cancelled') DEFAULT 'confirmed',
    is_private BOOLEAN DEFAULT FALSE,
    reminder_minutes INT,
    color VARCHAR(7) DEFAULT '#3498db',
    recurrence_rule VARCHAR(500),
    parent_event_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_start_date (start_date),
    INDEX idx_end_date (end_date),
    INDEX idx_type (type),
    INDEX idx_status (status)
);

-- Event-Teilnehmer
CREATE TABLE IF NOT EXISTS calendar_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    response_status ENUM('pending', 'accepted', 'declined', 'tentative') DEFAULT 'pending',
    is_organizer BOOLEAN DEFAULT FALSE,
    is_required BOOLEAN DEFAULT TRUE,
    responded_at TIMESTAMP NULL,
    
    -- Foreign Keys
    FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_participant (event_id, user_id),
    INDEX idx_event_id (event_id),
    INDEX idx_user_id (user_id),
    INDEX idx_response_status (response_status)
);

-- Event-Kategorien
CREATE TABLE IF NOT EXISTS calendar_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3498db',
    icon VARCHAR(50),
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_category_per_tenant (tenant_id, name),
    INDEX idx_tenant_id (tenant_id)
);

-- Event-Erinnerungen
CREATE TABLE IF NOT EXISTS calendar_reminders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    minutes_before INT NOT NULL,
    type ENUM('email', 'notification', 'both') DEFAULT 'notification',
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP NULL,
    
    -- Foreign Keys
    FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_event_id (event_id),
    INDEX idx_user_id (user_id),
    INDEX idx_is_sent (is_sent)
);

-- Geteilte Kalender
CREATE TABLE IF NOT EXISTS calendar_shares (
    id INT PRIMARY KEY AUTO_INCREMENT,
    calendar_owner_id INT NOT NULL,
    shared_with_id INT NOT NULL,
    permission_level ENUM('view', 'edit') DEFAULT 'view',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (calendar_owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_share (calendar_owner_id, shared_with_id),
    INDEX idx_calendar_owner_id (calendar_owner_id),
    INDEX idx_shared_with_id (shared_with_id)
);

-- -----------------------------------------------------
-- Source: 02-modules/chat.sql
-- -----------------------------------------------------

-- =====================================================
-- chat.sql - Chat-System
-- =====================================================
-- Interne Kommunikation mit Einzel- und Gruppenchats
-- Mit Lesebestätigungen, Anhängen und Benachrichtigungen
-- =====================================================

-- Chat-Nachrichten
CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sender_id INT NOT NULL,
    receiver_id INT,
    group_id INT,
    content TEXT NOT NULL,
    type ENUM('text', 'file', 'image', 'system') DEFAULT 'text',
    file_url VARCHAR(500),
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES message_groups(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_sender_id (sender_id),
    INDEX idx_receiver_id (receiver_id),
    INDEX idx_group_id (group_id),
    INDEX idx_created_at (created_at),
    INDEX idx_is_deleted (is_deleted),
    
    -- Constraints
    CHECK ((receiver_id IS NOT NULL AND group_id IS NULL) OR 
           (receiver_id IS NULL AND group_id IS NOT NULL))
);

-- Chat-Gruppen
CREATE TABLE IF NOT EXISTS message_groups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type ENUM('public', 'private', 'department', 'team') DEFAULT 'private',
    avatar_url VARCHAR(500),
    created_by INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_created_by (created_by),
    INDEX idx_type (type),
    INDEX idx_is_active (is_active)
);

-- Gruppenmitglieder
CREATE TABLE IF NOT EXISTS message_group_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('member', 'admin') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP NULL,
    notification_enabled BOOLEAN DEFAULT TRUE,
    
    -- Foreign Keys
    FOREIGN KEY (group_id) REFERENCES message_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_group_member (group_id, user_id),
    INDEX idx_group_id (group_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role (role)
);

-- Lesebestätigungen für Nachrichten
CREATE TABLE IF NOT EXISTS message_read_receipts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_read_receipt (message_id, user_id),
    INDEX idx_message_id (message_id),
    INDEX idx_user_id (user_id)
);

-- Nachrichten-Anhänge
CREATE TABLE IF NOT EXISTS message_attachments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_message_id (message_id)
);

-- Online-Status und Typing-Indicators
CREATE TABLE IF NOT EXISTS user_chat_status (
    user_id INT PRIMARY KEY,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_typing BOOLEAN DEFAULT FALSE,
    typing_in_conversation INT,
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_is_online (is_online),
    INDEX idx_last_seen (last_seen)
);

-- Chat-Benachrichtigungen
CREATE TABLE IF NOT EXISTS chat_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    message_id INT NOT NULL,
    type ENUM('message', 'mention', 'group_invite') DEFAULT 'message',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_message_id (message_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- -----------------------------------------------------
-- Source: 02-modules/documents.sql
-- -----------------------------------------------------

-- =====================================================
-- documents.sql - Dokumenten-Management System
-- =====================================================
-- Verwaltung von Mitarbeiter-Dokumenten
-- Mit Kategorisierung, Archivierung und Ablaufdaten
-- =====================================================

CREATE TABLE IF NOT EXISTS documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    category ENUM('personal', 'work', 'training', 'general', 'salary') NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100),
    description TEXT,
    tags JSON,
    is_public BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_by INT,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_category (category),
    INDEX idx_uploaded_at (uploaded_at),
    INDEX idx_is_archived (is_archived)
);

-- -----------------------------------------------------
-- Source: 02-modules/kvp.sql
-- -----------------------------------------------------

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

-- -----------------------------------------------------
-- Source: 02-modules/shifts.sql
-- -----------------------------------------------------

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

-- -----------------------------------------------------
-- Source: 02-modules/surveys.sql
-- -----------------------------------------------------

-- =====================================================
-- surveys.sql - Umfrage-System
-- =====================================================
-- Erstellen und Auswerten von Mitarbeiterumfragen
-- Mit verschiedenen Fragetypen und anonymen Optionen
-- =====================================================

-- Umfragen
CREATE TABLE IF NOT EXISTS surveys (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type ENUM('feedback', 'satisfaction', 'poll', 'assessment', 'other') DEFAULT 'feedback',
    status ENUM('draft', 'active', 'paused', 'completed', 'archived') DEFAULT 'draft',
    is_anonymous BOOLEAN DEFAULT FALSE,
    allow_multiple_responses BOOLEAN DEFAULT FALSE,
    start_date DATETIME,
    end_date DATETIME,
    created_by INT NOT NULL,
    target_departments JSON,
    target_teams JSON,
    notification_sent BOOLEAN DEFAULT FALSE,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_status (status),
    INDEX idx_type (type),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_created_by (created_by)
);

-- Umfrage-Fragen
CREATE TABLE IF NOT EXISTS survey_questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    survey_id INT NOT NULL,
    question_text TEXT NOT NULL,
    question_type ENUM('single_choice', 'multiple_choice', 'text', 'rating', 'scale', 'yes_no', 'date', 'number') NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    options JSON,
    validation_rules JSON,
    order_index INT DEFAULT 0,
    help_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_survey_id (survey_id),
    INDEX idx_order_index (order_index)
);

-- Umfrage-Antworten
CREATE TABLE IF NOT EXISTS survey_responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    survey_id INT NOT NULL,
    user_id INT,
    session_id VARCHAR(100),
    status ENUM('in_progress', 'completed', 'abandoned') DEFAULT 'in_progress',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Foreign Keys
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_survey_id (survey_id),
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_status (status),
    INDEX idx_completed_at (completed_at)
);

-- Einzelne Antworten
CREATE TABLE IF NOT EXISTS survey_answers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    response_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_text TEXT,
    answer_options JSON,
    answer_number DECIMAL(10,2),
    answer_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES survey_questions(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_response_id (response_id),
    INDEX idx_question_id (question_id)
);

-- Umfrage-Kommentare
CREATE TABLE IF NOT EXISTS survey_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    survey_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_survey_id (survey_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- Umfrage-Vorlagen
CREATE TABLE IF NOT EXISTS survey_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    template_data JSON NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_category (category),
    INDEX idx_is_public (is_public)
);

-- Umfrage-Teilnehmer (für gezielte Umfragen)
CREATE TABLE IF NOT EXISTS survey_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    survey_id INT NOT NULL,
    user_id INT NOT NULL,
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reminder_sent_at TIMESTAMP NULL,
    completed BOOLEAN DEFAULT FALSE,
    
    -- Foreign Keys
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes & Constraints
    UNIQUE KEY unique_participant (survey_id, user_id),
    INDEX idx_survey_id (survey_id),
    INDEX idx_user_id (user_id),
    INDEX idx_completed (completed)
);

-- Umfrage-Erinnerungen
CREATE TABLE IF NOT EXISTS survey_reminders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    survey_id INT NOT NULL,
    reminder_date DATETIME NOT NULL,
    message TEXT,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_survey_id (survey_id),
    INDEX idx_reminder_date (reminder_date),
    INDEX idx_is_sent (is_sent)
);


-- =====================================================
-- 03-VIEWS
-- =====================================================

-- -----------------------------------------------------
-- Source: 03-views/views.sql
-- -----------------------------------------------------

-- =====================================================
-- views.sql - Datenbank-Views
-- =====================================================
-- Vordefinierte Views für häufige Abfragen
-- Vereinfacht komplexe JOINs und Aggregationen
-- =====================================================

-- Mitarbeiter-Übersicht
CREATE OR REPLACE VIEW employee_overview AS
SELECT 
    u.id,
    u.tenant_id,
    u.email,
    u.first_name,
    u.last_name,
    u.phone,
    u.role,
    u.status,
    u.created_at,
    u.last_login,
    d.name AS department_name,
    t.name AS team_name,
    COUNT(DISTINCT doc.id) AS document_count,
    COUNT(DISTINCT msg.id) AS message_count
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN user_teams ut ON u.id = ut.user_id
LEFT JOIN teams t ON ut.team_id = t.id
LEFT JOIN documents doc ON u.id = doc.user_id
LEFT JOIN messages msg ON u.id = msg.sender_id
WHERE u.role = 'employee'
GROUP BY u.id;

-- Tenant-Statistiken
CREATE OR REPLACE VIEW tenant_statistics AS
SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.subdomain,
    t.status,
    t.plan_type,
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT CASE WHEN u.role = 'admin' THEN u.id END) AS admin_count,
    COUNT(DISTINCT CASE WHEN u.role = 'employee' THEN u.id END) AS employee_count,
    COUNT(DISTINCT d.id) AS department_count,
    COUNT(DISTINCT tm.id) AS team_count,
    COUNT(DISTINCT tf.id) AS active_features,
    t.created_at,
    t.subscription_end_date
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id AND u.status = 'active'
LEFT JOIN departments d ON t.id = d.tenant_id
LEFT JOIN teams tm ON t.id = tm.tenant_id
LEFT JOIN tenant_features tf ON t.id = tf.tenant_id AND tf.is_active = TRUE
GROUP BY t.id;

-- Feature-Nutzung
CREATE OR REPLACE VIEW feature_usage_summary AS
SELECT 
    f.id AS feature_id,
    f.code,
    f.name,
    f.category,
    f.base_price,
    COUNT(DISTINCT tf.tenant_id) AS tenant_count,
    COUNT(DISTINCT ful.id) AS usage_count,
    SUM(CASE WHEN tf.is_active = TRUE THEN 1 ELSE 0 END) AS active_count,
    AVG(DATEDIFF(NOW(), tf.activated_at)) AS avg_days_active
FROM features f
LEFT JOIN tenant_features tf ON f.id = tf.feature_id
LEFT JOIN feature_usage_logs ful ON f.id = ful.feature_id
GROUP BY f.id;

-- Aktive Schichten heute
CREATE OR REPLACE VIEW active_shifts_today AS
SELECT 
    s.id,
    s.tenant_id,
    s.user_id,
    u.first_name,
    u.last_name,
    s.start_time,
    s.end_time,
    s.status,
    s.type,
    st.name AS template_name,
    d.name AS department_name
FROM shifts s
JOIN users u ON s.user_id = u.id
LEFT JOIN shift_templates st ON s.template_id = st.id
LEFT JOIN departments d ON u.department_id = d.id
WHERE DATE(s.date) = CURDATE()
AND s.status NOT IN ('cancelled');

-- Offene KVP-Vorschläge
CREATE OR REPLACE VIEW open_kvp_suggestions AS
SELECT 
    k.id,
    k.tenant_id,
    k.title,
    k.category,
    k.status,
    k.priority,
    k.estimated_savings,
    k.created_at,
    u.first_name AS submitter_first_name,
    u.last_name AS submitter_last_name,
    d.name AS department_name,
    COUNT(DISTINCT kc.id) AS comment_count,
    AVG(kr.rating) AS avg_rating
FROM kvp_suggestions k
JOIN users u ON k.submitter_id = u.id
LEFT JOIN departments d ON k.department_id = d.id
LEFT JOIN kvp_comments kc ON k.id = kc.suggestion_id
LEFT JOIN kvp_ratings kr ON k.id = kr.suggestion_id
WHERE k.status IN ('submitted', 'review', 'approved')
GROUP BY k.id;

-- Aktuelle Umfragen
CREATE OR REPLACE VIEW active_surveys AS
SELECT 
    s.id,
    s.tenant_id,
    s.title,
    s.type,
    s.status,
    s.is_anonymous,
    s.start_date,
    s.end_date,
    u.first_name AS creator_first_name,
    u.last_name AS creator_last_name,
    COUNT(DISTINCT sq.id) AS question_count,
    COUNT(DISTINCT sr.id) AS response_count,
    COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) AS completed_count
FROM surveys s
JOIN users u ON s.created_by = u.id
LEFT JOIN survey_questions sq ON s.id = sq.survey_id
LEFT JOIN survey_responses sr ON s.id = sr.survey_id
WHERE s.status = 'active'
AND (s.start_date IS NULL OR s.start_date <= NOW())
AND (s.end_date IS NULL OR s.end_date >= NOW())
GROUP BY s.id;

-- Dokument-Übersicht
CREATE OR REPLACE VIEW document_summary AS
SELECT 
    d.id,
    d.tenant_id,
    d.user_id,
    d.category,
    d.filename,
    d.file_size,
    d.uploaded_at,
    d.is_archived,
    u.first_name AS owner_first_name,
    u.last_name AS owner_last_name,
    u.email AS owner_email,
    cu.first_name AS uploader_first_name,
    cu.last_name AS uploader_last_name
FROM documents d
JOIN users u ON d.user_id = u.id
LEFT JOIN users cu ON d.created_by = cu.id
WHERE d.is_archived = FALSE;

-- Chat-Aktivität
CREATE OR REPLACE VIEW chat_activity AS
SELECT 
    DATE(m.created_at) AS activity_date,
    m.sender_id,
    u.first_name,
    u.last_name,
    u.tenant_id,
    COUNT(DISTINCT m.id) AS message_count,
    COUNT(DISTINCT m.receiver_id) AS unique_recipients,
    COUNT(DISTINCT m.group_id) AS group_messages
FROM messages m
JOIN users u ON m.sender_id = u.id
WHERE m.is_deleted = FALSE
AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(m.created_at), m.sender_id;

-- Mitarbeiter ohne Dokumente
CREATE OR REPLACE VIEW employees_without_documents AS
SELECT 
    u.id,
    u.tenant_id,
    u.email,
    u.first_name,
    u.last_name,
    u.created_at,
    d.name AS department_name
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN documents doc ON u.id = doc.user_id
WHERE u.role = 'employee'
AND u.status = 'active'
AND doc.id IS NULL
GROUP BY u.id;


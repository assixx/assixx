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
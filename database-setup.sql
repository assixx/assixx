-- =====================================================
-- ASSIXX COMPLETE DATABASE SETUP SCRIPT
-- SaaS Platform für Industrieunternehmen
-- Version: 2025-01-23
-- Multi-Tenant Architecture mit Self-Service Registration
-- =====================================================

-- Drop database if exists (NUR FÜR ENTWICKLUNG!)
-- DROP DATABASE IF EXISTS assixx_db;

-- Create database
CREATE DATABASE IF NOT EXISTS assixx_db 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE assixx_db;

-- =====================================================
-- 1. TENANT MANAGEMENT SYSTEM
-- =====================================================

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

-- =====================================================
-- 2. USER MANAGEMENT SYSTEM
-- =====================================================

-- Haupttabelle für alle Benutzer (Root, Admin, Employee)
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT DEFAULT 1,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    profile_picture_url VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    role ENUM('root', 'admin', 'employee') NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    age INT,
    employee_id VARCHAR(50),
    iban VARCHAR(50),
    company VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Zusätzliche Profilfelder
    department_id INT,
    position VARCHAR(100),
    phone VARCHAR(20),
    profile_picture VARCHAR(255),
    address TEXT,
    birthday DATE,
    hire_date DATE,
    emergency_contact TEXT,
    editable_fields JSON,
    is_archived TINYINT(1) DEFAULT 0,
    status ENUM('active', 'inactive') DEFAULT 'active',
    
    INDEX idx_tenant_users (tenant_id),
    INDEX idx_role (role),
    INDEX idx_status (status),
    INDEX idx_archived (is_archived)
);

-- Abteilungen
CREATE TABLE IF NOT EXISTS departments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id INT,
    parent_id INT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    visibility ENUM('public', 'private') DEFAULT 'public',
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tenant_id INT,
    
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_tenant_departments (tenant_id),
    INDEX idx_status (status),
    INDEX idx_visibility (visibility)
);

-- Teams innerhalb von Abteilungen
CREATE TABLE IF NOT EXISTS teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    department_id INT,
    leader_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tenant_id INT,
    
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_tenant_teams (tenant_id),
    INDEX idx_department (department_id)
);

-- Benutzer-Team-Zuordnung (Many-to-Many)
CREATE TABLE IF NOT EXISTS user_teams (
    user_id INT NOT NULL,
    team_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, team_id),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
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
    UNIQUE KEY unique_tenant_user (tenant_id, user_id),
    INDEX idx_tenant_admins (tenant_id)
);

-- =====================================================
-- 3. DOCUMENT MANAGEMENT SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    file_path VARCHAR(500) NOT NULL,
    category ENUM('contract', 'payslip', 'certificate', 'other') DEFAULT 'other',
    description TEXT,
    file_size INT,
    mime_type VARCHAR(100),
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by INT,
    is_visible_to_employee BOOLEAN DEFAULT TRUE,
    tenant_id INT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_tenant_documents (tenant_id),
    INDEX idx_user_documents (user_id),
    INDEX idx_category (category)
);

-- =====================================================
-- 4. FEATURE MANAGEMENT SYSTEM
-- =====================================================

-- Feature-Definitionen (alle verfügbaren Features)
CREATE TABLE IF NOT EXISTS features (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category ENUM('basic', 'premium', 'enterprise') DEFAULT 'basic',
    base_price DECIMAL(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tenant-Feature-Zuordnung
CREATE TABLE IF NOT EXISTS tenant_features (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    feature_id INT NOT NULL,
    status ENUM('active', 'trial', 'expired', 'disabled') DEFAULT 'disabled',
    valid_from DATE,
    valid_until DATE,
    custom_price DECIMAL(10,2),
    trial_days INT DEFAULT 0,
    usage_limit INT DEFAULT NULL,
    current_usage INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    activated_by INT,
    
    FOREIGN KEY (feature_id) REFERENCES features(id),
    UNIQUE KEY unique_tenant_feature (tenant_id, feature_id),
    INDEX idx_tenant_features (tenant_id)
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    billing_period ENUM('monthly', 'yearly') DEFAULT 'monthly',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plan-Feature-Zuordnung
CREATE TABLE IF NOT EXISTS plan_features (
    id INT PRIMARY KEY AUTO_INCREMENT,
    plan_id INT NOT NULL,
    feature_id INT NOT NULL,
    included_usage INT DEFAULT NULL,
    
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES features(id),
    UNIQUE KEY unique_plan_feature (plan_id, feature_id)
);

-- Tenant Subscriptions
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
    
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
    INDEX idx_tenant_subscriptions (tenant_id)
);

-- Feature Usage Logs
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

-- =====================================================
-- 5. BLACKBOARD SYSTEM
-- =====================================================

-- Blackboard Entries
CREATE TABLE IF NOT EXISTS blackboard_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    org_level ENUM('company', 'department', 'team') NOT NULL,
    org_id INT NOT NULL,
    author_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    status ENUM('active', 'archived') DEFAULT 'active',
    requires_confirmation BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tenant_blackboard (tenant_id),
    INDEX idx_org_level_id (org_level, org_id),
    INDEX idx_status_expires (status, expires_at)
);

-- Blackboard Tags
CREATE TABLE IF NOT EXISTS blackboard_tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#007bff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_tenant_tag (tenant_id, name),
    INDEX idx_tenant_tags (tenant_id)
);

-- Blackboard Entry Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS blackboard_entry_tags (
    entry_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (entry_id, tag_id),
    
    FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES blackboard_tags(id) ON DELETE CASCADE
);

-- Blackboard Confirmations
CREATE TABLE IF NOT EXISTS blackboard_confirmations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entry_id INT NOT NULL,
    user_id INT NOT NULL,
    confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_entry_user (entry_id, user_id),
    INDEX idx_user_confirmations (user_id)
);

-- =====================================================
-- 6. CALENDAR SYSTEM
-- =====================================================

-- Calendar Events
CREATE TABLE IF NOT EXISTS calendar_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    org_level ENUM('company', 'department', 'team') NOT NULL,
    org_id INT NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'cancelled') DEFAULT 'active',
    reminder_time INT,
    color VARCHAR(20) DEFAULT '#3498db',
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tenant_events (tenant_id),
    INDEX idx_org_level_id (org_level, org_id),
    INDEX idx_time_range (start_time, end_time),
    INDEX idx_status (status)
);

-- Calendar Attendees
CREATE TABLE IF NOT EXISTS calendar_attendees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    response_status ENUM('pending', 'accepted', 'declined', 'tentative') DEFAULT 'pending',
    responded_at TIMESTAMP NULL,
    notification_sent BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_event_user (event_id, user_id),
    INDEX idx_user_attendees (user_id)
);

-- Calendar Reminders
CREATE TABLE IF NOT EXISTS calendar_reminders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    remind_time DATETIME NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
    INDEX idx_remind_time (remind_time),
    INDEX idx_is_sent (is_sent)
);

-- Calendar Recurring Rules
CREATE TABLE IF NOT EXISTS calendar_recurring_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    frequency ENUM('daily', 'weekly', 'monthly', 'yearly') NOT NULL,
    interval_value INT DEFAULT 1,
    weekdays VARCHAR(20),
    month_day INT,
    end_date DATE,
    count INT,
    
    FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
);

-- =====================================================
-- 7. KVP SYSTEM (Kontinuierlicher Verbesserungsprozess)
-- =====================================================

-- KVP Categories
CREATE TABLE IF NOT EXISTS kvp_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#3498db',
    icon VARCHAR(50) DEFAULT '💡',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_tenant_categories (tenant_id),
    UNIQUE KEY unique_tenant_category (tenant_id, name)
);

-- KVP Suggestions
CREATE TABLE IF NOT EXISTS kvp_suggestions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category_id INT,
    org_level ENUM('company', 'department', 'team') NOT NULL,
    org_id INT NOT NULL,
    submitted_by INT NOT NULL,
    assigned_to INT NULL,
    status ENUM('new', 'in_review', 'in_progress', 'implemented', 'rejected') DEFAULT 'new',
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    expected_benefit TEXT,
    estimated_cost DECIMAL(10,2) NULL,
    actual_savings DECIMAL(10,2) NULL,
    implementation_date DATE NULL,
    rejection_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (category_id) REFERENCES kvp_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_tenant_suggestions (tenant_id),
    INDEX idx_org_level_id (org_level, org_id),
    INDEX idx_status (status),
    INDEX idx_submitted_by (submitted_by),
    INDEX idx_assigned_to (assigned_to)
);

-- KVP Attachments
CREATE TABLE IF NOT EXISTS kvp_attachments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    suggestion_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    uploaded_by INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_suggestion_attachments (suggestion_id)
);

-- KVP Comments
CREATE TABLE IF NOT EXISTS kvp_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    suggestion_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_suggestion_comments (suggestion_id),
    INDEX idx_user_comments (user_id)
);

-- KVP Ratings
CREATE TABLE IF NOT EXISTS kvp_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    suggestion_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_suggestion_user (suggestion_id, user_id),
    INDEX idx_suggestion_ratings (suggestion_id)
);

-- KVP Points (Belohnungssystem)
CREATE TABLE IF NOT EXISTS kvp_points (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    suggestion_id INT NOT NULL,
    points INT NOT NULL,
    reason ENUM('submission', 'implementation', 'rating', 'bonus') NOT NULL,
    awarded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
    FOREIGN KEY (awarded_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tenant_points (tenant_id),
    INDEX idx_user_points (user_id),
    INDEX idx_suggestion_points (suggestion_id)
);

-- KVP Status History
CREATE TABLE IF NOT EXISTS kvp_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    suggestion_id INT NOT NULL,
    old_status ENUM('new', 'in_review', 'in_progress', 'implemented', 'rejected'),
    new_status ENUM('new', 'in_review', 'in_progress', 'implemented', 'rejected') NOT NULL,
    changed_by INT NOT NULL,
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_suggestion_history (suggestion_id)
);

-- =====================================================
-- 8. CHAT SYSTEM
-- =====================================================

-- Conversations (Chat-Räume)
CREATE TABLE IF NOT EXISTS conversations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type ENUM('direct', 'group') DEFAULT 'direct',
    name VARCHAR(255) NULL,
    description TEXT NULL,
    created_by INT NOT NULL,
    tenant_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tenant_conversations (tenant_id),
    INDEX idx_created_by (created_by),
    INDEX idx_active_conversations (is_active, tenant_id)
);

-- Conversation Participants
CREATE TABLE IF NOT EXISTS conversation_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('member', 'admin') DEFAULT 'member',
    can_send_messages BOOLEAN DEFAULT TRUE,
    can_add_participants BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP NULL,
    last_seen_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_conversation_user (conversation_id, user_id),
    INDEX idx_user_conversations (user_id, is_active),
    INDEX idx_conversation_participants (conversation_id, is_active)
);

-- Messages mit Planungsfunktion
CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    recipient_id INT NULL,
    content TEXT NOT NULL,
    message_type ENUM('text', 'file', 'image', 'system') DEFAULT 'text',
    
    -- Nachrichtenplanung
    delivery_type ENUM('immediate', 'break_time', 'after_work', 'scheduled') DEFAULT 'immediate',
    scheduled_for TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    is_delivered BOOLEAN DEFAULT FALSE,
    
    -- Status und Metadata
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    edited_at TIMESTAMP NULL,
    
    -- Multi-Tenant Support
    tenant_id INT NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_conversation_messages (conversation_id, created_at),
    INDEX idx_sender_messages (sender_id, created_at),
    INDEX idx_recipient_messages (recipient_id, is_read),
    INDEX idx_tenant_messages (tenant_id),
    INDEX idx_delivery_queue (is_delivered, delivery_type, scheduled_for),
    INDEX idx_unread_messages (recipient_id, is_read, is_delivered)
);

-- Message Attachments
CREATE TABLE IF NOT EXISTS message_attachments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type ENUM('image', 'document', 'audio', 'video', 'other') DEFAULT 'other',
    thumbnail_path VARCHAR(500) NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    INDEX idx_message_attachments (message_id),
    INDEX idx_file_type (file_type)
);

-- Chat Permissions
CREATE TABLE IF NOT EXISTS chat_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    from_role ENUM('root', 'admin', 'employee') NOT NULL,
    to_role ENUM('root', 'admin', 'employee') NOT NULL,
    can_initiate_chat BOOLEAN DEFAULT FALSE,
    can_send_messages BOOLEAN DEFAULT FALSE,
    can_send_files BOOLEAN DEFAULT FALSE,
    tenant_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_role_permission (from_role, to_role, tenant_id),
    INDEX idx_tenant_permissions (tenant_id)
);

-- Work Schedules
CREATE TABLE IF NOT EXISTS work_schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NULL,
    day_of_week TINYINT NOT NULL,
    work_start_time TIME NOT NULL,
    work_end_time TIME NOT NULL,
    break_start_time TIME NULL,
    break_end_time TIME NULL,
    is_work_day BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_day (user_id, day_of_week),
    INDEX idx_tenant_schedules (tenant_id),
    INDEX idx_work_days (day_of_week, is_work_day)
);

-- Message Queue
CREATE TABLE IF NOT EXISTS message_delivery_queue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    recipient_id INT NOT NULL,
    delivery_type ENUM('break_time', 'after_work', 'scheduled') NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    status ENUM('pending', 'processing', 'delivered', 'failed') DEFAULT 'pending',
    error_message TEXT NULL,
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_delivery_queue (status, scheduled_for),
    INDEX idx_recipient_queue (recipient_id, status),
    INDEX idx_processing_queue (status, attempts, max_attempts)
);

-- =====================================================
-- 9. SHIFT PLANNING SYSTEM
-- =====================================================

-- Shift Templates (Schichtvorlagen)
CREATE TABLE IF NOT EXISTS shift_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration INT DEFAULT 0,
    color VARCHAR(7) DEFAULT '#007bff',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_tenant_templates (tenant_id),
    INDEX idx_active_templates (is_active)
);

-- Shift Plans (Schichtpläne)
CREATE TABLE IF NOT EXISTS shift_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_tenant_plans (tenant_id),
    INDEX idx_date_range (start_date, end_date),
    INDEX idx_status (status)
);

-- Individual Shifts (Einzelne Schichten)
CREATE TABLE IF NOT EXISTS shifts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    plan_id INT,
    template_id INT,
    employee_id INT NOT NULL,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration INT DEFAULT 0,
    status ENUM('scheduled', 'confirmed', 'completed', 'cancelled') DEFAULT 'scheduled',
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE SET NULL,
    FOREIGN KEY (template_id) REFERENCES shift_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_tenant_shifts (tenant_id),
    INDEX idx_employee_date (employee_id, shift_date),
    INDEX idx_plan_shifts (plan_id),
    INDEX idx_date_range (shift_date),
    INDEX idx_status (status)
);

-- Shift Assignments (für Team-Zuordnungen)
CREATE TABLE IF NOT EXISTS shift_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    shift_id INT NOT NULL,
    department_id INT,
    team_id INT,
    position VARCHAR(100),
    requirements TEXT,
    
    FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    
    INDEX idx_shift_assignments (shift_id),
    INDEX idx_department_assignments (department_id),
    INDEX idx_team_assignments (team_id)
);

-- Shift Exchange Requests (Schichttausch)
CREATE TABLE IF NOT EXISTS shift_exchange_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    requester_shift_id INT NOT NULL,
    target_shift_id INT,
    requested_by INT NOT NULL,
    requested_from INT,
    message TEXT,
    status ENUM('pending', 'approved', 'declined', 'cancelled') DEFAULT 'pending',
    responded_at TIMESTAMP NULL,
    response_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (requester_shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
    FOREIGN KEY (target_shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_from) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_requester_exchanges (requested_by),
    INDEX idx_target_exchanges (requested_from),
    INDEX idx_status_exchanges (status)
);

-- Employee Availability (Verfügbarkeit)
CREATE TABLE IF NOT EXISTS employee_availability (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    availability_type ENUM('available', 'unavailable', 'preferred', 'limited') DEFAULT 'available',
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_employee_date (employee_id, date),
    INDEX idx_employee_availability (employee_id),
    INDEX idx_date_availability (date)
);

-- Overtime Records (Überstunden)
CREATE TABLE IF NOT EXISTS overtime_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    shift_id INT,
    date DATE NOT NULL,
    regular_hours DECIMAL(4,2) DEFAULT 0,
    overtime_hours DECIMAL(4,2) DEFAULT 0,
    break_time DECIMAL(4,2) DEFAULT 0,
    total_hours DECIMAL(4,2) NOT NULL,
    hourly_rate DECIMAL(8,2),
    overtime_rate DECIMAL(8,2),
    approved_by INT,
    approved_at TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_employee_overtime (employee_id),
    INDEX idx_date_overtime (date),
    INDEX idx_approval_status (approved_by, approved_at)
);

-- Absences (Abwesenheiten)
CREATE TABLE IF NOT EXISTS absences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    absence_type ENUM('vacation', 'sick', 'personal', 'training', 'other') NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reason TEXT,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_employee_absences (employee_id),
    INDEX idx_date_range_absences (start_date, end_date),
    INDEX idx_status_absences (status),
    INDEX idx_absence_type (absence_type)
);

-- =====================================================
-- 10. ADMIN AND AUDIT SYSTEM
-- =====================================================

-- Admin Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_tenant_logs (tenant_id),
    INDEX idx_user_logs (user_id),
    INDEX idx_action_logs (action),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- 11. VIEWS FÜR OPTIMIERTE ABFRAGEN
-- =====================================================

-- Ungelesene Nachrichten pro Benutzer
CREATE VIEW unread_messages_view AS
SELECT 
    m.recipient_id,
    COUNT(*) as unread_count,
    MAX(m.created_at) as latest_message_at
FROM messages m
WHERE m.is_read = FALSE 
    AND m.is_delivered = TRUE 
    AND m.is_deleted = FALSE
GROUP BY m.recipient_id;

-- Aktive Conversations pro Benutzer
CREATE VIEW user_conversations_view AS
SELECT 
    cp.user_id,
    c.id as conversation_id,
    c.name as conversation_name,
    c.type as conversation_type,
    cp.last_read_at,
    cp.last_seen_at,
    COUNT(m.id) as total_messages,
    COUNT(CASE WHEN m.is_read = FALSE AND m.recipient_id = cp.user_id THEN 1 END) as unread_count,
    MAX(m.created_at) as last_message_at,
    u.username as created_by_username,
    u.first_name as created_by_first_name,
    u.last_name as created_by_last_name
FROM conversation_participants cp
JOIN conversations c ON cp.conversation_id = c.id
LEFT JOIN messages m ON c.id = m.conversation_id AND m.is_deleted = FALSE
LEFT JOIN users u ON c.created_by = u.id
WHERE cp.is_active = TRUE AND c.is_active = TRUE
GROUP BY cp.user_id, c.id, c.name, c.type, cp.last_read_at, cp.last_seen_at, u.username, u.first_name, u.last_name;

-- Employee Shift Overview
CREATE VIEW employee_shift_overview AS
SELECT 
    s.employee_id,
    u.first_name,
    u.last_name,
    s.shift_date,
    s.start_time,
    s.end_time,
    s.break_duration,
    s.status as shift_status,
    st.name as template_name,
    st.color as shift_color,
    TIMESTAMPDIFF(MINUTE, s.start_time, s.end_time) - s.break_duration as working_minutes,
    d.name as department_name,
    t.name as team_name
FROM shifts s
JOIN users u ON s.employee_id = u.id
LEFT JOIN shift_templates st ON s.template_id = st.id
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN user_teams ut ON u.id = ut.user_id
LEFT JOIN teams t ON ut.team_id = t.id
WHERE s.shift_date >= CURDATE() - INTERVAL 7 DAY;

-- Shift Overview (für Admin Dashboard)
CREATE VIEW shift_overview AS
SELECT 
    sp.id as plan_id,
    sp.name as plan_name,
    sp.start_date,
    sp.end_date,
    sp.status as plan_status,
    COUNT(s.id) as total_shifts,
    COUNT(CASE WHEN s.status = 'confirmed' THEN 1 END) as confirmed_shifts,
    COUNT(CASE WHEN s.status = 'scheduled' THEN 1 END) as pending_shifts,
    COUNT(DISTINCT s.employee_id) as assigned_employees,
    u.first_name as created_by_first_name,
    u.last_name as created_by_last_name
FROM shift_plans sp
LEFT JOIN shifts s ON sp.id = s.plan_id
LEFT JOIN users u ON sp.created_by = u.id
GROUP BY sp.id, sp.name, sp.start_date, sp.end_date, sp.status, u.first_name, u.last_name;

-- =====================================================
-- 12. TRIGGER FÜR AUTOMATISIERUNG
-- =====================================================

-- Trigger für automatische Tenant-Zuordnung bei Nachrichten
DELIMITER //
CREATE TRIGGER set_message_tenant_id
    BEFORE INSERT ON messages
    FOR EACH ROW
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id 
        FROM users 
        WHERE id = NEW.sender_id;
    END IF;
END//
DELIMITER ;

-- Trigger für automatische Tenant-Zuordnung bei Conversations
DELIMITER //
CREATE TRIGGER set_conversation_tenant_id
    BEFORE INSERT ON conversations
    FOR EACH ROW
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id 
        FROM users 
        WHERE id = NEW.created_by;
    END IF;
END//
DELIMITER ;

-- =====================================================
-- 13. BEISPIELDATEN EINFÜGEN
-- =====================================================

-- Beispiel-Features einfügen
INSERT IGNORE INTO features (code, name, description, category, base_price) VALUES
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
('audit_logs', 'Audit Logs', 'Detaillierte Aktivitätsprotokolle', 'premium', 15.00),
('blackboard_system', 'Schwarzes Brett', 'Digitales schwarzes Brett für Ankündigungen', 'basic', 0.00),
('calendar_system', 'Kalender System', 'Ereignisse und Terminplanung', 'basic', 0.00),
('kvp_system', 'KVP System', 'Kontinuierlicher Verbesserungsprozess', 'premium', 25.00),
('chat_system', 'Chat System', 'Interne Kommunikation mit Planung', 'premium', 20.00),
('shift_planning', 'Schichtplanung', 'Erweiterte Schichtplanung und -verwaltung', 'premium', 30.00);

-- Standard Subscription Plans
INSERT IGNORE INTO subscription_plans (name, description, price, billing_period) VALUES
('Basic', 'Grundfunktionen für kleine Unternehmen', 0.00, 'monthly'),
('Premium', 'Erweiterte Funktionen für wachsende Unternehmen', 49.00, 'monthly'),
('Enterprise', 'Vollständiger Funktionsumfang für große Unternehmen', 149.00, 'monthly');

-- Plan-Feature Zuordnungen für Basic Plan
INSERT IGNORE INTO plan_features (plan_id, feature_id) 
SELECT 1, id FROM features WHERE code IN ('basic_employees', 'document_upload', 'payslip_management', 'blackboard_system', 'calendar_system');

-- Plan-Feature Zuordnungen für Premium Plan
INSERT IGNORE INTO plan_features (plan_id, feature_id, included_usage) 
SELECT 2, id, CASE 
    WHEN code = 'email_notifications' THEN 1000 
    ELSE NULL 
END 
FROM features 
WHERE category IN ('basic', 'premium');

-- Plan-Feature Zuordnungen für Enterprise Plan (alle Features)
INSERT IGNORE INTO plan_features (plan_id, feature_id, included_usage) 
SELECT 3, id, CASE 
    WHEN code = 'email_notifications' THEN 10000 
    ELSE NULL 
END 
FROM features;

-- Standard Chat-Berechtigungen
INSERT IGNORE INTO chat_permissions (from_role, to_role, can_initiate_chat, can_send_messages, can_send_files) VALUES
-- Root kann mit allen kommunizieren
('root', 'root', TRUE, TRUE, TRUE),
('root', 'admin', TRUE, TRUE, TRUE),
('root', 'employee', TRUE, TRUE, TRUE),

-- Admin kann mit Root und Employees kommunizieren
('admin', 'root', TRUE, TRUE, TRUE),
('admin', 'admin', TRUE, TRUE, TRUE),
('admin', 'employee', TRUE, TRUE, TRUE),

-- Employee kann nur an Admins schreiben (nicht initiieren)
('employee', 'admin', FALSE, TRUE, TRUE),
('employee', 'root', FALSE, FALSE, FALSE),
('employee', 'employee', FALSE, FALSE, FALSE);

-- Standard-Arbeitszeiten (Montag-Freitag, 8-17 Uhr, Pause 12-13 Uhr)
INSERT IGNORE INTO work_schedules (tenant_id, user_id, day_of_week, work_start_time, work_end_time, break_start_time, break_end_time, is_work_day) VALUES
(1, NULL, 1, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE),  -- Montag
(1, NULL, 2, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE),  -- Dienstag
(1, NULL, 3, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE),  -- Mittwoch
(1, NULL, 4, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE),  -- Donnerstag
(1, NULL, 5, '08:00:00', '17:00:00', '12:00:00', '13:00:00', TRUE),  -- Freitag
(1, NULL, 6, '08:00:00', '17:00:00', NULL, NULL, FALSE),             -- Samstag
(1, NULL, 7, '08:00:00', '17:00:00', NULL, NULL, FALSE);             -- Sonntag

-- Standard KVP Categories (nur wenn tenant_id = 1 existiert)
INSERT IGNORE INTO kvp_categories (tenant_id, name, description, color, icon) VALUES
(1, 'Sicherheit', 'Verbesserungen zur Arbeitssicherheit', '#e74c3c', '🛡️'),
(1, 'Effizienz', 'Prozessoptimierungen und Zeitersparnis', '#2ecc71', '⚡'),
(1, 'Qualität', 'Qualitätsverbesserungen und Fehlervermeidung', '#3498db', '⭐'),
(1, 'Umwelt', 'Umweltfreundliche Verbesserungen', '#27ae60', '🌱'),
(1, 'Ergonomie', 'Arbeitsplatzverbesserungen', '#9b59b6', '👤'),
(1, 'Kosteneinsparung', 'Maßnahmen zur Kostenreduzierung', '#f39c12', '💰');

-- Standard Shift Templates (nur wenn tenant_id = 1 existiert)
INSERT IGNORE INTO shift_templates (tenant_id, name, start_time, end_time, break_duration, color, description) VALUES
(1, 'Frühschicht', '06:00:00', '14:00:00', 30, '#28a745', 'Standard Frühschicht 6-14 Uhr'),
(1, 'Spätschicht', '14:00:00', '22:00:00', 30, '#ffc107', 'Standard Spätschicht 14-22 Uhr'),
(1, 'Nachtschicht', '22:00:00', '06:00:00', 30, '#6f42c1', 'Standard Nachtschicht 22-6 Uhr'),
(1, 'Tagschicht', '08:00:00', '16:00:00', 60, '#007bff', 'Standard Tagschicht 8-16 Uhr'),
(1, 'Teilzeit Vormittag', '08:00:00', '12:00:00', 0, '#17a2b8', 'Teilzeit Vormittag 8-12 Uhr'),
(1, 'Teilzeit Nachmittag', '13:00:00', '17:00:00', 0, '#fd7e14', 'Teilzeit Nachmittag 13-17 Uhr');

-- =====================================================
-- 14. FREMDSCHLÜSSEL NACHTRÄGLICH HINZUFÜGEN
-- =====================================================

-- Fremdschlüssel für users.department_id
ALTER TABLE users ADD CONSTRAINT fk_users_department 
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- Fremdschlüssel für documents.tenant_id (falls tenants Tabelle existiert)
-- ALTER TABLE documents ADD CONSTRAINT fk_documents_tenant 
--     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- =====================================================
-- SETUP ERFOLGREICH ABGESCHLOSSEN
-- =====================================================

SELECT 'Assixx Database Setup erfolgreich abgeschlossen!' as Status;
SELECT COUNT(*) as 'Anzahl Tabellen' FROM information_schema.tables WHERE table_schema = DATABASE();
SELECT 'Nächste Schritte: Benutzer über Signup-Page erstellen' as Hinweis;
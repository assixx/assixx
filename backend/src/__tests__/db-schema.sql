-- Test Database Schema for Assixx
-- This schema is used for automated tests in GitHub Actions

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  status ENUM('active', 'suspended', 'deleted') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('root', 'admin', 'employee') NOT NULL,
  status ENUM('active', 'inactive', 'deleted') DEFAULT 'active',
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  department_id INT,
  team_id INT,
  position VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_username_tenant (username, tenant_id),
  UNIQUE KEY unique_email_tenant (email, tenant_id),
  INDEX idx_tenant_id (tenant_id)
);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id INT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id)
);

-- Teams table  
CREATE TABLE IF NOT EXISTS teams (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  department_id INT,
  name VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_department_id (department_id)
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  uploaded_by INT NOT NULL,
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  category VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INT,
  file_size BIGINT,
  mime_type VARCHAR(255),
  scan_status ENUM('pending', 'clean', 'infected', 'error') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_category (category),
  INDEX idx_uploaded_by (uploaded_by)
);

-- Blackboard entries table
CREATE TABLE IF NOT EXISTS blackboard_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  author_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  org_level ENUM('company', 'department', 'team') DEFAULT 'company',
  org_id INT,
  priority_level ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  color VARCHAR(20) DEFAULT 'blue',
  status ENUM('active', 'archived') DEFAULT 'active',
  expires_at DATETIME,
  requires_confirmation BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_org_level (org_level),
  INDEX idx_status (status)
);

-- Blackboard confirmations table
CREATE TABLE IF NOT EXISTS blackboard_confirmations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entry_id INT NOT NULL,
  user_id INT NOT NULL,
  confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_confirmation (entry_id, user_id),
  INDEX idx_entry_id (entry_id)
);

-- Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  created_by INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,
  recurring BOOLEAN DEFAULT FALSE,
  visibility_scope ENUM('personal', 'department', 'company') DEFAULT 'personal',
  visibility_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_start_date (start_date),
  INDEX idx_visibility (visibility_scope)
);

-- KVP suggestions table
CREATE TABLE IF NOT EXISTS kvp_suggestions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  submitted_by INT,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100),
  status ENUM('pending', 'reviewing', 'approved', 'implemented', 'rejected') DEFAULT 'pending',
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_status (status)
);

-- Chat channels table
CREATE TABLE IF NOT EXISTS chat_channels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('direct', 'group', 'department', 'announcement') NOT NULL,
  visibility_scope VARCHAR(50),
  created_by INT NOT NULL,
  status ENUM('active', 'archived') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_type (type)
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  channel_id INT NOT NULL,
  sender_id INT NOT NULL,
  content TEXT NOT NULL,
  tenant_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_channel_id (channel_id),
  INDEX idx_sender_id (sender_id)
);

-- Shift templates table
CREATE TABLE IF NOT EXISTS shift_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  department_id INT,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(10),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration INT DEFAULT 0,
  is_overnight BOOLEAN DEFAULT FALSE,
  color VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_department_id (department_id)
);

-- Shift plans table
CREATE TABLE IF NOT EXISTS shift_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  department_id INT,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_dates (start_date, end_date)
);

-- Shift assignments table
CREATE TABLE IF NOT EXISTS shift_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  plan_id INT NOT NULL,
  template_id INT NOT NULL,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('assigned', 'confirmed', 'swap_requested', 'absent') DEFAULT 'assigned',
  tenant_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_assignment (plan_id, user_id, date),
  INDEX idx_user_date (user_id, date)
);

-- Surveys table
CREATE TABLE IF NOT EXISTS surveys (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50),
  visibility_scope VARCHAR(50),
  status ENUM('draft', 'active', 'completed', 'archived') DEFAULT 'draft',
  starts_at DATETIME,
  ends_at DATETIME,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_status (status)
);

-- Survey questions table
CREATE TABLE IF NOT EXISTS survey_questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  survey_id INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type ENUM('text', 'single_choice', 'multiple_choice', 'rating', 'scale') NOT NULL,
  is_required BOOLEAN DEFAULT TRUE,
  question_order INT NOT NULL,
  options JSON,
  tenant_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_survey_id (survey_id)
);

-- Survey responses table
CREATE TABLE IF NOT EXISTS survey_responses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  survey_id INT NOT NULL,
  user_id INT NOT NULL,
  tenant_id INT NOT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_response (survey_id, user_id),
  INDEX idx_survey_id (survey_id)
);

-- Survey answers table
CREATE TABLE IF NOT EXISTS survey_answers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  response_id INT NOT NULL,
  question_id INT NOT NULL,
  answer_value TEXT,
  tenant_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_response_id (response_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read)
);

-- Admin logs table
CREATE TABLE IF NOT EXISTS admin_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INT,
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_token_hash (token_hash)
);
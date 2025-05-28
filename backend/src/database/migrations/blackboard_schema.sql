-- Blackboard System Tables
-- Migration created on 2025-05-21

-- Blackboard Entries Table
CREATE TABLE IF NOT EXISTS blackboard_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  org_level ENUM('company', 'department', 'team') NOT NULL,
  org_id INT NOT NULL,  -- ID der Firma, Abteilung oder des Teams
  author_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  status ENUM('active', 'archived') DEFAULT 'active',
  requires_confirmation BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (tenant_id),
  INDEX (org_level, org_id),
  INDEX (status, expires_at)
);

-- Blackboard Confirmations Table
CREATE TABLE IF NOT EXISTS blackboard_confirmations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_id INT NOT NULL,
  user_id INT NOT NULL,
  confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY (entry_id, user_id),
  INDEX (user_id)
);
-- KVP System Tables (Kontinuierlicher Verbesserungsprozess)
-- Migration created on 2025-05-22

-- KVP Categories Table
CREATE TABLE IF NOT EXISTS kvp_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#3498db',
  icon VARCHAR(50) DEFAULT '💡',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX (tenant_id),
  UNIQUE KEY (tenant_id, name)
);

-- KVP Suggestions Table
CREATE TABLE IF NOT EXISTS kvp_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category_id INT,
  org_level ENUM('company', 'department', 'team') NOT NULL,
  org_id INT NOT NULL,  -- ID der Firma, Abteilung oder des Teams
  submitted_by INT NOT NULL,  -- Employee who submitted
  assigned_to INT NULL,       -- Admin who handles it
  status ENUM('new', 'in_review', 'in_progress', 'implemented', 'rejected') DEFAULT 'new',
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  expected_benefit TEXT,      -- Erwarteter Nutzen
  estimated_cost DECIMAL(10,2) NULL, -- Geschätzte Kosten
  actual_savings DECIMAL(10,2) NULL, -- Tatsächliche Einsparungen
  implementation_date DATE NULL,
  rejection_reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES kvp_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  INDEX (tenant_id),
  INDEX (org_level, org_id),
  INDEX (status),
  INDEX (submitted_by),
  INDEX (assigned_to)
);

-- KVP Attachments Table (für Fotos und Dokumente)
CREATE TABLE IF NOT EXISTS kvp_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  suggestion_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  uploaded_by INT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (suggestion_id)
);

-- KVP Comments Table (für Diskussion und Updates)
CREATE TABLE IF NOT EXISTS kvp_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  suggestion_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,  -- Nur für Admins sichtbar
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (suggestion_id),
  INDEX (user_id)
);

-- KVP Ratings Table (Bewertungssystem)
CREATE TABLE IF NOT EXISTS kvp_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  suggestion_id INT NOT NULL,
  user_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY (suggestion_id, user_id),
  INDEX (suggestion_id)
);

-- KVP Points Table (Belohnungssystem)
CREATE TABLE IF NOT EXISTS kvp_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  suggestion_id INT NOT NULL,
  points INT NOT NULL,
  reason ENUM('submission', 'implementation', 'rating', 'bonus') NOT NULL,
  awarded_by INT NOT NULL,  -- Admin who awarded points
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
  FOREIGN KEY (awarded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (tenant_id),
  INDEX (user_id),
  INDEX (suggestion_id)
);

-- KVP Status History Table (Audit Trail)
CREATE TABLE IF NOT EXISTS kvp_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  suggestion_id INT NOT NULL,
  old_status ENUM('new', 'in_review', 'in_progress', 'implemented', 'rejected'),
  new_status ENUM('new', 'in_review', 'in_progress', 'implemented', 'rejected') NOT NULL,
  changed_by INT NOT NULL,
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (suggestion_id)
);

-- Standard KVP Categories einfügen
INSERT IGNORE INTO kvp_categories (tenant_id, name, description, color, icon) VALUES
(1, 'Sicherheit', 'Verbesserungen zur Arbeitssicherheit', '#e74c3c', '🛡️'),
(1, 'Effizienz', 'Prozessoptimierungen und Zeitersparnis', '#2ecc71', '⚡'),
(1, 'Qualität', 'Qualitätsverbesserungen und Fehlervermeidung', '#3498db', '⭐'),
(1, 'Umwelt', 'Umweltfreundliche Verbesserungen', '#27ae60', '🌱'),
(1, 'Ergonomie', 'Arbeitsplatzverbesserungen', '#9b59b6', '👤'),
(1, 'Kosteneinsparung', 'Maßnahmen zur Kostenreduzierung', '#f39c12', '💰');
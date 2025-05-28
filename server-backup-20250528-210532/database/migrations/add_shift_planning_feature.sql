-- ==================================================
-- SCHICHTPLANUNGS-TOOL DATENBANKSCHEMA
-- Erstellt: 2025-05-22
-- Beschreibung: Vollständiges Schema für das Schichtplanungs-System
-- ==================================================

-- 1. SCHICHTVORLAGEN (Shift Templates)
-- Definiert verschiedene Schichttypen (Früh, Spät, Nacht, etc.)
CREATE TABLE IF NOT EXISTS shift_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours DECIMAL(4,2) NOT NULL,
  break_duration_minutes INT DEFAULT 0,
  color VARCHAR(7) DEFAULT '#3498db',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_active (tenant_id, is_active),
  INDEX idx_template_name (name)
);

-- 2. SCHICHTPLÄNE (Shift Plans)
-- Wochenweise oder monatliche Schichtpläne
CREATE TABLE IF NOT EXISTS shift_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  department_id INT,
  team_id INT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('draft', 'published', 'locked', 'archived') DEFAULT 'draft',
  created_by INT NOT NULL,
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_dates (tenant_id, start_date, end_date),
  INDEX idx_department (department_id),
  INDEX idx_team (team_id),
  INDEX idx_status (status),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. SCHICHTEN (Individual Shifts)
-- Einzelne Schichten innerhalb eines Plans
CREATE TABLE IF NOT EXISTS shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  plan_id INT NOT NULL,
  template_id INT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  title VARCHAR(200),
  description TEXT,
  required_employees INT DEFAULT 1,
  min_employees INT DEFAULT 1,
  max_employees INT DEFAULT 10,
  department_id INT,
  team_id INT,
  position_required VARCHAR(100),
  skills_required JSON,
  color VARCHAR(7) DEFAULT '#3498db',
  status ENUM('open', 'partially_filled', 'fully_filled', 'overstaffed', 'cancelled') DEFAULT 'open',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_plan_date (plan_id, date),
  INDEX idx_date_range (date, start_time, end_time),
  INDEX idx_department (department_id),
  INDEX idx_team (team_id),
  INDEX idx_status (status),
  FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES shift_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 4. SCHICHT-ZUWEISUNGEN (Shift Assignments)
-- Zuweisungen von Mitarbeitern zu Schichten
CREATE TABLE IF NOT EXISTS shift_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  shift_id INT NOT NULL,
  user_id INT NOT NULL,
  assignment_type ENUM('assigned', 'requested', 'available', 'unavailable') DEFAULT 'assigned',
  status ENUM('pending', 'accepted', 'declined', 'cancelled') DEFAULT 'pending',
  assigned_by INT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  response_at TIMESTAMP NULL,
  notes TEXT,
  overtime_hours DECIMAL(4,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_shift_user (shift_id, user_id),
  INDEX idx_user_status (user_id, status),
  INDEX idx_shift_type (shift_id, assignment_type),
  INDEX idx_assigned_by (assigned_by),
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. MITARBEITER-VERFÜGBARKEITEN (Employee Availability)
-- Wann sind Mitarbeiter an bestimmten Tagen verfügbar
CREATE TABLE IF NOT EXISTS employee_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  availability_type ENUM('available', 'preferred', 'unavailable', 'sick', 'vacation') DEFAULT 'available',
  start_time TIME,
  end_time TIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_date (user_id, date),
  INDEX idx_user_availability (user_id, availability_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. SCHICHTTAUSCH-ANFRAGEN (Shift Exchange Requests)
-- Mitarbeiter können Schichten tauschen
CREATE TABLE IF NOT EXISTS shift_exchange_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  shift_id INT NOT NULL,
  requester_id INT NOT NULL,
  target_user_id INT,
  exchange_type ENUM('give_away', 'swap', 'request_coverage') DEFAULT 'give_away',
  target_shift_id INT,
  message TEXT,
  status ENUM('pending', 'accepted', 'declined', 'cancelled', 'completed') DEFAULT 'pending',
  response_message TEXT,
  approved_by INT,
  approved_at TIMESTAMP NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_requester (requester_id),
  INDEX idx_target_user (target_user_id),
  INDEX idx_status (status),
  INDEX idx_shift (shift_id),
  INDEX idx_target_shift (target_shift_id),
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (target_shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 7. ÜBERSTUNDEN-TRACKING (Overtime Tracking)
-- Überstunden und Arbeitszeit-Tracking
CREATE TABLE IF NOT EXISTS overtime_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  shift_id INT,
  date DATE NOT NULL,
  regular_hours DECIMAL(4,2) DEFAULT 0,
  overtime_hours DECIMAL(4,2) DEFAULT 0,
  break_time_minutes INT DEFAULT 0,
  actual_start_time TIME,
  actual_end_time TIME,
  recorded_by INT,
  approved_by INT,
  approved_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_date (user_id, date),
  INDEX idx_shift (shift_id),
  INDEX idx_recorded_by (recorded_by),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 8. ABWESENHEITEN (Absences)
-- Urlaub, Krankheit, etc.
CREATE TABLE IF NOT EXISTS absences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  absence_type ENUM('vacation', 'sick_leave', 'personal', 'training', 'other') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  is_full_day BOOLEAN DEFAULT TRUE,
  reason TEXT,
  status ENUM('pending', 'approved', 'declined', 'cancelled') DEFAULT 'pending',
  requested_by INT NOT NULL,
  approved_by INT,
  approved_at TIMESTAMP NULL,
  decline_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_dates (user_id, start_date, end_date),
  INDEX idx_status (status),
  INDEX idx_type (absence_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ==================================================
-- STANDARD SCHICHTVORLAGEN EINFÜGEN
-- ==================================================

-- Standard Schichtvorlagen für Demo-Tenant (ID 1)
INSERT IGNORE INTO shift_templates (tenant_id, name, description, start_time, end_time, duration_hours, break_duration_minutes, color) VALUES
(1, 'Frühschicht', 'Standard Frühschicht 6:00-14:00', '06:00:00', '14:00:00', 8.00, 30, '#2ecc71'),
(1, 'Spätschicht', 'Standard Spätschicht 14:00-22:00', '14:00:00', '22:00:00', 8.00, 30, '#f39c12'),
(1, 'Nachtschicht', 'Standard Nachtschicht 22:00-06:00', '22:00:00', '06:00:00', 8.00, 30, '#9b59b6'),
(1, 'Tagschicht', 'Standard Tagschicht 8:00-16:00', '08:00:00', '16:00:00', 8.00, 45, '#3498db'),
(1, 'Halbtagsschicht', 'Halbtags 8:00-12:00', '08:00:00', '12:00:00', 4.00, 15, '#1abc9c'),
(1, 'Wochenendschicht', 'Wochenende 10:00-18:00', '10:00:00', '18:00:00', 8.00, 30, '#e74c3c');

-- ==================================================
-- FEATURE-REGISTRIERUNG
-- ==================================================

-- Registriere das Shift Planning Feature im Feature-Management-System
INSERT IGNORE INTO features (code, name, description, category, base_price, is_active) VALUES
('shift_planning', 'Schichtplanung', 'Vollständiges Schichtplanungs-Tool mit Mitarbeiter-Zuweisung und Tauschbörse', 'premium', 19.99, 1);

-- Aktiviere das Feature für den Demo-Tenant
INSERT IGNORE INTO tenant_features (tenant_id, feature_id, status, valid_from, activated_by) 
SELECT 1, id, 'active', CURDATE(), 1
FROM features 
WHERE code = 'shift_planning';

-- ==================================================
-- VIEWS FÜR BESSERE PERFORMANCE
-- ==================================================

-- View für Schicht-Übersicht mit Mitarbeiter-Details
CREATE OR REPLACE VIEW shift_overview AS
SELECT 
  s.id as shift_id,
  s.date,
  s.start_time,
  s.end_time,
  s.title,
  s.required_employees,
  s.status as shift_status,
  sp.name as plan_name,
  st.name as template_name,
  st.color as template_color,
  d.name as department_name,
  t.name as team_name,
  COUNT(sa.id) as assigned_count,
  COUNT(CASE WHEN sa.status = 'accepted' THEN 1 END) as accepted_count
FROM shifts s
LEFT JOIN shift_plans sp ON s.plan_id = sp.id
LEFT JOIN shift_templates st ON s.template_id = st.id
LEFT JOIN departments d ON s.department_id = d.id
LEFT JOIN teams t ON s.team_id = t.id
LEFT JOIN shift_assignments sa ON s.id = sa.shift_id
GROUP BY s.id;

-- View für Mitarbeiter-Schicht-Übersicht
CREATE OR REPLACE VIEW employee_shift_overview AS
SELECT 
  u.id as user_id,
  u.first_name,
  u.last_name,
  u.username,
  s.id as shift_id,
  s.date,
  s.start_time,
  s.end_time,
  s.title as shift_title,
  sa.status as assignment_status,
  sa.assignment_type,
  st.name as template_name,
  d.name as department_name,
  t.name as team_name
FROM users u
JOIN shift_assignments sa ON u.id = sa.user_id
JOIN shifts s ON sa.shift_id = s.id
LEFT JOIN shift_templates st ON s.template_id = st.id
LEFT JOIN departments d ON s.department_id = d.id
LEFT JOIN teams t ON s.team_id = t.id
WHERE u.is_archived = 0;

-- ==================================================
-- INDEXES FÜR BESSERE PERFORMANCE
-- ==================================================

-- Zusätzliche Indexes für häufige Abfragen
CREATE INDEX idx_shifts_date_plan ON shifts(date, plan_id);
CREATE INDEX idx_shifts_template ON shifts(template_id);
CREATE INDEX idx_assignments_user_shift ON shift_assignments(user_id, shift_id);
CREATE INDEX idx_availability_user_date ON employee_availability(user_id, date);
CREATE INDEX idx_exchange_requester ON shift_exchange_requests(requester_id, status);
CREATE INDEX idx_overtime_user_date ON overtime_records(user_id, date);
CREATE INDEX idx_absences_user_dates ON absences(user_id, start_date, end_date);

-- ==================================================
-- MIGRATION COMPLETE
-- ==================================================
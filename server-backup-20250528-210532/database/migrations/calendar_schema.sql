-- Calendar System Tables
-- Migration created on 2025-05-22

-- Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,
  org_level ENUM('company', 'department', 'team') NOT NULL,
  org_id INT NOT NULL,  -- ID der Firma, Abteilung oder des Teams
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status ENUM('active', 'cancelled') DEFAULT 'active',
  reminder_time INT,  -- Minuten vor Event für Erinnerung
  color VARCHAR(20) DEFAULT '#3498db',  -- Event-Farbe für UI-Darstellung
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (tenant_id),
  INDEX (org_level, org_id),
  INDEX (start_time, end_time),
  INDEX (status)
);

-- Calendar Attendees Table
CREATE TABLE IF NOT EXISTS calendar_attendees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  response_status ENUM('pending', 'accepted', 'declined', 'tentative') DEFAULT 'pending',
  responded_at TIMESTAMP NULL,
  notification_sent BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY (event_id, user_id),
  INDEX (user_id)
);

-- Calendar Reminders Table (für zukünftige Benachrichtigungserweiterungen)
CREATE TABLE IF NOT EXISTS calendar_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  remind_time DATETIME NOT NULL,
  is_sent BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
  INDEX (remind_time),
  INDEX (is_sent)
);

-- Calendar Recurring Rules Table (für wiederkehrende Termine)
CREATE TABLE IF NOT EXISTS calendar_recurring_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  frequency ENUM('daily', 'weekly', 'monthly', 'yearly') NOT NULL,
  interval_value INT DEFAULT 1,
  weekdays VARCHAR(20),  -- CSV der Wochentage (1-7)
  month_day INT,         -- Spezifischer Tag im Monat
  end_date DATE,         -- Enddatum der Wiederholung
  count INT,             -- Anzahl der Wiederholungen
  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
);
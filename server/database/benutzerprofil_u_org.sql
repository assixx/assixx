-- Neue Felder zur users Tabelle hinzufügen !! nur in USERS
ALTER TABLE users 
ADD COLUMN department_id INT,
ADD COLUMN position VARCHAR(100),
ADD COLUMN phone VARCHAR(20),
ADD COLUMN profile_picture VARCHAR(255),
ADD COLUMN address TEXT,
ADD COLUMN birthday DATE,
ADD COLUMN hire_date DATE,
ADD COLUMN emergency_contact TEXT,
ADD COLUMN editable_fields JSON,
ADD FOREIGN KEY (department_id) REFERENCES departments(id);

-- Neue Tabelle für Abteilungen erstellen
CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  manager_id INT,
  parent_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- Tabelle für Teams erstellen
CREATE TABLE teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  department_id INT,
  leader_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Zuordnungstabelle für Benutzer zu Teams
CREATE TABLE user_teams (
  user_id INT NOT NULL,
  team_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, team_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);
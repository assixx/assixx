-- Survey Schema for Assixx Platform
-- This schema supports creating surveys with multiple question types,
-- collecting responses, and analyzing results

-- Main surveys table
CREATE TABLE IF NOT EXISTS surveys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INT NOT NULL,
    status ENUM('draft', 'active', 'closed', 'archived') DEFAULT 'draft',
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_mandatory BOOLEAN DEFAULT FALSE,
    start_date DATETIME,
    end_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_tenant_status (tenant_id, status),
    INDEX idx_dates (start_date, end_date)
);

-- Survey questions
CREATE TABLE IF NOT EXISTS survey_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    survey_id INT NOT NULL,
    question_text TEXT NOT NULL,
    question_type ENUM('multiple_choice', 'single_choice', 'text', 'number', 'rating', 'yes_no', 'date') NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    order_position INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    INDEX idx_survey_order (survey_id, order_position)
);

-- Question options (for multiple choice and single choice questions)
CREATE TABLE IF NOT EXISTS survey_question_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    option_text VARCHAR(500) NOT NULL,
    order_position INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES survey_questions(id) ON DELETE CASCADE,
    INDEX idx_question_order (question_id, order_position)
);

-- Survey responses (one per user per survey)
CREATE TABLE IF NOT EXISTS survey_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    survey_id INT NOT NULL,
    user_id INT,
    anonymous_id VARCHAR(100), -- For anonymous surveys
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    is_complete BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY unique_user_survey (survey_id, user_id),
    INDEX idx_survey_complete (survey_id, is_complete)
);

-- Individual answers to questions
CREATE TABLE IF NOT EXISTS survey_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    response_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_text TEXT, -- For text, number, date answers
    option_id INT, -- For multiple/single choice answers
    answer_number DECIMAL(10,2), -- For number answers
    answer_date DATE, -- For date answers
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES survey_questions(id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES survey_question_options(id) ON DELETE CASCADE,
    INDEX idx_response_question (response_id, question_id)
);

-- Survey assignments (which users/departments should complete the survey)
CREATE TABLE IF NOT EXISTS survey_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    survey_id INT NOT NULL,
    assignment_type ENUM('all_users', 'department', 'team', 'individual') NOT NULL,
    department_id INT,
    team_id INT,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_survey_assignment (survey_id, assignment_type)
);

-- Survey reminders
CREATE TABLE IF NOT EXISTS survey_reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    survey_id INT NOT NULL,
    reminder_date DATETIME NOT NULL,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    INDEX idx_reminder_date (reminder_date, reminder_sent)
);

-- Survey templates (for reusable surveys)
CREATE TABLE IF NOT EXISTS survey_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_data JSON NOT NULL, -- Stores the complete survey structure
    created_by INT NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_tenant_public (tenant_id, is_public)
);

-- Add survey feature to features table if not exists
INSERT INTO features (code, name, description, category, base_price, is_active) 
VALUES (
    'surveys', 
    'Umfrage-Tool', 
    'Umfrage-Tool für Mitarbeiterbefragungen mit anonymen Optionen', 
    'premium',
    29.99,
    1
) ON DUPLICATE KEY UPDATE description = VALUES(description);
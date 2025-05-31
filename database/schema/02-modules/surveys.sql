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
-- Create survey_assignments table for managing survey visibility
CREATE TABLE IF NOT EXISTS survey_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    survey_id INT NOT NULL,
    assignment_type ENUM('all_users', 'department', 'team', 'user') NOT NULL,
    department_id INT DEFAULT NULL,
    team_id INT DEFAULT NULL,
    user_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_survey_id (survey_id),
    INDEX idx_assignment_type (assignment_type),
    INDEX idx_department_id (department_id),
    INDEX idx_team_id (team_id),
    INDEX idx_user_id (user_id),
    
    -- Ensure unique assignments
    UNIQUE KEY unique_assignment (survey_id, assignment_type, department_id, team_id, user_id)
);
-- Add blackboard_system feature to the features table
INSERT INTO features (
    code, 
    name, 
    description, 
    category, 
    base_price,
    is_active
) VALUES (
    'blackboard_system',
    'Blackboard-System',
    'Digitales schwarzes Brett für firmenweite, abteilungs- und teamspezifische Ankündigungen.',
    'premium',
    15.00,
    1
) ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    base_price = VALUES(base_price),
    is_active = VALUES(is_active);

-- Create tenant record if it doesn't exist (for testing)
INSERT IGNORE INTO tenants (id, company_name, subdomain, email, status, current_plan)
VALUES (1, 'Default Tenant', 'default', 'admin@example.com', 'active', 'premium');

-- Create the blackboard_entries table
CREATE TABLE IF NOT EXISTS blackboard_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    org_level ENUM('company', 'department', 'team') NOT NULL,
    org_id INT NOT NULL,
    author_id INT NOT NULL,
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    status ENUM('active', 'archived') DEFAULT 'active',
    requires_confirmation BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create the blackboard_confirmations table
CREATE TABLE IF NOT EXISTS blackboard_confirmations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_id INT NOT NULL,
    user_id INT NOT NULL,
    confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY (entry_id, user_id)
);
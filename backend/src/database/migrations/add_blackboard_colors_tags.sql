-- Add color and tags functionality to blackboard entries
-- Migration: Blackboard Colors and Tags Feature

-- Add color field to blackboard_entries table
ALTER TABLE blackboard_entries 
ADD COLUMN color VARCHAR(20) DEFAULT 'blue' AFTER priority;

-- Create tags table
CREATE TABLE IF NOT EXISTS blackboard_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20) DEFAULT 'blue',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tag_per_tenant (tenant_id, name)
);

-- Create junction table for entry-tag relationships
CREATE TABLE IF NOT EXISTS blackboard_entry_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES blackboard_tags(id) ON DELETE CASCADE,
    UNIQUE KEY unique_entry_tag (entry_id, tag_id)
);

-- Insert some default tags for testing
INSERT IGNORE INTO blackboard_tags (tenant_id, name, color) VALUES
(1, 'Wichtig', 'red'),
(1, 'Info', 'blue'),
(1, 'Wartung', 'orange'),
(1, 'Meeting', 'green'),
(1, 'Sicherheit', 'red'),
(1, 'Event', 'purple'),
(1, 'Update', 'blue'),
(1, 'Deadline', 'red');
-- Create message_status table for tracking read status
CREATE TABLE IF NOT EXISTS message_status (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_message_user (message_id, user_id)
);
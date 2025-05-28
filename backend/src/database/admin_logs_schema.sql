echo "CREATE TABLE admin_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL DEFAULT 'login',
  ip_address VARCHAR(50),
  status ENUM('success', 'failure') NOT NULL DEFAULT 'success',
  details TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_admin_logs_user_id ON admin_logs(user_id);
CREATE INDEX idx_admin_logs_timestamp ON admin_logs(timestamp);" > database/admin_logs_schema.sql
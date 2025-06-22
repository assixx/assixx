-- Create user_sessions table for browser fingerprint validation
CREATE TABLE IF NOT EXISTS user_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  session_id VARCHAR(50) NOT NULL UNIQUE,
  fingerprint TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_sessions_user_id (user_id),
  INDEX idx_user_sessions_session_id (session_id),
  INDEX idx_user_sessions_expires_at (expires_at),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clean up expired sessions automatically
CREATE EVENT IF NOT EXISTS cleanup_expired_sessions
  ON SCHEDULE EVERY 1 HOUR
  DO
    DELETE FROM user_sessions WHERE expires_at < NOW();
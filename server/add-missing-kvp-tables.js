const db = require('./database');

async function addMissingTables() {
  console.log('Adding missing KVP tables...');
  
  // Create kvp_ratings table
  const ratingsTable = `
    CREATE TABLE IF NOT EXISTS kvp_ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      suggestion_id INT NOT NULL,
      user_id INT NOT NULL,
      rating ENUM('1', '2', '3', '4', '5') NOT NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_suggestion (suggestion_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  
  // Create kvp_points table
  const pointsTable = `
    CREATE TABLE IF NOT EXISTS kvp_points (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      suggestion_id INT NOT NULL,
      user_id INT NOT NULL,
      points INT NOT NULL DEFAULT 0,
      reason VARCHAR(255),
      awarded_by INT,
      awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (awarded_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  
  // Create kvp_status_history table
  const statusHistoryTable = `
    CREATE TABLE IF NOT EXISTS kvp_status_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      suggestion_id INT NOT NULL,
      old_status ENUM('pending', 'in_review', 'approved', 'rejected', 'implemented') NOT NULL,
      new_status ENUM('pending', 'in_review', 'approved', 'rejected', 'implemented') NOT NULL,
      changed_by INT NOT NULL,
      change_reason TEXT,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  
  try {
    console.log('Creating kvp_ratings table...');
    await db.query(ratingsTable);
    console.log('✅ kvp_ratings table created successfully');
    
    console.log('Creating kvp_points table...');
    await db.query(pointsTable);
    console.log('✅ kvp_points table created successfully');
    
    console.log('Creating kvp_status_history table...');
    await db.query(statusHistoryTable);
    console.log('✅ kvp_status_history table created successfully');
    
    console.log('\n🎉 All missing KVP tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  }
  
  process.exit(0);
}

addMissingTables();
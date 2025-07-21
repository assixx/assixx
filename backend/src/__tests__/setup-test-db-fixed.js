/**
 * Fixed Setup Test Database for GitHub Actions
 * This script creates the necessary tables for running tests
 */

import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

// Handle both ESM and CommonJS environments
const projectRoot = process.cwd().endsWith("backend")
  ? path.dirname(process.cwd())
  : process.cwd();

async function setupTestDatabase() {
  console.log("Setting up test database...");
  console.log("DB Config:", {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || "3306",
    user: process.env.DB_USER || "assixx_user",
    database: process.env.DB_NAME || "main_test",
  });

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "assixx_user",
    password: process.env.DB_PASSWORD || "AssixxP@ss2025!",
    database: process.env.DB_NAME || "main_test",
    multipleStatements: true,
  });

  try {
    console.log("Connected to MySQL successfully");

    // Disable foreign key checks
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    console.log("Foreign key checks disabled");

    // Drop all existing tables to start fresh
    const [tables] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);

    console.log(`Found ${tables.length} existing tables`);
    for (const table of tables) {
      console.log(`Dropping table: ${table.TABLE_NAME}`);
      await connection.query(`DROP TABLE IF EXISTS \`${table.TABLE_NAME}\``);
    }
    console.log("All tables dropped");

    // Create minimal schema for tests
    const createTablesSQL = `
    -- Tenants table
    CREATE TABLE IF NOT EXISTS tenants (
      id INT PRIMARY KEY AUTO_INCREMENT,
      company_name VARCHAR(255) DEFAULT '', -- Default value for legacy compatibility
      name VARCHAR(255) NOT NULL, -- This is what tests use
      subdomain VARCHAR(100) UNIQUE NOT NULL,
      status ENUM('active', 'inactive', 'trial') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deletion_status VARCHAR(50) DEFAULT 'active',
      deletion_requested_at TIMESTAMP NULL,
      current_plan_id INT NULL
    );

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      username VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      role VARCHAR(50) DEFAULT 'employee',
      department_id INT NULL,
      team_id INT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      status ENUM('active', 'inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_username_tenant (username, tenant_id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    -- Departments table
    CREATE TABLE IF NOT EXISTS departments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    -- Teams table
    CREATE TABLE IF NOT EXISTS teams (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      department_id INT,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    -- User sessions table
    CREATE TABLE IF NOT EXISTS user_sessions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      session_id VARCHAR(255) NOT NULL,
      fingerprint VARCHAR(255),
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Admin logs table
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      action VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Blackboard entries table
    CREATE TABLE IF NOT EXISTS blackboard_entries (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      org_level VARCHAR(50) DEFAULT 'company',
      org_id INT NULL,
      priority VARCHAR(50) DEFAULT 'normal',
      color VARCHAR(50),
      requires_confirmation BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Blackboard confirmations table
    CREATE TABLE IF NOT EXISTS blackboard_confirmations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      entry_id INT NOT NULL,
      user_id INT NOT NULL,
      confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_confirmation (entry_id, user_id)
    );

    -- Documents table
    CREATE TABLE IF NOT EXISTS documents (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      uploaded_by INT NOT NULL,
      category VARCHAR(100),
      upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
    );

    -- KVP Suggestions table
    CREATE TABLE IF NOT EXISTS kvp_suggestions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      submitted_by INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      department_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    -- Shifts table
    CREATE TABLE IF NOT EXISTS shifts (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    -- Calendar events table
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      start_date DATETIME NOT NULL,
      end_date DATETIME,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Messages table (for chat)
    CREATE TABLE IF NOT EXISTS messages (
      id INT PRIMARY KEY AUTO_INCREMENT,
      sender_id INT NOT NULL,
      receiver_id INT,
      conversation_id INT,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Tenant deletion queue table
    CREATE TABLE IF NOT EXISTS tenant_deletion_queue (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      created_by INT NOT NULL,
      reason TEXT,
      status VARCHAR(50) DEFAULT 'queued',
      progress INT DEFAULT 0,
      current_step VARCHAR(100),
      error_message TEXT,
      retry_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Deletion audit trail
    CREATE TABLE IF NOT EXISTS deletion_audit_trail (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      table_name VARCHAR(100) NOT NULL,
      records_deleted INT DEFAULT 0,
      deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Tenant deletion log
    CREATE TABLE IF NOT EXISTS tenant_deletion_log (
      id INT PRIMARY KEY AUTO_INCREMENT,
      queue_id INT NOT NULL,
      step VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (queue_id) REFERENCES tenant_deletion_queue(id) ON DELETE CASCADE
    );
    `;

    // Execute table creation
    console.log("Creating test tables...");
    await connection.query(createTablesSQL);
    console.log("All tables created successfully");

    // Create additional tables that might be needed
    const additionalTablesSQL = `
    -- Blackboard attachments table (referenced in schema)
    CREATE TABLE IF NOT EXISTS blackboard_attachments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      entry_id INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE
    );
    
    -- User availability table
    CREATE TABLE IF NOT EXISTS user_availability (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      date DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'available',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    -- Conversations table (for chat)
    CREATE TABLE IF NOT EXISTS conversations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      name VARCHAR(255),
      is_group BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    
    -- Conversation participants
    CREATE TABLE IF NOT EXISTS conversation_participants (
      id INT PRIMARY KEY AUTO_INCREMENT,
      conversation_id INT NOT NULL,
      user_id INT NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_participant (conversation_id, user_id)
    );
    
    -- Login attempts table (for rate limiting and tracking)
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45),
      success BOOLEAN DEFAULT FALSE,
      attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_username_attempts (username, attempted_at)
    );
    
    -- Password reset tokens table
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_token (token),
      INDEX idx_user_expires (user_id, expires_at)
    );
    `;

    console.log("Creating additional tables...");
    await connection.query(additionalTablesSQL);

    // Create trigger to sync name and company_name
    const createTriggerSQL = `
    CREATE TRIGGER sync_tenant_names
    BEFORE INSERT ON tenants
    FOR EACH ROW
    BEGIN
      IF NEW.company_name = '' OR NEW.company_name IS NULL THEN
        SET NEW.company_name = NEW.name;
      END IF;
      IF NEW.name IS NULL AND NEW.company_name IS NOT NULL AND NEW.company_name != '' THEN
        SET NEW.name = NEW.company_name;
      END IF;
    END;
    `;

    try {
      console.log("Creating sync trigger for tenant names...");
      await connection.query("DROP TRIGGER IF EXISTS sync_tenant_names");
      await connection.query(createTriggerSQL);
    } catch (err) {
      console.log(
        "Trigger creation skipped (might not be supported in test env)",
      );
    }

    // Re-enable foreign key checks
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("Foreign key checks re-enabled");

    // Verify tables were created
    const [createdTables] = await connection.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    console.log(
      `Test database setup completed! Created ${createdTables[0].count} tables`,
    );
  } catch (error) {
    console.error("Error setting up test database:", error);
    console.error("SQL Error Details:", error.sqlMessage || error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith("setup-test-db-fixed.js")) {
  setupTestDatabase();
}

export { setupTestDatabase };

/**
 * Database Mock Utilities for Testing
 * Provides test database setup, cleanup, and helper functions
 */

import bcrypt from "bcryptjs";
import { Application } from "express";
import { Pool, createPool, PoolOptions, ResultSetHeader } from "mysql2/promise";
import request from "supertest";
import { testDataTracker } from "./test-data-tracker";
import { TEST_DATA_PREFIX } from "./test-constants";

// Test database configuration
const TEST_DB_CONFIG: PoolOptions = {
  host: process.env.DB_HOST ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? (process.env.CI ? "3306" : "3307")),
  user: process.env.DB_USER ?? "assixx_user",
  password: process.env.DB_PASSWORD ?? "AssixxP@ss2025!",
  database: process.env.DB_NAME ?? "main",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
};

let testDb: Pool | null = null;

/**
 * Create and initialize test database connection
 */
export async function createTestDatabase(): Promise<Pool> {
  if (testDb) {
    return testDb;
  }

  testDb = createPool(TEST_DB_CONFIG);

  // Initialize database schema if needed
  await initializeSchema(testDb);

  return testDb;
}

/**
 * Initialize database schema for testing
 */
async function initializeSchema(db: Pool): Promise<void> {
  try {
    // Create tables if they don't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        subdomain VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) DEFAULT NULL,
        phone VARCHAR(30) DEFAULT NULL,
        address TEXT,
        status ENUM('trial', 'active', 'suspended', 'cancelled') DEFAULT 'trial',
        trial_ends_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('root', 'admin', 'employee') NOT NULL,
        tenant_id INT NOT NULL,
        department_id INT DEFAULT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(50),
        landline VARCHAR(50),
        position VARCHAR(255),
        profile_picture VARCHAR(255),
        hire_date DATE,
        birthday DATE,
        employee_number VARCHAR(10) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        is_archived BOOLEAN DEFAULT FALSE,
        status ENUM('active', 'inactive') DEFAULT 'active',
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        UNIQUE KEY unique_username_tenant (username, tenant_id),
        UNIQUE KEY unique_email_tenant (email, tenant_id),
        UNIQUE KEY idx_employee_number (employee_number)
      )
    `);

    // Try to add employee_number column if it doesn't exist (for existing tables)
    try {
      await db.execute(`
        ALTER TABLE users ADD COLUMN employee_number VARCHAR(10) NOT NULL
      `);
      await db.execute(`
        ALTER TABLE users ADD UNIQUE KEY idx_employee_number (employee_number)
      `);
    } catch {
      // Column already exists, ignore the error
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        tenant_id INT NOT NULL,
        parent_id INT DEFAULT NULL,
        manager_id INT DEFAULT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        UNIQUE KEY unique_name_tenant (name, tenant_id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        department_id INT DEFAULT NULL,
        tenant_id INT NOT NULL,
        lead_id INT DEFAULT NULL,
        max_members INT DEFAULT 50,
        status ENUM('active', 'inactive') DEFAULT 'active',
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (department_id) REFERENCES departments(id)
      )
    `);

    // Create other necessary tables
    await createAuthTables(db);
    await createBlackboardTables(db);
    await createCalendarTables(db);
    await createKVPTables(db);
    await createShiftTables(db);
    await createChatTables(db);
    await createSurveyTables(db);
    await createDocumentTables(db);
  } catch (error) {
    console.error("Error initializing test database schema:", error);
    throw error;
  }
}

/**
 * Create authentication related tables
 */
async function createAuthTables(db: Pool): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      session_id VARCHAR(255) NOT NULL,
      fingerprint VARCHAR(255),
      expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 30 MINUTE),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_session_id (session_id),
      INDEX idx_user_expires (user_id, expires_at)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45),
      success BOOLEAN DEFAULT FALSE,
      attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_username_attempts (username, attempted_at)
    )
  `);

  // Skip password_reset_tokens table creation if it doesn't exist in production
  // This table was removed due to foreign key issues
  console.log(
    "Skipping password_reset_tokens table creation (removed from production)",
  );

  // Skip oauth_tokens table creation if it doesn't exist in production
  // This table was removed due to foreign key issues
  console.log("Skipping oauth_tokens table creation (removed from production)");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT,
      user_id INT NOT NULL,
      action VARCHAR(255) NOT NULL,
      entity_type VARCHAR(255),
      entity_id INT,
      details TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_user_action (user_id, action),
      INDEX idx_created (created_at)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT,
      user_id INT NOT NULL,
      action VARCHAR(255) NOT NULL,
      entity_type VARCHAR(255),
      entity_id INT,
      details TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_user_action (user_id, action),
      INDEX idx_created (created_at)
    )
  `);
}

/**
 * Create blackboard related tables
 */
async function createBlackboardTables(db: Pool): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS blackboard_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      org_level ENUM('company', 'department', 'team') NOT NULL,
      org_id INT DEFAULT NULL,
      priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
      color VARCHAR(50) DEFAULT 'blue',
      author_id INT NOT NULL,
      tenant_id INT NOT NULL,
      requires_confirmation BOOLEAN DEFAULT FALSE,
      expires_at TIMESTAMP NULL DEFAULT NULL,
      status ENUM('active', 'archived') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (author_id) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS blackboard_confirmations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entry_id INT NOT NULL,
      user_id INT NOT NULL,
      confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tenant_id INT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      UNIQUE KEY unique_entry_user (entry_id, user_id)
    )
  `);
}

/**
 * Create calendar related tables
 */
async function createCalendarTables(db: Pool): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      location VARCHAR(255),
      visibility_scope ENUM('company', 'department', 'team') DEFAULT 'company',
      target_id INT DEFAULT NULL,
      is_all_day BOOLEAN DEFAULT FALSE,
      is_recurring BOOLEAN DEFAULT FALSE,
      reminder_minutes INT DEFAULT NULL,
      color VARCHAR(50) DEFAULT '#2196F3',
      created_by INT NOT NULL,
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS calendar_event_participants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT NOT NULL,
      user_id INT NOT NULL,
      status ENUM('pending', 'accepted', 'declined', 'tentative') DEFAULT 'pending',
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      UNIQUE KEY unique_event_user (event_id, user_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS calendar_recurring_patterns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT NOT NULL,
      frequency ENUM('daily', 'weekly', 'monthly', 'yearly') NOT NULL,
      interval_value INT DEFAULT 1,
      days_of_week VARCHAR(50),
      end_date TIMESTAMP NULL DEFAULT NULL,
      tenant_id INT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      UNIQUE KEY unique_event (event_id)
    )
  `);
}

/**
 * Create KVP related tables
 */
async function createKVPTables(db: Pool): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS kvp_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      color VARCHAR(20) DEFAULT '#3498db',
      icon VARCHAR(10) DEFAULT '💡',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS kvp_suggestions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      category_id INT DEFAULT NULL,
      department_id INT DEFAULT NULL,
      org_level ENUM('company', 'department', 'team') NOT NULL,
      org_id INT NOT NULL,
      submitted_by INT NOT NULL,
      assigned_to INT DEFAULT NULL,
      status ENUM('new', 'in_review', 'approved', 'implemented', 'rejected', 'archived') DEFAULT 'new',
      priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
      expected_benefit TEXT,
      estimated_cost DECIMAL(10,2) DEFAULT NULL,
      actual_savings DECIMAL(10,2) DEFAULT NULL,
      implementation_date DATE DEFAULT NULL,
      rejection_reason TEXT,
      shared_by INT DEFAULT NULL,
      shared_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (submitted_by) REFERENCES users(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (category_id) REFERENCES kvp_categories(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS kvp_votes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      suggestion_id INT NOT NULL,
      user_id INT NOT NULL,
      vote_type ENUM('up', 'down') NOT NULL,
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      UNIQUE KEY unique_user_suggestion (user_id, suggestion_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS kvp_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      suggestion_id INT NOT NULL,
      user_id INT NOT NULL,
      comment TEXT NOT NULL,
      is_internal BOOLEAN DEFAULT FALSE,
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS kvp_ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      suggestion_id INT NOT NULL,
      user_id INT NOT NULL,
      rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      UNIQUE KEY unique_user_suggestion (user_id, suggestion_id)
    )
  `);
}

/**
 * Create shift planning related tables
 */
async function createShiftTables(db: Pool): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS shift_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      duration_minutes INT NOT NULL,
      break_minutes INT DEFAULT 0,
      description TEXT,
      department_id INT DEFAULT NULL,
      tenant_id INT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      is_overnight BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS shift_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      department_id INT DEFAULT NULL,
      tenant_id INT NOT NULL,
      status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
      created_by INT NOT NULL,
      published_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS shift_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      plan_id INT NOT NULL,
      template_id INT NOT NULL,
      user_id INT NOT NULL,
      date DATE NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      tenant_id INT NOT NULL,
      status ENUM('assigned', 'confirmed', 'declined', 'completed') DEFAULT 'assigned',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES shift_templates(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      UNIQUE KEY unique_user_datetime (user_id, date, start_time)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS shift_swap_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      requested_by INT NOT NULL,
      requested_with INT DEFAULT NULL,
      reason TEXT,
      status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
      approved_by INT DEFAULT NULL,
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES shift_assignments(id),
      FOREIGN KEY (requested_by) REFERENCES users(id),
      FOREIGN KEY (requested_with) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `);
}

/**
 * Create chat related tables
 */
async function createChatTables(db: Pool): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_channels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      type ENUM('public', 'private', 'direct') NOT NULL,
      visibility_scope ENUM('company', 'department', 'team') DEFAULT 'company',
      target_id INT DEFAULT NULL,
      created_by INT NOT NULL,
      tenant_id INT NOT NULL,
      is_archived BOOLEAN DEFAULT FALSE,
      archived_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_channel_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      channel_id INT NOT NULL,
      user_id INT NOT NULL,
      role ENUM('member', 'moderator', 'admin') DEFAULT 'member',
      tenant_id INT NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      UNIQUE KEY unique_channel_user (channel_id, user_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      channel_id INT NOT NULL,
      sender_id INT NOT NULL,
      content TEXT NOT NULL,
      type ENUM('text', 'file', 'system') DEFAULT 'text',
      reply_to_id INT DEFAULT NULL,
      is_edited BOOLEAN DEFAULT FALSE,
      edited_at TIMESTAMP NULL DEFAULT NULL,
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      is_pinned BOOLEAN DEFAULT FALSE,
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (channel_id) REFERENCES chat_channels(id),
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (reply_to_id) REFERENCES chat_messages(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_message_read_receipts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message_id INT NOT NULL,
      user_id INT NOT NULL,
      channel_id INT NOT NULL,
      read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tenant_id INT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (channel_id) REFERENCES chat_channels(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      UNIQUE KEY unique_message_user (message_id, user_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_message_reactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message_id INT NOT NULL,
      user_id INT NOT NULL,
      emoji VARCHAR(10) NOT NULL,
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      UNIQUE KEY unique_message_user_emoji (message_id, user_id, emoji)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_message_edits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message_id INT NOT NULL,
      previous_content TEXT NOT NULL,
      edited_by INT NOT NULL,
      edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tenant_id INT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (edited_by) REFERENCES users(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `);
}

/**
 * Create survey related tables
 */
async function createSurveyTables(db: Pool): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS surveys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      type ENUM('feedback', 'assessment', 'poll', 'custom') NOT NULL,
      visibility_scope ENUM('company', 'department', 'team') DEFAULT 'company',
      target_id INT DEFAULT NULL,
      status ENUM('draft', 'active', 'completed', 'archived') DEFAULT 'draft',
      start_date TIMESTAMP NULL DEFAULT NULL,
      end_date TIMESTAMP NULL DEFAULT NULL,
      is_anonymous BOOLEAN DEFAULT FALSE,
      created_by INT NOT NULL,
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS survey_questions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      survey_id INT NOT NULL,
      question_text TEXT NOT NULL,
      question_type ENUM('text', 'scale', 'single_choice', 'multiple_choice', 'yes_no') NOT NULL,
      required BOOLEAN DEFAULT TRUE,
      order_position INT NOT NULL,
      options JSON,
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS survey_responses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      survey_id INT NOT NULL,
      user_id INT NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL DEFAULT NULL,
      is_anonymous BOOLEAN DEFAULT FALSE,
      tenant_id INT NOT NULL,
      FOREIGN KEY (survey_id) REFERENCES surveys(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      UNIQUE KEY unique_survey_user (survey_id, user_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS survey_answers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      response_id INT NOT NULL,
      question_id INT NOT NULL,
      answer_value JSON NOT NULL,
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES survey_questions(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      UNIQUE KEY unique_response_question (response_id, question_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS survey_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      template_data JSON NOT NULL,
      is_public BOOLEAN DEFAULT FALSE,
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `);
}

/**
 * Create document related tables
 */
async function createDocumentTables(db: Pool): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size BIGINT NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      category VARCHAR(100) NOT NULL,
      description TEXT,
      uploaded_by INT NOT NULL,
      tenant_id INT NOT NULL,
      visibility_scope ENUM('private', 'department', 'company') DEFAULT 'company',
      target_id INT DEFAULT NULL,
      is_public BOOLEAN DEFAULT FALSE,
      download_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS document_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_id INT NOT NULL,
      user_id INT DEFAULT NULL,
      department_id INT DEFAULT NULL,
      team_id INT DEFAULT NULL,
      permission_type ENUM('view', 'download', 'edit', 'delete') NOT NULL,
      tenant_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `);
}

/**
 * Clean up test data after tests
 */
export async function cleanupTestData(): Promise<void> {
  if (!testDb) return;

  try {
    console.log(`Cleaning up test data with prefix: ${TEST_DATA_PREFIX}`);

    // WICHTIG: Foreign Keys deaktivieren für vollständiges Cleanup
    await testDb.execute("SET FOREIGN_KEY_CHECKS = 0");

    // Get test tenant IDs based on PREFIX
    const testTenantQuery = `(SELECT id FROM tenants WHERE subdomain LIKE '${TEST_DATA_PREFIX}%' OR company_name LIKE '${TEST_DATA_PREFIX}%')`;

    // Delete all data associated with test tenants
    await testDb.execute(
      `DELETE FROM survey_answers WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM survey_responses WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM survey_questions WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM surveys WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM survey_templates WHERE tenant_id IN ${testTenantQuery}`,
    );

    await testDb.execute(
      `DELETE FROM chat_message_edits WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM chat_message_reactions WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM chat_message_read_receipts WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM chat_messages WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM chat_channel_members WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM chat_channels WHERE tenant_id IN ${testTenantQuery}`,
    );

    await testDb.execute(
      `DELETE FROM shift_swap_requests WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM shift_assignments WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM shift_plans WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM shift_templates WHERE tenant_id IN ${testTenantQuery}`,
    );

    await testDb.execute(
      `DELETE FROM kvp_comments WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM kvp_votes WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM kvp_suggestions WHERE tenant_id IN ${testTenantQuery}`,
    );

    await testDb.execute(
      `DELETE FROM calendar_recurring_patterns WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM calendar_event_participants WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM calendar_events WHERE tenant_id IN ${testTenantQuery}`,
    );

    await testDb.execute(
      `DELETE FROM blackboard_confirmations WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM blackboard_entries WHERE tenant_id IN ${testTenantQuery}`,
    );

    await testDb.execute(
      `DELETE FROM document_permissions WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM documents WHERE tenant_id IN ${testTenantQuery}`,
    );

    await testDb.execute(
      `DELETE FROM activity_logs WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM admin_logs WHERE tenant_id IN ${testTenantQuery}`,
    );

    // Delete user-specific data with PREFIX
    await testDb.execute(
      `DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE username LIKE '${TEST_DATA_PREFIX}%' OR email LIKE '${TEST_DATA_PREFIX}%')`,
    );
    await testDb.execute(
      `DELETE FROM login_attempts WHERE username LIKE '${TEST_DATA_PREFIX}%'`,
    );

    // Delete core entities with PREFIX
    await testDb.execute(
      `DELETE FROM users WHERE username LIKE '${TEST_DATA_PREFIX}%' OR email LIKE '${TEST_DATA_PREFIX}%'`,
    );
    await testDb.execute(
      `DELETE FROM teams WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM departments WHERE tenant_id IN ${testTenantQuery}`,
    );
    await testDb.execute(
      `DELETE FROM tenants WHERE subdomain LIKE '${TEST_DATA_PREFIX}%' OR company_name LIKE '${TEST_DATA_PREFIX}%'`,
    );

    // Clear tracker
    testDataTracker.clear();

    // Foreign Keys wieder aktivieren
    await testDb.execute("SET FOREIGN_KEY_CHECKS = 1");

    console.log("Test data cleanup completed");

    await testDb.end();
    testDb = null;
  } catch (error) {
    console.error("Error cleaning up test data:", error);
    // Versuche Foreign Keys wieder zu aktivieren, auch bei Fehler
    try {
      await testDb?.execute("SET FOREIGN_KEY_CHECKS = 1");
    } catch {}
  }
}

/**
 * Create a test tenant
 */
export async function createTestTenant(
  db: Pool,
  subdomain: string,
  name: string,
): Promise<number> {
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000);
  // Add TEST_DATA_PREFIX to ensure safe cleanup
  const uniqueSubdomain = `${TEST_DATA_PREFIX}${subdomain}_${timestamp}_${randomSuffix}`;
  const uniqueName = `${TEST_DATA_PREFIX}${name}`;

  // Try to handle both 'name' and 'company_name' field variations
  try {
    // First try with company_name (production schema)
    const [result] = await db.execute(
      "INSERT INTO tenants (subdomain, company_name, status) VALUES (?, ?, ?)",
      [uniqueSubdomain, uniqueName, "active"],
    );
    const tenantId = (result as ResultSetHeader).insertId;
    testDataTracker.trackTenant(tenantId); // Track created tenant
    return tenantId;
  } catch (err: unknown) {
    // If it fails, try with 'name' field (GitHub Actions schema)
    const error = err as Error;
    if (
      error.message?.includes("Unknown column 'company_name'") ||
      error.message?.includes("Field 'name' doesn't have a default value")
    ) {
      const [result] = await db.execute(
        "INSERT INTO tenants (subdomain, name, status) VALUES (?, ?, ?)",
        [uniqueSubdomain, uniqueName, "active"],
      );
      const tenantId = (result as ResultSetHeader).insertId;
      testDataTracker.trackTenant(tenantId); // Track created tenant
      return tenantId;
    }
    throw err;
  }
}

/**
 * Create a test user
 */
export async function createTestUser(
  db: Pool,
  userData: {
    username: string;
    email: string;
    password: string;
    role: "root" | "admin" | "employee";
    tenant_id: number;
    department_id?: number;
    first_name?: string;
    last_name?: string;
    status?: "active" | "inactive";
  },
): Promise<{ id: number; username: string; email: string }> {
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  // For auth tests, we need predictable emails
  const isAuthTest = userData.email.includes("@authtest");
  const isRootUser =
    userData.role === "root" && userData.email === "root@system.de";
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000);

  // Add TEST_DATA_PREFIX to ALL test users for safe cleanup
  let uniqueUsername: string;
  let uniqueEmail: string;

  if (
    isAuthTest &&
    (userData.username === "testuser1@authtest1.de" ||
      userData.username === "testuser2@authtest2.de")
  ) {
    // Auth test users need predictable names but with prefix
    uniqueUsername = `${TEST_DATA_PREFIX}${userData.username}`;
    uniqueEmail = `${TEST_DATA_PREFIX}${userData.email}`;
  } else if (isRootUser) {
    // Root user gets prefix but no suffix
    uniqueUsername = `${TEST_DATA_PREFIX}${userData.username}`;
    uniqueEmail = `${TEST_DATA_PREFIX}${userData.email}`;
  } else {
    // Other users get prefix AND suffix
    uniqueUsername = `${TEST_DATA_PREFIX}${userData.username}_${timestamp}_${randomSuffix}`;
    uniqueEmail = `${TEST_DATA_PREFIX}${userData.email.replace("@", `_${timestamp}_${randomSuffix}@`)}`;
  }

  // Generate unique employee number
  const employeeNumber = String(100000 + Math.floor(Math.random() * 899999));

  try {
    const [result] = await db.execute(
      `INSERT INTO users 
      (username, email, password, role, tenant_id, department_id, first_name, last_name, status, employee_number) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uniqueUsername,
        uniqueEmail,
        hashedPassword,
        userData.role,
        userData.tenant_id,
        userData.department_id ?? null,
        userData.first_name ?? userData.username,
        userData.last_name ?? "User",
        userData.status ?? "active",
        employeeNumber,
      ],
    );
    const userId = (result as ResultSetHeader).insertId;
    testDataTracker.trackUser(userId); // Track created user
    return {
      id: userId,
      username: uniqueUsername,
      email: uniqueEmail,
    };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message?.includes("Unknown column 'employee_number'")) {
      // Fallback for environments where the column does not exist
      const [result] = await db.execute(
        `INSERT INTO users 
        (username, email, password, role, tenant_id, department_id, first_name, last_name, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uniqueUsername,
          uniqueEmail,
          hashedPassword,
          userData.role,
          userData.tenant_id,
          userData.department_id ?? null,
          userData.first_name ?? userData.username,
          userData.last_name ?? "User",
          userData.status ?? "active",
        ],
      );
      const userId = (result as ResultSetHeader).insertId;
      testDataTracker.trackUser(userId); // Track created user
      return {
        id: userId,
        username: uniqueUsername,
        email: uniqueEmail,
      };
    }
    throw err;
  }
}

/**
 * Create a test department
 */
export async function createTestDepartment(
  db: Pool,
  tenantId: number,
  name: string,
  parentId?: number,
): Promise<number> {
  const [result] = await db.execute(
    "INSERT INTO departments (name, tenant_id, parent_id) VALUES (?, ?, ?)",
    [name, tenantId, parentId ?? null],
  );
  const deptId = (result as ResultSetHeader).insertId;
  testDataTracker.trackDepartment(deptId); // Track created department
  return deptId;
}

/**
 * Create a test team
 */
export async function createTestTeam(
  db: Pool,
  tenantId: number,
  departmentId: number | null,
  name: string,
): Promise<number> {
  const [result] = await db.execute(
    "INSERT INTO teams (name, department_id, tenant_id) VALUES (?, ?, ?)",
    [name, departmentId, tenantId],
  );
  const teamId = (result as ResultSetHeader).insertId;
  testDataTracker.trackTeam(teamId); // Track created team
  return teamId;
}

/**
 * Get authentication token for a user
 */
export async function getAuthToken(
  app: Application,
  username: string,
  password: string,
): Promise<string> {
  const response = await request(app)
    .post("/api/auth/login")
    .send({
      username,
      password,
      fingerprint: "test-fingerprint-" + username,
    });

  if (response.status !== 200) {
    console.error("Login failed:", {
      status: response.status,
      body: response.body,
      username,
    });
    throw new Error(
      `Failed to get auth token for ${username}: ${response.body.message ?? JSON.stringify(response.body)}`,
    );
  }

  return response.body.data.token;
}

/**
 * Create test file upload
 */
export async function createTestFile(
  filename: string,
  content: string | Buffer,
  mimeType: string = "text/plain",
): Promise<{ buffer: Buffer; originalname: string; mimetype: string }> {
  const buffer = typeof content === "string" ? Buffer.from(content) : content;

  return {
    buffer,
    originalname: filename,
    mimetype: mimeType,
  };
}

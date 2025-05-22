/**
 * KVP Database Migration Script
 * Executes the KVP schema creation
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigration() {
  console.log('Starting KVP database migration...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lohnabrechnung',
    multipleStatements: true
  });

  try {
    // Execute migrations step by step
    console.log('Creating KVP Categories table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kvp_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        color VARCHAR(20) DEFAULT '#3498db',
        icon VARCHAR(50) DEFAULT '💡',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (tenant_id),
        UNIQUE KEY (tenant_id, name)
      )
    `);
    
    console.log('Creating KVP Suggestions table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kvp_suggestions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category_id INT,
        org_level ENUM('company', 'department', 'team') NOT NULL,
        org_id INT NOT NULL,
        submitted_by INT NOT NULL,
        assigned_to INT NULL,
        status ENUM('new', 'in_review', 'in_progress', 'implemented', 'rejected') DEFAULT 'new',
        priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
        expected_benefit TEXT,
        estimated_cost DECIMAL(10,2) NULL,
        actual_savings DECIMAL(10,2) NULL,
        implementation_date DATE NULL,
        rejection_reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES kvp_categories(id) ON DELETE SET NULL,
        INDEX (tenant_id),
        INDEX (org_level, org_id),
        INDEX (status),
        INDEX (submitted_by),
        INDEX (assigned_to)
      )
    `);
    
    console.log('Creating KVP Attachments table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kvp_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        suggestion_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INT NOT NULL,
        uploaded_by INT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
        INDEX (suggestion_id)
      )
    `);
    
    console.log('Creating KVP Comments table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kvp_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        suggestion_id INT NOT NULL,
        user_id INT NOT NULL,
        comment TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
        INDEX (suggestion_id),
        INDEX (user_id)
      )
    `);
    
    console.log('Inserting default KVP categories...');
    await connection.execute(`
      INSERT IGNORE INTO kvp_categories (tenant_id, name, description, color, icon) VALUES
      (1, 'Sicherheit', 'Verbesserungen zur Arbeitssicherheit', '#e74c3c', '🛡️'),
      (1, 'Effizienz', 'Prozessoptimierungen und Zeitersparnis', '#2ecc71', '⚡'),
      (1, 'Qualität', 'Qualitätsverbesserungen und Fehlervermeidung', '#3498db', '⭐'),
      (1, 'Umwelt', 'Umweltfreundliche Verbesserungen', '#27ae60', '🌱'),
      (1, 'Ergonomie', 'Arbeitsplatzverbesserungen', '#9b59b6', '👤'),
      (1, 'Kosteneinsparung', 'Maßnahmen zur Kostenreduzierung', '#f39c12', '💰')
    `);
    
    console.log('✅ KVP schema migration completed successfully!');
    
    // Add KVP feature to features table
    console.log('Adding KVP feature...');
    await connection.execute(`
      INSERT IGNORE INTO features (code, name, description, category, base_price) VALUES
      ('kvp_system', 'KVP System', 'Kontinuierlicher Verbesserungsprozess - Mitarbeiter können Verbesserungsvorschläge einreichen', 'premium', 25.00)
    `);
    
    // Enable KVP for default tenant
    await connection.execute(`
      INSERT IGNORE INTO tenant_features (tenant_id, feature_id, status, valid_from, valid_until)
      SELECT 1, f.id, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR)
      FROM features f
      WHERE f.code = 'kvp_system'
    `);
    
    console.log('✅ KVP feature activated successfully!');
    
    // Check what was created
    const [tables] = await connection.execute(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = ? AND table_name LIKE 'kvp_%'
    `, [process.env.DB_NAME]);
    
    console.log('📊 Created KVP tables:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    const [categories] = await connection.execute('SELECT COUNT(*) as count FROM kvp_categories');
    console.log(`📂 Created ${categories[0].count} default categories`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('🎉 KVP system is ready to use!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  });
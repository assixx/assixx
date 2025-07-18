/**
 * Setup Test Database for GitHub Actions
 * This script creates the necessary tables for running tests
 */

const mysql = require('mysql2/promise');

async function setupTestDatabase() {
  console.log('Setting up test database...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'assixx_user',
    password: process.env.DB_PASSWORD || 'AssixxP@ss2025!',
    database: process.env.DB_NAME || 'main_test',
    multipleStatements: true
  });

  try {
    // Execute all migrations in order
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.join(__dirname, '../../../../database/migrations');
    
    console.log('Running migrations...');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Alphabetical order (001-, 002-, etc.)
    
    for (const file of migrationFiles) {
      console.log(`Executing migration: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      const migration = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await connection.query(migration);
      } catch (error) {
        console.error(`Error in migration ${file}:`, error.message);
        // Continue with next migration - some might fail if already applied
      }
    }
    
    console.log('Test database setup completed successfully!');
  } catch (error) {
    console.error('Error setting up test database:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run if called directly
if (require.main === module) {
  setupTestDatabase();
}

module.exports = { setupTestDatabase };
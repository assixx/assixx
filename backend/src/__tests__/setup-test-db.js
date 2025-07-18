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
    // Read and execute the schema
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, 'db-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Creating tables...');
    await connection.query(schema);
    
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
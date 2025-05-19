const db = require('../database');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

async function updateDepartmentsTable() {
  try {
    logger.info('Starting departments table update...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../database/update_departments_table.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    // Split into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      logger.info(`Executing: ${statement.substring(0, 50)}...`);
      await db.query(statement);
    }
    
    logger.info('Departments table updated successfully!');
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      logger.info('Columns already exist - database is up to date');
      process.exit(0);
    } else {
      logger.error(`Error updating departments table: ${error.message}`);
      process.exit(1);
    }
  }
}

updateDepartmentsTable();
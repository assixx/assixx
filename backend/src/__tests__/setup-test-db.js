/**
 * Setup Test Database for GitHub Actions
 * This script creates the necessary tables for running tests
 */

import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

// Handle both ESM and CommonJS environments
// In GitHub Actions, we're in the project root, not in backend directory
const projectRoot = process.cwd().endsWith('backend') 
  ? path.dirname(process.cwd()) 
  : process.cwd();

async function setupTestDatabase() {
  console.log("Setting up test database...");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "assixx_user",
    password: process.env.DB_PASSWORD || "AssixxP@ss2025!",
    database: process.env.DB_NAME || "main_test",
    multipleStatements: true,
  });

  try {

    // First, try to use the current schema export
    const databaseDir = path.join(projectRoot, "database");
    const schemaFiles = fs
      .readdirSync(databaseDir)
      .filter(
        (file) => file.startsWith("current-schema-") && file.endsWith(".sql"),
      )
      .sort()
      .reverse(); // Get the newest first

    if (schemaFiles.length > 0) {
      // Use the most recent schema export
      const currentSchemaPath = path.join(databaseDir, schemaFiles[0]);
      console.log(`Using current schema: ${schemaFiles[0]}`);
      let schema = fs.readFileSync(currentSchemaPath, "utf8");
      
      // Remove problematic view definitions that are incomplete
      // These appear between "SET @saved_cs_client" and "SET character_set_client = @saved_cs_client;"
      schema = schema.replace(/SET @saved_cs_client[\s\S]*?SET character_set_client = @saved_cs_client;/g, '');
      
      // Remove DELIMITER statements and handle stored procedures/triggers
      schema = schema.replace(/DELIMITER\s+.*$/gm, '');
      schema = schema.replace(/\$\$/g, ';');
      schema = schema.replace(/\/\*/g, ';');
      
      // Split by semicolon and filter out empty statements
      const statements = schema.split(';').filter(stmt => stmt.trim());
      
      // Disable foreign key checks temporarily to avoid order dependencies
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      
      // Execute each statement separately
      for (const statement of statements) {
        const trimmedStmt = statement.trim();
        if (trimmedStmt && !trimmedStmt.includes('1 AS `')) {
          try {
            await connection.query(trimmedStmt);
          } catch (error) {
            console.error(`Error executing statement: ${trimmedStmt.substring(0, 100)}...`);
            console.error(`Error: ${error.message}`);
          }
        }
      }
      
      // Now create the views from the proper view definitions
      const viewsPath = path.join(databaseDir, 'schema/03-views/views.sql');
      if (fs.existsSync(viewsPath)) {
        console.log('Creating database views...');
        const viewsSQL = fs.readFileSync(viewsPath, 'utf8');
        const viewStatements = viewsSQL.split(';').filter(stmt => stmt.trim());
        
        for (const viewStmt of viewStatements) {
          const trimmedView = viewStmt.trim();
          if (trimmedView && (trimmedView.includes('CREATE VIEW') || trimmedView.includes('CREATE OR REPLACE VIEW'))) {
            try {
              await connection.query(trimmedView);
            } catch (error) {
              console.error(`Error creating view: ${error.message}`);
            }
          }
        }
      }
      
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } else {
      // Fallback to migrations if no schema export exists
      console.log("No current schema found, falling back to migrations...");
      const migrationsDir = path.join(databaseDir, "migrations");
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .sort();

      for (const file of migrationFiles) {
        console.log(`Executing migration: ${file}`);
        const migrationPath = path.join(migrationsDir, file);
        const migration = fs.readFileSync(migrationPath, "utf8");

        try {
          await connection.query(migration);
        } catch (error) {
          console.error(`Error in migration ${file}:`, error.message);
        }
      }
    }

    console.log("Test database setup completed successfully!");
  } catch (error) {
    console.error("Error setting up test database:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('setup-test-db.js')) {
  setupTestDatabase();
}

export { setupTestDatabase };

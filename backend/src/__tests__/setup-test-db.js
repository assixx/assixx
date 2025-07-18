/**
 * Setup Test Database for GitHub Actions
 * This script creates the necessary tables for running tests
 */

import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const databaseDir = path.join(__dirname, "../../../database");
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
      const schema = fs.readFileSync(currentSchemaPath, "utf8");
      await connection.query(schema);
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

if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestDatabase();
}

export { setupTestDatabase };

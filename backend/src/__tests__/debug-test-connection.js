#!/usr/bin/env node

import mysql from "mysql2/promise";

async function testConnection() {
  console.log("Testing database connection...");
  console.log("Environment variables:");
  console.log("DB_HOST:", process.env.DB_HOST || "localhost");
  console.log("DB_PORT:", process.env.DB_PORT || "3306");
  console.log("DB_USER:", process.env.DB_USER || "assixx_user");
  console.log("DB_NAME:", process.env.DB_NAME || "main_test");
  console.log("NODE_ENV:", process.env.NODE_ENV);

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER || "assixx_user",
      password: process.env.DB_PASSWORD || "AssixxP@ss2025!",
      database: process.env.DB_NAME || "main_test",
    });

    console.log("✅ Connection successful!");

    // Test query
    const [rows] = await connection.query("SELECT 1 as test");
    console.log("✅ Test query successful:", rows);

    // Check if tables exist
    const [tables] = await connection.query("SHOW TABLES");
    console.log(`✅ Found ${tables.length} tables in database`);

    // Check specific test tables
    const testTables = ["tenants", "users", "departments", "teams"];
    for (const table of testTables) {
      const [result] = await connection.query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
        [process.env.DB_NAME || "main_test", table],
      );
      console.log(
        `Table ${table}: ${result[0].count > 0 ? "✅ exists" : "❌ missing"}`,
      );
    }

    await connection.end();
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

testConnection();

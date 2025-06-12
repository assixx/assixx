#!/usr/bin/env node

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'mysql',
    user: process.env.DB_USER || 'assixx_user',
    password: process.env.DB_PASSWORD || 'AssixxP@ss2025!',
    database: process.env.DB_NAME || 'assixx',
    multipleStatements: true,
  });

  try {
    const migrationPath = path.join(
      __dirname,
      '../../../../database/migrations/003-add-plans-system.sql'
    );
    const migration = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration: 003-add-plans-system.sql');

    await connection.query(migration);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);

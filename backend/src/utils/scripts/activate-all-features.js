#!/usr/bin/env node

// Script to activate all features for a tenant
// Usage: node activate-all-features.js <tenant_id>

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

async function activateAllFeatures(tenantId) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'assixx_user',
    password: process.env.DB_PASSWORD || 'AssixxP@ss2025!',
    database: process.env.DB_NAME || 'assixx',
    port: process.env.DB_PORT || 3307
  });

  try {
    // Get all available features
    const [features] = await connection.execute(
      'SELECT id, code, name FROM features WHERE is_active = true'
    );

    console.log(`Found ${features.length} features to activate`);

    // Activate each feature for the tenant
    for (const feature of features) {
      // Check if already exists
      const [existing] = await connection.execute(
        'SELECT id FROM tenant_features WHERE tenant_id = ? AND feature_id = ?',
        [tenantId, feature.id]
      );

      if (existing.length > 0) {
        // Update existing
        await connection.execute(
          `UPDATE tenant_features 
           SET is_active = TRUE, 
               expires_at = NULL,
               updated_at = NOW()
           WHERE tenant_id = ? AND feature_id = ?`,
          [tenantId, feature.id]
        );
        console.log(`✓ Updated feature: ${feature.name} (${feature.code})`);
      } else {
        // Insert new
        await connection.execute(
          `INSERT INTO tenant_features 
           (tenant_id, feature_id, is_active, activated_at, expires_at)
           VALUES (?, ?, TRUE, NOW(), NULL)`,
          [tenantId, feature.id]
        );
        console.log(`✓ Activated feature: ${feature.name} (${feature.code})`);
      }
    }

    console.log('\n✅ All features activated successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

// Get tenant ID from command line
const tenantId = process.argv[2];

if (!tenantId) {
  console.error('Usage: node activate-all-features.js <tenant_id>');
  console.error('Example: node activate-all-features.js 1');
  process.exit(1);
}

activateAllFeatures(parseInt(tenantId, 10));
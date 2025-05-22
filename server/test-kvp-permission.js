/**
 * Test KVP Permission Direct
 */

const mysql = require('mysql2/promise');
const Feature = require('./models/feature');
require('dotenv').config();

async function testKVPPermission() {
  console.log('Testing KVP permission directly...');
  
  try {
    // Test direct access for demo tenant (ID 2)
    const hasAccess = await Feature.checkTenantAccess(2, 'kvp_system');
    console.log('Demo tenant (ID 2) has KVP access:', hasAccess);
    
    // Test direct access for default tenant (ID 1)
    const hasAccessDefault = await Feature.checkTenantAccess(1, 'kvp_system');
    console.log('Default tenant (ID 1) has KVP access:', hasAccessDefault);
    
    // Show raw query result
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'lohnabrechnung'
    });
    
    const [results] = await connection.execute(`
      SELECT tf.*, f.code, f.name 
      FROM tenant_features tf
      JOIN features f ON tf.feature_id = f.id
      WHERE tf.tenant_id = 2
      AND f.code = 'kvp_system'
      AND tf.status = 'active'
      AND (tf.valid_until IS NULL OR tf.valid_until >= CURDATE())
    `);
    
    console.log('Raw query result for demo tenant:', results);
    
    await connection.end();
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testKVPPermission();
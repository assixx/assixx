/**
 * Debug Tenant Information
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugTenant() {
  console.log('Debugging tenant information...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lohnabrechnung'
  });

  try {
    // Check user
    const [users] = await connection.execute("SELECT id, username, role FROM users WHERE username = 'MaxMustermann32643'");
    console.log('User:', users[0]);
    
    // Check all tenants
    const [tenants] = await connection.execute('SELECT * FROM tenants');
    console.log('All tenants:', tenants);
    
    // Check tenant features for demo tenant
    const [features] = await connection.execute(`
      SELECT tf.*, f.code, f.name, t.subdomain
      FROM tenant_features tf
      JOIN features f ON tf.feature_id = f.id
      JOIN tenants t ON tf.tenant_id = t.id
      WHERE t.subdomain = 'demo' AND f.code = 'kvp_system'
    `);
    console.log('KVP feature for demo tenant:', features);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

debugTenant();
/**
 * Fix KVP Feature Permissions
 * Enable KVP for all tenants
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixKVPPermissions() {
  console.log('Fixing KVP permissions...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lohnabrechnung'
  });

  try {
    // Check existing tenants
    console.log('1. Checking existing tenants...');
    const [tenants] = await connection.execute('SELECT * FROM tenants');
    console.log('Found tenants:', tenants.map(t => `${t.id}: ${t.subdomain}`));
    
    // Check KVP feature
    console.log('\n2. Checking KVP feature...');
    const [features] = await connection.execute("SELECT * FROM features WHERE code = 'kvp_system'");
    console.log('KVP feature:', features[0] || 'NOT FOUND');
    
    if (features.length === 0) {
      console.log('Creating KVP feature...');
      await connection.execute(`
        INSERT INTO features (code, name, description, category, base_price) VALUES
        ('kvp_system', 'KVP System', 'Kontinuierlicher Verbesserungsprozess', 'premium', 25.00)
      `);
    }
    
    // Get feature ID
    const [kvpFeature] = await connection.execute("SELECT id FROM features WHERE code = 'kvp_system'");
    const featureId = kvpFeature[0].id;
    
    // Enable KVP for ALL tenants
    console.log('\n3. Enabling KVP for all tenants...');
    for (const tenant of tenants) {
      await connection.execute(`
        INSERT IGNORE INTO tenant_features (tenant_id, feature_id, status, valid_from, valid_until)
        VALUES (?, ?, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR))
      `, [tenant.id, featureId]);
      
      console.log(`✅ KVP enabled for tenant ${tenant.id} (${tenant.subdomain})`);
    }
    
    // Check current permissions
    console.log('\n4. Current KVP permissions:');
    const [permissions] = await connection.execute(`
      SELECT tf.tenant_id, t.subdomain, tf.status, tf.valid_from, tf.valid_until
      FROM tenant_features tf
      JOIN tenants t ON tf.tenant_id = t.id
      JOIN features f ON tf.feature_id = f.id
      WHERE f.code = 'kvp_system'
    `);
    
    permissions.forEach(p => {
      console.log(`  Tenant ${p.tenant_id} (${p.subdomain}): ${p.status} until ${p.valid_until}`);
    });
    
    console.log('\n🎉 KVP permissions fixed for all tenants!');
    
  } catch (error) {
    console.error('❌ Error fixing permissions:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the fix
fixKVPPermissions()
  .then(() => {
    console.log('\n✅ All done! KVP should work now.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fix failed:', error.message);
    process.exit(1);
  });
const Feature = require('./models/feature');
const db = require('./database');

async function debugFeatureCheck() {
  console.log('Debugging Feature Check...');
  
  // Test direct database query
  const query = `
    SELECT tf.*, f.code, f.name 
    FROM tenant_features tf
    JOIN features f ON tf.feature_id = f.id
    WHERE tf.tenant_id = ? 
    AND f.code = ?
    AND tf.status = 'active'
    AND (tf.valid_until IS NULL OR tf.valid_until >= CURDATE())
  `;
  
  const [results] = await db.query(query, [2, 'kvp_system']);
  console.log('Direct DB Query Result:', results);
  
  // Test Feature.checkTenantAccess method
  const hasAccess = await Feature.checkTenantAccess(2, 'kvp_system');
  console.log('Feature.checkTenantAccess(2, "kvp_system"):', hasAccess);
  
  // Test with kvp instead of kvp_system
  const hasAccess2 = await Feature.checkTenantAccess(2, 'kvp');
  console.log('Feature.checkTenantAccess(2, "kvp"):', hasAccess2);
  
  // Check what features exist
  const [allFeatures] = await db.query('SELECT * FROM features WHERE code LIKE "%kvp%"');
  console.log('All KVP-related features:', allFeatures);
  
  process.exit(0);
}

debugFeatureCheck().catch(console.error);
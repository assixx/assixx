const db = require('./database');

async function checkRootTenant() {
  try {
    // Get tenant info for root user
    const [users] = await db.query(`
      SELECT u.*, t.company_name, t.subdomain 
      FROM users u 
      JOIN tenants t ON u.tenant_id = t.id 
      WHERE u.email = 'info@scs-technik.de'
    `);
    
    if (users.length > 0) {
      console.log('Root user tenant info:');
      console.log('- Tenant ID:', users[0].tenant_id);
      console.log('- Company:', users[0].company_name);
      console.log('- Subdomain:', users[0].subdomain);
    } else {
      console.log('Root user not found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit();
}

checkRootTenant();
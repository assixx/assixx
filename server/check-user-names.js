const db = require('./database');

async function checkUserNames() {
  console.log('Checking user names in database...\n');
  
  try {
    // Check users without names
    const [users] = await db.query(`
      SELECT id, username, first_name, last_name, role, tenant_id
      FROM users
      WHERE tenant_id = 3
      ORDER BY id
    `);
    
    console.log('Users in tenant 3:');
    users.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, First: ${user.first_name || 'NULL'}, Last: ${user.last_name || 'NULL'}, Role: ${user.role}`);
    });
    
    // Update users without names to use their username
    const [updated] = await db.query(`
      UPDATE users 
      SET first_name = username 
      WHERE (first_name IS NULL OR first_name = '') 
      AND tenant_id = 3
    `);
    
    console.log(`\nUpdated ${updated.affectedRows} users with missing first names`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkUserNames();
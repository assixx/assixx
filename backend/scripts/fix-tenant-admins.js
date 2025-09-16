import pool from '../src/database.js';
import { logger } from '../src/utils/logger.js';

/**
 * Fix tenant_admins table by adding all admin users
 * This ensures consistency between users.role='admin' and tenant_admins entries
 */
async function fixTenantAdmins() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Find all admin users that are NOT in tenant_admins
    const [missingAdmins] = await connection.query(`
      SELECT u.id, u.tenant_id, u.username, u.email, u.role
      FROM users u
      WHERE u.role = 'admin'
      AND NOT EXISTS (
        SELECT 1 FROM tenant_admins ta
        WHERE ta.user_id = u.id AND ta.tenant_id = u.tenant_id
      )
    `);

    logger.info(`Found ${missingAdmins.length} admin users not in tenant_admins table`);

    if (missingAdmins.length > 0) {
      console.info('\nMissing admins:');
      missingAdmins.forEach((admin) => {
        console.info(`- ${admin.username} (${admin.email}) - Tenant ${admin.tenant_id}`);
      });

      // 2. Insert missing admins into tenant_admins
      for (const admin of missingAdmins) {
        await connection.query(
          `INSERT INTO tenant_admins (tenant_id, user_id, is_primary)
           VALUES (?, ?, FALSE)`,
          [admin.tenant_id, admin.id],
        );
        logger.info(`Added admin ${admin.username} to tenant_admins`);
      }

      console.info(`\n✅ Added ${missingAdmins.length} admins to tenant_admins table`);
    } else {
      console.info('\n✅ All admins are already in tenant_admins table');
    }

    // 3. Show current state
    const [allTenantAdmins] = await connection.query(`
      SELECT ta.*, u.username, u.email, u.role, t.subdomain
      FROM tenant_admins ta
      JOIN users u ON ta.user_id = u.id
      JOIN tenants t ON ta.tenant_id = t.id
      ORDER BY ta.tenant_id, ta.is_primary DESC
    `);

    console.info('\nCurrent tenant_admins state:');
    console.table(
      allTenantAdmins.map((ta) => ({
        tenant: ta.subdomain,
        user: ta.username,
        email: ta.email,
        role: ta.role,
        is_primary: ta.is_primary ? 'YES' : 'NO',
      })),
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    logger.error('Error fixing tenant_admins:', error);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

// Run the fix
fixTenantAdmins().catch((error) => {
  console.error('Failed to fix tenant_admins:', error);
  process.exit(1);
});

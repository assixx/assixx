/**
 * Jest Global Teardown
 * Runs after ALL tests are complete
 * Ensures test data is ALWAYS cleaned up
 */

import { createPool } from "mysql2/promise";

export default async function globalTeardown() {
  console.info("\n🧹 Running global test cleanup...");

  const db = createPool({
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "3307"),
    user: process.env.DB_USER ?? "assixx_user",
    password: process.env.DB_PASSWORD ?? "AssixxP@ss2025!",
    database: process.env.DB_NAME ?? "main",
    waitForConnections: true,
    connectionLimit: 1,
  });

  try {
    // Get test tenant IDs
    const testTenantQuery = `(SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%')`;

    // Delete in correct order
    const cleanupQueries = [
      `DELETE FROM user_teams WHERE tenant_id IN ${testTenantQuery}`,
      `DELETE FROM teams WHERE tenant_id IN ${testTenantQuery}`,
      `DELETE FROM departments WHERE tenant_id IN ${testTenantQuery}`,
      `DELETE FROM calendar_events WHERE tenant_id IN ${testTenantQuery}`,
      `DELETE FROM users WHERE username LIKE '__AUTOTEST__%' OR email LIKE '__AUTOTEST__%'`,
      // Delete machine-related data (must be before tenants due to foreign key)
      `DELETE FROM machine_metrics WHERE tenant_id IN ${testTenantQuery}`,
      `DELETE FROM machine_documents WHERE tenant_id IN ${testTenantQuery}`,
      `DELETE FROM machine_maintenance_history WHERE tenant_id IN ${testTenantQuery}`,
      `DELETE FROM machines WHERE tenant_id IN ${testTenantQuery}`,
      `DELETE FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%'`,
    ];

    for (const query of cleanupQueries) {
      try {
        await db.execute(query);
      } catch (error) {
        console.error(`Cleanup query failed: ${query}`, error);
      }
    }

    // Check remaining test data
    const [remaining] = await db.execute(
      `SELECT COUNT(*) as count FROM tenants WHERE subdomain LIKE '__AUTOTEST__%'`,
    );

    console.info(
      `✅ Global cleanup complete. Remaining test tenants: ${remaining[0].count}`,
    );
  } catch (error) {
    console.error("❌ Global cleanup failed:", error);
  } finally {
    await db.end();
  }
}

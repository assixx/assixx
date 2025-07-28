/**
 * Jest Global Setup
 * Runs BEFORE all tests start
 * Cleans up any leftover test data from previous runs
 */

import { createPool } from "mysql2/promise";

export default async function globalSetup() {
  console.log("\n🧹 Pre-test cleanup: Removing old test data...");

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
    // Count existing test data
    const [before] = await db.execute(
      `SELECT COUNT(*) as count FROM tenants WHERE subdomain LIKE '__AUTOTEST__%'`,
    );

    if (before[0].count > 0) {
      console.log(
        `⚠️  Found ${before[0].count} leftover test tenants. Cleaning up...`,
      );

      // Clean up using the same logic as globalTeardown
      const testTenantQuery = `(SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%')`;

      await db.execute(
        `DELETE FROM user_teams WHERE tenant_id IN ${testTenantQuery}`,
      );
      await db.execute(
        `DELETE FROM teams WHERE tenant_id IN ${testTenantQuery}`,
      );
      await db.execute(
        `DELETE FROM departments WHERE tenant_id IN ${testTenantQuery}`,
      );
      await db.execute(
        `DELETE FROM calendar_events WHERE tenant_id IN ${testTenantQuery}`,
      );
      await db.execute(
        `DELETE FROM users WHERE username LIKE '__AUTOTEST__%' OR email LIKE '__AUTOTEST__%'`,
      );
      await db.execute(
        `DELETE FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%'`,
      );

      console.log("✅ Pre-test cleanup complete");
    } else {
      console.log("✅ No leftover test data found");
    }
  } catch (error) {
    console.error("❌ Pre-test cleanup failed:", error);
    // Don't fail tests because of cleanup issues
  } finally {
    await db.end();
  }
}

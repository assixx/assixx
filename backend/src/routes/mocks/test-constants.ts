/**
 * Test Constants
 * Defines unique prefixes for test data to ensure safe cleanup
 */

// Unique prefix that will NEVER appear in real data
export const TEST_DATA_PREFIX = '__AUTOTEST__';

// Helper to create test-safe names
export const testName = {
  tenant: (name: string) => `${TEST_DATA_PREFIX}${name}`,
  user: (name: string) => `${TEST_DATA_PREFIX}${name}`,
  subdomain: (name: string) => `${TEST_DATA_PREFIX}${String(name.toLowerCase())}`,
};

// SQL condition for safe cleanup
export const TEST_DATA_CLEANUP_SQL = {
  tenants: `WHERE subdomain LIKE '${TEST_DATA_PREFIX}%' OR company_name LIKE '${TEST_DATA_PREFIX}%'`,
  users: `WHERE username LIKE '${TEST_DATA_PREFIX}%' OR email LIKE '${TEST_DATA_PREFIX}%'`,
};

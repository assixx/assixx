#!/bin/bash
# Cleanup Test Data Script
# Removes all __AUTOTEST__ prefixed data from the database

echo "🧹 Cleaning up test data from database..."

# Database credentials
DB_USER="assixx_user"
DB_PASS="AssixxP@ss2025!"
DB_NAME="main"

# Function to execute MySQL query
execute_query() {
    docker exec assixx-mysql sh -c "mysql -h localhost -u $DB_USER -p$DB_PASS $DB_NAME -e \"$1\"" 2>&1 | grep -v "Warning"
}

# Count test data before cleanup
echo "📊 Counting test data..."
USER_COUNT=$(execute_query "SELECT COUNT(*) FROM users WHERE email LIKE '%__AUTOTEST__%';" | tail -n 1)
TENANT_COUNT=$(execute_query "SELECT COUNT(*) FROM tenants WHERE subdomain LIKE '%__AUTOTEST__%';" | tail -n 1)

echo "Found:"
echo "  - Test users: $USER_COUNT"
echo "  - Test tenants: $TENANT_COUNT"

if [ "$USER_COUNT" = "0" ] && [ "$TENANT_COUNT" = "0" ]; then
    echo "✅ No test data found. Database is clean!"
    exit 0
fi

# Cleanup test data
echo "🗑️  Deleting test data..."

# Delete in correct order to avoid foreign key constraints
execute_query "SET FOREIGN_KEY_CHECKS = 0;"

# Clean up all tables that might contain test data
execute_query "DELETE FROM calendar_attendees WHERE event_id IN (SELECT id FROM calendar_events WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%__AUTOTEST__%'));"
execute_query "DELETE FROM calendar_events WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%__AUTOTEST__%');"
execute_query "DELETE FROM shift_assignments WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%__AUTOTEST__%');"
execute_query "DELETE FROM shifts WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%__AUTOTEST__%');"
execute_query "DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%__AUTOTEST__%'));"
execute_query "DELETE FROM teams WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%__AUTOTEST__%');"
execute_query "DELETE FROM departments WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%__AUTOTEST__%');"
execute_query "DELETE FROM activity_logs WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%__AUTOTEST__%');"
execute_query "DELETE FROM users WHERE email LIKE '%__AUTOTEST__%';"
execute_query "DELETE FROM tenants WHERE subdomain LIKE '%__AUTOTEST__%';"

execute_query "SET FOREIGN_KEY_CHECKS = 1;"

# Verify cleanup
echo "🔍 Verifying cleanup..."
USER_COUNT_AFTER=$(execute_query "SELECT COUNT(*) FROM users WHERE email LIKE '%__AUTOTEST__%';" | tail -n 1)
TENANT_COUNT_AFTER=$(execute_query "SELECT COUNT(*) FROM tenants WHERE subdomain LIKE '%__AUTOTEST__%';" | tail -n 1)

if [ "$USER_COUNT_AFTER" = "0" ] && [ "$TENANT_COUNT_AFTER" = "0" ]; then
    echo "✅ Test data cleanup successful!"
else
    echo "⚠️  Some test data may still remain:"
    echo "  - Test users remaining: $USER_COUNT_AFTER"
    echo "  - Test tenants remaining: $TENANT_COUNT_AFTER"
fi
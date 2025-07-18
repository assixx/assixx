#!/bin/bash
# Compare actual database schema with migration files

echo "=== Database Schema Comparison Tool ==="
echo "Comparing actual DB with migration files..."

# Export current schema from running database
echo "1. Exporting current schema from Docker MySQL..."
docker exec assixx-mysql mysqldump \
  -u assixx_user -pAssixxP@ss2025! \
  --no-data \
  --skip-comments \
  --skip-extended-insert \
  --no-tablespaces \
  main > /tmp/current-schema.sql 2>/dev/null

# Create fresh database and apply migrations
echo "2. Creating fresh database with migrations only..."
docker exec assixx-mysql mysql -u root -pStrongP@ssw0rd!123 -e "
  DROP DATABASE IF EXISTS test_migrations;
  CREATE DATABASE test_migrations;
" 2>/dev/null

# Apply all migrations to test database
echo "3. Applying all migrations..."
for migration in database/migrations/*.sql; do
  echo "   - Applying $(basename $migration)"
  docker exec -i assixx-mysql mysql \
    -u root -pStrongP@ssw0rd!123 \
    test_migrations < "$migration" 2>/dev/null || true
done

# Export schema from migrations
echo "4. Exporting schema from migrations..."
docker exec assixx-mysql mysqldump \
  -u root -pStrongP@ssw0rd!123 \
  --no-data \
  --skip-comments \
  --skip-extended-insert \
  --no-tablespaces \
  test_migrations > /tmp/migration-schema.sql 2>/dev/null

# Compare schemas
echo "5. Comparing schemas..."
echo ""
echo "=== DIFFERENCES FOUND ==="

# Remove database names and auto-increment values for cleaner diff
sed -i 's/`main`\.//g' /tmp/current-schema.sql
sed -i 's/`test_migrations`\.//g' /tmp/migration-schema.sql
sed -i 's/AUTO_INCREMENT=[0-9]* //g' /tmp/current-schema.sql
sed -i 's/AUTO_INCREMENT=[0-9]* //g' /tmp/migration-schema.sql

# Show differences
if diff -u /tmp/migration-schema.sql /tmp/current-schema.sql > /tmp/schema-diff.txt; then
  echo "✅ No differences! Migrations match current database."
else
  echo "❌ Differences found:"
  echo ""
  cat /tmp/schema-diff.txt | grep -E "^[-+]" | grep -v "^[-+]{3}" | head -50
  echo ""
  echo "Full diff saved to: /tmp/schema-diff.txt"
fi

# Cleanup
docker exec assixx-mysql mysql -u root -pStrongP@ssw0rd!123 -e "
  DROP DATABASE IF EXISTS test_migrations;
" 2>/dev/null

echo ""
echo "=== Schema Comparison Complete ==="
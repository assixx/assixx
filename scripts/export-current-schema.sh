#!/bin/bash
# Export current database schema as a single SQL file

DATE=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="database/current-schema-${DATE}.sql"

echo "Exporting current database schema..."

# Export complete schema without data
docker exec assixx-mysql mysqldump \
  -u assixx_user -pAssixxP@ss2025! \
  --no-data \
  --routines \
  --triggers \
  --single-transaction \
  --skip-lock-tables \
  --skip-comments \
  --skip-extended-insert \
  main > "$OUTPUT_FILE" 2>/dev/null

# Clean up the export
sed -i '/^\/\*!/d' "$OUTPUT_FILE"  # Remove MySQL specific comments
sed -i '/^--/d' "$OUTPUT_FILE"     # Remove SQL comments
sed -i '/^$/N;/^\n$/d' "$OUTPUT_FILE"  # Remove multiple blank lines

echo "✅ Current schema exported to: $OUTPUT_FILE"
echo ""
echo "You can now:"
echo "1. Use this as the source of truth for tests"
echo "2. Compare with existing migrations"
echo "3. Create a new consolidated migration"
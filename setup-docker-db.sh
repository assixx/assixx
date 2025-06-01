#!/bin/bash

echo "🔄 Resetting Docker database..."

# Stop and remove containers with volumes
docker-compose down -v

# Start containers
docker-compose up -d

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL to be ready..."
for i in {1..30}; do
    if docker exec assixx-mysql mysqladmin ping -h localhost -u root -pStrongP@ssw0rd!123 &> /dev/null; then
        echo "✅ MySQL is ready!"
        break
    fi
    echo -n "."
    sleep 1
done

# Import schema (skip CREATE DATABASE as Docker already creates it)
echo "📥 Importing database schema..."
tail -n +31 database/complete-schema.sql | docker exec -i assixx-mysql mysql -u assixx_user -pAssixxP@ss2025! assixx 2>&1 | grep -v "Using a password"

# Check result
TABLES=$(docker exec assixx-mysql mysql -u assixx_user -pAssixxP@ss2025! assixx -e "SHOW TABLES;" 2>/dev/null | wc -l)
echo "✅ Database setup complete! Tables created: $((TABLES-1))"

# Show some key tables
echo "📊 Key tables:"
docker exec assixx-mysql mysql -u assixx_user -pAssixxP@ss2025! assixx -e "SHOW TABLES LIKE '%users%';" 2>/dev/null
docker exec assixx-mysql mysql -u assixx_user -pAssixxP@ss2025! assixx -e "SHOW TABLES LIKE '%features%';" 2>/dev/null
docker exec assixx-mysql mysql -u assixx_user -pAssixxP@ss2025! assixx -e "SHOW TABLES LIKE '%surveys%';" 2>/dev/null
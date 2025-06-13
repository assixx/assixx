#!/bin/bash
# Run a specific migration file

if [ -z "$1" ]; then
    echo "Usage: ./run-migration.sh <migration-file>"
    exit 1
fi

MIGRATION_FILE="$1"

if [ ! -f "../database/migrations/$MIGRATION_FILE" ]; then
    echo "Migration file not found: ../database/migrations/$MIGRATION_FILE"
    exit 1
fi

echo "Running migration: $MIGRATION_FILE"
cat "../database/migrations/$MIGRATION_FILE" | docker-compose exec -T mysql mysql -u root -pStrongP@ssw0rd!123 assixx
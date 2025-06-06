#!/bin/bash
# Script to run blackboard attachments migration

echo "==================================="
echo "Running Blackboard Attachments Migration"
echo "==================================="

# Check if migration file exists
if [ ! -f "backend/src/database/migrations/add_blackboard_attachments.sql" ]; then
    echo "❌ Migration file not found!"
    exit 1
fi

echo "📁 Migration file found."
echo ""
echo "To execute the migration, run one of these commands:"
echo ""
echo "Option 1 (with password prompt):"
echo "  mysql -u root -p assixx < backend/src/database/migrations/add_blackboard_attachments.sql"
echo ""
echo "Option 2 (with sudo):"
echo "  sudo mysql assixx < backend/src/database/migrations/add_blackboard_attachments.sql"
echo ""
echo "Option 3 (if using Docker):"
echo "  docker exec -i assixx-mysql mysql -u root -p'StrongP@ssw0rd!123' assixx < backend/src/database/migrations/add_blackboard_attachments.sql"
echo ""
echo "The migration will:"
echo "  ✅ Create blackboard_attachments table"
echo "  ✅ Add attachment_count column to blackboard_entries"
echo "  ✅ Create triggers for automatic count updates"
echo ""
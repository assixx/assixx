#!/bin/bash

# Apply SQL Updates Script
# This script applies pending migrations and regenerates the complete schema

echo "=== Applying SQL Updates ==="
echo "This script will:"
echo "1. Apply pending migrations"
echo "2. Regenerate complete-schema.sql"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database credentials
DB_USER="root"
DB_PASS="StrongP@ssw0rd!123"
DB_NAME="assixx"

echo -e "${YELLOW}Checking pending migrations...${NC}"

# Check which migrations need to be applied
echo ""
echo "Found migrations:"
ls -la /home/scs/projects/Assixx/database/migrations/

echo ""
echo -e "${YELLOW}To apply these migrations manually, run:${NC}"
echo ""
echo "# Migration 1: Critical Tenant Isolation Fixes"
echo "mysql -u $DB_USER -p $DB_NAME < /home/scs/projects/Assixx/database/migrations/001-tenant-isolation-fixes.sql"
echo ""
echo "# Migration 2: Add is_primary to tenant_admins"
echo "mysql -u $DB_USER -p $DB_NAME < /home/scs/projects/Assixx/database/migrations/002-add-is-primary-to-tenant-admins.sql"
echo ""

# Generate script to regenerate complete schema
cat > /home/scs/projects/Assixx/regenerate-schema.sh << 'EOF'
#!/bin/bash

# Regenerate Complete Schema Script
echo "Regenerating complete-schema.sql..."

OUTPUT_FILE="/home/scs/projects/Assixx/database/complete-schema.sql"

# Start with header
cat > "$OUTPUT_FILE" << 'HEADER'
-- Assixx Complete Database Schema
-- Generated: $(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
-- 
-- This file contains the complete database schema including all tables,
-- views, procedures, and migrations.

SET FOREIGN_KEY_CHECKS = 0;

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS assixx CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE assixx;

HEADER

# Add all schema files in order
echo "-- Core Tables" >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/01-tenants.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/02-users.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/03-departments.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/04-teams.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/05-employees.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/06-features.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/07-tenant-features.sql >> "$OUTPUT_FILE"

echo -e "\n-- Module Tables" >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/10-admin-logs.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/11-blackboard.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/12-calendar.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/13-chat.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/14-documents.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/15-kvp.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/16-shifts.sql >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/17-surveys.sql >> "$OUTPUT_FILE"

echo -e "\n-- Views" >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/schema/90-views.sql >> "$OUTPUT_FILE"

echo -e "\n-- Migrations Applied" >> "$OUTPUT_FILE"
echo "-- Migration 001: Tenant Isolation Fixes" >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/migrations/001-tenant-isolation-fixes.sql >> "$OUTPUT_FILE"

echo -e "\n-- Migration 002: Add is_primary to tenant_admins" >> "$OUTPUT_FILE"
cat /home/scs/projects/Assixx/database/migrations/002-add-is-primary-to-tenant-admins.sql >> "$OUTPUT_FILE"

echo -e "\nSET FOREIGN_KEY_CHECKS = 1;" >> "$OUTPUT_FILE"

echo "Complete schema regenerated at: $OUTPUT_FILE"
EOF

chmod +x /home/scs/projects/Assixx/regenerate-schema.sh

echo ""
echo -e "${GREEN}Scripts created successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Apply the migrations using the mysql commands shown above"
echo "2. Run: ./regenerate-schema.sh to create updated complete-schema.sql"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC} The migrations contain critical security fixes for tenant isolation!"
echo "Without these migrations, the system is vulnerable to cross-tenant data leaks."
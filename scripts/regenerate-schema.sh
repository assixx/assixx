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
echo -e "\n-- Core Tables" >> "$OUTPUT_FILE"
for file in /home/scs/projects/Assixx/database/schema/00-core/*.sql; do
  [ -f "$file" ] && cat "$file" >> "$OUTPUT_FILE"
done

echo -e "\n-- Feature Tables" >> "$OUTPUT_FILE"
for file in /home/scs/projects/Assixx/database/schema/01-features/*.sql; do
  [ -f "$file" ] && cat "$file" >> "$OUTPUT_FILE"
done

echo -e "\n-- Module Tables" >> "$OUTPUT_FILE"
for file in /home/scs/projects/Assixx/database/schema/02-modules/*.sql; do
  [ -f "$file" ] && cat "$file" >> "$OUTPUT_FILE"
done

echo -e "\n-- Views" >> "$OUTPUT_FILE"
for file in /home/scs/projects/Assixx/database/schema/03-views/*.sql; do
  [ -f "$file" ] && cat "$file" >> "$OUTPUT_FILE"
done

# Add test data for Docker
cat >> "$OUTPUT_FILE" << 'EOF'

-- Test-Daten für Entwicklung
-- Default Root User
INSERT INTO tenants (id, company_name, subdomain, email, status) VALUES 
(1, 'Root Tenant', 'root', 'root@assixx.local', 'active')
ON DUPLICATE KEY UPDATE company_name=company_name;

-- Default Users (Passwörter sind 'password123' gehashed)
INSERT INTO users (tenant_id, username, email, password, role, first_name, last_name) VALUES
(1, 'root', 'root@assixx.local', '$2b$10$mAE5VPU.OhaPQ8x4HDuH0.9AqvhN1kXnKMu7Q6Xh1rU4Gt5yRq8Am', 'root', 'Root', 'User'),
(1, 'admin', 'admin@assixx.local', '$2b$10$mAE5VPU.OhaPQ8x4HDuH0.9AqvhN1kXnKMu7Q6Xh1rU4Gt5yRq8Am', 'admin', 'Admin', 'User'),
(1, 'employee', 'employee@assixx.local', '$2b$10$mAE5VPU.OhaPQ8x4HDuH0.9AqvhN1kXnKMu7Q6Xh1rU4Gt5yRq8Am', 'employee', 'Test', 'Employee')
ON DUPLICATE KEY UPDATE email=email;

-- Basic features for root tenant
INSERT INTO tenant_features (tenant_id, feature_id, is_active) 
SELECT 1, id, TRUE FROM features 
WHERE code IN ('basic_employees', 'document_upload', 'payslip_management')
ON DUPLICATE KEY UPDATE is_active=TRUE;
EOF

echo -e "\nSET FOREIGN_KEY_CHECKS = 1;" >> "$OUTPUT_FILE"

echo "Complete schema regenerated at: $OUTPUT_FILE"

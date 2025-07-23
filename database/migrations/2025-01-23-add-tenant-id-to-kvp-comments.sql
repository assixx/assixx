-- Migration: Add tenant_id to kvp_comments table for Multi-Tenant Isolation
-- Date: 2025-01-23
-- Critical: Fixes security vulnerability where comments could be accessed cross-tenant

-- Step 1: Add tenant_id column to kvp_comments
ALTER TABLE kvp_comments 
ADD COLUMN tenant_id INT NOT NULL AFTER id;

-- Step 2: Populate tenant_id from associated suggestions
UPDATE kvp_comments c
INNER JOIN kvp_suggestions s ON c.suggestion_id = s.id
SET c.tenant_id = s.tenant_id;

-- Step 3: Add foreign key constraint
ALTER TABLE kvp_comments
ADD CONSTRAINT fk_kvp_comments_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- Step 4: Add index for performance
ALTER TABLE kvp_comments
ADD INDEX idx_kvp_comments_tenant_id (tenant_id);

-- Step 5: Add composite index for common queries
ALTER TABLE kvp_comments
ADD INDEX idx_kvp_comments_tenant_suggestion (tenant_id, suggestion_id);
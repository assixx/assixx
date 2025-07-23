-- Migration: Add tenant_id to blackboard_confirmations table for Multi-Tenant Isolation
-- Date: 2025-01-23
-- Critical: Fixes security vulnerability where confirmations could be accessed cross-tenant

-- Step 1: Add tenant_id column to blackboard_confirmations
ALTER TABLE blackboard_confirmations 
ADD COLUMN tenant_id INT NOT NULL AFTER id;

-- Step 2: Populate tenant_id from associated blackboard_entries
UPDATE blackboard_confirmations bc
INNER JOIN blackboard_entries be ON bc.entry_id = be.id
SET bc.tenant_id = be.tenant_id;

-- Step 3: Add foreign key constraint
ALTER TABLE blackboard_confirmations
ADD CONSTRAINT fk_blackboard_confirmations_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- Step 4: Add index for performance
ALTER TABLE blackboard_confirmations
ADD INDEX idx_blackboard_confirmations_tenant_id (tenant_id);

-- Step 5: Update unique constraint to include tenant_id for proper isolation
ALTER TABLE blackboard_confirmations
DROP INDEX unique_confirmation,
ADD UNIQUE KEY unique_confirmation (entry_id, user_id, tenant_id);
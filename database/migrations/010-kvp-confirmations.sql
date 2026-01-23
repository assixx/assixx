-- =====================================================
-- Migration: KVP Read Confirmations
-- Date: 2026-01-23
-- Author: Claude
-- Description: Add kvp_confirmations table for individual read tracking
--              (Pattern 2: Individual Decrement/Increment like blackboard)
-- =====================================================

-- 1. Create Table
CREATE TABLE IF NOT EXISTS kvp_confirmations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    suggestion_id INTEGER NOT NULL REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    confirmed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: One confirmation per user per suggestion per tenant
    CONSTRAINT unique_kvp_confirmation UNIQUE (tenant_id, suggestion_id, user_id)
);

-- 2. Create Indexes
CREATE INDEX IF NOT EXISTS idx_kvp_confirmations_tenant ON kvp_confirmations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kvp_confirmations_user ON kvp_confirmations(user_id);
CREATE INDEX IF NOT EXISTS idx_kvp_confirmations_suggestion ON kvp_confirmations(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_kvp_confirmations_lookup ON kvp_confirmations(tenant_id, suggestion_id, user_id);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE kvp_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kvp_confirmations FORCE ROW LEVEL SECURITY;

-- WICHTIG: NULLIF() im ersten Teil ist PFLICHT (Bug-Fix 2025-12-03)
-- Nach set_config() + COMMIT wird app.tenant_id zu '' (empty string), NICHT NULL!
CREATE POLICY tenant_isolation ON kvp_confirmations
    FOR ALL
    USING (
        -- Root/Admin Zugriff (kein Tenant Context oder empty string)
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        -- Oder passender Tenant
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );

-- 4. Grant Permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON kvp_confirmations TO app_user;
GRANT USAGE, SELECT ON SEQUENCE kvp_confirmations_id_seq TO app_user;

-- 5. Add comment for documentation
COMMENT ON TABLE kvp_confirmations IS 'Tracks which users have marked KVP suggestions as read (Pattern 2: Individual read tracking like blackboard)';
COMMENT ON COLUMN kvp_confirmations.confirmed_at IS 'Timestamp when user marked the suggestion as read';

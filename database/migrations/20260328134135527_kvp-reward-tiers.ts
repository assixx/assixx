/**
 * Migration: KVP Reward Tiers + reward_amount on approvals
 *
 * Purpose: Root users can define predefined reward amounts per tenant.
 * KVP approval masters select a reward tier when approving.
 * The chosen amount is stored as a snapshot on the approval record.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- 1. KVP Reward Tiers — predefined amounts per tenant
    CREATE TABLE kvp_reward_tiers (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        amount NUMERIC(10,2) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active SMALLINT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX idx_kvp_reward_tiers_tenant_amount
        ON kvp_reward_tiers(tenant_id, amount) WHERE is_active = 1;

    CREATE INDEX idx_kvp_reward_tiers_tenant
        ON kvp_reward_tiers(tenant_id);

    ALTER TABLE kvp_reward_tiers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE kvp_reward_tiers FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON kvp_reward_tiers
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON kvp_reward_tiers TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE kvp_reward_tiers_id_seq TO app_user;

    -- 2. Reward amount snapshot on approvals (nullable — not all approvals have rewards)
    ALTER TABLE approvals ADD COLUMN reward_amount NUMERIC(10,2) DEFAULT NULL;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE approvals DROP COLUMN IF EXISTS reward_amount;
    DROP TABLE IF EXISTS kvp_reward_tiers CASCADE;
  `);
}

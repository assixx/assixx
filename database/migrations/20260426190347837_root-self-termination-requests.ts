/**
 * Migration: Create root_self_termination_requests table (+ ENUM + RLS + indexes)
 *
 * Purpose: Backing store for the 4-eyes peer-approval workflow that gates all
 *          self-initiated root-account terminations. Implements Layer 3 of the
 *          Defense-in-Depth model defined in the masterplan
 *          (Frontend -> Service Guard -> Approval Workflow -> DB Trigger).
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md -- Phase 1, Step 1.1
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md -- RLS pattern
 *      (strict tenant_isolation, FORCE RLS, NULLIF guard, Triple-User-Model GRANTs)
 *
 * Notes for reviewer:
 * - 2 CHECK constraints encode status invariants at the DB level:
 *     chk_no_self_approval     -- defends against bypass of service-level check
 *     chk_status_consistency   -- prevents corrupt state combinations
 * - 5 indexes: 1 UNIQUE partial (single pending per requester globally --
 *   users.id is a global SERIAL), 4 partial indexes for documented query patterns.
 * - Triple-User-Model GRANTs: app_user (RLS-bound) + sys_user (BYPASSRLS, used by
 *   the daily expiry cron -- Phase 2 §2.6).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TYPE root_self_termination_status AS ENUM (
        'pending', 'approved', 'rejected', 'expired', 'cancelled'
    );

    CREATE TABLE root_self_termination_requests (
        id UUID PRIMARY KEY DEFAULT uuidv7(),
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT,
        status root_self_termination_status NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMPTZ NOT NULL,
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        rejected_by INTEGER REFERENCES users(id),
        rejected_at TIMESTAMPTZ,
        rejection_reason TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- No self-approval (defense-in-depth, also enforced in service Phase 2)
        CONSTRAINT chk_no_self_approval
            CHECK (approved_by IS NULL OR approved_by != requester_id),

        -- Status transitions are well-formed
        CONSTRAINT chk_status_consistency CHECK (
            (status = 'pending'   AND approved_by IS NULL     AND rejected_by IS NULL) OR
            (status = 'approved'  AND approved_by IS NOT NULL AND rejected_by IS NULL) OR
            (status = 'rejected'  AND rejected_by IS NOT NULL AND approved_by IS NULL) OR
            (status = 'expired'   AND approved_by IS NULL     AND rejected_by IS NULL) OR
            (status = 'cancelled' AND approved_by IS NULL     AND rejected_by IS NULL)
        )
    );

    -- Single pending request per requester globally
    -- (uniqueness comes from the partial index itself; users.id is a global SERIAL)
    CREATE UNIQUE INDEX idx_rstr_one_pending_per_requester
        ON root_self_termination_requests(requester_id)
        WHERE status = 'pending';

    CREATE INDEX idx_rstr_tenant_status
        ON root_self_termination_requests(tenant_id, status)
        WHERE is_active = 1;

    CREATE INDEX idx_rstr_expires_at_pending
        ON root_self_termination_requests(expires_at)
        WHERE status = 'pending';

    -- For the trigger's 5-min approval-window lookup (Layer 4 -- Phase 1 Step 1.2)
    CREATE INDEX idx_rstr_requester_approved_at
        ON root_self_termination_requests(requester_id, approved_at)
        WHERE status = 'approved';

    -- For the 24h cooldown check after rejection (Phase 2 §2.4 requestSelfTermination)
    CREATE INDEX idx_rstr_requester_rejected_at
        ON root_self_termination_requests(requester_id, rejected_at)
        WHERE status = 'rejected';

    -- RLS -- strict tenant_isolation per ADR-019 (no bypass clause; sys_user used for cron)
    ALTER TABLE root_self_termination_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE root_self_termination_requests FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON root_self_termination_requests
        FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- Triple-User-Model GRANTs (mandatory per ADR-019)
    GRANT SELECT, INSERT, UPDATE, DELETE ON root_self_termination_requests TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON root_self_termination_requests TO sys_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // CASCADE drops the table together with its indexes, constraints, RLS policy
  // and FK references. The ENUM type is independent -- drop it after the table
  // (the column referencing it disappears with the table).
  pgm.sql(`
    DROP TABLE IF EXISTS root_self_termination_requests CASCADE;
    DROP TYPE IF EXISTS root_self_termination_status;
  `);
}

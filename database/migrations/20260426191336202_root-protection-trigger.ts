/**
 * Migration: Create root-protection trigger (Layer 4 of Defense-in-Depth)
 *
 * Purpose: BEFORE UPDATE OR DELETE trigger on `users` that blocks cross-root
 *          termination and gates self-termination behind the peer-approval
 *          flow. Survives backend bugs and raw psql access by enforcing the
 *          rules at the database engine level.
 *
 * Trigger logic = "Hybrid Option 1+" (closes v0.1.0 Critical Finding G):
 *   1. Bypass for system users (assixx_user, sys_user) -- migrations, cron, tenant deletion
 *   2. Bypass non-root targets
 *   3. Detect termination = DELETE | is_active flip out of 1 | role flip out of 'root'
 *   4. Require app.user_id GUC -- otherwise ROOT_PROTECTION_NO_ACTOR
 *   5. Approval-flag check FIRST + verify real approved DB row within 5-min window
 *      (GUC alone is insufficient -- defense against forged GUC injection)
 *   6. Otherwise: cross-root forbidden | self requires approval
 *   7. Last-root protection (always, even with approval)
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md -- Phase 1 Step 1.2
 * @see ADR-019 -- app.tenant_id GUC pattern; sys_user / assixx_user bypass identity
 * @see ADR-005 / ADR-006 -- app.user_id populated by setUserContext() in tenantTransaction()
 *
 * Exception codes (consumed by Phase 2 service-layer error mapping):
 *   ROOT_PROTECTION_NO_ACTOR                -- app.user_id GUC missing
 *   ROOT_CROSS_TERMINATION_FORBIDDEN        -- non-self actor terminating root
 *   ROOT_SELF_TERMINATION_REQUIRES_APPROVAL -- self without approval flag
 *   ROOT_NO_APPROVED_REQUEST                -- GUC set but no DB row in 5-min window
 *   ROOT_LAST_ROOT_PROTECTION               -- would leave tenant with 0 active roots
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION fn_prevent_cross_root_change()
    RETURNS TRIGGER AS $$
    DECLARE
        v_acting_user_id INT;
        v_active_root_count INT;
        v_is_termination BOOLEAN;
        v_self_approved TEXT;
        v_has_recent_approval BOOLEAN;
    BEGIN
        -- Bypass for system users (DDL, migrations, cron jobs, tenant deletion)
        IF current_user IN ('assixx_user', 'sys_user') THEN
            RETURN COALESCE(NEW, OLD);
        END IF;

        -- Only protect rows currently 'root'
        IF OLD.role <> 'root' THEN
            RETURN COALESCE(NEW, OLD);
        END IF;

        -- Termination = DELETE, OR is_active flip out of 1, OR role flip out of 'root'
        v_is_termination := (
            TG_OP = 'DELETE'
            OR (TG_OP = 'UPDATE' AND NEW.is_active <> 1 AND OLD.is_active = 1)
            OR (TG_OP = 'UPDATE' AND NEW.role <> 'root' AND OLD.role = 'root')
        );

        IF NOT v_is_termination THEN
            RETURN COALESCE(NEW, OLD);
        END IF;

        -- Termination detected. Acting user must be in CLS GUC.
        v_acting_user_id := NULLIF(current_setting('app.user_id', true), '')::INT;

        IF v_acting_user_id IS NULL THEN
            RAISE EXCEPTION
                'ROOT_PROTECTION_NO_ACTOR: termination of root user % blocked -- app.user_id GUC not set',
                OLD.id;
        END IF;

        -- HYBRID OPTION 1+ (masterplan v0.2.0):
        -- Check approval flag FIRST. If set, verify a real approved row exists
        -- (defense-in-depth: GUC alone is insufficient -- also requires DB row).
        -- This must come BEFORE the cross-root check, because the legitimate
        -- approve flow runs with actor=approver, target=requester (cross-root by design).
        v_self_approved := current_setting('app.root_self_termination_approved', true);

        IF v_self_approved IS NOT NULL AND v_self_approved = 'true' THEN
            -- Verify there is a real approved row for this requester in the tenant
            -- within a 5-minute window. The window is large enough to cover
            -- transaction commit timing, small enough to prevent stale GUCs from
            -- being misused later.
            SELECT EXISTS(
                SELECT 1 FROM root_self_termination_requests
                WHERE requester_id = OLD.id
                  AND tenant_id = OLD.tenant_id
                  AND status = 'approved'
                  AND approved_at > NOW() - INTERVAL '5 minutes'
            ) INTO v_has_recent_approval;

            IF NOT v_has_recent_approval THEN
                RAISE EXCEPTION
                    'ROOT_NO_APPROVED_REQUEST: termination of root user % blocked -- no approved request found within the last 5 minutes',
                    OLD.id;
            END IF;

            -- Approved flow legit: skip cross-root check (actor=approver != target by design)
        ELSE
            -- Normal path: cross-root forbidden + self requires approval
            IF v_acting_user_id <> OLD.id THEN
                RAISE EXCEPTION
                    'ROOT_CROSS_TERMINATION_FORBIDDEN: user % cannot terminate root user %',
                    v_acting_user_id, OLD.id;
            END IF;

            -- Self-action without approval flag -> blocked
            RAISE EXCEPTION
                'ROOT_SELF_TERMINATION_REQUIRES_APPROVAL: root user % cannot self-terminate without approved request',
                OLD.id;
        END IF;

        -- Last-root protection (ALWAYS, even with approval)
        SELECT COUNT(*) INTO v_active_root_count
        FROM users
        WHERE tenant_id = OLD.tenant_id
          AND role = 'root'
          AND is_active = 1
          AND id <> OLD.id;

        IF v_active_root_count = 0 THEN
            RAISE EXCEPTION
                'ROOT_LAST_ROOT_PROTECTION: cannot terminate the last active root in tenant %',
                OLD.tenant_id;
        END IF;

        RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_root_protection
        BEFORE UPDATE OR DELETE ON users
        FOR EACH ROW
        EXECUTE FUNCTION fn_prevent_cross_root_change();
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Drop trigger first (depends on function), then the function.
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_root_protection ON users;
    DROP FUNCTION IF EXISTS fn_prevent_cross_root_change();
  `);
}

/**
 * Migration: Add `initiated_by_user_id` to `password_reset_tokens`.
 *
 * Purpose: distinguish self-service reset tokens (NULL) from Root-initiated
 * reset tokens (Root-ID) so the redemption-gate (§2.6 / §2.8) can branch:
 * NULL keeps the self-service role-gate (Root-only redemption), NOT-NULL
 * switches to an initiator-origin-check (initiator must still be an active
 * Root in the target's tenant).
 *
 * Why ON DELETE SET NULL (not CASCADE): a deleted Root must NOT cascade-nuke
 * in-flight admin-initiated tokens. Instead the FK becomes NULL — the token
 * then looks like a self-service token at redemption time, and the §2.6
 * role-gate blocks it for admin/employee targets (defence-in-depth).
 *
 * No RLS changes: `password_reset_tokens` is a global table (ADR-019 §7) —
 * no tenant_id, no RLS policy. Existing table-level GRANTs for `app_user` +
 * `sys_user` apply automatically to the new column (PG GRANTs are
 * table-scoped unless COLUMN-specific). No index on the new column —
 * redemption locates the token by hash (unique), not by initiator.
 *
 * @see docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md §1 + §2.7–§2.8
 * @see docs/infrastructure/adr/ADR-050-forgot-password-role-gate.md (pending Phase 6)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE password_reset_tokens
      ADD COLUMN initiated_by_user_id INTEGER NULL
      REFERENCES users(id) ON DELETE SET NULL;

    COMMENT ON COLUMN password_reset_tokens.initiated_by_user_id IS
      'NULL = self-service token (via /auth/forgot-password). NOT NULL = Root-initiated token (via admin-reset-link endpoint). Redemption gate branches on this. ADR-050.';
  `);
}

export function down(pgm: MigrationBuilder): void {
  // `IF EXISTS` allowed in down() per DATABASE-MIGRATION-GUIDE "Required Patterns".
  pgm.sql(`
    ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS initiated_by_user_id;
  `);
}

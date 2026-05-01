/**
 * Migration: Flip fk_users_tenant from ON DELETE RESTRICT to ON DELETE CASCADE
 *
 * Purpose: Restore the anti-subdomain-squatting guarantee from FEAT_2FA_EMAIL
 *          Masterplan §0.4 / DD-14. The 2FA SMTP-failure rollback path in
 *          SignupService deletes the tenant row to release the subdomain;
 *          the reaper's `dropTenantCascade` branch
 *          (backend/src/nest/two-factor-auth/two-factor-auth-reaper.service.ts)
 *          assumes the FK cascades user deletes too. The live FK was RESTRICT
 *          so DELETE FROM tenants would block on dependent users
 *          (FEAT_2FA_EMAIL_MASTERPLAN §D4 / v0.8.4 audit).
 *
 *          ON UPDATE CASCADE is preserved (tenant id is SERIAL — never
 *          updated in production, but we keep the upstream behaviour).
 *
 *          No data migration. No RLS / GRANT change. Single ALTER per side.
 *
 * References:
 *   - docs/FEAT_2FA_EMAIL_MASTERPLAN.md §Spec Deviations D4 (queued v0.8.4)
 *   - docs/FEAT_2FA_EMAIL_MASTERPLAN.md §0.4 / DD-14 (anti-subdomain-squat)
 *   - backend/src/nest/two-factor-auth/two-factor-auth-reaper.service.ts
 *     (dropTenantCascade branch — WARNING blocks dropped after this migration)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE users
      DROP CONSTRAINT fk_users_tenant;

    ALTER TABLE users
      ADD CONSTRAINT fk_users_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE users
      DROP CONSTRAINT fk_users_tenant;

    ALTER TABLE users
      ADD CONSTRAINT fk_users_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  `);
}

/**
 * Migration: Add photo_etag column to user_oauth_accounts
 *
 * Purpose: Enables caching of Microsoft Graph profile-photo ETag so re-logins
 * can skip the binary download when the photo is unchanged. Metadata call
 * (~200 B) returns `@odata.mediaEtag`; if it matches the stored value we
 * avoid fetching the 240x240 JPEG.
 *
 * Context: Extends the Microsoft OAuth sign-in introduced by ADR-046. The
 * column is nullable — existing OAuth accounts have no photo cached yet;
 * the first successful sync populates it.
 *
 * Scope: ONE column on an existing tenant-scoped table. RLS policy
 * (`tenant_isolation`) and GRANTs for `app_user` / `sys_user` already exist
 * on the table and apply to the new column automatically — no policy or
 * GRANT changes required.
 *
 * @see docs/FEAT_OAUTH_PROFILE_PHOTO_MASTERPLAN.md — Phase 1 Step 1.1
 * @see docs/infrastructure/adr/ADR-046-oauth-sign-in.md — base feature
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE user_oauth_accounts
      ADD COLUMN photo_etag VARCHAR(64);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE user_oauth_accounts
      DROP COLUMN IF EXISTS photo_etag;
  `);
}

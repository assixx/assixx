/**
 * Migration: Replace dead-schema 2FA columns with email-2FA enrollment timestamps.
 *
 * Purpose: enable mandatory email-based 2FA at every password authentication
 * entry point (signup + login). Phase 1 of FEAT_2FA_EMAIL_MASTERPLAN.
 *
 * Up:
 *   (a) DROP legacy `two_factor_secret VARCHAR(255)` and `two_factor_enabled BOOLEAN`.
 *       These columns originate from a never-shipped TOTP attempt — code audit
 *       on 2026-04-28 confirmed ZERO references in `backend/` + `shared/` (incl.
 *       tests), and pre-migration data audit confirmed ZERO non-NULL values
 *       across all 129 production users. The DROP is therefore lossless.
 *   (b) ADD `tfa_enrolled_at TIMESTAMPTZ NULL` — set on the first successful
 *       email-2FA verification (transparent enrollment, DD-11). Permanent.
 *   (c) ADD `last_2fa_verified_at TIMESTAMPTZ NULL` — updated on every successful
 *       verify; powers compliance / audit reporting (last-seen-with-2FA).
 *
 * Down:
 *   Reverses the column set defensively (`IF EXISTS` / `IF NOT EXISTS`). The
 *   recreated legacy columns are empty — no data is restored, because no data
 *   was ever stored. Down is provided for completeness; in practice this
 *   migration is one-way once the email-2FA module ships.
 *
 * Schema-only migration — no data backfill (NULL is the correct semantic for
 * users who have not yet completed 2FA, see DD-11).
 *
 * RLS / GRANTs: not touched — column-level GRANTs inherit from `users` (RLS-
 * enabled + Force-RLS, ADR-019). Adding nullable columns is a metadata-only
 * change that does not invalidate existing policies.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §1.1 (this step)
 * @see docs/infrastructure/adr/ADR-014-database-migration-architecture.md
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md
 * @see docs/DATABASE-MIGRATION-GUIDE.md (HARD BLOCK rules — generator-created,
 *      backup-first, dry-run mandatory)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // No `IF NOT EXISTS` / `IF EXISTS` here — fail-loud on partial apply per
  // DATABASE-MIGRATION-GUIDE.md "Forbidden Patterns" + masterplan §1.1 checklist.
  pgm.sql(`
    -- (a) Drop legacy TOTP-attempt columns (zero refs in code, zero non-NULL data
    --     verified 2026-04-28 — see migration header).
    ALTER TABLE users DROP COLUMN two_factor_secret;
    ALTER TABLE users DROP COLUMN two_factor_enabled;

    -- (b) Add email-2FA enrollment + verification timestamps.
    ALTER TABLE users ADD COLUMN tfa_enrolled_at TIMESTAMPTZ NULL;
    ALTER TABLE users ADD COLUMN last_2fa_verified_at TIMESTAMPTZ NULL;

    COMMENT ON COLUMN users.tfa_enrolled_at IS
      '2FA enrollment timestamp. NULL = never completed 2FA. Set on first successful verify (transparent enrollment, FEAT_2FA_EMAIL DD-11 / ADR-054).';
    COMMENT ON COLUMN users.last_2fa_verified_at IS
      'Most recent successful 2FA verification (FEAT_2FA_EMAIL / ADR-054). Audit / compliance.';
  `);
}

export function down(pgm: MigrationBuilder): void {
  // `IF EXISTS` / `IF NOT EXISTS` allowed in down() per DATABASE-MIGRATION-GUIDE.md
  // "Required Patterns" (defensive rollback). Recreated legacy columns are empty —
  // no data is or can be restored. See migration header for one-way disclosure.
  pgm.sql(`
    ALTER TABLE users DROP COLUMN IF EXISTS last_2fa_verified_at;
    ALTER TABLE users DROP COLUMN IF EXISTS tfa_enrolled_at;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
  `);
}

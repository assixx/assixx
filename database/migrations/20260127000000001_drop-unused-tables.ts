/**
 * Migration: Drop unused/unimplemented tables
 * Date: 2026-01-21 (original) / 2026-01-27 (wrapped)
 *
 * Removes 16 tables that were created but never used in code.
 * Analysis: grep -r "table_name" backend/src → zero matches.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    SET session_replication_role = 'replica';

    DROP TABLE IF EXISTS subscription_plans CASCADE;
    DROP TABLE IF EXISTS activity_logs CASCADE;
    DROP TABLE IF EXISTS api_logs CASCADE;
    DROP TABLE IF EXISTS security_logs CASCADE;
    DROP TABLE IF EXISTS system_logs CASCADE;
    DROP TABLE IF EXISTS login_attempts CASCADE;
    DROP TABLE IF EXISTS user_2fa_backup_codes CASCADE;
    DROP TABLE IF EXISTS user_2fa_secrets CASCADE;
    DROP TABLE IF EXISTS email_queue CASCADE;
    DROP TABLE IF EXISTS email_templates CASCADE;
    DROP TABLE IF EXISTS recurring_jobs CASCADE;
    DROP TABLE IF EXISTS scheduled_tasks CASCADE;
    DROP TABLE IF EXISTS backup_retention_policy CASCADE;
    DROP TABLE IF EXISTS migration_log CASCADE;
    DROP TABLE IF EXISTS released_subdomains CASCADE;

    SET session_replication_role = 'origin';
  `);
}

export function down(): void {
  throw new Error(
    'Cannot restore dropped tables - data was permanently removed. Restore from backup.',
  );
}

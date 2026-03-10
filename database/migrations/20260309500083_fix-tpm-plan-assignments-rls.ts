import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Fix RLS policy on tpm_plan_assignments.
 *
 * The original migration (20260309400082) was missing:
 *   1. FORCE ROW LEVEL SECURITY
 *   2. The standard `NULLIF(...) IS NULL OR` clause (ADR-019 pattern)
 *
 * Without the IS NULL clause, queries without tenant context
 * (e.g. via DatabaseService.query()) get blocked because
 * `tenant_id = NULL::integer` always evaluates to NULL/FALSE.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(
    'DROP POLICY tpm_plan_assignments_tenant_isolation ON tpm_plan_assignments',
  );

  pgm.sql('ALTER TABLE tpm_plan_assignments FORCE ROW LEVEL SECURITY');

  pgm.sql(`
    CREATE POLICY tenant_isolation ON tpm_plan_assignments
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      )
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP POLICY tenant_isolation ON tpm_plan_assignments');

  pgm.sql('ALTER TABLE tpm_plan_assignments NO FORCE ROW LEVEL SECURITY');

  pgm.sql(`
    CREATE POLICY tpm_plan_assignments_tenant_isolation ON tpm_plan_assignments
      USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      )
  `);
}

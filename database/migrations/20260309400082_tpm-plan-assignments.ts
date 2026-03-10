import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Creates `tpm_plan_assignments` table for direct employee-to-plan-date assignments.
 * Replaces the previous shift-based derivation (shift_plans.is_tpm_mode).
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('tpm_plan_assignments', {
    id: { type: 'serial', primaryKey: true },
    uuid: { type: 'char(36)', notNull: true },
    tenant_id: {
      type: 'integer',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    plan_id: {
      type: 'integer',
      notNull: true,
      references: 'tpm_maintenance_plans(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    scheduled_date: { type: 'date', notNull: true },
    created_by: {
      type: 'integer',
      notNull: true,
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    is_active: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint(
    'tpm_plan_assignments',
    'chk_tpm_plan_assignments_is_active',
    { check: 'is_active IN (0, 1, 3, 4)' },
  );

  // One row per plan + user + date (allows clean ON CONFLICT upsert)
  pgm.createIndex(
    'tpm_plan_assignments',
    ['plan_id', 'user_id', 'scheduled_date'],
    { unique: true, name: 'idx_tpm_plan_assignments_unique' },
  );

  // Lookup: plan + date range (plan-specific assignment view)
  pgm.createIndex(
    'tpm_plan_assignments',
    ['tenant_id', 'plan_id', 'scheduled_date'],
    { name: 'idx_tpm_plan_assignments_plan_date', where: 'is_active = 1' },
  );

  // Lookup: tenant + date range (Gesamtansicht cross-plan view)
  pgm.createIndex('tpm_plan_assignments', ['tenant_id', 'scheduled_date'], {
    name: 'idx_tpm_plan_assignments_tenant_date',
    where: 'is_active = 1',
  });

  // RLS (ADR-019 standard pattern)
  pgm.sql('ALTER TABLE tpm_plan_assignments ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE tpm_plan_assignments FORCE ROW LEVEL SECURITY');
  pgm.sql(`
    CREATE POLICY tenant_isolation ON tpm_plan_assignments
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      )
  `);

  // Grants
  pgm.sql(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_plan_assignments TO app_user',
  );
  pgm.sql(
    'GRANT USAGE, SELECT ON SEQUENCE tpm_plan_assignments_id_seq TO app_user',
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(
    'DROP POLICY IF EXISTS tpm_plan_assignments_tenant_isolation ON tpm_plan_assignments',
  );
  pgm.dropTable('tpm_plan_assignments');
}

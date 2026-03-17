import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Creates ENUM `org_entity_type` and table `org_chart_positions`
 * for storing visual positions of organizational entities
 * in the org chart builder (Organigramm feature).
 *
 * Separate from business data — purely UI layout storage.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TYPE org_entity_type AS ENUM ('area', 'department', 'team', 'asset')
  `);

  pgm.createTable('org_chart_positions', {
    id: { type: 'serial', primaryKey: true },
    uuid: { type: 'char(36)', notNull: true, unique: true },
    tenant_id: {
      type: 'integer',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    entity_type: { type: 'org_entity_type', notNull: true },
    entity_uuid: { type: 'char(36)', notNull: true },
    position_x: { type: 'numeric(10,2)', notNull: true, default: 0 },
    position_y: { type: 'numeric(10,2)', notNull: true, default: 0 },
    width: { type: 'numeric(10,2)', notNull: true, default: 200 },
    height: { type: 'numeric(10,2)', notNull: true, default: 80 },
    is_active: { type: 'smallint', notNull: true, default: 1 },
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
    uuid_created_at: { type: 'timestamptz', notNull: true },
  });

  pgm.addConstraint(
    'org_chart_positions',
    'chk_org_chart_positions_is_active',
    { check: 'is_active IN (0, 1, 3, 4)' },
  );

  // One position per entity per tenant
  pgm.addConstraint('org_chart_positions', 'uq_org_chart_positions_entity', {
    unique: ['tenant_id', 'entity_type', 'entity_uuid'],
  });

  pgm.createIndex('org_chart_positions', ['tenant_id'], {
    name: 'idx_org_chart_positions_tenant',
    where: 'is_active = 1',
  });

  pgm.createIndex('org_chart_positions', ['tenant_id', 'entity_type'], {
    name: 'idx_org_chart_positions_tenant_type',
    where: 'is_active = 1',
  });

  // RLS (ADR-019 NULLIF pattern)
  pgm.sql('ALTER TABLE org_chart_positions ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE org_chart_positions FORCE ROW LEVEL SECURITY');
  pgm.sql(`
    CREATE POLICY tenant_isolation ON org_chart_positions
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      )
  `);

  pgm.sql(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON org_chart_positions TO app_user',
  );
  pgm.sql(
    'GRANT USAGE, SELECT ON SEQUENCE org_chart_positions_id_seq TO app_user',
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP POLICY IF EXISTS tenant_isolation ON org_chart_positions');
  pgm.dropTable('org_chart_positions');
  pgm.sql('DROP TYPE IF EXISTS org_entity_type');
}

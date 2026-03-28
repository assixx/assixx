/**
 * Migration: Seed area_deputy_lead and department_deputy_lead system positions
 *
 * Purpose: The Position Catalog uses lazy seeding (ensureSystemPositions() on first access).
 * However, the SYSTEM_POSITIONS array in code hasn't been updated yet (Phase 2).
 * This migration ensures existing tenants get the two new deputy positions immediately,
 * so they're available even before the backend code is updated.
 *
 * Uses gen_random_uuid() for IDs (position_catalog uses UUIDv7 in code, but
 * gen_random_uuid() produces valid UUIDs that work fine as PKs).
 *
 * ON CONFLICT DO NOTHING — idempotent: safe to re-run if positions already exist
 *
 * @see docs/FEAT_DEPUTY_LEADS_MASTERPLAN.md (Step 1.5)
 * @see ADR-038 (Position Catalog Architecture)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    INSERT INTO position_catalog (id, tenant_id, name, role_category, sort_order, is_system, is_active)
    SELECT gen_random_uuid(), t.id, pos.name, pos.role_category::position_role_category,
           0, true, 1
    FROM tenants t
    CROSS JOIN (VALUES
      ('area_deputy_lead', 'admin'),
      ('department_deputy_lead', 'admin')
    ) AS pos(name, role_category)
    WHERE NOT EXISTS (
      SELECT 1 FROM position_catalog pc
      WHERE pc.tenant_id = t.id AND pc.name = pos.name AND pc.is_active = 1
    );
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DELETE FROM position_catalog
    WHERE name IN ('area_deputy_lead', 'department_deputy_lead')
      AND is_system = true;
  `);
}

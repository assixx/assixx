/**
 * Migration: Permission Phase 3 — New Features
 * Date: 2026-03-09
 *
 * Creates 5 new feature entries that didn't exist in the features table,
 * maps them to all subscription plans, activates them for all tenants,
 * and seeds permission rows for existing admin users.
 *
 * New features:
 * - assets (premium) — Anlagen & Maschinen
 * - reports (premium) — Berichte & Auswertungen
 * - audit_trail (enterprise) — Protokoll & Audit
 * - notifications (basic) — Benachrichtigungen
 * - dummy_users (core) — Platzhalter-Benutzer
 *
 * @see docs/PERMISSION-REGISTRY-OFFICIAL.md
 */
import type { MigrationBuilder } from 'node-pg-migrate';

/** Feature definitions: [code, name, description, category, sort_order] */
const NEW_FEATURES: [string, string, string, string, number][] = [
  [
    'assets',
    'Anlagen & Maschinen',
    'Verwaltung von Anlagen, Maschinen und Verfügbarkeit',
    'premium',
    60,
  ],
  [
    'reports',
    'Berichte & Auswertungen',
    'Unternehmensberichte und Analytics',
    'premium',
    65,
  ],
  [
    'audit_trail',
    'Protokoll & Audit',
    'Audit-Protokollierung und Compliance-Berichte',
    'enterprise',
    70,
  ],
  [
    'notifications',
    'Benachrichtigungen',
    'Benachrichtigungsverwaltung und SSE-Streaming',
    'basic',
    75,
  ],
  [
    'dummy_users',
    'Platzhalter-Benutzer',
    'Anonyme Anzeige-Accounts für Bildschirme',
    'core',
    80,
  ],
];

/** Module definitions: [featureCode, moduleCode, canRead, canWrite, canDelete] */
const NEW_MODULES: [string, string, boolean, boolean, boolean][] = [
  // assets
  ['assets', 'assets-manage', true, true, true],
  ['assets', 'assets-availability', true, true, true],
  // reports
  ['reports', 'reports-view', true, false, false],
  ['reports', 'reports-export', true, true, false],
  // audit_trail
  ['audit_trail', 'audit-view', true, false, false],
  ['audit_trail', 'audit-export', true, true, false],
  ['audit_trail', 'audit-retention', true, false, true],
  // notifications
  ['notifications', 'notifications-manage', true, true, false],
  // dummy_users
  ['dummy_users', 'dummy-users-manage', true, true, true],
];

export function up(pgm: MigrationBuilder): void {
  // 1. Insert new features
  for (const [code, name, description, category, sortOrder] of NEW_FEATURES) {
    pgm.sql(`
      INSERT INTO features (code, name, description, category, is_active, sort_order)
      VALUES ('${code}', '${name}', '${description}', '${category}'::features_category, 1, ${sortOrder})
      ON CONFLICT (code) DO NOTHING
    `);
  }

  // 2. Map to all plans (Basic=1, Professional=2, Enterprise=3)
  for (const [code] of NEW_FEATURES) {
    pgm.sql(`
      INSERT INTO plan_features (plan_id, feature_id, is_included)
      SELECT p.id, f.id, true
      FROM plans p
      CROSS JOIN features f
      WHERE f.code = '${code}'
        AND p.id IN (1, 2, 3)
      ON CONFLICT (plan_id, feature_id) DO NOTHING
    `);
  }

  // 3. Activate for all tenants
  for (const [code] of NEW_FEATURES) {
    pgm.sql(`
      INSERT INTO tenant_features (tenant_id, feature_id, is_active, activated_at)
      SELECT t.id, f.id, 1, NOW()
      FROM tenants t
      CROSS JOIN features f
      WHERE f.code = '${code}'
      ON CONFLICT (tenant_id, feature_id) DO NOTHING
    `);
  }

  // 4. Seed permission rows for existing admins
  for (const [feat, mod, canRead, canWrite, canDelete] of NEW_MODULES) {
    pgm.sql(`
      INSERT INTO user_feature_permissions
        (tenant_id, user_id, feature_code, module_code, can_read, can_write, can_delete, assigned_by)
      SELECT
        u.tenant_id,
        u.id,
        '${feat}',
        '${mod}',
        ${canRead},
        ${canWrite},
        ${canDelete},
        u.id
      FROM users u
      WHERE u.role = 'admin'
        AND u.is_active = 1
        AND u.tenant_id IS NOT NULL
      ON CONFLICT (tenant_id, user_id, feature_code, module_code) DO NOTHING
    `);
  }
}

export function down(pgm: MigrationBuilder): void {
  const featureCodes = NEW_FEATURES.map(([code]) => `'${code}'`).join(', ');

  // Remove permission rows
  const moduleConditions = NEW_MODULES.map(
    ([feat, mod]) => `(feature_code = '${feat}' AND module_code = '${mod}')`,
  ).join('\n       OR ');

  pgm.sql(`
    DELETE FROM user_feature_permissions
    WHERE ${moduleConditions}
  `);

  // Remove tenant_features
  pgm.sql(`
    DELETE FROM tenant_features
    WHERE feature_id IN (SELECT id FROM features WHERE code IN (${featureCodes}))
  `);

  // Remove plan_features (has delete trigger, but migration should handle it)
  pgm.sql(`
    DELETE FROM plan_features
    WHERE feature_id IN (SELECT id FROM features WHERE code IN (${featureCodes}))
  `);

  // Remove features — blocked by prevent_features_delete trigger
  // Must disable trigger temporarily
  pgm.sql(`ALTER TABLE features DISABLE TRIGGER prevent_features_delete`);
  for (const [code] of NEW_FEATURES) {
    pgm.sql(`DELETE FROM features WHERE code = '${code}'`);
  }
  pgm.sql(`ALTER TABLE features ENABLE TRIGGER prevent_features_delete`);
}
